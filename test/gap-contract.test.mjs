/**
 * gap-contract.test.mjs — wave 5.6, item `hist-shot-list-derivation`.
 *
 * THE CONTRACT THE HISTORY PORT'S RESAMPLER MUST PASS, exercised BOTH WAYS:
 *
 *   * POSITIVE — the shipped gap policy (`alignChannels`, whose `bridgeUnspoken` carries the
 *     two-meanings-of-null comment) satisfies every case. A contract nothing can satisfy is
 *     a specification of an impossible function, and this is how we know it is not one.
 *
 *   * NEGATIVE — the defect it exists to prevent fails it, on the exact cases it should and
 *     not on the others. A contract nothing can fail is not a contract. The defective
 *     function is transcribed INTO THIS TEST, as a canary, in the shape the old History
 *     viewer's `resampleOnto` has: it is the thing the port must not be, so it lives here
 *     and not under src/.
 *
 * A8: nothing here reads a `.js` file or asserts on its text. Every claim is made by
 * EXECUTING a function and comparing the column that comes out.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
    GAP_CONTRACT,
    GAP_DISTINCTION,
    GAP_MEANING,
    GAP_TOLERANCE,
    checkResampler,
    checkChannelAligner,
    compareColumn,
    gapContractClaims,
} from '../src/lib/gap-contract.js';
import { alignChannels, bridgeUnspoken } from '../src/lib/chart-align.js';

/**
 * THE DEFECT, TRANSCRIBED — the canary, and the only resampler in this repository.
 *
 * The old History viewer's `resampleOnto`, in its own shape. Its fault is one branch: when
 * the next source sample carries a non-number it writes the PREVIOUS reading into the slot
 * rather than leaving it empty, so a gated instant inherits a value the channel never gave —
 * and the walk's left edge then sits on the null, so the first real reading after the gate is
 * skipped as well. It invents data and loses data with the same line.
 *
 * It is here so the contract can be shown to bite. Nothing imports it.
 */
function holdLastValueAcrossGaps(axis, srcX, srcY) {
    const out = new Array(axis.length).fill(null);
    if (!srcX.length) return out;
    const first = srcX[0];
    const last = srcX[srcX.length - 1];
    let i = 0;
    for (let k = 0; k < axis.length; k += 1) {
        const x = axis[k];
        if (x < first || x > last) continue;
        while (i < srcX.length - 2 && srcX[i + 1] < x) i += 1;
        const x0 = srcX[i], x1 = srcX[i + 1], y0 = srcY[i], y1 = srcY[i + 1];
        if (typeof y0 !== 'number') continue;
        if (x1 === undefined || typeof y1 !== 'number') { out[k] = y0; continue; }
        const span = x1 - x0;
        out[k] = span > 0 ? y0 + (y1 - y0) * ((x - x0) / span) : y0;
    }
    return out;
}

describe('the gap contract is well formed', () => {
    test('every case names one meaning and states a whole column', () => {
        assert.ok(GAP_CONTRACT.length >= 6, `only ${GAP_CONTRACT.length} cases`);
        const meanings = new Set(Object.values(GAP_MEANING));
        const ids = new Set();
        for (const c of GAP_CONTRACT) {
            assert.ok(meanings.has(c.meaning), `${c.id}: unknown meaning ${c.meaning}`);
            assert.ok(c.claim && c.why, `${c.id}: a case without a claim and a reason is a magic number`);
            assert.equal(c.expect.length, c.axis.length, `${c.id}: the expectation is not the axis's length`);
            assert.ok(!ids.has(c.id), `${c.id}: duplicate case id`);
            ids.add(c.id);
            // The channel under test never speaks outside the axis, so an aligner forming a
            // union produces exactly the axis the case names.
            for (const x of c.source.x) {
                assert.ok(c.axis.includes(x), `${c.id}: source instant ${x} is not on the axis`);
            }
        }
    });

    test('both meanings of null are represented, and so is the outside', () => {
        const meanings = new Set(GAP_CONTRACT.map((c) => c.meaning));
        assert.ok(meanings.has(GAP_MEANING.GATED));
        assert.ok(meanings.has(GAP_MEANING.UNSPOKEN));
        assert.ok(meanings.has(GAP_MEANING.OUTSIDE));
    });

    test('the claims read as sentences, for a digest and for a failure message', () => {
        const claims = gapContractClaims();
        assert.equal(claims.length, GAP_CONTRACT.length + 1);
        for (const line of claims) assert.match(line, /^[a-z-]+.*: .+/);
    });
});

