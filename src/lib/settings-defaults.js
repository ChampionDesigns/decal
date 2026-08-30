/**
 * settings-defaults.js — what a setting reads before anyone has set it.
 *
 * =============================================================================
 * WHY THIS FILE EXISTS
 * =============================================================================
 *
 * Ben, 26 August 2026 (O3): "'Decal shows no selected segment' — this needs to be fixed
 * overall, the current option should always be shown as selected, read from the machine.
 * Where its not a machine setting then we need to decide what default value is."
 *
 * He then decided all thirty-eight of them, through the defaults picker built for O3, and
 * every value below is his.
 *
 * =============================================================================
 * TWO KINDS OF ENTRY, AND THE DIFFERENCE IS NOT COSMETIC
 * =============================================================================
 *
 * STORED — a value this skin holds and nobody else knows. There is no other source, so the
 * default IS the value on a tablet where it has never been set.
 *
 * FALLBACK — a value the MACHINE holds. The machine is the truth teller (O2) and its
 * answer always wins; the entry here is what to show while the machine has not answered,
 * or on a machine that does not carry the setting at all. A fallback must never overwrite
 * a served value, and the two tables are separate so that rule is visible rather than
 * remembered.
 *
 * =============================================================================
 * WHAT IS NOT HERE
 * =============================================================================
 *
 * A key with no entry has no default, and that is a real state: nobody has decided. Those
 * controls still render empty. Today every key Ben was asked about has an entry, so the
 * absences are only keys whose CONTROL has not been built yet — they arrive together.
 *
 * AND THE MIRROR OF THAT, which is easier to miss: an ENTRY with no key. Four of the answers
 * below — `visualizerAutoUpload`, `visualizerThreshold`, `feedbackIncludeLogs`,
 * `feedbackIncludeSystemInfo` — name settings that have no row in `storage-routes.js`, so
 * `settings.value(...)` would THROW on them rather than reading this table, and nothing in
 * `src/` asks. They are Ben's answers to the defaults picker and they are kept, because
 * throwing away a decision is worse than holding one early; what they are NOT is reachable.
 * The routing table already says why for the first: the Visualizer keys belong to the
 * `visualizer.reaplugin` plugin settings, and Decal does not store them. The day either
 * page is built, its keys get routing rows and these entries start working. Until then
 * `test/settings-defaults.test.mjs` names all four out loud, so the state is asserted rather
 * than discovered.
 */

/**
 * Values this skin stores. The default is the value until somebody changes it.
 *
 * SPELLINGS ARE THE STORE'S, not the label's: a bank stores its option's `value`, so
 * 'time' rather than 'Time' and 'c' rather than 'Celsius (°C)'. The row's own items table
 * is the authority and this file follows it.
 */
