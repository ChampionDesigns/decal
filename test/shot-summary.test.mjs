/**
 *.6, items hist-shot-list-derivation / hist-b5-scalars-q17.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    HISTORY_COLUMNS,
    CELL_SOURCE,
    SUMMARY_SCALAR_KEYS,
    R5_ABSENT_SCALARS,
    DEFAULT_DASH,
    columnScalarKey,
    emptyScalars,
    scalarText,
    shotClock,
    shotOptionLabel,
    shotShortLabel,
    shotRow,
    shotRows,
    shotScalars,
    summaryScalars,
    shotTitle,
    shotGrind,
} from '../src/lib/shot-summary.js';
import { deriveFromRecord, emptyShotDerivation } from '../src/lib/shot-derivation.js';
import { createShotsStore } from '../src/stores/shots-store.js';

const REPO = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const fixture = (name) => JSON.parse(readFileSync(path.join(REPO, 'tools/rea-fixtures', name), 'utf8'));

const PAGE = fixture('api__v1__shots~limit=20~offset=0~order=desc.json');
const RECORD_SHORT = fixture('api__v1__shots__5fc3f631-6b18-471b-9800-00d552dbbecb.json');
const RECORD_LONG = fixture('api__v1__shots__cd020a51-f353-4ffb-8389-72c931640181.json');

/** A transport that records every request and never invents an answer for an unknown one. */
function recordingTransport(answers) {
    const seen = [];
    return {
        seen,
        request: async (reqPath, options = {}) => {
            const method = options.method ?? 'GET';
            seen.push({ path: reqPath, method, query: options.query ?? null, body: options.body ?? null });
            const key = `${method} ${reqPath}`;
            if (!Object.hasOwn(answers, key)) {
                throw new Error(`the test transport has no answer for ${key} — an unexpected `
                    + 'request is the finding, not something to paper over');
            }
            return answers[key];
        },
    };
}

const listAnswer = { ok: true, status: 200, data: PAGE, notModified: false, etag: '"abc"' };

/* ═══════════════════════════════════════════════════════════════════ 1. walk totality */

