

/** Physical prefix for every browser-storage key. Pinned to the manifest id by test. */
export const STORAGE_PREFIX = 'decal.';

/** ReaPrime KV namespaces. The namespace carries the identity, so KV keys are NOT prefixed. */
export const KV_NAMESPACE = 'decal';
export const KV_NUMPAD_NAMESPACE = 'decal.numpad';

export const IDB_DATABASE_NAME = 'decal.shot_history';

export const LAYERS = Object.freeze({
    local: 'local',
    session: 'session',
    kv: 'kv',
    kvNumpad: 'kvNumpad',
    none: 'none',
});

export const SCOPES = Object.freeze({
    device: 'device', // describes this tablet — survives nothing else, and should not
    machine: 'machine', // describes the machine or the workflow on it — survives a tablet swap
    ephemeral: 'ephemeral', // one visit; dies with the tab
    external: 'external', // owned by ReaPrime, a plugin, or retired by a decision
});

/** Row status. `provisional` rows are gated on an open question named in `trace`. */
export const STATUSES = Object.freeze({
    v1: 'v1',
    provisional: 'provisional',
    retired: 'retired',
});

export const STORAGE_ROUTES = deepFreeze({

    theme: {
        layer: LAYERS.local, scope: SCOPES.device, status: STATUSES.v1,
        why: 'Describes this display. The pre-paint stamp in index.html reads the physical key directly — the one hand-written copy of the prefix in the tree.',
        trace: 'SCOPE Part 3 §5; Part 2 §6 (pre-paint stamp, and bug S11: never write on first run)',
        was: 'slate.theme',
        leaf: 'display-skin',
    },
    density: {
        layer: LAYERS.local, scope: SCOPES.device, status: STATUSES.v1,
        why: 'C6 replaces Display Size with a density / type-scale control. A property of this screen, not of the machine. STORES THE BASE, NEVER THE COMPOSED VALUE: SCOPE Part 2 §5 rule 2 gives --ui-density three writers and one composition — the C6 preference sets the BASE, the height band MULTIPLIES it (x1 regular, x0.875 under 700px) "so a user choice survives a short window", and C3\'s named compact is a container-scoped re-declaration that composes with neither. Persisting the composed number would make a choice made on a short window permanent, which is the same class of defect as the dual write: a value the user did not choose, stored as though they had.',
        trace: 'SCOPE Part 5 §4 (C6, accepted); Part 2 §5 rule 2 (the one place the composition is stated); Part 3 §5 names display density as device-scoped; styles/tokens.css:1032-1038 carries the matching split as a written-down obligation',
        was: null,
        leaf: 'display-screen',
    },
    language: {
        layer: LAYERS.local, scope: SCOPES.device, status: STATUSES.v1,
        why: 'Who is reading this tablet. Dual-written today (localStorage AND the IDB settings store) — one owner now.',
        trace: 'D2 (i18n mechanism ships in v1); old skin writes both localStorage `language` and setSetting(\'language\')',
        was: 'slate.language',
        leaf: 'units-language-select-language',
    },
    keyboardBindings: {
        layer: LAYERS.local, scope: SCOPES.device, status: STATUSES.v1,
        why: 'Bindings belong to whatever keyboard is attached to this device.',
        trace: 'CAPABILITY_DIFF Keep § "correctly placed — KEEP" list, endorsed by SCOPE Part 3 §5',
        was: 'slate.keyboardBindings',
        leaf: 'help-keyboard-shortcuts',
    },
    wakeLockEnabled: {
        layer: LAYERS.local, scope: SCOPES.device, status: STATUSES.v1,
        why: 'A browser/WebView capability of this device.',
        trace: 'CAPABILITY_DIFF Keep § KEEP list',
        was: 'slate.wakeLockEnabled',
        leaf: 'display-screen',
    },
    screensaverEnabled: {
        layer: LAYERS.local, scope: SCOPES.device, status: STATUSES.v1,
        why: 'This display sleeps, not the machine.',
        trace: 'CAPABILITY_DIFF Keep § KEEP list',
        was: 'slate.screensaverEnabled',
        leaf: 'display-screen-saver',
    },
    clockFormat: {
        layer: LAYERS.local, scope: SCOPES.device, status: STATUSES.v1,
        why: 'How a time is written, everywhere this skin writes one. DEVICE-scoped rather '
            + 'than machine-scoped because it is a reading preference of whoever is looking '
            + 'at this tablet, not a fact about the machine — the same reason the language '
            + 'row beside it is.',
        trace: 'Ben, 24 Aug 2026: "For the screen saver clock or clock in general we should '
            + 'give the option to show 24hr or 12hr with am/pm added to 12 hr."',
        was: null,
        leaf: 'units-language-units',
    },
    screensaverType: {
        layer: LAYERS.local, scope: SCOPES.device, status: STATUSES.v1,
        why: 'What the screen shows while the machine sleeps. A property of this display.',
        trace: 'Ben, 26 Aug 2026: "screen saver type, Black / Image / Clock"; supersedes '
            + '`screensaverClock` (Ben, 24 Aug) and reverses D10 for the Image case.',
        was: 'slate.blackScreenSaver (a two-state version of the same question)',
        leaf: 'display-screen-saver',
    },
    screensaverCycleMinutes: {
        layer: LAYERS.local, scope: SCOPES.device, status: STATUSES.v1,
        why: 'Same reason as screensaverEnabled.',
        trace: 'Ben, 26 Aug 2026: "make that a stepper, 1 to 10 minutes".',
        was: 'slate.screensaverCycleSeconds (a seconds band; NOT read as minutes)',
        leaf: 'display-screen-saver',
    },
    screensaverImages: {
        layer: LAYERS.local, scope: SCOPES.device, status: STATUSES.v1,
        why: 'The pictures the saver cycles, as data URLs. Chosen on this tablet, held on this tablet.',
        trace: 'Ben, 26 Aug 2026: "let the user choose another image, or a folder on the disk"; '
            + 'old skin IDB settings store key `screensaverImages`.',
        was: 'screensaverImages (IDB settings store)',
        leaf: 'display-screen-saver',
    },
    reaHostname: {
        layer: LAYERS.local, scope: SCOPES.device, status: STATUSES.v1,
        why: 'Which ReaPrime this browser talks to. Cannot live in the store it addresses.',
        trace: 'CAPABILITY_DIFF Keep § KEEP list; old skin api.js:10',
        was: 'slate.reaHostname',
        leaf: 'connection-machine',
    },
    debug: {
        layer: LAYERS.local, scope: SCOPES.device, status: STATUSES.v1,
        why: 'Drives the logger level on this device. Read once at boot by the composition root, which then calls logger.setLevel — the logger does not read storage itself (no import cycle).',
        trace: 'CAPABILITY_DIFF Keep § KEEP list; old skin app.js:2109; CARRY_FORWARD logger.js entry',
        was: 'slate.debug',
    },
    profileFoldersOpen: {
        layer: LAYERS.local, scope: SCOPES.device, status: STATUSES.v1,
        why: 'Which profile folders are expanded — display-only, per device. The old constant carried its prefix inside the logical key; here the router owns the prefix.',
        trace: 'SCOPE Part 6 follow-up: "PROFILE_FOLDER_PREF = \'slate.profileFoldersOpen\' follows the new storage-prefix scheme (A10 — keys are renamed, nothing migrates)"',
        was: 'slate.profileFoldersOpen',
    },
    scaleDeviceId: {
        layer: LAYERS.none, scope: SCOPES.external, status: STATUSES.retired,
        why: 'ReaPrime owns device pairing: GET /devices lists what is remembered and preferredScaleId names the choice. Nothing in this skin ever wrote this key.',
        trace: 'old skin api.js:605-618; ReaPrime devices_handler.dart; the connection pages, 26 Aug 2026',
        was: 'slate.scaleDeviceId',
        owner: 'ReaPrime — GET /api/v1/devices and preferredScaleId on /api/v1/settings',
    },
    dyeStripMode: {
        layer: LAYERS.local, scope: SCOPES.device, status: STATUSES.provisional,
        why: 'P/F/R strip display mode. Gated on Q6 — whether the DYE2 strip ships in v1 Live at all. Still open: the strip is a rendered surface and nothing has been built for it.',
        trace: 'SCOPE Part 9 Q6; old skin dyeStrip.js:25,:349,:429; Ben, 26 Aug 2026 (the leaf is deleted)',
        was: 'slate.dyeStripMode',
    },
    dye2Enabled: {
        layer: LAYERS.none, scope: SCOPES.external, status: STATUSES.retired,
        why: 'ReaPrime owns whether DYE2 runs: GET /api/v1/plugins reports loaded/autoLoad and the Plugins page\'s switch is the one control. A tablet copy would be two stores for one setting.',
        trace: 'SCOPE Part 9 Q6; old skin dyeStrip.js:29,:383; Ben, 26 Aug 2026 (the leaf and its switch deleted); Ben, 27 Aug 2026 ("have the button open the bean picker page for now")',
        was: 'slate.dye2Enabled',
        owner: 'ReaPrime\'s plugin loader — GET /api/v1/plugins and PUT /api/v1/plugins/{id}/enable, surfaced on Settings › Extensions › Plugins',
    },

    // --- sessionStorage — ephemeral, one visit.

    pendingAssignmentIndex: {
        layer: LAYERS.session, scope: SCOPES.ephemeral, status: STATUSES.v1,
        why: 'Which favourite slot the selector is filling. Dies with the tab by design.',
        trace: 'old skin profileManager.js:487,:677,:690 (favourites assignment ports — CARRY_FORWARD tests batch 2)',
        was: 'slate.pendingAssignmentIndex',
    },
    lastEditedProfileKey: {
        layer: LAYERS.session, scope: SCOPES.ephemeral, status: STATUSES.v1,
        why: 'Return path from the editor to the selector, within one visit.',
        trace: 'old skin profile_editor.js:3322,:3404',
        was: 'slate.lastEditedProfileKey',
    },

    steamStopMode: {
        layer: LAYERS.none, scope: SCOPES.external, status: STATUSES.retired,
        owner: 'ReaPrime — steamSettings.duration and steamSettings.stopAtTemperature on the workflow document (GET/PUT /api/v1/workflow). The mode is which of the two is positive; both zero is Off.',
        why: 'One value, one store. Both the Settings bank and the Live rail derive the mode from the machine\'s own fields; a stored word beside them was a second answer that could disagree, and did.',
        trace: 'SCOPE Part 3 §5; CAPABILITY_DIFF Keep § "lost on a tablet swap" list; old skin ui.js:696; '
            + 'settings-leaves.js machine-steam-stop (derivedFrom/whenNone); live-targets.js steamStopFrom; '
            + 'ReaPrime steam_sequencer.dart:134-140.',
        was: 'slate.steamStopMode, then KV decal.steamStopMode',
    },
    steamDuration: {
        layer: LAYERS.none, scope: SCOPES.external, status: STATUSES.retired,
        owner: 'ReaPrime — steamSettings.duration on the workflow document (PUT /api/v1/workflow, read on GET /api/v1/workflow).',
        why: 'One value, one store. The Live rail already read it from the workflow; a KV copy beside it was a second store for the same setting.',
        trace: "SCOPE Part 3 §5; old skin settings.js:3330 updateSteamSetting('duration'); "
            + 'workflow-targets.js SCALAR_FIELDS steamDuration; machine-fields-port.js WORKFLOW_FIELD_PATHS.',
        was: 'slate workflow.steamSettings.duration (PUT /api/v1/workflow), then KV decal.steamDuration',
    },
    steamTempWhenOn: {
        layer: LAYERS.kv, scope: SCOPES.machine, status: STATUSES.v1,
        why: 'The steam target to restore when the steam switch is turned back on. The machine holds 0 while steam is off, so the value to come back to cannot live there.',
        trace: 'Ben, 26 Aug 2026 (M-STEAM-0); settings-leaves.js machine-steam-enabled `zeroSwitch`; the same shape as cupWarmerTarget below.',
        was: 'nothing — the old skin made the user retype the temperature',
        leaf: 'machine-steam',
    },
    tankTempWhenOn: {
        layer: LAYERS.kv, scope: SCOPES.machine, status: STATUSES.v1,
        why: 'As steamTempWhenOn, for the tank heater.',
        trace: 'Ben, 26 Aug 2026 (M-TANK-0, M-TANK-29 "when on the default is 40 °C"); settings-leaves.js machine-water-tank-preheat `zeroSwitch`.',
        was: 'nothing',
        leaf: 'machine-water-tank',
    },
    hotWaterStopMode: {
        layer: LAYERS.none, scope: SCOPES.external, status: STATUSES.retired,
        owner: 'ReaPrime — stopHotWaterAtWeight on GET/POST /api/v1/settings, read by hot_water_sequencer.dart:106.',
        why: 'One value, one store. Both the Settings bank and the Live rail read and write ReaPrime\'s own boolean; a mode stored here reached the tablet and nothing else.',
        trace: 'old skin settings.js:4540-4560 (stopHotWaterAtWeightToggle, "Stop at weight" / '
            + '"Requires a connected scale", onchange updateReaSetting) and slate-live.css:554 '
            + '(the hidden Live toggle — L25); rea-routes.generated.js getSettings/postSettings '
            + 'carry the field; LAYOUT_SPEC_DRAFT §7.2 (L25); settings-leaves.js machine-water-stop '
            + '(fieldValues volume:false / weight:true); live-targets.js waterStopFrom.',
        was: 'rea settings stopHotWaterAtWeight (GET/POST /api/v1/settings; scale-gated boolean), then KV decal.hotWaterStopMode',
    },
    waterTankUnit: {
        layer: LAYERS.kv, scope: SCOPES.machine, status: STATUSES.v1,
        why: 'The tank display unit — SCOPE Part 3 §5 names it machine-scoped explicitly.',
        trace: 'SCOPE Part 3 §5; old skin waterTank.js:28',
        was: 'slate.waterTankUnit',
        leaf: 'machine-water-tank',
    },
    tempUnit: {
        layer: LAYERS.kv, scope: SCOPES.machine, status: STATUSES.v1,
        why: 'Same class as waterTankUnit: a display unit for machine readings, shared across clients. ONE store — the dual-write was the proven silent-revert bug.',
        trace: 'SCOPE Part 3 §5 (dual-write is a proven bug); CAPDIFF_CONSISTENCY row 9 splits it into one defect (fixed here) + one open product call (U7 — where it lives). OPEN: U7 may yet make this device-scoped; flipping the row to layer local is a one-line change and no call site moves.',
        was: 'slate tempUnit (localStorage AND the IDB settings store)',
        leaf: 'units-language-units',
    },
    cupWarmerTarget: {
        layer: LAYERS.kv, scope: SCOPES.machine, status: STATUSES.v1,
        why: 'The remembered mat target used when the warmer is re-enabled; the machine holds only the live value (0 when off). It describes the machine, so it survives a tablet swap.',
        trace: 'CARRY_FORWARD §I lists `cupWarmerTarget` among the hard-coded keys to re-address; old skin cup-warmer.js:27, app.js:1713',
        was: 'slate.cupWarmerTarget',
        leaf: 'accessories-cup-warmer',
        capability: 'cupWarmer',
    },
    lastBrightness: {
        layer: LAYERS.kv, scope: SCOPES.machine, status: STATUSES.v1,
        why: 'The only LAST_VALUE key that survives: ReaPrime persists no brightness (settings_handler.dart:20-67 has only lowBatteryBrightnessLimit).',
        trace: 'CARRY_FORWARD api.js entry: "Only the BRIGHTNESS key survives"; old skin api.js:1201,:2081,:2097 (IDB settings store today)',
        was: 'last-brightness (IDB settings store)',
        leaf: 'display-screen',
    },
    favouriteProfiles: {
        layer: LAYERS.kv, scope: SCOPES.machine, status: STATUSES.v1,
        why: 'Already KV-primary and correct there; the defect was the KV+IDB dual-write, which this row removes by construction.',
        trace: 'SCOPE Part 3 §5 ("Favourites are already KV-primary; their defect is the dual-write"); old skin profileManager.js:198-216',
        was: 'favorite-profiles (KV namespace `slate`, mirrored into IDB)',
    },
    loadedProfileId: {
        layer: LAYERS.kv, scope: SCOPES.machine, status: STATUSES.v1,
        why: 'WHICH RECORD the machine is running, remembered at the moment this skin armed '
            + 'it. ReaPrime\'s workflow carries the profile itself and NOT the record id, so '
            + 'the only way back to the record is the title — and eleven profiles on the bench '
            + 'machine share the title "Extractamundo Dos!". R1 reports that as ambiguous and '
            + 'refuses to guess, which is right and leaves the loaded-profile highlight blank '
            + 'and the Edit-profile button with nothing to open. This row is the fact the skin '
            + 'already had and threw away.',
        trace: 'old skin profileManager.js:1457 (activeProfileId, re-synced on load) and :562; '
            + 'Decal adapters-r.js r1LoadedProfileId, R1_UNRESOLVED.AMBIGUOUS',
        was: 'not stored at all — the old skin held it in memory and lost it on every reload',
    },
    favouriteProfilesSeeded: {
        layer: LAYERS.kv, scope: SCOPES.machine, status: STATUSES.v1,
        why: 'The once-only seed flag for the favourite slots. Machine-scoped like the slots it guards.',
        trace: 'old skin profileManager.js:52 FAVORITES_INITIALIZED_KEY (IDB settings store)',
        was: 'favorite-profiles-initialized (IDB settings store)',
    },
    steamTimePresets: {
        layer: LAYERS.kv, scope: SCOPES.machine, status: STATUSES.v1,
        why: 'A user-edited bank describing how this machine is driven. In the IDB settings store today — the fourth layer with no policy.',
        trace: 'old skin ui.js:79,:996-1007 via setSetting/getSetting (IDB)',
        was: 'steam-time-presets-user (IDB settings store)',
    },
    steamFlowPresets: {
        layer: LAYERS.kv, scope: SCOPES.machine, status: STATUSES.v1,
        why: 'As steamTimePresets.',
        trace: 'old skin ui.js:84,:955,:1186-1198 (IDB)',
        was: 'steam-flow-presets-user (IDB settings store)',
    },
    steamFlowPresetIndex: {
        layer: LAYERS.kv, scope: SCOPES.machine, status: STATUSES.v1,
        why: 'Which steam-flow preset is armed on this machine.',
        trace: 'old skin ui.js:86 (IDB)',
        was: 'steam-flow-preset-selected-index (IDB settings store)',
    },
    steamFlowPresetsModel: {
        layer: LAYERS.kv, scope: SCOPES.machine, status: STATUSES.v1,
        why: 'The machine model the steam-flow bank was authored against.',
        trace: 'old skin ui.js:87 (IDB)',
        was: 'steam-flow-presets-model (IDB settings store)',
    },
    milkStopPresets: {
        layer: LAYERS.kv, scope: SCOPES.machine, status: STATUSES.v1,
        why: 'As steamTimePresets.',
        trace: 'old skin ui.js:85,:974-983 (IDB)',
        was: 'milk-stop-presets-user (IDB settings store)',
    },
    flushPresets: {
        layer: LAYERS.kv, scope: SCOPES.machine, status: STATUSES.v1,
        why: 'As steamTimePresets.',
        trace: 'old skin ui.js:1019,:1024-1033 (IDB)',
        was: 'flush-presets-user (IDB settings store)',
        leaf: 'machine-flush',
    },
    brewTempPresets: {
        layer: LAYERS.kv, scope: SCOPES.machine, status: STATUSES.v1,
        why: 'As steamTimePresets.',
        trace: 'old skin ui.js:1049,:1063-1072 (IDB)',
        was: 'brew-temp-presets-user (IDB settings store)',
    },
    drinkOutPresets: {
        layer: LAYERS.kv, scope: SCOPES.machine, status: STATUSES.v1,
        why: 'As steamTimePresets.',
        trace: 'old skin ui.js:1086,:1091-1100 (IDB)',
        was: 'drink-out-presets-user (IDB settings store)',
    },
    hotWaterTempPresets: {
        layer: LAYERS.kv, scope: SCOPES.machine, status: STATUSES.v1,
        why: 'As steamTimePresets.',
        trace: 'old skin ui.js:1117,:1122-1132 (IDB)',
        was: 'hot-water-temp-presets-user (IDB settings store)',
        leaf: 'machine-hot-water',
    },
    hotWaterVolPresets: {
        layer: LAYERS.kv, scope: SCOPES.machine, status: STATUSES.v1,
        why: 'As steamTimePresets.',
        trace: 'old skin ui.js:1118 (IDB)',
        was: 'hot-water-vol-presets-user (IDB settings store)',
        leaf: 'machine-hot-water',
    },
    experimentalFusedChannels: {
        layer: LAYERS.kv, scope: SCOPES.machine, status: STATUSES.provisional,
        why: 'Machine-scoped by SCOPE Part 3 §5. No v1 reader — D1 keeps the derived/fused channels out of the baseline — but the row fixes the layer now so the feature cannot land in the wrong store later.',
        trace: 'SCOPE Part 3 §5 ("the experimental-channel flags"); D1; old skin history-viewer.js:106',
        was: 'slate.experimental-fused-channels',
        leaf: 'machine-advanced',
    },
    experimentalCollapseDetection: {
        layer: LAYERS.kv, scope: SCOPES.machine, status: STATUSES.provisional,
        why: 'As experimentalFusedChannels.',
        trace: 'SCOPE Part 3 §5; D1; old skin history-viewer.js:107, history.js:315',
        was: 'slate.experimental-collapse-detection',
        leaf: 'machine-advanced',
    },

    // --- ReaPrime KV, numpad namespace. A family of keys, one per numeric field.

    numpadRecents: {
        layer: LAYERS.kvNumpad, scope: SCOPES.machine, status: STATUSES.v1,
        template: 'previous-values-{field}',
        why: 'Recently entered values per numeric field. Already KV-only in the old skin — the one place that got B7 right — and kept in its own namespace so a bulk settings read does not drag the recents list along.',
        trace: 'old skin numpad-modal.js:33,:45 with NUMPAD_REA_STORE_NAMESPACE',
        was: 'previous-values-<fieldType> (KV namespace `slate.numpad`)',
    },

    shotRating: {
        layer: LAYERS.none, scope: SCOPES.external, status: STATUSES.retired,
        owner: 'ReaPrime — ShotAnnotations.enjoyment, written by PUT /api/v1/shots/<id> (deep-merging handler). An annotation lives and dies with its shot.',
        why: 'Shot-scoped data never goes to KV: `rating:<shotId>` keys orphan forever when the shot is deleted, are invisible to other clients and to export.',
        trace: 'SCOPE Part 3 §5, final paragraph; CAPABILITY_DIFF live-contract-bug entry on shot-rating.js:16-18',
        was: 'rating:<shotId> (KV namespace `slate`)',
    },
    waterRefillLevel: {
        layer: LAYERS.none, scope: SCOPES.external, status: STATUSES.retired,
        owner: 'ReaPrime — refillLevel on the machine water levels (POST /api/v1/machine/waterLevels, read back on /ws/v1/machine/waterLevels).',
        why: 'The localStorage mirror sat one line below the file\'s own comment that "REA is the source of truth". It does not port.',
        trace: 'SCOPE Part 3 §5 ("that mirror is the §2 waterLevels row\'s does not port"); old skin waterTank.js:126-131',
        was: 'slate.waterRefillLevel',
    },
    visualizerUsername: {
        layer: LAYERS.none, scope: SCOPES.external, status: STATUSES.retired,
        owner: 'The visualizer.reaplugin plugin settings (GET/PUT /api/v1/plugins/visualizer.reaplugin/settings).',
        why: 'The plugin does the uploading and already stores the credential; the skin copy existed only to pre-fill a form. localStorage is origin-scoped, so every skin on :3000 could read it, and btoa is not encryption.',
        trace: 'CAPABILITY_DIFF visualizer-credentials entry (ui.js:3226-3227, app.js:1848-1882)',
        was: 'slate.visualizerUsername',
    },
    visualizerPassword: {
        layer: LAYERS.none, scope: SCOPES.external, status: STATUSES.retired,
        owner: 'The visualizer.reaplugin plugin settings.',
        why: 'As visualizerUsername. A btoa\'d password in a shared origin is not storage, it is exposure.',
        trace: 'CAPABILITY_DIFF visualizer-credentials entry',
        was: 'slate.visualizerPassword',
    },
    visualizerEnabled: {
        layer: LAYERS.none, scope: SCOPES.external, status: STATUSES.retired,
        owner: 'The visualizer.reaplugin plugin settings.',
        why: 'Read twice and written nowhere in the old skin — the upload-confirmation poll behind it was dead for that reason.',
        trace: 'CAPDIFF_CONSISTENCY §3.2 (verdict: delete the 40 lines, do not carry them forward)',
        was: 'slate.visualizerEnabled',
    },
    visualizerAutoUpload: {
        layer: LAYERS.none, scope: SCOPES.external, status: STATUSES.retired,
        owner: 'The visualizer.reaplugin plugin settings (AutoUpload), read with Username from the plugin.',
        why: 'The capability diff lists it both as a machine-scoped mover and as a key to delete in favour of the plugin settings; SCOPE Part 3 §5\'s mover list names only steam stop mode, tank unit and the experimental flags, so the plugin wins. OPEN: if the plugin turns out not to expose AutoUpload, this becomes a KV row — one row, no call site moves.',
        trace: 'SCOPE Part 3 §5 mover list; CAPABILITY_DIFF visualizer-credentials entry',
        was: 'slate.visualizerAutoUpload',
    },
    uiZoom: {
        layer: LAYERS.none, scope: SCOPES.external, status: STATUSES.retired,
        owner: 'Nothing — the canvas transform it multiplied is gone. `density` (C6) is the replacement control.',
        why: 'The fixed 1920x1200 canvas and its scaling module die with the rewrite (E8, S9).',
        trace: 'SCOPE Part 8 §2 Gate B change 1; Part 5 §4 C6',
        was: 'slate.uiZoom',
    },
    maxStretch: {
        layer: LAYERS.none, scope: SCOPES.external, status: STATUSES.retired,
        owner: 'Nothing — same reason as uiZoom.',
        why: 'A knob on the canvas fit, which no longer exists.',
        trace: 'SCOPE Part 8 §2 Gate B change 1; old skin scaling.js:132',
        was: 'slate.maxStretch',
    },
    rotationPromptDismissed: {
        layer: LAYERS.none, scope: SCOPES.external, status: STATUSES.retired,
        owner: 'Nothing — landscape only, no portrait layout, so there is no rotation prompt.',
        why: 'DECIDED: "Landscape only. No portrait layout."',
        trace: 'DECISIONS.md "Landscape only"; old skin scaling.js:32,:82',
        was: 'slate.rotationPromptDismissed',
    },
    fullscreenPromptDismissed: {
        layer: LAYERS.none, scope: SCOPES.external, status: STATUSES.retired,
        owner: 'Nothing — the prompt machinery lives in the dropped scaling/app boot path.',
        why: 'Ships in a WebView; the desktop fullscreen nag goes with the canvas.',
        trace: 'old skin app.js:2209-2250; SCOPE Part 8 §2 Gate B change 1',
        was: 'slate.fullscreenPromptDismissed',
    },
    helpHidden: {
        layer: LAYERS.none, scope: SCOPES.external, status: STATUSES.retired,
        owner: 'Nothing. The floating help button it hid does not exist in this skin.',
        why: 'Ben, 26 Aug 2026: "Decal has no help button or overlay, so the toggle goes." A stored '
            + 'preference whose only effect was on a control this skin never built is a finished half '
            + 'with no other half, and its switch was deleted with it.',
        trace: 'old skin helpOverlay.js:178 HIDE_KEY, read by helpHidden() at :185-189; the toggle was '
            + 'settings.js:1962-1969 (initQuickstartGuideSettings)',
        was: 'slate.helpHidden',
    },
    helpLaunches: {
        layer: LAYERS.none, scope: SCOPES.external, status: STATUSES.retired,
        owner: 'Nothing. It was the counter behind `helpHidden`\'s default.',
        why: 'The default ladder it fed ("hide from the third startup on") belongs to a button that is not here.',
        trace: 'old skin helpOverlay.js:179 LAUNCH_KEY',
        was: 'slate.helpLaunches',
    },
    blackScreenSaver: {
        layer: LAYERS.none, scope: SCOPES.external, status: STATUSES.retired,
        owner: 'The `screensaverType` row above, which carries the same question with three answers.',
        why: 'A two-state toggle between black and not-black cannot express three kinds of saver. The '
            + 'question survives; the boolean does not.',
        trace: 'DECISIONS D10, reversed by Ben on 26 Aug 2026; old skin api.js:2019-2023',
        was: 'slate.blackScreenSaver',
    },
    screensaverClock: {
        layer: LAYERS.none, scope: SCOPES.external, status: STATUSES.retired,
        owner: 'The `screensaverType` row, whose `clock` value is this setting.',
        why: 'It was a switch over the blank, added when black-plus-a-clock were the only two states. '
            + 'With three, two switches have an unreachable combination and no name for what is showing.',
        trace: 'Ben, 24 Aug 2026 (added) and 26 Aug 2026 (folded into the type)',
        was: null,
    },
    /* `screensaverImages` WAS HERE AND IS LIVE AGAIN — see the row in the local half.
     * D10's "a black saver has no image list" was true while black was the only saver. */
    screensaverCycleSeconds: {
        layer: LAYERS.none, scope: SCOPES.external, status: STATUSES.retired,
        owner: 'The `screensaverCycleMinutes` row above.',
        why: 'Slate counted the cycle in seconds (2-600). Ben set the control to 1-10 MINUTES, which '
            + 'is a different band answering a different question — a saver, not a slideshow. Reusing '
            + 'the key would leave a stored 10 meaning ten seconds on one read and ten minutes on the '
            + 'next, which is the silent-revert class in miniature.',
        trace: 'Ben, 26 Aug 2026; old skin settings.js:112 (screensaver-cycle-seconds, 2-600 s)',
        was: 'slate.screensaverCycleSeconds',
    },
    steamStopModeFallback: {
        layer: LAYERS.none, scope: SCOPES.external, status: STATUSES.retired,
        owner: 'The single `steamStopMode` row above.',
        why: 'The old skin READ `steamStopModeFallback` (ui.js:688) and WROTE `steamStopMode` (ui.js:696) — two names for one setting, which is the whole argument for a routing table.',
        trace: 'old skin ui.js:688,:696',
        was: 'slate.steamStopModeFallback',
    },
    availableProfilesCache: {
        layer: LAYERS.none, scope: SCOPES.external, status: STATUSES.retired,
        owner: 'Nothing — GET /api/v1/profiles is served from the same origin as the skin.',
        why: 'Wrote ~70 full profile records to IDB after every load, with the only read inside an API catch block — a state that cannot occur.',
        trace: 'CARRY_FORWARD profileManager.js entry; old skin profileManager.js:56,:36,:147,:156',
        was: 'available-profiles-cache (IDB settings store)',
    },
    settingsRea: {
        layer: LAYERS.none, scope: SCOPES.external, status: STATUSES.retired,
        owner: 'The data layer\'s in-memory settings caches (Gate 3), and ReaPrime itself — GET /api/v1/settings assembles 22 in-memory scalars with no I/O.',
        why: 'A persisted mirror of a free read buys nothing and costs staleness.',
        trace: 'CARRY_FORWARD api.js entry (delete `reatsettingscache`); old skin IDB key `settings-rea`',
        was: 'settings-rea (IDB settings store)',
    },
    settingsDe1: {
        layer: LAYERS.none, scope: SCOPES.external, status: STATUSES.retired,
        owner: 'The data layer\'s in-memory de1Settings cache (60 s, write-through invalidated).',
        why: 'Kept in memory where its lifetime is visible, not persisted where it outlives its truth.',
        trace: 'CARRY_FORWARD api.js entry (keep de1SettingsCache / de1AdvancedSettingsCache, in memory)',
        was: 'settings-de1 (IDB settings store)',
    },
    settingsDe1Advanced: {
        layer: LAYERS.none, scope: SCOPES.external, status: STATUSES.retired,
        owner: 'The data layer\'s in-memory de1AdvancedSettings cache (40 s).',
        why: 'As settingsDe1.',
        trace: 'CARRY_FORWARD api.js entry',
        was: 'settings-de1Advanced (IDB settings store)',
    },
    settingsBackup: {
        layer: LAYERS.none, scope: SCOPES.external, status: STATUSES.retired,
        owner: 'ReaPrime — GET /api/v1/data/export owns backup and restore.',
        why: 'A skin-local backup blob is a second source of truth for the thing ReaPrime exports.',
        trace: 'SCOPE Part 3 §5 (the KV namespace-enumeration caveat is ReaPrime-side, "not worked around in the skin")',
        was: 'settingsBackup (IDB settings store)',
    },
    shotHistoryMirror: {
        layer: LAYERS.none, scope: SCOPES.external, status: STATUSES.retired,
        owner: 'ReaPrime — GET /api/v1/shots (paginated, ETag-conditional) and GET /api/v1/shots/<id>. Any local cache is the `idb.js` successor\'s business (Gate 6) and only ships if it measures out.',
        why: 'Not a setting. The old mirror grew forever with no eviction, and nothing measured its benefit.',
        trace: 'DECISIONS "KEEP caching only where it measurably pays… measure it, do not assume it"; CAPABILITY_DIFF getAllShots entry',
        was: 'IDB `shots` object store',
    },
    dye2AutoFavourites: {
        layer: LAYERS.none, scope: SCOPES.external, status: STATUSES.retired,
        owner: 'The DYE2 plugin — KV namespace `dye2.reaplugin`, READ-ONLY to this skin (dye2-plugin/KV_CONTRACT.md).',
        why: 'Another product\'s namespace. The router owns `decal` and `decal.numpad`, nothing else; DYE2 reads go through the data layer as reads.',
        trace: 'old skin api.js DYE2_KV_NAMESPACE comment ("never write these keys"); dyeStrip.js:23,:52',
        was: 'autoFavourites (KV namespace `dye2.reaplugin`)',
    },
    dye2Recipes: {
        layer: LAYERS.none, scope: SCOPES.external, status: STATUSES.retired,
        owner: 'The DYE2 plugin — KV namespace `dye2.reaplugin`, read-only.',
        why: 'As dye2AutoFavourites.',
        trace: 'old skin dyeStrip.js:24,:53',
        was: 'recipes (KV namespace `dye2.reaplugin`)',
    },
    lastSteamDuration: {
        layer: LAYERS.none, scope: SCOPES.external, status: STATUSES.retired,
        owner: 'ReaPrime — De1Controller._setDe1DefaultsFor re-pushes the current workflow\'s steam settings on every connect.',
        why: 'Compensation for something ReaPrime already does.',
        trace: 'CARRY_FORWARD api.js entry ("resyncIfDrifted and four of its five LAST_VALUE keys"); de1_controller.dart:253, main.dart:330-332',
        was: 'last-steam-duration (IDB settings store)',
    },
    lastSteamFlow: {
        layer: LAYERS.none, scope: SCOPES.external, status: STATUSES.retired,
        owner: 'ReaPrime — as lastSteamDuration.',
        why: 'As lastSteamDuration.',
        trace: 'CARRY_FORWARD api.js entry',
        was: 'last-steam-flow (IDB settings store)',
    },
    lastFlushDuration: {
        layer: LAYERS.none, scope: SCOPES.external, status: STATUSES.retired,
        owner: 'ReaPrime — as lastSteamDuration.',
        why: 'As lastSteamDuration.',
        trace: 'CARRY_FORWARD api.js entry',
        was: 'last-flush-duration (IDB settings store)',
    },
    lastHotWaterVolume: {
        layer: LAYERS.none, scope: SCOPES.external, status: STATUSES.retired,
        owner: 'ReaPrime — as lastSteamDuration.',
        why: 'As lastSteamDuration.',
        trace: 'CARRY_FORWARD api.js entry',
        was: 'last-hot-water-volume (IDB settings store)',
    },
    lastHotWaterTemp: {
        layer: LAYERS.none, scope: SCOPES.external, status: STATUSES.retired,
        owner: 'ReaPrime — as lastSteamDuration.',
        why: 'As lastSteamDuration.',
        trace: 'CARRY_FORWARD api.js entry',
        was: 'last-hot-water-temp (IDB settings store)',
    },
});

