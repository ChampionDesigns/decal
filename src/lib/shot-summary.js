// THE HISTORY LIST'S ROW MODEL — B5 / Q17, and the dash.
//
// Wave 5.6, items `hist-shot-list-derivation` and `hist-b5-scalars-q17`. DOM-free: this
// module answers "what does the History list say about this shot", in values, and every
// surface on the screen — a list cell, a summary table, a picker option label — reads the
// answer rather than computing its own.
//
// ============================================================================
// ONE WALK. THIS FILE DOES NOT PARSE MEASUREMENTS AND CANNOT.
// ============================================================================
//
// Gate 6's `shot-derivation.js` is the single parse of the measurements array, and its own
// opening line says so: one walk serving the live chart, the Live foot band and everything
// downstream. History adds no second parse. This module therefore imports NO derivation
// entry point at all — it CONSUMES a derivation its caller already made, and where no
// derivation exists it says so with an absence rather than going and making one.
//
// That is not fastidiousness. `chart-C13` is the same rule from the other end: the old
// chart recovered numbers by parsing them back out of another module's rendered
// `textContent`. A second walk and a DOM scrape are the same defect — a second source of
// truth for a number that already exists — and the fix for both is that there is exactly
// one place the number comes from.
//
// ============================================================================
// Q17, RESOLVED 16 AUGUST: A DASH, NOT A DOWNLOAD
// ============================================================================
//
// The list payload does not carry duration, peak pressure or average flow. Verified at the
// handler, not assumed: `ShotRecord.toJsonWithoutMeasurements` (shot_record.dart:49-59)
// emits id, timestamp, workflow, annotations, stopReason and the two legacy aliases, and
// `ShotRecord.toJson` (:36-47) adds only `measurements`. There is no duration in either, in
// any spelling.
//
// The old skin's answer was `fillMissingOutcomes`: for every row missing a number, download
// the whole ~221 KB shot record, sequentially, to print "28 s" in a list cell. That is not
// built here and there is no code path to it. B5 governs: the scalars are computed in the
// skin from the one walk WHERE A WALK EXISTS — the shots actually on the chart — and where
// no walk exists the cell shows a dash.
//
// R5 is the upstream ask that would serve these fields, and it is excluded from this run.
// `SUMMARY_SCALAR_KEYS` below is what makes its landing a one-field change: each scalar
// names the summary key that carries it, or `null` for "nothing serves this yet". R5 lands
// as a string in that table. There is no machinery to delete because none was built.
//
// ============================================================================
// ABSENCE IS ABSENCE
// ============================================================================
//
// Every presence test here is `hasReading` — a finite number — never truthiness. The two
// defects that rule exists for are both in the old Out column: a `0.0` that came from a
// scale-less shot's total passed a truthiness guard and printed as a measurement, and the
// absent value printed as the string `'0.0'` where the module's own docblock promised a
// dash. Zero is a reading and prints as one; absent is absent and prints as the dash.
//
// The dash STRING is the caller's, defaulting to nothing: this module is i18n-free by
// construction (D2), and the one mark on the page belongs to `units.js` `NO_READING_MARK`
// and `ui-data-grid`'s `DEFAULT_DATA_GRID_DASH`, which are the same character. A profile
// with no title reads `null` here and is named by whichever component renders it, in that
// component's translated words.

import { hasReading } from '../data/reading.js';
import { readStoredShot, shotDose } from '../data/rea-shot-record.js';

/** The one mark, when the caller states none. Same character as `units.js` NO_READING_MARK. */
export const DEFAULT_DASH = '—';

/** Where a cell's number comes from. Three sources, and none of them is the DOM. */
export const CELL_SOURCE = Object.freeze({
    /** The record shell: id, timestamp, workflow. Served on the list payload. */
    RECORD: 'record',
    /** `ShotAnnotations`. Served on the list payload, when the shot carries one. */
    ANNOTATION: 'annotation',
    /** Gate 6's scalars. Needs the measurements array, so needs the one walk. */
    DERIVATION: 'derivation',
});

export const SUMMARY_SCALAR_KEYS = Object.freeze({
    /** R5. `shot_record.dart` emits no duration in either toJson. */
    durationSeconds: null,
    /** R5. Nothing computes a peak server-side. */
    peakPressure: null,
    /** R5. */
    averageFlow: null,
    /** R5. */
    averagePressure: null,
    /** R5. */
    peakFlowAfterFirstDrop: null,
    /** R5. Needs the weight channel, which only the walk has. */
    timeToFirstDrop: null,
    /** SERVED. ReaPrime's own nullable double, its own DB column. */
    yield: 'actualYield',
    /** SERVED. */
    enjoyment: 'enjoyment',
    /** SERVED, but through `shotDose`'s two named rungs — see `summaryScalars`. */
    dose: 'actualDoseWeight',
});

/** Scalars a summary can never answer today. Their dash is R5's shape, stated once. */
export const R5_ABSENT_SCALARS = Object.freeze(
    Object.keys(SUMMARY_SCALAR_KEYS).filter((key) => SUMMARY_SCALAR_KEYS[key] === null),
);