export const STORED_DEFAULTS = Object.freeze({
    // ── Machine ──────────────────────────────────────────────────────────────
    /* TWO ROWS LEFT THIS BLOCK ON 27 AUGUST 2026 AND NEITHER DECISION LEFT WITH THEM.
     *
     * `steamStopMode: 'time'` and `hotWaterStopMode: 'weight'` were Ben's answers to the
     * defaults picker, and they were stored answers to questions the MACHINE holds: the
     * steam stop is which of `steamSettings.duration` and `steamSettings.stopAtTemperature`
     * is positive, and the hot-water stop is `stopHotWaterAtWeight`. Both keys are retired in
     * `storage-routes.js` now that the Live rail derives its captions from those fields
     * instead of from a copy, and a STORED default for a machine field is the second source
     * this table exists to avoid — `machineFallbackFor` is the right shelf and both answers
     * were already on it:
     *
     *   "Steam stop: time"        -> MACHINE_FALLBACKS.steamDuration = 60, because a machine
     *                                holding a positive duration IS on a timed stop.
     *   "Hot water stop: weight"  -> MACHINE_FALLBACKS.stopHotWaterAtWeight, which reads
     *                                `HOT_WATER_STOP.preferred` — the one place that choice
     *                                is written down.
     *
     * So this is a deletion of two duplicates, not of two decisions. */
    waterTankUnit: 'mm',            // "Tank units: mm"

    /* THE TWO RESTORE POINTS, and they are stored because the machine cannot hold them:
     * while a heater is switched off its target field IS zero, so the temperature to come
     * back to has nowhere on the machine to live (storage-routes.js says the same thing
     * about `cupWarmerTarget`, which is the same shape).
     *
     * BEN'S TWO NUMBERS, from the defaults picker: "Steam temperature: 160" and "Tank
     * heater temperature: 40" — the values his own choices give each page when it is
     * switched on, so the switch comes back to the default rather than to zero. */
    steamTempWhenOn: 160,           // "Steam temperature: 160"
    tankTempWhenOn: 40,             // "Tank heater temperature: 40"

    // ── Accessories ──────────────────────────────────────────────────────────
    cupWarmerTarget: 60,            // "Cup warmer target: 60" — the restore point, as above

    // ── Display ──────────────────────────────────────────────────────────────
    screensaverEnabled: true,       // "Show screen saver: on"
    screensaverType: 'image',       // "Screen saver type: image"
    screensaverCycleMinutes: 10,    // "Change image every: 10"
    wakeLockEnabled: true,          // "Wake lock: on"
    /* 100, WHICH IS WHAT THE OLD BESPOKE PAGE ALREADY FELL BACK TO. Its resolver read
     * `served ?? stored ?? max`, so a tablet with no frame and no stored value showed
     * full brightness. The number is unchanged; what changed on 28 Aug 2026 is that it
     * is DECIDED here instead of being the third arm of an expression inside a page.
     *
     * IT IS A PREFERENCE NOW, AND IT WAS NOT BEFORE. The key was exempt from needing a
     * default on the grounds that it was "a remembered READING, not a preference —
     * nobody chose it". `ARCHETYPE.SLIDER` put a control on it, so somebody chooses it,
     * and the exemption stopped being true the moment the row shipped. */
    lastBrightness: 100,            // the pre-frame answer; the panel outranks it
    density: 'fit-screen',          // "Display size: fit-screen"

    // ── Units & Language ─────────────────────────────────────────────────────
    tempUnit: 'c',                  // "Temperature unit: c"
    clockFormat: '12h',             // "Clock: 12h"
    language: 'en',                 // "Language: en"

    /* ── Advanced: the two experimental flags, ON AND HIDDEN ──────────────────
     *
     * Ben, 26 August 2026: "Remove the fused channels and collapse detection but keep these
     * settings on and hidden." The ROWS are gone from `settings-leaves.js` — a deleted row
     * is the only honest way to say "not a control", where a gate whose condition is the
     * constant false would be a control nobody can reach. These two lines are the second
     * half of his sentence, and they were missing: the registry's own comment claimed
     * "settings-defaults.js is what decides they read as ON" while this table had no entry
     * for either, so both read `undefined`. A comment asserting a default that does not
     * exist is worse than either state on its own, because the next reader trusts it.
     *
     * NEITHER HAS A READER YET, and that is stated rather than hidden: D1 keeps the derived
     * and fused channels out of the baseline, so nothing in `src/` calls
     * `settings.value('experimentalFusedChannels')` today. The keys and their routing rows
     * survive so the feature cannot land in the wrong store later, and these defaults are
     * what it will find when it arrives. */
    experimentalFusedChannels: true,
    experimentalCollapseDetection: true,

    // ── Extensions & Help ────────────────────────────────────────────────────
    visualizerAutoUpload: true,     // "Auto-upload shots: on"
    visualizerThreshold: 7,         // "Minimum shot duration: 7"
    feedbackIncludeLogs: true,      // "Include logs: on"
    feedbackIncludeSystemInfo: true, // "Include system information: on"
});

/**
 * THE HOT-WATER STOP IS A RULE, NOT A VALUE, and this is it.
 *
 * Ben, 26 August 2026: "Weight for Bengle, Weight for the DE1 [if a] scale is connected,
 * weight grayed out if no scale is connected and volume selected."
 *
 * So the DEFAULT is weight on both machines, and what changes with the machine class is
 * nothing — what changes is whether Weight is REACHABLE. With no scale attached the option
 * is disabled and the selection falls to Volume, on either machine.
 *
 * IT IS A CONSTANT AND NOT A BRANCH because there is no per-class difference to express;
 * writing one would be inventing a distinction Ben did not make.
 */
