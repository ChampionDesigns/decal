/**
 * The History viewer — two shots, and the alignment between them.
 */

import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    HistoryViewer, createHistoryViewer, HISTORY_PAGE_SIZE, failureRefusal,
} from '../src/lib/history-viewer.js';
import {
    comparisonStepRules, compareOnOneClock, comparisonWindow, resampleOnto, unionClock,
} from '../src/lib/history-compare.js';
import { checkResampler, GAP_CONTRACT, gapContractClaims } from '../src/lib/gap-contract.js';
import { alignChannels } from '../src/lib/chart-align.js';
import { createShotsStore } from '../src/stores/shots-store.js';
import { deriveFromRecord, shiftSeriesX } from '../src/lib/shot-derivation.js';
import { ALIGNMENT_OFFSET_LIMIT_S, ALIGNMENT_SLOT } from '../src/lib/alignment-offset.js';
import { abChannelSpecs, abRecords, COMPARISON_ALPHA, COMPARISON_DASH } from '../src/lib/history-series.js';
import { FLOW_TOP_CHANNELS } from '../src/lib/history-series.js';

const REPO = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const fixture = (name) => JSON.parse(readFileSync(path.join(REPO, 'tools/rea-fixtures', name), 'utf8'));

/** The mock's same-profile pair — "Extractamundo Dos! (2)" twice, 3.26 s and 8.54 s. */
const SHORT = fixture('api__v1__shots__5fc3f631-6b18-471b-9800-00d552dbbecb.json');
const LONG = fixture('api__v1__shots__d5139a1f-c4ee-47e2-bb80-0cbf3e39b6a3.json');
/** The odd one out: 22.33 s, "Lever Classic demo". Different clock, different length. */
const OTHER = fixture('api__v1__shots__cd020a51-f353-4ffb-8389-72c931640181.json');
const PAGE = fixture('api__v1__shots~limit=20~offset=0~order=desc.json');

const RECORDS = new Map([SHORT, LONG, OTHER].map((r) => [r.id, r]));

/** A transport that answers from the fixtures and COUNTS every request it is given. */
function recordingTransport() {
    const calls = [];
    return {
        calls,
        request: async (route, options = {}) => {
            calls.push({ route, method: options.method ?? 'GET', query: options.query ?? null });
            if (route === '/shots') return { ok: true, status: 200, data: PAGE, notModified: false };
            const id = route.slice('/shots/'.length);
            const record = RECORDS.get(id);
            if (!record) {
                return { ok: false, status: 404, message: `no recording of ${route}`, data: null };
            }
            return { ok: true, status: 200, data: record, notModified: false };
        },
    };
}

function stage() {
    const transport = recordingTransport();
    const store = createShotsStore({ transport });
    const host = { updates: 0, requestUpdate() { this.updates += 1; } };
    const viewer = new HistoryViewer({ store, host });
    return { transport, store, host, viewer };
}

/* ═══════════════════════════════════ the resampler, against the executable contract */

describe('the resampler — the defect that both invented data and lost it', () => {
    test('it passes every claim of the gap contract', () => {
        const verdict = checkResampler(resampleOnto);
        assert.equal(verdict.failed.length, 0, `failed: ${verdict.failed.join(', ')}`);
        assert.equal(verdict.ok, true);
        assert.equal(verdict.cases.length, GAP_CONTRACT.length + 1,
            'six single-source cases plus the two-meanings distinction');
    });

    test('the same seven claims hold for the shipped channel aligner — one policy, not two', () => {
        for (const claim of gapContractClaims()) assert.ok(claim.length > 0);
        const viaResampler = GAP_CONTRACT.map((c) => resampleOnto(c.axis, c.source.x, c.source.y));
        const viaAligner = GAP_CONTRACT.map((c) => alignChannels({
            carrier: { x: [...c.axis], y: c.axis.map((_, i) => i) },
            probe: { x: [...c.source.x], y: [...c.source.y] },
        }, ['carrier', 'probe'])[2]);
        assert.deepEqual(viaResampler, viaAligner);
    });

    test('a gated null is a break and the reading after it survives — it is never held', () => {
        const column = resampleOnto([0, 1, 2, 3], [0, 1, 2, 3], [10, null, null, 40]);
        assert.deepEqual(column, [10, null, null, 40]);
        assert.notEqual(column[1], 10, 'holding the last value across a gate invents data');
        assert.equal(column[3], 40, 'and dropping the reading after it loses data');
    });

    test('an unspoken slot and a gated slot at one instant produce different columns', () => {
        const unspoken = resampleOnto([0, 1, 2], [0, 2], [10, 30]);
        const gated = resampleOnto([0, 1, 2], [0, 1, 2], [10, null, 30]);
        assert.deepEqual(unspoken, [10, 20, 30]);
        assert.deepEqual(gated, [10, null, 30]);
    });

    test('a break is null, never undefined and never zero', () => {
        const column = resampleOnto([0, 1, 2], [0, 1], [10, 20]);
        assert.equal(column[2], null);
        assert.notEqual(column[2], undefined, 'uPlot spanGaps reads null');
        assert.notEqual(column[2], 0, 'zero is a measurement');
    });
});

