/**
 * <live-screen> — the machine's main screen: the target rail, the chart, the readings and the shot band beneath them.
 */

import { css, html, svg, nothing } from 'lit';

import { UiElement } from 'src/components/base.js';
import { seams } from 'src/components/seams.js';
import { typeRoles } from 'src/components/type-roles.js';
import { ChartFeed } from 'src/lib/chart-feed.js';
import { CLOCK_TICK_MS, DEFAULT_CLOCK_FORMAT, wallClock } from 'src/lib/wall-clock.js';
import { scalarText, shotClock, shotGrind, shotTitle } from 'src/lib/shot-summary.js';
import { hasReading } from 'src/data/reading.js';
import { readShotAnnotations } from 'src/data/rea-shot-record.js';
import { I18nController } from 'src/lib/i18n.js';

import {
    RAIL_ROW, STEAM_STOP, WATER_STOP, MACHINE_KEYS, STOP_STATE, DEFAULT_PRESETS,
    PHASE_COLUMNS, bandDerivationFor, isRunning, machineKeyGate, machineTone, phaseRows,
    railRows, stepFor, numpadBandFor,
} from 'src/lib/live-targets.js';
import {
    CHART_MODE, STEAM_Y_RANGE, STEAM_Y2_RANGE, steamChannelSpecs, steamEndLabels,
} from 'src/lib/steam-chart.js';
import { SHOT_Y_RANGE } from 'src/lib/chart-autoscale.js';
const SHOT_Y_CEILING = 16;

const CHANNEL_END_LABELS = Object.freeze({
    pressure: 'Pressure',
    flow: 'Flow',
    steamTemperature: 'Steam',
    milkTemperature: 'Milk',
});

import { liveDimming, railDimGroup, railKeepsInput } from 'src/screens/live-dimming.js';
import { isMachineAsleep } from 'src/lib/screensaver-policy.js';
import { LiveWiring } from 'src/screens/live-wiring.js';

import 'src/screens/live-header.js';
import 'src/screens/live-rail.js';
import 'src/screens/live-main.js';
import 'src/screens/live-foot.js';
import { bannerRoleFor } from 'src/screens/live-connection.js';
import { connectionSurface } from 'src/lib/connection-surface.js';
import 'src/screens/live-refusal.js';
import { DEFAULT_CHANNELS } from 'src/components/ui-chart-card.js';
import 'src/components/ui-stat-tile.js';
import 'src/components/ui-bank.js';
import 'src/components/ui-favourites-bank.js';
import 'src/components/ui-preset-bank.js';
import 'src/components/ui-stepper.js';
import 'src/components/ui-numeric-keypad.js';
import 'src/screens/live-expanded-chart.js';
import 'src/components/ui-steam-guard.js';
import 'src/components/ui-stop-button.js';
import 'src/components/ui-menu.js';
import 'src/components/ui-data-grid.js';
import 'src/components/ui-rating-control.js';
import 'src/components/ui-weather-corner.js';
import 'src/screens/weather-modal.js';
import { WEATHER_STATE, weatherState } from 'src/lib/weather-model.js';
import { WEATHER_PLUGIN_ID } from 'src/lib/weather-model.js';
import 'src/components/ui-status-chip.js';
import 'src/components/ui-alert-banner.js';
import 'src/components/ui-button.js';
import 'src/components/ui-icon-button.js';
import 'src/components/ui-dialog.js';
import 'src/components/ui-empty-state.js';
import 'src/components/ui-notes-editor.js';

import { DEFAULT_DATA_GRID_DASH } from 'src/components/ui-data-grid.js';
import {
    toDisplayLevel, normaliseTankUnit, tankDecimals, DEFAULT_TANK_UNIT,
} from 'src/lib/tank-volume.js';
import {
    normaliseUnit, toDisplayTemp, fromDisplayTemp, unitSymbol, boundToDisplay,
    decimalsForStep, DEFAULT_TEMP_UNIT,
} from 'src/lib/temperature.js';
import { DYE2_PLUGIN_ID, DYE2_PAGE_ENDPOINT } from 'src/lib/plugin-pages.js';

const DYE2_BUTTON = 'Beans';
const SAVING_SHOT = 'Saving this shot…';
const UNSAVED_SHOT = 'This shot was not saved.';
const NOTES_SAVE_FAILED = 'This note was not saved. Check the machine and try again.';
const NOTES_SAVING_REFUSAL = 'This note is still being saved. Wait for it to finish.';
const NOTES_UNSAVED_REFUSAL = 'This note has unsaved changes. Save it, or discard them, before leaving.';

const ACTIONS = Object.freeze(['Edit profile', 'Settings', 'Sleep']);

const PRIMARY_ACTION = 'Edit profile';

/** The one action whose label is not its name — see `#actionLabel`. */
const SLEEP_ACTION = 'Sleep';

const unitForRow = (row) => row?.unit ?? (row?.range?.unit ? row.range.unit : '');

const RAIL_FORMATTERS = new Map();
const railFormatter = (decimals) => {
    if (!RAIL_FORMATTERS.has(decimals)) {
        RAIL_FORMATTERS.set(decimals, (value) => {
            const n = Number(value);
            if (!Number.isFinite(n)) return String(value);
            return decimals > 0 ? n.toFixed(decimals) : String(Math.round(n));
        });
    }
    return RAIL_FORMATTERS.get(decimals);
};

const statTileStyle = (gauge) => {
    const parts = [];
    if (gauge.ink) parts.push(`--_ui-stat-ink: ${gauge.ink}`);
    if (gauge.tracking) parts.push(`--_ui-stat-value-tracking: ${gauge.tracking}`);
    if (gauge.unitSize) parts.push(`--_ui-stat-unit-size: ${gauge.unitSize}`);
    return parts.length ? parts.join('; ') : nothing;
};

const gaugeSize = (gauge) => gauge.size || 'lg';

const OLDER_GLYPH = svg`<svg class="glyph" viewBox="0 0 24 24" aria-hidden="true"
    fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
    stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>`;

const NEWER_GLYPH = svg`<svg class="glyph" viewBox="0 0 24 24" aria-hidden="true"
    fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
    stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>`;

const DISMISS_GLYPH = svg`<svg class="glyph" viewBox="0 0 24 24" aria-hidden="true"
    fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
    ><path d="M6 6l12 12M18 6L6 18"/></svg>`;

const LIBRARY_GLYPH = svg`<svg class="glyph" viewBox="0 0 24 24" aria-hidden="true"
    fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
    stroke-linejoin="round"><path d="M3 6h13"/><path d="M3 12h7"/><path d="M3 18h7"/><circle
    cx="16.5" cy="15.5" r="3.5"/><path d="M19 18l2.5 2.5"/></svg>`;

const GAUGES = Object.freeze([
    {
        key: 'time',
        label: 'Time',
        unit: 's',
        size: 'xl',
        ink: null,
        tracking: 'var(--ui-tracking-readout)',
        unitSize: 'var(--ui-text-note)',
    },
    { key: 'pressure', label: 'Pressure', unit: 'bar', size: null, ink: 'var(--ui-channel-pressure)' },
    { key: 'flow', label: 'Flow', unit: 'mL/s', size: null, ink: 'var(--ui-channel-flow)' },
    {
        key: 'weight',
        label: 'Weight',
        unit: 'g',
        size: null,
        ink: 'var(--ui-channel-weight-flow)',
        press: 'tare',
        notSteam: true,
    },
    {
        key: 'group',
        label: 'Group',
        unit: '°C',
        size: null,
        ink: 'var(--ui-channel-group-temperature)',
        notSteam: true,
    },
    {
        key: 'steam',
        label: 'Steam',
        unit: '°C',
        size: null,
        ink: 'var(--ui-channel-steam-temperature)',
    },
    {
        key: 'milk',
        label: 'Milk',
        unit: '°C',
        size: null,
        whenRead: true,
        ink: 'var(--ui-channel-milk-temperature)',
    },
    {
        key: 'tank',
        label: 'Tank',
        unit: 'mm',
        size: null,
        ink: null,
    },
]);

const SUMMARY_EVERY_S = 5;

/** One decimal, or null when there is no reading. Never "0" for "not measured". */
function reading(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(1) : null;
}

