/**
 * What a setting reads before anyone has set it.
 */

export const STORED_DEFAULTS = Object.freeze({
    // ── Machine ──────────────────────────────────────────────────────────────
    waterTankUnit: 'mm',            // "Tank units: mm"

    steamTempWhenOn: 160,           // "Steam temperature: 160"
    tankTempWhenOn: 40,             // "Tank heater temperature: 40"

    // ── Accessories ──────────────────────────────────────────────────────────
    cupWarmerTarget: 60,            // "Cup warmer target: 60" — the restore point, as above

    // ── Display ──────────────────────────────────────────────────────────────
    screensaverEnabled: true,       // "Show screen saver: on"
    screensaverType: 'image',       // "Screen saver type: image"
    screensaverCycleMinutes: 10,    // "Change image every: 10"
    wakeLockEnabled: true,          // "Wake lock: on"
    lastBrightness: 100,            // the pre-frame answer; the panel outranks it
    density: 'fit-screen',          // "Display size: fit-screen"

    // ── Units & Language ─────────────────────────────────────────────────────
    tempUnit: 'c',                  // "Temperature unit: c"
    clockFormat: '12h',             // "Clock: 12h"
    language: 'en',                 // "Language: en"

    experimentalFusedChannels: true,
    experimentalCollapseDetection: true,

    // ── Extensions & Help ────────────────────────────────────────────────────
    visualizerAutoUpload: true,     // "Auto-upload shots: on"
    visualizerThreshold: 7,         // "Minimum shot duration: 7"
    feedbackIncludeLogs: true,      // "Include logs: on"
    feedbackIncludeSystemInfo: true, // "Include system information: on"
});

export const HOT_WATER_STOP = Object.freeze({
    preferred: 'weight',
    withoutScale: 'volume',
    disabledWithoutScale: 'weight',
});

export const MACHINE_FALLBACKS = Object.freeze({
    steamTargetTemperature: 160,     // "Steam temperature: 160"
    steamFlow: 1,                    // "Steam flow: 1"
    steamDuration: 60,               // "Steam duration: 60"
    hotWaterTargetTemperature: 75,   // "Hot water temperature: 75"
    hotWaterDuration: 60,            // "Hot water duration: 60"
    flushTimeout: 5,                 // "Flush duration: 5"
    tankTemp: 40,                    // "Tank heater temperature: 40"
    fan: 50,
    refillKitSetting: 2,             // "Refill kit mode: 2" — Auto-Detect
    usb: true,                       // "USB power: on"
    refillLevel: 15,
    cupWarmerTemperature: 0,
    cupWarmerPreheatLead: 30,
    autoSleepEnabled: true,
    sleepAfterMinutes: 30,
    chargingMode: 'balanced',
    nightModeEnabled: false,          // "Night mode: off"
    lowBatteryBrightnessLimit: true,  // "Dim on low battery: on"
    scalePowerMode: 'displayOff',     // "Scale power mode: displayOff"
    blockOnNoScale: false,            // "Scale required: off"
    stopHotWaterAtWeight: HOT_WATER_STOP.preferred === 'weight',
});

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
