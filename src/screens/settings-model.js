/**
 * The Settings screen's composition root, and nothing else.
 */

import { createSettingsStore } from 'src/stores/settings-store.js';
import { createSettingsLeafModel, machinePortFor, advancedPortFor } from 'src/stores/settings-leaf-model.js';
import { createDe1SettingsClient } from 'src/data/rea-de1-settings.js';
import {
    createMachineFieldsPort, workflowDoorFor, waterLevelsDoorFor, machineInfoDoorFor,
    cupWarmerDoorFor, presenceDoorFor,
} from 'src/stores/machine-fields-port.js';
import { createMachineInfoStore } from 'src/stores/machine-info-store.js';
import { createLedStripStore } from 'src/stores/led-strip-store.js';
import { createCalibrationStore } from 'src/stores/calibration-store.js';
import { createSkinsStore } from 'src/stores/skins-store.js';
import { createFirmwareStore } from 'src/stores/firmware-store.js';
import { createAppInfoStore } from 'src/stores/app-info-store.js';
import { createAppSettingsStore } from 'src/stores/app-settings-store.js';
import { createWorkflowStore } from 'src/stores/workflow-store.js';
import { createPresenceStore } from 'src/stores/presence-store.js';
import { createPluginsStore } from 'src/stores/plugins-store.js';
import { createDecentAccountStore } from 'src/stores/decent-account-store.js';
import { createDecentSupportStore } from 'src/stores/decent-support-store.js';
import { createFeedbackStore } from 'src/stores/feedback-store.js';
import { createScaleConnectStore } from 'src/stores/scale-connect-store.js';
import { createMachineStateStore } from 'src/stores/machine-state-store.js';
import { callRoute } from 'src/data/rea-routes.js';
import { CAPABILITY } from 'src/stores/capabilities-store.js';
import { FEED } from 'src/stores/live-stores.js';
import { DEFAULT_LANGUAGE } from 'src/lib/i18n.js';

/** boot -> the bundle both models come out of. Weak; a destroyed boot takes it with it. */
const MODELS = new WeakMap();

export const AVAILABLE_LANGUAGES = Object.freeze([
    Object.freeze({ code: DEFAULT_LANGUAGE, endonym: 'English', english: 'English', partial: false }),
]);

export function settingsModelFor(boot) {
    return bundleFor(boot)?.leaf ?? null;
}

export function settingsBespokeFor(boot) {
    return bundleFor(boot)?.bespoke ?? null;
}