describe('the comparator holds a break to being a break', () => {
    test('a break is null — not undefined, not NaN, and never zero', () => {
        assert.equal(compareColumn([1, null], [1, null]).ok, true);
        assert.equal(compareColumn([1, undefined], [1, null]).ok, false,
            'undefined is not a gap: uPlot spanGaps reads null');
        assert.equal(compareColumn([1, NaN], [1, null]).ok, false);
        assert.equal(compareColumn([1, 0], [1, null]).ok, false,
            'zero is a measurement — the same presence-not-truthiness rule the dash follows');
    });

    test('a number is compared to the last bit, so a rounded series cannot pass', () => {
        assert.equal(compareColumn([20], [20 + GAP_TOLERANCE / 2]).ok, true);
        assert.equal(compareColumn([20.1], [20]).ok, false,
            'rounding a series before it is drawn is its own defect');
    });

    test('a wrong-length column is a failure, not a shorter chart', () => {
        assert.equal(compareColumn([1, 2], [1, 2, null]).ok, false);
        assert.equal(compareColumn('not an array', [null]).ok, false);
    });
});

describe('the shipped gap policy satisfies the contract', () => {
    test('alignChannels passes every case and the distinction', () => {
        const report = checkChannelAligner(alignChannels);
        assert.deepEqual(report.failed, [],
            report.cases.filter((c) => !c.ok).map((c) => `${c.id}: ${c.detail}`).join('\n'));
        assert.equal(report.ok, true);
        assert.equal(report.cases.length, GAP_CONTRACT.length + 1);
    });

    test('bridgeUnspoken bridges only between two real readings', () => {
        // The primitive directly, on the union shape it is written for: slot 1 was never
        // spoken about and lies between two readings; slot 3 was spoken as null.
        const x = [0, 1, 2, 3, 4];
        const col = [10, null, 30, null, 50];
        const spoken = [true, false, true, true, true];
        assert.deepEqual(bridgeUnspoken(x, col, spoken), [10, 20, 30, null, 50]);
    });
});

describe('the contract bites on the defect it exists to prevent', () => {
    const report = checkResampler(holdLastValueAcrossGaps);

    test('holding the last value across a gap fails the contract', () => {
        assert.equal(report.ok, false,
            'a contract nothing can fail is not a contract');
    });

    test('it fails on the gated cases and passes the ones that are genuinely fine', () => {
        assert.deepEqual([...report.failed].sort(), [
            'a-gate-bounds-the-bridge-on-both-sides',
            'gate-at-the-trailing-edge',
            'never-bridge-a-gated-null',
        ]);
        const gated = new Set(GAP_CONTRACT.filter((c) => c.meaning === GAP_MEANING.GATED).map((c) => c.id));
        for (const id of report.failed) {
            assert.ok(gated.has(id), `${id} failed but is not a gating case — the contract is over-broad`);
        }
    });

    test('the failure names the slot and what stood where a break belongs', () => {
        const held = report.cases.find((c) => c.id === 'never-bridge-a-gated-null');
        assert.equal(held.ok, false);
        assert.match(held.detail, /slot 1: expected a break \(null\), got 10/,
            'the value from before the gate is what runs on through it');
    });

    test('the same defect loses the first real reading after a gate', () => {
        // Both halves on one source: slot 1 gains a value the channel never gave, and slot 3
        // — a real reading of 40 — is dropped, because by then the walk's left edge is on the
        // null. The contract's expectation is the honest column.
        const column = holdLastValueAcrossGaps([0, 1, 2, 3], [0, 1, 2, 3], [10, null, null, 40]);
        assert.deepEqual(column, [10, 10, null, null]);
        const wanted = GAP_CONTRACT.find((c) => c.id === 'never-bridge-a-gated-null').expect;
        assert.deepEqual([...wanted], [10, null, null, 40]);
    });
});

describe('the two meanings of null stay distinguishable', () => {
    test('unspoken and gated at the same instant produce different columns', () => {
        const run = (source) => alignChannels({
            carrier: { x: [...GAP_DISTINCTION.axis], y: GAP_DISTINCTION.axis.map((_, i) => i) },
            probe: { x: [...source.x], y: [...source.y] },
        }, ['carrier', 'probe'])[2];
        const unspoken = run(GAP_DISTINCTION.unspoken);
        const gated = run(GAP_DISTINCTION.gated);
        assert.deepEqual(unspoken, [10, 20, 30], 'a slot nobody sampled is bridged');
        assert.deepEqual(gated, [10, null, 30], 'a slot the channel spoke as null is a break');
        assert.notDeepEqual(unspoken, gated);
    });

    test('a resampler that answers null for both fails the distinction', () => {
        const conflates = (axis) => axis.map(() => null);
        const report = checkResampler(conflates);
        assert.ok(report.failed.includes(GAP_DISTINCTION.id),
            'the policy collapses if one column can stand for both meanings');
    });

    test('a resampler that throws is a failure, never a skip', () => {
        const report = checkResampler(() => { throw new Error('boom'); });
        assert.equal(report.ok, false);
        assert.equal(report.failed.length, GAP_CONTRACT.length + 1);
        for (const c of report.cases) assert.match(c.detail, /threw: boom/);
    });

    test('the instrument refuses anything that is not a function', () => {
        assert.throws(() => checkResampler(null), /resample\(axis, srcX, srcY\)/);
        assert.throws(() => checkChannelAligner('nope'), /align\(channels, keys\)/);
    });
});
