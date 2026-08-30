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

/**
 * WHAT THE SUMMARY ALONE CAN ANSWER, per scalar — the R5 gap, as data.
 *
 * The key is a `shot-derivation.js` scalar name and the value is the `annotations` key that
 * carries it on a list row, or `null` for "the summary does not serve this".
 *
 * THE SIX NULLS ARE R5 — six, counted off the table below and off `R5_ABSENT_SCALARS`, which
 * is that same list computed rather than typed. When R5 lands, each becomes the name of the
 * field ReaPrime then serves and the dash fills in — one string per scalar, no code path
 * added, none removed.
 * The three names already spelled are NOT R5 and never were: they are annotations, written
 * by whoever pulled the shot, and they have always ridden on the list payload.
 *
 * `actualYield` deserves its own sentence, because "the list carries no yield" is the
 * claim this table exists to correct. `ShotAnnotations.toJson` (shot_annotations.dart:45-54)
 * emits `actualYield` when it is non-null, and `toJsonWithoutMeasurements` carries the whole
 * annotations object — so a shot whose yield was recorded shows it in the list with ZERO
 * fetches. Every fixture on the capture mock lacks it, which is why the mock exercises the
 * dash on every row and never the number; that is the fixture set's property, not the
 * schema's, and reading the handler is what tells the two apart.
 */
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

/**
 * A scalar as text, or the dash.
 *
 * PRESENCE, NOT TRUTHINESS: `hasReading` is "a finite number", so 0 formats as `0.0 g` and
 * only an absence reaches the dash. The unit rides here rather than in the number so a
 * caller can take `value` and format it itself; nothing downstream parses this string back.
 */
export function scalarText(value, { decimals = 1, unit = null, dash = DEFAULT_DASH } = {}) {
    if (!hasReading(value)) return dash;
    return unit ? `${round(value, decimals)} ${unit}` : round(value, decimals);
}

/* ──────────────────────────────────────────────────────────────────────── the clock */

const pad2 = (n) => String(n).padStart(2, '0');

/**
 * A date, joined rather than interpolated.
 *
 * `[dd, mm].join(DATE_SEPARATOR)` and not a template literal, deliberately: Gate D's
 * constructed-path scan reads every interpolated template containing a slash as a route
 * assembled from fragments, and it is right to — that scan is what catches a hand-spelled
 * endpoint. A date is the one honest slash in the tree, so it is written the one way that
 * is not shaped like an address.
 */
const DATE_SEPARATOR = '/';
const joinDate = (parts) => parts.join(DATE_SEPARATOR);

/**
 * The shot's wall-clock, split so a caller can spend it however its column needs.
 *
 * READ AS LOCAL TIME, DELIBERATELY. ReaPrime writes `timestamp.toIso8601String()` over a
 * local `DateTime`, so the string carries no `Z` and no offset — `2026-08-13T10:15:57.783240`
 * — and a date-time with no offset is local time by the language spec. That is the right
 * reading: "the 10:15 shot" means the one pulled at ten past ten in the kitchen the machine
 * is standing in, and normalising it to UTC would rename every shot on the list.
 *
 * `ok: false` for an unparseable stamp. A shot with no readable time is not a shot at
 * midnight (A7).
 */
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
        /**
         * YYYY/MM/DD — the SUMMARY line's spelling, and it is Slate's own, not a
         * third invention: Slate writes a shot's identity line year-first
         * (#history-date [i=121] "2026/08/15 07:10" on live-ready, history-shotdata
         * and history-viewer alike) while its LIST rows read DD/MM/YY ("15/08/26",
         * the same corpus). Two contexts, two spellings, both Slate's — `dateFull`
         * keeps the list's, this keeps the identity line's.
         */
        dateSummary: joinDate([String(at.getFullYear()), pad2(at.getMonth() + 1), pad2(at.getDate())]),
    });
}

/** The short form: HH:MM, for a legend entry that has to fit beside five others. */
export function shotShortLabel(shot, { dash = DEFAULT_DASH } = {}) {
    const clock = shotClock(shot && shot.timestamp);
    return clock.ok ? clock.time : dash;
}

/**
 * How a shot names itself in a picker.
 *
 * TIME OF DAY FIRST, and the reason is carried over verbatim from the module this replaces:
 * two shots of the same profile on the same morning is the ORDINARY case, and a title labels
 * both identically — which is the one thing a comparison label must not do. The capture
 * mock makes the point sharply: all twenty rows of its list page are
 * "Extractamundo Dos! (2)", so a title-first label names every option the same.
 *
 * The yield is included when the shot carries one, because it is the other thing that tells
 * two shots apart, and it costs nothing — it is on the list payload already.
 */
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

/**
 * The grinder setting the shot was pulled at, or null.
 *
 * IT IS ON THE RECORD AFTER ALL. The band's own note used to say "nothing on the shot
 * record carries a grinder setting", which is true of `ShotRecord`'s own fields and false
 * of the record: ReaPrime stamps every shot with the WORKFLOW as it stood, and the grind
 * lives on that document's `context` (`workflow_context.dart:9`, a `String?`). The old app
 * reads it from exactly there (`history.js:191`), which is how its history line shows a
 * grind at all.
 *
 * A STRING ON THE WIRE, a number here — the same codec `workflow-targets.js` applies to
 * the live rail's own copy of this field, for the same reason.
 */
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

