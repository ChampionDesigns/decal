/**
 * The settings registry: every leaf, its rows, and how each row reaches the machine.
 */

import { HOT_WATER_STOP } from './settings-defaults.js';

export const ARCHETYPE = Object.freeze({
    STEPPER: 'stepper',   // #4 ui-stepper
    SWITCH: 'switch',     // #5 ui-switch
    BANK: 'bank',         // #3 ui-bank
    SELECT: 'select',     // #7 ui-select
    SLIDER: 'slider',     // ui-slider
    BUTTON: 'button',     // #1 ui-button
    TEXT: 'text',         // ui-text-field — library, not an archetype
    READING: 'reading',   // no control at all
});

/** The five, as the digest counts them. */
export const CONTROL_ARCHETYPES = Object.freeze([
    ARCHETYPE.STEPPER, ARCHETYPE.SWITCH, ARCHETYPE.BANK, ARCHETYPE.SELECT, ARCHETYPE.SLIDER,
    ARCHETYPE.BUTTON,
]);

export const SOURCE = Object.freeze({
    /** A logical key in `src/lib/storage-routes.js`. The layer is the table's answer. */
    ROUTE: 'route',
    /** A field of `GET/POST /api/v1/machine/settings` — ReaPrime owns the value. */
    MACHINE: 'machine',
    /** Neither: the row asks the screen to do something. */
    ACTION: 'action',
});

export const RESTORE = Symbol('restore the value the machine already holds');

export const DENSITY_ROW = 'display-display-size-density';

export const LEAF_KIND = Object.freeze({ PRIMITIVE: 'primitive', BESPOKE: 'bespoke' });

export const BESPOKE_LEAVES = Object.freeze({
    'machine-machine-info': 'definition card — a read-only fact table, no controls',
    'machine-sleep-wake-schedules': 'schedule editor',
    'display-skin': '2-up cards',
    'display-screen-saver': 'the screen-saver image set',
    'updates-skin-app': 'update list — the progress track lives here',
    'units-language-select-language': 'auto-fill tile grid',
    'calibration-load-cells': 'wizard column + step chips',
    'accessories-lighting': 'two-column, with the LED live preview',
    'updates-firmware-update': 'catalog + install — a Latest button over `recommendedArtifactId`, a file picker, and the flash progress',

    'maintenance-machine-descaling': 'an irreversible action behind a confirmation, over `PUT /machine/state/descaling` — the preparation list is the surface, not a control',
    'maintenance-transport-mode': 'as descaling, over `PUT /machine/state/airPurge`',
    'extensions-plugins': 'the installed-plugin list — one row per manifest, each with its own generated settings form',
    'extensions-visualizer': 'ONE plugin\u2019s settings form, generated from its manifest (`plugins-store.js` `settingFields`)',
    'help-talk-to-decent': 'the account status, and behind a linked account a message thread and a compose box over `GET /account/proxy/support/api/<endpoint>`',
    'help-send-feedback': 'the feedback form: a type bank, a description, two switches and one POST',
    'accessories-usb-charger': 'the charging STATUS block and the two night-mode times — a minute-of-day is a clock face (#22), which is a dialog body and not a row control',
    'connection-machine': 'the remembered device list and its actions',
    'connection-scale': 'the same device list, plus the scan and the manual WiFi endpoints',
    'help-keyboard-shortcuts': 'the binding table with a key-capture field — rebinding needs a keystroke, which no archetype reads',
    'calibration-default-load-settings': 'one irreversible-looking button and the list of what it actually moves',
});

export const LEAF_ACTIONS = Object.freeze({
    'connection-machine': Object.freeze({ action: 'scan-devices', label: 'Search' }),
    'connection-scale': Object.freeze({ action: 'scan-devices', label: 'Search' }),
});

export const LEAVES_READING_MACHINE_DOC = Object.freeze([
    'calibration-default-load-settings',
]);

/** Does this leaf need the machine document even with no machine row? */
export function leafReadsMachineDoc(leafId) {
    return LEAVES_READING_MACHINE_DOC.includes(leafId);
}

/** The page-level action for a leaf, or null. */
export function leafAction(leafId) {
    return LEAF_ACTIONS[leafId] ?? null;
}

