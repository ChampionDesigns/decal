/**
 * The full-screen chart's own two readouts: the stats strip above the plots, and the compliance badge in its header.
 */

/** A number that can be printed. Everything else is an absence. */
const finite = (v) => typeof v === 'number' && Number.isFinite(v);

const UNIT = Object.freeze({
    SECONDS: 's',
    PRESSURE: 'bar',
    FLOW: 'mL' + '/' + 's',
    COMPLIANCE: 'mL' + '/' + 'bar',
    GRAMS: 'g',
});

const PEAK_AVG_JOIN = ' ' + '/' + ' ';

function pair(peak, average, digits) {
    const head = peak.toFixed(digits);
    return finite(average) ? head + PEAK_AVG_JOIN + average.toFixed(digits) : head;
}

export const C_OBSERVED_BIT = 0x08;

export function complianceBadge({ compliance = null, flags = null } = {}) {
    const observed = finite(flags) && (flags & C_OBSERVED_BIT) !== 0 && finite(compliance);
    return observed
        ? { observed: true, value: compliance, text: `${compliance.toFixed(2)} ${UNIT.COMPLIANCE}` }
        : { observed: false, value: null, text: '—' };
}

export function summaryTerms(derivation, badge = null) {
    const s = derivation && derivation.ok === true ? derivation.scalars : null;
    const terms = [];
    if (!s) return Object.freeze(terms);

    if (finite(s.durationSeconds) && s.durationSeconds > 0) {
        terms.push({ key: 'time', label: 'Time', value: `${s.durationSeconds.toFixed(1)} ${UNIT.SECONDS}` });
    }
    if (finite(s.peakPressure)) {
        terms.push({
            key: 'pressure',
            label: 'Peak / avg pressure',
            value: `${pair(s.peakPressure, s.averagePressure, 1)} ${UNIT.PRESSURE}`,
        });
    }
    if (finite(s.peakFlowAfterFirstDrop)) {
        terms.push({
            key: 'flow',
            label: 'Peak / avg flow',
            value: `${pair(s.peakFlowAfterFirstDrop, s.averageFlow, 1)} ${UNIT.FLOW}`,
        });
    }
    if (finite(s.yield) && s.yield > 0) {
        terms.push({ key: 'yield', label: 'Weight out', value: `${s.yield.toFixed(1)} ${UNIT.GRAMS}` });
    }
    if (badge && badge.observed) {
        terms.push({ key: 'compliance', label: 'Compliance', value: badge.text });
    }
    return Object.freeze(terms);
}

export function shotIdentity(derivation, { profileName = '' } = {}) {
    if (!derivation || derivation.ok !== true) return '';
    return typeof profileName === 'string' ? profileName.trim() : '';
}
