/**
 * When.
 */

/**
 * 5 Hz. Slow enough that the digits stop churning, fast enough that no number looks stuck.
 * The machine's own frame rate is far higher and the chart still draws all of it.
 */
export const READINGS_MIN_MS = 200;

export const READING_KEYS = Object.freeze([
    'pressure', 'flow', 'weight', 'group', 'steam', 'tank', 'milk',
]);

export function presenceOf(readings) {
    if (!readings || typeof readings !== 'object') return '';
    return READING_KEYS.map((key) => (readings[key] === null || readings[key] === undefined ? '-' : '#')).join('');
}

export function readingsDue(last, now, minMs = READINGS_MIN_MS) {
    if (!last) return true;
    if (now.presence !== last.presence) return true;
    if (now.state !== last.state) return true;
    return now.at - last.at >= minMs;
}
