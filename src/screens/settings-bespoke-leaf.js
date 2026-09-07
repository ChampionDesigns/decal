/**
 * <settings-bespoke-leaf> — the settings leaves that need layout no archetype covers.
 */

import { css, html, nothing } from 'lit';

import { UiElement, selectionSurface } from 'src/components/base.js';
import { typeRoles } from 'src/components/type-roles.js';
import { I18nController } from 'src/lib/i18n.js';

/* THE LIBRARY, COMPOSED. Every one shipped in waves 1-4. */
import 'src/components/ui-card.js';
import 'src/components/ui-card-grid.js';
import 'src/components/ui-definition-card.js';
import 'src/components/ui-tile-grid.js';
import 'src/components/ui-wizard-column.js';
import 'src/components/ui-colour-swatch-row.js';
import 'src/components/ui-progress-track.js';
import 'src/components/ui-empty-state.js';
import 'src/components/ui-bank.js';
import 'src/components/ui-switch.js';
import 'src/components/ui-button.js';
import 'src/components/ui-stepper.js';
import 'src/components/ui-file-button.js';
import 'src/components/ui-colour-wheel.js';
import 'src/components/ui-dialog.js';
import 'src/components/ui-icon-button.js';

import { gearIcon } from 'src/lib/icons.js';
import 'src/components/ui-time-picker.js';
import 'src/components/ui-list-row.js';
import 'src/components/ui-confirm-dialog.js';
import 'src/components/ui-text-field.js';
import 'src/components/ui-notes-editor.js';
import 'src/components/ui-status-chip.js';
import 'src/components/ui-keycap.js';
import 'src/components/ui-select.js';
import 'src/components/ui-numeric-keypad.js';
import 'src/components/ui-badge.js';

import { LED_BANKS, LED_STATUS } from 'src/stores/led-strip-store.js';
import { CAL_STEP, CAL_LOAD, CAL_STATUS_NONE, isCalibrationInProgress } from 'src/stores/calibration-store.js';
import { KEEP_AWAKE_RANGE, PRESENCE_STATUS } from 'src/stores/presence-store.js';
import { PLUGINS_STATUS, VISUALIZER_PLUGIN_ID, pluginHasSettings, settingFields } from 'src/stores/plugins-store.js';
import { ACCOUNT_STATUS } from 'src/stores/decent-account-store.js';
import { SUPPORT_STATUS, SUPPORT_REFUSAL, SEND_STATUS } from 'src/stores/decent-support-store.js';
import { FEEDBACK_STATUS, FEEDBACK_REFUSAL, FEEDBACK_TYPES } from 'src/stores/feedback-store.js';
import { SCAN_STATUS } from 'src/stores/scale-connect-store.js';
import { DEVICE_STATE, DEVICE_TYPE } from 'src/data/rea-devices.js';
import { hasReading } from 'src/data/reading.js';
import { valueOf, FEED_STATUS } from 'src/stores/feed-store.js';

import { checkFirmwareImage, catalogCarriesNothingFor, IMAGE_VERDICT, FIRMWARE_HEADER_BYTES, MACHINE_CLASS_NAMES } from 'src/lib/firmware-image.js';
import { SETTINGS_ROWS } from 'src/lib/settings-leaves.js';
import { leafFor, leafShownOn, navName, shownOnMachine } from 'src/lib/settings-nav.js';
import { REQUEST_STATUS } from 'src/stores/machine-state-store.js';
import { SCREENSAVER_DEFAULT_IMAGE } from 'src/components/ui-screensaver.js';
import { MACHINE_STATE } from 'src/data/machine-state.js';
import { BINDABLE_ACTIONS, bindingsByAction, conflictFor, keyLabel, normaliseKey, withBinding } from 'src/lib/key-bindings.js';
import { shortDate, shortDateTime } from 'src/lib/short-date.js';
import { clockTime, clockTimeFromMinutes, normaliseClockFormat } from 'src/lib/wall-clock.js';
/* The wire's own "HH:MM" -> {h24, m}, from the module that owns that parse. A schedule's
 * `time` arrives as that string and the label above needs the pair. */
import { parseTime24 } from 'src/lib/time-picker-core.js';

export const BESPOKE_NUMBER_FIELDS = Object.freeze({
    'schedule-keep-awake': Object.freeze({ heading: 'Stay awake for', range: KEEP_AWAKE_RANGE }),
});

/** The keypad reads ONE limits object with ONE key in it — the field's own. */
const bespokeLimitsFor = (id) => (BESPOKE_NUMBER_FIELDS[id]
    ? Object.freeze({ [id]: BESPOKE_NUMBER_FIELDS[id].range })
    : null);

export const LED_PRESETS = Object.freeze([
    Object.freeze({ hex: '#000000', label: 'Off' }),
    Object.freeze({ hex: '#ffaa55', label: 'Warm White' }),
    Object.freeze({ hex: '#ffd9a0', label: 'Soft White' }),
    Object.freeze({ hex: '#eaf2ff', label: 'Daylight' }),
    Object.freeze({ hex: '#ff7a00', label: 'Amber' }),
    Object.freeze({ hex: '#ff2200', label: 'Red' }),
    Object.freeze({ hex: '#0ca581', label: 'Green' }),
    Object.freeze({ hex: '#00c2d1', label: 'Cyan' }),
    Object.freeze({ hex: '#7a3ff2', label: 'Purple' }),
    Object.freeze({ hex: '#315c70', label: 'Slate Blue' }),
    Object.freeze({ hex: '#ffffff', label: 'Cool White' }),
    Object.freeze({ hex: '#ffc46b', label: 'Candle' }),
    Object.freeze({ hex: '#ff4f8b', label: 'Pink' }),
    Object.freeze({ hex: '#2b6cff', label: 'Blue' }),
    Object.freeze({ hex: '#0a6b3d', label: 'Forest' }),
    Object.freeze({ hex: '#b8b8b8', label: 'Grey' }),
]);

export function skinVersionText(version) {
    const text = typeof version === 'string' ? version.trim() : '';
    if (!text) return '';
    return /^v/i.test(text) ? text : `v${text}`;
}

const THEME_ITEMS = Object.freeze([
    Object.freeze({ value: 'dark', label: 'Dark' }),
    Object.freeze({ value: 'light', label: 'Light' }),
]);

const LED_ZONE_ITEMS = Object.freeze([
    Object.freeze({ value: 'front', label: 'Front', zones: Object.freeze(['frontStrip', 'frontSwitch']) }),
    Object.freeze({ value: 'rear', label: 'Rear', zones: Object.freeze(['backStrip']) }),
    Object.freeze({ value: 'both', label: 'Both', zones: Object.freeze(['frontStrip', 'frontSwitch', 'backStrip']) }),
]);

const LED_GRID_ZONES = Object.freeze(LED_ZONE_ITEMS.filter((item) => item.zones.length === 1
    || item.value === 'front'));

/** The wire zones one bank cell stands for, or an empty list for a name it does not have. */
function ledZonesFor(value) {
    return LED_ZONE_ITEMS.find((item) => item.value === value)?.zones ?? [];
}

/** What a group READS as: its first zone. See the table's note. */
function ledLeadZone(value) {
    return ledZonesFor(value)[0] ?? null;
}

const LED_BANK_ITEMS = Object.freeze([
    Object.freeze({ value: 'awake', label: 'Awake' }),
    Object.freeze({ value: 'sleeping', label: 'Asleep' }),
]);

const CAL_STATUS_TEXT = Object.freeze({
    ok: 'Calibrated.',
    incomplete: 'One cell is done. Move the weight to the other cell and latch again.',
    noZero: 'Zero the load cells before latching a weight.',
    notSettled: 'The reading never settled. Keep the machine still and try again.',
    badWeight: 'That weight is outside what the load cells can measure.',
    badDelta: 'That cell did not see the weight. Check it is sitting directly on one load cell, not bridging both.',
    illConditioned: 'Both weighings landed on the same cell. Move the weight to the other one.',
    outOfRange: 'The calibration that came out is more than 50% off nominal. Check the weight you entered.',
    notIsolated: 'The cup platform is still fitted, or the weight is bridging both cells.',
});

/** `ScaleCalibrationSubState`, as a phase word beside the countdown. */
const CAL_SUBSTATE_TEXT = Object.freeze({
    settling: 'Settling',
    averaging: 'Averaging',
    done: 'Done',
    error: 'Stopped',
});

const CAL_STEPS = Object.freeze(['Start', 'Zero', 'Left cell', 'Right cell', 'Check']);

/** The default latch weight ReaPrime itself uses when a caller sends none. */
const CAL_DEFAULT_WEIGHT = 200;

/** What each of the five steps is called, once the machine is not mid-action. */
const CAL_STAGE_HEADING = Object.freeze({
    1: 'Calibrate the load cells',
    2: 'Zero the load cells',
    3: 'Put the weight on the left cell',
    4: 'Move the weight to the right cell',
    5: 'Check the reading',
});

const CAL_STAGE_BODY = Object.freeze({
    1: 'This teaches the machine what a known weight feels like on each load cell. You will need the drip tray off and a weight whose mass you know. Nothing is written to the machine until you press Zero.',
    2: 'Take the cup platform and the drip tray off so the load cells are carrying nothing, then press Zero. It takes about fifteen seconds to settle and average.',
    3: 'Leave the cup platform and the drip tray OFF — the cells have to be isolated. Put the weight directly on the LEFT load cell, set its mass below, then latch it. This takes about fifteen seconds.',
    4: 'Still with the cup platform and the drip tray OFF, move the same weight directly onto the RIGHT load cell and latch it again. The machine works out which cell it is on.',
    5: 'Leave the weight where it is. The scale should now read what you entered. Refit the drip tray and the cup platform when you are done.',
});

const LEAF_CAPABILITY = Object.freeze({
    'machine-sleep-wake-schedules': 'wakeSchedule',
    'calibration-load-cells': 'scaleCalibration',
    'accessories-lighting': 'ledStrip',
});

const MACHINE_INFO_UNITS = Object.freeze({ voltage: 'V', tankTemp: '\u00B0C' });

/** The internal capability bitmask. "Profile Mode Caps 15" answers no question a user has. */
const MACHINE_INFO_INTERNAL_KEYS = new Set(['profileModeCaps', 'ProfileModeCaps']);

const SAVER_IMAGE_LIMIT = 12;

function readAsDataUrl(file) {
    return new Promise((resolve) => {
        try {
            const reader = new FileReader();
            reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(file);
        } catch {
            resolve(null);
        }
    });
}

export const RESET_FIELDS = Object.freeze([
    Object.freeze({ field: 'fan', value: 55 }),
    Object.freeze({ field: 'heaterIdleTemp', value: 95 }),
    Object.freeze({ field: 'heaterPh1Flow', value: 2 }),
    Object.freeze({ field: 'heaterPh2Flow', value: 4 }),
    Object.freeze({ field: 'heaterPh2Timeout', value: 4 }),
    Object.freeze({ field: 'refillKitSetting', value: 2 }),
    Object.freeze({ field: 'flowMultiplier', value: 1 }),
    Object.freeze({ field: 'steamPurgeMode', value: 0 }),
]);

function defaultsDetail(t, pages) {
    if (pages.length === 0) {
        return t('These settings go back to the machine’s own values.');
    }
    const names = pages.map((name) => t(name));
    const list = names.length === 1
        ? names[0]
        : `${names.slice(0, -1).join(', ')} ${t('and')} ${names[names.length - 1]}`;
    return `${t('Anything you have set on the')} ${list} ${t('pages goes back to the machine’s own value.')}`;
}

const PLUGIN_FIELD_COPY = Object.freeze({
    'visualizer.reaplugin': Object.freeze({
        Username: { heading: 'Username', caption: 'Your visualizer.coffee account.' },
        Password: { heading: 'Password', caption: '' },
        AutoUpload: { heading: 'Upload shots automatically', caption: 'Send every shot as it finishes.' },
        LengthThreshold: {
            heading: 'Minimum shot duration',
            caption: 'Shorter shots are not uploaded, so a flush or a mistake does not become a record. In seconds.',
        },
        BackSync: {
            heading: 'Upload older shots',
            caption: 'Look back through shots already on the machine and send any that were missed.',
        },
        BackSyncIntervalSeconds: {
            heading: 'How often to look back',
            caption: 'In seconds.',
        },
    }),
});

function pluginPage(manifest) {
    const endpoints = Array.isArray(manifest?.api) ? manifest.api : [];
    const page = endpoints.find((entry) => entry && entry.type === 'http' && entry.id === 'ui');
    return page ? page.id : null;
}

