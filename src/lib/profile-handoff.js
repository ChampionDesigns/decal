/**
 * The profile generator handoff: where the generator opens, and the way back to Decal.
 * The embedded host's native Back leaves for the Dashboard rather than stepping through
 * the WebView's page history, so the way back depends on where it opened.
 */
import { routeById } from '../data/rea-routes.js';

const PLUGIN_COLLECTION_PATH = routeById('getPlugins').path;

/** How the generator will be shown, and the sentence that says how to come back. */
export function generatorHandoff(win, destination) {
    const host = win?.__DECENT_HOST__;
    if (!host) return { mode: 'browser', returnKey: 'Close the generator tab to return to your selection in Decal.' };
    let url;
    try { url = new URL(destination, win?.location?.href); } catch { url = null; }
    const embedded = url?.protocol === 'http:' && url.hostname === 'localhost'
        && (url.port === '3000' || (url.port === '8080' && url.pathname.startsWith(PLUGIN_COLLECTION_PATH + '/')));
    if (!embedded) return { mode: 'native', surface: 'external',
        returnKey: 'When finished in the browser, switch back to Decal.' };
    const instructions = {
        ios: 'Swipe right from the left edge to return to the Dashboard, then reopen Decal.',
        android: 'Use the system Back button to return to the Dashboard, then reopen Decal.',
        macos: 'Press ⌘D or choose View → Back to Dashboard, then reopen Decal.',
        windows: 'Press Alt+Backspace to return to the Dashboard, then reopen Decal.',
    };
    return { mode: 'native', surface: 'embedded', returnKey: instructions[host.platform]
        ?? 'Use the app’s back navigation to return to the Dashboard, then reopen Decal.' };
}

/** True when the generator was navigated to; false when the destination is unusable. */
export function openProfileGenerator(win, destination) {
    if (typeof destination !== 'string' || destination.trim() === '') return false;
    let url;
    try { url = new URL(destination, win?.location?.href); } catch { return false; }
    if (!['http:', 'https:'].includes(url.protocol)) return false;
    if (generatorHandoff(win, destination).mode === 'native') {
        try { win.location.assign(url.href); return true; } catch { return false; }
    }
    // Detach the opener before any external document can execute. Opening with
    // noopener directly can return null on success, hiding a blocked-popup result.
    let opened;
    try {
        opened = win.open('about:blank', '_blank');
        if (!opened) return false;
        opened.opener = null;
        opened.location.replace(url.href);
        return true;
    } catch {
        try { opened?.close(); } catch { /* The opener remains on Decal. */ }
        return false;
    }
}
