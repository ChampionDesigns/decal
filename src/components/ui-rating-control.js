/**
 * ui-rating-control — Wave 4 item #46, the Rating control (Live compound).
 *
 * Part 4 Wave 4, "Live-screen compounds" table, row #46: "Enjoyment score + slider +
 * DYE handoff. Currently 11px shorter than its own contents whenever the handoff is
 * present (L4). Persists through ReaPrime's own enjoyment annotation
 * (PUT /api/v1/shots/<id>), not a skin-local KV orphan (CARRY_FORWARD.md §3c,
 * shot-metrics row). | medium | #23, #1".
 *
 * Part 4, "Components that exist to fix a known defect": "#46 Rating control | L4 —
 * box shorter than its contents with the DYE handoff". The acceptance test for every
 * row on that table is the same sentence: THE DEFECT CANNOT BE EXPRESSED.
 *
 * =========================================================================
 * L4, AND WHY IT IS ARITHMETIC RATHER THAN CARELESSNESS
 * =========================================================================
 *
 * LAYOUT_SPEC_DRAFT.md §7.2 L4, verbatim: ".slate-shot-rate is 11px shorter than its
 * own contents whenever the DYE handoff is present — children sum to 176 in a 165px
 * box; measured bottom 1156 against 1145. | slate-live.css:1505-1522; measured".
 *
 * The oracle records both halves of that sum, and the shape of the bug is in the two
 * CITE lines rather than in the numbers:
 *
 *   CITE live-ready .slate-shot-rate [i=154] height = 165px  <-  slate-live.css
 *        (hash)main-page .slate-shot-rate  authored 165px  !important=no
 *        (FROZEN/hardcoded)
 *   CITE live-ready (hash)shot-dye-btn [i=158] height = 64px  <-  slate-live.css
 *        (hash)main-page .slate-rate-dye  authored var(--slate-control-height)
 *        !important=no  (token-driven)
 *
 * One box FROZEN, one child TOKEN-DRIVEN. The container was hand-derived once, from a
 * layout that had three children, and the fourth arrives from a capability check —
 * so the number was correct on every machine without the DYE2 plugin and wrong on
 * every machine with it. Retargeting --slate-control-height moves the button and
 * leaves the box exactly where it was. The sheet even shows its working:
 * slate-live.css:1508-1509, "165, not 164: the zone's foot is where its button ends,
 * and that is level with the All-shots button across the seam."
 *
 * The children, measured, all seven states agreeing to the pixel:
 *   CITE live-ready .slate-derived-label [i=155] rect 1745,980,129,17   (the cap)
 *   CITE live-ready (hash)shot-rating-score [i=156] rect 1745,1009,24,27
 *   CITE live-ready (hash)shot-rating-slider [i=157] rect 1745,1048,147,32
 *   CITE live-ready (hash)shot-dye-btn [i=158] rect 1745,1092,147,64
 * 17 + 12 + 27 + 12 + 32 + 12 + 64 = 176 in a box whose content edge runs 980..1145.
 * The gap is --slate-space-3 = 12px, read off the rects (997 -> 1009, 1036 -> 1048,
 * 1080 -> 1092); --ui-space-3 is the same 12px (styles/tokens.css:267).
 *
 * THE ANSWER, AND IT IS ONE DECLARATION. This component states no height at all, and
 * states that it may never be shorter than what is inside it:
 *
 *     :host { min-block-size: max-content; }
 *
 * That is spec §2.3 case 4 ("minimum floors on a flex/grid track ... these are
 * required, not merely permitted") rather than a bare px, and it is strictly stronger
 * than deleting the 165: a SCREEN that states block-size: 165px on this element still
 * gets a box as tall as its contents, because the used height is
 * max(stated, max-content). The handoff cannot fall out of the bottom of the zone,
 * and no number anywhere has to be re-derived when the button, the cap or the gap
 * changes. The rendering suite drills --ui-control-h and watches the host follow,
 * which is the assertion Slate's 165px could never pass.
 *
 * MEASURED HERE, at BOTH Gate A geometries and identical at both (the zone reads its
 * own container, not the viewport): 44 + 12 + 48 + 12 + 64 = 180px with the handoff,
 * 104px without. Those numbers are recorded, not pinned — the suite asserts that the
 * host equals the sum of its rows and gaps, so a token move changes both sides and
 * nothing has to be re-derived by hand. Slate's is 165 holding 176.
 *
 * THE COLUMN IS THE HOST, so there is no second opinion about how tall this zone is.
 * Slate has an outer box (.slate-shot-rate, height 165) and an inner flex column that
 * ignores it; one box cannot disagree with itself.
 *
 * ORDER OF SURRENDER (spec §2.4's third bullet), stated: nothing here surrenders. The
 * slider's 48px hit box and the handoff's --ui-control-h are ergonomic floors —
 * "ergonomics is physical" (spec §2.2) — so every row is flex: 0 0 auto and a short
 * container is answered by the floor above, not by squashing a control a wet finger
 * has to hit. The one thing that DOES absorb a narrow container is the score's type,
 * which is the fluid display step doing its job (see GEOMETRY).
 *
 * =========================================================================
 * WHERE A RATING LIVES — GATE 2, AND THE KV ORPHAN THAT IS NOT PORTED
 * =========================================================================
 *
 * `CARRY_FORWARD.md` §3c, `shot-metrics.js` row: "REPLACE RATING_NAMESPACE/ratingKey
 * (:133-142) with ReaPrime's own enjoyment field: it is on ShotAnnotations, is its own
 * DB column, round-trips through GET /shots/<id>, and is writable by
 * PUT /api/v1/shots/<id> with {annotations:{enjoyment:n}} (the handler deep-merges, so
 * a partial patch is safe). The comment at shot-rating.js:18-19 claiming 'annotations
 * are not ours to PATCH' is wrong ... The KV rating is invisible to other clients, to
 * /data/export and to shot filtering, and is orphaned forever when the shot is
 * deleted."
 *
 * So `RATING_NAMESPACE = 'slate'` and `ratingKey(id) = 'rating:' + id`
 * (`shot-metrics.js:139-141`) are DELETED, not moved. Two independent audit findings
 * agree: `CAPABILITY_DIFF.md:62` records that the 'slate' namespace is absent from
 * GET /api/v1/data/export until some REST call happens to create it, so a backup taken
 * before anyone opened the skin "looks complete" and carries no ratings at all.
 *
 * GATE 2 — HOW THIS COMPONENT TOUCHES SERVER DATA, WHICH IS: NOT DIRECTLY.
 *
 * There is no key string, no frame read and no fetch below. `enjoyment` is spelled
 * exactly once in the whole skin, at `src/data/rea-shot-record.js:84`
 * (ENJOYMENT_KEY), and the reader that produces it is `readShotAnnotations` in the
 * same file. This compound is CONTROLLED: the screen reads the annotation through the
 * address layer and `src/stores/`, hands the number in as `score`, and writes the one
 * the user commits back through the generated client. A component that fetched would
 * be the wave's stated block, and a component that typed 'enjoyment' would be the same
 * block one layer lower.
 *
 * THE SCALE IS THIS COMPONENT'S, AND IT SAYS SO UPSTREAM.
 * `src/data/rea-shot-record.js:81-83`, verbatim: "ReaPrime does not bound the double.
 * The old panel's 0..100 is a SKIN scale, so it belongs to the rating control, not to
 * the reader — this module reports the number the server holds."
 *
 * That is an explicit assignment, so RATING_MIN / RATING_MAX / RATING_STEP live here
 * and nowhere else. It is NOT a limits table and it does not go near R2: B2/R2 govern
 * the ONE table of machine limits — temperature, pressure, flow, the steam floor —
 * which is `src/lib/machine-limits.js` behind `r2MachineLimits`, and which carries no
 * rating key at all. A rating is not a machine bound; nothing here clamps a machine
 * value, and no number in this file describes hardware.
 *
 * A SERVED SCORE OUTSIDE THE SCALE IS REPORTED, NOT CORRECTED (A7). The tile prints
 * what the server holds; a native range input clamps only its own thumb, so
 * aria-valuetext carries the served number and the announcement never lies about a
 * value the pointer cannot express.
 *
 * =========================================================================
 * WHAT ELSE IS DELIBERATELY NOT PORTED FROM shot-rating.js
 * =========================================================================
 *
 * 1. THE 400 ms DEBOUNCE. `shot-rating.js:90-99` schedules the write on a timer
 *    because it saves on `input`, and "dragging a 0-100 slider fires an input event
 *    per pixel, and each one would otherwise be a POST to the machine". This
 *    component has no timer: the number above the thumb follows it LOCALLY, through
 *    this component's own reactive state and no event at all, and `rating-change` is
 *    published ONCE per gesture, on the control's own commit. (Until 29 Aug 2026 the
 *    drag also published `rating-input`; nothing heard it, and a per-pixel
 *    announcement is the debounce problem wearing different clothes — audit F-011.)
 *    The write policy stays the accepted one — no debounce
 *    timer, one write in flight, latest-wins (D7's pattern, `CARRY_FORWARD.md`) — and
 *    it stays where it belongs, in the screen that owns the transport.
 *
 * 2. THE SUBSTRING PLUGIN SNIFF. `shot-rating.js:142-155` shows the handoff when some
 *    installed plugin's id "includes('dye2')". A3 requires a capability discriminator
 *    to be an explicit named thing rather than a substring match (the same rule that
 *    retired STEAM_FLOW_PRESETS_BY_MODEL, `CARRY_FORWARD.md` §3c). Availability
 *    arrives here as the boolean `handoff`, decided one level up from capabilities.
 *
 * 3. THE GLOBAL CALL. `shot-rating.js:125-131`: the button called
 *    `window.openDye2ForShot(...)` when it happened to exist, and the audit measured
 *    the other case on the bench — "button visible, window.openDye2ForShot undefined"
 *    — where every tap did nothing at all. This component reaches for no global. It
 *    publishes `dye-handoff` and the screen decides what can answer it; a handoff that
 *    leads nowhere is then a fact the screen knows, not a silent no-op in a leaf.
 *
 * 4. THE STALE-ID RACE, ported as STRUCTURE rather than as a guard.
 *    `shot-rating.js:160-181` needs a stale-id check because the rating arrives
 *    asynchronously after the record: "a stale-id guard is what stops a fast
 *    arrow-press through the history from landing the previous shot's rating on this
 *    one". Here every event carries the `shotId` it was produced against, and a change
 *    of `shotId` drops the local draft — so the previous shot's number cannot paint on
 *    the next one, and the screen can drop a reply whose shotId no longer matches.
 *
 * =========================================================================
 * GEOMETRY — WHAT SLATE MEASURES, AND THE THREE DEPARTURES
 * =========================================================================
 *
 * DISQUALIFICATION CHECK FIRST (SCOPE Part 10 §4). `.slate-shot-rate` and its four
 * children are bug L4 itself, so their BOX is disqualified as a target and is quoted
 * only as what Slate does. Their PAINT is not on the bug list and is carried:
 *
 *   CITE live-ready .slate-derived-label [i=155] font-size = 14px  <-  slate-live.css
 *        (hash)main-page .slate-derived-label  authored var(--slate-text-sm)  (token-driven)
 *   CITE live-ready .slate-derived-label [i=155] text-transform = uppercase  <-
 *        slate-live.css  (hash)main-page .slate-derived-label  authored uppercase
 *   CITE live-ready .slate-derived-label [i=155] letter-spacing = 1.4px  <-
 *        slate-live.css  (hash)main-page .slate-derived-label  authored 0.1em (token-driven)
 *   CITE live-ready .slate-derived-label [i=155] font-weight = 600  <-  slate-live.css
 *        (hash)main-page .slate-derived-label  authored 600  (FROZEN/hardcoded)
 *   CITE live-ready .slate-derived-label [i=155] color = rgb(148, 161, 169)  <-
 *        slate-live.css  (hash)main-page .slate-derived-label  authored var(--slate-muted)
 *        (token-driven)
 * — which is the microcap role exactly, so the cap is ui-stat-tile's label rather than
 * a fifth copy of it. (The 600 -> 700 settlement that note used to cite is REVERSED —
 * parity surface 1 restored Slate's own four weights, so the role renders 600 and this
 * cap with it. Nothing here changed: it consumes the role.)
 *
 *   CITE live-ready (hash)shot-rating-score [i=156] font-size = 27px  <-  slate-live.css
 *        (hash)main-page .slate-rate-score  authored var(--slate-display-xs) (token-driven)
 *   CITE live-ready (hash)shot-rating-score [i=156] color = rgb(148, 161, 169)  <-
 *        slate-live.css  (hash)main-page .slate-rate-score[data-rated="false"]  authored
 *        var(--slate-muted)  (token-driven)
 * — the captured shot is UNRATED, and Slate's own comment says why that matters:
 * "An unrated shot must not look like a shot rated zero" (slate-live.css:1533).
 * ui-stat-tile already owns that distinction: an absent value renders the em dash in
 * --ui-muted and announces a sentence, and 0 renders as 0 in --ui-text.
 *
 * DEPARTURE 1 — THE SLIDER IS 48px, NOT 32. Slate's rate slider is a 32px box around
 * an 8px track (rect 147x32); spec §5.2 #23 counts four thumb specs across three
 * hand-rolled sliders, and #23's answer is one control at the --ui-hit-min floor
 * ("48px tall here because 32px is bug-adjacent", ui-slider.entry.js). This compound
 * gets that for free by composing #23 and adds no slider rule of its own.
 *
 * DEPARTURE 2 — NO BORDER AND NO INSET. Slate draws the zone's left edge as
 * border-left: var(--slate-hairline) solid var(--slate-seam) with
 * padding-left: var(--slate-space-5) (slate-live.css:1521-1522; the 25px between the
 * box's x=1720 and its children's x=1745 is that pair). CONVENTIONS §13 is explicit —
 * "a divider is a gap, not a border" — and the divider between the numbers zone and
 * the rating zone belongs to the band's seam grid, which Part 5 assembles. This
 * component paints no ground, no border and no inset; it is the column and nothing
 * else.
 *
 * DEPARTURE 3 — THE SCORE IS FLUID AGAINST ITS OWN ZONE. --ui-display-xs is
 * clamp(22px, 2.2cqi, 27px) (styles/tokens.css:361) and this host establishes the
 * container, so in a 172px zone the digits sit on the clamp's 22px floor rather than
 * on Slate's 27px. That is spec §2.1 Rule 1 applied honestly: the score is the only
 * fluid number in this zone (its neighbours in the derived list are the FIXED
 * --slate-text-lg 20px step — CITE live-ready (hash)shot-derived-ratio [i=147]
 * font-size = 20px <- authored var(--slate-text-lg)), so there is nothing for it to
 * size WITH except its own zone, and a narrow container is absorbed by the type rather
 * than by clipping.
 *
 * ALL SLATE RECTS ABOVE ARE FROZEN 1920x1200 CAPTURES. LAYOUT_SPEC_DRAFT.md governs
 * responsive behaviour and the oracle has no vote there.
 *
 * =========================================================================
 * ACCESSIBILITY
 * =========================================================================
 *
 * The host takes NO role and carries no aria-label. Bug L23's first symptom is
 * "aria-label on role-less <div>s" — Chrome exposes the name anyway, so a name here
 * would announce the zone as an extra anonymous thing. A screen that writes one on
 * this host has it moved onto the RATE BUTTON, which is the element that answers to it:
 * the button is the zone's one entry point and the only control on screen at rest.
 *
 * Three names, one each, and no group wrapper for three controls:
 *   - the cap over the score is ui-stat-tile's label (a microcap, not a heading — it
 *     labels a reading, and §5.2's own row calls it a label);
 *   - an absent score announces a SENTENCE, not the em dash. ui-stat-tile does that
 *     already (its dash is aria-hidden and t('no reading') is exposed beside it);
 *   - the slider names itself, with its range, and states aria-valuetext, so an
 *     unrated control announces "not rated" instead of "0", which is the audible half
 *     of Slate's own "must not look like a shot rated zero".
 *
 * The handoff is a real <button> through #1, so it is in the tab order, it takes the
 * one focus ring, and it is announced with its own words.
 *
 * @fires rating-change - {detail: {score, shotId}} on the control's commit, once per
 *                        gesture. THIS is the one the screen writes on. It is the
 *                        control's ONLY score announcement: `rating-input` (one per
 *                        pixel of drag, heard nowhere) was retired 29 Aug 2026, audit
 *                        F-011. The number under a moving thumb repaints from this
 *                        component's own `_draft` state and is nobody else's business.
 * @fires dye-handoff   - {detail: {shotId}} when the handoff is pressed. An intent
 *                        addressed to whatever can answer it; this file knows nothing
 *                        about DYE2 beyond the fact that it is somebody else.
 */