export class LiveScreen extends UiElement {
    static properties = {
        ghc: { type: Boolean, reflect: true },

        boot: { attribute: false },

        dim: { type: String, reflect: true },

        shot: { attribute: false },

        /** ReaPrime's own state name, e.g. `espresso` / `steam` / `idle`. */
        machineState: { type: String, attribute: 'machine-state', reflect: true },

        chartMode: { type: String, attribute: 'chart-mode', reflect: true },

        /** The steam session, in the shape `<ui-chart-card>` reads, or null. */
        steamDerivation: { attribute: false },

        /** The steam session has stopped and is in its settle window, so the chart may
         *  draw its end labels. `LiveWiring` reads the fold; this screen only paints. */
        steamSettled: { type: Boolean, attribute: false },

        /** The puff after a steam session is still running and the guard is on screen. */
        steamGuard: { type: Boolean, attribute: false },

        milkPresent: { type: Boolean, attribute: false },

        /** The gauge cluster's channels, keyed as GAUGES names them — each a finite
         *  number or null. `LiveWiring` is the only writer; nothing here defaults one. */
        readings: { attribute: false },

        warmer: { attribute: false },

        compliance: { attribute: false },

        /** The R2 limits table. No range is read from anywhere else. */
        limits: { attribute: false },

        /** limit key -> the machine's current target. A key with no value is a control
         *  with nothing to show, and it renders as an absence rather than as a zero. */
        targets: { attribute: false },

        /** `{ milkProbe, stopAtWeight }`, each `true | false | null`. */
        offers: { attribute: false },

        /** limit key -> preset values (#37). User data; nothing is invented here. */
        presets: { attribute: false },

        /** The two restored toggles, as state. */
        steamStop: { type: String, attribute: 'steam-stop' },
        waterStop: { type: String, attribute: 'water-stop' },

        /** The header band's favourites (#36) and the profile the machine has loaded. */
        favourites: { attribute: false },
        favourite: { type: String },
        profileName: { type: String, attribute: 'profile-name' },

        storedDerivation: { attribute: false },

        /** The stored shot's LIST row — its timestamp and its profile title, which is
         *  all the band's first block names it by. Never the 221 KB record. */
        storedShot: { attribute: false },
        shotId: { type: String, attribute: 'shot-id' },
        rating: { type: Number },

        /** The recorded shot has not reached the history yet, or never will. */
        shotSaving: { type: Boolean, attribute: 'shot-saving' },
        shotUnsaved: { type: Boolean, attribute: 'shot-unsaved' },

        /** `{ shotId, profileName, record }` for the shot on the band, or null. */
        liveShotProfile: { attribute: false },
        /**
         * THE WEATHER PLUGIN'S LAST READING, or null when the plugin is not installed.
         * Written by `LiveWiring` from `weather-store.js` and by nothing else.
         */
        weather: { attribute: false },
        historyCount: { type: Number, attribute: 'history-count' },

        dye2: { type: Boolean },

        canStepOlder: { type: Boolean, attribute: 'can-step-older' },
        canStepNewer: { type: Boolean, attribute: 'can-step-newer' },
        /** True while the arrows are on a row that is not the newest — see #bandDerivation. */
        browsingHistory: { type: Boolean, attribute: 'browsing-history' },

        /** The numpad's open target: the limit key being typed, or null. */
        _typing: { state: true },

        _presetTyping: { state: true },

        /** Which cell a press-and-hold opened the actions menu for, or null. */
        _hold: { state: true },

        _expanded: { state: true },
        _notes: { state: true },
        /** Whether the weather detail modal is open. */
        _weatherOpen: { state: true },
        _notesDirty: { state: true },
        _notesSaving: { state: true },
        _notesError: { state: true },

        /** The wall clock's current spelling. State, because nothing outside this
         *  screen owns the time of day (see THE WALL CLOCK above). */
        _clock: { state: true },

        clockFormat: { type: String, attribute: 'clock-format' },

        tankUnit: { type: String, attribute: 'tank-unit' },

        tempUnit: { type: String, attribute: 'temp-unit' },

        restoreFocusTo: { attribute: false },
    };

