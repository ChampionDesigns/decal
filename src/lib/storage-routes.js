

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

/** Row status. A `provisional` row is gated on a question that is still open. */
export const STATUSES = Object.freeze({
    v1: 'v1',
    provisional: 'provisional',
    retired: 'retired',
});

export const STORAGE_ROUTES = deepFreeze({

    theme: {
        layer: LAYERS.local, scope: SCOPES.device, status: STATUSES.v1,
        why: 'Describes this display. The pre-paint stamp in index.html reads the physical key directly — the one hand-written copy of the prefix in the tree.',
        leaf: 'display-skin',
    },
    density: {
        layer: LAYERS.local, scope: SCOPES.device, status: STATUSES.v1,
        why: 'A density / type-scale control replaces Display Size. A property of this screen, not of the machine. STORES THE BASE, NEVER THE COMPOSED VALUE: --ui-density has three writers and one composition — the preference sets the BASE, the height band MULTIPLIES it (x1 regular, x0.875 under 700px) so a user choice survives a short window, and the named compact density is a container-scoped re-declaration that composes with neither. Persisting the composed number would make a choice made on a short window permanent, which is the same class of defect as the dual write: a value the user did not choose, stored as though they had.',
        leaf: 'display-screen',
    },
    language: {
        layer: LAYERS.local, scope: SCOPES.device, status: STATUSES.v1,
        why: 'Who is reading this tablet. Dual-written today (localStorage AND the IDB settings store) — one owner now.',
        leaf: 'units-language-select-language',
    },
    keyboardBindings: {
        layer: LAYERS.local, scope: SCOPES.device, status: STATUSES.v1,
        why: 'Bindings belong to whatever keyboard is attached to this device.',
        leaf: 'help-keyboard-shortcuts',
    },
    wakeLockEnabled: {
        layer: LAYERS.local, scope: SCOPES.device, status: STATUSES.v1,
        why: 'A browser/WebView capability of this device.',
        leaf: 'display-screen',
    },
    screensaverEnabled: {
        layer: LAYERS.local, scope: SCOPES.device, status: STATUSES.v1,
        why: 'This display sleeps, not the machine.',
        leaf: 'display-screen-saver',
    },
    clockFormat: {
        layer: LAYERS.local, scope: SCOPES.device, status: STATUSES.v1,
        why: 'How a time is written, everywhere this skin writes one. DEVICE-scoped rather '
            + 'than machine-scoped because it is a reading preference of whoever is looking '
            + 'at this tablet, not a fact about the machine — the same reason the language '
            + 'row beside it is.',
        leaf: 'units-language-units',
    },
    screensaverType: {
        layer: LAYERS.local, scope: SCOPES.device, status: STATUSES.v1,
        why: 'What the screen shows while the machine sleeps. A property of this display.',
        leaf: 'display-screen-saver',
    },
    screensaverCycleMinutes: {
        layer: LAYERS.local, scope: SCOPES.device, status: STATUSES.v1,
        why: 'Same reason as screensaverEnabled.',
        leaf: 'display-screen-saver',
    },
    screensaverImages: {
        layer: LAYERS.local, scope: SCOPES.device, status: STATUSES.v1,
        why: 'The pictures the saver cycles, as data URLs. Chosen on this tablet, held on this tablet.',
        leaf: 'display-screen-saver',
    },
    reaHostname: {
        layer: LAYERS.local, scope: SCOPES.device, status: STATUSES.v1,
        why: 'Which ReaPrime this browser talks to. Cannot live in the store it addresses.',
        leaf: 'connection-machine',
    },
    debug: {
        layer: LAYERS.local, scope: SCOPES.device, status: STATUSES.v1,
        why: 'Drives the logger level on this device. Read once at boot by the composition root, which then calls logger.setLevel — the logger does not read storage itself (no import cycle).',
    },
    profileFoldersOpen: {
        layer: LAYERS.local, scope: SCOPES.device, status: STATUSES.v1,
        why: 'Which profile folders are expanded — display-only, per device. The old constant carried its prefix inside the logical key; here the router owns the prefix.',
    },
    scaleDeviceId: {
        layer: LAYERS.none, scope: SCOPES.external, status: STATUSES.retired,
        why: 'ReaPrime owns device pairing: GET /devices lists what is remembered and preferredScaleId names the choice. Nothing in this skin ever wrote this key.',
        owner: 'ReaPrime — GET /api/v1/devices and preferredScaleId on /api/v1/settings',
    },
    dyeStripMode: {
        layer: LAYERS.local, scope: SCOPES.device, status: STATUSES.provisional,
        why: 'P/F/R strip display mode. Gated on whether the DYE2 strip ships in v1 Live at all. Still open: the strip is a rendered surface and nothing has been built for it.',
    },
    dye2Enabled: {
        layer: LAYERS.none, scope: SCOPES.external, status: STATUSES.retired,
        why: 'ReaPrime owns whether DYE2 runs: GET /api/v1/plugins reports loaded/autoLoad and the Plugins page\'s switch is the one control. A tablet copy would be two stores for one setting.',
        owner: 'ReaPrime\'s plugin loader — GET /api/v1/plugins and PUT /api/v1/plugins/{id}/enable, surfaced on Settings › Extensions › Plugins',
    },

    // --- sessionStorage — ephemeral, one visit.

    pendingAssignmentIndex: {
        layer: LAYERS.session, scope: SCOPES.ephemeral, status: STATUSES.v1,
        why: 'Which favourite slot the selector is filling. Dies with the tab by design.',
    },
    lastEditedProfileKey: {
        layer: LAYERS.session, scope: SCOPES.ephemeral, status: STATUSES.v1,
        why: 'Return path from the editor to the selector, within one visit.',
    },

    steamStopMode: {
        layer: LAYERS.none, scope: SCOPES.external, status: STATUSES.retired,
        owner: 'ReaPrime — steamSettings.duration and steamSettings.stopAtTemperature on the workflow document (GET/PUT /api/v1/workflow). The mode is which of the two is positive; both zero is Off.',
        why: 'One value, one store. Both the Settings bank and the Live rail derive the mode from the machine\'s own fields; a stored word beside them was a second answer that could disagree, and did.',
    },
    steamDuration: {
        layer: LAYERS.none, scope: SCOPES.external, status: STATUSES.retired,
        owner: 'ReaPrime — steamSettings.duration on the workflow document (PUT /api/v1/workflow, read on GET /api/v1/workflow).',
        why: 'One value, one store. The Live rail already read it from the workflow; a KV copy beside it was a second store for the same setting.',
    },
    steamTempWhenOn: {
        layer: LAYERS.kv, scope: SCOPES.machine, status: STATUSES.v1,
        why: 'The steam target to restore when the steam switch is turned back on. The machine holds 0 while steam is off, so the value to come back to cannot live there.',
        leaf: 'machine-steam',
    },
    tankTempWhenOn: {
        layer: LAYERS.kv, scope: SCOPES.machine, status: STATUSES.v1,
        why: 'As steamTempWhenOn, for the tank heater.',
        leaf: 'machine-water-tank',
    },
    hotWaterStopMode: {
        layer: LAYERS.none, scope: SCOPES.external, status: STATUSES.retired,
        owner: 'ReaPrime — stopHotWaterAtWeight on GET/POST /api/v1/settings, read by hot_water_sequencer.dart:106.',
        why: 'One value, one store. Both the Settings bank and the Live rail read and write ReaPrime\'s own boolean; a mode stored here reached the tablet and nothing else.',
    },
    waterTankUnit: {
        layer: LAYERS.kv, scope: SCOPES.machine, status: STATUSES.v1,
        why: 'The tank display unit. Machine-scoped: it describes the machine, not the tablet.',
        leaf: 'machine-water-tank',
    },
    tempUnit: {
        layer: LAYERS.kv, scope: SCOPES.machine, status: STATUSES.v1,
        why: 'Same class as waterTankUnit: a display unit for machine readings, shared across clients. ONE store — the dual-write was the proven silent-revert bug.',
        leaf: 'units-language-units',
    },
    cupWarmerTarget: {
        layer: LAYERS.kv, scope: SCOPES.machine, status: STATUSES.v1,
        why: 'The remembered mat target used when the warmer is re-enabled; the machine holds only the live value (0 when off). It describes the machine, so it survives a tablet swap.',
        leaf: 'accessories-cup-warmer',
        capability: 'cupWarmer',
    },
    lastBrightness: {
        layer: LAYERS.kv, scope: SCOPES.machine, status: STATUSES.v1,
        why: 'The only LAST_VALUE key that survives: ReaPrime persists no brightness (settings_handler.dart:20-67 has only lowBatteryBrightnessLimit).',
        leaf: 'display-screen',
    },
    favouriteProfiles: {
        layer: LAYERS.kv, scope: SCOPES.machine, status: STATUSES.v1,
        why: 'Already KV-primary and correct there; the defect was the KV+IDB dual-write, which this row removes by construction.',
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
    },
    favouriteProfilesSeeded: {
        layer: LAYERS.kv, scope: SCOPES.machine, status: STATUSES.v1,
        why: 'The once-only seed flag for the favourite slots. Machine-scoped like the slots it guards.',
    },
    steamTimePresets: {
        layer: LAYERS.kv, scope: SCOPES.machine, status: STATUSES.v1,
        why: 'A user-edited bank describing how this machine is driven. In the IDB settings store today — the fourth layer with no policy.',
    },
    steamFlowPresets: {
        layer: LAYERS.kv, scope: SCOPES.machine, status: STATUSES.v1,
        why: 'As steamTimePresets.',
    },
    steamFlowPresetIndex: {
        layer: LAYERS.kv, scope: SCOPES.machine, status: STATUSES.v1,
        why: 'Which steam-flow preset is armed on this machine.',
    },
    steamFlowPresetsModel: {
        layer: LAYERS.kv, scope: SCOPES.machine, status: STATUSES.v1,
        why: 'The machine model the steam-flow bank was authored against.',
    },
    milkStopPresets: {
        layer: LAYERS.kv, scope: SCOPES.machine, status: STATUSES.v1,
        why: 'As steamTimePresets.',
    },
    flushPresets: {
        layer: LAYERS.kv, scope: SCOPES.machine, status: STATUSES.v1,
        why: 'As steamTimePresets.',
        leaf: 'machine-flush',
    },
    brewTempPresets: {
        layer: LAYERS.kv, scope: SCOPES.machine, status: STATUSES.v1,
        why: 'As steamTimePresets.',
    },
    drinkOutPresets: {
        layer: LAYERS.kv, scope: SCOPES.machine, status: STATUSES.v1,
        why: 'As steamTimePresets.',
    },
    hotWaterTempPresets: {
        layer: LAYERS.kv, scope: SCOPES.machine, status: STATUSES.v1,
        why: 'As steamTimePresets.',
        leaf: 'machine-hot-water',
    },
    hotWaterVolPresets: {
        layer: LAYERS.kv, scope: SCOPES.machine, status: STATUSES.v1,
        why: 'As steamTimePresets.',
        leaf: 'machine-hot-water',
    },
    experimentalFusedChannels: {
        layer: LAYERS.kv, scope: SCOPES.machine, status: STATUSES.provisional,
        why: 'Machine-scoped. No v1 reader, because the derived/fused channels stay out of the baseline — but the row fixes the layer now so the feature cannot land in the wrong store later.',
        leaf: 'machine-advanced',
    },
    experimentalCollapseDetection: {
        layer: LAYERS.kv, scope: SCOPES.machine, status: STATUSES.provisional,
        why: 'As experimentalFusedChannels.',
        leaf: 'machine-advanced',
    },

    // --- ReaPrime KV, numpad namespace. A family of keys, one per numeric field.

    numpadRecents: {
        layer: LAYERS.kvNumpad, scope: SCOPES.machine, status: STATUSES.v1,
        template: 'previous-values-{field}',
        why: 'Recently entered values per numeric field. Already KV-only in the old skin — the one place that got right — and kept in its own namespace so a bulk settings read does not drag the recents list along.',
    },

    shotRating: {
        layer: LAYERS.none, scope: SCOPES.external, status: STATUSES.retired,
        owner: 'ReaPrime — ShotAnnotations.enjoyment, written by PUT /api/v1/shots/<id> (deep-merging handler). An annotation lives and dies with its shot.',
        why: 'Shot-scoped data never goes to KV: `rating:<shotId>` keys orphan forever when the shot is deleted, are invisible to other clients and to export.',
    },
    waterRefillLevel: {
        layer: LAYERS.none, scope: SCOPES.external, status: STATUSES.retired,
        owner: 'ReaPrime — refillLevel on the machine water levels (POST /api/v1/machine/waterLevels, read back on /ws/v1/machine/waterLevels).',
        why: 'The localStorage mirror sat one line below the file\'s own comment that "REA is the source of truth". It does not port.',
    },
    visualizerUsername: {
        layer: LAYERS.none, scope: SCOPES.external, status: STATUSES.retired,
        owner: 'The visualizer.reaplugin plugin settings (GET/PUT /api/v1/plugins/visualizer.reaplugin/settings).',
        why: 'The plugin does the uploading and already stores the credential; the skin copy existed only to pre-fill a form. localStorage is origin-scoped, so every skin on :3000 could read it, and btoa is not encryption.',
    },
    visualizerPassword: {
        layer: LAYERS.none, scope: SCOPES.external, status: STATUSES.retired,
        owner: 'The visualizer.reaplugin plugin settings.',
        why: 'As visualizerUsername. A btoa\'d password in a shared origin is not storage, it is exposure.',
    },
    visualizerEnabled: {
        layer: LAYERS.none, scope: SCOPES.external, status: STATUSES.retired,
        owner: 'The visualizer.reaplugin plugin settings.',
        why: 'Read twice and written nowhere in the old skin — the upload-confirmation poll behind it was dead for that reason.',
    },
    visualizerAutoUpload: {
        layer: LAYERS.none, scope: SCOPES.external, status: STATUSES.retired,
        owner: 'The visualizer.reaplugin plugin settings (AutoUpload), read with Username from the plugin.',
        why: 'The capability diff lists it both as a machine-scoped mover and as a key to delete in favour of the plugin settings; the mover list names only steam stop mode, tank unit and the experimental flags, so the plugin wins. OPEN: if the plugin turns out not to expose AutoUpload, this becomes a KV row — one row, no call site moves.',
    },
    uiZoom: {
        layer: LAYERS.none, scope: SCOPES.external, status: STATUSES.retired,
        owner: 'Nothing — the canvas transform it multiplied is gone. `density` is the replacement control.',
        why: 'The fixed 1920x1200 canvas and its scaling module die with the rewrite (E8, S9).',
    },
    maxStretch: {
        layer: LAYERS.none, scope: SCOPES.external, status: STATUSES.retired,
        owner: 'Nothing — same reason as uiZoom.',
        why: 'A knob on the canvas fit, which no longer exists.',
    },
    rotationPromptDismissed: {
        layer: LAYERS.none, scope: SCOPES.external, status: STATUSES.retired,
        owner: 'Nothing — landscape only, no portrait layout, so there is no rotation prompt.',
        why: 'DECIDED: "Landscape only. No portrait layout."',
    },
    fullscreenPromptDismissed: {
        layer: LAYERS.none, scope: SCOPES.external, status: STATUSES.retired,
        owner: 'Nothing — the prompt machinery lives in the dropped scaling/app boot path.',
        why: 'Ships in a WebView; the desktop fullscreen nag goes with the canvas.',
    },
    helpHidden: {
        layer: LAYERS.none, scope: SCOPES.external, status: STATUSES.retired,
        owner: 'Nothing. The floating help button it hid does not exist in this skin.',
        why: 'This skin has no help overlay, so the toggle has nothing to turn on. A stored '
            + 'preference whose only effect was on a control this skin never built is a finished half '
            + 'with no other half, and its switch was deleted with it.',
    },
    helpLaunches: {
        layer: LAYERS.none, scope: SCOPES.external, status: STATUSES.retired,
        owner: 'Nothing. It was the counter behind `helpHidden`\'s default.',
        why: 'The default ladder it fed ("hide from the third startup on") belongs to a button that is not here.',
    },
    blackScreenSaver: {
        layer: LAYERS.none, scope: SCOPES.external, status: STATUSES.retired,
        owner: 'The `screensaverType` row above, which carries the same question with three answers.',
        why: 'A two-state toggle between black and not-black cannot express three kinds of saver. The '
            + 'question survives; the boolean does not.',
    },
    screensaverClock: {
        layer: LAYERS.none, scope: SCOPES.external, status: STATUSES.retired,
        owner: 'The `screensaverType` row, whose `clock` value is this setting.',
        why: 'It was a switch over the blank, added when black-plus-a-clock were the only two states. '
            + 'With three, two switches have an unreachable combination and no name for what is showing.',
    },
    /* `screensaverImages` WAS HERE AND IS LIVE AGAIN — see the row in the local half.
     * "A black saver has no image list" was true while black was the only saver. */
    screensaverCycleSeconds: {
        layer: LAYERS.none, scope: SCOPES.external, status: STATUSES.retired,
        owner: 'The `screensaverCycleMinutes` row above.',
        why: 'The control is 1-10 MINUTES where the value it writes is seconds, which '
            + 'is a different band answering a different question — a saver, not a slideshow. Reusing '
            + 'the key would leave a stored 10 meaning ten seconds on one read and ten minutes on the '
            + 'next, which is the silent-revert class in miniature.',
    },
    steamStopModeFallback: {
        layer: LAYERS.none, scope: SCOPES.external, status: STATUSES.retired,
        owner: 'The single `steamStopMode` row above.',
        why: 'The old skin READ `steamStopModeFallback` and WROTE `steamStopMode` — two names for one setting, which is the whole argument for a routing table.',
    },
    availableProfilesCache: {
        layer: LAYERS.none, scope: SCOPES.external, status: STATUSES.retired,
        owner: 'Nothing — GET /api/v1/profiles is served from the same origin as the skin.',
        why: 'Wrote ~70 full profile records to IDB after every load, with the only read inside an API catch block — a state that cannot occur.',
    },
    settingsRea: {
        layer: LAYERS.none, scope: SCOPES.external, status: STATUSES.retired,
        owner: 'The data layer\'s in-memory settings caches (Gate 3), and ReaPrime itself — GET /api/v1/settings assembles 22 in-memory scalars with no I/O.',
        why: 'A persisted mirror of a free read buys nothing and costs staleness.',
    },
    settingsDe1: {
        layer: LAYERS.none, scope: SCOPES.external, status: STATUSES.retired,
        owner: 'The data layer\'s in-memory de1Settings cache (60 s, write-through invalidated).',
        why: 'Kept in memory where its lifetime is visible, not persisted where it outlives its truth.',
    },
    settingsDe1Advanced: {
        layer: LAYERS.none, scope: SCOPES.external, status: STATUSES.retired,
        owner: 'The data layer\'s in-memory de1AdvancedSettings cache (40 s).',
        why: 'As settingsDe1.',
    },
    settingsBackup: {
        layer: LAYERS.none, scope: SCOPES.external, status: STATUSES.retired,
        owner: 'ReaPrime — GET /api/v1/data/export owns backup and restore.',
        why: 'A skin-local backup blob is a second source of truth for the thing ReaPrime exports.',
    },
    shotHistoryMirror: {
        layer: LAYERS.none, scope: SCOPES.external, status: STATUSES.retired,
        owner: 'ReaPrime — GET /api/v1/shots (paginated, ETag-conditional) and GET /api/v1/shots/<id>. Any local cache is the `idb.js` successor\'s business (Gate 6) and only ships if it measures out.',
        why: 'Not a setting. The old mirror grew forever with no eviction, and nothing measured its benefit.',
    },
    dye2AutoFavourites: {
        layer: LAYERS.none, scope: SCOPES.external, status: STATUSES.retired,
        owner: 'The DYE2 plugin — KV namespace `dye2.reaplugin`, READ-ONLY to this skin.',
        why: 'Another product\'s namespace. The router owns `decal` and `decal.numpad`, nothing else; DYE2 reads go through the data layer as reads.',
    },
    dye2Recipes: {
        layer: LAYERS.none, scope: SCOPES.external, status: STATUSES.retired,
        owner: 'The DYE2 plugin — KV namespace `dye2.reaplugin`, read-only.',
        why: 'As dye2AutoFavourites.',
    },
    lastSteamDuration: {
        layer: LAYERS.none, scope: SCOPES.external, status: STATUSES.retired,
        owner: 'ReaPrime — De1Controller._setDe1DefaultsFor re-pushes the current workflow\'s steam settings on every connect.',
        why: 'Compensation for something ReaPrime already does.',
    },
    lastSteamFlow: {
        layer: LAYERS.none, scope: SCOPES.external, status: STATUSES.retired,
        owner: 'ReaPrime — as lastSteamDuration.',
        why: 'As lastSteamDuration.',
    },
    lastFlushDuration: {
        layer: LAYERS.none, scope: SCOPES.external, status: STATUSES.retired,
        owner: 'ReaPrime — as lastSteamDuration.',
        why: 'As lastSteamDuration.',
    },
    lastHotWaterVolume: {
        layer: LAYERS.none, scope: SCOPES.external, status: STATUSES.retired,
        owner: 'ReaPrime — as lastSteamDuration.',
        why: 'As lastSteamDuration.',
    },
    lastHotWaterTemp: {
        layer: LAYERS.none, scope: SCOPES.external, status: STATUSES.retired,
        owner: 'ReaPrime — as lastSteamDuration.',
        why: 'As lastSteamDuration.',
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
