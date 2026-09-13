/**
 * The ±5 s alignment between two shots.
 */

export const ALIGNMENT_OFFSET_LIMIT_S = 5;

export const ALIGNMENT_OFFSET_STEP_S = 0.1;

/**
 * The two slots of a comparison. A is the reference and never moves; B is the shot the
 * offset slides (`history-viewer.js:242-244`, and the test that pins it: "the alignment
 * slides B against A, not both").
 */
export const ALIGNMENT_SLOT = Object.freeze({ REFERENCE: 'a', MOVING: 'b' });

export function clampAlignmentOffset(seconds) {
    const value = Number(seconds);
    if (!Number.isFinite(value)) return 0;
    if (value > ALIGNMENT_OFFSET_LIMIT_S) return ALIGNMENT_OFFSET_LIMIT_S;
    if (value < -ALIGNMENT_OFFSET_LIMIT_S) return -ALIGNMENT_OFFSET_LIMIT_S;
    return value === 0 ? 0 : value;   // normalises -0, which prints as "-0.0 s"
}

export function alignedInstant(t, offset) {
    return t + clampAlignmentOffset(offset);
}

export function alignmentOffsetAfterSlotChange(offset, slot) {
    return slot === ALIGNMENT_SLOT.MOVING ? 0 : clampAlignmentOffset(offset);
}

export function formatAlignmentOffset(seconds) {
    const clamped = clampAlignmentOffset(seconds);
    const fixed = clamped.toFixed(1);
    if (Number(fixed) === 0) return '0.0 s';
    return `${clamped > 0 ? '+' : ''}${fixed} s`;
}

export function alignmentControlState({ offset = 0, hasComparison = false, hasTimeAxis = true } = {}) {
    const compare = Boolean(hasComparison);
    return Object.freeze({
        available: Boolean(hasTimeAxis),
        sliderDisabled: !compare,
        resetDisabled: !compare || clampAlignmentOffset(offset) === 0,
    });
}


/** Strict typed entry: invalid or out-of-range text never moves either shot. */
export function parseAlignmentOffset(text) {
    if (typeof text !== 'string' || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text.trim())) return null;
    const value = Number(text.trim());
    if (!Number.isFinite(value) || Math.abs(value) > ALIGNMENT_OFFSET_LIMIT_S) return null;
    const rounded = Math.round(value / ALIGNMENT_OFFSET_STEP_S) * ALIGNMENT_OFFSET_STEP_S;
    return Number(rounded.toFixed(1)) || 0;
}