import { css, html, nothing } from 'lit';

import { UiElement } from 'src/components/base.js';
import 'src/components/ui-stat-tile.js';
import 'src/components/ui-slider.js';
import 'src/components/ui-button.js';
import 'src/components/ui-dialog.js';

import { I18nController } from 'src/lib/i18n.js';
import { hasReading } from 'src/data/reading.js';
import { formatToStep, NO_READING_MARK } from 'src/stores/units.js';

/**
 * THE SKIN'S RATING SCALE, IN ITS ONE HOME.
 *
 * `src/data/rea-shot-record.js:81-83` assigns it here by name: ReaPrime stores a
 * nullable double and bounds nothing, so 0..100 is the CONTROL's opinion about how a
 * human expresses a score, not a fact about a machine. Not a limits table (B2/R2), not
 * a machine bound, and deliberately not a property — a screen that could restate the
 * scale is a second copy of it.
 */
export const RATING_MIN = 0;
export const RATING_MAX = 100;
export const RATING_STEP = 1;

/** The label over the score. Slate's own key: index.html:439 data-i18n-key. */
const LABEL_KEY = 'Rate this shot';
/** The handoff's words. Slate's own key: index.html:444 data-i18n-key. */
const HANDOFF_KEY = 'Full notes';

/**
 * THE SECOND BUTTON, AND IT IS SLATE'S OWN FOURTH ITEM.
 *
 * Ben, 25 August 2026: "Add a new button under this input that has I can enter 'ALL NOTES'
 * which we will make a new page for at some point."
 *
 * This corner's own header already names what was missing: "SLATE'S OWN CORNER IS FOUR
 * THINGS AND THE LAST IS A BUTTON: .slate-shot-rate holds the microcap, the score, the
 * slider and then #shot-dye-btn 'Full notes'. Decal builds no NOTES surface, so that
 * destination does not exist here (the digest's declared drop)." The destination is now
 * declared rather than dropped, so the button comes back — under Ben's own word for it.
 *
 * AND HIS WORD CHANGED, 30 August 2026 (fix-campaign decision D14). It was "All notes",
 * which is what he asked for on 25 August; the audit then found that the phrase argues
 * against where the button sits — inside a PER-SHOT rating control, where "All" reads as
 * every note ever written — and flagged it for him rather than guessing. He renamed it to
 * "Shot notes" and, in the same decision, had the sheet behind it gain its writing half.
 *
 * THIS CONSTANT AND `live-screen.js`'s SHEET HEADING MUST AGREE. Two elements a hand's
 * width apart naming one surface two ways is the fault this rename exists to end, so the
 * screen's `#renderNotes` uses the same words and says so in its own header.
 */