describe('every history column resolves to exactly one source', () => {
    test('the column table names one source and one field per column', () => {
        const sources = new Set(Object.values(CELL_SOURCE));
        const keys = new Set();
        for (const column of HISTORY_COLUMNS) {
            assert.ok(sources.has(column.source), `${column.key}: unknown source ${column.source}`);
            assert.equal(typeof column.from, 'string');
            assert.ok(column.from.length > 0, `${column.key}: no field named`);
            assert.ok(!keys.has(column.key), `${column.key}: duplicate column`);
            keys.add(column.key);
        }
        assert.ok(HISTORY_COLUMNS.length >= 6);
    });

    test('every scalar column names a key that a real derivation actually emits', () => {
        const emitted = new Set(Object.keys(emptyShotDerivation().scalars));
        assert.deepEqual([...emitted].sort(), Object.keys(emptyScalars()).sort(),
            'the summary shape and the derivation shape must be the same twelve keys, or a '
            + 'cell would read one field on the chart and another in the list');
        for (const column of HISTORY_COLUMNS) {
            const scalar = columnScalarKey(column);
            if (scalar === null) continue;
            assert.ok(emitted.has(scalar),
                `${column.key} reads scalars.${scalar}, which gate 6 does not emit — a renamed `
                + 'scalar must fail here rather than paint a dash for ever');
        }
    });

    test('the columns needing the walk are exactly the ones a summary cannot answer', () => {
        const needsWalk = HISTORY_COLUMNS
            .filter((c) => c.source === CELL_SOURCE.DERIVATION)
            .map((c) => columnScalarKey(c));
        for (const scalar of needsWalk) {
            assert.equal(SUMMARY_SCALAR_KEYS[scalar] ?? null, null,
                `${scalar} is marked as needing the walk but the summary serves it`);
            assert.ok(R5_ABSENT_SCALARS.includes(scalar));
        }
        const served = HISTORY_COLUMNS
            .filter((c) => c.source === CELL_SOURCE.ANNOTATION)
            .map((c) => columnScalarKey(c));
        for (const scalar of served) {
            assert.equal(typeof SUMMARY_SCALAR_KEYS[scalar], 'string',
                `${scalar} is marked as served by the summary and names no field`);
        }
        assert.deepEqual(needsWalk.sort(), ['averageFlow', 'durationSeconds', 'peakPressure']);
        assert.deepEqual(served.sort(), ['enjoyment', 'yield']);
    });

    test('one record is walked ONCE, however many surfaces read it', async () => {
        let walks = 0;
        const transport = recordingTransport({
            'GET /shots': listAnswer,
            'GET /shots/5fc3f631-6b18-471b-9800-00d552dbbecb': {
                ok: true, status: 200, data: RECORD_SHORT, notModified: false,
            },
        });
        const store = createShotsStore({
            transport,
            derive: (record) => { walks += 1; return deriveFromRecord(record); },
        });
        await store.readPage();
        await store.loadShot(RECORD_SHORT.id);
        // Three surfaces read the same shot: the list row, the picker label, the summary.
        const state = store.get();
        const row = state.rows.find((r) => r.id === RECORD_SHORT.id);
        shotOptionLabel(PAGE.items.find((i) => i.id === RECORD_SHORT.id));
        shotScalars({ summary: PAGE.items[1], derivation: store.derivationOf(RECORD_SHORT.id) });
        // …and the same shot is picked into the other slot.
        await store.loadShot(RECORD_SHORT.id);

        assert.equal(walks, 1, 'a second parse of the measurements array is the defect');
        assert.equal(state.walks, 1);
        assert.ok(row.hasDerivation, 'the picked shot reads the walk it already has');
        assert.ok(row.cells.duration.present);
    });

    test('nothing in this path recovers a number from rendered text (chart-C13)', () => {
        assert.equal(typeof globalThis.document, 'undefined',
            'this suite must run with no DOM at all, or the claim means nothing');
        const row = shotRow({ summary: PAGE.items[0] });
        assert.equal(typeof row.cells.duration.text, 'string');
        assert.equal(row.cells.duration.value, null,
            'the value is a number or null — never a string a later reader would parse back');
    });
});

/* ══════════════════════════════════════════════════════════ 2. the dash truth table */