/* ─────────────────────────────────────────────────────────────────────── formatting */

const round = (value, decimals) => {
    const factor = 10 ** decimals;
    return (Math.round(value * factor) / factor).toFixed(decimals);
};

export function scalarText(value, { decimals = 1, unit = null, dash = DEFAULT_DASH } = {}) {
    if (!hasReading(value)) return dash;
    return unit ? `${round(value, decimals)} ${unit}` : round(value, decimals);
}

/* ──────────────────────────────────────────────────────────────────────── the clock */

const pad2 = (n) => String(n).padStart(2, '0');

const DATE_SEPARATOR = '/';
const joinDate = (parts) => parts.join(DATE_SEPARATOR);

export function shotClock(timestamp) {
    const at = new Date(timestamp);
    if (Number.isNaN(at.getTime())) {
        return Object.freeze({ ok: false, at: null, time: null, date: null, dateFull: null, dateSummary: null });
    }
    return Object.freeze({
        ok: true,
        at,
        /** HH:MM. The one a comparison legend has room for. */
        time: `${pad2(at.getHours())}:${pad2(at.getMinutes())}`,
        /** DD/MM. */
        date: joinDate([pad2(at.getDate()), pad2(at.getMonth() + 1)]),
        /** DD/MM/YY, for a list that spans more than a morning. */
        dateFull: joinDate([pad2(at.getDate()), pad2(at.getMonth() + 1), String(at.getFullYear()).slice(2)]),
        dateSummary: joinDate([String(at.getFullYear()), pad2(at.getMonth() + 1), pad2(at.getDate())]),
    });
}

/** The short form: HH:MM, for a legend entry that has to fit beside five others. */
export function shotShortLabel(shot, { dash = DEFAULT_DASH } = {}) {
    const clock = shotClock(shot && shot.timestamp);
    return clock.ok ? clock.time : dash;
}

export function shotOptionLabel(shot, { dash = DEFAULT_DASH, separator = '  ·  ' } = {}) {
    const clock = shotClock(shot && shot.timestamp);
    const stamp = clock.ok ? `${clock.date} ${clock.time}` : dash;
    const title = shotTitle(shot);
    const grams = readAnnotation(shot, 'actualYield');
    const bits = [stamp];
    if (title) bits.push(title);
    if (hasReading(grams)) bits.push(`${round(grams, 1)} g`);
    return bits.join(separator);
}

/** The profile's title, or `null`. Never a string this module chose — D2 (see the header). */
export function shotTitle(shot) {
    const title = shot && shot.workflow && shot.workflow.profile
        ? shot.workflow.profile.title : null;
    return typeof title === 'string' && title !== '' ? title : null;
}

export function shotGrind(shot) {
    const context = shot && shot.workflow && shot.workflow.context ? shot.workflow.context : null;
    const raw = context ? context.grinderSetting : null;
    if (raw === null || raw === undefined || raw === '') return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
}

/* ─────────────────────────────────────────────────────────────────────── the scalars */

function readAnnotation(shot, key) {
    const annotations = shot && typeof shot === 'object' && shot.annotations
        && typeof shot.annotations === 'object' ? shot.annotations : null;
    if (!annotations || !Object.hasOwn(annotations, key)) return null;
    const value = annotations[key];
    return hasReading(value) ? value : null;
}

/** The full scalar shape, all twelve keys null. The same shape a refused derivation has. */
export function emptyScalars() {
    return Object.freeze({
        durationSeconds: null,
        dose: null,
        doseSource: null,
        yield: null,
        yieldSource: null,
        ratio: null,
        timeToFirstDrop: null,
        averageFlow: null,
        peakFlowAfterFirstDrop: null,
        peakPressure: null,
        averagePressure: null,
        enjoyment: null,
    });
}

export function summaryScalars(shot, { keys = SUMMARY_SCALAR_KEYS } = {}) {
    if (!shot || typeof shot !== 'object') return emptyScalars();
    const stored = readStoredShot(shot);
    const dose = shotDose(stored);
    const doseValue = hasReading(dose.value) ? dose.value : null;

    const scalars = { ...emptyScalars() };
    for (const [scalar, key] of Object.entries(keys)) {
        if (key === null || scalar === 'dose') continue;
        // The shape is the derivation's twelve keys and a substituted table cannot widen
        // it: a name that is not a scalar is a table typo, and a thirteenth key would be
        // a column nothing paints.
        if (!Object.hasOwn(scalars, scalar)) continue;
        scalars[scalar] = readAnnotation(shot, key);
    }
    scalars.dose = doseValue;
    scalars.doseSource = dose.source;
    scalars.yieldSource = scalars.yield === null ? null : 'annotation';
    scalars.ratio = doseValue !== null && scalars.yield !== null && doseValue > 0
        ? scalars.yield / doseValue
        : null;
    return Object.freeze(scalars);
}

