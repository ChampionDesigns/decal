/**
 * key-bindings.js — the keyboard map a person can change, and the merge that makes it one
 * map.
 *
 * TWO HALVES WERE MISSING AND THEY WERE MISSING FROM OPPOSITE ENDS. The settings leaf
 * could SHOW a binding and not change one (`help-keyboard-shortcuts-bindings` is a READING
 * row, and the registry declared Rebind and Reset to defaults as pending: "NOBODY YET — no
 * route, no store and no key map on either side"). And the Live screen called
 * `stateForKey(event.key)` with no second argument, so it read `DEFAULT_KEY_BINDINGS` and
 * would have ignored a stored map even if one had existed.
 *
 * So a rebind UI on its own would have been a control that appears to work: the settings
 * page would show the new key and the machine would still answer the old one. This module
 * is the map both ends share.
 *
 * ===========================================================================
 * STORED BY ACTION, USED BY KEY, AND THE DIRECTION MATTERS
 * ===========================================================================
 *
 * The stored shape is ACTION -> KEY (`{espresso: 'e'}`), because that is what a person
 * edits: a row per thing the machine does, with the key beside it. The LOOKUP shape is
 * KEY -> STATE, because that is what a keydown handler has. `resolveBindings` is the one
 * place the flip happens.
 *
 * Storing it the other way round would make "which key runs Espresso" a search, and would
 * make an override that CLEARS a binding inexpressible — an absent action is the natural
 * way to say "this one is unbound", and an absent key is not.
 *
 * ===========================================================================
 * ONE KEY, ONE ACTION — ENFORCED, NOT HOPED FOR
 * ===========================================================================
 *
 * A map with two actions on one key has no correct behaviour: the last writer wins in an
 * object literal, and which one that is depends on key order nobody controls. So
 * `resolveBindings` refuses a duplicate rather than resolving it, and `conflictFor` is
 * what the editor asks BEFORE it writes — the same question, answered once.
 *
 * ===========================================================================
 * WHAT MAY BE BOUND
 * ===========================================================================
 *
 * The six actions are Slate's own (`DEFAULT_KEY_BINDINGS` in `live-targets.js`, read off
 * `app.js`). Sleep has no button on this skin's Live screen — Ben removed it on 23 Aug
 * 2026 — and its KEY is kept, which is exactly why a settings page that lists the
 * bindings is the only place it is visible at all.
 */

import { MACHINE_STATE } from '../data/machine-state.js';
import { DEFAULT_KEY_BINDINGS } from './live-targets.js';

/**
 * The bindable actions, in the order the table lists them.
 *
 * `state` is the machine state the key requests; `label` names it the way the Live
 * screen's own control does, so the two surfaces call the same thing the same thing.
 */
export const BINDABLE_ACTIONS = Object.freeze([
    Object.freeze({ id: 'espresso', state: MACHINE_STATE.ESPRESSO, label: 'Espresso' }),
    Object.freeze({ id: 'hot-water', state: MACHINE_STATE.HOT_WATER, label: 'Hot Water' }),
    Object.freeze({ id: 'steam', state: MACHINE_STATE.STEAM, label: 'Steam' }),
    Object.freeze({ id: 'flush', state: MACHINE_STATE.FLUSH, label: 'Flush' }),
    Object.freeze({ id: 'stop', state: MACHINE_STATE.IDLE, label: 'Stop' }),
    Object.freeze({ id: 'sleep', state: MACHINE_STATE.SLEEPING, label: 'Sleep' }),
]);

/** The default map in the STORED direction: action id -> key. Derived, never typed out. */
export const DEFAULT_BINDINGS_BY_ACTION = Object.freeze(Object.fromEntries(
    BINDABLE_ACTIONS.map((action) => [
        action.id,
        Object.entries(DEFAULT_KEY_BINDINGS).find(([, state]) => state === action.state)?.[0] ?? null,
    ]),
));

/**
 * How a key is written down and how it is shown.
 *
 * `KeyboardEvent.key` reports a single space for the space bar, and a lone space is
 * invisible in a table — so it is DISPLAYED as the word and STORED as the character.
 * Both halves live here, because a surface that spelled "Space" into storage would write
 * a binding no keydown can ever match.
 */
export const SPACE_KEY = ' ';

/** What a key looks like in the table. Never what is stored. */
export function keyLabel(key) {
    if (typeof key !== 'string' || key === '') return '';
    if (key === SPACE_KEY) return 'Space';
    return key.length === 1 ? key.toUpperCase() : key;
}

