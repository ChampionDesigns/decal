

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
    COMPARISON_ALPHA, COMPARISON_DASH, COMPARISON_KEY_PREFIX,
    DEFAULT_FLOW_PLOT, FLOW_PLOTS, FLOW_TEMP_CHANNELS, FLOW_TOP_CHANNELS,
    abChannelSpecs, abRecords, comparisonKey, isComparisonKey, legendItems, referenceSpecs,
    slotOfKey,
} from '../src/lib/history-series.js';
import { SERIES_KEYS, deriveFromRecord } from '../src/lib/shot-derivation.js';
import { ALIGNMENT_OFFSET_LIMIT_S, ALIGNMENT_SLOT } from '../src/lib/alignment-offset.js';

const FIXTURES = new URL('../tools/rea-fixtures/', import.meta.url);
const record = async (id) => JSON.parse(await readFile(new URL(`api__v1__shots__${id}.json`, FIXTURES), 'utf8'));

/** The same-profile pair the alignment control exists for. 3.26 s and 8.54 s. */
const A_ID = '5fc3f631-6b18-471b-9800-00d552dbbecb';
const B_ID = 'd5139a1f-c4ee-47e2-bb80-0cbf3e39b6a3';

const derivations = async () => {
    const [a, b] = await Promise.all([record(A_ID), record(B_ID)]);
    return { a: deriveFromRecord(a), b: deriveFromRecord(b) };
};

describe('the plots this page draws', () => {
    test('every channel it names is a channel the derivation emits', () => {
        for (const plot of FLOW_PLOTS) {
            for (const key of plot.channels) {
                assert.ok(SERIES_KEYS.includes(key),
                    `${key} is not a gate-6 series key — a channel nothing emits draws nothing`);
            }
        }
    });

    test('the two RATIO channels do NOT come across, and power now does', () => {
        const named = FLOW_PLOTS.flatMap((p) => p.channels);
        for (const key of ['resistance', 'impedance']) {
            assert.ok(!named.includes(key),
                `${key} is a RATIO: it runs away at low flow and would flatten a shared `
                + 'axis. Its home is the power page, whose second axis is real');
        }
        assert.ok(named.includes('power'), 'power shares the left axis with pressure and flow');
    });

    test('two plots, not three, and the first one is the default', () => {
        assert.equal(FLOW_PLOTS.length, 2, 'the v1 skeleton is two plots — the power page is D1 deferred');
        assert.equal(FLOW_PLOTS[0].id, DEFAULT_FLOW_PLOT);
        assert.deepEqual(FLOW_PLOTS[0].channels, FLOW_TOP_CHANNELS);
        assert.deepEqual(FLOW_PLOTS[1].channels, FLOW_TEMP_CHANNELS);
    });
});

describe('the comparison keys', () => {
    test('no derivation key can ever collide with a comparison key', () => {
        for (const key of SERIES_KEYS) {
            assert.ok(!isComparisonKey(key),
                `${key} would be read as a comparison series — the prefix must stay `
                + 'unspellable as a derivation key');
        }
        assert.ok(COMPARISON_KEY_PREFIX.includes(':'),
            'the prefix carries a character no camelCase identifier can hold');
    });

    test('the two slots partition the series exactly', () => {
        const specs = abChannelSpecs(FLOW_TOP_CHANNELS, { hasComparison: true });
        const a = specs.filter((s) => slotOfKey(s.key) === ALIGNMENT_SLOT.REFERENCE);
        const b = specs.filter((s) => slotOfKey(s.key) === ALIGNMENT_SLOT.MOVING);
        assert.equal(a.length, FLOW_TOP_CHANNELS.length);
        assert.equal(b.length, FLOW_TOP_CHANNELS.length);
        assert.equal(a.length + b.length, specs.length, 'and nothing is in neither');
    });
});