describe('the dash truth table', () => {
    test('the mock has no actualYield anywhere, so the dash is the only path it exercises', () => {
        for (const item of PAGE.items) {
            assert.equal(item.annotations?.actualYield, undefined,
                `${item.id} grew an actualYield — the scaleless-fixture claim needs re-reading`);
        }
        for (const record of [RECORD_SHORT, RECORD_LONG]) {
            assert.equal(record.annotations?.actualYield, undefined);
        }
        // …and no list item carries duration in any spelling, which is R5 at the fixture.
        for (const item of PAGE.items) {
            assert.equal(item.duration, undefined);
            assert.equal(item.durationSeconds, undefined);
            assert.equal(item.measurements, undefined);
        }
    });

    test('a scaleless list row dashes the three R5 columns and prints the two it has', () => {
        const row = shotRow({ summary: PAGE.items[0] });
        assert.equal(row.cells.duration.text, DEFAULT_DASH);
        assert.equal(row.cells.duration.present, false);
        assert.equal(row.cells.peakPressure.text, DEFAULT_DASH);
        assert.equal(row.cells.averageFlow.text, DEFAULT_DASH);
        assert.equal(row.cells.yield.text, DEFAULT_DASH, 'no fixture records a yield');
        // The two the summary can always answer.
        assert.equal(row.cells.time.text, shotClock(PAGE.items[0].timestamp).time);
        assert.equal(row.cells.profile.text, 'Extractamundo Dos! (2)');
    });

    test('THE FETCH COUNT WHILE TWENTY ROWS PAINT IS EXACTLY ZERO', async () => {
        const transport = recordingTransport({ 'GET /shots': listAnswer });
        const store = createShotsStore({ transport });
        await store.readPage();
        const state = store.get();
        assert.equal(state.rows.length, 20);
        // Every row paints, and every one of them dashes its derived columns.
        const dashed = state.rows.filter((r) => r.cells.duration.text === DEFAULT_DASH);
        assert.equal(dashed.length, 20);
        // …and not one shot was downloaded to make that happen.
        assert.equal(state.reads.byId, 0, 'fillMissingOutcomes is not built and has no path');
        assert.equal(state.reads.perRow, 0);
        assert.equal(state.walks, 0, 'a list that has parsed no measurements is the point');
        assert.equal(transport.seen.length, 1, 'one request paints the whole list');
        assert.equal(transport.seen[0].path, '/shots');
    });

    test('absence is absence: no 0.0 sentinel, and zero is a reading', () => {
        assert.equal(scalarText(null, { unit: 'g' }), DEFAULT_DASH);
        assert.equal(scalarText(undefined, { unit: 'g' }), DEFAULT_DASH);
        assert.equal(scalarText(NaN, { unit: 'g' }), DEFAULT_DASH);
        assert.equal(scalarText(Infinity, { unit: 'g' }), DEFAULT_DASH);
        // A truthiness guard would dash this one, and a zero IS a measurement.
        assert.equal(scalarText(0, { unit: 'g', decimals: 1 }), '0.0 g');
        assert.equal(scalarText(0, { unit: 's', decimals: 0 }), '0 s');
        assert.notEqual(scalarText(null, { unit: 'g' }), '0.0 g');
    });

    test('a zero-valued annotation paints as a measurement, not as an absence', () => {
        const zeroYield = { ...PAGE.items[0], annotations: { actualDoseWeight: 17, actualYield: 0 } };
        const row = shotRow({ summary: zeroYield });
        assert.equal(row.cells.yield.present, true);
        assert.equal(row.cells.yield.value, 0);
        assert.equal(row.cells.yield.text, '0.0 g');
    });

    test('the dash string is the caller\'s, so there is one mark on the page', () => {
        const row = shotRow({ summary: PAGE.items[0], dash: '·no·' });
        assert.equal(row.cells.duration.text, '·no·');
        assert.equal(shotShortLabel({ timestamp: 'not a date' }, { dash: '·no·' }), '·no·');
    });

    test('a walked shot fills the same cells in, with no shape change', () => {
        const derivation = deriveFromRecord(RECORD_LONG);
        assert.equal(derivation.ok, true);
        const withWalk = shotRow({ summary: RECORD_LONG, derivation });
        const without = shotRow({ summary: RECORD_LONG });
        assert.deepEqual(Object.keys(withWalk.cells), Object.keys(without.cells),
            'the same cells exist either way — the list does not grow a column when a shot loads');
        assert.equal(without.cells.duration.text, DEFAULT_DASH);
        assert.equal(withWalk.cells.duration.present, true);
        assert.equal(withWalk.cells.duration.text, '22 s');
        assert.equal(withWalk.cells.peakPressure.text, '2.3 bar');
        assert.equal(withWalk.cells.averageFlow.text, '3.6 mL/s');
        assert.equal(withWalk.cells.yield.text, DEFAULT_DASH);
        assert.equal(withWalk.scalars.yieldSource, null);
    });

    test('a refused derivation is treated as no derivation, never as twelve zeroes', () => {
        const refusal = emptyShotDerivation('measurementsNotServed');
        const row = shotRow({ summary: PAGE.items[0], derivation: refusal });
        assert.equal(row.hasDerivation, false);
        assert.equal(row.cells.duration.text, DEFAULT_DASH);
        assert.equal(row.scalars.dose, 17, 'the summary still answers what it can');
    });
});

/* ══════════════════════════════════════════════════════════════ 3. R5, one field away */

