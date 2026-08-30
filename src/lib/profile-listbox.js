/**
 * THE REAL LISTBOX: its keys, its ids, its grouping (bug P12).
 */

import { groupProfilesByFolder } from './profile-folders.js';

/** The option id prefix. Ids live inside one shadow root, so a short one is enough. */
export const OPTION_ID_PREFIX = 'opt-';

/** `profile:5ae9…` -> `opt-profile:5ae9…`. One spelling, both directions. */
export const optionIdFor = (recordId) => `${OPTION_ID_PREFIX}${recordId}`;

/** `opt-profile:5ae9…` -> `profile:5ae9…`, or null for anything else. */
export const recordIdFromOptionId = (optionId) => (
    typeof optionId === 'string' && optionId.startsWith(OPTION_ID_PREFIX)
        ? optionId.slice(OPTION_ID_PREFIX.length)
        : null
);

/** How far PageUp / PageDown move. Ten rows is the old list's own visible run. */
export const PAGE_STEP = 10;

/** The two keys that CHOOSE the active option — a click and Enter are the same act. */
export const CHOOSE_KEYS = Object.freeze(['Enter', ' ']);

export function nextActiveIndex(key, index, length) {
    if (!Number.isInteger(length) || length <= 0) return null;
    if (CHOOSE_KEYS.includes(key)) return 'choose';
    const at = Number.isInteger(index) && index >= 0 ? index : 0;
    const clamp = (value) => Math.min(Math.max(value, 0), length - 1);
    switch (key) {
        case 'ArrowDown': return clamp(at + 1);
        case 'ArrowUp': return clamp(at - 1);
        case 'Home': return 0;
        case 'End': return length - 1;
        case 'PageDown': return clamp(at + PAGE_STEP);
        case 'PageUp': return clamp(at - PAGE_STEP);
        case 'ArrowRight': return 'open';
        case 'ArrowLeft': return 'close';
        default: return null;
    }
}

export function listboxGroups(records, { folders = true } = {}) {
    const rows = sortByTitle(Array.isArray(records) ? records.filter(Boolean) : []);
    if (!folders || rows.length === 0) return [{ folder: null, entries: rows }];
    return groupProfilesByFolder(rows, (record) => (record.profile && record.profile.title) || '');
}

function sortByTitle(rows) {
    const titleOf = (record) => (record && record.profile && record.profile.title) || '';
    return rows.slice().sort((a, b) => {
        const left = titleOf(a);
        const right = titleOf(b);
        if (!left || !right) return 0;
        return left.localeCompare(right);
    });
}

export function treeNodes(records, open = null) {
    const isOpen = open instanceof Set
        ? (name) => open.has(name)
        : (name) => Array.isArray(open) && open.includes(name);
    const out = [];
    for (const group of listboxGroups(records)) {
        if (group.folder === null) {
            for (const record of group.entries) {
                out.push(Object.freeze({ kind: 'profile', record, folder: null }));
            }
            continue;
        }
        const expanded = isOpen(group.folder);
        out.push(Object.freeze({
            kind: 'folder', folder: group.folder, count: group.entries.length, open: expanded,
        }));
        if (!expanded) continue;
        for (const record of group.entries) {
            out.push(Object.freeze({ kind: 'profile', record, folder: group.folder }));
        }
    }
    return out;
}

export function treeSideStep(direction, nodes, index) {
    const node = Array.isArray(nodes) ? nodes[index] : null;
    if (!node) return null;
    if (direction === 'open') {
        if (node.kind !== 'folder') return null;
        if (!node.open) return { open: node.folder };
        const next = nodes[index + 1];
        return next && next.kind === 'profile' ? { index: index + 1 } : null;
    }
    if (direction !== 'close') return null;
    if (node.kind === 'folder') return node.open ? { close: node.folder } : null;
    if (!node.folder) return null;
    for (let at = index - 1; at >= 0; at -= 1) {
        if (nodes[at].kind === 'folder' && nodes[at].folder === node.folder) return { index: at };
    }
    return null;
}

/** Written on the highlighted row while its id came from R1's title match. */
export const R1_PROVISIONAL_ATTR = 'data-r1-provisional';

/** The tag a grep finds when R1 lands and the provisional path comes out. */
export const R1_PROVISIONAL_HIGHLIGHT = Object.freeze({
    ask: 'R1',
    decision: 'B1',
    what: 'the loaded-profile highlight falls back to a title match against the listing',
    marking: R1_PROVISIONAL_ATTR,
    mustNotSurvive: 'v1 sign-off',
    swapWhen: 'GET /api/v1/workflow carries profile.id — read it and delete the match',
    owner: 'src/data/adapters-r.js r1LoadedProfileId',
});

export function highlightParts(title, query) {
    const text = String(title ?? '');
    const wanted = String(query ?? '').trim();
    if (text === '' || wanted === '') return Object.freeze([Object.freeze({ text, hit: false })]);

    const haystack = text.toLowerCase();
    const needle = wanted.toLowerCase();
    const parts = [];
    let at = 0;
    for (;;) {
        const found = haystack.indexOf(needle, at);
        if (found < 0) break;
        if (found > at) parts.push(Object.freeze({ text: text.slice(at, found), hit: false }));
        parts.push(Object.freeze({ text: text.slice(found, found + needle.length), hit: true }));
        at = found + needle.length;
    }
    if (at < text.length) parts.push(Object.freeze({ text: text.slice(at), hit: false }));
    return Object.freeze(parts);
}