const NOTES_KEY = 'Shot notes';

/** The sheet's own cap over the big number, and its way out. */
const SHEET_OUT_OF_KEY = 'Score out of {max}';
const SHEET_DONE_KEY = 'Done';
/** The slider's accessible name. Placeholders are filled by t(), never concatenated. */
const SLIDER_NAME_KEY = 'Shot rating, {min} to {max}';
/** What a screen reader hears on an unrated shot, where a sighted user sees the dash. */
const UNRATED_KEY = 'Not rated';
/** The announced value: "73 of 100" rather than a bare percentage. */
const RATED_KEY = '{score} of {max}';

export class UiRatingControl extends UiElement {
    static properties = {
        /**
         * The shot this rating belongs to. Absent means there is NOTHING TO RATE, and
         * the controls say so rather than accepting input that goes nowhere —
         * Slate's own reasoning at shot-rating.js:69-73, kept.
         *
         * It is also the stale-id guard: every event carries it, and changing it drops
         * the local draft.
         */
        shotId: { type: String, attribute: 'shot-id' },

        /**
         * The served enjoyment score, as a number — or null / an absence from
         * `src/data/reading.js` for a shot nobody has rated.
         *
         * NOT reflected. An absence is an object, and a reflecting Number property
         * would serialise it into the attribute and read it back as NaN: the rendering
         * would stay right while the property quietly stopped being what the caller
         * set. `rated` is the readable state.
         */
        score: { type: Number },

        /**
         * Is the DYE handoff available on this machine? A capability, decided one
         * level up (A3) — never a substring match on a plugin id here.
         */
        handoff: { type: Boolean },

        /**
         * The rating sheet is open. Internal state, reflected so a test and a stylesheet
         * can both see it.
         *
         * WHY THE SLIDER IS BEHIND A PRESS NOW. Ben, 25 August 2026: "For the 'rate this
         * shot' make that a sort of button that is pressed that opens a model to give it a
         * rating out of 100." The corner is three fixed rows at the end of a band that has
         * to line up with the rail — a slider you can nudge by brushing past it, in a
         * corner nobody is aiming at, is both an accident waiting to happen and 48px of the
         * band's height. Behind a press it is neither, and the score stays visible on the
         * button that opens it.
         */
        open: { type: Boolean, reflect: true },

        /** Override for the cap over the score. Defaults to the translated key. */
        label: { type: String },

        /** Override for the handoff's words. Defaults to the translated key. */
        handoffLabel: { type: String, attribute: 'handoff-label' },

        /** Paint AND refusal, from the caller. The base dims the host; see the styles. */
        disabled: { type: Boolean, reflect: true },

        /** The number under the thumb before the screen has echoed it back. */
        _draft: { state: true },
    };

