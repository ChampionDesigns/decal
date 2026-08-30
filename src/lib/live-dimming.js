/**
 * live-dimming.js — ONE OWNER for Live's dim state, the DOM-free half. Bug L11.
 *
 * §7.2 L11, verbatim: "Two dimming systems fight over the rail: the class rule
 * deliberately exempts `#dose-section`, and `ui.js:3490-3491` then writes inline
 * `opacity: 0.25` onto it during espresso. Inline wins."
 * (`slate-live.css:1805-1808`; `ui.js:3476`; `app.js:918-920`.)
 *
 * The paint is `src/screens/live-dimming.js`, which is one declaration block and imports
 * `lit`. The split is `base-conventions.js`'s, for its reason: `lit` cannot be imported
 * under `node --test`, so everything here that is pure logic lives where it can be tested
 * without a browser.
 *
 * ===========================================================================
 * WHAT THE TWO OWNERS EACH BELIEVED, READ AT THE SOURCE
 * ===========================================================================
 *
 * OWNER A — the stylesheet, keyed on one class (`slate-live.css:1805-1807`):
 *     #main-page.is-running #shot-settings > div:not(#dose-section) { opacity: .62 }
 *     [data-theme="dark"] … { opacity: .42 }
 *     #main-page.is-running #shot-settings { pointer-events: none }
 *     #main-page.is-running .slate-rail-stop { pointer-events: auto }
 *   Its model: "the machine is running, so recede the rail — except the dose." Toggled by
 *   `ui.js:3565` (`classList.toggle('is-running', …)`). Its two opacities are a real design
 *   answer and the sheet says why: ".38 was a dark-theme number: on the light theme's white
 *   steppers it took the labels to about 1.9:1 … The point is 'not now', not 'gone'."
 *
 * OWNER B — `updateSidebarOverlay(state)` (`ui.js:3458-3494`), inline, per GROUP:
 *     el.style.opacity = shouldDim ? '0.25' : '';
 *     el.style.pointerEvents = shouldDim ? 'none' : '';
 *   Its model is finer: dim by machine state, and never dim the group the machine is
 *   actually using — `steam` leaves the steam rows alone, `hotWater` leaves hot water
 *   alone, `flush` leaves flush alone, `espresso` dims everything (`STATE_DIM_MAP`,
 *   `ui.js:3464-3470`).
 *
 * The defect is not either model. It is that BOTH SHIP: an inline style beats every
 * stylesheet rule without `!important`, so owner A's per-theme opacities and its dose
 * exemption are dead in every state owner B covers — and `#dose-section` is dimmed to .25
 * during espresso, which is the one thing owner A wrote a `:not()` to prevent.
 *
 * ===========================================================================
 * WHICH MODEL SURVIVES, AND THE ONE-LINE REVERSAL
 * ===========================================================================
 *
 * OWNER B'S MAP, and owner A's VALUES. The map, because B covers all five running states
 * and wins every one of them today — so B's behaviour is the behaviour users actually
 * have, and reproducing it minus the fight changes nothing anyone can see. A's
 * `:not(#dose-section)` was, in effect, dead code: there is no state in which A's rule
 * applied and B's did not. The values, because A's are designed per theme and B's `0.25`
 * is one number that the sheet's own comment says is wrong on light.
 *
 * WHAT THAT COSTS: A's INTENT is lost — "the dose is still worth reading while the shot
 * runs" — because under B's map `dose` recedes during espresso like everything else.
 * REVERSAL, one line: add `dose` to the exempt test in `groupDimmed` (and the matching
 * `:not([data-dim-group='dose'])` to the `all` selector). Recorded in
 * `waves/5.1/DEFERRED_QUESTIONS_gates.md`.
 *
 * WHAT THIS OWNER DOES NOT OWN. Whether a control REFUSES input is the control's own
 * business (`disabled` / `aria-disabled`, and `live-mode-recomposition`'s row for which
 * controls a mode offers at all). `pointer-events` travels with the paint because it is
 * the half of the same state both Slate owners wrote and disagreed about.
 */

import { MACHINE_STATE } from '../data/machine-state.generated.js';
import { FEED_STATUS } from '../stores/feed-store.js';

/**
 * The rail's groups, as `ui.js:3458-3463` names them (`SIDEBAR_GROUPS`).
 *
 * Carried over as identifiers rather than as Slate's element ids because the ids are the
 * thing L17 warns about ("positional child selectors used as structural contracts"). A
 * group is an attribute a row declares about itself: `data-dim-group="steam"`.
 */