/* ═════════════════════════════ the union clock, over two shots with different clocks */

describe('the union clock — drawCompareData, outside the renderer', () => {
    const a = deriveFromRecord(SHORT);
    const b = deriveFromRecord(LONG);

    test('the two mock shots really do have different sample clocks', () => {
        assert.equal(a.ok, true);
        assert.equal(b.ok, true);
        const xa = a.series.pressure.x;
        const xb = b.series.pressure.x;
        assert.notEqual(xa.length, xb.length, 'different lengths');
        assert.ok(Math.abs(a.scalars.durationSeconds - 3.26) < 0.05);
        assert.ok(Math.abs(b.scalars.durationSeconds - 8.54) < 0.05);
        const shared = new Set(xa);
        const both = xb.filter((t) => shared.has(t)).length;
        assert.ok(both < xb.length, 'and instants that are not all shared');
    });

    test('every reading of both shots lands on a slot — the union loses nothing', () => {
        const compared = compareOnOneClock({ channels: FLOW_TOP_CHANNELS, a, b, offset: 0 });
        const slots = new Set(compared.axis);
        for (const key of FLOW_TOP_CHANNELS) {
            for (const t of a.series[key]?.x ?? []) assert.ok(slots.has(t), `A ${key} @ ${t}`);
            for (const t of b.series[key]?.x ?? []) assert.ok(slots.has(t), `B ${key} @ ${t}`);
        }
        assert.equal(compared.axis.length, unionClock([
            ...FLOW_TOP_CHANNELS.map((k) => a.series[k]).filter(Boolean),
            ...FLOW_TOP_CHANNELS.map((k) => b.series[k]).filter(Boolean),
        ]).length);
    });

    test('the axis is ascending and holds no instant twice', () => {
        const { axis } = compareOnOneClock({ channels: FLOW_TOP_CHANNELS, a, b, offset: 2.5 });
        for (let i = 1; i < axis.length; i += 1) assert.ok(axis[i] > axis[i - 1], `slot ${i}`);
    });

    test('every column has one entry per slot, for both shots', () => {
        const compared = compareOnOneClock({ channels: FLOW_TOP_CHANNELS, a, b, offset: 0 });
        for (const [key, column] of Object.entries(compared.slots.a)) {
            assert.equal(column.length, compared.axis.length, `A ${key}`);
        }
        for (const [key, column] of Object.entries(compared.slots.b)) {
            assert.equal(column.length, compared.axis.length, `B ${key}`);
        }
    });

    test('a shot with a wholly different clock still aligns — 22.33 s against 3.26 s', () => {
        const other = deriveFromRecord(OTHER);
        const compared = compareOnOneClock({ channels: FLOW_TOP_CHANNELS, a, b: other, offset: 0 });
        const window = comparisonWindow(compared);
        assert.equal(window.empty, false);
        assert.ok(window.max > 20, `the longer shot sets the right edge: ${window.max}`);
    });

    test('the union axis GROWS to carry B past the end of A, which is not an error', () => {
        const at0 = compareOnOneClock({ channels: FLOW_TOP_CHANNELS, a, b, offset: 0 });
        const atLimit = compareOnOneClock({
            channels: FLOW_TOP_CHANNELS, a, b, offset: ALIGNMENT_OFFSET_LIMIT_S,
        });
        assert.ok(atLimit.axis.at(-1) > at0.axis.at(-1),
            'a full-limit slide carries the shorter trace clean past the other end');
        assert.equal(atLimit.axis.at(-1) - at0.axis.at(-1), ALIGNMENT_OFFSET_LIMIT_S);
    });

    test('B slid to the NEGATIVE limit runs before zero, and the window says so', () => {
        /* The reason `plot-surface.js` gained an `x-min`. A hard [0, max] clips exactly
         * this, silently, while the slider reports the offset it applied. */
        const compared = compareOnOneClock({
            channels: FLOW_TOP_CHANNELS, a, b, offset: -ALIGNMENT_OFFSET_LIMIT_S,
        });
        const window = comparisonWindow(compared);
        assert.ok(window.min < 0, `B starts at ${window.min}`);
        assert.equal(window.min, -ALIGNMENT_OFFSET_LIMIT_S);
    });

    test('one shot alone opens at zero — the comparison is what moves the edge', () => {
        const window = comparisonWindow(compareOnOneClock({
            channels: FLOW_TOP_CHANNELS, a, b: null, offset: -5,
        }));
        assert.equal(window.min, 0, 'an offset with nothing to slide moves nothing');
    });

    test('the window is read off the DRAWN data, so an all-null channel adds no space', () => {
        const sparse = {
            ok: true,
            series: { pressure: { x: [0, 1, 2, 9], y: [1, 2, 3, null] } },
            stepMarks: [],
        };
        const window = comparisonWindow(compareOnOneClock({
            channels: ['pressure'], a: sparse, b: null, offset: 0,
        }));
        assert.equal(window.max, 2, 'the trailing gated slot is not drawn, so it is not spanned');
    });

    test('an empty comparison answers empty rather than a degenerate window', () => {
        const window = comparisonWindow(compareOnOneClock({ channels: FLOW_TOP_CHANNELS }));
        assert.equal(window.empty, true);
        assert.equal(window.span, 0);
    });
});

