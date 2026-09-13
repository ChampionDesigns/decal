/**
 * One {read, write} port over TWO machine documents.
 */

export const FIELD_DOORS = Object.freeze({
    flowMultiplier: 'calibration',

    /* POST /machine/settings/advanced. The six keys `DE1_ADVANCED_WRITE_KEYS` names. */
    heaterPh1Flow: 'advanced',
    heaterPh2Flow: 'advanced',
    heaterIdleTemp: 'advanced',
    heaterPh2Timeout: 'advanced',
    heaterVoltage: 'advanced',
    refillKitSetting: 'advanced',

    /* POST /settings. ReaPrime's preferences — see `rea-app-settings.js` for the two
     * enum vocabularies and the one range the handler enforces. */
    weightFlowMultiplier: 'app',
    volumeFlowMultiplier: 'app',
    hotWaterFlowMultiplier: 'app',
    scalePowerMode: 'app',
    blockOnNoScale: 'app',
    stopHotWaterAtWeight: 'app',
    gatewayMode: 'app',
    logLevel: 'app',
    automaticUpdateCheck: 'app',
    webUiPath: 'app',
    chargingMode: 'app',
    nightModeEnabled: 'app',
    nightModeSleepTime: 'app',
    nightModeMorningTime: 'app',
    lowBatteryBrightnessLimit: 'app',

    /* PUT /workflow. FLAT NAMES FOR A NESTED DOCUMENT, and the flattening is the door's,
     * not a caller's — see `workflowDoorFor`. */
    steamTargetTemperature: 'workflow',
    steamDuration: 'workflow',
    milkStopTemp: 'workflow',
    hotWaterTargetTemperature: 'workflow',
    hotWaterDuration: 'workflow',
    hotWaterVolume: 'workflow',
    steamFlow: 'workflow',
    flushTemp: 'workflow',
    flushFlow: 'workflow',
    flushTimeout: 'workflow',

    /* POST /machine/waterLevels. THE ONE DOOR WITH NO REST READ — see `waterLevelsDoorFor`
     * below. `refillLevel` is the tank's low-water alert height. */
    refillLevel: 'waterLevels',

    /* GET/POST /presence/settings. The sleep policy — the SCHEDULES beside it are a list
     * and stay bespoke. */
    autoSleepEnabled: 'presence',
    sleepAfterMinutes: 'presence',

    /* GET/PUT /machine/cupWarmer and /cupWarmer/preheat. Two routes, one door — the
     * cup-warmer STORE already owns both and the split is its business, not the
     * registry's. */
    cupWarmerTemperature: 'cupWarmer',
    cupWarmerCurrentTemperature: 'cupWarmer',
    cupWarmerPreheatEnabled: 'cupWarmer',
    cupWarmerPreheatLead: 'cupWarmer',
    cupWarmerPreheatSupported: 'cupWarmer',

    measuredVoltage: 'machineInfo',
});

/** Every door name this port knows how to open. The suite checks the table against it. */
export const DOORS = Object.freeze([
    'settings', 'calibration', 'advanced', 'app', 'workflow', 'waterLevels', 'machineInfo',
    'cupWarmer', 'presence',
]);

export const WORKFLOW_FIELD_PATHS = Object.freeze({
    steamTargetTemperature: Object.freeze(['steamSettings', 'targetTemperature']),
    steamFlow: Object.freeze(['steamSettings', 'flow']),
    steamDuration: Object.freeze(['steamSettings', 'duration']),
    milkStopTemp: Object.freeze(['steamSettings', 'stopAtTemperature']),
    hotWaterTargetTemperature: Object.freeze(['hotWaterData', 'targetTemperature']),
    hotWaterDuration: Object.freeze(['hotWaterData', 'duration']),
    hotWaterVolume: Object.freeze(['hotWaterData', 'volume']),
    flushTemp: Object.freeze(['rinseData', 'targetTemperature']),
    flushFlow: Object.freeze(['rinseData', 'flow']),
    flushTimeout: Object.freeze(['rinseData', 'duration']),
});