    static styles = [
        /* NO hitArea: every hit target here is inside a composed control, and an
         * overlay from out here would be measuring somebody else's box. NO
         * selectionSurface and no [aria-pressed] rule: a rating is a VALUE, not a
         * selection — ui-slider.js says the same thing about itself in one line, and
         * the four dials are for components that have a selected state. NO seams: the
         * only divider near this zone is the band's, and it is a gap (CONVENTIONS
         * §13). NO typeRoles: the two pieces of type here are the score button's own cap
         * and number, both declared below from the same tokens the roles are made of - a
         * shared sheet for two rules in one component is the import, not the saving.
         *
         * What is left is the column, its floor, and the two rules that keep a
         * composition's arithmetic honest. */
        css`
            /* THE SCORE BUTTON IS A BUTTON SHAPED LIKE THE TILE IT REPLACES.
             *
             * ui-button paints a control-height box with centred label text, and what goes
             * in it here is a two-line stat tile. So the button states no height of its own
             * and lets the tile decide, and the tile keeps every one of the type rules the
             * corner already had - the cap, the muted dash, the 27px number. The press is
             * the only thing added. */
            #rate {
                inline-size: 100%;
            }

            /* THE BUTTON'S FACE IS TWO LINES OF THIS FILE'S OWN, NOT A STAT TILE.
             *
             * It was <ui-stat-tile size="xs">, which is the right component for a gauge and
             * the wrong one inside a button: the tile lays its cap and its value in a two
             * ROW grid, and a cap long enough to wrap pushes into the value's row and
             * prints "RATE THIS / (dash) SHOT".
             *
             * TWO SPANS IN A COLUMN CANNOT DO THAT. The type is the same two roles the tile
             * spends (the microcap and the numeric readout) and the muted-when-unrated paint
             * is one rule below, so nothing is lost but the collision. */
            #rate .score {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: var(--ui-space-1);
                inline-size: 100%;
            }

            /* THE CAP IS ONE STEP DOWN FROM THE MICROCAP, AND THAT IS ARITHMETIC.
             *
             * MEASURED, 26 August 2026, at both Gate A geometries. "Rate this shot" is
             * 143px of ink at --ui-text-sm with the cap tracking, and 114px at
             * --ui-text-xs. ui-button pads 24px each side, so the widest zone this corner
             * has to survive — Slate's own 172px (CITE live-ready .slate-shot-rate [i=154]
             * rect 1720,980,172,165) — leaves 122px of content box. 143 does not fit in
             * 122 and 114 does, with 8px to spare.
             *
             * The button's own box is --ui-control-h and cannot grow without reaching into
             * its shadow root, so the words have to fit rather than the box having to give.
             * An earlier version of this comment claimed 264px and 210px; both were wrong,
             * and the rendering suite now pins the two true numbers so the next person can
             * check the reason rather than trust it.
             *
             * EVERY OTHER MICROCAP IN THE SKIN IS UNTOUCHED. This is the one that is a
             * BUTTON'S face rather than a caption over a gauge, and it is the only cap in
             * the tree that is a sentence. */
            #rate .cap {
                font-size: var(--ui-text-xs);
                white-space: nowrap;
                font-weight: var(--ui-weight-semibold);
                letter-spacing: var(--ui-tracking-cap);
                text-transform: uppercase;
                color: var(--ui-muted);
                line-height: 1.2;
                text-align: center;
            }

            #rate .num {
                font-size: var(--ui-display-xs);
                font-weight: var(--ui-weight-light);
                line-height: 1.1;
                color: var(--ui-text);
            }

            /* A SHOT NOBODY HAS RATED SHOWS THE DASH IN MUTED INK, which is the tile's own
             * rule for an absent reading and is why the dash is not a zero. */
            #rate .score.unrated .num {
                color: var(--ui-muted);
            }

            /* THE SHEET. One column: the number, then the slider under it, at the rhythm
             * the corner itself uses. */
            #sheet-body {
                display: flex;
                flex-direction: column;
                gap: var(--ui-space-4);
                min-inline-size: 0;
            }

            :host {
                /* THE COLUMN IS THE HOST — no inner box, so there is no second
                 * opinion about this zone's height (see the header). */
                display: flex;
                flex-direction: column;
                align-items: stretch;

                /* THE SCORE ON THE TOP LINE AND THE NOTES ON THE FLOOR.
                 *
                 * Ben, 25 August 2026: "Put 'rate this shot' up so its aligned with the top
                 * row", alongside his earlier "Make sure ALL items on the bottom of the
                 * screen are aligned". Both at once is space-between, and this is where it
                 * has to be declared rather than on the band's column: the two buttons are
                 * children of THIS host, so a rule one box out has one child to space and
                 * nothing happens.
                 *
                 * THE SHEET IS NOT A THIRD ROW. ui-dialog's host is display: contents, so
                 * the dialog generates no box here and cannot be pushed to the middle of a
                 * column it is not part of. */
                justify-content: space-between;

                /* Slate: --slate-rate-gap: var(--slate-space-3), measured 12px
                 * between all three pairs of rects (997->1009, 1036->1048,
                 * 1080->1092). --ui-space-3 is the same step. */
                gap: var(--ui-space-3);

                /* ============================================================
                 * L4, RETIRED.
                 * ============================================================
                 * The box may never be shorter than what is inside it. No height,
                 * no hand-derived 165, and nothing to re-derive when the button,
                 * the cap or the gap moves: the used block size is
                 * max(whatever a screen states, the contents), so the handoff
                 * cannot fall out of the bottom of the zone even under a stated
                 * height. Spec §2.3 case 4 — a minimum floor, which the spec calls
                 * required rather than merely permitted. */
                min-block-size: max-content;
            }

            /* Every row is its own floor and none of them surrenders (spec §2.4's
             * order of surrender, stated). Without this a short container would
             * squash the slider's hit box and the handoff's control height, which is
             * L4 arriving again through the other door — flex items shrink by
             * default, and ergonomics is physical (spec §2.2). */
            .row {
                flex: 0 0 auto;
            }

            /* PINNED TO THE FOOT OF ITS ZONE, which is Slate's own intent
             * (slate-live.css:1583-1585: "margin-top:auto takes the slack, so raising
             * the band's content makes both buttons taller rather than moving them
             * up") without Slate's box. At the intrinsic height there is no slack and
             * this resolves to zero; given a taller zone by the band, the slack goes
             * above the button and it stays level with the All-shots button across
             * the seam. */
            .handoff {
                margin-block-start: auto;
            }

            /* AN UNRATED SHOT MUST NOT LOOK LIKE A SHOT RATED ZERO — Slate's own
             * sentence (slate-live.css:1533), and the one piece of its paint this
             * compound has to ask for rather than inherit:
             *   CITE live-ready (hash)shot-rating-score [i=156] color =
             *        rgb(148, 161, 169)  <-  slate-live.css
             *        (hash)main-page .slate-rate-score[data-rated="false"]  authored
             *        var(--slate-muted)  !important=no  (token-driven)
             * (the captured shot is unrated, which is why the corpus records the
             * muted branch). --_ui-stat-ink is ui-stat-tile's own documented seam for
             * exactly this — "--_ui-stat-ink  the reading's colour. Default
             * var(--ui-text)." (ui-stat-tile.js:366) — so the ink arrives from
             * outside instead of the tile growing a second absent treatment. A public
             * token, never a colour value (CONVENTIONS §7). A CLASS, never an id
             * (§4 rule 2). */
            .score.unrated {
                --_ui-stat-ink: var(--ui-muted);
            }

            /* ONE DIAL, PAINTED ONCE. A disabled rating control disables the three
             * controls inside it, so without this line the base dims the host AND
             * each child and they compound: .38 x .38 = .14, a zone nearly three
             * times fainter than every other disabled control in the skin.
             * ui-preset-bank.js and ui-tab-bar.js solved the identical problem the
             * identical way. Specificity, not !important (CONVENTIONS §6). */
            :host([disabled]) .row {
                opacity: 1;
            }
        `,
    ];

