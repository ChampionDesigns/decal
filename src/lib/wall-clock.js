/**
 * The time of day, spelled ONE way for the whole skin.
 */

import { defaultFor } from './settings-defaults.js';

export const CLOCK_TICK_MS = 1000;

export const CLOCK_FORMAT = Object.freeze({ H24: '24h', H12: '12h' });

export const DEFAULT_CLOCK_FORMAT = defaultFor('clockFormat');

export function normaliseClockFormat(value) {
    return value === CLOCK_FORMAT.H12 || value === CLOCK_FORMAT.H24
        ? value
        : DEFAULT_CLOCK_FORMAT;
}

export function wallClock(date, language, format) {
    const twelve = format === CLOCK_FORMAT.H12;
    return new Intl.DateTimeFormat(language || undefined, twelve
        ? { hour: 'numeric', minute: '2-digit', hour12: true }
        : { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
}

export function clockTime(h24, minute, format, language) {
    if (!Number.isInteger(h24) || !Number.isInteger(minute)) return '—';
    if (h24 < 0 || h24 > 23 || minute < 0 || minute > 59) return '—';
    return wallClock(new Date(2000, 0, 1, h24, minute, 0, 0), language, format);
}

/** The same, from minutes since midnight (0-1439) — what ReaPrime stores a night time as. */
export function clockTimeFromMinutes(minutes, format, language) {
    if (!Number.isInteger(minutes) || minutes < 0 || minutes > 1439) return '—';
    return clockTime(Math.floor(minutes / 60), minutes % 60, format, language);
}
