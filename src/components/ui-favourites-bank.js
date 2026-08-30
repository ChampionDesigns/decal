/**
 * ui-favourites-bank — Wave 4 item #36, the FAVOURITES BANK. Live's header
 * profile-shortcut strip, as a composition of #3 (ui-bank) and #35
 * (ui-favourite-slot) instead of the hand-built copy it is today.
 *
 * SCOPE Part 4, Wave 4 "Live-screen compounds", row 36, verbatim:
 *   "Favourites bank | The header's profile-shortcut bank — becomes a composition of
 *    #3 + #35 instead of the hand-built copy with three overlapping box
 *    implementations (L7, L8). | small | #3, #35"
 * ITEMS.json #36 notes, binding: "May not own a private 'selected' look; themed
 * exclusively through the four `--slate-selected-*` dials (spec §3.9)."
 *
 * =========================================================================
 * THIS IS THE DEFECT THAT STARTED THE AUDIT
 * =========================================================================
 * SCOPE Part 4, "The defect that started the audit — and the component that answers
 * it": "Ben's original report was that the selection bank looked different on Live
 * than on Settings ... Live's favourites bank (`#profile-fav-nav`,
 * `slate-live.css:114`, verified) and the `#dye-strip` are hand-built copies of the
 * library's `.slate-bank`, so re-skinning selection changes the expanded tabs and
 * leaves the favourites alone (L8)." The register's answer, `DECISIONS.md:244`:
 * "One selection component, not thirteen. One 'selected' treatment, not six."
 *
 * TWO BUGS DIE HERE, and both die structurally — there is no rule in this file to
 * get right, because the rules that used to be got wrong now live in exactly one
 * shadow root each and this component cannot reach into either.
 *
 *   L7 (§7.2)  "Three overlapping implementations of the favourite button's box;
 *              `width: 20% !important` is dead and the `--slate-space-4` padding
 *              paints nothing."
 *              `slate-live.css:194-208`, `:1720-1724`, `:1764-1769`
 *
 *              Read read-only, the three are:
 *                :195  #main-page #profile-fav-nav > button {
 *                          width: 20% !important; height: 80px !important;
 *                          min-height: 80px; min-width: 0;
 *                          padding: 0 14px !important; ... }
 *                :1720 #main-page #profile-fav-nav > button {
 *                          width: auto !important; min-width: 180px;
 *                          flex: 1 1 auto; }
 *                :1764 #main-page [id^="fav-profile-btn-"] {
 *                          width: auto !important; min-width: 180px;
 *                          max-width: 320px; padding: 0 var(--slate-space-4); }
 *              The first two are the SAME selector, so the later `width: auto`
 *              wins the source-order tie and the 20 % is dead; the third is
 *              (1,1,0) against the first's (2,0,1), so its `--slate-space-4`
 *              (18px) loses to a 14px literal marked `!important`.
 *
 *              BOTH HALVES ARE MEASURED, not inferred:
 *              CITE live-ready #fav-profile-btn-1 [i=4] width = 180px  <-
 *                   slate-live.css `#main-page #profile-fav-nav > button`
 *                   authored `auto` !important=yes (FROZEN/hardcoded)
 *                   — the corpus's winning rule for `width` records the authored
 *                   value as `auto`. The 20 % rule never reaches the element.
 *              CITE live-ready #fav-profile-btn-1 [i=4] padding-left = 14px  <-
 *                   slate-live.css `#main-page #profile-fav-nav > button`
 *                   authored `14px` !important=yes (FROZEN/hardcoded)
 *                   — kind `screen-literal`, "FROZEN under token perturbation —
 *                   hardcoded, not themable". A `--slate-space-4` that paints
 *                   nothing is a token that cannot be turned, which is why the
 *                   suite drills `--ui-space-4` here and watches it MOVE.
 *              And the five cells measure 264.094 / 180 / 234 / 180 / 180 in a
 *              1040px box (`find --id fav-profile-btn-0..4`, live-ready) — five
 *              different widths where one dead rule asks for five 208s.
 *
 *              -> HOW IT BECOMES INEXPRESSIBLE. The cell's box has ONE owner:
 *                 ui-bank's `.item` rule, inside ui-bank's shadow root. This
 *                 component states no width, no min-width, no height and no
 *                 padding for a cell, and it could not usefully state one —
 *                 nothing in the document tree can reach `.item`, so a second
 *                 implementation would have to be a second custom element, which
 *                 the wave forbids. Spec §2.3, "one owner per dimension", enforced
 *                 by the boundary rather than by care.
 *
 *   L8 (§7.2)  "The favourites bank and `#dye-strip` are two hand-built copies of
 *              `.slate-bank`, while the expanded tabs use the real one — so
 *              re-skinning selection changes the tabs and leaves the favourites
 *              alone, bypassing all four `--slate-selected-*` dials."
 *              `slate-live.css:114-238` vs `slate-components.css:348-424`
 *
 *              The copy agrees with the real bank on the GROUND and diverges only
 *              on selection, which is exactly why it went unnoticed:
 *              CITE live-ready #profile-fav-nav [i=2] background-color =
 *                   rgb(26, 33, 39) <- slate-live.css `#main-page #profile-fav-nav`
 *                   authored `(NOT CAPTURED — set via a CSS shorthand)`
 *                   !important=no (token-driven)  — the same value ui-bank cites
 *                   for `.slate-bank` [i=163], i.e. --ui-key.
 *              The divergence, quoted so it is on the record as what must NOT be
 *              carried (it is L8 itself, so it is DISQUALIFIED as a target):
 *              CITE live-ready #fav-profile-btn-0 [i=3] background-color: dark
 *                   color(srgb 0.134902 0.166902 0.19498) / light
 *                   color(srgb 0.890196 0.905882 0.913725 / 0.68)  <- dark
 *                   slate-live.css `[data-theme="dark"] #main-page
 *                   #profile-fav-nav > button.text-white, ... [aria-pressed="true"]`
 *                   !important=yes
 *              CITE live-ready #fav-profile-btn-0 [i=3] color: dark
 *                   rgb(244, 247, 248) / light rgb(23, 26, 28) <- slate-live.css
 *                   `... > button.text-white, ... > button[aria-pressed="true"]`
 *                   authored `var(--slate-text)` !important=yes
 *              plus `font-weight: 500` against a resting 400, a `text-shadow` mixed
 *              from `--slate-steel`, and an `::after` LED strip at
 *              `slate-live.css:232-243`. Four private selected declarations, none
 *              of them a dial, all of them `!important`.
 *
 *              -> HOW IT BECOMES INEXPRESSIBLE. This component declares NO selected
 *                 colour, weight, shadow or pseudo-element. Selection is ui-bank's
 *                 `selectionSurface` on the cell and ui-favourite-slot's on the
 *                 mark, which are the same exported fragment (base.js) reading the
 *                 same four dials. Turning one dial therefore moves the favourites
 *                 bank AND the tab bar AND the settings banks together — the suite
 *                 proves that by drilling one token with a `ui-tab-bar` mounted
 *                 beside this component and asserting both move, which is L8's own
 *                 sentence inverted.
 *
 * =========================================================================
 * THE COMPOSITION, AND WHY IT IS TWO ELEMENTS AND NOT ONE
 * =========================================================================
 * One `<ui-bank>` (#3) is the ROW: the one-piece box, the --ui-key ground, the
 * hairline, the radius, the inset seam between cells, the roving tabindex from
 * Appendix 10, the three aria spellings, and THE selection treatment. Per cell,
 * one `<ui-favourite-slot>` (#35) is the MARK: the square profile shortcut, whose
 * job here is OCCUPANCY — Slate's own fix, kept, `slate-shell.css:1663-1665`: "The
 * five favourite slots were pixel-identical whatever they held, so tapping one was
 * a blind overwrite. Occupancy is now the difference between an outlined slot and a
 * filled one." Live's strip never had that affordance, which is why P25 could only
 * answer an empty cell by making it invisible.
 *
 * #35's own header wrote this component's half of the contract before it existed:
 * "A CONSUMER MAY SPELL IT DIFFERENTLY. #36 composes #3 with this element, and if
 * the bank puts aria-selected / aria-checked / aria-current on the HOST, the
 * fragment's `:host(:is(...))` block paints the host ... The disc then has to GET
 * OUT OF THE WAY of that paint." This component uses the fifth spelling in that
 * same list, `[selected]` — #35's reflected property — so the state travels as a
 * property rather than as an aria attribute written onto a node that is inert.
 *
 * THE MARK IS `inert`, AND THAT IS THE WHOLE REASON THE COMPOSITION IS LEGAL.
 * ui-bank's cell IS a `<button>`; ui-favourite-slot renders a `<button>` of its
 * own. Nested interactive content is two tab stops, two accessible buttons and an
 * ambiguous click target — a defect, not a composition. `inert` removes the mark's
 * subtree (its shadow root included) from the tab order, from hit testing and from
 * the accessibility tree, leaving a purely presentational disc inside the one
 * control that owns the cell. `pointer-events: none` is declared as well: the two
 * mechanisms overlap deliberately, because a press that lands on the disc and does
 * nothing is the worst outcome available, and the suite measures a real hit-tested
 * click on the disc arriving at the cell.
 *
 * WHAT THIS COMPONENT ADDS — the half neither dependency can carry:
 *   1. OCCUPANCY AS DATA. An empty favourite is an empty entry in a list, not a
 *      CSS selector. Slate spells it `:empty, :not(:has(*)):blank`
 *      (`slate-live.css:1713-1717`) and that is bug L6: `:blank` is implemented in
 *      no shipping engine and one invalid selector invalidates the whole list, so
 *      the valid `:empty` half dies with it while two of the five slots ARE empty.
 *      A property cannot have that failure mode.
 *   2. A FIXED CAPACITY (P25's "five cells regardless"), so the row keeps its
 *      rhythm and a favourite is always in the same place under the same finger.
 *   3. AN EMPTY CELL IS NOT SELECTABLE. It is `disabled` in the bank, so the
 *      roving tab stop skips it and a press cannot load a profile that is not
 *      there. Assignment is the selector screen's job (Part 5), not this row's.
 *   4. THE ROW'S ERGONOMIC FLOOR, stated rather than clipped — see below.
 *
 * =========================================================================
 * THE FLOOR, AND WHY IT IS DECLARED
 * =========================================================================
 * ui-bank is `overflow: hidden` (it has to be: the radius clips a selected cell's
 * face at the two end corners). Its cells are `flex: 1 1 0; min-inline-size: 0`, so
 * they shrink without limit — and a 48px disc inside a 20px cell is CLIPPED, which
 * is content silently removed and is banned by spec §2.4. The mark cannot shrink
 * instead: spec §2.2, "Control heights, touch targets, hairlines | Fixed token.
 * Never fluid ... A control that shrinks with the window becomes unusable exactly
 * when the window is small", and #35 ships that as its departure 4.
 *
 * So the row states its floor: `--ui-hit-min` for the disc plus the bank's own
 * `--ui-space-4` on each side of it, times the number of cells. Below that the
 * component overflows its parent VISIBLY rather than eating its own marks. The
 * cell count is written to a private property in `updated()` because a container
 * cannot know it from CSS; every length in the sum is a token.
 *
 * NO `@container` RULE, and it is a decision. The name track is `flex: 0 1 auto`
 * with `min-inline-size: 0`, so it gives way continuously as the container
 * narrows and ellipsises to nothing — one behaviour, no breakpoint to get wrong,
 * the same position ui-bank states for itself (ui-bank.js:410-414: "nothing here
 * has a second layout to switch to"). The component still reads its own container
 * and never the viewport (spec §2.1 Rule 1): there is no `@media` in this file and
 * the suite proves the rendered numbers are identical at both Gate A geometries
 * for one stated stage width.
 *
 * =========================================================================
 * TOKEN-ONLY (Gate 2, Part 10 §12 wf-w4-compounds-ports)
 * =========================================================================
 * NO import from `src/data/` or `src/stores/`, no route, no server key. That is
 * not an omission dodging the addressing law — it is the law satisfied: this
 * component reads no server data at all, so there is no address to get wrong. The
 * favourites list is a *stored* list (`profileManager.js:51`, key
 * `favorite-profiles` — and `DECISIONS.md:474-477` records that CAPABILITY_DIFF's
 * `/api/v1/store/slate/favorites` is the WRONG key: "anyone following it literally
 * reads an empty key and concludes the favourites were lost"). Its owner is the
 * profile store, which Part 10 §12 hands to wf-w5p3-selector along with the five
 * transcribed `profileManager.js` rules — not to this row. Whoever owns the data
 * owns the list; this component takes it as a property, exactly as ui-bank and
 * ui-tab-bar do.
 *
 * @fires change — ui-bank's own event, composed and bubbling, retargeted to this
 *                 host: {detail: {value, index}} where `value` is the chosen
 *                 favourite's value and `index` is its slot position (0-based).
 *                 Not re-dispatched (that would be two events for one press) and
 *                 not fired for a programmatic el.value = x, which is the native
 *                 contract — ui-tab-bar takes the same route.
 *
 * API
 *   <ui-favourites-bank label="Favourite profiles" value="p3"
 *       favourites='[{"value":"p1","name":"Cremina"},
 *                    null,
 *                    {"value":"p3","name":"Londinium"}]'></ui-favourites-bank>
 *   <ui-favourites-bank capacity="3" ...>      three cells instead of five
 *   <ui-favourites-bank disabled ...>          the whole row dims and refuses
 *
 *   An entry may be a string (value and visible name in one), an object
 *   {value, name, filled}, or null / '' for an empty slot. On an entry with
 *   `filled: false` the `name` is used as the ACCESSIBLE name only — an empty slot
 *   holds no profile, so there is no visible name to show, and the component
 *   invents no English of its own for one.
 */

