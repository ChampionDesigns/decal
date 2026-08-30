/**
 * ONE OWNER for Live's dim state, the DOM-free half.
 */

import { MACHINE_STATE } from '../data/machine-state.generated.js';
import { FEED_STATUS } from '../stores/feed-store.js';

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

const STATE_DIM = Object.freeze({
    [MACHINE_STATE.ESPRESSO]: LIVE_DIM.ALL,
    [MACHINE_STATE.STEAM]: LIVE_DIM.EXCEPT_STEAM,
    [MACHINE_STATE.STEAM_RINSE]: LIVE_DIM.EXCEPT_STEAM,
    [MACHINE_STATE.HOT_WATER]: LIVE_DIM.EXCEPT_HOTWATER,
    [MACHINE_STATE.FLUSH]: LIVE_DIM.EXCEPT_FLUSH,
});

export function liveDim(state) {
    if (typeof state !== 'string') return LIVE_DIM.NONE;
    return STATE_DIM[state] ?? LIVE_DIM.NONE;
}

export const DIM_BLIND_STATUSES = Object.freeze([FEED_STATUS.STALE, FEED_STATUS.UNAVAILABLE]);

const DIM_BLIND = new Set(DIM_BLIND_STATUSES);

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

export const RAIL_DIM_GROUP = Object.freeze({
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

export function railDimGroup(rowId) {
    return (typeof rowId === 'string' ? RAIL_DIM_GROUP[rowId] : null) ?? null;
}

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