/** Layers that carry a physical prefix (browser storage). KV identity is the namespace. */
export const PREFIXED_LAYERS = Object.freeze([LAYERS.local, LAYERS.session]);

/** KV namespace per KV layer — the router hands these to its backends' owners, not to keys. */
export const KV_NAMESPACES = Object.freeze({
    [LAYERS.kv]: KV_NAMESPACE,
    [LAYERS.kvNumpad]: KV_NUMPAD_NAMESPACE,
});

/**
 * Look a key up. Returns the frozen row, or undefined when the key has no row —
 * which is always a bug, never a fallback. The router turns that into a thrown error.
 */
export function routeFor(key, routes = STORAGE_ROUTES) {
    if (typeof key !== 'string' || key.length === 0) return undefined;
    return Object.prototype.hasOwnProperty.call(routes, key) ? routes[key] : undefined;
}

/** Every logical key in the table, sorted — for diagnostics and for the row-wise tests. */
export function allKeys(routes = STORAGE_ROUTES) {
    return Object.keys(routes).sort();
}

export function settingsKeys(routes = STORAGE_ROUTES) {
    return allKeys(routes).filter((key) => Boolean(routes[key].leaf) && routes[key].layer !== LAYERS.none);
}

/** The settings leaves that own at least one persisted key, sorted. */
export function settingsLeaves(routes = STORAGE_ROUTES) {
    return [...new Set(settingsKeys(routes).map((key) => routes[key].leaf))].sort();
}

/** Every settings key one leaf owns, sorted. Unknown leaf -> empty, never a throw. */
export function keysForLeaf(leaf, routes = STORAGE_ROUTES) {
    return settingsKeys(routes).filter((key) => routes[key].leaf === leaf);
}

export function gatedSettingsKeys(routes = STORAGE_ROUTES) {
    const byCapability = new Map();
    for (const key of settingsKeys(routes)) {
        const { capability } = routes[key];
        if (!capability) continue;
        if (!byCapability.has(capability)) byCapability.set(capability, []);
        byCapability.get(capability).push(key);
    }
    return byCapability;
}

/**
 * Fill a row's `{param}` placeholders. Data-only rows plus one interpolation function
 * keeps the table declarative — no per-key code anywhere.
 */
export function expandTemplate(template, params = {}) {
    return template.replace(/\{(\w+)\}/g, (_match, name) => {
        const value = params[name];
        if (value === undefined || value === null || value === '') {
            throw new Error(`storage: missing template parameter '${name}'`);
        }
        return String(value);
    });
}

function deepFreeze(value) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
        Object.freeze(value);
        for (const inner of Object.values(value)) deepFreeze(inner);
    }
    return value;
}