/* ══════════════════════════════════ the alignment — the thing that was silently inert */

describe('the offset moves B, and only B', () => {
    const a = deriveFromRecord(SHORT);
    const b = deriveFromRecord(LONG);

    test('by exactly the number of seconds asked for, along the WHOLE trace', () => {
        const at = (offset) => abRecords(FLOW_TOP_CHANNELS, { a, b, offset })['b:pressure'].x;
        const base = at(0);
        assert.ok(base.length > 5);
        for (const offset of [4, -3, ALIGNMENT_OFFSET_LIMIT_S, -ALIGNMENT_OFFSET_LIMIT_S]) {
            const moved = at(offset);
            assert.equal(moved.length, base.length, `${offset}: no sample is lost`);
            assert.ok(Math.abs(moved[0] - (base[0] + offset)) < 1e-9,
                `${offset}: the head moved to ${moved[0]} from ${base[0]}`);
            assert.ok(Math.abs(moved.at(-1) - (base.at(-1) + offset)) < 1e-9,
                `${offset}: the whole trace moves, not just its head`);
        }
    });

    test('A never moves, and its bundle is the SAME OBJECT at every offset', () => {
        const first = abRecords(FLOW_TOP_CHANNELS, { a, b, offset: 0 });
        for (const offset of [7, -7, 0.1]) {
            const now = abRecords(FLOW_TOP_CHANNELS, { a, b, offset });
            for (const key of FLOW_TOP_CHANNELS) {
                if (!first[key]) continue;
                assert.equal(now[key], first[key],
                    `${key}: A is the reference — not a copy, and not a resampling`);
            }
        }
    });

    test('redrawing twice at one offset does not compound the shift', () => {
        const once = abRecords(FLOW_TOP_CHANNELS, { a, b, offset: 3 })['b:pressure'].x;
        const twice = shiftSeriesX(b.series.pressure, 3).x;
        assert.deepEqual(once, twice, 'shiftSeriesX returns a NEW x array from the bundle');
        const again = abRecords(FLOW_TOP_CHANNELS, { a, b, offset: 3 })['b:pressure'].x;
        assert.deepEqual(again, once);
    });

    test('the offset is clamped in both directions, and nonsense is zero', () => {
        const { viewer } = stage();
        assert.equal(viewer.setOffset(999), ALIGNMENT_OFFSET_LIMIT_S);
        assert.equal(viewer.setOffset(-999), -ALIGNMENT_OFFSET_LIMIT_S);
        assert.equal(viewer.setOffset('nonsense'), 0);
        assert.equal(viewer.offset, 0);
        assert.equal(ALIGNMENT_OFFSET_LIMIT_S, 5,
            'the ported limit, and its reasoning lives where the constant does');
    });

    test('driving to both ends and past the shorter trace\'s end raises nothing', async () => {
        const { viewer, store } = stage();
        await store.readPage();
        await viewer.select(ALIGNMENT_SLOT.REFERENCE, SHORT.id);
        await viewer.select(ALIGNMENT_SLOT.MOVING, LONG.id);
        assert.equal(viewer.hasComparison, true);

        const seen = [];
        for (let step = -ALIGNMENT_OFFSET_LIMIT_S; step <= ALIGNMENT_OFFSET_LIMIT_S; step += 0.1) {
            const applied = viewer.setOffset(Number(step.toFixed(1)));
            const compared = viewer.compare(FLOW_TOP_CHANNELS);
            const window = comparisonWindow(compared);
            assert.equal(window.empty, false, `offset ${applied} drew nothing`);
            seen.push({ applied, min: window.min, max: window.max });
        }
        assert.equal(seen.length, 101, 'every step of the ported 0.1 s grid');
        assert.equal(seen[0].applied, -ALIGNMENT_OFFSET_LIMIT_S);
        assert.equal(seen.at(-1).applied, ALIGNMENT_OFFSET_LIMIT_S);
        assert.ok(seen.at(-1).max > seen[0].max, 'the window followed the slider all the way');
    });

    test('there is no catch anywhere in the path to swallow a failure', async () => {
        const transport = {
            request: async () => ({ ok: false, status: 500, message: 'the machine said no', data: null }),
        };
        const viewer = createHistoryViewer({ store: createShotsStore({ transport }) });
        await viewer.start();
        assert.equal(viewer.status, 'failed');
        assert.equal(viewer.failure.status, 500);
        assert.equal(viewer.failure.message, 'the machine said no', 'verbatim, not re-worded');
        const picked = await viewer.select(ALIGNMENT_SLOT.REFERENCE, 'nope');
        assert.equal(picked.ok, false, 'a failed load answers, it does not vanish');
        assert.equal(viewer.derivationA, null);
    });

    test('a programmer error still throws — the store is not made polite', async () => {
        const { viewer, store } = stage();
        await viewer.start();
        await assert.rejects(() => store.loadShot(''), /needs a shot id/);
        assert.throws(() => new HistoryViewer({}), /shots store must be injected/);
    });
});