import { css, html, nothing } from 'lit';

import { UiElement, visuallyHidden } from 'src/components/base.js';
import 'src/components/ui-bank.js';
import 'src/components/ui-favourite-slot.js';

/** P25's "five cells regardless" — Slate renders fav-profile-btn-0..4. */
const DEFAULT_CAPACITY = 5;

/**
 * The synthetic value an empty cell carries. It exists because ui-bank keys its
 * per-item slot by value, so every cell needs a distinct one — and it is prefixed
 * rather than left empty so it can never collide with a real profile id or with a
 * `value` of '', which would silently paint an empty slot as the current one.
 * Empty cells are disabled, so this string can never leave in a `change` event.
 */
const EMPTY_VALUE_PREFIX = '#empty-';

/** Strings, objects, holes — one shape out. `slot` is the 1-based position. */
function normaliseFavourite(raw, index) {
    const slot = index + 1;
    const blank = {
        value: `${EMPTY_VALUE_PREFIX}${slot}`,
        name: '',
        a11y: String(slot),
        filled: false,
        slot,
    };

    if (raw === null || raw === undefined || raw === '') return blank;

    if (typeof raw === 'object') {
        const filled = raw.filled !== false;
        const name = String(raw.name ?? raw.label ?? '');
        const value = raw.value === undefined || raw.value === null
            ? (filled && name ? name : blank.value)
            : String(raw.value);
        return {
            value,
            /* An empty slot holds no profile, so it has no visible name. */
            name: filled ? name : '',
            /* Named for a screen reader either way: the profile, or the position. */
            a11y: name || String(slot),
            filled,
            slot,
        };
    }

    const value = String(raw);
    return { value, name: value, a11y: value, filled: true, slot };
}

