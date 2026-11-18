import { de1EmulationName, profileRunsAsDe1 } from './de1-emulation.js';
import { t } from './i18n.js';

export function shownProfileName(profile, capabilities, fallback = '') {
    const title = profile && typeof profile.title === 'string' && profile.title !== ''
        ? profile.title : fallback;
    return de1EmulationName(title, profileRunsAsDe1(profile, capabilities));
}

export function markedFavourites(entries, recordFor, capabilities) {
    if (!Array.isArray(entries)) return entries;
    return entries.map((entry) => {
        if (!entry || typeof entry !== 'object') return entry;
        const record = typeof recordFor === 'function' ? recordFor(entry.value) : null;
        if (!profileRunsAsDe1(record ? record.profile : null, capabilities)) return entry;
        return {
            ...entry,
            badge: t('DE1'),
            a11y: t('{name}, DE1 emulation', { name: entry.name }),
        };
    });
}
