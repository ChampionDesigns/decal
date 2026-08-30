/**
 * The Settings navigation model, and.
 */

export const SETTINGS_TREE = Object.freeze([
    Object.freeze({
        id: 'machine',
        name: 'Machine',
        leaves: Object.freeze([
            Object.freeze({ id: 'machine-steam', name: 'Steam' }),
            Object.freeze({ id: 'machine-hot-water', name: 'Hot Water' }),
            Object.freeze({ id: 'machine-flush', name: 'Flush' }),
            Object.freeze({ id: 'machine-water-tank', name: 'Water Tank' }),
            Object.freeze({ id: 'machine-sleep-wake-schedules', name: 'Sleep & Wake' }),
            Object.freeze({ id: 'machine-advanced', name: 'Pre Shot' }),
            Object.freeze({ id: 'machine-machine-info', name: 'Machine Info' }),
        ]),
    }),
    Object.freeze({
        id: 'accessories',
        name: 'Accessories',
        leaves: Object.freeze([
            Object.freeze({ id: 'accessories-cup-warmer', name: 'Cup Warmer' }),
            Object.freeze({ id: 'accessories-lighting', name: 'Lighting' }),
            Object.freeze({ id: 'accessories-usb-charger', name: 'USB Charger' }),
        ]),
    }),
    Object.freeze({
        id: 'connection',
        name: 'Connection',
        leaves: Object.freeze([
            Object.freeze({ id: 'connection-machine', name: 'Machine' }),
            Object.freeze({ id: 'connection-scale', name: 'Scale' }),
        ]),
    }),
    Object.freeze({
        id: 'calibration',
        name: 'Calibration',
        leaves: Object.freeze([
            Object.freeze({ id: 'calibration-load-cells', name: 'Load Cells' }),
            Object.freeze({ id: 'calibration-flow-multiplier', name: 'Flow Multiplier' }),
            Object.freeze({ id: 'calibration-hardware', name: 'Hardware' }),
            Object.freeze({ id: 'calibration-default-load-settings', name: 'Default Load Settings' }),
        ]),
    }),
    Object.freeze({
        id: 'maintenance',
        name: 'Maintenance',
        leaves: Object.freeze([
            Object.freeze({ id: 'maintenance-machine-descaling', name: 'Machine Descaling' }),
            Object.freeze({ id: 'maintenance-transport-mode', name: 'Transport Mode' }),
        ]),
    }),
    Object.freeze({
        id: 'display',
        name: 'Display',
        leaves: Object.freeze([
            Object.freeze({ id: 'display-skin', name: 'Skin' }),
            Object.freeze({ id: 'display-screen', name: 'Screen' }),
            Object.freeze({ id: 'display-screen-saver', name: 'Screen Saver' }),
        ]),
    }),
    Object.freeze({
        id: 'units-language',
        name: 'Units & Language',
        leaves: Object.freeze([
            Object.freeze({ id: 'units-language-select-language', name: 'Select Language' }),
            Object.freeze({ id: 'units-language-units', name: 'Units' }),
        ]),
    }),
    Object.freeze({
        id: 'extensions',
        name: 'Extensions',
        leaves: Object.freeze([
            Object.freeze({ id: 'extensions-visualizer', name: 'Visualizer' }),
            Object.freeze({ id: 'extensions-plugins', name: 'Plugins' }),
            Object.freeze({ id: 'extensions-decent-app-settings', name: 'Decaid' }),
        ]),
    }),
    Object.freeze({
        id: 'updates',
        name: 'Updates',
        leaves: Object.freeze([
            Object.freeze({ id: 'updates-skin-app', name: 'Skin / App' }),
            Object.freeze({ id: 'updates-firmware-update', name: 'Firmware Update' }),
        ]),
    }),
    Object.freeze({
        id: 'help',
        name: 'Help',
        leaves: Object.freeze([
            Object.freeze({ id: 'help-quickstart-guide', name: 'Quickstart Guide' }),
            Object.freeze({ id: 'help-keyboard-shortcuts', name: 'Keyboard Shortcuts' }),
            Object.freeze({ id: 'help-talk-to-decent', name: 'Talk to Decent' }),
            Object.freeze({ id: 'help-send-feedback', name: 'Send Feedback' }),
        ]),
    }),
]);

/** What a result is. Both kinds render through the SAME nav row (#24). */
export const NAV_KIND = Object.freeze({ CATEGORY: 'category', LEAF: 'leaf' });

export function navName(node) {
    return node?.name ?? '';
}

/** The category a leaf id belongs to, or null. */
export function categoryOf(leafId, tree = SETTINGS_TREE) {
    for (const category of tree) {
        if (category.leaves.some((leaf) => leaf.id === leafId)) return category;
    }
    return null;
}

/** One category by id, or null. Never throws — an unknown id is a state, not a crash. */
export function categoryFor(id, tree = SETTINGS_TREE) {
    return tree.find((category) => category.id === id) ?? null;
}

/** One leaf by id, or null. */
export function leafFor(id, tree = SETTINGS_TREE) {
    for (const category of tree) {
        const leaf = category.leaves.find((node) => node.id === id);
        if (leaf) return leaf;
    }
    return null;
}

/** Every leaf, in browse order. 37 of them. */
export function allLeaves(tree = SETTINGS_TREE) {
    return tree.flatMap((category) => category.leaves);
}

export function shownOnMachine(node, machineClass) {
    if (!node?.machines) return true;
    if (machineClass === null || machineClass === undefined) return true;
    return node.machines.includes(machineClass);
}

export function leafShownOn(leaf, machineClass) {
    return shownOnMachine(leaf, machineClass);
}

export function rowShownOn(row, machineClass) {
    return shownOnMachine(row, machineClass);
}

/** One category's leaves, filtered for this machine. The tree itself never changes. */
export function leavesFor(category, machineClass) {
    return (category?.leaves ?? []).filter((leaf) => leafShownOn(leaf, machineClass));
}

/** True when a query is worth running. Whitespace is not a search. */
export function isSearching(query) {
    return typeof query === 'string' && query.trim() !== '';
}

export function searchSettings(query, tree = SETTINGS_TREE, machineClass = null) {
    if (!isSearching(query)) return [];
    const needle = query.trim().toLowerCase();
    const hit = (node) => navName(node).toLowerCase().includes(needle);

    const results = [];
    for (const category of tree) {
        if (hit(category)) {
            results.push({ kind: NAV_KIND.CATEGORY, node: category, category });
        }
        for (const leaf of category.leaves) {
            /* A HIDDEN LEAF IS NOT SEARCHABLE EITHER. A search result that navigates to a
             * page the sub-nav does not list is a page with no way back to it. */
            if (!leafShownOn(leaf, machineClass)) continue;
            if (hit(leaf)) results.push({ kind: NAV_KIND.LEAF, node: leaf, category });
        }
    }
    return results;
}