describe('R5 lands as one field, with nothing to delete', () => {
    test('the four R5 scalars are the ones with no summary field named', () => {
        assert.ok(R5_ABSENT_SCALARS.includes('durationSeconds'));
        assert.ok(R5_ABSENT_SCALARS.includes('peakPressure'));
        assert.ok(R5_ABSENT_SCALARS.includes('averageFlow'));
        assert.ok(!R5_ABSENT_SCALARS.includes('yield'), 'actualYield IS served on the summary');
        assert.ok(!R5_ABSENT_SCALARS.includes('enjoyment'));
    });

    test('writing a field name into the table fills the dash in — no other change', () => {
        const asIfR5 = { ...PAGE.items[0], annotations: { ...PAGE.items[0].annotations, durationSeconds: 28 } };
        assert.equal(shotRow({ summary: asIfR5 }).cells.duration.text, DEFAULT_DASH,
            'today the reader does not know that name, so the cell is honestly a dash');

        const table = { ...SUMMARY_SCALAR_KEYS, durationSeconds: 'durationSeconds' };
        assert.deepEqual(
            Object.entries(table).filter(([scalar, field]) => SUMMARY_SCALAR_KEYS[scalar] !== field),
            [['durationSeconds', 'durationSeconds']],
            'exactly one entry differs from the shipping table, and it is a string',
        );
        assert.equal(Object.keys(table).length, Object.keys(SUMMARY_SCALAR_KEYS).length,
            'nothing added to the table either');

        const row = shotRow({ summary: asIfR5, keys: table });
        assert.equal(row.cells.duration.text, '28 s');
        assert.equal(row.cells.duration.value, 28);
        assert.equal(row.cells.duration.present, true);
        assert.equal(row.cells.duration.source, CELL_SOURCE.DERIVATION,
            'the column definition did not move — only where its value was found');
        assert.equal(row.scalars.durationSeconds, 28);
        assert.equal(row.hasDerivation, false, 'and no walk was taken to fill it: there is none');

        const asShipped = shotRow({ summary: asIfR5 });
        for (const column of HISTORY_COLUMNS) {
            if (column.key === 'duration') continue;
            assert.deepEqual(row.cells[column.key], asShipped.cells[column.key], column.key);
        }
        assert.equal(asShipped.cells.duration.text, DEFAULT_DASH);

        const [pageRow] = shotRows([asIfR5], { keys: table });
        assert.equal(pageRow.cells.duration.text, '28 s');

        // The reader is still ONE LOOKUP in that table — no code path was added to reach it.
        assert.equal(asIfR5.annotations[table.durationSeconds], 28);
        assert.equal(scalarText(asIfR5.annotations[table.durationSeconds], { decimals: 0, unit: 's' }), '28 s');
    });

    test('the summary answers dose, yield and enjoyment today with no fetch at all', () => {
        const rated = {
            ...PAGE.items[0],
            annotations: { actualDoseWeight: 18, actualYield: 36, enjoyment: 72 },
        };
        const scalars = summaryScalars(rated);
        assert.equal(scalars.dose, 18);
        assert.equal(scalars.doseSource, 'actual');
        assert.equal(scalars.yield, 36);
        assert.equal(scalars.yieldSource, 'annotation');
        assert.equal(scalars.enjoyment, 72);
        assert.equal(scalars.ratio, 2);
        // And the R5 six stay null, which is the dash.
        for (const scalar of R5_ABSENT_SCALARS) assert.equal(scalars[scalar], null);
    });

    test('the dose keeps its two named rungs and says which it used', () => {
        const targetOnly = { ...PAGE.items[0], annotations: {} };
        const scalars = summaryScalars(targetOnly);
        assert.equal(scalars.dose, 17, 'the workflow context carries targetDoseWeight');
        assert.equal(scalars.doseSource, 'target');
    });

    test('a recorded annotation beats an observation, and the source says so', () => {
        const derivation = deriveFromRecord(RECORD_LONG);
        const annotated = { ...RECORD_LONG, annotations: { ...RECORD_LONG.annotations, actualYield: 36 } };
        const merged = shotScalars({ summary: annotated, derivation });
        assert.equal(merged.yield, 36);
        assert.equal(merged.yieldSource, 'annotation');
        // The walk still owns everything the summary cannot answer.
        assert.equal(merged.peakPressure, derivation.scalars.peakPressure);
        assert.equal(merged.durationSeconds, derivation.scalars.durationSeconds);
    });
});

/* ═══════════════════════════════════════════════════════════ time-of-day-first labels */

