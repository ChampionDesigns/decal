// THE GAP CONTRACT — the two meanings of null, as a test the port's resampler must pass.
//
// Wave 5.6, item `hist-shot-list-derivation`. This file states a POLICY and provides the
// instrument that checks it. It deliberately contains NO RESAMPLER: the History port owns
// that function, and a contract that shipped its own implementation would be a contract
// checking itself.
//
// ============================================================================
// WHY THIS EXISTS AT ALL
// ============================================================================
//
// Putting two recorded shots on one time axis means asking every channel for a value at
// an instant it may not have spoken about. There are two completely different reasons a
// channel has no number at an instant, and a resampler that conflates them draws a
// plausible chart of a shot that did not happen:
//
//   * UNSPOKEN — the channel simply did not sample at that instant. The quantity still
//     existed; the reading is missing, not the value. Between two real readings this is
//     interpolated, because pressure did not cease to exist between two 10 Hz frames.
//
//   * GATED — the channel SPOKE, and what it said was null. The derived channels do this
//     while their gate is shut, and a stored shot's optional channels do it too. There is
//     no value at that instant. It must render as a BREAK.
//
// `src/lib/chart-align.js` `bridgeUnspoken` already implements exactly this policy for the
// live/union path, and `uplot-plot.js` sets `spanGaps: false` so a surviving null draws as
// a break. The contract below is that same policy, written as CASES rather than as code,
// so the History port's resampler can be held to it without either file importing the
// other.
//
// ============================================================================
// THE DEFECT IT IS AIMED AT, READ AT THE SOURCE
// ============================================================================
//
// The old History viewer's `resampleOnto` (Slate `history-viewer.js`) holds the last value
// across a gap. Reading its loop: when the NEXT source sample carries a non-number it
// writes `out[k] = y0` — the previous reading — rather than leaving the slot empty. Two
// consequences, and the second is the one nobody notices:
//
//   1. a gated instant inherits the value from before the gate, so the line runs flat
//      through a stretch where the channel had nothing to say;
//   2. the FIRST REAL READING AFTER a gate is dropped, because by then the walk's left
//      edge sits on the null and the "y0 is not a number" branch skips the slot entirely.
//
// So the same defect both invents data and loses it. Case `never-bridge-a-gated-null`
// below pins both halves on one source, which is why its expectation reads asymmetric.
//
// ============================================================================
// THE POLICY, IN THREE SENTENCES
// ============================================================================
//
//   1. A slot the channel did not sample, lying STRICTLY BETWEEN two real readings, is
//      linearly interpolated from those two readings.
//   2. A slot the channel spoke as null is a break, and it never bridges: neither across
//      it, nor from it, nor into it. The reading either side of a gate starts a new run.
//   3. Before a channel's first sample and after its last there is nothing to interpolate
//      from, so those slots stay null. The line is absent rather than invented.
//
// DOM-free, dependency-free, `node:test` imports it directly.

/** Why a slot has no number. The whole point is that these are not the same thing. */
export const GAP_MEANING = Object.freeze({
    /** The channel spoke, and said null. A break. */
    GATED: 'gated',
    /** The channel did not sample here. Bridged, but only between two real readings. */
    UNSPOKEN: 'unspoken',
    /** Outside the channel's own span. Nothing to interpolate from. */
    OUTSIDE: 'outside',
});

export const GAP_TOLERANCE = 1e-9;