    static styles = [typeRoles, seams, liveDimming, css`
        .chart-summary {
            display: block;
            block-size: 0;
            clip-path: inset(50%);
        }

        :host(.seam-grid) {
            grid-template-columns: var(--ui-rail-w) minmax(0, 1fr);
            grid-template-rows:
                var(--ui-band-h)
                minmax(0, 1fr)
                fit-content(var(--ui-live-foot-max-share));
            block-size: 100%;
        }

        live-header {
            grid-column: 1 / -1;
            grid-row: 1;
            min-inline-size: 0;
        }

        live-rail {
            grid-column: 1;
            grid-row: 2 / 4;
            min-block-size: 0;
            min-inline-size: 0;
        }

        live-main {
            grid-column: 2;
            grid-row: 2;
            min-inline-size: 0;
        }

        live-foot {
            grid-column: 2;
            grid-row: 3;
            min-inline-size: 0;
        }

        ui-favourites-bank {
            flex: 1 1 auto;
            min-inline-size: 0;
        }

        .actions {
            display: flex;
            flex-direction: row;
            align-items: center;
            gap: var(--ui-space-3);
        }

        .warmer {
            display: grid;
            justify-items: center;
            gap: var(--ui-space-1);
            line-height: 1;
        }

        .warmer-state {
            font-size: var(--ui-text-xs);
        }

        ui-stepper[data-channel="temperature"] {
            --_ui-stepper-number-ink: var(--ui-channel-target-group-temperature);
        }

        ui-stepper[data-channel="flow"] {
            --_ui-stepper-number-ink: var(--ui-channel-target-flow);
        }

        ui-stepper[data-stop] {
            --_ui-stepper-label-wrap: normal;
        }

        ui-stepper[data-continuation] {
            --_ui-stepper-label-size: var(--ui-text-xs);
            --_ui-stepper-label-wrap: normal;
        }

        live-rail ui-stepper {
            --_ui-stepper-label-size: var(--ui-text-base);
        }

        .glyph {
            inline-size: var(--ui-icon);
            block-size: var(--ui-icon);
        }

        .clock {
            color: var(--ui-text);
            font-size: var(--ui-text-2xl);
            font-weight: var(--ui-weight-light);
            line-height: 1.2;
            white-space: nowrap;
        }

        .stack {
            display: grid;
        }

        .stack > * {
            grid-area: 1 / 1;
        }

        .stack > ui-stop-button {
            isolation: isolate;
        }

        live-rail > * {
            inline-size: 100%;
        }

        live-rail {
            --_ui-rail-well-floor: calc(
                2 * var(--ui-hit-min) + var(--ui-stepper-value-min) + 2 * var(--ui-border-w));
        }

        live-rail > ui-preset-bank {
            padding-inline-start: calc(var(--ui-space-4) + min(
                var(--ui-stepper-label-w),
                calc(100% - var(--ui-space-4) - var(--_ui-rail-well-floor))));

            margin-block-start: calc(-0.8 * var(--ui-space-6));
        }

        live-rail > [data-section-start] {
            border-block-start: var(--ui-hairline) solid var(--ui-line);

            margin-block-start: calc(var(--ui-space-5) - var(--ui-space-6));
            padding-block-start: var(--ui-space-5);
        }

        .gauges {
            display: flex;
            flex-direction: row;
            flex-wrap: wrap;
            gap: var(--ui-space-3) var(--ui-space-5);
        }

        .gauges > ui-stat-tile {
            flex: 1 1 0;
        }

        .stats-block {
            position: relative;
            display: grid;
            grid-template-rows: auto auto auto;
            min-inline-size: 0;
        }

        .identity { grid-row: 1; }
        .gauges { grid-row: 3; }

        .identity {
            display: flex;
            flex-direction: row;
            align-items: baseline;
            gap: var(--ui-space-2);
            min-inline-size: 0;

            padding-block-end: var(--ui-space-5);
        }

        .profile-name {
            margin: 0;
            min-inline-size: 0;
            overflow: hidden;
            color: var(--ui-text);
            font-size: var(--ui-text-2xl);
            font-weight: var(--ui-weight-medium);
            line-height: 1.2;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .profile-dose {
            flex: 0 0 auto;
            color: var(--ui-muted);
            font-size: var(--ui-text-md);
            font-weight: var(--ui-weight-regular);
        }

        .identity ui-status-chip {
            margin-inline-start: auto;
            --_ui-status-chip-size: var(--ui-text-lg);
        }

        :host([chart-mode="steam"]) #profile-name,
        :host([chart-mode="steam"]) #profile-dose {
            visibility: hidden;
        }

        .clock {
            flex: 0 0 auto;
        }

        .notices {
            display: flex;
            flex-direction: column;
            min-inline-size: 0;
        }

        .notices > * {
            margin-block-end: var(--ui-space-3);
        }

        /* Out of flow, so a banner sits over the gauges instead of pushing them down. */
        .notice-layer {
            grid-row: 3 / -1;
            position: absolute;
            inset-inline: 0;
            inset-block-start: calc(-1 * var(--ui-space-5));
            block-size: max(
                calc(100% + var(--ui-space-5) + var(--ui-space-4) - var(--ui-space-3)),
                calc(var(--ui-display-xl) + var(--ui-text-lg) + var(--ui-space-6)
                    + var(--ui-space-5) + var(--ui-space-3) + var(--ui-space-1))
            );
            overflow-y: auto;
            z-index: 1;
            display: flex;
            flex-direction: column;
            min-block-size: 0;
            pointer-events: none;
        }

        .notice-layer > * { pointer-events: auto; }
        .notice-layer > .notices { flex: 0 0 auto; }

        .notice-layer .hushed {
            display: none;
        }

        .connection-notice {
            flex: 1 0 auto;
        }

        .command-note {
            margin: 0;
            color: var(--ui-muted);
            font-size: var(--ui-text-md);
            font-weight: var(--ui-weight-regular);
        }

        .remedy {
            display: block;
            min-inline-size: 0;
        }

        .ghc-strip {
            display: grid;
            grid-auto-flow: column;
            grid-auto-columns: 1fr;
            gap: var(--ui-space-3);
            min-block-size: var(--ui-control-h);
        }

        .ghc-strip ui-button {
            display: grid;
        }

        #hold-menu {
            display: contents;
        }

        .foot-grid {
            display: grid;
            --_ui-foot-pitch: calc(var(--ui-text-lg) * 1.5 + var(--ui-space-2));
            grid-template-columns: auto minmax(0, 1fr) auto auto;

            align-items: stretch;

            gap: var(--ui-space-4);
            min-block-size: 0;
            min-inline-size: 0;
        }

        .foot-grid > * + * {
            border-inline-start: var(--ui-hairline) solid var(--ui-line);
            padding-inline-start: var(--ui-space-4);
        }

        .foot-shot {
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            gap: var(--ui-space-1);
            min-inline-size: 0;
        }

        .foot-shot p {
            margin: 0;
            white-space: nowrap;
        }

        .shot-nav {
            display: flex;
            flex-direction: row;
            align-items: center;
            inline-size: 100%;
            gap: var(--ui-space-2);

            margin-block-start: var(--ui-space-3);
        }

        .shot-head {
            display: flex;
            align-items: baseline;
            gap: var(--ui-space-3);
            flex-wrap: wrap;
            min-inline-size: 0;
        }

        .shot-when {
            color: var(--ui-text);
            font-size: var(--ui-text-lg);
            font-weight: var(--ui-weight-medium);
        }

        .shot-profile {
            overflow: hidden;
            color: var(--ui-muted);
            font-size: var(--ui-text-lg);
            font-weight: var(--ui-weight-medium);
            text-overflow: ellipsis;
            white-space: normal;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            line-height: 1.25;
        }

        .shot-charge {
            display: flex;
            flex-direction: row;
            gap: var(--ui-space-2);
            color: var(--ui-muted);
            font-size: var(--ui-text-md);
        }

        .notes-sheet {
            display: flex;
            flex-direction: column;
            gap: var(--ui-space-3);
        }

        .notes-identity p {
            margin: 0;
        }

        .notes-body {
            margin: 0;
            color: var(--ui-text);
            font-size: var(--ui-text-md);
            white-space: pre-wrap;
        }

        .notes-refusal {
            max-inline-size: var(--ui-measure);
            margin: 0;
            color: var(--ui-status-danger);
            font-size: var(--ui-text-note);
            line-height: 1.5;
        }

        .foot-derived {
            display: grid;
            grid-template-columns: auto auto;
            align-items: baseline;
            grid-auto-rows: var(--_ui-foot-pitch);
            gap: 0 var(--ui-space-5);
            margin: 0;
            min-inline-size: 0;
            block-size: 100%;
            align-content: end;
            padding-block-end: calc(var(--_ui-foot-pitch) / 2);
        }

        .foot-derived dt {
            font-size: var(--ui-text-2xs);
        }

        .foot-derived dd {
            margin: 0;
            justify-self: end;
            color: var(--ui-text);
            font-size: var(--ui-text-lg);
            font-weight: var(--ui-weight-light);
            white-space: nowrap;
        }

        .foot-controls {
            display: flex;
            flex-direction: column;
            align-items: stretch;
            justify-content: space-between;
            gap: var(--ui-space-2);
            min-inline-size: 0;
        }

        .foot-controls > ui-rating-control {
            flex: 1 1 auto;
        }

        .foot-controls > .rating-waiting,
        .foot-controls > .rating-unsaved {
            flex: 1 1 auto;
            margin: 0;
            color: var(--ui-muted);
            font-size: var(--ui-text-md);
        }

        .shot-nav #history-entry {
            flex: 1 1 auto;
            min-inline-size: 0;
        }

        .shot-nav ui-icon-button {
            flex: 0 0 auto;
            inline-size: var(--ui-control-lg);
        }

        .foot-controls {
            min-inline-size: calc(2 * var(--ui-control-lg) + var(--ui-space-2));
        }

        .foot-grid > ui-data-grid {
            --_ui-data-grid-row-pitch: var(--_ui-foot-pitch);
            min-inline-size: 0;
            overflow: hidden;

        }
    `];

    #i18n = new I18nController(this);

    #chart = new ChartFeed(this);

    #wiring = new LiveWiring(this);
    #steamY2Held = null;

    #summary = '';

    #summaryKey = null;

    constructor() {
        super();
        this.ghc = false;
        this.boot = null;
        /* No dim state until a machine state arrives. `null` is the absence of the
         * attribute, so a screen that is not dimming carries nothing to clear. */
        this.dim = null;
        this.shot = null;
        /* Nothing is invented at construction: no target value, no favourite, no
         * preset and no limits table. A screen that defaulted a number would be
         * showing a setting the machine never sent. */
        this.machineState = '';
        this.chartMode = CHART_MODE.ESPRESSO;
        this._expanded = false;
        this._notes = false;
        this._weatherOpen = false;
        this._notesDirty = false;
        this._notesSaving = false;
        this._notesError = '';
        this.dye2 = false;
        this.compliance = null;
        this.steamDerivation = null;
        this.steamSettled = false;
        this.steamGuard = false;
        this.milkPresent = false;
        this.readings = null;
        this.weather = null;
        this.warmer = null;
        this.limits = null;
        this.targets = null;
        this.offers = null;
        this.presets = null;
        this.steamStop = null;
        this.waterStop = null;
        this.favourites = null;
        this.favourite = '';
        this.profileName = '';
        this.storedDerivation = null;
        this.storedShot = null;
        this.shotId = '';
        this.shotSaving = false;
        this.shotUnsaved = false;
        this.liveShotProfile = null;
        this.rating = null;
        this.historyCount = 0;
        this.canStepOlder = false;
        this.canStepNewer = false;
        this.browsingHistory = false;
        this._typing = null;
        this._presetTyping = null;
        this._hold = null;
        this._clock = '';
        this.clockFormat = DEFAULT_CLOCK_FORMAT;
        this.restoreFocusTo = null;
    }

    /** The wall clock's one interval, or null while this screen is not in a document. */
    #clockTimer = null;