/**
 * What a LIST ROW can say about itself, with no measurements and no fetch.
 *
 * Returns the same twelve-key shape `shot-derivation.js` emits, so the cell that reads
 * `scalars.durationSeconds` reads one field whether the shot is on the chart or is row
 * nineteen of the list. Everything the summary cannot answer is `null`, which is the dash.
 *
 * THE SOURCES ARE NAMED, not merged. `yieldSource: 'annotation'` here is the same value the
 * derivation reports when it takes the same rung, so a caller can always see whether the
 * number was recorded or observed. `dose` keeps `shotDose`'s two named rungs — the dose that
 * went in, or the dose that was asked for — because that is a stated policy and not a
 * fallback, and it says which it used.
 *
 * `keys` IS THE R5 TABLE, AND IT IS AN ARGUMENT SO THE CLAIM ABOUT IT CAN BE RUN. The header
 * says landing R5 is writing one string into `SUMMARY_SCALAR_KEYS` and adding no code path.
 * That is a claim about THIS function and the row model above it, so it is proved by handing
 * them the table R5 would leave behind and watching the dash become a number
 * (`test/shot-summary.test.mjs`, "R5 lands as one field"). Reading the frozen module table
 * instead would leave the only statement of it in prose. `shotScalars`, `shotRow` and
 * `shotRows` pass it through for the same reason; the default is the shipping table, so no
 * caller in the app names it and R5 still lands as one string in one place.
 */
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

/**
 * The scalars for one shot: the walk's where a walk exists, the annotations' where they do.
 *
 * NO WALK IS PERFORMED HERE. `derivation` is whatever the caller already has —
 * `deriveFromRecord` for a stored shot, `deriveFromBuffer` for the live one — and a refused
 * derivation (`ok: false`) is treated as no derivation, because its scalars are twelve nulls
 * and the summary can beat that on three of them.
 *
 * ONE RULE WHERE BOTH CAN ANSWER, and it is the derivation's own: a value ReaPrime RECORDED
 * beats one the skin OBSERVED, and `yieldSource` / `doseSource` say which it was. That is
 * not a fallback chain — both are real quantities and the preference is stated (A7). It also
 * keeps a rating honest: an `enjoyment` written a moment ago rides on the record shell and
 * is not in a walk taken before it, so the annotation is the current one by construction and
 * there is nothing to invalidate and no second walk to take.
 */
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

/**
 * EVERY COLUMN THE HISTORY LIST CAN PAINT, and the ONE place each one's value comes from.
 *
 * This table is the walk-totality claim made checkable: `source` is one of three, `from` is
 * one field, and a column with two sources or a source of its own does not exist. The test
 * asserts every DERIVATION column names a key that is actually on a derivation's scalars, so
 * a renamed scalar fails here rather than silently painting a dash for ever.
 *
 * `grow`, `align`, `unit` and `ink` are `<ui-data-grid>`'s column vocabulary, filled in so
 * the page composes the shipped compound rather than declaring tracks of its own (#34 / H5).
 * No pixel appears in this file.
 *
 * ── `ink`: THE READING ORDER OF THE LIST, RESTORED (parity surface 6) ──────────
 *
 * Slate paints this list in THREE inks and it is a hierarchy, not noise: the timestamp is
 * context, the profile name is the subject, and the outcome numbers sit between them.
 * Measured over all 21 of its rows, every cell of a column agreeing with every other:
 *
 *   CITE history-shotdata .hv-col-date  color = rgb(148, 161, 169) x21  -> --ui-muted
 *   CITE history-shotdata .hv-col-time  color = rgb(148, 161, 169) x21  -> --ui-muted
 *   CITE history-shotdata .hv-col-name  color = rgb(244, 247, 248) x21  -> --ui-text
 *   CITE history-shotdata .hv-col-dur   color = rgb(186, 196, 202) x21  -> --ui-text-2
 *   CITE history-shotdata .hv-col-yield color = rgb(186, 196, 202) x21  -> --ui-text-2
 *
 * Before this row the whole list rendered --ui-text, so eight columns of timestamps and
 * dashes read as loudly as the profile name. The mechanism is the one PHASE_COLUMNS
 * already spends on the weight column's channel ink (`--_ui-data-grid-ink`), so nothing
 * is invented: this table names the token and #34 paints it.
 *
 * THE THREE COLUMNS SLATE HAS NO TWIN FOR — Peak, Flow and Rating — take the OUTCOME
 * ink, because that is what they are: the same family as Shot and Out, which Slate paints
 * --slate-text-2. A guess would have been --ui-text; this is the one reading that keeps
 * Slate's own three-step hierarchy intact rather than adding a fourth step to it.
 *
 * THE COLUMN HEADS ARE NOT INKED HERE, and that is deliberate rather than an omission.
 * Slate's five heads carry their column's ink too, but Decal's head is `.ui-microcap` —
 * one role, one ink, on every grid in the tree including Live's — and spending three inks
 * on one row of heads would break that role everywhere to match five records. The cells
 * are where the hierarchy is read.
 */
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

/**
 * One shot, as the list's row.
 *
 * @param {object} options
 * @param {object|null} options.summary     a `/shots` list item, or a full record's shell
 * @param {object|null} options.derivation  a gate-6 derivation, when one already exists
 * @param {string} [options.dash]
 * @param {object} [options.keys]           the R5 table (see `summaryScalars`); the shipping
 *                                          one by default, so only the R5 test names it
 * @returns {{id, label, shortLabel, title, clock, scalars, cells, hasDerivation}}
 */
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

/**
 * A whole page of list rows.
 *
 * `derivations` is a map of shot id to an already-computed derivation — normally the one or
 * two shots on the chart, and normally empty on first paint. THERE IS NO BRANCH HERE THAT
 * FETCHES ANYTHING: a row with no derivation dashes its three derived columns and that is
 * the finished answer, not a pending one.
 */
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