/* ═══════════════════════════════════════════ choosing a shot resets the alignment */

describe('a new pair starts aligned', () => {
    test('choosing a different B resets the offset; choosing a different A does not', async () => {
        const { viewer, store } = stage();
        await store.readPage();
        await viewer.select(ALIGNMENT_SLOT.REFERENCE, SHORT.id);
        await viewer.select(ALIGNMENT_SLOT.MOVING, LONG.id);
        viewer.setOffset(2.5);
        assert.equal(viewer.offset, 2.5);

        await viewer.select(ALIGNMENT_SLOT.REFERENCE, OTHER.id);
        assert.equal(viewer.offset, 2.5, 'the reference changing is not the pair changing slots');

        await viewer.select(ALIGNMENT_SLOT.MOVING, SHORT.id);
        assert.equal(viewer.offset, 0,
            'an offset chosen for one pair, silently applied to another, is an alignment '
            + 'nobody asked for and nobody can see is wrong');
    });

    test('clearing B clears the offset too', async () => {
        const { viewer, store } = stage();
        await store.readPage();
        await viewer.select(ALIGNMENT_SLOT.MOVING, LONG.id);
        viewer.setOffset(-4);
        await viewer.select(ALIGNMENT_SLOT.MOVING, null);
        assert.equal(viewer.offset, 0);
        assert.equal(viewer.hasComparison, false);
    });

    test('there is no slot mark to set — the header discs are tags', () => {
        const { viewer } = stage();
        assert.equal(typeof viewer.setActiveSlot, 'undefined',
            'a marking method with no consumer');
        assert.equal('activeSlot' in viewer, false);
    });
});

/* ══════════════════════════════════════════ per-instance, which is the conversion */