function bundleFor(boot) {
    if (!boot || !boot.storage) return null;
    if (MODELS.has(boot)) return MODELS.get(boot);

    const settings = boot.settings ?? createSettingsStore({
        storage: boot.storage,
        capabilities: boot.capabilities ?? null,
        logger: boot.logger ?? undefined,
    });

    const limits = typeof boot.capabilities?.machineLimits === 'function'
        ? () => boot.capabilities.machineLimits().value
        : null;

    const machineClass = () => (
        typeof boot.capabilities?.machineClass === 'function'
            ? boot.capabilities.machineClass()
            : null
    );

    let settingsPort = null;
    let advancedPort = null;
    let de1Settings = null;
    try {
        de1Settings = boot.transport ? createDe1SettingsClient(boot.transport) : null;
        settingsPort = de1Settings ? machinePortFor(de1Settings) : null;
        advancedPort = de1Settings ? advancedPortFor(de1Settings) : null;
    } catch {
        de1Settings = null;
        settingsPort = null;
        advancedPort = null;
    }

    /* THE BESPOKE STORES. Each takes the transport and nothing else — no path is spelled
     * on this side of any of them, and none of them is built without one. */
    const transport = boot.transport ?? null;
    const logger = boot.logger ?? undefined;
    const machineInfo = transport ? createMachineInfoStore({ transport, logger }) : null;
    const led = transport ? createLedStripStore({ transport, logger }) : null;
    const calibration = transport ? createCalibrationStore({ transport, logger }) : null;
    const skins = transport ? createSkinsStore({ transport, logger }) : null;
    const firmware = transport ? createFirmwareStore({ transport, logger }) : null;
    const appInfo = transport ? createAppInfoStore({ transport, logger }) : null;
    const app = boot.appSettings ?? (transport ? createAppSettingsStore({ transport, logger }) : null);
    const workflow = transport ? createWorkflowStore({ transport, logger }) : null;
    const presence = transport ? createPresenceStore({ transport, logger }) : null;
    const plugins = boot.plugins ?? (transport ? createPluginsStore({ transport, logger }) : null);
    const account = transport ? createDecentAccountStore({ transport, logger }) : null;
    const support = transport
        ? createDecentSupportStore({ transport, token: boot.proxyToken ?? null, logger })
        : null;
    const feedback = transport ? createFeedbackStore({ transport, logger }) : null;
    const scaleConnect = transport ? createScaleConnectStore({ transport, logger }) : null;
    const machineState = boot.machineState
        ?? (transport ? createMachineStateStore({ transport, logger }) : null);
    const cupWarmer = boot.cupWarmer ?? null;
    if (cupWarmer && typeof cupWarmer.useSchedules === 'function') {
        cupWarmer.useSchedules(() => presence?.get()?.schedules ?? null);
    }

    const machine = createMachineFieldsPort({
        settings: settingsPort,
        calibration,
        advanced: advancedPort,
        app,
        workflow: workflowDoorFor(workflow),
        machineInfo: machineInfoDoorFor(machineInfo),
        cupWarmer: cupWarmerDoorFor(cupWarmer),
        presence: presenceDoorFor(presence),
        waterLevels: waterLevelsDoorFor({
            feed: typeof boot.live?.feed === 'function' ? boot.live.feed(FEED.WATER) : null,
            post: transport ? (body) => callRoute(transport, 'postMachineWaterLevels', { body }) : null,
        }),
    });

    const displayFeed = typeof boot.live?.feed === 'function' ? boot.live.feed(FEED.DISPLAY) : null;
    const panel = typeof boot.live?.setWakeLock === 'function'
        ? Object.freeze({
            setWakeLock: (on) => boot.live.setWakeLock(on),
            wakeLockOverride: () => {
                const held = displayFeed?.get?.()?.value?.wakeLockOverride;
                return typeof held === 'boolean' ? held : undefined;
            },
            setBrightness: (value) => boot.live.setBrightness(value),
            brightnessServed: () => {
                const frame = displayFeed?.get?.()?.value;
                if (Number.isFinite(frame?.brightness)) return frame.brightness;
                if (Number.isFinite(frame?.requestedBrightness)) return frame.requestedBrightness;
                return undefined;
            },
        })
        : null;

    const model = createSettingsLeafModel({
        settings,
        machine,
        limits,
        machineClass,
        panel,
        logger: boot.logger ?? undefined,
    });

    const capabilities = boot.capabilities ?? null;
    const bundle = Object.freeze({
        leaf: model,
        bespoke: Object.freeze({
            settings,
            machineInfo,
            led,
            calibration,
            skins,
            firmware,
            appInfo,
            app,
            workflow,
            presence,
            plugins,
            account,
            support,
            feedback,
            scaleConnect,
            machineState,
            cupWarmer,
            de1Settings,
            limits: typeof limits === 'function' ? limits() : limits,
            languages: AVAILABLE_LANGUAGES,
            defaultLanguage: DEFAULT_LANGUAGE,
            scaleFeed: typeof boot.live?.feed === 'function' ? boot.live.feed(FEED.SCALE) : null,
            machineFeed: typeof boot.live?.feed === 'function' ? boot.live.feed(FEED.MACHINE) : null,

            appUpdate: typeof boot.live?.checkAppUpdate === 'function'
                ? Object.freeze({
                    feed: typeof boot.live.feed === 'function' ? boot.live.feed(FEED.UPDATE) : null,
                    check: () => boot.live.checkAppUpdate(),
                    install: () => boot.live.installAppUpdate(),
                })
                : null,
            display: typeof boot.live?.setBrightness === 'function'
                ? Object.freeze({
                    setBrightness: (value) => boot.live.setBrightness(value),
                    feed: typeof boot.live.feed === 'function' ? boot.live.feed(FEED.DISPLAY) : null,
                })
                : null,
            machineValue: (field) => model.machineValue(field),
            reloadMachine: () => model.loadMachine(),
            /* A3, ONE EXPRESSION. PRESENT is the only answer that opens a surface; ABSENT
             * and UNKNOWN both close it, and so does having no capability store at all. */
            allowed: (capability) => (
                typeof capabilities?.capability === 'function'
                    ? capabilities.capability(capability) === CAPABILITY.PRESENT
                    : false
            ),
            watchAllowed: (listener) => (
                typeof capabilities?.subscribe === 'function'
                    ? capabilities.subscribe(listener)
                    : () => {}
            ),
            machineClass: () => (
                typeof capabilities?.machineClass === 'function'
                    ? capabilities.machineClass()
                    : null
            ),
        }),
    });
    MODELS.set(boot, bundle);
    return bundle;
}
