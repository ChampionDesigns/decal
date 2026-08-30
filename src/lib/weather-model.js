/**
 * The weather corner's model: which state it is in, when a reading goes stale, and what each surface shows.
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

export function windowOf(reading, count = CORNER_PERIODS) {
    const periods = reading && Array.isArray(reading.periods) ? reading.periods : [];
    return periods.slice(0, Math.max(0, count));
}

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

export function unitsOf(reading) {
    return reading && reading.units === 'imperial'
        ? Object.freeze({ temperature: '°F', rain: 'in', wind: 'mph' })
        : Object.freeze({ temperature: '°C', rain: 'mm', wind: 'km/h' });
}

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