describe('the module singleton became an instance', () => {
    test('two viewers over ONE store hold independent selections and offsets', async () => {
        const transport = recordingTransport();
        const store = createShotsStore({ transport });
        await store.readPage();

        const one = new HistoryViewer({ store });
        const two = new HistoryViewer({ store });

        await one.select(ALIGNMENT_SLOT.REFERENCE, SHORT.id);
        await one.select(ALIGNMENT_SLOT.MOVING, LONG.id);
        one.setOffset(4);

        await two.select(ALIGNMENT_SLOT.REFERENCE, OTHER.id);
        two.setOffset(-1.5);

        assert.equal(one.shotA, SHORT.id);
        assert.equal(one.shotB, LONG.id);
        assert.equal(one.offset, 4);
        assert.equal(two.shotA, OTHER.id);
        assert.equal(two.shotB, null);
        assert.equal(two.offset, -1.5);
        one.setOffset(0);
        assert.equal(two.offset, -1.5, 'and neither can move the other');
    });

    test('the SHARED store still walks each record exactly once', async () => {
        const transport = recordingTransport();
        const store = createShotsStore({ transport });
        await store.readPage();
        const one = new HistoryViewer({ store });
        const two = new HistoryViewer({ store });
        await one.select(ALIGNMENT_SLOT.REFERENCE, SHORT.id);
        await two.select(ALIGNMENT_SLOT.REFERENCE, SHORT.id);
        await two.select(ALIGNMENT_SLOT.MOVING, SHORT.id);
        assert.equal(store.get().walks, 1, 'a viewer owns no cache; the store owns the walk');
        const byId = transport.calls.filter((c) => c.route.startsWith('/shots/'));
        assert.equal(byId.length, 1, 'and one fetch of the ~221 KB record, not three');
    });

    test('each viewer\'s host is told, and only its own', async () => {
        const store = createShotsStore({ transport: recordingTransport() });
        const hostA = { n: 0, requestUpdate() { this.n += 1; } };
        const hostB = { n: 0, requestUpdate() { this.n += 1; } };
        const one = new HistoryViewer({ store, host: hostA });
        const two = new HistoryViewer({ store, host: hostB });
        one.setOffset(1);
        assert.equal(hostA.n, 1);
        assert.equal(hostB.n, 0);
        two.setOffset(2);
        assert.equal(hostA.n, 1);
        assert.equal(hostB.n, 1);
    });

    test('a viewer with no host is legal and silent', () => {
        const viewer = createHistoryViewer({ store: createShotsStore({ transport: recordingTransport() }) });
        assert.equal(viewer.setOffset(2), 2);
    });
});

/* ═════════════════════════════════════ — no per-row fetch, ever */

describe('the fetch-per-row machinery is not built', () => {
    test('opening the viewer costs ONE list request and no record at all', async () => {
        const { viewer, transport, store } = stage();
        await viewer.start();
        assert.equal(transport.calls.length, 1);
        assert.equal(transport.calls[0].route, '/shots');
        assert.equal(transport.calls[0].query.limit, HISTORY_PAGE_SIZE);
        assert.equal(store.get().reads.byId, 0);
        assert.equal(store.get().reads.perRow, 0);
        assert.equal(store.get().walks, 0);
        assert.equal(viewer.rows.length, 20, 'twenty rows painted, twenty records not fetched');
    });

    test('the picker labels come from the list, and no row triggers a load', async () => {
        const { viewer, transport } = stage();
        await viewer.start();
        const before = transport.calls.length;
        const options = viewer.shotOptions;
        assert.equal(options.length, 20);
        for (const option of options) {
            assert.equal(typeof option.value, 'string');
            assert.ok(option.label.length > 0);
        }
        assert.equal(transport.calls.length, before, 'reading the options fetched nothing');
    });

    test('picking a shot costs exactly one record and one walk', async () => {
        const { viewer, store, transport } = stage();
        await viewer.start();
        await viewer.select(ALIGNMENT_SLOT.REFERENCE, SHORT.id);
        assert.equal(store.get().reads.byId, 1);
        assert.equal(store.get().walks, 1);
        assert.equal(store.get().reads.perRow, 0);
        await viewer.select(ALIGNMENT_SLOT.REFERENCE, SHORT.id);
        assert.equal(transport.calls.filter((c) => c.route !== '/shots').length, 1,
            'and re-picking it costs nothing');
    });

    test('the derivation reaches the pages without a second walk', async () => {
        const { viewer, store } = stage();
        await viewer.start();
        await viewer.select(ALIGNMENT_SLOT.REFERENCE, SHORT.id);
        assert.equal(viewer.derivationA, store.derivationOf(SHORT.id), 'the same object');
        assert.equal(store.get().walks, 1);
    });
});

/* ══════════════════════════════ the step boundaries — dash and opacity, both restored */