function pluginBlurb(manifest) {
    return String(manifest?.description ?? '')
        .replace(/https?:\/\/\S*\/plugins\/\S*/gi, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
}

function pluginVersion(value) {
    const text = String(value ?? '').trim();
    if (text === '') return '';
    return /^v/i.test(text) ? text : `v${text}`;
}

/** The prose name and helper for one plugin field, or the manifest's own. */
function pluginFieldCopy(pluginId, field) {
    const found = PLUGIN_FIELD_COPY[pluginId]?.[field.key] ?? null;
    return {
        heading: found?.heading ?? field.key,
        caption: found?.caption ?? field.description ?? '',
    };
}

const LED_PRESET_COLUMNS = 4;

/** The absent mark, the same EN DASH the address layer uses. */
const MACHINE_INFO_DASH = '\u2013';

const FIRMWARE_DURATION = 'It can take up to an hour.';
const FIRMWARE_POWER = 'Do not switch the machine off while an image is being written.';
const FIRMWARE_CARE = 'Do not switch the machine off, and do not close this page, until it finishes.';
const FIRMWARE_INTERRUPTION = 'If it stops part-way nothing resumes — you start the update again from the beginning.';

const DESCALING_INSTRUCTIONS_URL = 'https://app.basecamp.com/3671212/buckets/7351439/documents/7743429669';

const EMPTY_SUPPORT_DRAFT = Object.freeze({ subject: '', body: '', attachDetails: true });

/** The Decent support thread stamps each message in UNIX SECONDS; `shortDateTime` takes
 *  milliseconds. One named conversion rather than a bare 1000 in a template. */
const MS_PER_SECOND = 1000;

const SUPPORT_REFUSAL_COPY = Object.freeze({
    [SUPPORT_REFUSAL.NO_TOKEN]: 'Messages can only be sent from a page the machine serves. Open this skin from ReaPrime rather than from another address.',
    [SUPPORT_REFUSAL.NOT_LINKED]: 'The machine is no longer signed in to a Decent account. Sign in again in ReaPrime.',
    [SUPPORT_REFUSAL.FORBIDDEN]: 'ReaPrime did not allow this skin to use the Decent account. Check the account permissions in ReaPrime.',
    [SUPPORT_REFUSAL.UPSTREAM_REFUSED]: 'Decent’s support service refused the request. Try again in a moment.',
    [SUPPORT_REFUSAL.UNREADABLE]: 'The reply from Decent could not be read, so the conversation is not shown.',
    [SUPPORT_REFUSAL.FAILED]: 'The conversation could not be reached. Check the machine’s internet connection and try again.',
});

const DEVICE_WORD = Object.freeze({
    connected: 'Connected',
    connecting: 'Connecting',
    disconnecting: 'Disconnecting',
    disconnected: 'Available',
    discovered: 'Available',
});

const DEVICE_REFUSAL = Object.freeze({
    connect: 'That device could not be reached.',
    disconnect: 'That device would not disconnect.',
    forget: 'The machine would not forget that device.',
    preferred: 'That device could not be made the preferred one.',
});

export class SettingsBespokeLeaf extends UiElement {
    static properties = {
        /** The leaf id, from `settings-nav.js`. Anything not among the nine renders nothing. */
        leafId: { type: String, attribute: 'leaf-id' },

        /** `settingsBespokeFor(boot)` — the stores this cluster reads. */
        deps: { attribute: false },

        theme: { attribute: false },

        /** Internal: one beacon for every store this leaf subscribes to. */
        _version: { state: true },

        /** Internal: which LED zone and bank the user is editing. Not machine state. */
        _ledZone: { state: true },
        _ledBank: { state: true },

        /** Internal: the latch weight the user typed. Bounded by the ONE table. */
        _weight: { state: true },

        _calStarted: { state: true },
        _calZeroed: { state: true },

        /** Internal: what the scale reads now, for the calibration walk's check step. */
        _scaleWeight: { state: true },

        _schedule: { state: true },

        _flashPending: { state: true },
        _flashRejected: { state: true },

        _typing: { state: true },

        /* Internal: which irreversible procedure is waiting on a confirmation, by id. */
        _confirm: { state: true },

        _machineState: { state: true },
        _procedureSeen: { state: true },

        /* Internal: the reset was refused. Reported rather than swallowed. */
        _defaultsFailed: { state: true },

        /* Internal: the staged settings for one plugin (`{id, values}`). Staged rather
         * than written per keystroke, because `POST /plugins/<id>/settings` RELOADS the
         * plugin on every write. */
        _pluginDraft: { state: true },
        /** Which plugin's settings dialog is open, or null. */
        _pluginSettingsFor: { state: true },

        /* Internal: the last Open press produced no window. `window.open` returning null
         * in a webview is not an exception, so without this a refused navigation was
         * silent — see `#openPluginPage`. */
        _pluginOpenFailed: { state: true },

        /* Internal: the feedback form's own draft. It is not stored anywhere — an
         * unsent feedback note is not a preference. */
        _feedback: { state: true },

        _support: { state: true },

        _supportIncomplete: { state: true },

        /* Internal: which night-mode time is open in the picker, `sleep` or `morning`. */
        _nightEdit: { state: true },

        _updateRefusal: { state: true },

        /* Internal: the WiFi scale address being typed. */
        _wifiHost: { state: true },

        /* Internal: the key-binding editor. `_captureAction` is the action listening for
         * a keystroke; `_bindingConflict` is the label of the action already holding the
         * key that was just pressed. */
        _captureAction: { state: true },
        _bindingConflict: { state: true },
    };

    static styles = [typeRoles, css`
        :host {
            display: grid;
            gap: var(--ui-space-5);
            align-content: start;
            min-inline-size: 0;

            --_ui-lighting-col-min: 420px;

            /* The screen-saver thumbnail's inline size. Private, defaulted, and a
             * SIZE rather than a track minimum: a thumbnail is a fixed thing. */
            --_ui-thumb-size: 160px;

            --_ui-form-control-w: var(--ui-form-control-w);
        }

        .group {
            display: grid;
            gap: var(--ui-space-3);
            min-inline-size: 0;
        }

        .group > h3 {
            margin: 0;
        }

        .prose {
            margin: 0;
            max-inline-size: var(--ui-measure);
        }

        .caution {
            display: block;
            margin: 0;
            max-inline-size: var(--ui-measure);
            padding: var(--ui-space-3) var(--ui-space-4);
            border-inline-start: 3px solid var(--ui-status-danger);
            border-radius: var(--ui-radius);
            background: color-mix(in srgb, var(--ui-status-danger) 10%, transparent);
            font-size: var(--ui-text-note);
            font-weight: var(--ui-weight-medium);
            line-height: 1.5;
        }

        .fact-head {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: var(--ui-space-5);
            min-inline-size: 0;
        }

        .facts {
            margin: 0;
            display: grid;
            gap: var(--ui-space-3);
            min-inline-size: 0;
        }

        .fact {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            align-items: baseline;
            gap: var(--ui-space-5);
            min-inline-size: 0;
        }

        .fact > dt {
            margin: 0;
            min-inline-size: 0;
        }

        .fact > dd {
            margin: 0;
            text-align: end;
        }

        .group.inline {
            grid-auto-flow: column;
            grid-template-columns: minmax(0, 1fr) auto;
            align-items: center;
        }

        #lighting {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(min(var(--_ui-lighting-col-min), 100%), 1fr));
            gap: var(--ui-space-6);
            align-items: start;
            min-inline-size: 0;
        }

        #lighting > .column {
            display: grid;
            gap: var(--ui-space-5);
            align-content: start;
            min-inline-size: 0;
        }

        /* The four current colours: zone down the side, bank across the top. */
        #current {
            display: grid;
            grid-template-columns: auto repeat(2, minmax(0, 1fr));
            gap: var(--ui-space-2);
            align-items: center;
            min-inline-size: 0;
        }

        .chip {
            block-size: var(--ui-control-h);
            border-radius: var(--ui-radius);
            border: var(--ui-border-w) solid var(--ui-line);
            background-color: var(--_ui-chip-fill, var(--ui-fascia));
            min-inline-size: 0;

            padding: 0;
            font: inherit;
            color: inherit;
            cursor: pointer;
        }

        .chip[aria-pressed="true"] {
            background-color: var(--_ui-chip-fill, var(--ui-fascia));
            border-width: var(--ui-border-w-strong);
            border-color: var(--ui-line-strong);
        }

        #status {
            min-block-size: var(--ui-cal-status-h);
            margin: 0;
            display: flex;
            align-items: start;
        }

        #wizard-surface > .prose {
            min-block-size: var(--ui-cal-body-h);
        }

        #cal-weight-slot {
            display: grid;
            align-content: start;
            min-block-size: var(--ui-control-h);
            min-inline-size: 0;
        }

        .actions {
            display: flex;
            flex-wrap: wrap;
            gap: var(--ui-space-3);
            align-items: center;
        }

        .tile {
            display: grid;
            gap: var(--ui-space-1);
            justify-items: start;
            text-align: start;
            inline-size: 100%;
            min-block-size: var(--ui-control-h);
            padding: var(--ui-space-3);
            border: var(--ui-border-w) solid var(--ui-line);
            border-radius: var(--ui-radius);
            background-color: var(--ui-fascia);
            color: inherit;
            font: inherit;
            cursor: pointer;
        }

        .tile[aria-pressed="true"] {
            border-width: var(--ui-border-w-strong);
            border-color: var(--ui-line-strong);
        }

        .tile[aria-pressed="true"] .ui-heading,
        .tile[aria-pressed="true"] .ui-caption {
            color: inherit;
        }

        .entry {
            display: flex;
            flex-wrap: wrap;
            align-items: baseline;
            gap: var(--ui-space-2) var(--ui-space-3);
            min-inline-size: 0;
        }

        .entry > .grow {
            flex: 1 1 auto;
            min-inline-size: 0;
        }

        .skin-card {
            position: relative;
        }

        /* THE WHOLE TILE IS THE TARGET. A press area smaller than the thing it looks like
         * is the class of defect a tile grid invites, so the button fills the card
         * rather than sitting inside it. */
        .skin-press {
            all: unset;
            display: block;
            cursor: pointer;
            min-inline-size: 0;
        }

        .skin-press:focus-visible {
            outline: var(--ui-focus-w) solid var(--ui-focus);
            outline-offset: var(--ui-focus-offset);
        }

        .skin-name {
            display: grid;
            gap: var(--ui-space-1);
            min-inline-size: 0;
        }

        .skin-meta {
            display: flex;
            flex-wrap: wrap;
            align-items: baseline;
            gap: var(--ui-space-3);
            min-inline-size: 0;
        }

        .skin-active {
            position: absolute;
            inset-block-start: var(--ui-space-3);
            inset-inline-end: var(--ui-space-3);
            padding: var(--ui-space-1) var(--ui-space-2);
            border-radius: var(--ui-radius-sm);
            background: var(--ui-selected-face);
            color: var(--ui-selected-ink);
        }

        :not(.tile):not(.chip):not(.day):is(
            [aria-pressed="true"],
            [aria-selected="true"],
            [aria-checked="true"],
            [aria-current="true"],
            .is-selected
        ) {
            background-color: transparent;
            color: inherit;
            font-weight: inherit;
            box-shadow: none;
            text-shadow: none;
        }

        /* A label on the left, a control on the right — the shape #29 has for a
         * primitive row, borrowed for the two rows that are not registry rows. */
        .sw-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: var(--ui-space-3);
            flex-wrap: wrap;
        }

        .sw-row > ui-text-field {
            flex: none;
            inline-size: var(--_ui-form-control-w);
        }

        .form-row {
            display: grid;
            grid-template-columns: minmax(0, 1fr) var(--_ui-form-control-w);
            align-items: center;
            gap: var(--ui-space-5);
            min-inline-size: 0;
        }

        .form-row[data-control="switch"] {
            grid-template-columns: minmax(0, 1fr) auto;
        }

        .form-row > .sw-label {
            min-inline-size: 0;
        }

        .sw-stack {
            display: grid;
            gap: var(--ui-space-1);
        }

        .sw-label {
            display: grid;
            gap: var(--ui-space-1);
            min-inline-size: 0;
        }

        /* The row's own opener fills the space the list row gives it, so the whole
         * time-and-days line is the target rather than the text's own width. */
        .sw-schedule-open {
            display: grid;
            gap: var(--ui-space-1);
            justify-items: start;
            text-align: start;
            flex: 1 1 auto;
            min-inline-size: 0;
            padding: 0;
            border: 0;
            background: none;
            color: inherit;
            font: inherit;
            cursor: pointer;
        }

        .sw-editor {
            display: grid;
            gap: var(--ui-space-5);
        }

        .sw-days {
            display: flex;
            flex-wrap: wrap;
            gap: var(--ui-space-2);
        }

        .day {
            display: grid;
            place-items: center;
            min-inline-size: var(--ui-control-h);
            block-size: var(--ui-control-h);
            padding-inline: var(--ui-space-2);
            border: var(--ui-border-w) solid var(--ui-line);
            border-radius: var(--ui-radius);
            background-color: var(--ui-fascia);
            color: inherit;
            font: inherit;
            cursor: pointer;
        }

        .day[aria-pressed="true"] {
            border-width: var(--ui-border-w-strong);
            border-color: var(--ui-line-strong);
        }

        .doc-link {
            color: var(--ui-accent-ink);
            text-decoration: underline;
            text-underline-offset: 0.15em;
            justify-self: start;
        }

        .bindings {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto auto;
            align-items: center;
            gap: var(--ui-space-3) var(--ui-space-5);
            min-inline-size: 0;
        }

        .binding {
            display: grid;
            grid-column: 1 / -1;
            grid-template-columns: subgrid;
            align-items: center;
            min-inline-size: 0;
        }

        .bindings-reset {
            justify-self: start;
        }

        .plugins {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto auto;
            align-items: center;
            gap: var(--ui-space-4) var(--ui-space-5);
            min-inline-size: 0;
        }

        .plugin {
            display: grid;
            grid-column: 1 / -1;
            grid-template-columns: subgrid;
            align-items: center;
            min-inline-size: 0;
        }

        .plugin-name {
            display: grid;
            gap: var(--ui-space-1);
            min-inline-size: 0;
        }

        .plugin-title {
            display: flex;
            align-items: baseline;
            gap: var(--ui-space-3);
            flex-wrap: wrap;
            min-inline-size: 0;
        }

        .plugin-blurb {
            display: -webkit-box;
            -webkit-box-orient: vertical;
            -webkit-line-clamp: 2;
            overflow: hidden;
        }

        .thread {
            margin: 0;
            padding: 0;
            list-style: none;
            display: grid;
            gap: var(--ui-space-5);
            max-block-size: calc(0.4 * var(--ui-app-h));
            overflow-y: auto;
            min-inline-size: 0;
        }

        .message {
            display: grid;
            gap: var(--ui-space-1);
            min-inline-size: 0;
        }

        .message-head {
            display: flex;
            align-items: baseline;
            flex-wrap: wrap;
            gap: var(--ui-space-3);
            min-inline-size: 0;
        }

        .message-body {
            margin: 0;
            max-inline-size: var(--ui-measure);
            white-space: pre-wrap;
        }

        .devices {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto auto auto;
            align-items: center;
            gap: var(--ui-space-3) var(--ui-space-5);
            min-inline-size: 0;
        }

        .device,
        .device-head {
            display: grid;
            grid-column: 1 / -1;
            grid-template-columns: subgrid;
            align-items: center;
            min-inline-size: 0;
        }

        .device-name {
            display: grid;
            gap: var(--ui-space-1);
            min-inline-size: 0;
        }

        .device-actions {
            display: flex;
            gap: var(--ui-space-3);
        }

        .resets {
            display: grid;
            grid-template-columns: auto minmax(0, 1fr) auto auto;
            align-items: baseline;
            gap: var(--ui-space-2) var(--ui-space-5);
            min-inline-size: 0;
        }

        .reset {
            display: grid;
            grid-column: 1 / -1;
            grid-template-columns: subgrid;
            align-items: baseline;
            min-inline-size: 0;
        }

        .resets-num {
            text-align: end;
        }

        .thumbs {
            display: flex;
            flex-wrap: wrap;
            gap: var(--ui-space-3);
            min-inline-size: 0;
        }

        .thumb {
            inline-size: var(--_ui-thumb-size);
            block-size: calc(var(--_ui-thumb-size) * 0.625);
            object-fit: cover;
            border-radius: var(--ui-radius);
            border: var(--ui-border-w) solid var(--ui-line);
        }

        .group[data-inert] {
            opacity: var(--ui-opacity-disabled);
        }

        .steps {
            margin: 0;
            padding-inline-start: var(--ui-space-5);
            display: grid;
            gap: var(--ui-space-2);
        }

        ui-empty-state .steps,
        ui-empty-state .prose {
            text-align: start;
        }

        ui-list-row {
            display: flex;
        }
    `,

    selectionSurface];

    #i18n = new I18nController(this);

    /** Every store subscription this leaf holds, so `disconnectedCallback` undoes them. */
    #unwatch = [];

    /** The last machine step seen, so the walk can notice a zeroing run finishing. */
    #lastStep = null;

    #loadKey = null;

    constructor() {
        super();
        this.leafId = '';
        this.deps = null;
        this.theme = null;
        this._version = 0;
        this._ledZone = LED_ZONE_ITEMS[0].value;
        this._ledBank = LED_BANKS[0];
        this._weight = CAL_DEFAULT_WEIGHT;
        /* THE TWO BITS OF THE WALK THE MACHINE CANNOT REPORT — see `#calStage`. */
        this._calStarted = false;
        this._calZeroed = false;
        /* What the scale reads now, for the check step. Whole tenths of a gram. */
        this._scaleWeight = null;
        this._schedule = null;
        this._typing = null;
        this._confirm = null;
        this._machineState = null;
        this._procedureSeen = null;
        this._defaultsFailed = false;
        this._pluginDraft = null;
        this._pluginSettingsFor = null;
        this._pluginOpenFailed = false;
        this._feedback = null;
        this._support = null;
        this._supportIncomplete = false;
        this._nightEdit = null;
        this._updateRefusal = null;
        this._wifiHost = '';
        this._flashPending = null;
        this._flashRejected = null;
        this._captureAction = null;
        this._bindingConflict = null;
    }

    connectedCallback() {
        super.connectedCallback();
        this.#watch();
    }

    disconnectedCallback() {
        super.disconnectedCallback?.();
        this.#drop();
        this.#stopCapture();
    }

    updated(changed) {
        super.updated?.(changed);
        if (changed.has('deps') || changed.has('theme')) this.#watch();
        if (changed.has('leafId') || changed.has('deps')) {
            this.#lastStep = null;
            this._calStarted = false;
            this._calZeroed = false;
            this._schedule = null;
            this._confirm = null;
            this._flashPending = null;
            this._flashRejected = null;
            this._defaultsFailed = false;
            this._pluginDraft = null;
            this._pluginOpenFailed = false;
            this._feedback = null;
            this._nightEdit = null;
            this._updateRefusal = null;
            this._wifiHost = '';
            this.deps?.scaleConnect?.clearWriteError?.();
            this.#stopCapture();
            this._captureAction = null;
            this._bindingConflict = null;
            this.#loadKey = null;
            this.#load();
        }
    }

    #drop() {
        for (const off of this.#unwatch) off();
        this.#unwatch = [];
    }

    #watch() {
        this.#drop();
        const bump = () => { this._version += 1; };
        const scaleFeed = this.deps?.scaleFeed;
        if (scaleFeed && typeof scaleFeed.subscribe === 'function') {
            this.#unwatch.push(scaleFeed.subscribe((state) => {
                const reading = state && state.status !== FEED_STATUS.STALE ? valueOf(state) : null;
                const grams = reading?.ok === true && hasReading(reading.weight)
                    ? Number(reading.weight)
                    : NaN;
                const next = Number.isFinite(grams) ? Math.round(grams * 10) / 10 : null;
                if (next !== this._scaleWeight) this._scaleWeight = next;
            }));
        }
        const machineFeed = this.deps?.machineFeed;
        if (machineFeed && typeof machineFeed.subscribe === 'function') {
            this.#unwatch.push(machineFeed.subscribe((state) => {
                const name = state?.value?.state;
                const next = typeof name === 'string' && name !== '' ? name : null;
                if (next === this._machineState) return;
                this._machineState = next;
                if (next === MACHINE_STATE.DESCALING || next === MACHINE_STATE.AIR_PURGE) {
                    this._procedureSeen = next;
                }
            }));
        }
        const updateFeed = this.deps?.appUpdate?.feed;
        if (updateFeed && typeof updateFeed.subscribe === 'function') {
            this.#unwatch.push(updateFeed.subscribe(bump));
        }
        for (const name of ['machineInfo', 'led', 'calibration', 'skins', 'firmware', 'appInfo', 'presence', 'plugins', 'account', 'support', 'feedback', 'scaleConnect', 'app', 'machineState']) {
            const store = this.deps?.[name];
            if (store && typeof store.subscribe === 'function') this.#unwatch.push(store.subscribe(bump));
        }
        const settings = this.deps?.settings;
        if (settings && typeof settings.subscribe === 'function') {
            for (const key of ['theme', 'language', 'lastBrightness', 'keyboardBindings']) {
                try { this.#unwatch.push(settings.subscribe(key, bump)); } catch { /* not a settings key here */ }
            }
        }
        const watchAllowed = this.deps?.watchAllowed;
        if (typeof watchAllowed === 'function') {
            this.#unwatch.push(watchAllowed(() => { bump(); this.#load(); }));
        }
        if (this.theme && typeof this.theme.subscribe === 'function') {
            this.#unwatch.push(this.theme.subscribe(bump));
        }
    }

    #load() {
        const deps = this.deps;
        if (!deps || !this.leafId) return;

        const capability = LEAF_CAPABILITY[this.leafId] ?? null;
        const key = `${this.leafId}|${capability && !this.#allowed(capability) ? 'closed' : 'open'}`;
        if (key === this.#loadKey) return;
        this.#loadKey = key;

        const go = (promise) => Promise.resolve(promise).catch(() => {});

        switch (this.leafId) {
            case 'machine-machine-info':
                go(deps.machineInfo?.load());
                break;
            case 'display-skin':
                go(deps.skins?.load());
                break;
            case 'updates-skin-app':
                go(deps.skins?.load());
                go(deps.appInfo?.load());
                break;
            case 'units-language-select-language':
                go(deps.settings?.load('language'));
                break;
            case 'accessories-lighting':
                if (this.#allowed('ledStrip')) go(deps.led?.load());
                break;
            case 'calibration-load-cells':
                if (this.#allowed('scaleCalibration')) go(deps.calibration?.read());
                break;
            case 'updates-firmware-update':
                go(deps.firmware?.load());
                break;
            case 'machine-sleep-wake-schedules':
                /* GATED BEFORE THE READ, like the LED and load-cell leaves above: on a
                 * machine with no wake scheduling there is nothing to ask for. */
                if (this.#allowed('wakeSchedule')) go(deps.presence?.load());
                go(deps.settings?.load('clockFormat'));
                break;
            case 'extensions-plugins':
                go(deps.plugins?.load());
                break;
            case 'extensions-visualizer':
                go(Promise.resolve(deps.plugins?.load()).then(() => deps.plugins?.loadSettings(VISUALIZER_PLUGIN_ID)));
                break;
            case 'help-talk-to-decent':
                go(Promise.resolve(deps.account?.load()).then(() => {
                    if (deps.account?.get?.()?.loggedIn === true) return deps.support?.load();
                    return null;
                }));
                go(deps.machineInfo?.load());
                go(deps.appInfo?.load());
                break;
            case 'connection-machine':
                go(deps.scaleConnect?.loadDevices());
                go(deps.scaleConnect?.loadPreferred());
                break;
            case 'connection-scale':
                go(deps.scaleConnect?.loadDevices());
                go(deps.scaleConnect?.loadPreferred());
                go(deps.scaleConnect?.loadEndpoints());
                break;
            case 'help-keyboard-shortcuts':
                go(deps.settings?.load('keyboardBindings'));
                break;
            case 'accessories-usb-charger':
                go(deps.app?.load());
                /* AND THE CLOCK FORMAT, for the same reason the schedules leaf reads it. */
                go(deps.settings?.load('clockFormat'));
                break;
            default:
                break;
        }
    }

    /** Fail-closed on ABSENT and on UNKNOWN alike. No capability store at all is UNKNOWN. */
    #allowed(capability) {
        return this.deps?.allowed?.(capability) === true;
    }

    render() {
        return html`${this.#leafBody()}${this.#numberPad()}`;
    }

    #numberPad() {
        const t = this.#i18n.t;
        const id = this._typing;
        const field = id ? this.#numberField(id) : null;
        if (!field) return nothing;
        return html`<ui-numeric-keypad
            id="number-pad"
            ?open=${true}
            heading=${field ? t(field.heading) : ''}
            .limits=${field?.limits ?? null}
            .limitKey=${field?.key ?? ''}
            .value=${field && Number.isFinite(field.value) ? String(field.value) : ''}
            unit=${field?.range?.unit ?? ''}
            .level=${field?.level ?? 1}
            @confirm=${this.#onNumberConfirm}
            @open-change=${this.#onNumberClose}
        ></ui-numeric-keypad>`;
    }

    #numberField(id) {
        if (id === 'cal-weight') {
            const limits = this.deps?.limits ?? null;
            if (!limits?.calibrationWeight) return null;
            return {
                heading: 'Calibration weight',
                limits,
                key: 'calibrationWeight',
                range: limits.calibrationWeight,
                value: this._weight,
                level: 1,
            };
        }
        const field = BESPOKE_NUMBER_FIELDS[id];
        if (!field) return null;
        return {
            heading: field.heading,
            limits: bespokeLimitsFor(id),
            key: id,
            range: field.range,
            value: this.#numberValue(id),
            level: id === 'schedule-keep-awake' ? 2 : 1,
        };
    }

    /** Read back through the store, every render. Never a copy taken at press time. */
    #numberValue(id) {
        switch (id) {
            case 'schedule-keep-awake': return this._schedule?.keepAwakeFor ?? null;
            default: return null;
        }
    }

    /** A stepper's number was pressed. */
    #onNumberEdit = (event) => {
        const id = event?.currentTarget?.id;
        if (typeof id === 'string' && id !== '') this._typing = id;
    };

    #onNumberConfirm = (event) => {
        const value = event?.detail?.value;
        const id = this._typing;
        this._typing = null;
        if (!Number.isFinite(value)) return;
        const detail = { detail: { value } };
        switch (id) {
            case 'schedule-keep-awake': this.#onScheduleKeepAwake(detail); break;
            case 'cal-weight': this._weight = value; break;
            default: break;
        }
    };

    /* #53 announces its own close — Escape, the scrim, Cancel. Only a CLOSE is acted
     * on: `open-change` fires on open too. */
    #onNumberClose = (event) => {
        if (event?.detail?.open === false) this._typing = null;
    };

    #leafBody() {
        switch (this.leafId) {
            case 'machine-machine-info': return this.#machineInfo();
            case 'machine-sleep-wake-schedules': return this.#sleepWake();
            case 'display-skin': return this.#skin();
            case 'updates-skin-app': return this.#skinApp();
            case 'units-language-select-language': return this.#language();
            case 'calibration-load-cells': return this.#loadCells();
            case 'display-screen-saver': return this.#screenSaver();
            case 'accessories-lighting': return this.#lighting();
            case 'updates-firmware-update': return this.#firmware();
            case 'maintenance-machine-descaling': return this.#descaling();
            case 'maintenance-transport-mode': return this.#transportMode();
            case 'extensions-plugins': return this.#plugins();
            case 'extensions-visualizer': return this.#visualizer();
            case 'help-talk-to-decent': return this.#decentAccount();
            case 'help-send-feedback': return this.#feedback();
            case 'accessories-usb-charger': return this.#usbCharger();
            case 'connection-machine': return this.#machineConnection();
            case 'connection-scale': return this.#scaleConnection();
            case 'help-keyboard-shortcuts': return this.#keyboard();
            case 'calibration-default-load-settings': return this.#defaults();
            default: return nothing;
        }
    }

    #machineInfo() {
        const t = this.#i18n.t;
        const state = this.deps?.machineInfo?.get?.() ?? null;
        const info = state?.info ?? null;

        if (!info) {
            return html`<ui-empty-state
                id="info-empty"
                heading=${t('No machine information')}
                body=${t('The machine has not answered yet. It reports its model, firmware and serial number once it is connected.')}
            ></ui-empty-state>`;
        }

        const items = [
            { term: t('Model'), value: info.model },
            { term: t('Firmware version'), value: info.version },
            { term: t('Serial number'), value: info.serialNumber },
            {
                term: t('Group head controller'),
                value: typeof info.GHC === 'boolean'
                    ? t(info.GHC ? 'Enabled' : 'Not fitted')
                    : undefined,
            },
            ...this.#machineExtras(info),
        ];

        return html`
            <section class="group" id="info">
                <div class="fact-head">
                    <h3 class="ui-heading">${t('Machine')}</h3>
                    <ui-button id="info-copy" @click=${() => this.#copyInfo(items)}
                        >${t('Copy all')}</ui-button>
                </div>
                <dl class="facts">
                    ${items.map((item) => html`<div class="fact" data-term=${item.term}>
                        <dt class="ui-body">${item.term}</dt>
                        <dd class="ui-body ui-numeric">${
                            item.value === undefined || item.value === null || item.value === ''
                                ? MACHINE_INFO_DASH
                                : item.value
                        }</dd>
                    </div>`)}
                </dl>
            </section>`;
    }

    #machineExtras(info) {
        const t = this.#i18n.t;
        const extra = info?.extra;
        if (!extra || typeof extra !== 'object' || Array.isArray(extra)) return [];
        return Object.entries(extra)
            .filter(([key]) => !MACHINE_INFO_INTERNAL_KEYS.has(key))
            .map(([key, value]) => {
                const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
                const unit = MACHINE_INFO_UNITS[key]
                    ?? MACHINE_INFO_UNITS[key.charAt(0).toLowerCase() + key.slice(1)];
                const shown = typeof value === 'boolean'
                    ? t(value ? 'Enabled' : 'Disabled')
                    : `${value}${unit ? ` ${unit}` : ''}`;
                return { term: t(label), value: shown };
            });
    }

    #copyInfo(items) {
        const text = items
            .filter((row) => row.value !== undefined && row.value !== null && row.value !== '')
            .map((row) => `${row.term}: ${row.value}`)
            .join('\n');
        try {
            void globalThis.navigator?.clipboard?.writeText?.(text)?.catch?.(() => {});
        } catch { /* no clipboard here; the card is still readable */ }
    }

    #sleepWake() {
        const t = this.#i18n.t;
        if (!this.#allowed('wakeSchedule')) return nothing;

        const presence = this.deps?.presence;
        const state = presence?.get?.() ?? null;

        if (!state || state.status === PRESENCE_STATUS.UNAVAILABLE) {
            return html`<ui-empty-state
                id="presence-unavailable"
                heading=${t('Sleep and wake settings are not available')}
                body=${t('The machine has not answered for its presence settings. They arrive once it is connected.')}
            ></ui-empty-state>`;
        }

        return html`
            <section class="group" id="schedules">
                <div class="fact-head">
                    <h3 class="ui-heading">${t('Wake schedules')}</h3>
                    <ui-button id="schedule-add" variant="primary" @click=${this.#onScheduleAdd}
                        >${t('Add schedule')}</ui-button>
                </div>
                <p class="ui-caption prose"
                    >${t('A schedule wakes the machine at a set time. With no days chosen it runs every day.')}</p>
                ${state.schedules.length === 0
                    ? html`<ui-empty-state
                        id="schedules-empty"
                        heading=${t('No wake schedules')}
                        body=${t('Add one to have the machine heat up before you get to it.')}
                    ></ui-empty-state>`
                    : state.schedules.map((schedule) => this.#scheduleRow(schedule))}
            </section>

            ${this.#scheduleDialog()}
        `;
    }

    /** One served schedule. The row opens the editor; the switch and Delete act at once. */
    #scheduleRow(schedule) {
        const t = this.#i18n.t;
        return html`<ui-list-row
            class="sw-schedule"
            data-schedule=${schedule.id}
        >
            <button
                class="sw-schedule-open"
                type="button"
                @click=${() => { this._schedule = draftFrom(schedule); }}
            >
                <span class="ui-heading">${this.#timeLabel(parseTime24(schedule.time))}</span>
                <span class="ui-caption">${dayWords(schedule.daysOfWeek, t)}${keepAwakeWords(schedule.keepAwakeFor, t)}</span>
            </button>
            <ui-switch
                slot="favourite"
                aria-label=${t('Schedule enabled')}
                ?checked=${schedule.enabled === true}
                @change=${(event) => this.#onScheduleEnabled(schedule.id, event)}
            ></ui-switch>
            <ui-button
                slot="favourite"
                variant="danger"
                @click=${() => this.#onScheduleDelete(schedule.id)}
            >${t('Delete')}</ui-button>
        </ui-list-row>`;
    }

    /**
     * The editor. ONE DIALOG FOR BOTH ADD AND EDIT, because the fields are the same and
     * two dialogs would be two places to add the fifth field.
     */
    #scheduleDialog() {
        const t = this.#i18n.t;
        const draft = this._schedule;
        if (!draft) return nothing;

        return html`<ui-dialog
            id="schedule-dialog"
            heading=${draft.id ? t('Edit schedule') : t('Add schedule')}
            .open=${true}
            @open-change=${this.#onScheduleDialogClose}
        >
            <div slot="body" class="sw-editor">
                <ui-time-picker
                    id="schedule-time"
                    label=${t('Wake at')}
                    value=${draft.time}
                    clock-format=${this.#clockFormat}
                    auto-advance
                    @change=${this.#onScheduleTime}
                ></ui-time-picker>
                <div class="sw-stack">
                    <span class="ui-heading">${t('Days')}</span>
                    <div class="sw-days" role="group" aria-label=${t('Days')}>
                        ${WEEKDAYS.map((day) => html`<button
                            type="button"
                            class="day"
                            data-day=${day.iso}
                            aria-pressed=${draft.days.includes(day.iso) ? 'true' : 'false'}
                            aria-label=${t(day.name)}
                            @click=${() => this.#onScheduleDay(day.iso)}
                        ><span class="ui-heading">${t(day.label)}</span></button>`)}
                    </div>
                    <span class="ui-caption">${t('Choose none to run every day.')}</span>
                </div>
                <div class="sw-row">
                    <div class="sw-label">
                        <span class="ui-heading">${t('Stay awake for')}</span>
                        <span class="ui-caption">${t('Zero lets the sleep timeout take over.')}</span>
                    </div>
                    <ui-stepper
                        id="schedule-keep-awake"
                        editable
                        .value=${draft.keepAwakeFor}
                        .min=${KEEP_AWAKE_RANGE.min}
                        .max=${KEEP_AWAKE_RANGE.max}
                        .step=${KEEP_AWAKE_RANGE.step}
                        unit=${KEEP_AWAKE_RANGE.unit}
                        @change=${this.#onScheduleKeepAwake}
                        @edit=${this.#onNumberEdit}
                    ></ui-stepper>
                </div>
            </div>
            <ui-button slot="actions" variant="ghost" @click=${this.#onScheduleCancel}>${t('Cancel')}</ui-button>
            <ui-button slot="actions" variant="primary" @click=${this.#onScheduleSave}>${t('Save')}</ui-button>
        </ui-dialog>`;
    }

    #onScheduleAdd = () => { this._schedule = draftFrom(null); };

    #onScheduleCancel = () => { this._schedule = null; };

    #onScheduleDialogClose = (event) => {
        if (event?.detail?.open === false) this._schedule = null;
    };

    #onScheduleTime = (event) => {
        const value = event?.detail?.value;
        if (typeof value !== 'string' || !this._schedule) return;
        this._schedule = { ...this._schedule, time: value };
    };

    #onScheduleDay(iso) {
        const draft = this._schedule;
        if (!draft) return;
        const days = draft.days.includes(iso)
            ? draft.days.filter((day) => day !== iso)
            : [...draft.days, iso].sort((a, b) => a - b);
        this._schedule = { ...draft, days };
    }

    #onScheduleKeepAwake = (event) => {
        const value = event?.detail?.value;
        if (!Number.isFinite(value) || !this._schedule) return;
        this._schedule = { ...this._schedule, keepAwakeFor: value };
    };

    #onScheduleSave = async () => {
        const draft = this._schedule;
        const presence = this.deps?.presence;
        if (!draft || !presence) return;
        const ok = draft.id
            ? await presence.updateSchedule(draft.id, {
                time: draft.time, days: draft.days, keepAwakeFor: draft.keepAwakeFor,
            })
            : await presence.addSchedule({
                time: draft.time, days: draft.days, enabled: true, keepAwakeFor: draft.keepAwakeFor,
            });
        if (ok) this._schedule = null;
    };

    #onScheduleEnabled(id, event) {
        const next = event?.detail?.checked;
        if (typeof next !== 'boolean') return;
        void this.deps?.presence?.updateSchedule(id, { enabled: next });
    }

    #onScheduleDelete(id) {
        void this.deps?.presence?.deleteSchedule(id);
    }

    #skin() {
        const t = this.#i18n.t;
        const state = this.deps?.skins?.get?.() ?? null;
        const skins = state?.skins ?? [];

        const switching = state?.switching ?? null;
        const switched = state?.switched ?? null;
        const failed = state?.switchError ?? null;

        return html`${this.#themeBank()}
        <section class="group" id="skins">
            <h3 class="ui-heading">${t('Active skin')}</h3>
            <p class="ui-caption prose">${t('Tap a skin to switch to it. The screen reloads itself.')}</p>
            ${failed
                ? html`<p id="skin-failed" class="ui-caption prose"
                    >${t('The machine refused to switch skins. It is still serving the one you are looking at.')}</p>`
                : nothing}
            ${switched
                ? html`<div class="fact-head" id="skin-switched">
                    <span class="ui-body">${t('Skin changed. Reload to see it.')}</span>
                    <ui-button variant="primary" @click=${this.#onReload}>${t('Reload')}</ui-button>
                </div>`
                : nothing}
            ${skins.length === 0
                ? html`<ui-empty-state
                    id="skins-empty"
                    heading=${t('No skins to show')}
                    body=${t('The machine has not listed its installed skins.')}
                  ></ui-empty-state>`
                : html`<ui-card-grid id="skin-grid" columns="2" label=${t('Installed skins')}>
                    ${skins.map((skin) => this.#skinCard(skin, state.defaultId, switching))}
                  </ui-card-grid>`}
        </section>`;
    }

    /** The reload the switch needs. The one navigation this element performs. */
    #onReload = () => {
        const view = this.ownerDocument?.defaultView ?? null;
        if (view && view.location && typeof view.location.reload === 'function') view.location.reload();
    };

    #themeBank() {
        const t = this.#i18n.t;
        const theme = this.theme ?? null;
        if (!theme || typeof theme.set !== 'function') return nothing;
        return html`<div class="group inline">
            <h3 class="ui-heading" id="theme-label">${t('Theme')}</h3>
            <ui-bank
                id="theme-bank"
                label=${t('Theme')}
                .items=${THEME_ITEMS.map((item) => ({ value: item.value, label: t(item.label) }))}
                value=${theme.theme ?? ''}
                @change=${(event) => this.#onTheme(event)}
            ></ui-bank>
        </div>`;
    }

    #onTheme(event) {
        const chosen = event.detail?.value;
        if (!chosen) return;
        void Promise.resolve(this.theme?.set(chosen)).catch(() => {});
    }

    #skinCard(skin, activeId, switching) {
        const t = this.#i18n.t;
        const active = skin.id === activeId;
        const busy = switching === skin.id;
        const body = html`<span class="skin-name">
                <span class="ui-heading">${skin.name}</span>
                <span class="skin-meta">
                    <span class="ui-caption ui-numeric">${skinVersionText(skin.version)}</span>
                    <span class="ui-microcap">${t(skin.bundled ? 'Bundled' : 'Installed')}</span>
                    ${busy ? html`<span class="ui-microcap">${t('Switching')}</span>` : nothing}
                </span>
            </span>
            ${active ? html`<span class="skin-active ui-microcap">${t('Active')}</span>` : nothing}`;

        return active
            ? html`<ui-card class="skin-card" data-skin=${skin.id} data-active
                >${body}</ui-card>`
            : html`<ui-card class="skin-card" data-skin=${skin.id}>
                <button
                    type="button"
                    class="skin-press"
                    ?disabled=${Boolean(switching)}
                    @click=${() => { void this.deps?.skins?.switchTo?.(skin.id); }}
                >${body}</button>
            </ui-card>`;
    }

    #skinApp() {
        const t = this.#i18n.t;
        const state = this.deps?.skins?.get?.() ?? null;
        const skins = state?.skins ?? [];
        const checked = skins.filter((skin) => skin.lastChecked !== null).length;
        const moved = new Map((state?.updated ?? []).map((entry) => [entry.id, entry]));

        const installed = skins.length === 0
            ? html`<ui-empty-state
                id="updates-empty"
                heading=${t('No skins to show')}
                body=${t('The machine has not listed its installed skins.')}
            ></ui-empty-state>`
            : this.#skinList(state, skins, checked, moved);

        return html`${this.#decaid()}${installed}`;
    }

    #skinList(state, skins, checked, moved) {
        const t = this.#i18n.t;
        const updating = state?.updating === true;
        const failed = state?.updateError ?? null;
        const ran = state?.updateRan === true;
        const checkedText = [checked, skins.length].join(' / ');

        return html`<section class="group" id="updates">
            <div class="fact-head">
                <h3 class="ui-heading">${t('Installed skins')}</h3>
                <ui-button
                    id="skins-update"
                    variant="primary"
                    ?disabled=${updating}
                    @click=${() => { void this.deps?.skins?.updateAll?.(); }}
                >${t(updating ? 'Updating' : 'Update all skins')}</ui-button>
            </div>
            <p class="ui-caption prose">${t('Downloads and installs the newest version of every skin that came from a source. Switch skins in Display › Skin.')}</p>
            ${ran
                ? html`<p id="updates-outcome" class="ui-caption prose"
                    >${moved.size === 0
                        ? t('Every skin was already current.')
                        : (moved.size === 1
                            ? t('One skin was updated.')
                            : t('{n} skins were updated.', { n: moved.size }))}</p>`
                : nothing}
            ${failed
                ? html`<p id="updates-failed" class="ui-caption prose"
                    >${t('The machine could not finish the update. Nothing was changed.')}</p>`
                : nothing}

            <div class="fact-head">
                <span class="ui-caption">${t('Skins the machine has checked for a newer version')}</span>
                <span class="ui-caption ui-numeric">${checkedText}</span>
            </div>

            <div class="plugins" id="update-list">
                ${skins.map((skin) => this.#skinRow(skin, state, moved.get(skin.id) ?? null))}
            </div>
        </section>`;
    }

    #skinRow(skin, state, updated) {
        const t = this.#i18n.t;
        const language = this.deps?.settings?.value?.('language') ?? this.deps?.defaultLanguage;
        const day = shortDate(skin.lastChecked, language);
        const when = skin.lastChecked === null
            ? t('Never checked')
            : (day === null ? MACHINE_INFO_DASH : t('Checked {day}', { day }));

        return html`<div class="plugin update-row" data-skin=${skin.id}>
            <span class="skin-name">
                <span class="ui-heading">${skin.name}</span>
                <span class="skin-meta">
                    <span class="ui-caption ui-numeric">${skinVersionText(skin.version)}</span>
                    <span class="ui-microcap">${when}</span>
                    ${updated && skinVersionText(updated.to) !== ''
                        ? html`<ui-badge class="skin-updated" variant="attention"
                            >${t('Updated to {version}', { version: skinVersionText(updated.to) })}</ui-badge>`
                        : nothing}
                </span>
            </span>
            <span></span>
            <span class="device-actions">
                ${skin.id === state?.defaultId || skin.bundled
                    ? nothing
                    : html`<ui-button
                        class="skin-remove"
                        variant="danger"
                        @click=${() => { void this.deps?.skins?.remove?.(skin.id); }}
                    >${t('Remove')}</ui-button>`}
            </span>
        </div>`;
    }

    #decaid() {
        const t = this.#i18n.t;
        const info = this.deps?.appInfo?.get?.()?.info ?? null;
        const frame = this.deps?.appUpdate?.feed?.get?.()?.value ?? null;
        const dash = (value) => (typeof value === 'string' && value !== '' ? value : MACHINE_INFO_DASH);

        const version = info?.version ?? null;
        const build = info?.buildNumber ?? null;
        const versionText = version === null
            ? MACHINE_INFO_DASH
            : (build === null ? version : t('{version} ({build})', { version, build }));

        const phase = typeof frame?.phase === 'string' ? frame.phase : null;
        const latest = typeof frame?.latestVersion === 'string' ? frame.latestVersion : null;
        const releaseUrl = typeof frame?.releaseUrl === 'string' ? frame.releaseUrl : null;
        const installable = frame?.installable === true;
        const progress = Number.isFinite(frame?.progress) ? frame.progress : null;
        const busy = phase === 'checking' || phase === 'downloading' || phase === 'installing';
        const available = phase === 'available' && latest !== null;
        const error = typeof frame?.error === 'string' ? frame.error : null;

        return html`<section class="group" id="app-info">
            <div class="fact-head">
                <h3 class="ui-heading">${t('Decaid')}</h3>
                <ui-button
                    id="app-check"
                    ?disabled=${busy || !this.deps?.appUpdate}
                    @click=${this.#onCheckUpdate}
                >${t(phase === 'checking' ? 'Checking' : 'Check for updates')}</ui-button>
            </div>

            <dl class="facts">
                <div class="fact" data-term="app-version">
                    <dt class="ui-body">${t('Version')}</dt>
                    <dd class="ui-body ui-numeric">${versionText}</dd>
                </div>
                <div class="fact" data-term="app-build">
                    <dt class="ui-body">${t('Build')}</dt>
                    <dd class="ui-body ui-numeric">${dash(info?.fullVersion)}</dd>
                </div>
                <div class="fact" data-term="app-branch">
                    <dt class="ui-body">${t('Source')}</dt>
                    <dd class="ui-body">${dash(info?.branch)}</dd>
                </div>
                <div class="fact" data-term="app-commit">
                    <dt class="ui-body">${t('Commit')}</dt>
                    <dd class="ui-body ui-numeric">${dash(info?.commitShort)}</dd>
                </div>
                <div class="fact" data-term="app-store">
                    <dt class="ui-body">${t('App Store')}</dt>
                    <dd class="ui-body">${info?.appStore === null || info?.appStore === undefined
                        ? MACHINE_INFO_DASH
                        : t(info.appStore ? 'Yes' : 'No')}</dd>
                </div>
            </dl>

            <div class="fact-head">
                <span class="ui-caption" id="app-update-state"
                    >${available
                        ? t('{version} is available.', { version: latest })
                        : (phase === 'checking'
                            ? t('Looking for a newer build…')
                            : (phase === 'downloading' || phase === 'installing'
                                ? t('Installing the update.')
                                : (latest === null
                                    ? t('Whether a newer build exists is not known.')
                                    : t('This is the newest build.'))))}</span>
                ${available
                    ? html`<ui-badge id="app-update-badge" variant="attention"
                        >${t('Update available')}</ui-badge>`
                    : nothing}
            </div>

            ${progress === null
                ? nothing
                : html`<ui-progress-track
                    id="app-update-progress"
                    .value=${progress}
                    .max=${1}
                    label=${t('Downloading the update')}
                ></ui-progress-track>`}

            ${available && installable
                ? html`<div class="device-actions">
                    <ui-button
                        id="app-install"
                        variant="primary"
                        ?disabled=${busy}
                        @click=${() => { this.deps?.appUpdate?.install?.(); }}
                    >${t('Install {version}', { version: latest })}</ui-button>
                </div>`
                : nothing}

            ${available && !installable
                ? html`<p id="app-install-elsewhere" class="ui-caption prose"
                    >${t('This build cannot install updates itself. Open the release page to get the new version.')}</p>`
                : nothing}

            ${latest !== null && releaseUrl !== null
                ? html`<a
                    id="app-release-notes"
                    class="ui-body doc-link"
                    href=${releaseUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                >${t('Release notes')}</a>`
                : nothing}

            ${error
                ? html`<p id="app-update-error" class="ui-caption prose"
                    >${error}</p
                >`
                : nothing}

            ${this._updateRefusal
                ? html`<p id="app-check-refusal" class="ui-caption prose"
                    >${t('The update check could not be sent: {reason}', { reason: this._updateRefusal })}</p
                >`
                : nothing}
        </section>`;
    }

    #onCheckUpdate = () => {
        const result = this.deps?.appUpdate?.check?.();
        const reason = result && result.ok === false
            ? (typeof result.reason === 'string' && result.reason !== '' ? result.reason : 'refused')
            : null;
        this._updateRefusal = reason;
    };

    #timeLabel(at) {
        const format = normaliseClockFormat(this.deps?.settings?.value?.('clockFormat'));
        const language = this.deps?.settings?.value?.('language') ?? this.deps?.defaultLanguage;
        return typeof at === 'number'
            ? clockTimeFromMinutes(at, format, language)
            : clockTime(at?.h24, at?.m, format, language);
    }

    /** The format the picker in a dialog on this leaf must agree with. One read, one rule. */
    get #clockFormat() {
        return normaliseClockFormat(this.deps?.settings?.value?.('clockFormat'));
    }

    #language() {
        const t = this.#i18n.t;
        const languages = this.deps?.languages ?? [];
        const current = this.deps?.settings?.value?.('language') ?? this.deps?.defaultLanguage;

        const options = languages.map((language) => ({
            value: language.code,
            label: language.english && language.english !== language.endonym
                ? `${language.endonym} (${language.english})${language.partial ? ` · ${t('partial')}` : ''}`
                : `${language.endonym}${language.partial ? ` · ${t('partial')}` : ''}`,
        }));

        return html`<section class="group" id="language">
            <div class="form-row">
                <div class="sw-label">
                    <span class="ui-heading">${t('Display language')}</span>
                </div>
                <ui-select
                    id="language-select"
                    label=${t('Display language')}
                    .options=${options}
                    value=${current}
                    @change=${(event) => this.#pickLanguage(event.detail?.value)}
                ></ui-select>
            </div>
        </section>`;
    }

    #pickLanguage(code) {
        if (typeof code !== 'string' || code === '') return;
        void Promise.resolve(this.deps?.settings?.set?.('language', code)).catch(() => {});
    }

    #loadCells() {
        const t = this.#i18n.t;
        if (!this.#allowed('scaleCalibration')) return nothing;

        const store = this.deps?.calibration ?? null;
        const snapshot = store?.get?.() ?? null;
        const state = snapshot?.state ?? null;

        if (snapshot?.load === CAL_LOAD.UNSUPPORTED || snapshot?.load === CAL_LOAD.UNAVAILABLE) {
            return html`<ui-empty-state
                id="cal-empty"
                heading=${t('Load-cell calibration is not available')}
                body=${t('The machine did not answer with a calibration state.')}
            ></ui-empty-state>`;
        }

        this.#noticeStep(state);
        const stage = this.#calStage(state);
        const button = this.#walkButton(state, stage);
        const limits = this.deps?.limits ?? null;
        const range = limits && limits.calibrationWeight ? limits.calibrationWeight : null;
        const wantsWeight = stage >= 3 && Boolean(range);

        return html`<ui-wizard-column
            id="wizard"
            .steps=${CAL_STEPS.map((label) => t(label))}
            .current=${stage}
            label=${t('Load cell calibration steps')}
        >
            <section class="group" id="wizard-surface">
                <h3 class="ui-heading">${t(this.#walkHeading(state, stage))}</h3>
                <p class="ui-caption prose">${t(this.#walkBody(state, stage))}</p>

                <div id="cal-weight-slot">${wantsWeight
                    ? html`<ui-stepper
                        id="cal-weight"
                        editable
                        .value=${this._weight}
                        .min=${range.min}
                        .max=${range.max}
                        .step=${range.step}
                        unit=${range.unit}
                        label=${t('Calibration weight')}
                        @change=${(event) => { this._weight = event.detail?.value ?? this._weight; }}
                        @edit=${this.#onNumberEdit}
                      ></ui-stepper>`
                    : nothing}</div>

                ${stage === 5 ? this.#calCheck() : this.#calLive(stage)}

                <p id="status" class="ui-caption" role="status">${this.#walkStatus(state)}</p>

                <div class="actions">
                    <ui-button
                        id="cal-primary"
                        variant=${button.variant}
                        @click=${() => this.#walkPress(button)}
                    >${t(button.label)}</ui-button>
                    ${stage > 1
                        ? html`<ui-button
                            id="cal-restart"
                            variant="ghost"
                            @click=${() => this.#walkPress({ command: 'abort', walk: 'restart' })}
                        >${t('Start over')}</ui-button>`
                        : nothing}
                </div>
            </section>
        </ui-wizard-column>`;
    }

    #calStage(state) {
        if (!this._calStarted) return 1;
        const step = state?.step ?? CAL_STEP.IDLE;
        const status = state?.status ?? CAL_STATUS_NONE;
        if (step === CAL_STEP.ZEROING) return 2;
        if (step === CAL_STEP.CAL_LATCH || step === CAL_STEP.TARING) {
            return status === 'incomplete' ? 4 : 3;
        }
        if (status === 'noZero') return 2;
        if (status === 'incomplete') return 4;
        if (status === 'ok') return 5;
        return this._calZeroed ? 3 : 2;
    }

    #calLive(stage) {
        const t = this.#i18n.t;
        if (stage < 2) return nothing;
        const live = this._scaleWeight;
        return html`
            <dl class="facts" id="cal-live">
                <div class="fact">
                    <dt class="ui-body">${t('What the scale reads')}</dt>
                    <dd class="ui-body ui-numeric">${Number.isFinite(live) ? `${live.toFixed(1)} g` : MACHINE_INFO_DASH}</dd>
                </div>
            </dl>`;
    }

    #calCheck() {
        const t = this.#i18n.t;
        const live = this._scaleWeight;
        const entered = Number(this._weight);
        const known = Number.isFinite(live) && Number.isFinite(entered);
        return html`
            <dl class="facts" id="cal-check">
                <div class="fact">
                    <dt class="ui-body">${t('Weight you entered')}</dt>
                    <dd class="ui-body ui-numeric">${Number.isFinite(entered) ? `${entered} g` : MACHINE_INFO_DASH}</dd>
                </div>
                <div class="fact">
                    <dt class="ui-body">${t('What the scale reads')}</dt>
                    <dd class="ui-body ui-numeric">${Number.isFinite(live) ? `${live.toFixed(1)} g` : MACHINE_INFO_DASH}</dd>
                </div>
                <div class="fact">
                    <dt class="ui-body">${t('Difference')}</dt>
                    <dd class="ui-body ui-numeric">${known ? `${(live - entered).toFixed(1)} g` : MACHINE_INFO_DASH}</dd>
                </div>
            </dl>`;
    }

    #noticeStep(state) {
        const step = state?.step ?? null;
        if (step === null) return;
        const wasZeroing = this.#lastStep === CAL_STEP.ZEROING;
        const status = state?.status ?? CAL_STATUS_NONE;
        if (wasZeroing && step === CAL_STEP.COMPLETE && status === CAL_STATUS_NONE) this._calZeroed = true;
        if (wasZeroing && step === CAL_STEP.IDLE) this._calZeroed = false;
        if (step === CAL_STEP.ERROR) { this._calZeroed = false; this._calStarted = false; }
        this.#lastStep = step;
    }

    #walkButton(state, stage) {
        const step = state?.step ?? CAL_STEP.IDLE;
        if (isCalibrationInProgress({ step }) || step === CAL_STEP.TARING) {
            return { label: 'Stop', command: 'abort', variant: 'ghost' };
        }
        if (step === CAL_STEP.ERROR) {
            return { label: 'Try again', command: 'abort', walk: 'restart', variant: 'primary' };
        }
        if (stage === 1) return { label: 'Start', walk: 'start', variant: 'primary' };
        if (stage === 2) return { label: 'Zero', command: 'zero', variant: 'primary' };
        if (stage === 5) return { label: 'Finish', walk: 'finish', variant: 'primary' };
        return { label: 'Latch weight', command: 'latch', variant: 'primary' };
    }

    #walkHeading(state, stage) {
        const step = state?.step ?? CAL_STEP.IDLE;
        if (step === CAL_STEP.ERROR) return 'Calibration stopped';
        if (step === CAL_STEP.ZEROING) return 'Zeroing the load cells';
        if (step === CAL_STEP.CAL_LATCH || step === CAL_STEP.TARING) return 'Reading the weight';
        return CAL_STAGE_HEADING[stage] ?? CAL_STAGE_HEADING[1];
    }

    #walkBody(state, stage) {
        const step = state?.step ?? CAL_STEP.IDLE;
        if (step === CAL_STEP.ERROR) return 'Nothing was written. Start again when the machine is settled.';
        if (step === CAL_STEP.ZEROING) return 'Keep everything off the platform until this finishes.';
        if (step === CAL_STEP.CAL_LATCH || step === CAL_STEP.TARING) return 'Leave the weight where it is until this finishes.';
        return CAL_STAGE_BODY[stage] ?? CAL_STAGE_BODY[1];
    }

    #walkStatus(state) {
        const t = this.#i18n.t;
        if (!state) return '';
        if (isCalibrationInProgress(state)) {
            const phase = t(CAL_SUBSTATE_TEXT[state.subState] ?? 'Working');
            return state.secondsRemaining > 0
                ? `${phase} · ${state.secondsRemaining} ${t('s')}`
                : phase;
        }
        if (state.status === CAL_STATUS_NONE) return '';
        const sentence = CAL_STATUS_TEXT[state.status];
        if (!sentence) return t('The machine reported a status this version does not recognise.');
        const cell = state.detectedCell === 'a' || state.detectedCell === 'b'
            ? ` ${t('Cell')} ${state.detectedCell.toUpperCase()}.`
            : '';
        return `${t(sentence)}${cell}`;
    }

    #walkPress({ command = null, walk = null } = {}) {
        if (walk === 'start') { this._calStarted = true; this._calZeroed = false; }
        if (walk === 'finish') { this._calStarted = false; this._calZeroed = false; }
        if (walk === 'restart') { this._calStarted = true; this._calZeroed = false; }

        const store = this.deps?.calibration;
        if (!store || command === null) return;
        if (command === 'latch') { void store.latch(this._weight).catch(() => {}); return; }
        if (command === 'zero') { void store.zero().catch(() => {}); return; }
        void store.abort().catch(() => {});
    }

    #lighting() {
        const t = this.#i18n.t;
        if (!this.#allowed('ledStrip')) return nothing;

        const store = this.deps?.led ?? null;
        const snapshot = store?.get?.() ?? null;

        if (!snapshot || snapshot.status !== LED_STATUS.READY) {
            return html`<ui-empty-state
                id="led-empty"
                heading=${t('The lighting is not readable')}
                body=${t('The machine has not reported its LED colours yet.')}
            ></ui-empty-state>`;
        }

        const current = store.hex(ledLeadZone(this._ledZone), this._ledBank) ?? '';

        return html`<div id="lighting">
            <div class="column">
                <div class="group">
                    <h3 class="ui-heading">${t('Zone')}</h3>
                    <ui-bank
                        id="led-zone"
                        .items=${LED_ZONE_ITEMS.map((item) => ({ value: item.value, label: t(item.label) }))}
                        value=${this._ledZone}
                        label=${t('Zone')}
                        @change=${(event) => { this._ledZone = event.detail?.value ?? this._ledZone; }}
                    ></ui-bank>
                </div>

                <div class="group">
                    <h3 class="ui-heading">${t('State')}</h3>
                    <ui-bank
                        id="led-bank"
                        .items=${LED_BANK_ITEMS.map((item) => ({ value: item.value, label: t(item.label) }))}
                        value=${this._ledBank}
                        label=${t('State')}
                        @change=${(event) => { this._ledBank = event.detail?.value ?? this._ledBank; }}
                    ></ui-bank>
                </div>

                <div class="group">
                    <h3 class="ui-heading">${t('Current colours')}</h3>
                    <div id="current">
                        <span></span>
                        ${LED_BANK_ITEMS.map((bank) => html`<span
                            class="ui-microcap"
                        >${t(bank.label)}</span>`)}
                        ${LED_GRID_ZONES.map((zone) => html`
                            <span class="ui-caption">${t(zone.label)}</span>
                            ${LED_BANK_ITEMS.map((bank) => html`<button
                                type="button"
                                class="chip"
                                data-zone=${zone.value}
                                data-bank=${bank.value}
                                aria-pressed=${zone.value === this._ledZone && bank.value === this._ledBank ? 'true' : 'false'}
                                aria-label=${`${t(zone.label)} · ${t(bank.label)}`}
                                style="--_ui-chip-fill: ${store.hex(ledLeadZone(zone.value), bank.value) ?? 'transparent'}"
                                @click=${() => this.#pickCell(zone.value, bank.value)}
                            ></button>`)}
                        `)}
                    </div>
                </div>

                <div class="group">
                    <h3 class="ui-heading">${t('Presets')}</h3>
                    <ui-colour-swatch-row
                        id="led-presets"
                        .swatches=${LED_PRESETS}
                        .columns=${LED_PRESET_COLUMNS}
                        value=${current}
                        label=${t('Preset colours')}
                        @swatch-select=${this.#onSwatch}
                    ></ui-colour-swatch-row>
                </div>
            </div>

            <div class="column">
                <div class="group inline">
                    <h3 class="ui-heading" id="led-power-label">${t('Power')}</h3>
                    <ui-switch
                        id="led-power"
                        aria-labelledby="led-power-label"
                        ?checked=${store.isOn(this._ledBank) === true}
                        @change=${(event) => this.#onPower(event)}
                    ></ui-switch>
                </div>

                <div class="group">
                    <p id="led-editing" class="ui-caption prose">
                        ${t('Editing')}
                        <strong>${t(LED_ZONE_ITEMS.find((z) => z.value === this._ledZone)?.label ?? '')}</strong>
                        ·
                        <strong>${t(LED_BANK_ITEMS.find((b) => b.value === this._ledBank)?.label ?? '')}</strong>
                        <span class="ui-numeric">${current}</span>
                    </p>
                    <ui-colour-wheel
                        id="led-wheel"
                        size="440"
                        label=${t('Zone colour')}
                        value=${current}
                        @colour-input=${this.#onWheel}
                        @colour-change=${this.#onWheel}
                    ></ui-colour-wheel>
                    <p id="led-preview-note" class="ui-caption prose"
                        >${t('The wheel picks the colour and the slider sets its brightness. Colours change on the machine as you pick them, and the asleep colours only show while the machine is asleep.')}</p>
                </div>

            </div>
        </div>`;
    }

    #onPower(event) {
        void this.deps?.led?.power(Boolean(event.detail?.checked), this._ledBank);
    }

    #pickCell(zone, bank) {
        this._ledZone = zone;
        this._ledBank = bank;
    }

    #onSwatch = (event) => {
        const hex = event.detail?.hex;
        if (typeof hex !== 'string') return;
        /* NOT AWAITED, ON PURPOSE. The paint has already happened; the store decides what
         * reaches the wire, and awaiting here would be a queue by another name. */
        void this.deps?.led?.preview(ledZonesFor(this._ledZone), this._ledBank, hex);
    };

    #onWheel = (event) => {
        const hex = event.detail?.hex;
        if (typeof hex !== 'string') return;
        /* `_ledZone` is the group a person picked; the store takes the wire zones
         * `ledZonesFor` maps it to. Passing the group straight through is refused as a
         * bad target and nothing reaches the wire. */
        void this.deps?.led?.preview(ledZonesFor(this._ledZone), this._ledBank, hex);
    };

    #firmware() {
        const t = this.#i18n.t;
        const state = this.deps?.firmware?.get?.() ?? null;
        const catalog = state?.catalog ?? null;
        const flash = state?.flash ?? null;
        const busy = flash && flash.state !== 'idle' && flash.state !== 'done'
            && flash.state !== 'error' && flash.state !== 'refused';

        if (!catalog) {
            return html`<ui-empty-state
                id="firmware-empty"
                boxed
                heading=${t('No firmware information')}
                body=${t('The machine has not answered yet. It reports the images it carries once it is connected.')}
            ></ui-empty-state>`;
        }

        const build = catalog.machine && Number.isFinite(catalog.machine.build)
            ? String(catalog.machine.build) : null;

        const target = (catalog.artifacts ?? []).find((a) => a && a.id === catalog.recommendedArtifactId) ?? null;
        const targetName = target
            ? (typeof target.versionLabel === 'string' && target.versionLabel !== ''
                ? target.versionLabel
                : (Number.isFinite(target.build) ? String(target.build) : null))
            : null;
        const available = catalog.updateAvailable;
        const carriesNothing = catalogCarriesNothingFor(catalog);
        const headline = carriesNothing === true
            ? t('This app carries no firmware for this machine')
            : (available === true ? t('A newer image is available')
                : (available === false ? t('This machine is on the newest image it carries')
                    : t('Whether a newer image applies is not known')));

        const checking = state?.status === 'loading';
        const pending = this._flashPending ?? null;

        return html`<section class="group" id="firmware">
            <div class="fact-head">
                <h3 class="ui-heading">${t('Machine firmware')}</h3>
                <ui-button
                    id="firmware-check"
                    ?disabled=${busy || checking}
                    @click=${() => { void this.deps?.firmware?.load?.(); }}
                >${t(checking ? 'Checking' : 'Check for update')}</ui-button>
            </div>

            <dl class="facts">
                <div class="fact" data-term="build">
                    <dt class="ui-body">${t('On the machine')}</dt>
                    <dd class="ui-body ui-numeric">${build ?? MACHINE_INFO_DASH}</dd>
                </div>
                <div class="fact" data-term="model">
                    <dt class="ui-body">${t('Machine')}</dt>
                    <dd class="ui-body">${catalog.machine?.model ?? MACHINE_INFO_DASH}</dd>
                </div>
                <div class="fact" data-term="carried">
                    <dt class="ui-body">${t('Images carried')}</dt>
                    <dd class="ui-body ui-numeric">${String((catalog.artifacts ?? []).length)}</dd>
                </div>
                <div class="fact" data-term="newest">
                    <dt class="ui-body">${t('Newest carried')}</dt>
                    <dd class="ui-body ui-numeric">${targetName ?? MACHINE_INFO_DASH}</dd>
                </div>
            </dl>

            <p id="firmware-headline" class="ui-caption prose">${headline}</p>

            ${this.#firmwareProgress(flash)}

            <p id="firmware-note" class="caution"
                >${t(FIRMWARE_DURATION)} ${t(FIRMWARE_POWER)} ${t(FIRMWARE_INTERRUPTION)}</p
            >

            <div class="device-actions">
                ${catalog.recommendedArtifactId
                    ? html`<ui-button
                        id="firmware-latest"
                        variant="primary"
                        ?disabled=${busy}
                        @click=${() => { this._flashPending = { kind: 'latest' }; }}
                        >${targetName === null
                            ? t('Update to latest')
                            : t('Update to {build}', { build: targetName })}</ui-button
                    >`
                    : nothing}

                <ui-file-button
                    id="firmware-file"
                    accept=".bin,.dat,application/octet-stream"
                    ?disabled=${busy}
                    label=${t('Update from a file')}
                    @file-pick=${this.#onFirmwareFile}
                    >${t('Update from a file')}</ui-file-button
                >

                ${busy ? html`<ui-button
                    id="firmware-cancel"
                    variant="danger"
                    @click=${this.#onFirmwareCancel}
                    >${t('Cancel')}</ui-button
                >` : nothing}
            </div>

            ${this._flashRejected
                ? html`<p id="firmware-rejected" class="caution"
                    >${this.#firmwareRefusal(this._flashRejected)}</p
                >`
                : nothing}

            <ui-confirm-dialog
                id="firmware-confirm"
                .open=${Boolean(pending)}
                question=${pending?.kind === 'latest' && targetName !== null
                    ? t('Write {build} to the machine?', { build: targetName })
                    : t('Write this firmware to the machine?')}
                detail=${[t(FIRMWARE_DURATION), t(FIRMWARE_CARE), t(FIRMWARE_INTERRUPTION)].join(' ')}
                confirm-label=${t('Update firmware')}
                tone="destructive"
                @confirm=${this.#onFlashConfirm}
                @cancel=${() => { this._flashPending = null; }}
                @open-change=${(event) => { if (event?.detail?.open === false) this._flashPending = null; }}
            ></ui-confirm-dialog>
        </section>`;
    }

    async #firmwareVerdict(file) {
        const model = this.deps?.firmware?.get?.()?.catalog?.machine?.model ?? null;
        if (!file) return { ok: false, verdict: IMAGE_VERDICT.TOO_SHORT, imageClass: null, machineClass: null };
        const size = Number(file.size);
        const head = typeof file.slice === 'function'
            ? new Uint8Array(await file.slice(0, FIRMWARE_HEADER_BYTES).arrayBuffer())
            : new Uint8Array(await file.arrayBuffer());
        return checkFirmwareImage(head, model, Number.isFinite(size) ? size : head.byteLength);
    }

    #firmwareRefusal(rejected) {
        const t = this.#i18n.t;
        const name = (machineClass) => t(MACHINE_CLASS_NAMES[machineClass] ?? '');
        switch (rejected?.verdict) {
            case IMAGE_VERDICT.WRONG_MACHINE:
                return t('That is {image} firmware and this machine is a {machine}. Nothing was sent.', {
                    image: name(rejected.imageClass),
                    machine: name(rejected.machineClass),
                });
            case IMAGE_VERDICT.MACHINE_UNKNOWN:
                return t('The machine has not said which model it is, so this image cannot be matched to it. Nothing was sent.');
            case IMAGE_VERDICT.TOO_LARGE:
                return t('That file is far larger than any firmware image. Nothing was sent.');
            case IMAGE_VERDICT.TOO_SHORT:
                return t('That file is too small to be a firmware image. Nothing was sent.');
            default:
                return t('That file carries no firmware header, so there is no way to tell which machine it is for. Nothing was sent.');
        }
    }

    /** The confirmed flash — the one place either install path actually starts. */
    #onFlashConfirm = async () => {
        const pending = this._flashPending;
        this._flashPending = null;
        if (!pending) return;
        if (pending.kind === 'latest') { void this.deps?.firmware?.installLatest?.(); return; }
        if (pending.bytes) void this.deps?.firmware?.installFile?.(pending.bytes);
    };

    /** The flash, as a track and a sentence, or nothing when none has been started. */
    #firmwareProgress(flash) {
        const t = this.#i18n.t;
        if (!flash || flash.state === 'idle') return nothing;
        const say = {
            erasing: t('Erasing'),
            uploading: t('Writing'),
            done: t('Done'),
            error: t('The machine stopped the update'),
            refused: t('The machine would not start the update'),
        };
        /* THE FRACTION IS THE MACHINE'S OWN and is shown only while it sends one.
         * Erasing has no progress to report, and a bar sitting at 0 for a minute reads
         * as a stall rather than as a step. */
        const fraction = typeof flash.progress === 'number' ? flash.progress : null;
        return html`<div class="group">
            <ui-progress-track
                id="firmware-progress"
                .value=${fraction === null ? 0 : Math.round(fraction * 100)}
                .max=${100}
                label=${t('Firmware progress')}
                value-text=${fraction === null ? say[flash.state] ?? '' : `${Math.round(fraction * 100)}%`}
            ></ui-progress-track>
            <p id="firmware-state" class="ui-caption prose"
                >${say[flash.state] ?? flash.state}${flash.error ? ` — ${flash.error}` : ''}</p
            >
        </div>`;
    }

    #onFirmwareFile = async (event) => {
        const file = event.detail?.file;
        const store = this.deps?.firmware;
        if (!file || !store?.installFile) return;
        const verdict = await this.#firmwareVerdict(file);
        if (!verdict.ok) {
            this._flashRejected = verdict;
            return;
        }
        this._flashRejected = null;
        /* READ AS BYTES. A firmware image is not text and `file.text()` would mangle it
         * through UTF-8 before it ever reached the machine. */
        const bytes = new Uint8Array(await file.arrayBuffer());
        this._flashPending = { kind: 'file', bytes };
    };

    #onFirmwareCancel = () => {
        Promise.resolve(this.deps?.firmware?.cancel?.()).catch(() => {});
    };

    #descaling() {
        return this.#machineProcedure({
            id: 'descale',
            state: MACHINE_STATE.DESCALING,
            heading: 'Descaling cycle',
            caption: 'Takes around 20 minutes and cannot be interrupted once started. Before you begin:',
            action: 'Start',
            confirm: 'Start the descaling cycle?',
            detail: 'This cannot be stopped once it has started.',
            steps: [
                'Fill the tank with descaling solution.',
                'Remove the portafilter from the group.',
                'Empty the drip tray and put it back.',
                'Put a container under the group and the steam wand.',
            ],
            running: 'The machine is descaling.',
            done: 'The descaling cycle has finished.',
            link: Object.freeze({
                href: DESCALING_INSTRUCTIONS_URL,
                label: 'Descaling Instruction',
            }),
        });
    }

    #transportMode() {
        return this.#machineProcedure({
            id: 'air-purge',
            state: MACHINE_STATE.AIR_PURGE,
            heading: 'Air purge',
            caption: 'Purges the remaining water from inside the machine. Run it before packing the machine, so it does not leak in transport or freeze in storage. Before you begin:',
            action: 'Start',
            confirm: 'Purge the water from the machine?',
            detail: 'The machine is left empty of water afterwards.',
            steps: [
                'Empty the water tank and put it back.',
                'Remove the portafilter from the group.',
                'Empty the drip tray and put it back.',
                'Leave the steam wand pointing into the tray.',
            ],
            running: 'Now removing water from your espresso machine.',
            done: 'You can turn your machine off once it is out of water. It will then be ready for transport.',
            blockedBy: MACHINE_STATE.NEEDS_WATER,
            blockedReason: 'Out of water',
            blockedRemedy: 'Press the stop button on the group head to override, then tap Start again.',
        });
    }

    #machineProcedure({
        id, state, heading, caption, action, confirm, detail, steps,
        running, done, link = null,
        blockedBy = null, blockedReason = null, blockedRemedy = null,
    }) {
        const t = this.#i18n.t;
        const store = this.deps?.machineState ?? null;
        const request = store?.get?.() ?? null;
        /* THIS PAGE'S OWN REQUEST, and only this page's. See the note above. */
        const mine = request?.requested === state;
        const refused = mine && (request.status === REQUEST_STATUS.REFUSED
            || request.status === REQUEST_STATUS.FAILED);
        const sent = mine && request.status === REQUEST_STATUS.SENT;

        const machine = this._machineState;
        const isRunning = machine !== null && machine === state;
        const finished = !isRunning && this._procedureSeen === state;
        const blocked = blockedBy !== null && machine === blockedBy;

        const status = isRunning ? running
            : (finished ? done
                : (sent ? 'The machine has been asked to start. It has not reported starting yet.'
                    : null));

        return html`
            <section class="group" id=${id}>
                <div class="fact-head">
                    <h3 class="ui-heading">${t(heading)}</h3>
                    <ui-button
                        id=${`${id}-start`}
                        variant="primary"
                        ?disabled=${!store || blocked}
                        @click=${() => { this._confirm = id; }}
                    >${t(action)}</ui-button>
                </div>
                <p class="ui-caption prose">${t(caption)}</p>
                <ol class="steps ui-caption">
                    ${steps.map((step) => html`<li
                        >${t(step)}</li
                    >`)}
                </ol>
                ${link
                    ? html`<a
                        id=${`${id}-instructions`}
                        class="ui-body doc-link"
                        href=${link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                    >${t(link.label)}</a>`
                    : nothing}
                ${blocked
                    ? html`<span id=${`${id}-blocked`} class="ui-caption prose"
                        >${t(blockedReason)} — ${t(blockedRemedy)}</span
                    >`
                    : nothing}
                ${status
                    ? html`<span id=${`${id}-status`} class="ui-caption prose"
                        >${t(status)}</span
                    >`
                    : nothing}
                ${refused
                    ? html`<span id=${`${id}-refusal`} class="ui-caption"
                        >${t('The machine refused. It may be busy, or not connected.')}</span
                    >`
                    : nothing}
            </section>
            <ui-confirm-dialog
                id=${`${id}-confirm`}
                .open=${this._confirm === id}
                question=${t(confirm)}
                detail=${detail ? t(detail) : ''}
                confirm-label=${t(action)}
                tone="destructive"
                @confirm=${() => this.#runProcedure(state)}
                @cancel=${() => { this._confirm = null; }}
                @open-change=${(event) => { if (event?.detail?.open === false) this._confirm = null; }}
            ></ui-confirm-dialog>
        `;
    }

    #runProcedure(state) {
        this._confirm = null;
        if (this._procedureSeen === state) this._procedureSeen = null;
        Promise.resolve(this.deps?.machineState?.request?.(state)).catch(() => {});
    }

    #plugins() {
        const t = this.#i18n.t;
        const store = this.deps?.plugins;
        const state = store?.get?.() ?? null;

        if (!state || state.status === PLUGINS_STATUS.UNAVAILABLE) {
            return html`<ui-empty-state
                id="plugins-unavailable"
                heading=${t('The plugin list is not available')}
                body=${t('ReaPrime has not answered for its installed plugins.')}
            ></ui-empty-state>`;
        }
        if (state.plugins.length === 0 && state.status === PLUGINS_STATUS.READY) {
            return html`<ui-empty-state
                id="plugins-empty"
                heading=${t('No plugins installed')}
                body=${t('Plugins add features such as shot upload. They are installed on the machine, not in this skin.')}
            ></ui-empty-state>`;
        }

        return html`
            <section class="group" id="plugin-list">
                <h3 class="ui-heading">${t('Installed plugins')}</h3>
                <div class="plugins">
                    ${state.plugins.map((plugin) => this.#pluginRow(plugin))}
                </div>
            </section>
            ${this._pluginOpenFailed
                ? html`<p id="plugin-open-failed" class="ui-caption prose"
                    >${t('The plugin page could not be opened.')}</p>`
                : nothing}
            ${this.#pluginSettingsDialog()}
        `;
    }

    #pluginRow(plugin) {
        const t = this.#i18n.t;
        const page = pluginPage(plugin);
        const version = pluginVersion(plugin.version);
        const blurb = pluginBlurb(plugin);
        return html`<div class="plugin" data-plugin=${plugin.id}>
            <span class="plugin-name">
                <span class="plugin-title">
                    <span class="ui-heading">${plugin.name ?? plugin.id}</span>
                    ${version
                        ? html`<span class="ui-caption ui-numeric"
                            >${version}</span>`
                        : nothing}
                </span>
                ${blurb
                    ? html`<span class="ui-caption plugin-blurb"
                        >${blurb}</span>`
                    : nothing}
                ${plugin.author
                    ? html`<span class="ui-caption"
                        >${plugin.author}</span>`
                    : nothing}
            </span>
            <ui-switch
                aria-label=${`${t('Enable')} ${plugin.name ?? plugin.id}`}
                ?checked=${plugin.autoLoad === true}
                @change=${(event) => this.#onPluginEnabled(plugin.id, event)}
            ></ui-switch>
            <span class="device-actions">
                ${pluginHasSettings(plugin)
                    ? html`<ui-icon-button
                        class="plugin-settings"
                        data-plugin-settings=${plugin.id}
                        label=${`${t('Settings for')} ${plugin.name ?? plugin.id}`}
                        @click=${() => this.#openPluginSettings(plugin.id)}
                    >${gearIcon()}</ui-icon-button>`
                    : nothing}
                ${page
                    ? html`<ui-button
                        class="plugin-open"
                        @click=${() => this.#openPluginPage(plugin.id, page)}
                    >${t('Open')}</ui-button>`
                    : nothing}
            </span>
        </div>`;
    }

    #openPluginSettings(pluginId) {
        this._pluginSettingsFor = pluginId;
        this._pluginDraft = null;
        const load = this.deps?.plugins?.loadSettings?.(pluginId);
        if (load && typeof load.catch === 'function') load.catch(() => {});
    }

    #closePluginSettings = () => {
        this._pluginSettingsFor = null;
        this._pluginDraft = null;
    };

    #pluginSettingsDialog() {
        if (!this._pluginSettingsFor) return nothing;
        const t = this.#i18n.t;
        const id = this._pluginSettingsFor;
        const manifest = this.deps?.plugins?.plugin?.(id) ?? null;
        return html`<ui-dialog
            id="plugin-settings-dialog"
            open
            heading=${manifest?.name ?? id}
            label=${t('Plugin settings')}
            @open-change=${(event) => {
                if (event?.detail?.open === false) this.#closePluginSettings();
            }}
        >${this.#pluginForm(id, null)}</ui-dialog>`;
    }

    #openPluginPage(pluginId, endpointId) {
        const base = this.deps?.plugins?.pageUrl?.(pluginId, endpointId);
        if (!base) return;
        this._pluginOpenFailed = false;
        let opened = null;
        try {
            opened = this.ownerDocument?.defaultView?.open?.(base, '_blank', 'noopener') ?? null;
        } catch {
            opened = null;
        }
        if (!opened) this._pluginOpenFailed = true;
    }

    #onPluginEnabled(id, event) {
        const next = event?.detail?.checked;
        if (typeof next !== 'boolean') return;
        void this.deps?.plugins?.setEnabled(id, next);
    }

    #visualizer() {
        return this.#pluginForm(VISUALIZER_PLUGIN_ID, 'Visualizer');
    }

    #pluginForm(pluginId, title) {
        const t = this.#i18n.t;
        const store = this.deps?.plugins;
        const manifest = store?.plugin?.(pluginId) ?? null;
        const values = store?.settingsFor?.(pluginId) ?? null;

        if (!manifest) {
            return html`<ui-empty-state
                id="plugin-absent"
                heading=${t('This plugin is not installed')}
                body=${t('It is installed on the machine, not in this skin. Check the Plugins page.')}
            ></ui-empty-state>`;
        }

        const fields = settingFields(manifest, values);
        const draft = this._pluginDraft?.id === pluginId ? this._pluginDraft.values : {};
        const dirty = Object.keys(draft).length;

        return html`
            <section class="group" id="plugin-state">
                ${title ? html`<h3
                    class="ui-heading"
                >${t(title)}</h3>` : nothing}
                <div class="form-row" data-control="switch">
                    <div class="sw-label">
                        <span class="ui-heading">${t('Enable')} ${manifest.name ?? pluginId}</span>
                        <span class="ui-caption">${manifest.description ?? ''}</span>
                    </div>
                    <ui-switch
                        id="plugin-enabled"
                        aria-label=${`${t('Enable')} ${manifest.name ?? pluginId}`}
                        ?checked=${manifest.autoLoad === true}
                        @change=${(event) => this.#onPluginEnabled(pluginId, event)}
                    ></ui-switch>
                </div>
            </section>

            ${fields.length === 0
                ? nothing
                : html`<section class="group" id="plugin-settings">
                <h3 class="ui-heading">${t('Settings')}</h3>
                    ${fields.map((field) => this.#pluginField(pluginId, field, draft))}
                    <div class="sw-row">
                        <span class="ui-caption">${dirty
                            ? `${dirty} ${t(dirty === 1 ? 'change not saved' : 'changes not saved')}`
                            : t('Saving reloads the plugin.')}</span>
                        <ui-button
                            id="plugin-save"
                            variant="primary"
                            ?disabled=${dirty === 0}
                            @click=${() => this.#onPluginSave(pluginId)}
                        >${t('Save')}</ui-button>
                    </div>
                </section>`}
        `;
    }

    #pluginField(pluginId, field, draft) {
        const t = this.#i18n.t;
        const staged = Object.hasOwn(draft, field.key);
        const shown = staged ? draft[field.key] : field.value;
        const copy = pluginFieldCopy(pluginId, field);
        const isSwitch = field.type === 'boolean';

        if (!field.supported) {
            return html`<div class="form-row" data-field=${field.key}>
                <div class="sw-label">
                    <span class="ui-heading">${t(copy.heading)}</span>
                    <span class="ui-caption">${t(copy.caption)}</span>
                </div>
                <span class="ui-caption">${t('This plugin setting has a kind this skin cannot edit')} (${field.type ?? '?'})</span>
            </div>`;
        }

        return html`<div
            class="form-row"
            data-field=${field.key}
            data-control=${isSwitch ? 'switch' : 'field'}
        >
            <div class="sw-label">
                <span class="ui-heading">${t(copy.heading)}</span>
                <span class="ui-caption">${t(copy.caption)}</span>
                ${field.secure
                    ? html`<span class="ui-caption"
                        >${field.isSet === true
                            ? t('A value is stored. Type a new one to replace it.')
                            : t('Nothing stored yet.')}</span
                    >`
                    : nothing}
            </div>
            ${isSwitch
                ? html`<ui-switch
                    aria-label=${t(copy.heading)}
                    ?checked=${shown === undefined ? field.fallback === true : shown === true}
                    @change=${(event) => this.#onPluginField(pluginId, field.key, event.detail?.checked)}
                ></ui-switch>`
                : html`<ui-text-field
                    label=${t(copy.heading)}
                    hide-label
                    type=${field.secure ? 'password' : field.type === 'number' ? 'number' : 'text'}
                    inputmode=${field.type === 'number' && !field.secure ? 'decimal' : nothing}
                    .value=${shown === undefined || shown === null ? '' : String(shown)}
                    @change=${(event) => this.#onPluginField(
                        pluginId,
                        field.key,
                        field.type === 'number' ? numberOrNull(event.target?.value) : event.target?.value,
                    )}
                ></ui-text-field>`}
        </div>`;
    }

    #onPluginField(pluginId, key, value) {
        if (value === undefined) return;
        const draft = this._pluginDraft?.id === pluginId ? this._pluginDraft.values : {};
        this._pluginDraft = { id: pluginId, values: { ...draft, [key]: value } };
    }

    async #onPluginSave(pluginId) {
        const draft = this._pluginDraft?.id === pluginId ? this._pluginDraft.values : null;
        if (!draft || Object.keys(draft).length === 0) return;
        const ok = await this.deps?.plugins?.writeSettings(pluginId, draft);
        if (ok) this._pluginDraft = null;
    }

    #decentAccount() {
        const t = this.#i18n.t;
        const state = this.deps?.account?.get?.() ?? null;

        if (!state || state.status === ACCOUNT_STATUS.UNAVAILABLE) {
            return html`<ui-empty-state
                id="account-unavailable"
                heading=${t('The account status is not available')}
                body=${t('ReaPrime has not answered. The status arrives once it is reachable.')}
            ></ui-empty-state>`;
        }

        const linked = state.loggedIn === true;
        const known = state.loggedIn !== null;
        return html`<section class="group" id="account">
            <div class="fact-head">
                <h3 class="ui-heading">${t('Decent account')}</h3>
                <ui-status-chip id="account-state"
                >${!known
                    ? t('Not known')
                    : t(linked ? 'Linked' : 'Not linked')}</ui-status-chip>
            </div>
            ${linked
                ? html`<p id="account-linked" class="ui-caption prose"
                    >${t('This machine is signed in to a Decent account. Messages to support are sent from it.')}</p>
                    ${this.#supportThread()}
                    ${this.#supportCompose()}`
                : html`<ui-empty-state
                    id="account-empty"
                    boxed
                    heading=${t(known ? 'No Decent account linked' : 'Whether an account is linked is not known yet')}
                >
                    <p class="ui-caption prose"
                        >${t('Messages to support are sent from your Decent account. Signing in happens in ReaPrime, not in this skin:')}</p>
                    <ol class="steps">
                        ${[
                            'Leave this skin and open Account in ReaPrime.',
                            'Sign in with your Decent email and password.',
                            'Come back here — this page will show the message box.',
                        ].map((step) => html`<li class="ui-body"
                            >${t(step)}</li
                        >`)}
                    </ol>
                    <p class="ui-caption prose"
                        >${t('No account? You can still reach a human at')}
                        <a
                            id="account-support-email"
                            class="ui-body doc-link"
                            href="mailto:help@decentespresso.com"
                            rel="noopener noreferrer"
                        >help@decentespresso.com</a>
                        ${t('or on the Decent Diaspora forum.')}</p>
                </ui-empty-state>`}
        </section>`;
    }

    #supportThread() {
        const t = this.#i18n.t;
        const store = this.deps?.support ?? null;
        if (!store) return nothing;
        const state = store?.get?.() ?? null;
        const messages = Array.isArray(state?.messages) ? state.messages : [];
        const loading = state?.status === SUPPORT_STATUS.LOADING;
        const unavailable = state?.status === SUPPORT_STATUS.UNAVAILABLE;

        return html`<section class="group" id="support-thread">
            <div class="fact-head">
                <h3 class="ui-heading">${t('Conversation')}</h3>
                <ui-button
                    id="support-refresh"
                    ?disabled=${loading}
                    @click=${() => { void this.deps?.support?.refresh?.(); }}
                >${t('Refresh')}</ui-button>
            </div>
            ${unavailable
                ? html`<p id="support-thread-error" class="ui-caption prose"
                    >${t(SUPPORT_REFUSAL_COPY[state.reason] ?? SUPPORT_REFUSAL_COPY[SUPPORT_REFUSAL.FAILED])}</p>`
                : nothing}
            ${loading && messages.length === 0
                ? html`<p id="support-thread-loading" class="ui-caption prose"
                    >${t('Loading messages…')}</p>`
                : nothing}
            ${!unavailable && !loading && messages.length === 0
                ? html`<p id="support-thread-empty" class="ui-caption prose"
                    >${t('No messages yet. Send one below to start.')}</p>`
                : nothing}
            ${messages.length
                ? html`<ol id="support-messages" class="thread">
                    ${messages.map((message) => this.#supportMessage(message))}
                </ol>`
                : nothing}
        </section>`;
    }

    #supportMessage(message) {
        const t = this.#i18n.t;
        const language = this.deps?.settings?.value?.('language') ?? this.deps?.defaultLanguage;
        const when = message.at === null ? null : shortDateTime(message.at * MS_PER_SECOND, language);
        return html`<li class="message" data-from=${message.from === null ? 'you' : 'decent'}>
            <span class="message-head">
                <span class="ui-heading">${message.from ?? t('You')}</span>
                ${message.auto
                    ? html`<ui-badge
                        >${t('Automatic')}</ui-badge
                    >`
                    : nothing}
                ${when === null
                    ? nothing
                    : html`<span class="ui-caption ui-numeric"
                        >${when}</span
                    >`}
            </span>
            ${message.subject === null
                ? nothing
                : html`<span class="ui-caption"
                    >${message.subject}</span
                >`}
            ${message.body === null
                ? nothing
                : html`<p class="ui-body message-body"
                    >${message.body}</p
                >`}
        </li>`;
    }

    #supportCompose() {
        const t = this.#i18n.t;
        const store = this.deps?.support ?? null;
        /* AS THE THREAD ABOVE: no store is no surface, not a disabled one. A compose box
         * whose Send can never fire is three controls that exist to be refused. */
        if (!store) return nothing;
        const state = store?.get?.() ?? null;
        const draft = this._support ?? EMPTY_SUPPORT_DRAFT;
        const send = state?.send ?? null;
        const sending = send?.status === SEND_STATUS.SENDING;
        const sent = send?.status === SEND_STATUS.SENT;
        const refusal = send?.status === SEND_STATUS.REFUSED ? send.reason : null;
        const details = this.#supportDetails();

        if (store.hasToken === false) {
            return html`<section class="group" id="support-compose">
                <h3 class="ui-heading">${t('Send a message')}</h3>
                <p id="support-no-token" class="ui-caption prose"
                    >${t(SUPPORT_REFUSAL_COPY[SUPPORT_REFUSAL.NO_TOKEN])}</p>
            </section>`;
        }

        return html`<section class="group" id="support-compose">
            <h3 class="ui-heading">${t('Send a message')}</h3>
            <ui-text-field
                id="support-subject"
                label=${t('Subject')}
                placeholder=${t('What can we help you with?')}
                .value=${draft.subject}
                @change=${(event) => this.#onSupportField('subject', event.target?.value)}
                @input=${(event) => this.#onSupportField('subject', event.target?.value)}
            ></ui-text-field>
            <ui-notes-editor
                id="support-message"
                label=${t('Message')}
                placeholder=${t('Describe what is happening.')}
                .value=${draft.body}
                @notes-input=${(event) => this.#onSupportField('body', event.detail?.value)}
            ></ui-notes-editor>
            ${details === null
                ? nothing
                : html`<div class="form-row" data-control="switch">
                    <div class="sw-label">
                        <span class="ui-heading">${t('Attach machine details')}</span>
                        <span class="ui-caption">${t('Adds the model, firmware version, serial number and app version to the end of your message.')}</span>
                    </div>
                    <ui-switch
                        aria-label=${t('Attach machine details')}
                        ?checked=${draft.attachDetails}
                        @change=${(event) => this.#onSupportField('attachDetails', event.detail?.checked)}
                    ></ui-switch>
                </div>`}
            <ui-button
                id="support-send"
                variant="primary"
                ?disabled=${sending}
                @click=${this.#onSupportSend}
            >${t(sending ? 'Sending…' : 'Send message')}</ui-button>
            ${sent
                ? html`<p id="support-sent" class="ui-caption prose"
                    >${t('Message sent. Decent support will reply to the email address on your account.')}</p>`
                : nothing}
            ${refusal
                ? html`<p id="support-send-error" class="ui-caption prose"
                    >${t(SUPPORT_REFUSAL_COPY[refusal] ?? SUPPORT_REFUSAL_COPY[SUPPORT_REFUSAL.FAILED])}</p>`
                : nothing}
            ${this._supportIncomplete
                ? html`<p id="support-incomplete" class="ui-caption prose"
                    >${t('Fill in both the subject and the message before sending.')}</p>`
                : nothing}
        </section>`;
    }

    #supportDetails() {
        const info = this.deps?.machineInfo?.get?.()?.info ?? null;
        const app = this.deps?.appInfo?.get?.()?.info ?? null;
        const lines = [
            ['Model', info?.model],
            ['Firmware', info?.version],
            ['Serial', info?.serialNumber],
            ['App Version', app?.version],
        ].filter(([, value]) => typeof value === 'string' && value !== '');
        return lines.length === 0 ? null : lines;
    }

    #onSupportField(key, value) {
        if (value === undefined) return;
        const draft = this._support ?? EMPTY_SUPPORT_DRAFT;
        this._support = { ...draft, [key]: value };
        if (this._supportIncomplete) this._supportIncomplete = false;
        const status = this.deps?.support?.get?.()?.send?.status;
        if (status === SEND_STATUS.SENT || status === SEND_STATUS.REFUSED) {
            this.deps?.support?.clearSendState?.();
        }
    }

    #onSupportSend = async () => {
        const draft = this._support ?? EMPTY_SUPPORT_DRAFT;
        const subject = draft.subject.trim();
        const body = draft.body.trim();
        if (subject === '' || body === '') {
            this._supportIncomplete = true;
            return;
        }
        this._supportIncomplete = false;

        const details = draft.attachDetails ? this.#supportDetails() : null;
        const t = this.#i18n.t;
        const full = details === null
            ? body
            : [body, '', '---', t('Machine details'), ...details.map(([term, value]) => `${t(term)}: ${value}`)]
                .join('\n');

        const ok = await this.deps?.support?.send?.({ subject, body: full });
        if (ok) this._support = { ...EMPTY_SUPPORT_DRAFT, attachDetails: draft.attachDetails };
    };

    #feedback() {
        const t = this.#i18n.t;
        const state = this.deps?.feedback?.get?.() ?? null;
        const draft = this._feedback ?? { type: 'bug', description: '', includeLogs: true, includeSystemInfo: true };

        if (state?.status === FEEDBACK_STATUS.SENT) {
            const number = Number.isInteger(state.issueNumber) ? state.issueNumber : null;
            const url = typeof state.issueUrl === 'string' && state.issueUrl !== '' ? state.issueUrl : null;
            return html`<ui-empty-state
                id="feedback-sent"
                heading=${t('Feedback sent')}
                body=${number === null
                    ? t('Thank you. It was filed against the ReaPrime project.')
                    : t('Thank you. Filed as issue #{number} on the ReaPrime issue tracker.', { number })}
            >
                ${url === null
                    ? nothing
                    : html`<a
                        id="feedback-issue"
                        class="ui-body doc-link"
                        href=${url}
                        target="_blank"
                        rel="noopener noreferrer"
                    >${t('View the issue')}</a>`}
                <ui-button slot="actions" @click=${this.#onFeedbackAgain}>${t('Send another')}</ui-button>
            </ui-empty-state>`;
        }

        const refusal = state?.status === FEEDBACK_STATUS.REFUSED ? state.reason : null;
        const sending = state?.status === FEEDBACK_STATUS.SENDING;

        return html`<section class="group" id="feedback">
                <h3 class="ui-heading">${t('Send feedback')}</h3>
            ${refusal === FEEDBACK_REFUSAL.NOT_CONFIGURED
                ? html`<p id="feedback-unconfigured" class="ui-caption prose"
                    >${t('This ReaPrime build cannot send feedback — it was compiled without a feedback token. Nothing you do here will change that.')}</p>`
                : nothing}
            <div class="sw-stack">
                <span class="ui-heading">${t('What is this about?')}</span>
                <ui-bank
                    id="feedback-type"
                    label=${t('Feedback type')}
                    .items=${FEEDBACK_TYPES.map((entry) => ({ value: entry.value, label: t(entry.label) }))}
                    .value=${draft.type}
                    @change=${(event) => this.#onFeedbackField('type', event.detail?.value)}
                ></ui-bank>
                <span id="feedback-type-hint" class="ui-caption"
                    >${t(FEEDBACK_TYPES.find((entry) => entry.value === draft.type)?.hint ?? '')}</span>
            </div>
            <div class="sw-stack">
                <span class="ui-heading">${t('Description')}</span>
                <ui-notes-editor
                    id="feedback-description"
                    label=${t('Description')}
                    placeholder=${t('What happened, and what did you expect?')}
                    .value=${draft.description}
                    @notes-input=${(event) => this.#onFeedbackField('description', event.detail?.value)}
                ></ui-notes-editor>
                ${refusal === FEEDBACK_REFUSAL.EMPTY_DESCRIPTION
                    ? html`<span id="feedback-empty" class="ui-caption"
                        >${t('Write something first.')}</span
                    >`
                    : nothing}
            </div>
            <div class="form-row" data-control="switch">
                <div class="sw-label">
                    <span class="ui-heading">${t('Attach logs')}</span>
                    <span class="ui-caption">${t('Sends the app’s recent log with the report.')}</span>
                </div>
                <ui-switch
                    aria-label=${t('Attach logs')}
                    ?checked=${draft.includeLogs}
                    @change=${(event) => this.#onFeedbackField('includeLogs', event.detail?.checked)}
                ></ui-switch>
            </div>
            <div class="form-row" data-control="switch">
                <div class="sw-label">
                    <span class="ui-heading">${t('Attach system information')}</span>
                    <span class="ui-caption">${t('Appends the app version, build and platform to the report.')}</span>
                </div>
                <ui-switch
                    aria-label=${t('Attach system information')}
                    ?checked=${draft.includeSystemInfo}
                    @change=${(event) => this.#onFeedbackField('includeSystemInfo', event.detail?.checked)}
                ></ui-switch>
            </div>

            <p class="ui-caption prose"
                >${t('Screenshots are not sent — ReaPrime does not read them from this route.')}</p>
            <p id="feedback-destination" class="ui-caption prose"
                >${t('Feedback is filed as an issue on ReaPrime’s public issue tracker. Nobody replies here; for an answer, write to help@decentespresso.com.')}</p>
            ${refusal === FEEDBACK_REFUSAL.FAILED
                ? html`<span id="feedback-failed" class="ui-caption"
                    >${state.message ?? t('Sending failed.')}</span>`
                : nothing}
            <ui-button
                id="feedback-send"
                class="bindings-reset"
                variant="primary"
                ?disabled=${sending}
                @click=${this.#onFeedbackSend}
            >${t(sending ? 'Sending' : 'Submit')}</ui-button>
        </section>`;
    }

    #onFeedbackField(key, value) {
        if (value === undefined) return;
        const draft = this._feedback ?? { type: 'bug', description: '', includeLogs: true, includeSystemInfo: true };
        this._feedback = { ...draft, [key]: value };
    }

    #onFeedbackSend = () => {
        const draft = this._feedback ?? { type: 'bug', description: '', includeLogs: true, includeSystemInfo: true };
        void this.deps?.feedback?.submit(draft);
    };

    #onFeedbackAgain = () => {
        this._feedback = null;
        this.deps?.feedback?.reset();
    };

    #usbCharger() {
        const t = this.#i18n.t;
        const document_ = this.deps?.app?.document ?? null;
        const charging = document_?.chargingState ?? null;
        const savingBattery = document_?.chargingMode !== 'disabled';
        const nightOn = savingBattery && document_?.nightModeEnabled === true;

        return html`
            ${nightOn
                ? html`<section class="group" id="night-times">
                    <h3 class="ui-heading">${t('Night mode times')}</h3>
                    <div class="form-row" data-control="switch">
                        <span class="ui-heading">${t('Sleep')}</span>
                        <ui-button id="night-sleep" @click=${() => { this._nightEdit = 'sleep'; }}
                            >${this.#timeLabel(document_?.nightModeSleepTime)}</ui-button>
                    </div>
                    <div class="form-row" data-control="switch">
                        <span class="ui-heading">${t('Morning')}</span>
                        <ui-button id="night-morning" @click=${() => { this._nightEdit = 'morning'; }}
                            >${this.#timeLabel(document_?.nightModeMorningTime)}</ui-button>
                    </div>
                </section>`
                : nothing}

            ${charging
                ? html`<section class="group" id="charging-state">
                    <h3 class="ui-heading">${t('Charging status')}</h3>
                    <dl class="facts">
                        <div class="fact" data-term="battery">
                            <dt class="ui-body">${t('Battery')}</dt>
                            <dd class="ui-body ui-numeric">${Number.isFinite(charging.batteryPercent)
                                ? `${charging.batteryPercent}%`
                                : MACHINE_INFO_DASH}${charging.isEmergency ? ` · ${t('emergency')}` : ''}</dd>
                        </div>
                        <div class="fact" data-term="phase">
                            <dt class="ui-body">${t('Phase')}</dt>
                            <dd class="ui-body">${t(CHARGING_PHASES[charging.currentPhase]
                                ?? charging.currentPhase ?? MACHINE_INFO_DASH)}</dd>
                        </div>
                        <div class="fact" data-term="output">
                            <dt class="ui-body">${t('Charger output')}</dt>
                            <dd class="ui-body">${t(charging.usbChargerOn ? 'On' : 'Off')}</dd>
                        </div>
                    </dl>
                </section>`
                : nothing}

            ${this._nightEdit ? this.#nightDialog() : nothing}
        `;
    }

    #nightDialog() {
        const t = this.#i18n.t;
        const which = this._nightEdit;
        const document_ = this.deps?.app?.document ?? null;
        const minutes = which === 'sleep' ? document_?.nightModeSleepTime : document_?.nightModeMorningTime;

        return html`<ui-dialog
            id="night-dialog"
            heading=${t(which === 'sleep' ? 'Sleep time' : 'Morning time')}
            .open=${true}
            @open-change=${(event) => { if (event?.detail?.open === false) this._nightEdit = null; }}
        >
            <ui-time-picker
                slot="body"
                id="night-picker"
                label=${t(which === 'sleep' ? 'Sleep time' : 'Morning time')}
                value=${minutesToTime(minutes)}
                clock-format=${this.#clockFormat}
                auto-advance
                @change=${this.#onNightTime}
            ></ui-time-picker>
            <ui-button slot="actions" variant="primary" @click=${() => { this._nightEdit = null; }}
                >${t('Done')}</ui-button>
        </ui-dialog>`;
    }

    #onNightTime = (event) => {
        const value = event?.detail?.value;
        const minutes = timeToMinutes(value);
        if (minutes === null || !this._nightEdit) return;
        const field = this._nightEdit === 'sleep' ? 'nightModeSleepTime' : 'nightModeMorningTime';
        /* THE STORE RE-READS ITSELF ON A SUCCESSFUL WRITE, so there is nothing to
         * refresh here and no second copy to keep in step. */
        Promise.resolve(this.deps?.app?.write?.({ [field]: minutes })).catch(() => {});
    };

    #deviceList(type) {
        const t = this.#i18n.t;
        const store = this.deps?.scaleConnect;
        const state = store?.get?.() ?? null;
        const known = (state?.known ?? []).filter((device) => device.type === type);
        const preferredId = type === DEVICE_TYPE.MACHINE
            ? (state?.preferred?.machine ?? null)
            : (state?.preferred?.scale ?? null);
        const heading = type === DEVICE_TYPE.MACHINE ? 'Machines' : 'Scales';

        const failed = state?.known === null && state?.error;
        if (state?.known === null && !failed) return nothing;

        const refusal = state?.writeError && DEVICE_REFUSAL[state.writeError.op]
            ? state.writeError
            : null;

        return html`
            <section class="group" id="devices">
                <h3 class="ui-heading">${t(heading)}</h3>
                ${failed
                    ? html`<p id="devices-error" class="ui-caption prose" role="status"
                        >${t('This machine could not be asked what it remembers.')}</p>`
                    : html`
                        <p class="ui-caption prose" id="devices-search-note"
                            >${t('Search looks for devices nearby. Nothing is connected automatically.')}</p>
                        ${known.length === 0
                            ? html`<ui-empty-state
                                id="devices-empty"
                                heading=${t('Nothing remembered yet')}
                                body=${t('Press Search to look for one. A device stays on this list once it has been connected.')}
                            ></ui-empty-state>`
                            : html`<div class="devices">
                                <div class="device-head" aria-hidden="true">
                                    <span></span>
                                    <span></span>
                                    <span class="ui-microcap">${t('Preferred')}</span>
                                    <span></span>
                                </div>
                                ${known.map((device) => this.#deviceRow(device, type, preferredId))}
                            </div>`}
                        ${refusal
                            ? html`<p id="devices-refusal" class="ui-caption prose" role="status"
                                >${t(DEVICE_REFUSAL[refusal.op])}${refusal.reason ? ` ${refusal.reason}` : ''}</p>`
                            : nothing}`}
            </section>`;
    }

    /** One device: what it is, what it is doing, and the three things you can do to it. */
    #deviceRow(device, type, preferredId) {
        const t = this.#i18n.t;
        const store = this.deps?.scaleConnect;
        const connected = device.state === DEVICE_STATE.CONNECTED;
        const word = device.available === false
            ? 'Unavailable'
            : (DEVICE_WORD[device.state] ?? 'Unknown');

        return html`<div class="device" data-device=${device.id} ?data-connected=${connected}>
            <span class="device-name">
                <span class="ui-heading">${device.name ?? device.id}</span>
                <span class="ui-caption">${device.id}</span>
            </span>
            <ui-status-chip class="device-state">${t(word)}</ui-status-chip>
            <ui-switch
                class="device-preferred"
                aria-label=${t('Preferred device')}
                ?checked=${device.id === preferredId}
                @change=${(event) => {
                    const on = event?.detail?.checked === true;
                    void store?.setPreferred(type, on ? device.id : null);
                }}
            ></ui-switch>
            <span class="device-actions">
                ${connected
                    ? html`<ui-button
                        class="device-disconnect"
                        @click=${() => { void store?.disconnectDevice(device.id); }}
                    >${t('Disconnect')}</ui-button>`
                    : html`<ui-button
                        class="device-connect"
                        @click=${() => {
                            void (device.available === false
                                ? store?.reconnectDevice(device.id)
                                : store?.connectDevice(device.id));
                        }}
                    >${t('Reconnect')}</ui-button>`}
                ${connected
                    ? nothing
                    : html`<ui-button
                        class="device-forget"
                        variant="danger"
                        @click=${() => { void store?.forgetDevice(device.id); }}
                    >${t('Forget')}</ui-button>`}
            </span>
        </div>`;
    }

    #foundList(type) {
        const t = this.#i18n.t;
        const store = this.deps?.scaleConnect;
        const state = store?.get?.() ?? null;
        const scanning = state?.status === SCAN_STATUS.SCANNING;
        if (state?.devices === null && !scanning) return nothing;
        const remembered = new Set((state?.known ?? []).map((device) => device.id));
        const found = (state?.devices ?? [])
            .filter((device) => device.type === type && !remembered.has(device.id));

        return html`
            <section class="group" id="found">
                <h3 class="ui-heading">${t('Found by searching')}</h3>
                ${scanning
                    ? html`<p id="found-scanning" class="ui-caption prose"
                        >${t('Searching…')}</p>`
                    : found.length === 0
                        ? html`<p id="found-empty" class="ui-caption prose"
                            >${t('Nothing new. Switch the device on and put it near the machine, then search again.')}</p>`
                        : html`<div class="devices">
                            ${found.map((device) => html`<div class="device" data-found=${device.id}>
                                <span class="device-name">
                                    <span class="ui-heading">${device.name ?? device.id}</span>
                                    <span class="ui-caption">${device.id}</span>
                                </span>
                                <span></span>
                                <span></span>
                                <span class="device-actions">
                                    <ui-button
                                        class="device-connect"
                                        variant="primary"
                                        @click=${() => { void store?.connectDevice(device.id); }}
                                    >${t('Connect')}</ui-button>
                                </span>
                            </div>`)}
                        </div>`}
            </section>`;
    }

    #machineConnection() {
        return html`
            ${this.#deviceList(DEVICE_TYPE.MACHINE)}
            ${this.#foundList(DEVICE_TYPE.MACHINE)}
        `;
    }

    #scaleConnection() {
        const t = this.#i18n.t;
        const store = this.deps?.scaleConnect;
        const state = store?.get?.() ?? null;

        return html`
            ${this.#deviceList(DEVICE_TYPE.SCALE)}
            ${this.#foundList(DEVICE_TYPE.SCALE)}

            <section class="group" id="wifi">
                <h3 class="ui-heading">${t('WiFi scales')}</h3>
                <p class="ui-caption prose">${t('A WiFi scale is reached by address rather than found by scanning.')}</p>
                ${state?.endpoints === null && state?.error
                    ? html`<p id="wifi-error" class="ui-caption prose" role="status"
                        >${t('This machine could not be asked which addresses it holds.')}</p>`
                    : nothing}
                ${(state?.endpoints ?? []).map((host) => html`<ui-list-row class="endpoint" data-host=${host}>
                    <span class="ui-heading">${host}</span>
                    <ui-button
                        slot="favourite"
                        variant="ghost"
                        @click=${() => { void store?.removeEndpoint(host); }}
                    >${t('Remove')}</ui-button>
                </ui-list-row>`)}
                <div class="sw-row">
                    <ui-text-field
                        id="wifi-host"
                        label=${t('Scale address')}
                        hide-label
                        placeholder="192.168.1.50"
                        .value=${this._wifiHost ?? ''}
                        @change=${(event) => { this._wifiHost = event.target?.value ?? ''; }}
                        @input=${(event) => { this._wifiHost = event.target?.value ?? ''; }}
                    ></ui-text-field>
                    <ui-button
                        id="wifi-add"
                        variant="primary"
                        ?disabled=${!(this._wifiHost ?? '').trim()}
                        @click=${this.#onWifiAdd}
                    >${t('Add')}</ui-button>
                </div>
                ${state?.writeError?.op === 'endpoint'
                    ? html`<span id="wifi-refusal" class="ui-caption" role="status"
                        >${t('That address was refused.')}${state.writeError.reason
                            ? ` ${state.writeError.reason}`
                            : ''}</span
                    >`
                    : nothing}
            </section>
        `;
    }

    #onWifiAdd = async () => {
        const host = (this._wifiHost ?? '').trim();
        if (!host) return;
        const ok = await this.deps?.scaleConnect?.addEndpoint(host);
        if (ok) this._wifiHost = '';
    };

    #keyboard() {
        const t = this.#i18n.t;
        const stored = this.deps?.settings?.value?.('keyboardBindings') ?? null;
        const byAction = bindingsByAction(stored);
        const capturing = this._captureAction;

        return html`<section class="group" id="bindings">
            <h3 class="ui-heading">${t('Keyboard shortcuts')}</h3>
            <p class="ui-caption prose"
                >${t('Tap Rebind, then press a key on a connected USB or Bluetooth keyboard. These keys work on the Live screen, and only on a machine with no group-head controller.')}</p>

            <div class="bindings">
                ${BINDABLE_ACTIONS.map((action) => html`<div class="binding" data-action=${action.id}>
                    <span class="ui-heading">${t(action.label)}</span>
                    ${byAction[action.id]
                        ? html`<ui-keycap>${keyLabel(byAction[action.id])}</ui-keycap>`
                        : html`<span class="ui-caption"
                            >${t('Not bound')}</span
                        >`}
                    <ui-button
                        class="rebind"
                        variant=${capturing === action.id ? 'primary' : 'default'}
                        @click=${() => this.#onRebindStart(action.id)}
                    >${t(capturing === action.id ? 'Press a key' : 'Rebind')}</ui-button>
                </div>`)}
            </div>

            ${this._bindingConflict
                ? html`<span id="binding-conflict" class="ui-caption"
                    >${t('That key already runs')} ${t(this._bindingConflict)}.</span>`
                : nothing}
            <ui-button
                id="bindings-reset"
                class="bindings-reset"
                @click=${this.#onBindingsReset}
            >${t('Reset to default')}</ui-button>
        </section>`;
    }

    #onRebindStart(actionId) {
        this.#stopCapture();
        if (this._captureAction === actionId) { this._captureAction = null; return; }
        this._captureAction = actionId;
        this._bindingConflict = null;
        const doc = this.ownerDocument ?? null;
        if (!doc) return;
        this.#captureOn = doc;
        doc.addEventListener('keydown', this.#onCaptureKey, true);
    }

    #captureOn = null;

    #stopCapture() {
        if (!this.#captureOn) return;
        this.#captureOn.removeEventListener('keydown', this.#onCaptureKey, true);
        this.#captureOn = null;
    }

    #onCaptureKey = (event) => {
        const actionId = this._captureAction;
        if (!actionId) return;
        event.preventDefault();
        event.stopPropagation();
        if (event.key === 'Escape') { this.#stopCapture(); this._captureAction = null; return; }
        const key = normaliseKey(event.key);
        if (key === null) return;

        const stored = this.deps?.settings?.value?.('keyboardBindings') ?? null;
        const clash = conflictFor(key, actionId, stored);
        if (clash) { this._bindingConflict = clash.label; return; }

        this.#stopCapture();
        this._captureAction = null;
        this._bindingConflict = null;
        Promise.resolve(this.deps?.settings?.set?.('keyboardBindings', withBinding(stored, actionId, key)))
            .catch(() => {});
    };

    #screenSaver() {
        const t = this.#i18n.t;
        const settings = this.deps?.settings;
        const images = settings?.value?.('screensaverImages');
        const list = Array.isArray(images) ? images : [];
        const type = settings?.value?.('screensaverType');
        const inert = type !== 'image';

        return html`
            <section class="group" id="saver-images" ?data-inert=${inert}>
                <div class="fact-head">
                    <h3 class="ui-heading">${t('Images')}</h3>
                    <div class="sw-row">
                        <ui-file-button
                            id="saver-pick-files"
                            multiple
                            accept="image/*"
                            ?disabled=${inert}
                            @file-pick=${this.#onSaverPick}
                        >${t('Choose images')}</ui-file-button>
                        <ui-file-button
                            id="saver-pick-folder"
                            directory
                            accept="image/*"
                            ?disabled=${inert}
                            @file-pick=${this.#onSaverPick}
                        >${t('Choose a folder')}</ui-file-button>
                        ${list.length > 0
                            ? html`<ui-button
                                id="saver-clear"
                                variant="danger"
                                ?disabled=${inert}
                                @click=${this.#onSaverClear}
                            >${t('Use the built-in image')}</ui-button>`
                            : nothing}
                    </div>
                </div>
                ${list.length > 0
                    ? html`<p id="saver-count" class="ui-caption prose"
                        >${t('{n} images chosen. A folder is read when you pick it — add it again if its contents change.', { n: list.length })}</p>`
                    : html`<p id="saver-default-note" class="ui-caption prose"
                        >${t('Using the built-in image. Choose your own to replace it.')}</p>`}
                <div class="thumbs">
                    ${(list.length > 0 ? list : [SCREENSAVER_DEFAULT_IMAGE]).map((src, index) => html`<img
                        class="thumb"
                        data-thumb=${index}
                        src=${src}
                        alt=""
                    >`)}
                </div>
            </section>
        `;
    }

    #onSaverPick = async (event) => {
        const picked = (event?.detail?.files ?? [])
            .filter((file) => typeof file?.type === 'string' && file.type.startsWith('image/'))
            .slice(0, SAVER_IMAGE_LIMIT);
        if (picked.length === 0) return;
        const urls = [];
        for (const file of picked) {
            const url = await readAsDataUrl(file);
            if (url) urls.push(url);
        }
        if (urls.length === 0) return;
        await this.deps?.settings?.set('screensaverImages', urls);
    };

    /** Back to the bundled picture: the stored list goes, and the default shows again. */
    #onSaverClear = async () => {
        await this.deps?.settings?.set('screensaverImages', []);
    };

    #defaults() {
        const t = this.#i18n.t;
        const client = this.deps?.de1Settings ?? null;
        const read = this.deps?.machineValue ?? (() => undefined);
        const machineClass = typeof this.deps?.machineClass === 'function'
            ? this.deps.machineClass()
            : null;
        const resets = RESET_FIELDS.map((row) => {
            const registryRow = SETTINGS_ROWS.find((entry) => entry.field === row.field);
            const candidate = registryRow ? leafFor(registryRow.leaf) : null;
            const reachable = candidate
                && leafShownOn(candidate, machineClass)
                && shownOnMachine(registryRow, machineClass);
            const leaf = reachable ? candidate : null;
            return { ...row, registryRow, leaf };
        });
        const pages = [...new Set(resets.map((row) => row.leaf).filter(Boolean).map(navName))];

        return html`
            <section class="group" id="defaults">
                <div class="fact-head">
                    <h3 class="ui-heading">${t('Restore default settings')}</h3>
                    <ui-button
                        id="defaults-start"
                        variant="danger"
                        ?disabled=${!client}
                        @click=${() => { this._confirm = 'defaults'; }}
                    >${t('Restore defaults')}</ui-button>
                </div>
                <p class="ui-caption prose"
                    >${t('Puts eight machine settings back to the values the machine ships with. Nothing else is touched — no profile, no calibration, no shot history.')}</p>

                <div class="resets" id="defaults-list">
                    <span class="ui-microcap resets-head">${t('Page')}</span>
                    <span class="ui-microcap resets-head">${t('Setting')}</span>
                    <span class="ui-microcap resets-head resets-num">${t('Now')}</span>
                    <span class="ui-microcap resets-head resets-num">${t('Default')}</span>
                    ${resets.map(({ registryRow, leaf, ...row }) => {
                        const now = read(row.field);
                        return html`<div class="reset" data-field=${row.field}>
                            <span class="ui-body">${leaf ? t(navName(leaf)) : MACHINE_INFO_DASH}</span>
                            <span class="ui-body">${t(registryRow?.heading ?? row.field)}</span>
                            <span class="ui-body ui-numeric resets-num">${
                                now === undefined || now === null ? MACHINE_INFO_DASH : String(now)
                            }</span>
                            <span class="ui-body ui-numeric resets-num">${String(row.value)}</span>
                        </div>`;
                    })}
                </div>

                ${this._defaultsFailed
                    ? html`<span id="defaults-refusal" class="ui-caption"
                        >${t('The machine refused. It may be busy, or not connected.')}</span
                    >`
                    : nothing}
            </section>
            <ui-confirm-dialog
                id="defaults-confirm"
                .open=${this._confirm === 'defaults'}
                question=${t('Restore these eight settings?')}
                detail=${defaultsDetail(t, pages)}
                confirm-label=${t('Restore defaults')}
                tone="destructive"
                @confirm=${this.#onDefaultsConfirm}
                @cancel=${() => { this._confirm = null; }}
                @open-change=${(event) => { if (event?.detail?.open === false) this._confirm = null; }}
            ></ui-confirm-dialog>
        `;
    }

    #onDefaultsConfirm = async () => {
        this._confirm = null;
        const client = this.deps?.de1Settings;
        if (!client) return;
        const result = await client.resetSettings();
        this._defaultsFailed = !result?.ok;
        if (!result?.ok) return;
        await this.deps?.reloadMachine?.();
        this._version += 1;
    };

    /** Back to the shipped map. Writing `null` clears the whole overrides object. */
    #onBindingsReset = () => {
        this.#stopCapture();
        this._captureAction = null;
        this._bindingConflict = null;
        Promise.resolve(this.deps?.settings?.set?.('keyboardBindings', null)).catch(() => {});
    };
}

export const WEEKDAYS = Object.freeze([
    Object.freeze({ iso: 1, label: 'Mo', name: 'Monday' }),
    Object.freeze({ iso: 2, label: 'Tu', name: 'Tuesday' }),
    Object.freeze({ iso: 3, label: 'We', name: 'Wednesday' }),
    Object.freeze({ iso: 4, label: 'Th', name: 'Thursday' }),
    Object.freeze({ iso: 5, label: 'Fr', name: 'Friday' }),
    Object.freeze({ iso: 6, label: 'Sa', name: 'Saturday' }),
    Object.freeze({ iso: 7, label: 'Su', name: 'Sunday' }),
]);

export function draftFrom(schedule) {
    if (!schedule) return { id: null, time: '07:00', days: [], keepAwakeFor: 0 };
    return {
        id: schedule.id,
        time: typeof schedule.time === 'string' ? schedule.time : '07:00',
        days: [...(schedule.daysOfWeek ?? [])].sort((a, b) => a - b),
        keepAwakeFor: Number.isFinite(schedule.keepAwakeFor) ? schedule.keepAwakeFor : 0,
    };
}

export function dayWords(days, t = (text) => text) {
    const list = [...(days ?? [])].sort((a, b) => a - b);
    if (list.length === 0) return t('Every day');
    if (list.length === 7) return t('Every day');
    return list
        .map((iso) => WEEKDAYS.find((day) => day.iso === iso))
        .filter(Boolean)
        .map((day) => t(day.label))
        .join(' ');
}

export function keepAwakeWords(minutes, t = (text) => text) {
    if (!Number.isFinite(minutes) || minutes < 1) return '';
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    if (hours > 0 && rest > 0) return ` · ${hours} ${t('hr')} ${rest} ${t('min')}`;
    if (hours > 0) return ` · ${hours} ${t('hr')}`;
    return ` · ${rest} ${t('min')}`;
}

export const CHARGING_PHASES = Object.freeze({
    inactive: 'Inactive',
    normal: 'Normal',
    hovering: 'Hovering',
    chargingToMax: 'Charging to Max',
    sleeping: 'Sleeping',
});

export function minutesToTime(minutes) {
    if (!Number.isFinite(minutes) || minutes < 0 || minutes > 1439) return '\u2014';
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

/** "HH:MM" -> minutes since midnight, or null. The inverse, and the only one. */
export function timeToMinutes(value) {
    if (typeof value !== 'string') return null;
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
}

export function numberOrNull(value) {
    const text = typeof value === 'string' ? value.trim() : value;
    if (text === '' || text === null || text === undefined) return null;
    const number = Number(text);
    return Number.isFinite(number) ? number : null;
}

customElements.define('settings-bespoke-leaf', SettingsBespokeLeaf);