export const LIVE_DIM_GROUP = Object.freeze({
    DOSE: 'dose',
    DRINK: 'drink',
    BREW: 'brew',
    STEAM: 'steam',
    HOTWATER: 'hotwater',
    FLUSH: 'flush',
});

/** The six, in the rail's own order. */
export const LIVE_DIM_GROUPS = Object.freeze(Object.values(LIVE_DIM_GROUP));

/** The attribute the one CSS block reads, and the one the group rows carry. */
export const LIVE_DIM_ATTR = 'dim';
export const LIVE_DIM_GROUP_ATTR = 'data-dim-group';

/**
 * The values `dim` may take. `NONE` is the ABSENCE of the attribute, so a screen that is
 * not dimming anything carries no state it has to remember to clear.
 */
export const LIVE_DIM = Object.freeze({
    NONE: null,
    ALL: 'all',
    EXCEPT_STEAM: 'except-steam',
    EXCEPT_HOTWATER: 'except-hotwater',
    EXCEPT_FLUSH: 'except-flush',
});

/** The prefix that ties a `LIVE_DIM` value to the group it exempts. */
const EXCEPT = 'except-';

/**
 * `STATE_DIM_MAP` (`ui.js:3464-3470`), as the one place it is written.
 *
 * Slate spells it "which groups to dim"; here it is "which group is exempt" — the same map
 * with the arithmetic done once instead of per render, which is what lets the paint be one
 * `:not()` rather than one rule per group per state.
 */
const STATE_DIM = Object.freeze({
    [MACHINE_STATE.ESPRESSO]: LIVE_DIM.ALL,
    [MACHINE_STATE.STEAM]: LIVE_DIM.EXCEPT_STEAM,
    [MACHINE_STATE.STEAM_RINSE]: LIVE_DIM.EXCEPT_STEAM,
    [MACHINE_STATE.HOT_WATER]: LIVE_DIM.EXCEPT_HOTWATER,
    [MACHINE_STATE.FLUSH]: LIVE_DIM.EXCEPT_FLUSH,
});

/**
 * The dim state for a machine state. THE map, and the only one.
 *
 * TOTAL over `MACHINE_STATES` by construction: anything not named above dims nothing, so a
 * state this build has never seen (or `null`, the boot value) recedes NOTHING rather than
 * receding everything. Fail-visible — an unknown state must never hide the rail.
 *
 * @param {string|null} state  a `MACHINE_STATE` member, or null
 * @returns {string|null} a `LIVE_DIM` value; `null` means "dim nothing"
 */
export function liveDim(state) {
    if (typeof state !== 'string') return LIVE_DIM.NONE;
    return STATE_DIM[state] ?? LIVE_DIM.NONE;
}

/**
 * The two feed statuses that leave NOTHING to dim from.
 *
 * `STALE` is "we hold a reading and it is no longer to be believed" — reached by age past
 * the feed's budget, by a socket CLOSE and by an error envelope, the last two LATCHED
 * (`feed-store.js:129-140, 206-212`) so no amount of clock refreshing undoes them.
 * `UNAVAILABLE` is the source's own verdict and `refreshStaleness` never leaves it.
 * `NEVER` is deliberately NOT here: nothing has arrived, `liveDim(null)` already dims
 * nothing, and the boot state of a feed must not be treated as a fault.
 */
export const DIM_BLIND_STATUSES = Object.freeze([FEED_STATUS.STALE, FEED_STATUS.UNAVAILABLE]);

const DIM_BLIND = new Set(DIM_BLIND_STATUSES);

/**
 * The state the dim owner may map — the machine's own state name while its feed is still
 * worth believing, and `null` the moment it is not.
 *
 * WHY THE MAP ALONE WAS NOT ENOUGH. `liveDim` is total and fail-visible over the STATE
 * vocabulary, so a name that never arrived recedes nothing. But it never saw the FEED, and
 * the feed is what tells "the machine is in espresso" from "the machine WAS in espresso,
 * before its channel went". Only the first is a reason to recede the rail and take its
 * pointer events away; the second held every dimmable track at the dim token with
 * `pointer-events: none` and — because a latched stale is never lifted by the clock, and
 * only a new frame clears it — held it there for the rest of the session. A socket blip
 * mid-espresso left the rail receded and untappable for ever, with `<ui-stop-button>` the
 * one exempt control (`RAIL_DIM_GROUP.mode`) still answering.
 *
 * DIMMING IS THE ONLY THING THIS WITHDRAWS. The state NAME still travels to the screen, so
 * the header chip goes on reporting it (as "No reading", at this same threshold), the
 * rail keeps the mode it recomposed to and the STOP target stays exactly where it was: a
 * feed that stopped talking is not a machine that stopped pulling, and withdrawing the
 * abort target would be a worse bug than the one this closes.
 *
 * @param {string|null} state       a `MACHINE_STATE` member, or null
 * @param {string|null} feedStatus  the machine feed's `FEED_STATUS`, when one is known
 * @returns {string|null} the state to map, or null for "dim nothing"
 */
