/**
 * weather-model.js — WHAT THE WEATHER CORNER SHOWS, decided without a DOM.
 *
 * The `weather.reaplugin` plugin emits a reading on a websocket
 * (`/ws/v1/plugins/weather.reaplugin/weather`, the `pluginEndpoint` row in
 * `rea-ws-channels.js`). Everything the corner and the modal need to DECIDE is here, so
 * `node:test` can drive it: which state the widget is in, which two periods the corner
 * draws, and when a cached reading has aged out of usefulness.
 *
 * ===========================================================================
 * THE PLUGIN OWNS THE ARITHMETIC. THIS FILE OWNS THE PRESENTATION RULES.
 * ===========================================================================
 * The bucketing into parts of the day, the peak-versus-mean choice and the unit
 * conversion all happen in the plugin, where the location's own timezone is known and
 * where one implementation serves every skin. Re-deriving any of it here would be a
 * second owner of one answer — the defect this codebase spends its comments avoiding.
 *
 * What is genuinely the skin's: how old is too old, what to draw when there is nothing,
 * and how many of the plugin's forward periods each surface shows.
 *
 * DOM-free, like `chart-autoscale.js` and for the same reason.
 */

/**
 * TWO HOURS, THEN HIDE. Ben's call, 30 August 2026.
 *
 * The plugin keeps publishing its cached reading through an outage, with the reading's
 * true age attached — a widget that blanks on one lost request is worse than one that
 * says how old its number is. But a number old enough to be wrong is worse than no
 * number, and two hours is where Ben put that line: long enough to ride out a brief
 * outage, short enough that a morning reading cannot still be on screen at lunch.
 */
/**
 * THE PLUGIN'S IDENTITY, HELD HERE RATHER THAN IN THE STORE.
 *
 * It was exported from `weather-store.js`, and `live-screen.js` imported it from there to
 * name the plugin it writes a location to. That trips a screen law — `live-targets.test.mjs`
 * "no endpoint, no store, no adapter and no machine name" — and the law is right: a screen
 * that imports a store has a second route to data beside the one the wiring gives it, and
 * the next person to need a value takes the store with it.
 *
 * The id is model-level, not wire-level: it says WHICH plugin this model is about, the same
 * way MAX_AGE_MINUTES says when its reading goes stale. The store imports it from here.
 */
/**
 * TODAY'S HIGH AND LOW, or null when the plugin did not send them.
 *
 * Ben, 30 August 2026, on the space beside the corner's temperature: "its missing MIN/MAX
 * temps to the right of the temp in the weather."
 *
 * TYPE FIRST, AND THAT IS NOT PEDANTRY HERE. `Number(null)` is 0 and 0 is finite, so a
 * truthiness test would draw a missing high as a real zero degrees — the same defect this
 * module already guards for the temperature and the weather code, and the one that made a
 * missing reading look like clear sky. A pair is only a pair when BOTH numbers are real:
 * one number under a MAX label is a claim the forecast did not make.
 *
 * IT IS ALSO THE VERSION GATE. A tablet running weather.reaplugin 1.0.x sends neither
 * field, so this returns null and the corner simply draws no range — feature-absent, never
 * a dash beside a label, and never an error.
 *
 * @param {object|null} reading the plugin's last frame
 * @returns {{high: number, low: number}|null}
 */
export function rangeOf(reading) {
    if (!reading || typeof reading !== 'object') return null;
    const { high, low } = reading;
    if (typeof high !== 'number' || !Number.isFinite(high)) return null;
    if (typeof low !== 'number' || !Number.isFinite(low)) return null;
    return { high, low };
}

export const WEATHER_PLUGIN_ID = 'weather.reaplugin';
export const WEATHER_ENDPOINT = 'weather';

export const MAX_AGE_MINUTES = 120;

/** The corner draws two periods; the modal draws three. Ben's call, 30 August 2026. */
export const CORNER_PERIODS = 2;
export const MODAL_PERIODS = 3;

/**
 * The states the corner can be in. `PROMPT` is the one that is easy to get wrong — see
 * `weatherState` for why it is not the same as `HIDDEN`.
 */
export const WEATHER_STATE = Object.freeze({
    READING: 'reading',
    PROMPT: 'prompt',
    HIDDEN: 'hidden',
});

/**
 * WHICH OF THE THREE STATES THE CORNER IS IN.
 *
 * `PROMPT` AND `HIDDEN` ARE NOT THE SAME STATE, and conflating them is a deadlock.
 * Ben asked for the widget to hide when there is no reading. That is right for a
 * transient failure and wrong for a machine that has never been given a location:
 * the location picker lives inside the modal, the modal opens by PRESSING the widget,
 * and a hidden widget cannot be pressed. So a machine with no location set says so once,
 * and only ever hides after it has worked at least once.
 *
 * Everything else hides. A plugin that is not installed resolves to no reading at all
 * (`rea-ws-channels.js`: "a missing plugin degrades to feature-absent, never to an error
 * banner"), and a stale one is treated as absent rather than shown with a caveat — the
 * corner has no room for a caveat and a person reading a number does not read footnotes.
 *
 * @param {object|null} reading  the plugin's last payload, or null if none has arrived
 * @param {{maxAgeMinutes?: number}} opts
 */