export const SETTINGS_ROWS = Object.freeze([

    Object.freeze({
        id: 'machine-steam-enabled',
        leaf: 'machine-steam',
        archetype: ARCHETYPE.SWITCH,
        source: SOURCE.MACHINE,
        field: 'steamTargetTemperature',
        zeroSwitch: 'steamTempWhenOn',
        heading: 'Steam',
        caption: 'Turn the steam heater on and off.',
    }),
    Object.freeze({
        id: 'machine-steam-flow',
        leaf: 'machine-steam',
        archetype: ARCHETYPE.STEPPER,
        source: SOURCE.MACHINE,
        field: 'steamFlow',
        limit: 'steamFlow',
        heading: 'Flow',
        enabledBy: 'machine-steam-enabled',
    }),
    Object.freeze({
        id: 'machine-steam-temp',
        leaf: 'machine-steam',
        archetype: ARCHETYPE.STEPPER,
        source: SOURCE.MACHINE,
        field: 'steamTargetTemperature',
        limit: 'steamTemp',
        heading: 'Temperature',
        enabledBy: 'machine-steam-enabled',
        live: 'steamTemperature',
    }),
    Object.freeze({
        id: 'machine-steam-stop',
        leaf: 'machine-steam',
        archetype: ARCHETYPE.BANK,
        source: SOURCE.MACHINE,
        derivedFrom: Object.freeze([
            Object.freeze({ field: 'milkStopTemp', is: 'milk-temp' }),
            Object.freeze({ field: 'steamDuration', is: 'time' }),
        ]),
        whenNone: 'off',
        stages: Object.freeze({
            off: Object.freeze({ steamDuration: 0, milkStopTemp: 0 }),
            time: Object.freeze({ milkStopTemp: 0, steamDuration: RESTORE }),
            'milk-temp': Object.freeze({ milkStopTemp: RESTORE }),
        }),
        /* THE OPTION TO FALL BACK TO when the chosen one is disabled — a machine with no
         * milk probe cannot be in Milk Temp, so it reads as Time. */
        unavailable: 'time',
        heading: 'Steam stop',
        caption: 'What ends a steam session.',
        enabledBy: 'machine-steam-enabled',
        captions: Object.freeze({
            off: 'Steam runs until you stop it (subject to the machine safety timeout).',
            time: 'Steam stops automatically after the set duration.',
            'milk-temp': 'Steam stops automatically when the milk reaches the target temperature.',
        }),
        items: Object.freeze([
            Object.freeze({ value: 'off', label: 'Off' }),
            Object.freeze({ value: 'time', label: 'Time' }),

            Object.freeze({
                value: 'milk-temp',
                label: 'Milk Temp',
                sensor: 'milkProbe',
                note: 'Requires the Bengle milk temperature probe.',
            }),
        ]),
    }),
    Object.freeze({
        id: 'machine-steam-milk-target',
        leaf: 'machine-steam',
        archetype: ARCHETYPE.STEPPER,
        source: SOURCE.MACHINE,
        field: 'milkStopTemp',
        limit: 'milkStopTemp',
        heading: 'Stop at milk temperature',
        enabledBy: Object.freeze([
            'machine-steam-enabled',
            Object.freeze({ row: 'machine-steam-stop', value: 'milk-temp' }),
        ]),
    }),

    Object.freeze({
        id: 'machine-steam-duration',
        leaf: 'machine-steam',
        archetype: ARCHETYPE.STEPPER,
        source: SOURCE.MACHINE,
        field: 'steamDuration',
        limit: 'steamDuration',
        heading: 'Duration',
        enabledBy: Object.freeze([
            'machine-steam-enabled',
            Object.freeze({ row: 'machine-steam-stop', value: 'time' }),
        ]),
    }),
    Object.freeze({
        id: 'machine-steam-purge',
        leaf: 'machine-steam',
        archetype: ARCHETYPE.SELECT,
        source: SOURCE.MACHINE,
        field: 'steamPurgeMode',
        heading: 'Steam purge mode',
        enabledBy: 'machine-steam-enabled',
        caption: 'Normal purges the wand as soon as steam stops. Two Tap Stop waits for a second tap, so the wand can stay in the jug.',
        items: Object.freeze([
            Object.freeze({ value: 0, label: 'Normal' }),
            Object.freeze({ value: 1, label: 'Two Tap Stop' }),
        ]),
    }),

    Object.freeze({
        id: 'machine-hot-water-temp',
        leaf: 'machine-hot-water',
        archetype: ARCHETYPE.STEPPER,
        source: SOURCE.MACHINE,
        field: 'hotWaterTargetTemperature',
        limit: 'hotWaterTemp',
        heading: 'Target temperature',
        live: 'groupTemperature',
    }),
    Object.freeze({
        id: 'machine-hot-water-duration',
        leaf: 'machine-hot-water',
        archetype: ARCHETYPE.STEPPER,
        source: SOURCE.MACHINE,
        field: 'hotWaterDuration',
        limit: 'hotWaterDuration',
        heading: 'Duration',
        caption: 'Stops at this time regardless of the amount dispensed.',
    }),
    /* THE 255 CEILING IS THE PACKET'S AND THE LIMITS TABLE OWNS IT. Its paragraph in
     * machine-limits.js is the one that measured the wrap on the bench (400 came back as
     * 144); nothing here repeats a number. */

    Object.freeze({
        id: 'machine-water-stop',
        leaf: 'machine-hot-water',
        archetype: ARCHETYPE.BANK,
        source: SOURCE.MACHINE,
        field: 'stopHotWaterAtWeight',
        /* THE BOOLEAN AND THE TWO WORDS, mapped once and read in both directions by the
         * model. ReaPrime holds a bool; the page draws two cells. */
        fieldValues: Object.freeze({ volume: false, weight: true }),
        unavailable: HOT_WATER_STOP.withoutScale,
        heading: 'Hot water stop',
        caption: 'What ends a hot-water pour.',
        items: Object.freeze([
            Object.freeze({ value: 'volume', label: 'Volume' }),
            Object.freeze({
                value: HOT_WATER_STOP.disabledWithoutScale,
                label: 'Weight',
                capability: 'stopAtWeight',
                note: 'Requires a connected scale',
            }),
        ]),
    }),

    Object.freeze({
        id: 'machine-hot-water-volume',
        leaf: 'machine-hot-water',
        archetype: ARCHETYPE.STEPPER,
        source: SOURCE.MACHINE,
        field: 'hotWaterVolume',
        limit: 'hotWaterVolume',
        heading: 'Volume',
        variesWith: Object.freeze({ row: 'machine-water-stop' }),
        variants: Object.freeze({
            volume: Object.freeze({ heading: 'Volume', unit: 'mL', zeroMeans: 'no volume cap' }),
            weight: Object.freeze({ heading: 'Weight', unit: 'g', zeroMeans: 'no weight cap' }),
        }),
    }),
    Object.freeze({
        id: 'machine-hot-water-flow',
        leaf: 'machine-hot-water',
        archetype: ARCHETYPE.STEPPER,
        source: SOURCE.MACHINE,
        field: 'hotWaterFlow',
        limit: 'hotWaterFlow',
        heading: 'Flow',
    }),
    Object.freeze({
        id: 'machine-hot-water-lookahead',
        leaf: 'machine-hot-water',
        archetype: ARCHETYPE.STEPPER,
        source: SOURCE.MACHINE,
        field: 'hotWaterFlowMultiplier',
        limit: 'hotWaterLookahead',
        heading: 'Stop lookahead',
        caption: 'How far ahead of the target weight the pour is cut, to allow for water still in flight.',
        enabledBy: Object.freeze({ row: 'machine-water-stop', value: HOT_WATER_STOP.disabledWithoutScale }),
    }),

    /* FLUSH. All three fields are on POST /machine/settings and all three have limits
     * rows — the one leaf where the door and the table line up completely. */
    Object.freeze({
        id: 'machine-flush-temp',
        leaf: 'machine-flush',
        archetype: ARCHETYPE.STEPPER,
        source: SOURCE.MACHINE,
        field: 'flushTemp',
        limit: 'flushTemp',
        heading: 'Temperature for flush cycles',
    }),
    Object.freeze({
        id: 'machine-flush-flow',
        leaf: 'machine-flush',
        archetype: ARCHETYPE.STEPPER,
        source: SOURCE.MACHINE,
        field: 'flushFlow',
        limit: 'flushFlow',
        heading: 'Flush flow rate',
    }),
    Object.freeze({
        id: 'machine-flush-duration',
        leaf: 'machine-flush',
        archetype: ARCHETYPE.STEPPER,
        source: SOURCE.MACHINE,
        field: 'flushTimeout',
        limit: 'flushDuration',
        heading: 'Duration',
    }),

    Object.freeze({
        id: 'machine-water-tank-preheat',
        leaf: 'machine-water-tank',
        archetype: ARCHETYPE.SWITCH,
        source: SOURCE.MACHINE,
        field: 'tankTemp',
        zeroSwitch: 'tankTempWhenOn',
        heading: 'Preheat water tank',
        caption: 'Turning this on preheats the tank, which can help with flow rates above six millilitres a second. Not recommended under most circumstances.',
    }),
    Object.freeze({
        id: 'machine-water-tank-temp',
        leaf: 'machine-water-tank',
        archetype: ARCHETYPE.STEPPER,
        source: SOURCE.MACHINE,
        field: 'tankTemp',
        limit: 'tankTemp',
        heading: 'Tank heater temperature',
        caption: 'Loading a profile overwrites this with the profile’s own tank temperature.',
        enabledBy: 'machine-water-tank-preheat',
    }),
    Object.freeze({
        id: 'machine-water-tank-alert',
        leaf: 'machine-water-tank',
        archetype: ARCHETYPE.STEPPER,
        source: SOURCE.MACHINE,
        field: 'refillLevel',
        limit: 'waterAlertLevel',
        heading: 'Water level',
        caption: 'Alert when the tank water level drops below this height. Zero turns the alert off.',
    }),
    Object.freeze({
        id: 'machine-water-tank-unit',
        leaf: 'machine-water-tank',
        archetype: ARCHETYPE.BANK,
        source: SOURCE.ROUTE,
        key: 'waterTankUnit',
        heading: 'Measurement units',
        caption: 'Show tank level on the home screen in mm or mL.',
        items: Object.freeze([
            Object.freeze({ value: 'mm', label: 'mm' }),
            Object.freeze({ value: 'ml', label: 'mL' }),
        ]),
    }),

    Object.freeze({
        id: 'machine-advanced-heater-ph1-flow',
        leaf: 'machine-advanced',
        archetype: ARCHETYPE.STEPPER,
        source: SOURCE.MACHINE,
        field: 'heaterPh1Flow',
        limit: 'heaterPh1Flow',
        heading: 'Heater phase 1 flow',
        caption: 'The flow rate that warms the heater up from idle temperature.',
    }),
    Object.freeze({
        id: 'machine-advanced-heater-ph2-flow',
        leaf: 'machine-advanced',
        archetype: ARCHETYPE.STEPPER,
        source: SOURCE.MACHINE,
        field: 'heaterPh2Flow',
        limit: 'heaterPh2Flow',
        heading: 'Heater phase 2 flow',
        caption: 'The flow rate that adjusts water temperature so the shot starts on target.',
    }),
    Object.freeze({
        id: 'machine-advanced-heater-ph2-timeout',
        leaf: 'machine-advanced',
        archetype: ARCHETYPE.STEPPER,
        source: SOURCE.MACHINE,
        field: 'heaterPh2Timeout',
        limit: 'heaterPh2Timeout',
        heading: 'Heater phase 2 timeout',
        caption: 'The longest phase 2 can run for. A longer time improves temperature control.',
    }),
    Object.freeze({
        id: 'machine-advanced-heater-idle-temp',
        leaf: 'machine-advanced',
        archetype: ARCHETYPE.STEPPER,
        source: SOURCE.MACHINE,
        field: 'heaterIdleTemp',
        limit: 'heaterIdleTemp',
        heading: 'Heater idle temperature',
        caption: 'What the water heater holds between shots.',
    }),
    Object.freeze({
        id: 'machine-sleep-auto',
        leaf: 'machine-sleep-wake-schedules',
        archetype: ARCHETYPE.SWITCH,
        source: SOURCE.MACHINE,
        field: 'autoSleepEnabled',
        capability: 'wakeSchedule',
        heading: 'Automatic sleep',
        caption: 'Puts the machine to sleep after a period without use.',
    }),
    Object.freeze({
        id: 'machine-sleep-after',
        leaf: 'machine-sleep-wake-schedules',
        archetype: ARCHETYPE.STEPPER,
        source: SOURCE.MACHINE,
        field: 'sleepAfterMinutes',
        limit: 'sleepAfter',
        capability: 'wakeSchedule',
        heading: 'Sleep after',
        caption: 'Time without use before the machine sleeps.',
        enabledBy: 'machine-sleep-auto',
    }),

    Object.freeze({
        id: 'accessories-cup-warmer-enabled',
        leaf: 'accessories-cup-warmer',
        archetype: ARCHETYPE.SWITCH,
        source: SOURCE.MACHINE,
        field: 'cupWarmerTemperature',
        zeroSwitch: 'cupWarmerTarget',
        heldField: 'cupWarmerHeldTarget',
        heading: 'Enable cup warmer',
        caption: 'Warm the cups on the top of the machine.',
    }),
    Object.freeze({
        id: 'accessories-cup-warmer-target',
        leaf: 'accessories-cup-warmer',
        archetype: ARCHETYPE.STEPPER,
        source: SOURCE.MACHINE,
        field: 'cupWarmerTemperature',
        limit: 'cupWarmerTarget',
        heading: 'Target temperature',
        enabledBy: 'accessories-cup-warmer-enabled',
    }),
    Object.freeze({
        id: 'accessories-cup-warmer-now',
        leaf: 'accessories-cup-warmer',
        archetype: ARCHETYPE.READING,
        source: SOURCE.MACHINE,
        field: 'cupWarmerCurrentTemperature',
        heading: 'Current temperature',
        caption: 'Live temperature of the cup-warming plate.',
        unit: '°C',
    }),
    Object.freeze({
        id: 'accessories-cup-warmer-prewarm',
        leaf: 'accessories-cup-warmer',
        archetype: ARCHETYPE.SWITCH,
        source: SOURCE.MACHINE,
        field: 'cupWarmerPreheatEnabled',
        heading: 'Pre-warm before wake-up',
        caption: 'The mat starts ahead of the time the machine is due to wake.',
        supportedBy: 'cupWarmerPreheatSupported',
        unsupportedNote: 'This machine’s firmware doesn’t support pre-warm — update the firmware to use it.',
    }),
    Object.freeze({
        id: 'accessories-cup-warmer-prewarm-lead',
        leaf: 'accessories-cup-warmer',
        archetype: ARCHETYPE.STEPPER,
        source: SOURCE.MACHINE,
        field: 'cupWarmerPreheatLead',
        limit: 'preWarmLead',
        heading: 'Start this long before',
        enabledBy: 'accessories-cup-warmer-prewarm',
        /* THE SAME VETO, AND NO SECOND SENTENCE. The switch above says why once; repeating
         * it under the stepper would print the caveat twice on one page. */
        supportedBy: 'cupWarmerPreheatSupported',
    }),

    Object.freeze({
        id: 'accessories-usb-charger-power',
        leaf: 'accessories-usb-charger',
        archetype: ARCHETYPE.SWITCH,
        source: SOURCE.MACHINE,
        field: 'usb',
        heading: 'USB power',
        caption: 'Charge a phone or a scale from the machine.',
    }),

    Object.freeze({
        id: 'accessories-usb-charger-mode',
        leaf: 'accessories-usb-charger',
        archetype: ARCHETYPE.BANK,
        source: SOURCE.MACHINE,
        field: 'chargingMode',
        heading: 'Battery Saver',
        caption: 'The charge limit for the tablet. A lower limit prolongs the battery’s life and protects the tablet.',
        items: Object.freeze([
            Object.freeze({ value: 'disabled', label: 'Off' }),
            Object.freeze({ value: 'balanced', label: '80%' }),
            Object.freeze({ value: 'longevity', label: '55%' }),
        ]),
    }),

    Object.freeze({
        id: 'accessories-usb-charger-dim',
        leaf: 'accessories-usb-charger',
        archetype: ARCHETYPE.SWITCH,
        source: SOURCE.MACHINE,
        field: 'lowBatteryBrightnessLimit',
        heading: 'Dim the screen when the battery is low',
    }),
    Object.freeze({
        id: 'accessories-usb-charger-night',
        leaf: 'accessories-usb-charger',
        archetype: ARCHETYPE.SWITCH,
        source: SOURCE.MACHINE,
        field: 'nightModeEnabled',
        heading: 'Night mode',
        caption: 'Charge conservatively between a sleep time and a morning time.',
        enabledBy: Object.freeze({ row: 'accessories-usb-charger-mode', not: 'disabled' }),
    }),

    Object.freeze({
        id: 'connection-machine-host',
        leaf: 'connection-machine',
        archetype: ARCHETYPE.TEXT,
        source: SOURCE.ROUTE,
        key: 'reaHostname',
        heading: 'ReaPrime address',
        caption: 'Where this tablet looks for the machine. Blank means this page’s own host. Takes effect the next time this page loads.',
    }),

    Object.freeze({
        id: 'connection-scale-power-mode',
        leaf: 'connection-scale',
        archetype: ARCHETYPE.BANK,
        source: SOURCE.MACHINE,
        field: 'scalePowerMode',
        heading: 'When the machine sleeps',
        caption: 'What happens to a connected scale.',
        items: Object.freeze([
            Object.freeze({ value: 'disabled', label: 'Nothing' }),
            Object.freeze({ value: 'displayOff', label: 'Display Off' }),
            Object.freeze({ value: 'disconnect', label: 'Disconnect' }),
        ]),
    }),
    Object.freeze({
        id: 'connection-scale-required',
        leaf: 'connection-scale',
        archetype: ARCHETYPE.SWITCH,
        source: SOURCE.MACHINE,
        field: 'blockOnNoScale',
        heading: 'Scale required',
        caption: 'The machine refuses to start a shot with no scale connected.',
    }),

    Object.freeze({
        id: 'calibration-fan-threshold',
        leaf: 'calibration-hardware',
        archetype: ARCHETYPE.STEPPER,
        source: SOURCE.MACHINE,
        field: 'fan',
        limit: 'fanThreshold',
        heading: 'Fan turns on at',
        caption: 'The fan runs above this temperature.',
    }),

    Object.freeze({
        id: 'calibration-voltage-mains',
        leaf: 'calibration-hardware',
        archetype: ARCHETYPE.BANK,
        source: SOURCE.MACHINE,
        field: 'heaterVoltage',
        heading: 'Mains voltage',
        navSummary: true,
        caption: 'Set to match your local mains voltage. An incorrect setting may affect heater performance. Nothing changes until the machine restarts.',
        readingField: 'measuredVoltage',
        readingLabel: 'Measured at the machine',
        readingUnit: 'V',
        emptyNote: 'No voltage set yet — choose the one that matches your supply.',
        items: Object.freeze([
            Object.freeze({ value: 120, label: '110V' }),
            Object.freeze({ value: 230, label: '220V' }),
        ]),
    }),
    Object.freeze({
        id: 'calibration-refill-kit-mode',
        leaf: 'calibration-hardware',
        archetype: ARCHETYPE.BANK,
        source: SOURCE.MACHINE,
        field: 'refillKitSetting',
        heading: 'Refill kit mode',
        caption: 'Auto lets the machine decide. Force On keeps the refill kit always active; Force Off disables it.',
        items: Object.freeze([
            Object.freeze({ value: 2, label: 'Auto-Detect' }),
            Object.freeze({ value: 1, label: 'Force On' }),
            Object.freeze({ value: 0, label: 'Force Off' }),
        ]),
    }),
    Object.freeze({
        id: 'calibration-flow-multiplier-factor',
        leaf: 'calibration-flow-multiplier',
        archetype: ARCHETYPE.STEPPER,
        source: SOURCE.MACHINE,
        field: 'flowMultiplier',
        limit: 'flowCalibration',
        machines: Object.freeze(['de1']),
        heading: 'Flow calibration',
        caption: 'Scales the machine’s flow estimate. 1 is uncalibrated.',
    }),

    Object.freeze({
        id: 'calibration-flow-multiplier-weight',
        leaf: 'calibration-flow-multiplier',
        archetype: ARCHETYPE.STEPPER,
        source: SOURCE.MACHINE,
        field: 'weightFlowMultiplier',
        limit: 'appFlowMultiplier',
        /* NO `machines` GATE, DELIBERATELY, AND THE ABSENCE IS THE DECISION. See above. */
        heading: 'Weight flow multiplier',
        caption: 'How far ahead the shot stops. The scale’s flow rate for this many seconds is added to the weight already in the cup, so a higher value stops the shot earlier. Default 1.0 s.',
        navSummary: true,
    }),
    Object.freeze({
        id: 'calibration-flow-multiplier-volume',
        leaf: 'calibration-flow-multiplier',
        archetype: ARCHETYPE.STEPPER,
        source: SOURCE.MACHINE,
        field: 'volumeFlowMultiplier',
        limit: 'appFlowMultiplier',
        machines: Object.freeze(['de1']),
        heading: 'Volume flow multiplier',
        caption: 'How far ahead a volume-stopped shot ends. The machine’s flow for this many seconds is added to the volume already poured, which covers the lag between the stop command and the flow actually stopping. A higher value stops the shot earlier. Default 0.3 s.',
    }),

    Object.freeze({
        id: 'display-display-size-density',
        leaf: 'display-screen',
        archetype: ARCHETYPE.BANK,
        source: SOURCE.ROUTE,
        key: 'density',
        heading: 'Display size',
        caption: 'Sets how large text and rows are drawn. A short window still tightens '
            + 'the rhythm on top of your choice.',
        items: Object.freeze([
            Object.freeze({ value: 'small', label: 'Small' }),
            Object.freeze({ value: 'fit-screen', label: 'Fit screen' }),
            Object.freeze({ value: 'larger', label: 'Larger' }),
            Object.freeze({ value: 'largest', label: 'Largest' }),
        ]),
    }),
    Object.freeze({
        id: 'display-screen-saver-enabled',
        leaf: 'display-screen-saver',
        archetype: ARCHETYPE.SWITCH,
        source: SOURCE.ROUTE,
        key: 'screensaverEnabled',
        heading: 'Show screen saver when the machine sleeps',
        caption: 'While the machine sleeps the screen shows the saver below. Touch it to wake the machine.',
    }),
    Object.freeze({
        id: 'display-screen-saver-type',
        leaf: 'display-screen-saver',
        archetype: ARCHETYPE.BANK,
        source: SOURCE.ROUTE,
        key: 'screensaverType',
        heading: 'Screen saver',
        caption: 'What the screen shows while the machine sleeps. A fully black screen is the kindest to the panel.',
        items: Object.freeze([
            Object.freeze({ value: 'black', label: 'Black' }),
            Object.freeze({ value: 'image', label: 'Image' }),
            Object.freeze({ value: 'clock', label: 'Clock' }),
        ]),
        enabledBy: 'display-screen-saver-enabled',
    }),
    Object.freeze({
        id: 'display-screen-saver-cycle',
        leaf: 'display-screen-saver',
        archetype: ARCHETYPE.STEPPER,
        source: SOURCE.ROUTE,
        key: 'screensaverCycleMinutes',
        limit: 'screensaverCycle',
        heading: 'Change image every',
        caption: 'With more than one image, how long each one stays on screen.',
        enabledBy: Object.freeze({ row: 'display-screen-saver-type', value: 'image' }),
    }),

    Object.freeze({
        id: 'display-screen-brightness',
        leaf: 'display-screen',
        archetype: ARCHETYPE.SLIDER,
        source: SOURCE.ROUTE,
        key: 'lastBrightness',
        panel: 'brightness',
        limit: 'screenBrightness',
        heading: 'Screen brightness',
        caption: 'The lowest setting stays readable, so the screen never goes dark by accident.',
    }),
    Object.freeze({
        id: 'display-wake-lock-enabled',
        leaf: 'display-screen',
        archetype: ARCHETYPE.SWITCH,
        source: SOURCE.ROUTE,
        key: 'wakeLockEnabled',
        panel: 'wakeLock',
        heading: 'Enable wake lock',
        caption: 'Keep the screen on while the app is active.',
        note: 'The wake lock releases by itself when the connection to the machine drops.',
    }),

    Object.freeze({
        id: 'display-skin-leave',
        leaf: 'display-skin',
        archetype: ARCHETYPE.BUTTON,
        source: SOURCE.ACTION,
        action: 'leave-skin',
        heading: 'Leave this skin',
        caption: 'Closes the skin and shows the Decent app underneath. Only the app can do this — a browser tab stays where it is. Nothing is uninstalled.',
        control: 'Leave',
    }),

    Object.freeze({
        id: 'units-language-temperature-unit',
        leaf: 'units-language-units',
        archetype: ARCHETYPE.BANK,
        source: SOURCE.ROUTE,
        key: 'tempUnit',
        heading: 'Temperature unit',
        items: Object.freeze([
            Object.freeze({ value: 'c', label: 'Celsius (°C)' }),
            Object.freeze({ value: 'f', label: 'Fahrenheit (°F)' }),
        ]),
    }),

    Object.freeze({
        id: 'units-language-time-format',
        leaf: 'units-language-units',
        archetype: ARCHETYPE.BANK,
        source: SOURCE.ROUTE,
        key: 'clockFormat',
        heading: 'Clock',
        items: Object.freeze([
            Object.freeze({ value: '24h', label: '24-hour' }),
            Object.freeze({ value: '12h', label: '12-hour' }),
        ]),
    }),

    Object.freeze({
        id: 'extensions-decent-app-gateway',
        leaf: 'extensions-decent-app-settings',
        archetype: ARCHETYPE.BANK,
        source: SOURCE.MACHINE,
        field: 'gatewayMode',
        heading: 'Gateway mode',
        caption: 'How much the gateway does with the machine. Tracking watches it; Full also controls it.',
        items: Object.freeze([
            Object.freeze({ value: 'disabled', label: 'Disabled' }),
            Object.freeze({ value: 'tracking', label: 'Tracking' }),
            Object.freeze({ value: 'full', label: 'Full' }),
        ]),
    }),
    Object.freeze({
        id: 'extensions-decent-app-log-level',
        leaf: 'extensions-decent-app-settings',
        archetype: ARCHETYPE.SELECT,
        source: SOURCE.MACHINE,
        field: 'logLevel',
        heading: 'Log level',
        caption: 'How much detail the app writes to its log. Everything is for chasing a fault; Off writes nothing.',
        items: Object.freeze([
            Object.freeze({ value: 'ALL', label: 'Everything (ALL)' }),
            Object.freeze({ value: 'FINEST', label: 'Trace (FINEST)' }),
            Object.freeze({ value: 'FINER', label: 'Trace (FINER)' }),
            Object.freeze({ value: 'FINE', label: 'Debug (FINE)' }),
            Object.freeze({ value: 'CONFIG', label: 'Configuration (CONFIG)' }),
            Object.freeze({ value: 'INFO', label: 'Info (INFO)' }),
            Object.freeze({ value: 'WARNING', label: 'Warnings (WARNING)' }),
            Object.freeze({ value: 'SEVERE', label: 'Errors (SEVERE)' }),
            Object.freeze({ value: 'SHOUT', label: 'Critical (SHOUT)' }),
            Object.freeze({ value: 'OFF', label: 'Off (OFF)' }),
        ]),
    }),
    Object.freeze({
        id: 'extensions-decent-app-updates',
        leaf: 'extensions-decent-app-settings',
        archetype: ARCHETYPE.SWITCH,
        source: SOURCE.MACHINE,
        field: 'automaticUpdateCheck',
        heading: 'Automatic update checks',
        caption: 'Look for a newer app every twelve hours.',
    }),
    Object.freeze({
        id: 'extensions-decent-app-path',
        leaf: 'extensions-decent-app-settings',
        archetype: ARCHETYPE.READING,
        source: SOURCE.MACHINE,
        field: 'webUiPath',
        heading: 'Web UI folder',
        caption: 'Where the app serves this skin from.',
    }),

    Object.freeze({
        id: 'help-quickstart-guide-view',
        leaf: 'help-quickstart-guide',
        archetype: ARCHETYPE.BUTTON,
        source: SOURCE.ACTION,
        action: 'open-quickstart',
        heading: 'Quick start guide',
        caption: 'Opens Decent’s own guide in a new window.',
        control: 'View',
    }),
]);