describe('a shot names itself by its time of day first', () => {
    test('the stamp precedes the title, because the title labels every shot the same', () => {
        const titles = new Set(PAGE.items.map((i) => i.workflow?.profile?.title));
        assert.equal(titles.size, 1,
            'all twenty fixture rows share one profile title — a title-first label names them '
            + 'all identically, which is the one thing a comparison label must not do');
        const label = shotOptionLabel(PAGE.items[0]);
        const clock = shotClock(PAGE.items[0].timestamp);
        assert.ok(label.startsWith(`${clock.date} ${clock.time}`), label);
        assert.ok(label.indexOf(clock.time) < label.indexOf('Extractamundo'), label);
    });

    test('the short form is HH:MM, for a legend beside five others', () => {
        assert.match(shotShortLabel(PAGE.items[0]), /^\d{2}:\d{2}$/);
    });

    test('the summary spelling is year-first and the list spelling is not — both are Slate\'s', () => {
        const clock = shotClock(PAGE.items[0].timestamp);
        assert.match(clock.dateSummary, /^\d{4}\/\d{2}\/\d{2}$/);
        assert.match(clock.dateFull, /^\d{2}\/\d{2}\/\d{2}$/);
        const at = new Date(PAGE.items[0].timestamp);
        assert.equal(clock.dateSummary.slice(0, 4), String(at.getFullYear()));
        assert.ok(clock.dateSummary.endsWith(clock.date.split('/').reverse().join('/')),
            'one date, two orders — the fields must agree');
    });

    test('the stamp is read as local wall-clock, because ReaPrime writes no offset', () => {
        const stamp = PAGE.items[0].timestamp;
        assert.ok(!/[Zz]$|[+-]\d{2}:\d{2}$/.test(stamp),
            'the fixture timestamp carries no zone; if that changes, this reading must be re-made');
        const at = new Date(stamp);
        assert.equal(shotClock(stamp).time,
            `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`);
    });

    test('an unreadable stamp is an absence, never a shot at midnight', () => {
        const clock = shotClock('not a date');
        assert.equal(clock.ok, false);
        assert.equal(clock.time, null);
        const row = shotRow({ summary: { id: 'x', timestamp: 'not a date' } });
        assert.equal(row.cells.time.text, DEFAULT_DASH);
        assert.equal(row.cells.time.present, false);
    });

    test('an untitled profile is null here and named by whoever renders it (D2)', () => {
        assert.equal(shotTitle({ workflow: { profile: {} } }), null);
        assert.equal(shotTitle({ workflow: { profile: { title: '' } } }), null);
        const row = shotRow({ summary: { id: 'x', timestamp: PAGE.items[0].timestamp } });
        assert.equal(row.cells.profile.value, null,
            'this module chooses no display string, so there is nothing here to translate');
    });

    test('a whole page of rows is one call and holds its order', () => {
        const rows = shotRows(PAGE.items);
        assert.equal(rows.length, 20);
        assert.deepEqual(rows.map((r) => r.id), PAGE.items.map((i) => i.id));
        assert.deepEqual(shotRows(null), []);
        assert.deepEqual(shotRows(undefined), []);
    });
});

/* ════════════════════════════════════ the grind the shot was pulled at ═══════════ */

describe('shotGrind — it is on the record after all', () => {
    const shot = (context) => ({ id: 's', workflow: { profile: { title: 'A' }, context } });

    test('a string on the wire becomes a number here', () => {
        assert.equal(shotGrind(shot({ grinderSetting: '8.50' })), 8.5);
        assert.equal(shotGrind(shot({ grinderSetting: 9 })), 9);
    });

    test('a shot pulled before anybody set one is ABSENT, not zero', () => {
        assert.equal(shotGrind(shot({ targetDoseWeight: 18 })), null);
        assert.equal(shotGrind(shot({ grinderSetting: null })), null);
        assert.equal(shotGrind(shot({ grinderSetting: '' })), null);
        assert.equal(shotGrind(shot({ grinderSetting: 'fine' })), null);
        assert.equal(shotGrind({ id: 's' }), null);
        assert.equal(shotGrind(null), null);
    });

    test('zero IS a reading — a grinder set to 0 is not a grinder nobody set', () => {
        assert.equal(shotGrind(shot({ grinderSetting: '0.00' })), 0);
    });
});