export const GAP_CONTRACT = Object.freeze([
    Object.freeze({
        id: 'bridge-unspoken-interior',
        meaning: GAP_MEANING.UNSPOKEN,
        claim: 'a slot the channel did not sample, strictly between two real readings, is linearly interpolated',
        why: 'pressure did not cease to exist between two frames. Leaving it null puts a vertical '
            + 'cut through every channel at every other channel\'s timestamps — the failure that '
            + 'showed on every replayed shot at once and never showed live.',
        axis: Object.freeze([0, 1, 2]),
        source: Object.freeze({ x: Object.freeze([0, 2]), y: Object.freeze([10, 30]) }),
        expect: Object.freeze([10, 20, 30]),
    }),
    Object.freeze({
        id: 'never-bridge-a-gated-null',
        meaning: GAP_MEANING.GATED,
        claim: 'a null the channel SPOKE is a break, and the real reading after it survives',
        why: 'THE PORTED DEFECT. Holding the last value across a gate draws a flat line through '
            + 'an instant the channel had nothing to say about, AND drops the first real reading '
            + 'after the gate. Both halves are on this one source.',
        axis: Object.freeze([0, 1, 2, 3]),
        source: Object.freeze({ x: Object.freeze([0, 1, 2, 3]), y: Object.freeze([10, null, null, 40]) }),
        expect: Object.freeze([10, null, null, 40]),
    }),
    Object.freeze({
        id: 'gate-at-the-trailing-edge',
        meaning: GAP_MEANING.GATED,
        claim: 'a gate as the channel\'s last word is still a break, not a hold',
        why: 'the hold-the-last-value branch is reached from the right edge as well as from the '
            + 'middle, and a shot that ends with its scale gated would otherwise report a final '
            + 'weight it never measured.',
        axis: Object.freeze([0, 1, 2]),
        source: Object.freeze({ x: Object.freeze([0, 1, 2]), y: Object.freeze([10, 20, null]) }),
        expect: Object.freeze([10, 20, null]),
    }),
    Object.freeze({
        id: 'no-bridge-before-the-first-sample',
        meaning: GAP_MEANING.OUTSIDE,
        claim: 'slots before the channel\'s first reading stay null',
        why: 'there is nothing to interpolate FROM. A channel that starts late must look late, '
            + 'not look like it started at its first value.',
        axis: Object.freeze([0, 1, 2]),
        source: Object.freeze({ x: Object.freeze([1, 2]), y: Object.freeze([10, 20]) }),
        expect: Object.freeze([null, 10, 20]),
    }),
    Object.freeze({
        id: 'no-bridge-after-the-last-sample',
        meaning: GAP_MEANING.OUTSIDE,
        claim: 'slots after the channel\'s last reading stay null',
        why: 'the same rule from the other end, and the one that matters when the two shots on '
            + 'the chart are different lengths — which, with a +/-5 s alignment slide, is every '
            + 'comparison.',
        axis: Object.freeze([0, 1, 2]),
        source: Object.freeze({ x: Object.freeze([0, 1]), y: Object.freeze([10, 20]) }),
        expect: Object.freeze([10, 20, null]),
    }),
    Object.freeze({
        id: 'a-gate-bounds-the-bridge-on-both-sides',
        meaning: GAP_MEANING.GATED,
        claim: 'an off-grid slot beside a gate is not bridged; one between two real readings is',
        why: 'the sharpest form of the rule, and the one an implementation gets wrong last: '
            + '"strictly between two REAL readings" is not "strictly between two SPOKEN slots". '
            + 'The axis here is denser than the channel, which is exactly what aligning two '
            + 'differently-sampled shots produces.',
        axis: Object.freeze([0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4]),
        source: Object.freeze({
            x: Object.freeze([0, 1, 2, 3, 4]),
            y: Object.freeze([10, 20, null, 40, 50]),
        }),
        expect: Object.freeze([10, 15, 20, null, null, null, 40, 45, 50]),
    }),
]);

export const GAP_DISTINCTION = Object.freeze({
    id: 'the-two-meanings-are-distinguishable',
    claim: 'unspoken and gated at the same instant produce different columns',
    why: 'the whole policy collapses if one column can stand for both. `bridgeUnspoken` is '
        + 'exported for a test of exactly this shape for the same reason.',
    axis: Object.freeze([0, 1, 2]),
    unspoken: Object.freeze({ x: Object.freeze([0, 2]), y: Object.freeze([10, 30]) }),
    gated: Object.freeze({ x: Object.freeze([0, 1, 2]), y: Object.freeze([10, null, 30]) }),
});

/* ─────────────────────────────────────────────────────────────────── the instrument */

const isBreak = (value) => value === null;
const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);

/**
 * One column against one expectation.
 *
 * @returns {{ok: boolean, detail: string|null}}
 */
export function compareColumn(actual, expect, { tolerance = GAP_TOLERANCE } = {}) {
    if (!Array.isArray(actual)) {
        return { ok: false, detail: `the resampler returned ${typeof actual}, not an array` };
    }
    if (actual.length !== expect.length) {
        return { ok: false, detail: `returned ${actual.length} slots for a ${expect.length}-slot axis` };
    }
    for (let i = 0; i < expect.length; i += 1) {
        const want = expect[i];
        const got = actual[i];
        if (want === null) {
            /* A break is the ABSENCE of a number. `undefined` is not a break — uPlot's
             * spanGaps reads null — and 0 is a measurement, which is the same
             * presence-not-truthiness rule the dash follows. */
            if (!isBreak(got)) {
                return { ok: false, detail: `slot ${i}: expected a break (null), got ${JSON.stringify(got)}` };
            }
            continue;
        }
        if (!isNumber(got)) {
            return { ok: false, detail: `slot ${i}: expected ${want}, got ${JSON.stringify(got)}` };
        }
        if (Math.abs(got - want) > tolerance) {
            return { ok: false, detail: `slot ${i}: expected ${want}, got ${got}` };
        }
    }
    return { ok: true, detail: null };
}