export const LEAF_NOTES = Object.freeze({
});

export const PENDING_ROWS = Object.freeze([

    Object.freeze({
        leaf: 'help-quickstart-guide', name: 'Startup counter', limit: null,
        owner: 'NOT A CONTROL AT ALL. `helpLaunches` is the counter behind the button’s '
            + 'default and exists so "never chose" stays distinguishable from "chose to show".',
    }),

]);

/** Every row a leaf owns, in registry order. Unknown leaf -> empty, never a throw. */
export function rowsForLeaf(leafId) {
    return SETTINGS_ROWS.filter((row) => row.leaf === leafId);
}

/** One row by id, or null. */
export function rowFor(id) {
    return SETTINGS_ROWS.find((row) => row.id === id) ?? null;
}

/** Everything declared-but-not-built for a leaf. */
export function pendingForLeaf(leafId) {
    return PENDING_ROWS.filter((row) => row.leaf === leafId);
}

/** The note for a leaf, or null. */
export function noteForLeaf(leafId) {
    return LEAF_NOTES[leafId] ?? null;
}

export function leafKind(leafId) {
    return Object.hasOwn(BESPOKE_LEAVES, leafId) ? LEAF_KIND.BESPOKE : LEAF_KIND.PRIMITIVE;
}

/** Every leaf that carries at least one live row. */
export function leavesWithRows() {
    return [...new Set(SETTINGS_ROWS.map((row) => row.leaf))];
}

/** The logical storage keys the registry claims, sorted. */
export function registryKeys() {
    return [...new Set(SETTINGS_ROWS.filter((row) => row.source === SOURCE.ROUTE).map((row) => row.key))].sort();
}

export function machineFields() {
    const fields = new Set();
    for (const row of SETTINGS_ROWS) {
        if (row.source !== SOURCE.MACHINE) continue;
        if (row.field) fields.add(row.field);
        for (const plan of Object.values(row.stages ?? {})) {
            for (const field of Object.keys(plan)) fields.add(field);
        }
    }
    return [...fields].sort();
}

/** How many rows each archetype carries — the headline's supporting arithmetic. */
export function archetypeCounts() {
    const counts = {};
    for (const name of Object.values(ARCHETYPE)) counts[name] = 0;
    for (const row of SETTINGS_ROWS) counts[row.archetype] += 1;
    return counts;
}