export function weatherState(reading, { maxAgeMinutes = MAX_AGE_MINUTES } = {}) {
    if (!reading || typeof reading !== 'object') return WEATHER_STATE.HIDDEN;
    if (reading.ok !== true) {
        return reading.reason === 'no_location' ? WEATHER_STATE.PROMPT : WEATHER_STATE.HIDDEN;
    }
    /* `Number(null)` IS 0, WHICH IS FINITE — so a coercing check reads a missing
     * temperature as a real zero and draws "0 °C". Test the type first, every time a
     * value here may legitimately be absent. */
    if (typeof reading.temperature !== 'number' || !Number.isFinite(reading.temperature)) {
        return WEATHER_STATE.HIDDEN;
    }
    const age = reading.ageMinutes;
    if (typeof age === 'number' && Number.isFinite(age) && age > maxAgeMinutes) {
        return WEATHER_STATE.HIDDEN;
    }
    return WEATHER_STATE.READING;
}

/**
 * THE ROLLING WINDOW: the running period first, then the next.
 *
 * Ben's call, 30 August 2026: "a rolling window with current on the left and next on the
 * right." The plugin already emits its periods forward-only with the running one first,
 * so this takes rather than sorts — the ORDER IS THE PLUGIN'S and re-deriving it here
 * from clock arithmetic would be a second owner of the one question that has to agree
 * across midnight.
 *
 * `count` is what separates the two surfaces: the corner's two cells, the modal's three.
 */
export function windowOf(reading, count = CORNER_PERIODS) {
    const periods = reading && Array.isArray(reading.periods) ? reading.periods : [];
    return periods.slice(0, Math.max(0, count));
}

/**
 * WHICH HALF OF THE STRIP GETS THE COLOUR — the wetter one, and only if it is worth
 * pointing at.
 *
 * Colouring both says nothing, and colouring the first says only "this one is first".
 * The corner exists to answer "do I need to worry about this afternoon" without being
 * read, so exactly one cell carries the channel ink, and none does when neither half is
 * likely enough to act on.
 */
export const WET_THRESHOLD = 30;

export function wetIndex(periods, { threshold = WET_THRESHOLD } = {}) {
    if (!Array.isArray(periods) || !periods.length) return -1;
    let best = -1;
    let peak = -1;
    for (let i = 0; i < periods.length; i += 1) {
        const p = periods[i] && periods[i].probability;
        if (typeof p !== 'number' || !Number.isFinite(p) || p < threshold) continue;
        if (p > peak) { peak = p; best = i; }
    }
    return best;
}

/**
 * The temperature unit the reading is in. The plugin states which set it used, and the
 * skin follows rather than converting: one converter, in the plugin, where the source
 * numbers are.
 */
export function unitsOf(reading) {
    return reading && reading.units === 'imperial'
        ? Object.freeze({ temperature: '°F', rain: 'in', wind: 'mph' })
        : Object.freeze({ temperature: '°C', rain: 'mm', wind: 'km/h' });
}

/**
 * WMO WEATHER CODES TO THE MARKS THIS SKIN DRAWS.
 *
 * Open-Meteo answers with a WMO code (0-99). About a dozen marks cover all of them once
 * grouped, and the grouping is the skin's: a person at a machine does not need "slight"
 * separated from "moderate" drizzle, but does need drizzle separated from rain.
 *
 * `day` and `night` differ only where the sky itself is the subject — clear and partly
 * cloudy. Overcast looks the same at midnight as at noon.
 */
const CODE_GROUPS = Object.freeze([
    Object.freeze({ upTo: 0, day: 'clear', night: 'clearNight' }),
    Object.freeze({ upTo: 2, day: 'partly', night: 'partlyNight' }),
    Object.freeze({ upTo: 3, day: 'overcast', night: 'overcast' }),
    Object.freeze({ upTo: 48, day: 'fog', night: 'fog' }),
    Object.freeze({ upTo: 57, day: 'drizzle', night: 'drizzle' }),
    Object.freeze({ upTo: 67, day: 'rain', night: 'rain' }),
    Object.freeze({ upTo: 77, day: 'snow', night: 'snow' }),
    Object.freeze({ upTo: 82, day: 'rain', night: 'rain' }),
    Object.freeze({ upTo: 86, day: 'snow', night: 'snow' }),
    Object.freeze({ upTo: 99, day: 'thunder', night: 'thunder' }),
]);

/** The mark for a reading, or `overcast` for a code the table does not cover. */
export function markFor(code, isDay = true) {
    /* Type first: `Number(null)` is 0, and 0 is the code for CLEAR SKY — so a coercing
     * check turns "the plugin sent no code" into "it is a beautiful day". */
    if (typeof code !== 'number' || !Number.isFinite(code)) return 'overcast';
    const n = code;
    for (const group of CODE_GROUPS) {
        if (n <= group.upTo) return isDay ? group.day : group.night;
    }
    return 'overcast';
}

/**
 * The condition in words, for the modal. The corner has the mark and no room for these.
 * English keys, because the i18n key IS its own English text in this codebase.
 */
const CONDITION_WORDS = Object.freeze({
    clear: 'Clear',
    clearNight: 'Clear',
    partly: 'Partly cloudy',
    partlyNight: 'Partly cloudy',
    overcast: 'Overcast',
    fog: 'Fog',
    drizzle: 'Drizzle',
    rain: 'Rain',
    snow: 'Snow',
    thunder: 'Thunderstorm',
});

export function conditionWord(code, isDay = true) {
    return CONDITION_WORDS[markFor(code, isDay)] || 'Overcast';
}

/**
 * How a period's hours read in the modal — the corner shows only the label.
 * 24-hour clock, because that is what the rest of this skin shows.
 */
export function hoursOf(period) {
    if (!period) return '';
    const pad = (h) => `${String(Number(h) % 24).padStart(2, '0')}:00`;
    return `${pad(period.fromHour)} – ${pad(period.toHour)}`;
}