export function workflowDoorFor(workflow) {
    if (!workflow || typeof workflow.load !== 'function' || typeof workflow.apply !== 'function') return null;
    return Object.freeze({
        async read() {
            await workflow.load();
            const document = workflow.get?.().workflow ?? null;
            if (!document || typeof document !== 'object') return {};
            const out = {};
            for (const [field, [group, leaf]] of Object.entries(WORKFLOW_FIELD_PATHS)) {
                const value = document[group]?.[leaf];
                /* ABSENT STAYS ABSENT, as at the calibration door: a machine that has not
                 * answered is not a machine holding zero. */
                if (Number.isFinite(value)) out[field] = value;
            }
            return out;
        },
        async write(patch) {
            const merge = {};
            for (const [field, value] of Object.entries(patch)) {
                const path = WORKFLOW_FIELD_PATHS[field];
                if (!path) return false;
                const [group, leaf] = path;
                merge[group] = { ...(merge[group] ?? {}), [leaf]: value };
            }
            if (Object.keys(merge).length === 0) return false;
            const state = await workflow.apply(merge, { label: 'settings targets' });
            if (state && state.abandoned === true) return false;
            return Boolean(state && state.writeError === null && state.workflow);
        },
    });
}

export function presenceDoorFor(store) {
    if (!store || typeof store.load !== 'function') return null;
    return Object.freeze({
        async read() {
            await store.load();
            const state = store.get?.() ?? null;
            const out = {};
            if (typeof state?.presenceEnabled === 'boolean') out.autoSleepEnabled = state.presenceEnabled;
            if (Number.isFinite(state?.sleepTimeoutMinutes)) out.sleepAfterMinutes = state.sleepTimeoutMinutes;
            return out;
        },
        async write(patch) {
            const results = [];
            if (Object.hasOwn(patch, 'autoSleepEnabled')) {
                results.push(await store.setPresenceEnabled(Boolean(patch.autoSleepEnabled)));
            }
            if (Object.hasOwn(patch, 'sleepAfterMinutes')) {
                results.push(await store.setSleepTimeout(Number(patch.sleepAfterMinutes)));
            }
            if (results.length === 0) return false;
            return results.every(Boolean);
        },
    });
}

export function cupWarmerDoorFor(store) {
    if (!store || typeof store.refresh !== 'function') return null;
    return Object.freeze({
        async read() {
            await store.refresh();
            const state = store.get?.() ?? null;
            const out = {};
            const target = state?.warmer?.temperature;
            const live = state?.warmer?.currentTemperature;
            const enabled = state?.warmer?.enabled;
            if (Number.isFinite(target)) out.cupWarmerTemperature = enabled === false ? 0 : target;
            else if (enabled === false) out.cupWarmerTemperature = 0;
            if (Number.isFinite(target)) out.cupWarmerHeldTarget = target;
            if (Number.isFinite(live)) out.cupWarmerCurrentTemperature = live;
            if (typeof state?.preheat?.enabled === 'boolean') {
                out.cupWarmerPreheatEnabled = state.preheat.enabled;
            }
            if (Number.isFinite(state?.preheat?.leadMinutes)) {
                out.cupWarmerPreheatLead = state.preheat.leadMinutes;
            }
            if (typeof state?.preheatSupported === 'boolean') {
                out.cupWarmerPreheatSupported = state.preheatSupported;
            }
            return out;
        },
        async write(patch) {
            const results = [];
            if (Object.hasOwn(patch, 'cupWarmerTemperature')) {
                const value = Number(patch.cupWarmerTemperature);
                results.push(value > 0
                    ? await store.setTarget(value, { enabled: true })
                    : await store.setEnabled(false));
            }
            const preheat = {};
            if (Object.hasOwn(patch, 'cupWarmerPreheatEnabled')) {
                preheat.enabled = Boolean(patch.cupWarmerPreheatEnabled);
            }
            if (Object.hasOwn(patch, 'cupWarmerPreheatLead')) {
                preheat.leadMinutes = Number(patch.cupWarmerPreheatLead);
            }
            if (Object.keys(preheat).length > 0) results.push(await store.setPreheat(preheat));
            if (results.length === 0) return false;
            return results.every((result) => result && result.ok !== false);
        },
    });
}