const report = (results) => Object.freeze({
    ok: results.every((r) => r.ok),
    cases: Object.freeze(results.map((r) => Object.freeze(r))),
    failed: Object.freeze(results.filter((r) => !r.ok).map((r) => r.id)),
});

export function checkResampler(resample, { tolerance = GAP_TOLERANCE } = {}) {
    if (typeof resample !== 'function') {
        throw new TypeError('checkResampler: a resample(axis, srcX, srcY) function is required');
    }
    const run = (axis, source) => resample([...axis], [...source.x], [...source.y]);
    const results = GAP_CONTRACT.map((testCase) => {
        let actual;
        try {
            actual = run(testCase.axis, testCase.source);
        } catch (cause) {
            return { id: testCase.id, ok: false, claim: testCase.claim, detail: `threw: ${cause && cause.message}` };
        }
        const verdict = compareColumn(actual, testCase.expect, { tolerance });
        return { id: testCase.id, ok: verdict.ok, claim: testCase.claim, detail: verdict.detail };
    });

    let distinction;
    try {
        const a = run(GAP_DISTINCTION.axis, GAP_DISTINCTION.unspoken);
        const b = run(GAP_DISTINCTION.axis, GAP_DISTINCTION.gated);
        const same = Array.isArray(a) && Array.isArray(b)
            && a.length === b.length
            && a.every((value, i) => value === b[i]);
        distinction = {
            id: GAP_DISTINCTION.id,
            ok: !same,
            claim: GAP_DISTINCTION.claim,
            detail: same ? `both meanings produced ${JSON.stringify(a)}` : null,
        };
    } catch (cause) {
        distinction = {
            id: GAP_DISTINCTION.id, ok: false, claim: GAP_DISTINCTION.claim,
            detail: `threw: ${cause && cause.message}`,
        };
    }
    return report([...results, distinction]);
}

export function checkChannelAligner(align, { tolerance = GAP_TOLERANCE } = {}) {
    if (typeof align !== 'function') {
        throw new TypeError('checkChannelAligner: an align(channels, keys) function is required');
    }
    const run = (axis, source) => {
        const channels = {
            carrier: { x: [...axis], y: axis.map((_, i) => i) },
            probe: { x: [...source.x], y: [...source.y] },
        };
        const columns = align(channels, ['carrier', 'probe']);
        return Array.isArray(columns) ? columns[2] : columns;
    };
    const results = GAP_CONTRACT.map((testCase) => {
        let actual;
        try {
            actual = run(testCase.axis, testCase.source);
        } catch (cause) {
            return { id: testCase.id, ok: false, claim: testCase.claim, detail: `threw: ${cause && cause.message}` };
        }
        const verdict = compareColumn(actual, testCase.expect, { tolerance });
        return { id: testCase.id, ok: verdict.ok, claim: testCase.claim, detail: verdict.detail };
    });

    let distinction;
    try {
        const a = run(GAP_DISTINCTION.axis, GAP_DISTINCTION.unspoken);
        const b = run(GAP_DISTINCTION.axis, GAP_DISTINCTION.gated);
        const same = Array.isArray(a) && Array.isArray(b)
            && a.length === b.length && a.every((value, i) => value === b[i]);
        distinction = {
            id: GAP_DISTINCTION.id, ok: !same, claim: GAP_DISTINCTION.claim,
            detail: same ? `both meanings produced ${JSON.stringify(a)}` : null,
        };
    } catch (cause) {
        distinction = {
            id: GAP_DISTINCTION.id, ok: false, claim: GAP_DISTINCTION.claim,
            detail: `threw: ${cause && cause.message}`,
        };
    }
    return report([...results, distinction]);
}

/** Every claim, one line each — for a digest, a review, or a failure message. */
export function gapContractClaims() {
    return Object.freeze([
        ...GAP_CONTRACT.map((c) => `${c.id} (${c.meaning}): ${c.claim}`),
        `${GAP_DISTINCTION.id}: ${GAP_DISTINCTION.claim}`,
    ]);
}