export class UiFavouritesBank extends UiElement {
    static properties = {
        /**
         * The favourites, in slot order. NOT a data source (see the header): the
         * profile store owns this list and hands it over.
         */
        favourites: { type: Array },

        /** How many cells the row shows regardless of how many are filled (P25). */
        capacity: { type: Number },

        /** The current favourite's value. Reflected: it is the state tests read. */
        value: { type: String, reflect: true },

        /** Accessible name for the GROUP. Lands on ui-bank's host, which has the role. */
        label: { type: String },

        /** Paint AND behaviour — both are ui-bank's, passed straight through. */
        disabled: { type: Boolean, reflect: true },

        /**
         * OFFER SLATE'S SECOND ACTION on a favourite: hold one and the strip says which
         * slot, filled or not.
         *
         * WHAT IT CLOSES. `setFavourite(slot, id)` takes `null` and always has — the
         * store's own note is about "somebody chose nothing" being a remembered choice —
         * and no surface in this skin could ever pass it. So a filled rail was permanent:
         * five profiles, no way to clear one, and no way to replace one except by
         * emptying a slot that could not be emptied. Slate's answer is press-and-hold
         * (`profileManager.js:1040` — Edit / Replace with / Clear button, or Browse for
         * an empty slot) and this is the gesture half of it.
         *
         * AN EMPTY SLOT HOLDS TOO. `ui-bank` fires the hold for a disabled cell on
         * purpose, and an empty slot is disabled for the ordinary press: it is the one
         * most likely to be the target of a hold.
         */
        hold: { type: Boolean, reflect: true },

        /**
         * The toolbar height, passed straight through to <ui-bank tall>. Not a look
         * decided here: this component paints nothing, and the two heights Slate
         * declares (--slate-control-height 64, --slate-control-lg 82 "toolbar controls
         * that carry a whole screen") are the bank's own named states.
         *   ORACLE live-ready #profile-fav-nav [i=2] height = 82px, cells 80 — the Live
         *          header's strip is a toolbar control. The profile selector's strip is
         *          not on a toolbar and asks for nothing, so it stays at 64/62.
         */
        tall: { type: Boolean, reflect: true },

        /**
         * NAME ONLY: draw no occupancy mark, so a cell is its profile's name and
         * nothing else (parity 7-live-polish, Ben's Live ruling).
         *
         * WHY THE ROW NEEDS A SECOND FORM AT ALL. The mark is Slate's own fix and this
         * component quotes it — `slate-shell.css:1663-1665`, "the five favourite slots
         * were pixel-identical whatever they held, so tapping one was a blind
         * overwrite" — but Slate applied it on the SELECTOR screen and never on Live,
         * and the Live strip is the one this pass is measured against:
         *   ORACLE live-ready #fav-profile-btn-0..4 [i=3..7] — five BUTTONS whose whole
         *          painted content is text. [i=3] "Extractamundo Dos! (2)", [i=4]
         *          "Temp test", [i=5] "Extractamundo Dos!", and [i=6] [i=7] EMPTY
         *          STRINGS. No disc, no glyph, no number: an empty cell is empty, and
         *          that emptiness IS Slate's occupancy signal on this screen.
         *
         * THE MARK ALSO CARRIED A NUMBER THE ORACLE DOES NOT HAVE. `index=${cell.slot}`
         * paints 1..5 in the discs, so the Live strip read "1 Extractamundo Dos! (2)"
         * against Slate's "Extractamundo Dos! (2)" — a slot ordinal Decal invented
         * for a row whose cells are already in slot order. It cost width, too: with the
         * discs the five cells wanted ~710px of the band against Slate's 520, and the
         * band's own note says the give comes from the favourites, so the header's
         * action cluster was paying for five ordinals nobody asked for.
         *
         * WHAT IT DOES NOT CHANGE, and the reason this is an attribute rather than a
         * deletion: the SELECTOR keeps the mark, because that is the screen Slate wrote
         * the fix for and the fix is real there. Occupancy stays DATA either way — an
         * empty entry is `filled: false`, which disables the cell and skips its tab
         * stop — so bug L6's `:blank` selector stays dead in both forms, and P25's five
         * cells stand in both. The only thing this attribute removes is the paint.
         */
        plain: { type: Boolean, reflect: true },

        /**
         * MANAGE MODE: this strip ASSIGNS slots rather than opening them.
         *
         * Ben, 23 Aug 2026, about the profile selector: "if I select one and then press
         * the favorite button at the bottom it should change that favorite. ... the
         * favorites at the bottom of the list should just be numered 1 to 5, dont need
         * the name in it."
         *
         * Both halves are the same mode and that is why they are one attribute. A strip
         * that OPENS a favourite must show which profile is in each slot and must refuse
         * an empty one — there is nothing to open. A strip that ASSIGNS must accept every
         * slot, empty ones most of all, and needs no names: the profile being assigned is
         * the one selected in the list beside it, and the only thing a cell has to say is
         * WHICH slot it is.
         *
         * So `manage` does three things, and each follows from that sentence:
         *   - every cell is pressable, `filled` or not;
         *   - the cell is its slot mark alone, with no name;
         *   - `change` carries the SLOT, because an empty slot has no value to identify
         *     it by and an empty slot is exactly the one being filled.
         *
         * OCCUPANCY IS STILL DATA. `filled` continues to drive the mark's own painted
         * state, so a manage strip still shows which slots are taken — it just stops
         * using that fact to refuse the press.
         */
        manage: { type: Boolean, reflect: true },
    };