export const HOT_WATER_STOP = Object.freeze({
    preferred: 'weight',
    withoutScale: 'volume',
    disabledWithoutScale: 'weight',
});

/**
 * Values the MACHINE holds. Shown only while the machine has not answered.
 *
 * A SERVED VALUE ALWAYS WINS. These exist so a control has something to show on a machine
 * that is asleep, unreachable or does not carry the setting — not so Decal can disagree
 * with the machine about what it is set to.
 */
/*
 * KEYED BY THE MACHINE'S FIELD NAME, NOT BY THE LIMIT KEY — and four of the eight rows
 * were keyed the wrong way until 26 August 2026.
 *
 * The model looks a fallback up with `machineFallbackFor(row.field)` (settings-leaf-model
 * `valueFor`), and a row's `field` is ReaPrime's spelling: `steamTargetTemperature`, not
 * the limits table's `steamTemp`. So `steamTemp`, `hotWaterTemp` and `fanThreshold` never
 * matched anything and those three controls had no fallback at all, while `steamFlow`,
 * `flushTimeout`, `tankTemp`, `refillKitSetting` and `usb` happen to be spelled the same
 * in both tables and worked. It was invisible on the bench because the machine answers —
 * the fallback only shows on a machine that is asleep or unreachable, which is exactly
 * when nobody is watching.
 *
 * The comment on each row is Ben's own sentence from the defaults picker, so the mapping
 * from his words to ReaPrime's field name is readable in one place.
 */