    connectedCallback() {
        super.connectedCallback();
        this.classList.add('seam-grid', 'seam-strong');
        this.addEventListener('stop-request', this.#onStopRequest);
        this.#tick();
        if (this.#clockTimer === null) this.#clockTimer = setInterval(() => this.#tick(), CLOCK_TICK_MS);
    }

    /** The other half of the interval, and the whole of its cleanup. A route swap
     *  disconnects this element, so the clock dies with the screen it is drawn on. */
    disconnectedCallback() {
        this.removeEventListener('stop-request', this.#onStopRequest);
        if (this.#clockTimer !== null) {
            clearInterval(this.#clockTimer);
            this.#clockTimer = null;
        }
        super.disconnectedCallback();
    }

    /** Read the clock; write the property ONLY when the spelling has changed, so a
     *  1 Hz tick costs one render a minute (see THE TIMER above). */
    #tick() {
        const now = wallClock(new Date(), this.#i18n.language, this.clockFormat ?? DEFAULT_CLOCK_FORMAT);
        if (now !== this._clock) this._clock = now;
    }

    /** The buffer is handed to the chart's road; nothing else here reads it. */
    willUpdate(changed) {
        super.willUpdate?.(changed);
        if (changed.has('boot') && !this.shot) this.shot = this.boot?.live?.shot ?? null;
        const identity = this.liveShotProfile;
        this.#chart.record = identity?.shotId === this.shot?.get?.().shotId ? identity?.record ?? null : null;
        this.#chart.watch(this.shot ?? null);
        this.#refreshSummary();
    }

    /** The derivation on screen right now. For the suite, and for the rows that will
     *  read the same shot the chart is drawing (the phase table, the gauges). */
    get derivation() { return this.#chart.derivation; }

    get chartDerivations() { return this.#chart.derivations; }

    #refreshSummary() {
        const derivation = this.#bandDerivation;
        const ok = Boolean(derivation && derivation.ok);
        const seconds = ok ? derivation.scalars.durationSeconds : null;
        const key = [
            this.#i18n.language,
            this.#steaming,
            ok,
            derivation ? derivation.reason ?? null : null,
            derivation ? derivation.shotId : null,
            derivation ? derivation.phase : null,
            typeof seconds === 'number' ? Math.floor(seconds / SUMMARY_EVERY_S) : null,
        ].join('|');
        if (key === this.#summaryKey) return;
        this.#summaryKey = key;
        this.#summary = this.#sentence(derivation);
    }

    #sentence(derivation) {
        const t = this.#i18n.t;
        if (this.#steaming) {
            return t('Steam chart. Steam sessions have no expanded chart, so this one does not open.');
        }
        if (!derivation || !derivation.ok) {
            return derivation && derivation.reason === 'noPouringSample'
                ? t('Shot chart. This shot has no pouring samples to draw.')
                : t('Shot chart. No shot yet.');
        }
        const scalars = derivation.scalars;
        const seconds = reading(scalars.durationSeconds);
        const pressure = reading(scalars.peakPressure);
        const flow = reading(scalars.averageFlow);
        const weight = reading(scalars.yield);
        const parts = [seconds
            ? t('Shot chart, {seconds} seconds.', { seconds })
            : t('Shot chart.')];
        if (pressure) parts.push(t('Peak pressure {pressure} bar.', { pressure }));
        if (flow) parts.push(t('Average flow {flow} millilitres per second.', { flow }));
        if (weight) parts.push(t('Yield {weight} grams.', { weight }));
        return parts.join(' ');
    }

    /** The words over the axes when the derivation refuses. The card owns the surface
     *  and knows no words; the reason is gate 6's and the sentence is this screen's. */
    #emptyMessage() {
        const t = this.#i18n.t;
        const shown = this.#bandDerivation;
        const reason = shown ? shown.reason : null;
        if (reason === 'noPouringSample') return t('No pouring samples in this shot.');
        return t('No shot yet.');
    }

    /** Is the machine doing something the STOP target would abort? The enum decides
     *  (`isRunning`), not this file, and #47 is told rather than asked. */
    get #weatherShowing() {
        return weatherState(this.weather) !== WEATHER_STATE.HIDDEN;
    }

    get #running() { return isRunning(this.machineState); }

    /** The words the status chip shows for the machine's current state. */
    get #machineStatus() {
        switch (this.machineState) {
            case 'idle': return 'Machine idle';
            case 'steam': return 'Steaming';
            case 'espresso': return 'Pulling a shot';
            default: return this.machineState || 'No reading';
        }
    }

    /** The chip's tone, or `nothing` — a stale feed has no state to colour. */
    get #machineTone() {
        if (this.#machineStale) return nothing;
        return machineTone(this.machineState) ?? nothing;
    }

    get #steaming() { return this.chartMode === CHART_MODE.STEAM; }

    get #steamSpecs() { return steamChannelSpecs({ milk: this.milkPresent }); }

    get #machineStale() { return this.#wiring.machineStale; }

    get #doseNote() {
        const dose = this.#valueOf('dose');
        if (dose === undefined) return '';
        const unit = this.limits?.dose?.unit ?? '';
        return `· ${scalarText(dose, unit ? { unit } : {})}`;
    }

    get #rows() {
        return railRows({
            limits: this.limits ?? null,
            steamStop: this.steamStop ?? null,
            waterStop: this.waterStop ?? null,
            offers: this.offers ?? {},
            presets: this.presets ?? {},
            tempUnit: this.#tempUnit,
        });
    }

