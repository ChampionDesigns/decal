/**
 * The two ways a skin stops being the page: the host's stable entry point, and the native
 * bridge that closes the skin. Pure functions of the window they are handed.
 */

const HOST_ENTRY_PORT = 3000;

/** The entry-point address for this location, or null when there is none to build. */
export function hostEntryUrl(location) {
    if (!location || typeof location !== 'object') return null;
    const href = typeof location.href === 'string' ? location.href : '';
    if (href === '') return null;
    let url;
    try { url = new URL('/', href); } catch { return null; }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    url.port = String(HOST_ENTRY_PORT);
    return url.href;
}

export function hostServesThisPage(win) {
    return Boolean(win && win.decentApp && typeof win.decentApp.exitToDashboard === 'function');
}

/** Leave the skin, and answer whether it actually left. */
export function leaveSkin(win) {
    if (!win) return false;
    if (win.__DECENT_HOST__ && hostServesThisPage(win)) {
        try {
            win.decentApp.exitToDashboard();
            return true;
        } catch {
            /* A bridge that threw has not left. */
        }
    }
    let opened = false;
    try {
        opened = Boolean(win.opener);
    } catch { opened = false; }
    if (opened && typeof win.close === 'function') {
        try {
            win.close();
            return true;
        } catch { return false; }
    }
    return false;
}
