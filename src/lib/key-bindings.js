/**
 * The keyboard map a person can change, and the merge that makes it one map.
 */

import { MACHINE_STATE } from '../data/machine-state.js';
import { DEFAULT_KEY_BINDINGS } from './live-targets.js';

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

export const SPACE_KEY = ' ';

/** What a key looks like in the table. Never what is stored. */
export function keyLabel(key) {
    if (typeof key !== 'string' || key === '') return '';
    if (key === SPACE_KEY) return 'Space';
    return key.length === 1 ? key.toUpperCase() : key;
}

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

export function resolveBindings(stored) {
    const byAction = { ...DEFAULT_BINDINGS_BY_ACTION };
    if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
        for (const action of BINDABLE_ACTIONS) {
            if (!Object.hasOwn(stored, action.id)) continue;
            const value = stored[action.id];
            if (value === null) { byAction[action.id] = null; continue; }
            const key = normaliseKey(value);
            if (key !== null) byAction[action.id] = key;
        }
    }

    const byKey = {};
    for (const action of BINDABLE_ACTIONS) {
        const key = byAction[action.id];
        if (key === null || key === undefined) continue;
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

export function withBinding(stored, actionId, key) {
    if (!BINDABLE_ACTIONS.some((action) => action.id === actionId)) return stored ?? null;
    const normalised = key === null ? null : normaliseKey(key);
    if (key !== null && normalised === null) return stored ?? null;
    const base = stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
    return Object.freeze({ ...base, [actionId]: normalised });
}