    get #bandDerivation() {
        return bandDerivationFor(this.derivation, this.storedDerivation, {
            browsing: this.browsingHistory,
            running: this.#running,
        });
    }

    /** The profile name for the shot on the band — the stored one's, or the live one's. */
    get #shotProfileName() {
        const shown = this.#bandDerivation;
        if (!shown) return '';
        if (shown === this.storedDerivation) return shotTitle(this.storedShot) ?? '';
        const identity = this.liveShotProfile;
        return identity && identity.shotId === shown.shotId && typeof identity.profileName === 'string'
            ? identity.profileName
            : '';
    }

    get #gauges() {
        const readings = this.readings ?? null;
        const steaming = this.#steaming;
        return GAUGES.filter((gauge) => {
            if (steaming && gauge.notSteam) return false;
            return !gauge.whenRead
                || (readings && readings[gauge.key] !== null && readings[gauge.key] !== undefined);
        });
    }

    #reading(gauge) {
        if (gauge.key === 'time') {
            const derivation = this.#steaming ? this.steamDerivation : this.derivation;
            if (this.#steaming) {
                const ts = derivation && derivation.ok ? (derivation.axis?.t ?? []) : [];
                return scalarText(ts.length ? ts[ts.length - 1] : 0);
            }
            return derivation && derivation.ok
                ? scalarText(derivation.scalars.durationSeconds)
                : scalarText(0);
        }
        const held = this.readings ? this.readings[gauge.key] : null;
        if (gauge.unit === '°C') {
            if (!hasReading(held)) return DEFAULT_DATA_GRID_DASH;
            return scalarText(toDisplayTemp(held, this.#tempUnit), { dash: DEFAULT_DATA_GRID_DASH });
        }
        if (gauge.key === 'tank') {
            return scalarText(toDisplayLevel(held, this.#tankUnit), {
                dash: DEFAULT_DATA_GRID_DASH,
                decimals: tankDecimals(),
            });
        }
        return scalarText(held, { dash: DEFAULT_DATA_GRID_DASH });
    }

    get #tankUnit() {
        return normaliseTankUnit(this.tankUnit) ?? DEFAULT_TANK_UNIT;
    }

    /** The steam chart's right-hand axis, in display units. */
    get #steamY2() {
        const unit = this.#tempUnit;
        if (!this.#steamY2Held || this.#steamY2Held.unit !== unit) {
            this.#steamY2Held = Object.freeze({
                unit,
                spec: Object.freeze({
                    range: Object.freeze(STEAM_Y2_RANGE.map((c) => boundToDisplay(c, unit))),
                }),
            });
        }
        return this.#steamY2Held.spec;
    }

    get #tempUnit() {
        return normaliseUnit(this.tempUnit) ?? DEFAULT_TEMP_UNIT;
    }

    #gaugeUnit(gauge) {
        if (gauge.key === 'tank') return this.#tankUnit;
        if (gauge.unit === '°C') return unitSymbol(this.#tempUnit);
        return gauge.unit;
    }

    /** The value a target currently holds, or undefined. Undefined is a real answer:
     *  the control is shown with the dash and cannot be stepped. */
    #valueOf(key) {
        const held = this.targets ? this.targets[key] : undefined;
        if (typeof held !== 'number' || !Number.isFinite(held)) return undefined;
        return toDisplayTemp(held, this.#unitOf(key));
    }

    #unitOf(key) {
        const range = this.limits ? this.limits[key] : null;
        return range && range.unit === '°C' ? this.#tempUnit : DEFAULT_TEMP_UNIT;
    }

    /** One rail track. The kind decides the component; nothing here decides a look. */
    #renderRow(row) {
        const t = this.#i18n.t;
        if (row.kind === RAIL_ROW.PRESETS) {
            return html`
                <ui-preset-bank
                    label=${t(row.label)}
                    data-section-start=${row.sectionStart ? '' : nothing}
                    .presets=${row.presets}
                    .value=${this.#valueOf(row.limitKey) ?? null}
                    .step=${this.limits?.[row.limitKey]?.step ?? null}
                    data-key=${row.limitKey}
                    data-dim-group=${railDimGroup(row.id) ?? nothing}
                    data-dim-keeps-input=${railKeepsInput(row.id) ? '' : nothing}
                    hold
                    @preset-select=${this.#onPreset}
                    @preset-hold=${this.#onPresetHold}
                ></ui-preset-bank>`;
        }

        const range = row.range;
        const value = this.#valueOf(row.limitKey);
        const unit = unitForRow(row);

        const unavailable = row.unavailable !== null || (value === undefined && !row.authored);
        const stepper = html`
            <ui-stepper
                label=${t(row.label)}
                label-position="start"
                unit=${unit}
                .value=${value ?? null}
                .min=${range ? range.min : null}
                .max=${range ? range.max : null}
                .step=${range ? range.step : null}
                .next=${stepFor(this.limits, row.limitKey, this.#tempUnit)}
                .format=${this.#formatFor(row, unavailable)}
                ?disabled=${unavailable}
                ?editable=${!unavailable}
                data-key=${row.limitKey}
                data-row=${row.id}
                data-section-start=${row.sectionStart ? '' : nothing}
                data-continuation=${row.continuation ? '' : nothing}
                ?label-hidden=${Boolean(row.continuation)}
                data-stop=${row.stopMode ? '' : nothing}
                data-dim-group=${railDimGroup(row.id) ?? nothing}
                data-channel=${row.channel ?? nothing}
                decrease-label=${t('Less')}
                increase-label=${t('More')}
                @change=${this.#onTarget}
                @edit=${this.#onEdit}
            ></ui-stepper>`;

        if (!row.abortSlot) return stepper;
        return html`
            <div class="stack"
                data-section-start=${row.sectionStart ? '' : nothing}
                data-dim-group=${railDimGroup(row.id) ?? nothing}>
                ${stepper}
                ${this.#running ? html`<ui-stop-button running></ui-stop-button>` : nothing}
            </div>`;
    }

    #formatFor(row, unavailable) {
        if (unavailable) return () => DEFAULT_DATA_GRID_DASH;
        if (!row.range) return undefined;
        return railFormatter(row.range.decimals ?? decimalsForStep(row.range.step));
    }

    #presetCell(cell) {
        if (!cell) return null;
        const rows = this.#rows;
        const bank = rows.find((candidate) => candidate.kind === RAIL_ROW.PRESETS
            && candidate.limitKey === cell.key);
        const target = rows.find((candidate) => candidate.kind !== RAIL_ROW.PRESETS
            && candidate.limitKey === cell.key);
        const cells = bank && Array.isArray(bank.presets) ? bank.presets : null;
        if (!cells || !Number.isInteger(cell.index) || cell.index < 0 || cell.index >= cells.length) {
            return null;
        }
        return { target, value: cells[cell.index], index: cell.index, key: cell.key };
    }

    #renderKeypad() {
        const t = this.#i18n.t;
        const cell = this.#presetCell(this._presetTyping);
        if (cell) {
            const label = cell.target ? t(cell.target.label) : '';
            return html`
                <ui-numeric-keypad
                    open
                    heading=${t('{label} preset {n}', { label, n: cell.index + 1 })}
                    .limits=${this.limits ?? null}
                    .limitKey=${cell.key}
                    .band=${numpadBandFor(cell.target, this.limits ?? null, this.#unitOf(cell.key))}
                    .value=${String(cell.value)}
                    unit=${unitForRow(cell.target)}
                    @confirm=${this.#onKeypadConfirm}
                    @open-change=${this.#onKeypadClose}
                ></ui-numeric-keypad>`;
        }
        const key = this._typing;
        const row = key ? this.#rows.find((candidate) => candidate.limitKey === key) : null;
        const value = key ? this.#valueOf(key) : undefined;
        return html`
            <ui-numeric-keypad
                ?open=${Boolean(key)}
                heading=${row ? t(row.label) : ''}
                .limits=${this.limits ?? null}
                .limitKey=${key ?? ''}
                .band=${numpadBandFor(row, this.limits ?? null, this.#unitOf(key))}
                .value=${value === undefined ? '' : String(value)}
                unit=${unitForRow(row)}
                @confirm=${this.#onKeypadConfirm}
                @open-change=${this.#onKeypadClose}
            ></ui-numeric-keypad>`;
    }

    #commit(key, value, presetIndex = null) {
        const celsius = fromDisplayTemp(Number(value), this.#unitOf(key));
        let refused = false;
        this.dispatchEvent(new CustomEvent('target-change', {
            detail: { key, value: celsius, presetIndex, refuse: () => { refused = true; } },
            bubbles: true,
            composed: true,
        }));
        if (refused) return;
        this.targets = { ...(this.targets ?? {}), [key]: celsius };
    }

    #onTarget(event) {
        const key = event.target.dataset.key;
        if (key) this.#commit(key, event.detail.value);
    }

    #onPreset(event) {
        const key = event.target.dataset.key;
        /* THE CELL'S OWN POSITION, off `preset-select`'s detail — the component sends
         * `{value, label, index}` and nothing here counts cells for itself. */
        const index = event.detail?.index;
        if (key) this.#commit(key, event.detail.value, Number.isInteger(index) ? index : null);
    }

    #onEdit(event) {
        this._presetTyping = null;
        this._typing = event.target.dataset.key ?? null;
    }

    #onKeypadConfirm(event) {
        const { limitKey, value } = event.detail;
        const cell = this._presetTyping;
        if (cell) {
            this.dispatchEvent(new CustomEvent('preset-edit', {
                detail: { key: cell.key, index: cell.index, value: Number(value) },
                bubbles: true,
                composed: true,
            }));
        } else if (limitKey) {
            this.#commit(limitKey, value);
        }
        this._typing = null;
        this._presetTyping = null;
    }

    #onKeypadClose(event) {
        if (!event.detail.open) { this._typing = null; this._presetTyping = null; }
    }

    #onPresetHold(event) {
        const key = event.currentTarget.dataset.key;
        const index = event.detail?.index;
        if (!key || !Number.isInteger(index)) return;
        this._hold = { kind: 'preset', key, index, value: event.detail.value };
        this.#openHoldMenu(event.currentTarget);
    }

    #onFavouriteHold(event) {
        const slot = event.detail?.slot;
        if (!Number.isInteger(slot)) return;
        this._hold = { kind: 'favourite', slot, value: event.detail.value ?? null,
            filled: !!event.detail.filled };
        this.#openHoldMenu(event.currentTarget);
    }

    #openHoldMenu(anchorElement) {
        const menu = this.renderRoot?.getElementById?.('hold-menu');
        if (!menu) return;
        menu.anchorElement = anchorElement;
        menu.open = true;
    }

    #holdItems() {
        const t = this.#i18n.t;
        const hold = this._hold;
        if (!hold) return [];
        if (hold.kind === 'favourite') {
            if (!hold.filled) return [{ id: 'browse', label: t('Choose for this slot') }];
            return [
                { id: 'edit', label: t('Edit profile') },
                { id: 'replace', label: t('Replace with') },
                { separator: true },
                { id: 'clear', label: t('Clear this favourite'), danger: true },
            ];
        }
        const current = this.#valueOf(hold.key);
        const shipped = DEFAULT_PRESETS[hold.key];
        const factory = Array.isArray(shipped) ? shipped[hold.index] : undefined;
        const number = (value) => (typeof value === 'number' && Number.isFinite(value)
            ? String(value) : null);
        const items = [
            { id: 'apply', label: t('Apply {value}').replace('{value}', String(hold.value)) },
            { id: 'enter', label: t('Enter value') },
        ];
        if (number(current) !== null) {
            items.push({ id: 'save',
                label: t('Save current ({value}) here').replace('{value}', number(current)) });
        }
        if (number(factory) !== null && factory !== hold.value) {
            items.push({ separator: true });
            items.push({ id: 'revert', danger: true,
                label: t('Revert to {value}').replace('{value}', number(factory)) });
        }
        return items;
    }

    #onHoldSelect(event) {
        const hold = this._hold;
        const id = event.detail?.id;
        if (!hold || !id) return;
        if (hold.kind === 'favourite') {
            this.dispatchEvent(new CustomEvent('favourite-action', {
                detail: { action: id, slot: hold.slot, value: hold.value },
                bubbles: true,
                composed: true,
            }));
            return;
        }
        if (id === 'apply') { this.#commit(hold.key, hold.value, hold.index); return; }
        if (id === 'enter') {
            this._typing = null;
            this._presetTyping = { key: hold.key, index: hold.index };
            return;
        }
        if (id === 'save' || id === 'revert') {
            const shipped = DEFAULT_PRESETS[hold.key];
            const next = id === 'save'
                ? this.#valueOf(hold.key)
                : (Array.isArray(shipped) ? shipped[hold.index] : undefined);
            if (typeof next !== 'number' || !Number.isFinite(next)) return;
            this.dispatchEvent(new CustomEvent('preset-edit', {
                detail: { key: hold.key, index: hold.index, value: next },
                bubbles: true,
                composed: true,
            }));
        }
    }

    #renderHoldMenu() {
        const t = this.#i18n.t;
        return html`
            <ui-menu
                id="hold-menu"
                label=${t('Actions')}
                .items=${this.#holdItems()}
                @select=${this.#onHoldSelect}
            ></ui-menu>`;
    }

    #renderShotIdentity() {
        const t = this.#i18n.t;
        const shot = this.storedShot;
        const clock = shotClock(shot ? shot.timestamp : null);
        const title = shot ? shotTitle(shot) : '';
        const dose = this.#bandDerivation && this.#bandDerivation.ok
            ? this.#bandDerivation.scalars.dose : null;
        return html`
            <div class="foot-shot">
                ${shot && clock.ok
                    ? html`<div class="shot-head">
                            <p class="shot-when">${clock.dateSummary} ${clock.time}</p>
                            <p class="shot-charge">
                                <span>${t('In {dose} g', { dose: scalarText(dose) })}</span>
                                <span aria-hidden="true">|</span>
                                <span>${t('Grind {grind}', {
                                    grind: scalarText(shotGrind(shot), { dash: DEFAULT_DATA_GRID_DASH }),
                                })}</span>
                            </p>
                        </div>
                        ${title ? html`<p class="shot-profile">${title}</p>` : nothing}`
                    : nothing}
                <div class="shot-nav">
                    <ui-icon-button id="shot-older" size="md"
                        label=${t('Older shot')}
                        ?disabled=${!this.canStepOlder}
                        @click=${this.#onStepOlder}
                        >${OLDER_GLYPH}</ui-icon-button
                    >
                    <ui-button id="history-entry" @click=${this.#openHistory}
                        >${t('All shots')}</ui-button>
                    <ui-icon-button id="shot-newer" size="md"
                        label=${t('Newer shot')}
                        ?disabled=${!this.canStepNewer}
                        @click=${this.#onStepNewer}
                        >${NEWER_GLYPH}</ui-icon-button
                    >
                </div>
            </div>`;
    }

    #renderDerived() {
        const t = this.#i18n.t;
        const derivation = this.#bandDerivation;
        const s = derivation && derivation.ok ? derivation.scalars : null;
        const pair = (a, b) => [a, b].map((value) => scalarText(value)).join(' / ');
        const rows = [
            [t('Ratio'), s && s.ratio !== null ? `1:${scalarText(s.ratio)}` : DEFAULT_DATA_GRID_DASH],
            [t('First drop'), scalarText(s ? s.timeToFirstDrop : null)],
            [t('Flow avg/peak'), pair(s ? s.averageFlow : null, s ? s.peakFlowAfterFirstDrop : null)],
            [t('Press avg/peak'), pair(s ? s.averagePressure : null, s ? s.peakPressure : null)],
        ];
        return html`
            <dl class="foot-derived">
                ${rows.map(([term, value]) => html`
                    <dt class="ui-microcap">${term}</dt>
                    <dd class="ui-numeric">${value}</dd>`)}
            </dl>`;
    }

    #openHistory = (event) => {
        const invoker = event?.currentTarget?.id ?? 'history-entry';
        this.dispatchEvent(new CustomEvent('navigate', {
            detail: { route: 'history', invoker },
            bubbles: true,
            composed: true,
        }));
    };

    #openNotes = () => { this._notes = true; };

    #openWeather = () => { this._weatherOpen = true; };

    #saveWeatherLocation = async (event) => {
        const location = event?.detail?.location;
        const plugins = this.boot ? this.boot.plugins : null;
        if (!location || !plugins || typeof plugins.writeSettings !== 'function') return;
        try {
            await plugins.writeSettings(WEATHER_PLUGIN_ID, { Location: location });
        } catch {
        }
    };

    #renderWeatherModal() {
        if (!this._weatherOpen) return nothing;
        return html`<weather-modal
            open
            .reading=${this.weather}
            @weather-location=${this.#saveWeatherLocation}
            @open-change=${this.#onWeatherOpenChange}
        ></weather-modal>`;
    }

    #onWeatherOpenChange = (event) => {
        if (event && event.detail && event.detail.open === false) this._weatherOpen = false;
    };

    #openDye2 = () => {
        const url = this.boot?.plugins?.pageUrl?.(DYE2_PLUGIN_ID, DYE2_PAGE_ENDPOINT);
        if (!url) return;
        try {
            this.ownerDocument?.defaultView?.open?.(url, '_blank', 'noopener');
        } catch {
            /* A WebView that refuses to open a context throws rather than returning null.
             * There is nowhere on this corner to say so — see the paragraph above. */
        }
    };

    #openExpanded = () => {
        if (this.#steaming) return;
        this._expanded = true;
    };

    async #restoreFocus() {
        const wanted = this.restoreFocusTo;
        if (typeof wanted !== 'string' || wanted === '') return;
        this.restoreFocusTo = null;
        const target = this.renderRoot?.getElementById?.(wanted);
        if (!target) return;
        await target.updateComplete;
        target.focus?.({ preventScroll: true });
    }

    updated(changed) {
        super.updated?.(changed);
        this.#restoreFocus();
        this.#applySteamLabels();
    }

    #applySteamLabels() {
        const card = this.renderRoot?.getElementById?.('live-chart');
        if (!card || typeof card.setEndLabels !== 'function') return;
        const t = this.#i18n.t;
        const show = this.#steaming && this.steamSettled;
        const unit = this.#tempUnit;
        const labels = show
            ? steamEndLabels(this.steamDerivation, this.#steamSpecs)
                .map((label) => ({
                    ...label,
                    y: label.scale === 'y2' ? toDisplayTemp(label.y, unit) : label.y,
                    text: t(CHANNEL_END_LABELS[label.key] ?? label.key),
                }))
            : [];
        card.setEndLabels(labels);
    }

    #onFavourite(event) {
        this.dispatchEvent(new CustomEvent('favourite-select', {
            detail: { value: event.detail.value }, bubbles: true, composed: true,
        }));
    }

    #onStepOlder() { this.#stepShot(1); }

    #onStepNewer() { this.#stepShot(-1); }

    #stepShot(delta) {
        this.dispatchEvent(new CustomEvent('shot-step', {
            detail: { delta }, bubbles: true, composed: true,
        }));
    }

    #onGaugePress = () => {
        this.dispatchEvent(new CustomEvent('scale-tare', { bubbles: true, composed: true }));
    };

    #onGaugeKey = (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        this.#onGaugePress();
    };

    #onLibrary() {
        this.dispatchEvent(new CustomEvent('library-open', { bubbles: true, composed: true }));
    }

    #actionLabel(action) {
        if (action !== SLEEP_ACTION) return action;
        return isMachineAsleep(this.machineState) ? 'Wake' : SLEEP_ACTION;
    }

    #onAction(event) {
        this.dispatchEvent(new CustomEvent('header-action', {
            detail: { action: event.currentTarget.dataset.action },
            bubbles: true,
            composed: true,
        }));
    }

    #renderWarmer() {
        const t = this.#i18n.t;
        const warmer = this.warmer;
        if (warmer && warmer.present === false) return nothing;
        const on = warmer ? warmer.on : null;
        const state = on === null || on === undefined
            ? DEFAULT_DATA_GRID_DASH
            : (on ? t('On') : t('Off'));
        return html`
            <ui-button tall id="warmer"
                ?disabled=${on === null || on === undefined}
                label=${t('Cup warmer')}
                @click=${this.#onWarmer}
            ><span class="warmer"
                ><span class="warmer-name">${t('Warmer')}</span
                ><span class="warmer-state ui-microcap">${state}</span
            ></span></ui-button>`;
    }

    #onWarmer() {
        const on = this.warmer ? this.warmer.on : null;
        if (on === null || on === undefined) return;
        this.dispatchEvent(new CustomEvent('warmer-toggle', {
            detail: { enabled: !on }, bubbles: true, composed: true,
        }));
    }

    #renderMachineKeys() {
        const t = this.#i18n.t;
        const gate = machineKeyGate(this.machineState);
        return html`
            <div slot="ghc" class="ghc-strip"
                role="group"
                aria-label=${t('Machine controls')}
                data-r-tag=${this.#wiring.ghcGate().tag ?? nothing}
                data-r-adapter=${this.#wiring.ghcGate().adapter ?? nothing}
            >${gate.stop
                ? html`<ui-stop-button running></ui-stop-button>`
                : MACHINE_KEYS.map((key) => html`
                    <ui-button tall
                        data-state=${key.state}
                        data-key=${key.id}
                        ?disabled=${!gate.actions}
                        @click=${this.#onMachineKey}
                    >${t(key.label)}</ui-button>`)}
            </div>`;
    }

    /** Which one notice the layer draws, in severity order, or null for none. */
    get #noticeShowing() {
        const surface = connectionSurface(this.#wiring.bannerConnectionFrame, {
            feedStatus: this.#wiring.bannerConnectionFeedStatus ?? null,
        });
        const speaking = !surface.quiet;
        if (speaking && bannerRoleFor(surface.id) === 'alert') return 'connection';
        const refusal = this.#wiring.refusal;
        if (refusal && typeof refusal === 'object' && typeof refusal.kind === 'string') {
            return 'refusal';
        }
        const command = this.#wiring.machineCommand;
        const tare = this.#wiring.tareOutcome;
        if (command && command.alert) return 'command';
        if (tare && tare.alert) return 'tare';
        if (speaking) return 'connection';
        if (command) return 'command';
        if (tare) return 'tare';
        return null;
    }

    #renderCommand() {
        const command = this.#wiring.machineCommand;
        if (!command) return nothing;
        const t = this.#i18n.t;
        if (!command.alert) {
            return html`<p id="command-note" class="command-note" role="status"
                aria-live="polite" data-outcome=${command.outcome}
                >${command.headline}</p>`;
        }
        return html`<ui-alert-banner id="command-error"
            data-outcome=${command.outcome}
            data-kind=${command.kind ?? nothing}
            >${command.headline}<span slot="remedy" class="remedy"
                >${command.detail
                    ? html`<span id="command-detail"
                        >${command.detail}</span>`
                    : nothing
                }</span
            ><ui-button id="command-retry" slot="actions" data-state=${command.state}
                @click=${this.#onMachineKey}
            >${t('Try again')}</ui-button
            ><ui-icon-button id="command-dismiss"
                slot="actions"
                label=${t('Dismiss')}
                @click=${this.#onCommandDismiss}
            >${DISMISS_GLYPH}</ui-icon-button></ui-alert-banner>`;
    }

    #renderTare() {
        const tare = this.#wiring.tareOutcome;
        if (!tare) return nothing;
        const t = this.#i18n.t;
        if (!tare.alert) {
            return html`<p id="tare-note" class="command-note" role="status"
                aria-live="polite" data-status=${tare.status}>${tare.message}</p>`;
        }
        return html`<ui-alert-banner id="tare-error" data-status=${tare.status}
            >${tare.message}<span slot="remedy" class="remedy"
                >${tare.detail
                    ? html`<span id="tare-detail"
                        >${tare.detail}</span>`
                    : nothing
                }</span
            ><ui-button id="tare-retry" slot="actions" @click=${this.#onGaugePress}
            >${t('Try again')}</ui-button
            ><ui-icon-button id="tare-dismiss"
                slot="actions"
                label=${t('Dismiss')}
                @click=${this.#onTareDismiss}
            >${DISMISS_GLYPH}</ui-icon-button></ui-alert-banner>`;
    }

    #onCommandDismiss = () => {
        this.dispatchEvent(new CustomEvent('command-dismiss', { bubbles: true, composed: true }));
    };

    #onTareDismiss = () => {
        this.dispatchEvent(new CustomEvent('tare-dismiss', { bubbles: true, composed: true }));
    };

    #onMachineKey(event) {
        const state = event.currentTarget.dataset.state;
        if (!state) return;
        this.dispatchEvent(new CustomEvent('machine-request', {
            detail: { state }, bubbles: true, composed: true,
        }));
    }

    #onStopRequest = (event) => {
        event.stopPropagation();
        this.dispatchEvent(new CustomEvent('machine-request', {
            detail: { state: STOP_STATE, reason: 'stop' }, bubbles: true, composed: true,
        }));
    };

    render() {
        const t = this.#i18n.t;
        const showing = this.#noticeShowing;
        return html`
            <live-header part="header">
                <ui-icon-button size="lg" slot="lead" label=${t('Choose a profile')}
                    @click=${this.#onLibrary}>${LIBRARY_GLYPH}</ui-icon-button
                >

                <ui-favourites-bank
                    tall
                    plain
                    slot="favourites"
                    label=${t('Favourite profiles')}
                    .favourites=${this.favourites ?? []}
                    value=${this.favourite ?? ''}
                    hold
                    @change=${this.#onFavourite}
                    @favourite-hold=${this.#onFavouriteHold}
                ></ui-favourites-bank>

                <div slot="actions" class="actions">
                    ${this.#renderWarmer()}

                    ${ACTIONS.map((action) => html`
                        <ui-button tall
                            variant=${action === PRIMARY_ACTION ? 'primary' : 'default'}
                            @click=${this.#onAction} data-action=${action}
                            >${t(this.#actionLabel(action))}</ui-button
                        >`)}

                </div>
            </live-header>

            <live-rail part="rail" role="region" aria-label=${t('Shot settings')}>
                ${this.#rows.map((row) => this.#renderRow(row))}
            </live-rail>

            <live-main part="main">
                <ui-chart-card
                    id="live-chart"
                    slot="chart"
                    legend-gutter
                    ?activate=${!this.#steaming}
                    label=${this.#steaming ? t('Steam chart') : t('Shot chart')}
                    activate-label=${this.#steaming ? nothing : t('Open the shot charts')}
                    .channelKeys=${this.#steaming ? this.#steamSpecs : DEFAULT_CHANNELS}
                    y-policy="capped"
                    y-floor=${SHOT_Y_RANGE[1]}
                    y-cap=${SHOT_Y_CEILING}
                    temp-unit=${this.#tempUnit}
                    .yRange=${this.#steaming ? STEAM_Y_RANGE : null}
                    .y2=${this.#steaming ? this.#steamY2 : null}
                    .derivation=${this.#steaming ? this.steamDerivation : this.#bandDerivation}
                    @plot-activate=${this.#openExpanded}
                >
                <div slot="legend" class="stats-block">
                <div class="identity">
                    ${this.profileName
                        ? html`<h1 id="profile-name" class="profile-name">${this.profileName}</h1
                            >${this.#doseNote
                                ? html`<span id="profile-dose" class="profile-dose"
                                    >${this.#doseNote}</span>`
                                : nothing}`
                        : nothing}
                    <ui-status-chip tone=${this.#machineTone}
                        data-feed=${this.#wiring.machineFeedStatus ?? nothing}
                        >${this.#machineStale ? t('No reading') : t(this.#machineStatus)}</ui-status-chip
                    >
                    <span id="clock" class="clock ui-numeric">${this._clock}</span>
                </div>
                ${this.boot ? html`<div class="notice-layer" data-showing=${showing ?? nothing}>
                    <live-connection
                        id="connection"
                        class="connection-notice ${showing === 'connection' ? '' : 'hushed'}"
                        .frame=${this.#wiring.bannerConnectionFrame}
                        feed-status=${this.#wiring.bannerConnectionFeedStatus ?? nothing}
                    ></live-connection>
                    <div class="notices">
                        <live-refusal id="refusal"
                            class=${showing === 'refusal' ? '' : 'hushed'}
                            .refusal=${this.#wiring.refusal}></live-refusal>
                        <div class=${showing === 'command' ? '' : 'hushed'}>${this.#renderCommand()}</div>
                        <div class=${showing === 'tare' ? '' : 'hushed'}>${this.#renderTare()}</div>
                    </div>
                </div>` : nothing}
                <div class="gauges">
                    ${this.#gauges.map((gauge) => html`
                        <ui-stat-tile
                            label=${t(gauge.label)}
                            unit=${this.#gaugeUnit(gauge)}
                            value=${this.#reading(gauge)}
                            size=${gaugeSize(gauge)}
                            reserve="xl"
                            style=${statTileStyle(gauge)}
                            data-press=${gauge.press ?? nothing}
                            role=${gauge.press ? 'button' : nothing}
                            tabindex=${gauge.press ? '0' : nothing}
                            aria-label=${gauge.press === 'tare' ? t('Tare the scale') : nothing}
                            @click=${gauge.press ? this.#onGaugePress : nothing}
                            @keydown=${gauge.press ? this.#onGaugeKey : nothing}
                        ></ui-stat-tile>`)}
                </div>
                </div>
                    <span slot="empty">${this.#emptyMessage()}</span>
                    <span slot="foot" class="chart-summary" role="status" aria-live="polite"
                        >${this.#summary}</span
                    >
                </ui-chart-card>

                ${this.ghc ? this.#renderMachineKeys() : null}
            </live-main>

            <live-foot part="foot" role="region" aria-label=${t('Shot data')}>
                <div class="foot-grid">
                    ${this.#renderShotIdentity()}

                    <ui-data-grid
                        stacked-units
                        label=${t('Shot data by phase')}
                        row-header-label=${t('Phase')}
                        .columns=${PHASE_COLUMNS.map((column) => ({
                            ...column,
                            label: t(column.label),
                            grow: 1,
                        }))}
                        .rows=${phaseRows(this.#bandDerivation).map((row) => ({ ...row, header: t(row.header) }))}
                    ></ui-data-grid>

                    ${this.#renderDerived()}

                    <div class="foot-controls">
                        ${this.#weatherShowing
                            ? html`<ui-weather-corner
                                .reading=${this.weather}
                                @weather-open=${this.#openWeather}
                            ></ui-weather-corner>`
                            : this.shotSaving
                            ? html`<p class="rating-waiting" aria-live="polite"
                                >${t(SAVING_SHOT)}</p>`
                            : this.shotUnsaved
                            ? html`<p class="rating-unsaved" aria-live="polite"
                                >${t(UNSAVED_SHOT)}</p>`
                            : this.shotId
                            ? html`<ui-rating-control
                                shot-id=${this.shotId}
                                .score=${this.rating ?? null}
                                label=${t('Rate this shot')}
                                ?handoff=${this.dye2}
                                handoff-label=${t(DYE2_BUTTON)}
                                @notes-open=${this.#openNotes}
                                @dye-handoff=${this.#openDye2}
                            ></ui-rating-control>`
                            : nothing}
                    </div>
                </div>
            </live-foot>

            ${this.#renderKeypad()}

            <live-expanded-chart
                id="expanded"
                ?open=${this._expanded}
                temp-unit=${this.#tempUnit}
                .derivation=${this.#bandDerivation}
                .compliance=${this.compliance ?? null}
                profile-name=${this.#shotProfileName}
                @expanded-close=${() => { this._expanded = false; }}
            ></live-expanded-chart>
            <ui-steam-guard id="steam-guard" ?open=${this.steamGuard}></ui-steam-guard>
            ${this.#renderHoldMenu()}
            ${this.#renderNotes()}
            ${this.#renderWeatherModal()}
        `;
    }

    #renderNotes() {
        if (!this._notes) return nothing;
        const t = this.#i18n.t;
        const shot = this.storedShot;
        const clock = shotClock(shot ? shot.timestamp : null);
        const title = shot ? shotTitle(shot) : '';
        const dose = this.#bandDerivation && this.#bandDerivation.ok
            ? this.#bandDerivation.scalars.dose : null;
        const annotations = readShotAnnotations(shot);
        const written = typeof annotations.espressoNotes === 'string'
            ? annotations.espressoNotes
            : (shot && typeof shot.shotNotes === 'string' ? shot.shotNotes : '');
        const notes = written.trim();
        const shotId = this.#notesShotId;
        return html`<ui-dialog
            id="notes-sheet"
            heading=${t('Shot notes')}
            .open=${true}
            @open-change=${(event) => { if (event?.detail?.open === false) this.#closeNotes(); }}
        >
            <div slot="body" class="notes-sheet">
                ${shot
                    ? html`<div id="notes-identity" class="notes-identity">
                            ${clock.ok
                                ? html`<p class="shot-when">${clock.dateSummary} ${clock.time}</p>`
                                : nothing}
                            ${title ? html`<p class="shot-profile">${title}</p>` : nothing}
                            <p class="shot-charge">
                                <span>${t('In {dose} g', { dose: scalarText(dose) })}</span>
                            </p>
                        </div>`
                    : nothing}
                ${shotId
                    ? html`
                        <ui-notes-editor
                            id="notes-editor"
                            label=${t('Shot notes')}
                            placeholder=${t('Nothing is written against this shot yet.')}
                            guard-unsaved
                            guard-refusal=${this._notesSaving ? t(NOTES_SAVING_REFUSAL) : ''}
                            .value=${notes}
                            @notes-input=${this.#onNotesInput}
                        ></ui-notes-editor>`
                    : html`<ui-empty-state
                        id="notes-empty"
                        heading=${t('No notes yet')}
                        body=${t('There is no shot on the band to read notes for.')}
                    ></ui-empty-state>`}
                <p id="notes-refusal" class="notes-refusal" role="status"
                    >${this._notesError}</p>
            </div>
            <ui-button
                id="notes-close"
                slot="actions"
                @click=${() => { this.#dismissNotes('close'); }}>${t('Close')}</ui-button>
            ${shotId
                ? html`
                    <ui-button
                        id="notes-save"
                        slot="actions"
                        variant="primary"
                        ?disabled=${!this._notesDirty || this._notesSaving}
                        @click=${() => { void this.#saveNotes(shotId); }}
                    >${t('Save')}</ui-button>`
                : nothing}
        </ui-dialog>`;
    }

    #onNotesInput = (event) => {
        this._notesDirty = !!event?.detail?.dirty;
        if (this._notesError) this._notesError = '';
    };

    /** The shot the sheet is writing against, or null. */
    get #notesShotId() {
        const shot = this.storedShot;
        return shot && typeof shot.id === 'string' ? shot.id : null;
    }

    #notesSaveSeq = 0;

    async #saveNotes(shotId) {
        if (this._notesSaving) return;
        const editor = this.renderRoot?.getElementById?.('notes-editor');
        if (!editor || typeof shotId !== 'string' || shotId === '') return;
        const text = typeof editor.text === 'string' ? editor.text : '';
        const token = (this.#notesSaveSeq += 1);
        this._notesSaving = true;
        this._notesError = '';
        let answer;
        let answered = false;
        this.dispatchEvent(new CustomEvent('notes-change', {
            detail: {
                shotId,
                text,
                respond: (outcome) => { answered = true; answer = outcome; },
            },
            bubbles: true,
            composed: true,
        }));
        let accepted = true;
        if (answered) {
            try {
                const outcome = await answer;
                accepted = !(outcome && outcome.ok === false);
            } catch {
                accepted = false;
            }
        }
        if (this.#notesSaveSeq !== token) return;
        this._notesSaving = false;
        if (!this._notes || this.#notesShotId !== shotId) return;
        if (!accepted) {
            this._notesError = this.#i18n.t(NOTES_SAVE_FAILED);
            return;
        }
        const live = this.renderRoot?.getElementById?.('notes-editor');
        live?.markSaved?.(text);
        this._notesDirty = live ? !!live.dirty : false;
        this._notesError = '';
        this.#dismissNotes('saved');
    }

    /** Ask the sheet to close; it may refuse while the draft is unsaved. */
    #dismissNotes(reason) {
        const sheet = this.renderRoot?.getElementById?.('notes-sheet');
        if (!sheet || typeof sheet.requestClose !== 'function') {
            this.#closeNotes();
            return true;
        }
        return sheet.requestClose(reason);
    }

    /** True while anything on this screen is holding the keyboard. */
    get modalOpen() {
        return Boolean(
            this._typing || this._presetTyping
            || this._hold
            || this._notes || this._weatherOpen,
        );
    }

    /** The router's answer: true to leave, or `{ allow, reason }` to stay. */
    canLeaveRoute() {
        if (!this._notes) return true;
        if (this.#dismissNotes('route')) return true;
        return {
            allow: false,
            reason: this.#i18n.t(this._notesSaving ? NOTES_SAVING_REFUSAL : NOTES_UNSAVED_REFUSAL),
        };
    }

    /** Shut the sheet and forget the draft state with it. */
    #closeNotes() {
        this._notes = false;
        this._weatherOpen = false;
        this._notesDirty = false;
        this._notesSaving = false;
        this._notesError = '';
    }
}

customElements.define('live-screen', LiveScreen);