    constructor() {
        super();
        this.open = false;
        this.shotId = '';
        this.score = null;
        this.handoff = false;
        this.label = '';
        this.handoffLabel = '';
        this.disabled = false;
        this._draft = null;
        /* D2's mechanism, same spelling as #19 and #33 so the wave has one shape for
         * this and not two. */
        this.i18n = new I18nController(this);
    }

    /**
     * An `aria-label` a screen wrote on this host, moved onto the RATE BUTTON rather
     * than left on a role-less element (bug L23; ui-preset-bank.js and ui-tab-bar.js
     * make the same move onto their own answering element).
     *
     * The button, not the slider: the button is what is on screen at rest, and the
     * slider only exists while the sheet is open. See `#sliderName`.
     */
    #hostLabel = null;

    /** Is there a shot to rate at all? */
    get ratable() {
        return !this.disabled && !!this.shotId;
    }

    /** Has this shot got a score — served or drafted? */
    get rated() {
        return hasReading(this.#shown);
    }

    /** The number on screen: the draft while dragging, otherwise what was served. */
    get #shown() {
        if (hasReading(this._draft)) return this._draft;
        return hasReading(this.score) ? this.score : null;
    }

    /**
     * The score as text, at the control's own precision.
     *
     * One formatter (`src/stores/units.js`), so the printed score and the control's
     * step are ONE decision rather than two that drift — the argument ui-preset-bank
     * makes for its labels. `null` reaches ui-stat-tile as an absence and renders the
     * em dash plus its announced sentence; it is never a zero (A7, reading.js:12-15).
     */
    get #scoreText() {
        const shown = this.#shown;
        return shown === null ? null : formatToStep(shown, RATING_STEP);
    }

    /**
     * The slider's accessible name, which is ITS OWN and not the zone's.
     *
     * IT USED TO BE THE HOST LABEL, AND THAT STOPPED BEING RIGHT WHEN THE SLIDER MOVED
     * INTO A SHEET. A screen writes `aria-label` on this host to name the ZONE, and the
     * zone's one entry point is the rate button — so that name is adopted onto the
     * button (see `#adoptHostLabel`), which is the element on screen that answers to it.
     * With the sheet closed there was no slider at all, so a screen-written name reached
     * nothing: a finished half with no other half.
     *
     * The slider names itself instead, and says its range while doing so. Inside a
     * dialog already headed with the cap, "Rate the last shot" on the slider would be
     * the heading again with the range dropped.
     */
    get #sliderName() {
        return this.i18n.t(SLIDER_NAME_KEY, { min: RATING_MIN, max: RATING_MAX });
    }

    /**
     * What the slider ANNOUNCES.
     *
     * An unrated control announces the sentence, not "0": a thumb parked at the low
     * end is the visual half of "an unrated shot must not look like a shot rated zero"
     * (slate-live.css:1533) and this is the audible half. A served score outside the
     * scale is announced AS SERVED even though the thumb cannot reach it — the
     * announcement reports, it does not correct (A7).
     */
    get #valueText() {
        const shown = this.#shown;
        if (shown === null) return this.i18n.t(UNRATED_KEY);
        return this.i18n.t(RATED_KEY, { score: this.#scoreText, max: RATING_MAX });
    }

    /**
     * Where the thumb sits. An unrated shot parks it at the floor and fills nothing:
     * `origin` is left at the low end, so the track paints no fill at all, which is
     * Slate's own rule for the unrated case (slate-live.css:1541-1544, "an UNRATED
     * shot fills nothing") expressed as a value rather than as an inline style.
     */
    get #thumb() {
        const shown = this.#shown;
        return shown === null ? RATING_MIN : shown;
    }

    connectedCallback() {
        super.connectedCallback();
        this.#adoptHostLabel();
    }

    willUpdate(changed) {
        super.willUpdate?.(changed);
        /* THE STALE-ID GUARD, AS STRUCTURE. A new shot, or a new served score, drops
         * the local draft — so the previous shot's number can never paint on this one
         * (shot-rating.js:160-181 needed a running id check for exactly this), and a
         * screen that corrects a rejected write wins over the thumb. */
        if (changed.has('shotId') || changed.has('score')) this._draft = null;
    }

    render() {
        const inert = !this.ratable;
        const scoreText = this.#scoreText;
        const capLabel = this.label || this.i18n.t(LABEL_KEY);

        return html`
            <!-- THE SCORE IS THE BUTTON. It carries the cap and the number it opens the
                 sheet to change, so the corner still says what it says at rest and the
                 press is where it always was. An unrated shot shows the dash the tile
                 shows, not a zero: a shot nobody has rated has no score. -->
            <ui-button
                id="rate"
                class="row rate"
                ?disabled=${inert}
                .label=${this.#hostLabel || ''}
                aria-haspopup="dialog"
                aria-expanded=${this.open ? 'true' : 'false'}
                @click=${this.#openSheet}
            >
                <span class="score ${scoreText === null ? 'unrated' : ''}">
                    <span class="cap">${capLabel}</span>
                    <span class="num">${scoreText ?? NO_READING_MARK}</span>
                </span>
            </ui-button>

            <ui-button
                id="notes"
                class="row notes"
                ?disabled=${!this.shotId}
                @click=${this.#onNotes}
            >${this.i18n.t(NOTES_KEY)}</ui-button>

            ${this.open ? html`<ui-dialog
                id="sheet"
                heading=${capLabel}
                .open=${true}
                @open-change=${this.#onSheetChange}
            >
                <div id="sheet-body" slot="body">
                    <ui-stat-tile
                        id="sheet-score"
                        class="${scoreText === null ? 'unrated' : ''}"
                        .label=${this.i18n.t(SHEET_OUT_OF_KEY, { max: RATING_MAX })}
                        .value=${scoreText}
                    ></ui-stat-tile>

                    <!-- THE SAME SLIDER, MOVED. #23's control, the same 0..100 scale from
                         the same three constants, and the same two handlers - so the value
                         a drag produces and the event it announces are unchanged by having
                         been put behind a press. -->
                    <ui-slider
                        id="slider"
                        min=${RATING_MIN}
                        max=${RATING_MAX}
                        step=${String(RATING_STEP)}
                        .value=${this.#thumb}
                        .label=${this.#sliderName}
                        .valueText=${this.#valueText}
                        ?disabled=${inert}
                        @input=${this.#onSliderInput}
                        @change=${this.#onSliderChange}
                    ></ui-slider>
                </div>
                <ui-button slot="actions" id="sheet-done" variant="primary"
                    @click=${this.#closeSheet}>${this.i18n.t(SHEET_DONE_KEY)}</ui-button>
            </ui-dialog>` : nothing}

            ${this.handoff
                ? html`<ui-button
                        id="handoff"
                        class="row handoff"
                        ?disabled=${inert}
                        @click=${this.#onHandoff}
                    >${this.handoffLabel || this.i18n.t(HANDOFF_KEY)}</ui-button>`
                : nothing}
        `;
    }

    /* ─────────────────────────────────────────────────── the sheet, and the notes */

    #openSheet = () => {
        if (!this.ratable) return;
        this.open = true;
    };

    #closeSheet = () => { this.open = false; };

    /* The dialog announces its own close — Escape, the scrim, the close control. Only a
     * CLOSE is acted on: `open-change` fires on open too. */
    #onSheetChange = (event) => {
        if (event?.detail?.open === false) this.open = false;
    };

    /**
     * THE NOTES BUTTON SAYS SO AND NOTHING ELSE YET.
     *
     * It announces `notes-open` with the shot it is about, and the screen decides. There is
     * no notes surface in this tree — Ben's own words are "which we will make a new page
     * for at some point" — so what the screen does today is say that, in one place, rather
     * than this control pretending to a destination.
     *
     * A BUTTON THAT ANNOUNCES AND A SCREEN THAT ANSWERS is the same seam every other
     * control here uses; when the page exists, the screen's answer changes and this file
     * does not.
     */
    #onNotes = () => {
        if (!this.shotId) return;
        this.dispatchEvent(new CustomEvent('notes-open', {
            detail: { shotId: this.shotId },
            bubbles: true,
            composed: true,
        }));
    };

    updated(changed) {
        super.updated(changed);
        if (this.#adoptHostLabel()) this.requestUpdate();
    }

    /**
     * Move a screen-written `aria-label` onto the slider. Returns true only on the
     * update that actually moved one, so the extra render this asks for happens once.
     */
    #adoptHostLabel() {
        const written = this.getAttribute('aria-label');
        if (written === null) return false;
        this.#hostLabel = written;
        this.removeAttribute('aria-label');
        return true;
    }

    /**
     * The number under a moving thumb. LOCAL — nothing is written for this, and as
     * of 29 August 2026 nothing is ANNOUNCED for it either.
     *
     * THE `rating-input` EMIT WAS RETIRED HERE (audit F-011). It fired once per
     * pixel of drag and was heard nowhere in `src/` — the gate found it, and the
     * live screen's own note beside its `rating-change` listener says why it is
     * deliberately not heard: a screen that answered this would be answering a
     * moving thumb. The preview it was supposedly for never needed it. `_draft` is
     * a reactive state property (see `properties`), so assigning it re-renders the
     * tile above the slider AND the score on the button behind the sheet, which is
     * exactly what the drag test measures. The announcement half of this control is
     * `rating-change`, once per gesture, and that one is now really heard.
     */
    #onSliderInput(event) {
        if (!this.ratable) return;
        this._draft = Number(event.currentTarget.value);
    }

    /**
     * The commit. ONE per gesture, which is why there is no debounce timer here
     * (shot-rating.js:90-99 saved on `input` and therefore needed one).
     */
    #onSliderChange(event) {
        if (!this.ratable) return;
        this._draft = Number(event.currentTarget.value);
        this.#emit('rating-change', this._draft);
    }

    /**
     * The handoff. An intent with a shot id on it and nothing else — no global, no
     * plugin knowledge, no silent no-op (see the header, item 3).
     */
    #onHandoff() {
        if (!this.ratable) return;
        this.dispatchEvent(new CustomEvent('dye-handoff', {
            detail: { shotId: this.shotId },
            bubbles: true,
            composed: true,
        }));
    }

    #emit(type, score) {
        this.dispatchEvent(new CustomEvent(type, {
            detail: { score, shotId: this.shotId },
            bubbles: true,
            composed: true,
        }));
    }
}

customElements.define('ui-rating-control', UiRatingControl);