/**
 * Normalise a `KeyboardEvent.key` into the stored form, or null when it may not be bound.
 *
 * THREE ARE REFUSED, AND EACH FOR A REASON A USER WOULD RECOGNISE:
 *   - a MODIFIER on its own (Shift, Control, Alt, Meta) is not a shortcut, it is half of
 *     one, and capturing it would bind a key that fires on the way to every other key.
 *   - ESCAPE closes the capture. Binding it would make the editor impossible to leave.
 *   - a MULTI-CHARACTER name that is not one of the named keys below — `Dead`,
 *     `Unidentified`, `Process` — is an input-method artefact rather than a key.
 *
 * Everything else normalises to lower case, exactly as `stateForKey` looks it up.
 */
export function normaliseKey(key) {
    if (typeof key !== 'string' || key === '') return null;
    if (key === SPACE_KEY) return SPACE_KEY;
    if (key === 'Escape' || key === 'Tab') return null;
    if (key === 'Shift' || key === 'Control' || key === 'Alt' || key === 'Meta') return null;
    if (key.length === 1) return key.toLowerCase();
    return NAMED_KEYS.has(key) ? key : null;
}

/** Multi-character `KeyboardEvent.key` values worth binding. Everything else is refused. */
const NAMED_KEYS = new Set([
    'Enter', 'Backspace', 'Delete', 'Insert', 'Home', 'End', 'PageUp', 'PageDown',
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
    'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12',
]);

/**
 * The stored overrides, merged onto the defaults, in the LOOKUP direction: key -> state.
 *
 * `stored` is what came out of the settings store — anything at all, including the
 * `undefined` of a key nobody has written and the wrong-shaped leftovers of an older
 * skin. Every entry is validated; one bad entry is DROPPED and the rest still merge,
 * because a single unreadable override must not cost a user their whole keyboard.
 *
 * AN EXPLICIT `null` UNBINDS. That is how "I cleared this one" survives a merge: without
 * it, removing an override would silently restore the default and the Reset button would
 * be the only way to express a change the user did not ask for.
 *
 * @param {object|null|undefined} stored  action id -> key, or null to unbind
 * @returns {Readonly<object>} key -> machine state, ready for `stateForKey`
 */
export function resolveBindings(stored) {
    const byAction = { ...DEFAULT_BINDINGS_BY_ACTION };
    if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
        for (const action of BINDABLE_ACTIONS) {
            if (!Object.hasOwn(stored, action.id)) continue;
            const value = stored[action.id];
            if (value === null) { byAction[action.id] = null; continue; }
            const key = normaliseKey(value);
            /* A BAD OVERRIDE LEAVES THE DEFAULT IN PLACE rather than unbinding: the user
             * asked for a different key, not for no key, and refusing the whole map over
             * one bad entry is the failure this loop exists to avoid. */
            if (key !== null) byAction[action.id] = key;
        }
    }

    const byKey = {};
    for (const action of BINDABLE_ACTIONS) {
        const key = byAction[action.id];
        if (key === null || key === undefined) continue;
        /* FIRST DECLARATION WINS AND THE SECOND IS DROPPED. `BINDABLE_ACTIONS` is frozen
         * and ordered, so "first" is a stable, documented answer rather than whatever
         * order an object happened to be built in. A duplicate should never reach here —
         * `conflictFor` is what the editor asks first — and if one does, one action
         * keeping its key beats both losing theirs. */
        if (Object.hasOwn(byKey, key)) continue;
        byKey[key] = action.state;
    }
    return Object.freeze(byKey);
}

/** The merged map in the STORED direction, for the table. Same merge, other way up. */
export function bindingsByAction(stored) {
    const resolved = resolveBindings(stored);
    const out = {};
    for (const action of BINDABLE_ACTIONS) {
        out[action.id] = Object.entries(resolved).find(([, state]) => state === action.state)?.[0] ?? null;
    }
    return Object.freeze(out);
}

/**
 * Which OTHER action already holds this key, or null.
 *
 * Asked by the editor BEFORE it writes, so a conflict is a sentence the user reads rather
 * than a binding that silently vanishes.
 */
export function conflictFor(key, actionId, stored) {
    const normalised = normaliseKey(key);
    if (normalised === null) return null;
    const byAction = bindingsByAction(stored);
    for (const action of BINDABLE_ACTIONS) {
        if (action.id === actionId) continue;
        if (byAction[action.id] === normalised) return action;
    }
    return null;
}

/**
 * The stored value after one rebind — the whole overrides object, not a patch.
 *
 * WRITTEN WHOLE BECAUSE IT IS STORED WHOLE. `keyboardBindings` is one routed key holding
 * one object; a caller that merged its own patch would be the second place deciding what
 * an override means.
 */
export function withBinding(stored, actionId, key) {
    if (!BINDABLE_ACTIONS.some((action) => action.id === actionId)) return stored ?? null;
    const normalised = key === null ? null : normaliseKey(key);
    if (key !== null && normalised === null) return stored ?? null;
    const base = stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
    return Object.freeze({ ...base, [actionId]: normalised });
}
