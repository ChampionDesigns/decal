import { SETTINGS_TREE, NAV_KIND, categoriesFor, leavesFor, rowShownOn, searchSettings } from './settings-nav.js';
import { rowsForLeaf } from './settings-leaves.js';
import { limitsFor } from './machine-limits.js';

const ALIASES = Object.freeze({
    'display-screen-brightness': 'brightness bright dim backlight screen light',
    'display-display-size-density': 'text font size zoom density larger readable',
    'display-wake-lock-enabled': 'keep screen awake wake lock',
    'machine-steam-milk-target': 'milk probe thermometer temperature stop',
    'machine-water-tank-alert': 'refill low water alert warning tank level',
    'accessories-usb-charger-night': 'night bedtime overnight sleep time morning time charging',
    'accessories-usb-charger-mode': 'battery charging charger saver',
    'calibration-flow-multiplier-weight': 'scale weight stop lookahead',
    'units-language-temperature-unit': 'degrees celsius fahrenheit °c °f',
    'units-language-time-format': 'clock time 12h 24h am pm',
});
const UNIT_WORDS = Object.freeze({
    '°C': 'celsius fahrenheit degrees °c °f', '°F': 'celsius fahrenheit degrees °c °f',
    'mL/s': 'ml/s millilitres milliliters per second flow',
    'mL': 'ml millilitres milliliters volume', mm: 'mm millimetres millimeters',
    g: 'g gram grams scale weight', s: 's sec seconds timer',
    min: 'min minutes', '%': '% percent percentage', V: 'v volts voltage',
});

export const BESPOKE_SEARCH_FIELDS = Object.freeze([
    ['machine-machine-info', 'info', 'Machine Info', 'serial firmware model version'],
    ['machine-sleep-wake-schedules', 'schedule-add', 'Add wake time', 'schedule wake morning alarm'],
    ['accessories-lighting', 'led-zone', 'Light strip', 'front back lighting zone'],
    ['accessories-lighting', 'led-bank', 'Machine state', 'awake asleep sleeping lighting'],
    ['accessories-lighting', 'led-presets', 'Presets', 'colour color palette lighting'],
    ['accessories-lighting', 'led-power', 'Power', 'brightness lighting power'],
    ['accessories-usb-charger', 'night-sleep', 'Sleep time', 'night bedtime'],
    ['accessories-usb-charger', 'night-morning', 'Morning time', 'night wake'],
    ['calibration-load-cells', 'wizard', 'Load cell calibration', 'scale tare zero calibration'],
    ['display-skin', 'theme-bank', 'Theme', 'light dark appearance colour color'],
    ['display-screen-saver', 'saver-images', 'Images', 'screensaver photos pictures folder'],
    ['units-language-select-language', 'language-select', 'Language', 'language locale translation'],
    ['connection-machine', 'devices', 'Machines', 'connect reconnect bluetooth usb machine'],
    ['connection-scale', 'devices', 'Scales', 'connect reconnect bluetooth scale'],
    ['connection-scale', 'wifi-host', 'Host', 'wifi wi-fi network address scale'],
    ['extensions-plugins', 'plugin-list', 'Installed plugins', 'extensions plugins'],
    ['extensions-visualizer', 'plugin-settings', 'Settings', 'visualizer username password upload account'],
    ['updates-skin-app', 'skins-update', 'Update all skins', 'skin update version'],
    ['updates-skin-app', 'app-check', 'Check for updates', 'app decaid update version'],
    ['updates-firmware-update', 'firmware-check', 'Check for updates', 'firmware version update'],
    ['help-talk-to-decent', 'support-subject', 'Subject', 'support message help'],
    ['help-talk-to-decent', 'support-message', 'Message', 'support text help'],
    ['help-send-feedback', 'feedback-type', 'What is this about?', 'feedback bug feature question'],
    ['help-send-feedback', 'feedback-description', 'Description', 'feedback report message'],
].map(([leaf, target, heading, aliases]) => Object.freeze({ id: `search-${target}-${leaf}`, leaf, target, heading, aliases })));

const text = (value) => String(value ?? '').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
const words = (value) => text(value).split(/\s+/).filter(Boolean);
const includes = (value, term) => {
    if (!['mm', 'ml', 'ml/s', '°c', '°f', 'g', 's', 'v', '%'].includes(term)) return text(value).includes(term);
    return text(value).split(/[\s(),;:]+/).includes(term);
};
const matches = (terms, content, context = '') => terms.every((term) => includes(`${content} ${context}`, term))
    && terms.some((term) => includes(content, term));

export function searchSettingControls(query, {
    tree = SETTINGS_TREE, machineClass = null, capability = null,
    views = null, translate = (value) => value, fields = BESPOKE_SEARCH_FIELDS, fieldVisible = () => true,
} = {}) {
    const terms = words(query);
    if (!terms.length) return [];
    const ordinary = searchSettings(query, tree, machineClass, capability);
    const results = [];
    const limits = limitsFor(machineClass);
    for (const category of categoriesFor(tree, machineClass, capability)) {
        if (ordinary.some((hit) => hit.node === category)
            || matches(terms, translate(category.name))) results.push({ kind: NAV_KIND.CATEGORY, node: category, category });
        for (const leaf of leavesFor(category, machineClass, capability)) {
            if (ordinary.some((hit) => hit.node === leaf)
                || matches(terms, translate(leaf.name))) results.push({ kind: NAV_KIND.LEAF, node: leaf, category, leaf });
            const context = `${category.name} ${leaf.name} ${translate(category.name)} ${translate(leaf.name)}`;
            const rows = views ? views(leaf.id) : rowsForLeaf(leaf.id).filter((row) => rowShownOn(row, machineClass))
                .filter((row) => !row.capability || capability?.(row.capability) !== 'absent')
                .map((row) => ({ row, heading: row.heading, bounds: limits[row.limit], items: row.items }));
            for (const view of rows ?? []) {
                const row = view.row ?? view;
                const unit = view.bounds?.unit ?? row.unit ?? '';
                const labels = (view.items ?? row.items ?? []).map((item) => `${item.label} ${translate(item.label)}`).join(' ');
                const content = `${row.heading} ${view.heading ?? ''} ${translate(view.heading ?? row.heading)} ${unit} ${UNIT_WORDS[unit] ?? ''} ${labels} ${ALIASES[row.id] ?? ''}`;
                if (!matches(terms, content, context)) continue;
                results.push({ kind: NAV_KIND.ROW, node: row, category, leaf, heading: view.heading ?? row.heading, target: row.id, primitive: true, rank: matches(terms, `${row.heading} ${view.heading ?? ''} ${translate(view.heading ?? row.heading)}`, context) ? 0 : 1 });
            }
            for (const field of fields.filter((entry) => entry.leaf === leaf.id && fieldVisible(entry))) {
                if (matches(terms, `${field.heading} ${translate(field.heading)} ${field.aliases}`, context)) {
                    results.push({ kind: NAV_KIND.ROW, node: field, category, leaf, heading: field.heading, target: field.target, primitive: false, rank: matches(terms, `${field.heading} ${translate(field.heading)}`, context) ? 0 : 1 });
                }
            }
        }
    }
    return results.sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
}