    static styles = [
        /* `visuallyHidden` is a STRUCTURAL fragment and goes first (CONVENTIONS §5a).
         * There is no `selectionSurface` here and that absence is the row's whole
         * claim: this component paints no state of its own, so it has nothing that a
         * state fragment would have to beat. Adding one would be the private
         * "selected" look ITEMS.json #36 forbids by name. */
        visuallyHidden,
        css`

            /* ---------------------------------------------------------------
             * THE HOST IS A WRAPPER, NOT A BOX. Every painted surface belongs to
             * ui-bank: ground, hairline, radius, seam, selection. Declaring a
             * background or a border here would be the second implementation of
             * .slate-bank that bug L8 is made of.
             * ------------------------------------------------------------- */
            :host {
                /* THE ROW'S ERGONOMIC FLOOR — see THE FLOOR in the header. Each
                 * cell needs the disc (--ui-hit-min, "a wet fingertip is about
                 * 9mm", slate-tokens.css:99-102) plus ui-bank's own --ui-space-4
                 * gutter on each side of it; below that the bank's overflow:
                 * hidden would clip the marks rather than the row overflowing
                 * where a screen can see it (spec §2.4).
                 *
                 * --_ui-fav-cells is a unitless COUNT written by updated(); a
                 * container query cannot know it and neither can a static rule.
                 * The fallback is P25's five. Every length in the sum is a token
                 * (CONVENTIONS §7). */
                min-inline-size: calc(
                    var(--_ui-fav-cells, 5) * (var(--ui-hit-min) + 2 * var(--ui-space-4))
                );
            }

            /* The bank fills the row. Nothing else here is a box. */
            .bank {
                inline-size: 100%;
            }

            /* ---------------------------------------------------------------
             * THE CELL — content only. It states no width, no height, no padding
             * and no min-*, because ui-bank's .item owns all four and L7 is
             * precisely what happens when a second rule joins in.
             * ------------------------------------------------------------- */
            .cell {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: var(--ui-space-3);
                /* Shrink with the cell rather than forcing it wider — the bank's
                 * items are flex: 1 1 0 and this is what lets them mean it. */
                min-inline-size: 0;
            }

            /* THE MARK. Presentational: inert takes it out of the tab order, the
             * hit test and the accessibility tree, and this declaration says the
             * same thing to the compositor. Two mechanisms on purpose — a press
             * that lands on the disc and does nothing is the worst outcome
             * available, and the suite clicks the disc to prove it reaches the
             * cell. */
            .mark {
                flex: 0 0 auto;
                pointer-events: none;

                /* THE SEAM STOPS HERE, and this line is not cosmetic. ui-bank sets
                 * --_ui-rest-shadow on .item + .item to carry its inset seam
                 * through selection (base.js: "the properties inherit, like every
                 * custom property"), so every cell but the first hands the seam
                 * down the flat tree — through the slot, into this element and
                 * into ITS shadow root, where selectionSurface would compose the
                 * bank's seam into the disc's own selected shadow: a 1px inset
                 * line inside a round mark that has nothing to divide. Reset to
                 * the fragment's own no-op default rather than to none, so the
                 * composition is byte-identical to the unset case. */
                --_ui-rest-shadow: 0 0 transparent;
            }

            /* THE NAME. Gives way continuously instead of at a breakpoint — see
             * the header's NO @container note. text-overflow is not inherited,
             * so it is declared here rather than left to ui-bank's own .label. */
            /* THE NAME. Gives way continuously instead of at a breakpoint, and now WRAPS.
             *
             * Ben, 25 August 2026: "with favorite profiles, make the text bigger and allow
             * it to wrap, use slate for a rough guide to text size and wrapping."
             *
             * SLATE'S THREE, MEASURED ON ITS RUNNING SCREEN rather than read off its class
             * list - which matters here, because the two disagree. The authored Tailwind on
             * #fav-profile-btn-0 says text-[22px] in a w-[240px] box; Slate's own sheet
             * overrides both, and what renders is 18px, line-height 21.6 (1.2),
             * -webkit-line-clamp 2, overflow-wrap anywhere, text-wrap balance, in a 180px
             * cell.
             *
             * 20 AND NOT 18, AND THE CELL IS WHY. Decal's cell measures 221.6 against
             * Slate's 180 - 23 % wider - so Slate's own 18 in the wider box would read
             * SMALLER against its cell than Slate does, which is the opposite of the ask.
             * 18 x 221.6 / 180 is 22.2; --ui-text-lg is 20, the scale's step below that and
             * bigger than both the 17 this replaces and Slate's own 18. "A rough guide" is
             * Ben's own phrase for exactly this latitude.
             *
             * IT FITS TWO LINES: the toolbar cell is 80 tall and two lines at 20 x 1.2 is
             * 48.
             *
             * THIS IS THE ELEMENT THAT PAINTS THE WORDS, and finding that out cost an hour.
             * ui-bank has a .label with its own nowrap and ellipsis, and every rule put
             * there did nothing: this span is SLOTTED into that label, so its own styles
             * come from this tree and ui-bank's cannot reach it. The give-away was the
             * slot's assigned node - a SPAN, not a text node. */
            .name {
                flex: 0 1 auto;
                min-inline-size: 0;
                overflow: hidden;

                font-size: var(--ui-text-lg);
                line-height: 1.2;

                white-space: normal;
                /* A PROFILE NAME IS ONE LONG WORD SOMETIMES, and Slate breaks inside it
                 * rather than letting it push the cell wider than its share. */
                overflow-wrap: anywhere;
                text-wrap: balance;

                /* TWO LINES, AND THE CAP IS A HEIGHT RATHER THAN A CLAMP.
                 *
                 * MEASURED, twice, and recorded so nobody tries it a third time: display
                 * -webkit-box computes as flow-root on this element AND on an inner span
                 * inside it, so -webkit-line-clamp is inert and Slate's own mechanism does
                 * not transfer. A flex item's display is blockified, and .name is a flex
                 * item of .cell; moving the box one element in did not help either.
                 *
                 * TWO LINES OF THE LEADING ABOVE IS THE SAME LIMIT BY ARITHMETIC, and it is
                 * deterministic: overflow hidden then cuts a third line off cleanly at the
                 * second. WHAT IT DOES NOT DO is draw an ellipsis, which Slate's clamp
                 * does - a name long enough to reach three lines is cut without a mark
                 * saying so. Recorded rather than hidden; the names on this strip are five
                 * the user chose, and the strip is not where a long one is read. */
                max-block-size: calc(2 * 1.2em);
            }

        `,
    ];

