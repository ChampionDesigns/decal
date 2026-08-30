// Readings: a value that is present, or an absence with a reason.
//
// This is the substrate under the address layer, and it exists because of one rule
// (SCOPE Part 6, "Two contract facts" and "The rule that follows"):
//
//   * KEY PRESENCE IS THE VALIDITY SIGNAL. `MachineSnapshot.toJson` OMITS a derived
//     channel rather than nulling it, and its own comment says consumers can rely on
//     that. So `Object.hasOwn(data, 'puckResistanceDerived')` is the whole test. The gate
//     that decides it lives in ReaPrime. NEVER re-implement it, never copy its constants —
//     a second copy of a threshold is a second thing to drift.
//
//   * A7: NEVER PORT A FALLBACK PATH. A missing channel renders as a gap or a dash, never
//     as a locally-recomputed ratio, a delta-plus-EMA flow, or a zero that reads as a
//     measurement. Those three are exactly how seven renames hid for months on a live
//     bench: every one of them produced a plausible number.
//
// Hence: absence is a VALUE here, carrying a REASON, and it is not a number. It cannot be
// added, averaged or plotted by accident — `Number(NO_READING)` is NaN and arithmetic on
// it is loud rather than plausible. Turning one into something a renderer can draw is a
// deliberate call to `toPlot`, which yields `null` — uPlot's gap.
//
// `Object.hasOwn` rather than the `in` operator: identical for a JSON.parse result (no
// prototype chain of its own) and immune to a polluted `Object.prototype`, which `in`
// is not. The spec's `'key' in data` is the same test stated informally.

/** Why a reading is absent. Ordered from "the server is fine" to "this can never arrive". */
export const ABSENCE = Object.freeze({
    /** The key is not on the frame. For a gated channel this is the NORMAL case. */
    ABSENT: 'absent',
    /** The key is present and null. The scale writes its optional fields this way. */
    NULL: 'null',
    /** The key is present but not a finite number — a malformed frame, worth logging. */
    NON_FINITE: 'nonFinite',
    /** The container itself is missing: `scale: null`, or no sensor frame yet. */
    NO_SOURCE: 'noSource',
    /**
     * Stored shots only: the channel is unavailable FOR THIS SHOT, FOREVER. A recorded
     * measurement with no `sensors` key was written before ReaPrime 2b047d02, and
     * `MachineSnapshot.fromJson` reads a fixed key list with no unknown-key bag, so any
     * estimator data in that row was dropped the first time ReaPrime read it. Nothing will
     * ever supply it. Render a gap; never fall through to the derived channel and present
     * it as the same measurement.
     */
    PERMANENT: 'permanent',
    /** The transport answered with an error envelope. A signal, not a frame. */
    ERROR: 'error',
});

const ABSENCE_REASONS = Object.freeze(Object.values(ABSENCE));

/**
 * One frozen instance per reason — readings are compared by identity in hot paths.
 *
 * `valueOf` returning NaN is deliberate: it makes arithmetic on an absence produce NaN
 * rather than a coerced string or a zero, so a consumer that forgets to check gets a loud
 * NaN instead of a plausible number. It is not serialised (JSON.stringify skips functions).
 */
const NO_READINGS = Object.freeze(Object.fromEntries(
    ABSENCE_REASONS.map((reason) => [
        reason,
        Object.freeze({ noReading: true, reason, valueOf: () => NaN }),
    ]),
));

/** The default absence. `noReading(reason)` when the reason is known. */
export const NO_READING = NO_READINGS[ABSENCE.ABSENT];

/**
 * @param {string} reason  one of ABSENCE
 * @returns {{noReading: true, reason: string}}
 */
export function noReading(reason = ABSENCE.ABSENT) {
    const known = NO_READINGS[reason];
    if (!known) throw new Error(`reading: unknown absence reason "${reason}"`);
    return known;
}

/** @returns {boolean} true for any absence. */
export function isNoReading(value) {
    return typeof value === 'object' && value !== null && value.noReading === true;
}

/** @returns {boolean} true for a real measurement (always a finite number here). */
export function hasReading(value) {
    return typeof value === 'number' && Number.isFinite(value);
}

/**
 * The renderer adapter, and the ONLY sanctioned way a reading becomes plottable.
 * An absence becomes `null` — a gap in a uPlot series, not a zero.
 */
export function toPlot(value) {
    return hasReading(value) ? value : null;
}

/**
 * The presentation adapter for a scalar field. An absence becomes the NO_READING dash,
 * which is a caller-supplied string so this module stays i18n-free.
 */
export function toText(value, format, dash = '—') {
    return hasReading(value) ? format(value) : dash;
}

/**
 * Key-presence validity, stated once.
 *
 * @param {object|null|undefined} source
 * @param {string} key
 * @returns {boolean} whether the server WROTE this key on this frame
 */
export function hasKey(source, key) {
    return !!source && typeof source === 'object' && Object.hasOwn(source, key);
}

/**
 * Read one numeric channel by key presence.
 *
 * This is the whole gated-channel rule: written -> valid, omitted -> absent. No threshold
 * appears in this file, or anywhere else in the skin.
 *
 * @param {object|null|undefined} source
 * @param {string} key
 * @param {string} [missingReason]  the absence to report when `source` itself is missing
 * @returns {number|{noReading: true, reason: string}}
 */
export function readNumber(source, key, missingReason = ABSENCE.NO_SOURCE) {
    if (!source || typeof source !== 'object') return noReading(missingReason);
    if (!Object.hasOwn(source, key)) return noReading(ABSENCE.ABSENT);
    const value = source[key];
    if (value === null || value === undefined) return noReading(ABSENCE.NULL);
    if (typeof value !== 'number' || !Number.isFinite(value)) return noReading(ABSENCE.NON_FINITE);
    return value;
}

/**
 * Read a non-numeric channel (a timestamp string, a state name) with the same
 * presence rules. Returns the value verbatim when present, an absence otherwise.
 */
export function readValue(source, key, missingReason = ABSENCE.NO_SOURCE) {
    if (!source || typeof source !== 'object') return noReading(missingReason);
    if (!Object.hasOwn(source, key)) return noReading(ABSENCE.ABSENT);
    const value = source[key];
    if (value === null || value === undefined) return noReading(ABSENCE.NULL);
    return value;
}

/**
 * Read a whole channel set as permanently absent — the stored-shot rule, applied once at
 * the top instead of at every consumer.
 *
 * @param {readonly string[]} keys
 * @param {string} reason
 */
export function allAbsent(keys, reason = ABSENCE.PERMANENT) {
    const absent = noReading(reason);
    return Object.freeze(Object.fromEntries(keys.map((key) => [key, absent])));
}

/**
 * Read a whole channel set from one frame, by key presence.
 *
 * @param {object|null|undefined} frame
 * @param {readonly string[]} keys
 * @param {object} [options]
 * @param {string} [options.missingReason]        absence when the frame is missing
 * @param {readonly string[]} [options.textKeys]  keys read verbatim rather than as numbers
 */
export function readChannels(frame, keys, { missingReason = ABSENCE.NO_SOURCE, textKeys = [] } = {}) {
    const text = new Set(textKeys);
    return Object.freeze(Object.fromEntries(keys.map((key) => [
        key,
        text.has(key) ? readValue(frame, key, missingReason) : readNumber(frame, key, missingReason),
    ])));
}

/**
 * Which of `keys` actually carry a measurement. The channel-availability question every
 * chart asks, answered from presence rather than from a machine model or a feature byte.
 */
export function presentChannels(readings, keys = Object.keys(readings || {})) {
    return keys.filter((key) => hasReading(readings && readings[key]));
}
