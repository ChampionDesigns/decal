/**
 * settings-leaf-copy.js — what each settings page is for, in one sentence.
 *
 * =============================================================================
 * WHY THIS FILE EXISTS
 * =============================================================================
 *
 * Ben, 26 August 2026 (O6): "All pages below the new horizontal dividing line should
 * describe what the page does, like what Sleep & Wake Schedules in Slate has for
 * example."
 *
 * Slate carries these as prose inside each leaf's own renderer, which is why some of its
 * pages have one and some do not — there is no place that would notice a missing one.
 * Here they are a table keyed by leaf id, so a leaf without a sentence is visible as a
 * hole in this file rather than as an absence on a screen nobody opened.
 *
 * ONE SENTENCE, AND IT SAYS WHAT THE PAGE IS FOR — not what the controls are called. The
 * controls are already on the screen and already labelled; a description that lists them
 * is a second labelling that has to be kept in step with the first. What a reader needs
 * from this line is the reason to be on this page at all.
 *
 * IT IS NOT A WARNING. Two pages start something irreversible — Machine Descaling and
 * Transport Mode — and their warnings live with their buttons, where they are read at the
 * moment they matter. This line stays a description on those pages too.
 *
 * NOT RUN THROUGH t() HERE. The screen translates it at render time, the same way it
 * translates a leaf's name, so the language is a value re-read on every render rather than
 * one frozen when this module loaded.
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
    /* THIS SENTENCE HAD TO CHANGE WHEN THE PAGE STOPPED BEING DE1-ONLY (27 August 2026).
     *
     * It read "Correct the machine's idea of how fast water is moving", which was exactly
     * right while the whole page was gated `machines: ['de1']` and every control on it was
     * a flow calibration. The gate moved down to two of the three rows, so a Bengle owner
     * now opens this page and sees ONE control — the weight flow multiplier, which is
     * stop-lag lookahead and corrects nobody's idea of anything. The old line promised them
     * a page that was not there, which is this fork's own defect class wearing prose.
     *
     * SO IT DESCRIBES WHAT IS TRUE ON BOTH MACHINES and lets the controls say the rest. The
     * page is about the numbers that decide when a pour STOPS; on a DE1 it also carries the
     * machine's own flow correction, and that row's own heading and caption say so where a
     * DE1 owner will read them.
     *
     * A PER-MACHINE SENTENCE WAS THE OTHER OPTION AND IT IS NOT WORTH THE MACHINERY. This
     * table is keyed by leaf id and nothing else; making one value a function of the machine
     * class would put a second gate in a third place, to save a reader one clause. */
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
    /* `extensions-dye2` STOOD HERE UNTIL 27 AUGUST 2026 and named a leaf that no longer
     * exists. The leaf was deleted on 26 August — its one switch had a control, a routing
     * row and a store, and nothing in `src/` read it — and this sentence outlived it.
     * `storage-routes.js` refused exactly this drift when it gave the two surviving DYE2
     * keys no `leaf` field: "a key naming a leaf that does not exist is how a routing table
     * starts describing a tree it no longer matches." The same rule applies to a copy
     * table, and the header above says the point of one is that a leaf without a sentence
     * is VISIBLE as a hole — the inverse, a sentence with no leaf, was invisible because
     * nothing checked these keys against the tree. `test/settings-leaves.test.mjs` checks
     * them now. */
    'extensions-decent-app-settings': 'Settings that belong to the app serving this skin.',

    // ── Updates ──────────────────────────────────────────────────────────────
    'updates-skin-app': 'The skins installed on this machine, and their versions.',
    'updates-firmware-update': 'The firmware running on the machine, and how to change it.',

    // ── Help ─────────────────────────────────────────────────────────────────
    'help-quickstart-guide': 'How to get started with this machine.',
    'help-keyboard-shortcuts': 'The keys that run the machine from an attached keyboard. They belong to this device — a second tablet has its own.',
    /* SLATE'S SUBTITLE, which says what the page is FOR rather than what it does
     * (Ben, 26 Aug 2026: "mostly copy Slate"). */
    'help-talk-to-decent': 'A direct line to the Decent support team.',
    'help-send-feedback': 'Report a problem, or ask for something.',
});

/**
 * The sentence for a leaf, or an empty string.
 *
 * AN EMPTY STRING AND NOT A PLACEHOLDER: a leaf whose description has not been written
 * should render no line at all, rather than a line that says nothing. The absence is the
 * signal.
 */
export function leafDescription(leafId) {
    return LEAF_DESCRIPTION[leafId] ?? '';
}