export const MACHINE_FALLBACKS = Object.freeze({
    steamTargetTemperature: 160,     // "Steam temperature: 160"
    steamFlow: 1,                    // "Steam flow: 1"
    steamDuration: 60,               // "Steam duration: 60"
    hotWaterTargetTemperature: 75,   // "Hot water temperature: 75"
    hotWaterDuration: 60,            // "Hot water duration: 60"
    flushTimeout: 5,                 // "Flush duration: 5"
    tankTemp: 40,                    // "Tank heater temperature: 40"
    /* "Fan threshold: 50" — Ben's pick from the defaults picker, and it survived the band
     * becoming machine-dependent on 27 August 2026 without needing a second thought,
     * because 50 is inside BOTH new bands: it is the middle of the Bengle's 40-60 and the
     * top of the DE1's 0-50. Had it fallen outside one of them this entry would have had
     * to become machine-dependent too, and there is no machinery here for that — a
     * fallback is keyed by field name and nothing else — so it is worth saying out loud
     * that the coincidence was checked rather than assumed.
     *
     * IT IS NOT `FAN_THRESHOLD_AFTER_RESET`, WHICH IS ALSO 50, and the two must not be
     * wired together however tempting the equality looks. This is what to SHOW while the
     * machine has not answered; that is what the machine HOLDS after Restore Defaults, and
     * it is 50 only because ReaPrime clamps its own request of 55. They agree today by
     * arithmetic accident, and coupling them would make Ben's preference move whenever
     * ReaPrime changed a clamp. */
    fan: 50,
    refillKitSetting: 2,             // "Refill kit mode: 2" — Auto-Detect
    usb: true,                       // "USB power: on"
    /* SLATE'S OWN DEFAULT, not a fallback this file picked: `getWaterAlertLevel()`
     * (settings.js:4716-4719) answers 15 for anything it does not recognise. Ben was not
     * asked about this one because the control did not exist when the picker was built. */
    refillLevel: 15,
    /* THE CUP WARMER'S THREE, moved out of STORED_DEFAULTS on 26 Aug 2026 when the page
     * became four machine rows: the machine holds all three, so these are what to show
     * while it has not answered. Ben's picks are unchanged — "Warm the cups: off",
     * "Pre-warm before a wake schedule: on", "Pre-warm time: 30". Off is a setpoint of
     * zero, which is how the machine says it. */
    cupWarmerTemperature: 0,
    /* `cupWarmerPreheatEnabled` IS DELIBERATELY NOT HERE ANY MORE (26 Aug 2026). Ben's pick
     * was "Pre-warm before a wake schedule: on", and as a FALLBACK that answer was doing
     * something he was not asked about: it painted the switch ON, with its lead stepper
     * live, on a machine that had 404'd the pre-heat route entirely — a control claiming a
     * machine does something it cannot. The pre-heat route's own answer is what the two rows
     * read now (`supportedBy: 'cupWarmerPreheatSupported'`), and an unanswered route draws
     * off rather than on. His pick still applies the moment the machine says it can. */
    cupWarmerPreheatLead: 30,
    /* THE SLEEP POLICY, moved out of STORED_DEFAULTS on 26 Aug 2026 with the cup
     * warmer's three and for the same reason: the machine holds both. Ben's picks are
     * unchanged — "Automatic sleep: on", "Sleep after: 30". */
    autoSleepEnabled: true,
    sleepAfterMinutes: 30,
    /* "Battery Saver: 80" — Ben's pick, spelled as the mode ReaPrime holds it in. The
     * label says 80% and the wire says `balanced`, which is the hysteresis band whose top
     * is 80 (`charging_logic.dart:176`). The row's own items table is the one place those
     * two names meet. */
    chargingMode: 'balanced',
    /* FOUR MORE THAT WERE IN THE WRONG TABLE. `nightModeEnabled`,
     * `lowBatteryBrightnessLimit`, `scalePowerMode` and `blockOnNoScale` are fields of
     * ReaPrime's own settings document (`POST /api/v1/settings`) and their rows have been
     * `source: MACHINE` throughout — so a default sitting in STORED_DEFAULTS was never
     * read for them, exactly like the four keyed by the wrong name above. Ben's picks are
     * unchanged; only the table is. */
    nightModeEnabled: false,          // "Night mode: off"
    lowBatteryBrightnessLimit: true,  // "Dim on low battery: on"
    scalePowerMode: 'displayOff',     // "Scale power mode: displayOff"
    blockOnNoScale: false,            // "Scale required: off"
    /* THE HOT-WATER STOP, READ OFF THE RULE ABOVE RATHER THAN STATED AGAIN.
     *
     * `HOT_WATER_STOP.preferred` is Ben's answer — "Weight for Bengle, Weight for the DE1
     * [if a] scale is connected" — and the row's own `fieldValues` map is what turns an
     * option name into the boolean ReaPrime holds. This entry is the same decision read
     * through the same map, so a change to his rule moves both halves at once instead of
     * leaving a fallback that quietly disagrees with the preference it is standing in for.
     *
     * IT IS A FALLBACK AND NOT A WRITE. A machine that answers wins, as everywhere in this
     * table; without it a tablet that had not yet read `/api/v1/settings` drew a stop bank
     * with NOTHING selected, which O3 is explicitly about. And it is safe to prefer Weight
     * here precisely because the option is capability-gated: with no scale answer the cell
     * is disabled and the selection falls to `HOT_WATER_STOP.withoutScale`. */
    stopHotWaterAtWeight: HOT_WATER_STOP.preferred === 'weight',
});


/**
 * The default for a stored key, or `undefined` when nobody has chosen one.
 *
 * UNDEFINED IS THE ANSWER, never a fallback of its own: a caller that could not tell "no
 * default" from "the default is false" would turn every undecided switch off by accident,
 * which is the class of guess this file replaces.
 */
export function defaultFor(key) {
    return Object.hasOwn(STORED_DEFAULTS, key) ? STORED_DEFAULTS[key] : undefined;
}

/** The stand-in for a machine field while the machine has not answered. */
export function machineFallbackFor(field) {
    return Object.hasOwn(MACHINE_FALLBACKS, field) ? MACHINE_FALLBACKS[field] : undefined;
}

/** True when a stored key has a decided default. */
export function hasDefault(key) {
    return Object.hasOwn(STORED_DEFAULTS, key);
}
