/**
 * The OTHER end of the pre-paint stamp.
 */

import { createStore } from '../stores/store.js';

/** The two themes the stylesheets define (`styles/tokens.css:853`; `:root` is light). */
export const THEMES = Object.freeze(['dark', 'light']);

/** What the stamp falls back to, and this module with it. One copy each, kept in step
 *  by `test/app-shell.test.mjs`, which reads the literal out of `index.html`. */
export const DEFAULT_THEME = 'dark';

/** The attribute the sheets select on. */
export const THEME_ATTRIBUTE = 'data-theme';

/** The LOGICAL storage key. The router owns the `decal.` prefix (B7). */
export const THEME_KEY = 'theme';

/** The query the stamp asks and this module asks. Written once. */
export const LIGHT_QUERY = '(prefers-color-scheme: light)';

/** Where the current value came from — and therefore whether it may still move. */
export const THEME_SOURCE = Object.freeze({
    /** The user chose. Nothing overrides it. */
    STORED: 'stored',
    /** No choice yet; the panel's own preference is being followed. */
    SYSTEM: 'system',
    /** No choice, no preference expressed. */
    DEFAULT: 'default',
});

/** `'dark'` / `'light'` / `null`. Anything else is absent, exactly as the stamp treats it. */
export function normaliseTheme(value) {
    return typeof value === 'string' && THEMES.includes(value) ? value : null;
}

export function resolveTheme(stored, prefersLight) {
    const chosen = normaliseTheme(stored);
    if (chosen) return { theme: chosen, source: THEME_SOURCE.STORED };
    if (prefersLight === true) return { theme: 'light', source: THEME_SOURCE.SYSTEM };
    if (prefersLight === false) return { theme: 'dark', source: THEME_SOURCE.SYSTEM };
    return { theme: DEFAULT_THEME, source: THEME_SOURCE.DEFAULT };
}

const NOOP = () => {};

export function createThemeController({ root, storage = null, media = null, logger = null } = {}) {
    if (!root || typeof root.setAttribute !== 'function' || typeof root.getAttribute !== 'function') {
        throw new Error('createThemeController: a root element must be injected (document.documentElement)');
    }
    const log = logger && logger.scope ? logger.scope('theme') : logger;
    const warn = (log && log.warn) || NOOP;

    const stamped = normaliseTheme(root.getAttribute(THEME_ATTRIBUTE));
    const store = createStore(
        {
            theme: stamped ?? DEFAULT_THEME,
            source: null,
            stamped,
            hydrated: false,
        },
        { label: 'theme', logger: log },
    );

    let mediaListener = null;
    let destroyed = false;

    const prefersLight = () => (media && typeof media.matches === 'boolean' ? media.matches : null);

    /** Write the attribute only when it would change: a no-op write still fires every
     *  MutationObserver watching the root, and `plot-surface.js` rebuilds on one. */
    const stamp = (theme) => {
        if (root.getAttribute(THEME_ATTRIBUTE) === theme) return false;
        root.setAttribute(THEME_ATTRIBUTE, theme);
        return true;
    };

    const publish = (theme, source) => {
        const current = store.get();
        if (current.theme === theme && current.source === source && current.hydrated) return current;
        return store.set({ ...current, theme, source, hydrated: true });
    };

    const controller = {
        get state() { return store.get(); },

        /** The current theme name — the value 90 % of callers want. */
        get theme() { return store.get().theme; },

        /** Observe. The current state is replayed to a late subscriber immediately. */
        subscribe(listener) { return store.subscribe(listener); },

        async hydrate() {
            let stored = null;
            if (storage && typeof storage.get === 'function') {
                try {
                    stored = normaliseTheme(await storage.get(THEME_KEY));
                } catch (error) {
                    warn(`theme: could not read the stored choice — ${error && error.message}`);
                }
            }
            if (destroyed) return store.get();
            const { theme, source } = resolveTheme(stored, prefersLight());
            stamp(theme);
            return publish(theme, source);
        },

        async set(theme) {
            const chosen = normaliseTheme(theme);
            if (!chosen) throw new Error(`theme: '${theme}' is not one of ${THEMES.join(', ')}`);
            stamp(chosen);
            const state = publish(chosen, THEME_SOURCE.STORED);
            if (storage && typeof storage.set === 'function') {
                try {
                    await storage.set(THEME_KEY, chosen);
                } catch (error) {
                    warn(`theme: '${chosen}' was applied but not stored — ${error && error.message}`);
                }
            }
            return state;
        },

        /** The other theme. The whole of a theme toggle's logic, so no screen restates it. */
        toggle() {
            return controller.set(store.get().theme === 'dark' ? 'light' : 'dark');
        },

        followSystem() {
            if (mediaListener || !media || typeof media.addEventListener !== 'function') return controller;
            mediaListener = () => {
                if (store.get().source === THEME_SOURCE.STORED) return;
                const { theme, source } = resolveTheme(null, prefersLight());
                stamp(theme);
                publish(theme, source);
            };
            media.addEventListener('change', mediaListener);
            return controller;
        },

        following() { return mediaListener !== null; },

        destroy() {
            destroyed = true;
            if (mediaListener && media && typeof media.removeEventListener === 'function') {
                media.removeEventListener('change', mediaListener);
            }
            mediaListener = null;
            store.destroy();
        },
    };

    return controller;
}