describe('the channel specs', () => {
    test('with no comparison there is exactly one series per channel and no dash of ours', () => {
        const specs = abChannelSpecs(FLOW_TOP_CHANNELS, { hasComparison: false });
        assert.equal(specs.length, FLOW_TOP_CHANNELS.length);
        for (const spec of specs) {
            assert.equal(spec.dash, null, 'with no table handed in, A states no dash of ours');
            assert.equal(spec.minor, false, 'and no weight of ours either');
            assert.equal(spec.token, undefined, 'the shared-hue token is B\'s alone');
            assert.equal(spec.alpha, undefined, 'and so is the fade');
        }
    });

    test('A carries the treatment the ONE table holds for it — not a treatment of its own', () => {
        const treatments = [
            { key: 'targetPressure', minor: true, dash: 'dash' },
            { key: 'targetFlow', minor: true, dash: 'dash' },
            { key: 'weightFlow', minor: true },
        ];
        const specs = referenceSpecs(FLOW_TOP_CHANNELS, treatments);
        const by = Object.fromEntries(specs.map((s) => [s.key, s]));

        assert.deepEqual(by.pressure, { key: 'pressure', minor: false, dash: null },
            'a key the table does not name takes no treatment');
        assert.deepEqual(by.targetPressure, { key: 'targetPressure', minor: true, dash: 'dash' },
            'and a target takes the minor stroke and the dash the table gives it (§6.2)');
        assert.deepEqual(by.weightFlow, { key: 'weightFlow', minor: true, dash: null },
            'minor without a dash is a legal treatment and stays one');

        /* A Map and a plain object are the same table said two ways — the card exports an
         * array, and a caller that already keyed it must not have to unkey it. */
        const asMap = referenceSpecs(FLOW_TOP_CHANNELS, new Map(treatments.map((t) => [t.key, t])));
        assert.deepEqual(asMap, specs, 'a Map says the same thing');
        assert.deepEqual(referenceSpecs(FLOW_TOP_CHANNELS,
            Object.fromEntries(treatments.map((t) => [t.key, t]))), specs,
        'and so does a plain object');
    });

    test('B is the same hue, dashed and faded — and says so in three fields', () => {
        const specs = abChannelSpecs(FLOW_TOP_CHANNELS, { hasComparison: true });
        const b = specs.slice(FLOW_TOP_CHANNELS.length);
        for (let i = 0; i < b.length; i += 1) {
            const key = FLOW_TOP_CHANNELS[i];
            assert.equal(b[i].key, comparisonKey(key), 'B has its own record key');
            assert.equal(b[i].token, key, 'and A\'s channel token, which is the shared hue');
            assert.equal(b[i].dash, COMPARISON_DASH, 'a dash NAMED in chart-axis.js\'s one table');
            assert.equal(b[i].alpha, COMPARISON_ALPHA, 'and the fade Slate drew it with');
        }
        assert.ok(COMPARISON_ALPHA > 0 && COMPARISON_ALPHA < 1,
            'the fade is a real fade — stepRules() dropping opacity is the defect');
        assert.equal(typeof COMPARISON_DASH, 'string',
            'a dash NAME, never a pattern: the pattern lives in chart-axis.js and nowhere else');
    });

    test('the legend names A only', () => {
        const items = legendItems(FLOW_TOP_CHANNELS, { pressure: 'Pressure (bar)' });
        assert.equal(items.length, FLOW_TOP_CHANNELS.length);
        assert.equal(items.filter((i) => isComparisonKey(i.key)).length, 0);
        assert.equal(items[0].label, 'Pressure (bar)', 'the words are the caller\'s (D2)');
        assert.equal(items[1].label, items[1].key, 'and an unnamed channel falls back to its key');
    });

    test('a chip carries the weight and dash of the trace it stands for', () => {
        const treatments = [{ key: 'targetPressure', minor: true, dash: 'dash' }];
        const items = legendItems(FLOW_TOP_CHANNELS, {}, treatments);
        const specs = referenceSpecs(FLOW_TOP_CHANNELS, treatments);
        for (let i = 0; i < items.length; i += 1) {
            assert.equal(items[i].key, specs[i].key);
            assert.equal(items[i].minor, specs[i].minor, `${items[i].key}: same weight as its trace`);
            assert.equal(items[i].dash, specs[i].dash, `${items[i].key}: same dash as its trace`);
        }
        assert.equal(items[1].minor, true, 'and the target really is the minor one');
        assert.equal(items[1].dash, 'dash', 'named from chart-axis.js\'s one table, never a pattern');
    });
});

describe('the records', () => {
    test('A is handed across untouched — this module resamples nothing', async () => {
        const { a } = await derivations();
        const records = abRecords(FLOW_TOP_CHANNELS, { a, b: null, offset: 0 });
        for (const key of FLOW_TOP_CHANNELS) {
            assert.equal(records[key], a.series[key],
                `${key}: the SAME object, not a copy and not a resampling. resampleOnto `
                + 'holding the last value across a gap is the defect the port must not carry, '
                + 'and the surest way not to carry it is to touch nothing.');
        }
        assert.equal(Object.keys(records).length, FLOW_TOP_CHANNELS.length,
            'and with no comparison there is nothing else in the map');
    });

    test('a refusal contributes nothing rather than an empty series', async () => {
        const { a } = await derivations();
        const records = abRecords(FLOW_TOP_CHANNELS, { a, b: { ok: false, series: {} }, offset: 0 });
        for (const key of FLOW_TOP_CHANNELS) {
            assert.ok(!(comparisonKey(key) in records),
                'a key that is ABSENT says what happened; an empty series says the same '
                + 'thing by a road that looks like data');
        }
    });

    test('the offset moves B\'s x and never its y, and never A', async () => {
        const { a, b } = await derivations();
        const at0 = abRecords(FLOW_TOP_CHANNELS, { a, b, offset: 0 });
        const at5 = abRecords(FLOW_TOP_CHANNELS, { a, b, offset: ALIGNMENT_OFFSET_LIMIT_S });

        assert.equal(at5.pressure, at0.pressure, 'A did not move: it is the reference');

        const before = at0[comparisonKey('pressure')];
        const after = at5[comparisonKey('pressure')];
        assert.notEqual(after, before, 'B\'s bundle is a NEW object — an in-place shift would '
            + 'compound every time the slider moved');
        assert.equal(after.y, before.y, 'and its y array is shared, because nothing about y changed');
        assert.equal(after.x.length, before.x.length);
        for (let i = 0; i < after.x.length; i += 1) {
            assert.ok(Math.abs(after.x[i] - (before.x[i] + ALIGNMENT_OFFSET_LIMIT_S)) < 1e-9,
                `sample ${i} moved by exactly the offset`);
        }

        const aLast = a.series.pressure.x[a.series.pressure.x.length - 1];
        const bLast = after.x[after.x.length - 1];
        assert.ok(bLast > aLast,
            `B ends past A after a full-limit slide (${bLast.toFixed(2)} vs ${aLast.toFixed(2)})`);
    });

    test('the derivations this is fed are the real ones, walked once each', async () => {
        const { a, b } = await derivations();
        assert.ok(a.ok && b.ok, 'both fixtures derive cleanly');
        assert.equal(a.scalars.durationSeconds.toFixed(2), '3.26');
        assert.equal(b.scalars.durationSeconds.toFixed(2), '8.54');
        /* AND NEITHER CARRIES A YIELD, which is why every Out cell on the data page is a
         * dash and no shot is downloaded to find one. */
        assert.equal(a.scalars.yield, null);
        assert.equal(b.scalars.yield, null);
    });
});