export function dimStateFor(state, feedStatus) {
    return DIM_BLIND.has(feedStatus) ? null : state;
}

/**
 * Is this group dimmed in this dim state? The same answer the CSS gives, in JS, so a test
 * can check the map without a browser and a component can label a row for a reader.
 */
export function groupDimmed(dim, group) {
    if (typeof dim !== 'string' || dim === '') return false;
    if (dim === LIVE_DIM.ALL) return true;
    return dim !== `${EXCEPT}${group}`;
}

/** Which `LIVE_DIM` values dim something. Used by the paint's own consistency test. */
export const LIVE_DIM_ACTIVE = Object.freeze([
    LIVE_DIM.ALL, LIVE_DIM.EXCEPT_STEAM, LIVE_DIM.EXCEPT_HOTWATER, LIVE_DIM.EXCEPT_FLUSH,
]);

/**
 * Rail track id → dim group. `null` is EXEMPT, and is a decision each time.
 *
 * The ids are `src/lib/live-targets.js`'s (`railRows`), and the groups are Slate's
 * (`SIDEBAR_GROUPS`, `ui.js:3458-3463`). A MAP AND NOT A PREFIX TEST: an id vocabulary is
 * a contract another module owns, and `startsWith('steam')` would silently adopt whatever
 * a later row happened to be called — which is L17's trap wearing a string.
 *
 * `mode` IS THE ONE EXEMPTION AND IT IS OWNER A'S. That track holds the mode bank and,
 * while the machine is running, `<ui-stop-button>` — the abort target. Slate keeps it live
 * by hand for exactly this reason: `#main-page.is-running #shot-settings { pointer-events:
 * none }` followed by `#main-page.is-running .slate-rail-stop { pointer-events: auto }`
 * (`slate-live.css:1807-1808`). A dimmed STOP on a machine mid-pour is the one dimming bug
 * worse than L11.
 *
 * ONE NOTE ON WHAT THE REWRITE CHANGED UNDER THIS MAP. The rail now RECOMPOSES by mode
 * (`railRows` returns one mode's tracks), so the per-mode exemptions rarely bind: during
 * steam there are no espresso rows on screen to dim. They stay because the map is the
 * mechanism, and because `except-steam` is what makes "the mode in use never recedes" true
 * by construction rather than by the rail's current shape.
 */
export const RAIL_DIM_GROUP = Object.freeze({
    /* EXEMPT, AND IT IS TWO DECISIONS IN ONE ENTRY. `grind` arrived with the standing
     * rail (Ben's 22 Aug ruling). Slate's own `SIDEBAR_GROUPS` has no grind group —
     * the six are dose/drink/brew/steam/hotwater/flush — so there is no Slate answer
     * to carry, and grind describes the GRINDER rather than anything the machine is
     * doing; receding it while the group steams would be this map inventing a rule.
     *
     * AND IT IS THE TRACK THE ABORT TARGET RIDES IN. `mode` used to be this map's one
     * exemption and it held `<ui-stop-button>`; the picker is gone and the stop button
     * moved into the first standing row's own track (live-targets.js, `abortSlot`), so
     * the exemption moved with it. A dimmed, pointer-events-none abort target is the
     * one dimming bug worse than L11, and Slate keeps its own live by hand for exactly
     * that reason (slate-live.css:1808). */
    grind: null,
    dose: LIVE_DIM_GROUP.DOSE,
    'drink-weight': LIVE_DIM_GROUP.DRINK,
    'drink-weight-presets': LIVE_DIM_GROUP.DRINK,
    'brew-temp': LIVE_DIM_GROUP.BREW,
    'steam-temp': LIVE_DIM_GROUP.STEAM,
    'steam-flow': LIVE_DIM_GROUP.STEAM,
    'steam-flow-presets': LIVE_DIM_GROUP.STEAM,
    'steam-stop': LIVE_DIM_GROUP.STEAM,
    'steam-stop-target': LIVE_DIM_GROUP.STEAM,
    'water-temp': LIVE_DIM_GROUP.HOTWATER,
    'water-stop': LIVE_DIM_GROUP.HOTWATER,
    'water-stop-target': LIVE_DIM_GROUP.HOTWATER,
    'flush-temp': LIVE_DIM_GROUP.FLUSH,
    'flush-flow': LIVE_DIM_GROUP.FLUSH,
    'flush-duration': LIVE_DIM_GROUP.FLUSH,
});

