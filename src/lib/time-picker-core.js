/**
 * Pure time-of-day helpers for the clock-face time picker.
 */

function clampInt(v, lo, hi) {
    v = Math.round(Number(v));
    if (!Number.isFinite(v)) return lo;
    return Math.max(lo, Math.min(hi, v));
}

export function parseTime24(str, fallback = { h24: 7, m: 0 }) {
    if (typeof str !== 'string') return { ...fallback };
    const match = str.match(/^\s*(\d{1,2}):(\d{2})\s*$/);
    if (!match) return { ...fallback };
    const h24 = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    if (h24 < 0 || h24 > 23 || m < 0 || m > 59) return { ...fallback };
    return { h24, m };
}

export function formatTime24(h24, m) {
    const hh = String(clampInt(h24, 0, 23)).padStart(2, '0');
    const mm = String(clampInt(m, 0, 59)).padStart(2, '0');
    return `${hh}:${mm}`;
}

// 24-hour hour -> 12-hour clock form. 0 -> 12 AM, 12 -> 12 PM, 13 -> 1 PM.
export function to12h(h24) {
    h24 = clampInt(h24, 0, 23);
    const ampm = h24 < 12 ? 'AM' : 'PM';
    let h12 = h24 % 12;
    if (h12 === 0) h12 = 12;
    return { h12, ampm };
}

// 12-hour clock form -> 24-hour hour. Inverse of to12h.
export function to24h(h12, ampm) {
    h12 = clampInt(h12, 1, 12);
    const pm = String(ampm).toUpperCase() === 'PM';
    if (h12 === 12) return pm ? 12 : 0;
    return pm ? h12 + 12 : h12;
}

export function snapMinute(m, step = 5) {
    m = clampInt(m, 0, 59);
    return (Math.round(m / step) * step) % 60;
}

export function hourHandAngle(h12) {
    return (clampInt(h12, 1, 12) % 12) * 30 - 90;
}
export function minuteHandAngle(m) {
    return clampInt(m, 0, 59) * 6 - 90;
}