export function machineInfoDoorFor(store) {
    if (!store || typeof store.load !== 'function') return null;
    return Object.freeze({
        async read() {
            await store.load();
            const value = Number(store.info?.()?.extra?.voltage);
            return Number.isFinite(value) && value >= 80 && value <= 280
                ? { measuredVoltage: Math.round(value) }
                : {};
        },
        async write() { return false; },
    });
}

export function waterLevelsDoorFor({ feed = null, post = null } = {}) {
    if (!feed || typeof feed.get !== 'function' || typeof post !== 'function') return null;
    return Object.freeze({
        async read() {
            const frame = feed.get()?.frame ?? null;
            const value = frame?.refillLevel;
            return Number.isFinite(value) ? { refillLevel: value } : {};
        },
        async write(patch) {
            const value = patch?.refillLevel;
            if (!Number.isFinite(value)) return false;
            let result;
            try {
                result = await post({ refillLevel: value });
            } catch {
                return false;
            }
            return Boolean(result && typeof result === 'object' && result.ok === true);
        },
    });
}

export function createMachineFieldsPort({
    settings = null, calibration = null, advanced = null, app = null, workflow = null,
    waterLevels = null, machineInfo = null, cupWarmer = null, presence = null,
} = {}) {
    const doors = {};

    if (settings && typeof settings.read === 'function') {
        doors.settings = Object.freeze({
            read: () => settings.read(),
            write: (patch) => (typeof settings.write === 'function' ? settings.write(patch) : false),
        });
    }

    if (calibration && typeof calibration.readFlow === 'function') {
        doors.calibration = Object.freeze({
            async read() {
                await calibration.readFlow();
                const value = calibration.get().flowMultiplier;
                return Number.isFinite(value) ? { flowMultiplier: value } : {};
            },
            write(patch) {
                if (typeof calibration.writeFlow !== 'function') return false;
                return calibration.writeFlow(patch.flowMultiplier);
            },
        });
    }

    for (const [name, door] of Object.entries({
        advanced, app, workflow, waterLevels, machineInfo, cupWarmer, presence,
    })) {
        if (door && typeof door.read === 'function' && typeof door.write === 'function') {
            doors[name] = Object.freeze({ read: () => door.read(), write: (patch) => door.write(patch) });
        }
    }

    if (Object.keys(doors).length === 0) return null;

    return Object.freeze({
        /** Which doors this port actually has. Diagnostics and the suite — never a branch. */
        get open() { return Object.freeze(Object.keys(doors).sort()); },

        async read() {
            const out = {};
            for (const door of Object.values(doors)) {
                let document = null;
                try {
                    document = await door.read();
                } catch {
                    /* A door that throws contributes NOTHING, exactly as a door that
                     * fails does. The model's own read is what reports the absence. */
                    document = null;
                }
                if (document && typeof document === 'object') Object.assign(out, document);
            }
            return out;
        },

        async write(patch) {
            if (!patch || typeof patch !== 'object') return false;

            const byDoor = new Map();
            for (const [field, value] of Object.entries(patch)) {
                const name = FIELD_DOORS[field] ?? 'settings';
                if (!byDoor.has(name)) byDoor.set(name, {});
                byDoor.get(name)[field] = value;
            }

            const results = [];
            for (const [name, doorPatch] of byDoor) {
                const door = doors[name];
                if (!door) return false;
                results.push(await door.write(doorPatch));
            }

            return results.length > 0 && results.every(Boolean);
        },
    });
}