/**
 * The group a rail track belongs to, or `null` for "never dims".
 *
 * FAIL-VISIBLE on an id this map does not know: a new track is not dimmed until somebody
 * decides which group it is in. The alternative — dimming by default — would hide a
 * control nobody meant to hide, and the test that enumerates every id `railRows` can
 * produce is what stops the omission being permanent.
 */
export function railDimGroup(rowId) {
    return (typeof rowId === 'string' ? RAIL_DIM_GROUP[rowId] : null) ?? null;
}

/**
 * ===========================================================================
 * THE SECOND, WEAKER EXEMPTION: RECEDES, BUT STILL TAKES A PRESS (audit F-038)
 * ===========================================================================
 * Ben, 30 August 2026 (decisions page, F-038): **"A defect — make them pressable."**
 *
 * WHAT WAS MEASURED. Wave 3 guarded and deep-hit-tested thirteen Live cells — five
 * favourites, four drink presets, four flow presets — in four compositions. Mid-shot, with
 * telemetry live and STOP armed, **five of thirteen were hittable: all EIGHT preset-bank
 * cells resolved to `live-screen >>> live-rail`**, while the five favourites stayed
 * hittable. Once the stream ended, all thirteen came back
 * (`_audit/wave-3/logs/W3-live/faults.json`).
 *
 * WHY THE RAIL ANSWERED FOR THEM, which is the whole mechanism. `liveDimming`
 * (`src/screens/live-dimming.js`) paints every `[data-dim-group]` at the dim token AND
 * takes its `pointer-events` away in the same rule. An espresso shot is `LIVE_DIM.ALL`, so
 * both preset banks became `pointer-events: none`, the hit fell straight through them to
 * `<live-rail>` — which paints `--ui-fascia` and therefore answers — and the walk stopped
 * one level above the cell. Nothing was disabled, nothing said so, and a `.click()` still
 * worked, which is exactly why the suite could not see it: `test/render/live-preset-cells`
 * drives the cells synthetically and passed throughout.
 *
 * The five favourites were never affected because they are not rail tracks and carry no
 * `data-dim-group` at all, and `<ui-stop-button>` was never affected because its track is
 * `grind`, which `RAIL_DIM_GROUP` maps to `null` — Slate's own hand-kept exemption.
 *
 * THIS IS A SECOND EXEMPTION AND NOT A WIDENING OF THE FIRST. `RAIL_DIM_GROUP`'s `null`
 * means "never recedes and never loses input"; a preset bank SHOULD still recede while the
 * machine is using another mode — that is owner A's designed "not now", and the finding is
 * not that the banks look wrong. So the paint keeps its map, and this names the rows whose
 * INPUT the paint may not take. The two questions were one declaration and they are two
 * now, which is the header's own line — "whether a control REFUSES input is the control's
 * own business" — made true for the rows Ben has ruled on.
 *
 * A MAP OF IDS, LIKE ITS SIBLING, AND FOR THE SAME REASON. `startsWith('...presets')`
 * would silently adopt whatever a later row happened to be called (L17's trap wearing a
 * string). And it is FAIL-VISIBLE in the same direction as `railDimGroup` is: an id this
 * set does not name keeps today's behaviour, so a new row is never quietly made pressable
 * mid-shot by a naming coincidence.
 *
 * WHAT IS NOT DECIDED HERE. The rail's STEPPERS lose their pointer events under the same
 * rule and are not in this set, because Wave 3 measured thirteen cells and none of them was
 * a stepper — so there is no measurement and no ruling. It is recorded for Ben rather than
 * guessed: a drink-weight bank you can press beside a drink-weight stepper you cannot is a
 * coherence question, and the answer is his.
 */
export const DIM_KEEPS_INPUT = Object.freeze([
    'drink-weight-presets',
    'steam-flow-presets',
]);

const KEEPS_INPUT = new Set(DIM_KEEPS_INPUT);

/** The attribute the paint reads, and the one those rows carry. */
export const LIVE_DIM_KEEPS_INPUT_ATTR = 'data-dim-keeps-input';

/**
 * Does this rail track keep its pointer events while it is receded?
 *
 * @param {string|null} rowId  a `railRows` track id
 * @returns {boolean} true only for the rows `DIM_KEEPS_INPUT` names
 */
export function railKeepsInput(rowId) {
    return typeof rowId === 'string' && KEEPS_INPUT.has(rowId);
}