describe('both shots\' step boundaries, and B\'s move', () => {
    const a = deriveFromRecord(SHORT);
    const b = deriveFromRecord(LONG);
    const PAINT = { colour: 'C', ink: 'I', width: 2, dash: [9, 9], alpha: COMPARISON_ALPHA };

    test('the mock really carries step marks on both shots', () => {
        assert.ok(a.stepMarks.length >= 1);
        assert.ok(b.stepMarks.length >= 1);
    });

    test('A\'s rules stay put and B\'s follow the offset', () => {
        const at = (offset) => comparisonStepRules({ a, b, offset, paint: PAINT }).vertical.map((r) => r.x);
        const at0 = at(0);
        const at3 = at(3);
        const aCount = a.stepMarks.length;
        assert.deepEqual(at3.slice(0, aCount), at0.slice(0, aCount), 'A\'s rules are fixed');
        for (let i = aCount; i < at0.length; i += 1) {
            assert.ok(Math.abs(at3[i] - (at0[i] + 3)) < 1e-9, `B's rule ${i} follows the offset`);
        }
    });

    test('B\'s rules carry B\'s dash AND B\'s fade — neither is dropped', () => {
        const { vertical } = comparisonStepRules({ a, b, offset: 0, paint: PAINT });
        const aRules = vertical.slice(0, a.stepMarks.length);
        const bRules = vertical.slice(a.stepMarks.length);
        for (const rule of aRules) {
            assert.equal(rule.dash, undefined, 'A takes the renderer\'s own default');
            assert.equal(rule.alpha, undefined, 'and is fully opaque');
        }
        for (const rule of bRules) {
            assert.deepEqual(rule.dash, [9, 9], 'the pattern from the ONE dash table');
            assert.equal(rule.alpha, COMPARISON_ALPHA, 'opacity is not dropped');
        }
        assert.equal(COMPARISON_DASH, 'dash', 'a NAME in the table, never a pattern spelled here');
    });

    test('the label is said once, on A, and does not move', () => {
        const at0 = comparisonStepRules({ a, b, offset: 0, paint: PAINT }).labels;
        const at4 = comparisonStepRules({ a, b, offset: 4, paint: PAINT }).labels;
        assert.deepEqual(at4, at0);
        assert.equal(at0.length <= a.stepMarks.length, true);
    });

    test('no rule carries this module\'s bookkeeping to the plot', () => {
        const { vertical } = comparisonStepRules({ a, b, offset: 1, paint: PAINT });
        for (const rule of vertical) {
            assert.equal('reference' in rule, false);
            assert.equal(rule.color, 'C');
        }
    });

    test('with no comparison there are only A\'s rules', () => {
        const { vertical } = comparisonStepRules({ a, b: null, offset: 3, paint: PAINT });
        assert.equal(vertical.length, a.stepMarks.length);
    });
});

/* ═══════════════════════════════════════════ the A/B convention through the port */

describe('A/B shades and weights identify both measured and target roles', () => {
    test('one B spec for every A spec, and they line up channel for channel', () => {
        const specs = abChannelSpecs(FLOW_TOP_CHANNELS, { hasComparison: true });
        assert.equal(specs.length, FLOW_TOP_CHANNELS.length * 2);
        const half = FLOW_TOP_CHANNELS.length;
        for (let i = 0; i < half; i += 1) {
            const key = FLOW_TOP_CHANNELS[i], a = specs[i], b = specs[half + i];
            const target = key.startsWith('target');
            assert.equal(a.key, key);
            assert.equal(b.key, `b:${key}`, 'B follows A in draw order with its own data key');
            assert.equal(b.token, `compare-b-${a.token}`, 'B uses its theme-specific shade');
            assert.equal(a.dash, target ? 'compare-target-a' : null);
            assert.equal(b.dash, target ? 'compare-target-b' : null);
            assert.equal(a.width, target ? 3.5 : 4.5);
            assert.equal(b.width, target ? 1.05 : 1.35);
            assert.equal(a.alpha, 1);
            assert.equal(b.alpha, 1);
        }
    });

    test('comparison targets share their shot\'s measured shade; single-shot treatment stays intact', () => {
        const treatments = [{ key: 'targetPressure', minor: true, dash: 'dash' }];
        const single = abChannelSpecs(FLOW_TOP_CHANNELS, { hasComparison: false, treatments });
        for (const spec of single) {
            assert.equal(spec.token, undefined, 'single-shot colours retain their normal channel tokens');
            assert.equal(spec.alpha, undefined, 'single-shot opacity keeps its normal default');
        }
        const singleTarget = single.find((spec) => spec.key === 'targetPressure');
        assert.equal(singleTarget.minor, true);
        assert.equal(singleTarget.dash, 'dash', 'single-shot targets retain the standard dash');
        const specs = abChannelSpecs(FLOW_TOP_CHANNELS, { hasComparison: true, treatments });
        const byKey = Object.fromEntries(specs.map((spec) => [spec.key, spec]));
        for (const prefix of ['', 'b:']) {
            assert.equal(byKey[`${prefix}targetPressure`].token, byKey[`${prefix}pressure`].token,
                'measured and target share one shade within each shot');
            assert.equal(byKey[`${prefix}targetFlow`].token, byKey[`${prefix}flow`].token);
        }
        assert.equal(byKey.pressure.token, 'pressure', 'A retains the standard measured anchor');
        assert.equal(byKey['b:pressure'].token, 'compare-b-pressure');
    });

    test('the compare-path record map partitions exactly into the two slots', () => {
        const a = deriveFromRecord(SHORT);
        const b = deriveFromRecord(LONG);
        const records = abRecords(FLOW_TOP_CHANNELS, { a, b, offset: 1 });
        const keys = Object.keys(records);
        const bKeys = keys.filter((k) => k.startsWith('b:'));
        assert.equal(bKeys.length * 2, keys.length);
        for (const key of bKeys) assert.ok(keys.includes(key.slice(2)));
    });
});

