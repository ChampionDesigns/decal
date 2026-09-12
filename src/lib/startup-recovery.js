/**
 * What the shell can offer when a screen module fails to load: the text of the
 * failure, and whether leaving for the host's own screen is available here.
 */
import { hostServesThisPage, leaveSkin } from './host-exit.js';

export function startupFailureDetails(error) {
    return [error?.specifier, error?.message].filter((value) => value !== null && value !== undefined && value !== '')
        .map(String).join('\n');
}

export function canOpenDashboard(win) {
    return Boolean(win?.__DECENT_HOST__ && hostServesThisPage(win));
}

export function openDashboard(win) {
    return canOpenDashboard(win) && leaveSkin(win);
}
