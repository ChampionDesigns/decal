/**
 * What each settings page is for, in one sentence.
 */

/** One sentence per leaf, keyed by the id in SETTINGS_TREE. */
export const LEAF_DESCRIPTION = Object.freeze({
    // ── Machine ──────────────────────────────────────────────────────────────
    'machine-steam': 'How the machine makes steam, and what ends a steam session.',
    'machine-hot-water': 'How much hot water the machine pours, how hot, and how fast.',
    'machine-flush': 'What the machine does when you press flush.',
    'machine-water-tank': 'The water tank heater, and how the tank level is shown.',
    'machine-sleep-wake-schedules': 'When the machine puts itself to sleep, and when it wakes.',
    'machine-advanced': 'What the group heater does before a shot starts.',
    'machine-machine-info': 'What this machine is, and what firmware it is running.',

    // ── Accessories ──────────────────────────────────────────────────────────
    'accessories-cup-warmer': 'The heated mat that warms your cups.',
    'accessories-lighting': 'The colour of the machine’s light strips, awake and asleep.',
    'accessories-usb-charger': 'How the machine charges the tablet, and how hard.',

    // ── Connection ───────────────────────────────────────────────────────────
    'connection-machine': 'Which espresso machine this tablet talks to.',
    'connection-scale': 'Which scale this tablet talks to, and what it does when the machine sleeps.',

    // ── Calibration ──────────────────────────────────────────────────────────
    'calibration-load-cells': 'Teach the machine what a known weight reads, so every shot weighs true.',
    'calibration-flow-multiplier': 'How far ahead the machine looks when deciding a pour is finished.',
    'calibration-hardware': 'What this machine has fitted, and what it runs at.',
    'calibration-default-load-settings': 'Put a group of machine settings back to their factory values.',

    // ── Maintenance ──────────────────────────────────────────────────────────
    'maintenance-machine-descaling': 'Run descaling solution through the machine to clear scale.',
    'maintenance-transport-mode': 'Push the water out of the machine before it is moved or stored.',

    // ── Display ──────────────────────────────────────────────────────────────
    'display-skin': 'Which skin this tablet shows, and whether it is light or dark.',
    'display-screen': 'How bright the screen is, how large it draws, and whether it stays awake.',
    'display-screen-saver': 'What the screen shows while the machine sleeps.',

    // ── Units & Language ─────────────────────────────────────────────────────
    'units-language-select-language': 'The language this app is written in.',
    'units-language-units': 'Celsius or Fahrenheit, and how the time is written.',

    // ── Extensions ───────────────────────────────────────────────────────────
    'extensions-visualizer': 'Upload your shots to Visualizer.',
    'extensions-plugins': 'The plugins installed on this machine.',
    'extensions-decent-app-settings': 'Settings that belong to the app serving this skin.',

    // ── Updates ──────────────────────────────────────────────────────────────
    'updates-skin-app': 'The skins installed on this machine, and their versions.',
    'updates-firmware-update': 'The firmware running on the machine, and how to change it.',

    // ── Help ─────────────────────────────────────────────────────────────────
    'help-quickstart-guide': 'How to get started with this machine.',
    'help-keyboard-shortcuts': 'The keys that run the machine from an attached keyboard. They belong to this device — a second tablet has its own.',
    'help-talk-to-decent': 'A direct line to the Decent support team.',
    'help-send-feedback': 'Report a problem, or ask for something.',
});

export function leafDescription(leafId) {
    return LEAF_DESCRIPTION[leafId] ?? '';
}