/* ═══════════════════════════════════════════════ the typed failure, and its reader */

describe('the typed failure reaches a screen VERBATIM', () => {
    const failure = (over = {}) => ({
        ok: false, kind: 'http', status: 500, message: 'the machine said no',
        problem: null, method: 'GET', url: '/api/v1/shots', cause: null, ...over,
    });

    test('no failure is not a refusal', () => {
        assert.equal(failureRefusal(null), null);
        assert.equal(failureRefusal(undefined), null);
        assert.equal(failureRefusal({ ok: true, status: 200 }), null);
    });

    test('the machine\'s own sentence is the heading, not re-worded', () => {
        const refusal = failureRefusal(failure());
        assert.equal(refusal.heading, 'the machine said no');
        assert.equal(refusal.body, 'The machine answered 500.');
    });

    test('the server\'s body wins over the transport\'s summary, through rea-errors\' own reader', () => {
        const refusal = failureRefusal(failure({ status: 404, problem: { error: 'Shot not found' } }));
        assert.equal(refusal.heading, 'Shot not found');
        assert.equal(refusal.body, 'The machine answered 404.');
    });

    test('a request that never reached the machine says THAT, not a status', () => {
        /* rea-errors.js: status is null for network/timeout. "answered 0" would be a
         * number the machine never sent. */
        const refusal = failureRefusal(failure({ kind: 'network', status: null, message: 'fetch failed' }));
        assert.equal(refusal.heading, 'fetch failed');
        assert.equal(refusal.body, 'The read failed before the machine answered.');
    });

    test('a failure with nothing to say still does not invent a reason', () => {
        const refusal = failureRefusal(failure({ message: '   ' }));
        assert.equal(refusal.heading, 'The machine did not say why');
        assert.equal(refusal.body, 'The machine answered 500.');
    });

    test('the words are the CALLER\'s: a translator is passed in, never imported here', () => {
        const seen = [];
        const t = (key, params) => { seen.push([key, params]); return 'TRANSLATED'; };
        const refusal = failureRefusal(failure(), t);
        assert.equal(refusal.heading, 'the machine said no', 'the machine is not translated');
        assert.equal(refusal.body, 'TRANSLATED');
        assert.deepEqual(seen, [['The machine answered {status}.', { status: 500 }]],
            'one key, one param — never a sentence built by concatenation at the call site');
    });

    test('a viewer publishes the failure the store reported, unchanged', async () => {
        const store = createShotsStore({
            transport: { request: async () => ({ ok: false, status: 503, message: 'busy' }) },
        });
        const viewer = createHistoryViewer({ store });
        await viewer.start();
        assert.equal(viewer.status, 'failed');
        assert.equal(viewer.failure.status, 503);
        assert.deepEqual(failureRefusal(viewer.failure), {
            heading: 'busy', body: 'The machine answered 503.',
        });
        viewer.stop();
    });
});