export function shotScalars({ summary = null, derivation = null, keys = SUMMARY_SCALAR_KEYS } = {}) {
    const walked = derivation && derivation.ok === true && derivation.scalars
        ? derivation.scalars : null;
    const stated = summaryScalars(summary, { keys });
    if (!walked) return stated;

    const merged = { ...walked };
    for (const [scalar, key] of Object.entries(keys)) {
        if (key === null) continue;
        if (stated[scalar] !== null) merged[scalar] = stated[scalar];
    }
    if (stated.yield !== null) merged.yieldSource = 'annotation';
    if (stated.dose !== null) merged.doseSource = stated.doseSource;
    merged.ratio = merged.dose !== null && merged.yield !== null && merged.dose > 0
        ? merged.yield / merged.dose
        : null;
    return Object.freeze(merged);
}

/* ─────────────────────────────────────────────────────────────────────── the columns */

export const HISTORY_COLUMNS = Object.freeze([
    Object.freeze({
        key: 'date', source: CELL_SOURCE.RECORD, from: 'timestamp',
        align: 'start', grow: 1, unit: null, decimals: null, ink: 'var(--ui-muted)',
    }),
    Object.freeze({
        key: 'time', source: CELL_SOURCE.RECORD, from: 'timestamp',
        align: 'start', grow: 1, unit: null, decimals: null, ink: 'var(--ui-muted)',
    }),
    Object.freeze({
        key: 'profile', source: CELL_SOURCE.RECORD, from: 'workflow.profile.title',
        align: 'start', grow: 3, unit: null, decimals: null, ink: null,
    }),
    Object.freeze({
        key: 'duration', source: CELL_SOURCE.DERIVATION, from: 'scalars.durationSeconds',
        align: 'end', grow: 1, unit: 's', decimals: 0, ink: 'var(--ui-text-2)',
    }),
    Object.freeze({
        key: 'yield', source: CELL_SOURCE.ANNOTATION, from: 'scalars.yield',
        align: 'end', grow: 1, unit: 'g', decimals: 1, ink: 'var(--ui-text-2)',
    }),
    Object.freeze({
        key: 'peakPressure', source: CELL_SOURCE.DERIVATION, from: 'scalars.peakPressure',
        align: 'end', grow: 1, unit: 'bar', decimals: 1, ink: 'var(--ui-text-2)',
    }),
    Object.freeze({
        key: 'averageFlow', source: CELL_SOURCE.DERIVATION, from: 'scalars.averageFlow',
        align: 'end', grow: 1, unit: 'mL/s', decimals: 1, ink: 'var(--ui-text-2)',
    }),
    Object.freeze({
        key: 'enjoyment', source: CELL_SOURCE.ANNOTATION, from: 'scalars.enjoyment',
        align: 'end', grow: 1, unit: null, decimals: 0, ink: 'var(--ui-text-2)',
    }),
]);

/** The scalar a column reads, or null for the two that read the record shell. */
export function columnScalarKey(column) {
    return column.from.startsWith('scalars.') ? column.from.slice('scalars.'.length) : null;
}

export function shotRow({
    summary = null, derivation = null, dash = DEFAULT_DASH, keys = SUMMARY_SCALAR_KEYS,
} = {}) {
    const scalars = shotScalars({ summary, derivation, keys });
    const clock = shotClock(summary && summary.timestamp);
    const title = shotTitle(summary);
    const cells = {};
    for (const column of HISTORY_COLUMNS) {
        const scalarKey = columnScalarKey(column);
        if (scalarKey !== null) {
            const value = scalars[scalarKey] ?? null;
            cells[column.key] = Object.freeze({
                value: hasReading(value) ? value : null,
                text: scalarText(value, { decimals: column.decimals ?? 1, unit: column.unit, dash }),
                present: hasReading(value),
                source: column.source,
            });
            continue;
        }
        const text = column.key === 'time' ? (clock.ok ? clock.time : dash)
            : column.key === 'date' ? (clock.ok ? clock.dateFull : dash)
                : (title ?? dash);
        cells[column.key] = Object.freeze({
            value: column.key === 'profile' ? title : (clock.ok ? clock.at : null),
            text,
            present: column.key === 'profile' ? title !== null : clock.ok,
            source: column.source,
        });
    }
    return Object.freeze({
        id: summary && typeof summary.id === 'string' ? summary.id : null,
        label: shotOptionLabel(summary, { dash }),
        shortLabel: shotShortLabel(summary, { dash }),
        title,
        clock,
        scalars,
        cells: Object.freeze(cells),
        /** Whether these scalars came from the one walk. False is not a failure. */
        hasDerivation: !!(derivation && derivation.ok === true),
    });
}

export function shotRows(items, { derivations = null, dash = DEFAULT_DASH, keys = SUMMARY_SCALAR_KEYS } = {}) {
    const list = Array.isArray(items) ? items : [];
    return Object.freeze(list.map((summary) => shotRow({
        summary,
        derivation: derivations && summary && typeof summary.id === 'string'
            ? derivations[summary.id] ?? null
            : null,
        dash,
        keys,
    })));
}