    constructor() {
        super();
        this.favourites = [];
        this.capacity = DEFAULT_CAPACITY;
        this.value = '';
        this.label = '';
        this.disabled = false;
        this.hold = false;
        this.plain = false;
    }

    /**
     * The author's `aria-label`, captured once. Same shape and same reason as
     * ui-bank's: connectedCallback runs again on every re-parent, and by then the
     * attribute in the DOM may be this component's own business.
     */
    #authorLabel = null;

    #captured = false;

    connectedCallback() {
        super.connectedCallback();
        if (!this.#captured) {
            this.#authorLabel = this.getAttribute('aria-label');
            this.#captured = true;
        }
    }

    /** The group's accessible name — the property first, then what the screen wrote. */
    get #groupName() {
        return this.label || this.#authorLabel || '';
    }

    /** `capacity` cells, or as many as there are favourites if that is more. */
    get #cells() {
        const raw = Array.isArray(this.favourites) ? this.favourites : [];
        const capacity = Number.isFinite(this.capacity) && this.capacity > 0
            ? Math.trunc(this.capacity)
            : DEFAULT_CAPACITY;
        /* NEVER FEWER CELLS THAN FAVOURITES. A capacity that truncated the list
         * would remove content silently, which is the one thing spec §2.4 bans by
         * name; a row that grows past its stated capacity is visible and fixable. */
        const n = Math.max(capacity, raw.length);
        const out = [];
        for (let i = 0; i < n; i++) out.push(normaliseFavourite(raw[i], i));
        return out;
    }

    updated(changed) {
        super.updated(changed);

        /* ONE NAME, ON THE GROUP. The bank's host carries role="group" and the
         * name; a copy left on this role-less host is a second announcement of the
         * same name on a generic — bug L23's first symptom, which ui-tab-bar
         * documents at the same point in its own lifecycle. Moved, not copied. */
        if (this.#authorLabel !== null && this.hasAttribute('aria-label')) {
            this.removeAttribute('aria-label');
        }

        /* The floor's one unknown (see :host). A count, not a length. */
        this.style.setProperty('--_ui-fav-cells', String(this.#cells.length));
    }

    render() {
        const cells = this.#cells;

        /* ui-bank's item shape. `label` is the slot's fallback text and is never
         * rendered here because every cell slots content — it is stated so that a
         * bank which somehow rendered without this component's children still
         * announces something true. An empty cell is disabled: the roving tab stop
         * skips it and a press cannot load a profile that is not there. */
        const items = cells.map((cell) => ({
            value: cell.value,
            label: cell.a11y,
            /* AN EMPTY SLOT IS INERT WHEN THE STRIP OPENS PROFILES — there is nothing
             * to open — and PRESSABLE when it assigns them, because an empty slot is the
             * one most likely to be the target. See the manage property. */
            disabled: this.manage ? false : !cell.filled,
        }));

        return html`
            <ui-bank
                id="bank"
                class="bank"
                mode="toolbar"
                ?tall=${this.tall}
                .items=${items}
                .value=${this.value ?? ''}
                .label=${this.#groupName}
                ?disabled=${this.disabled}
                ?hold=${this.hold}
                @change=${this.#onBankChange}
                @item-hold=${this.#onBankHold}
            >
                ${cells.map((cell) => html`
                    <span class="cell" slot="item-${cell.value}">
                        ${this.plain ? nothing : html`<ui-favourite-slot
                            class="mark"
                            inert
                            index=${cell.slot}
                            ?filled=${cell.filled}
                            ?selected=${cell.filled && cell.value === this.value}
                        ></ui-favourite-slot>`}
                        ${cell.name && !this.manage
                            ? html`<span class="name" aria-hidden="true">${cell.name}</span>`
                            : nothing}
                        <span class="a11y">${cell.a11y}</span>
                    </span>
                `)}
            </ui-bank>
        `;
    }

    /**
     * MIRROR, DO NOT RE-DISPATCH. ui-bank's `change` is composed and bubbling, so
     * it already leaves this shadow root retargeted to this host — a second event
     * would be two `change`s for one press. What this handler is for is the state
     * the bank cannot reach: `value` drives which MARK carries `selected`, and a
     * bank that changed its own value while this component kept the old one would
     * write the stale value back on the next render. ui-tab-bar's #onBankChange is
     * the same three lines for the same reason.
     */
    /**
     * The bank underneath answers with a VALUE; this component answers with the value
     * and the SLOT, because a slot is the only thing an empty cell can be identified by
     * — and in manage mode an empty cell is the ordinary case.
     *
     * THE INNER EVENT IS STOPPED AND A NEW ONE SENT, carrying ui-bank's own detail
     * FORWARD and adding two fields to it. Not amended in place: an event's detail is
     * the dispatcher's statement, and rewriting ui-bank's would make this component look
     * like ui-bank to every listener while saying something ui-bank never says. Not
     * replaced either — `index` is ui-bank's word for the item's position and consumers
     * read it, so it travels unchanged and `slot` (the 1-based mark) rides beside it.
     */
    /** A slot was held. Answered with the SLOT, filled or not — see the `hold` property. */
    #onBankHold(event) {
        const value = event.detail?.value;
        event.stopPropagation();
        const cell = this.#cells.find((c) => c.value === value) ?? null;
        this.dispatchEvent(new CustomEvent('favourite-hold', {
            detail: { value: cell && cell.filled ? cell.value : null, slot: cell ? cell.slot : null,
                filled: cell ? cell.filled : false },
            bubbles: true,
            composed: true,
        }));
    }

    #onBankChange(event) {
        const next = event.detail?.value;
        if (next === undefined) return;
        event.stopPropagation();
        const cell = this.#cells.find((c) => c.value === next) ?? null;
        if (next !== this.value) this.value = next;
        this.dispatchEvent(new CustomEvent('change', {
            detail: {
                ...event.detail,
                slot: cell ? cell.slot : null,
                filled: cell ? cell.filled : false,
            },
            bubbles: true,
            composed: true,
        }));
    }
}

customElements.define('ui-favourites-bank', UiFavouritesBank);
