/**
 * theme.js — the OTHER end of the pre-paint stamp.
 *
 * `index.html`'s inline script stamps `data-theme` on `<html>` before first paint, from
 * `localStorage['decal.theme']`, decoded exactly the way `storage-backends.js` encodes
 * it. That script is deliberately tiny and deliberately duplicated (nothing can be
 * imported before first paint), and it is the ONLY thing that runs before the page is
 * painted. This module is everything that happens after: the theme as a STORE the app can
 * read and change, with the write going through the storage router (B7 — one owner per
 * setting, `storage-routes.js` `theme` row) and the visible effect being the same one
 * attribute on the same element.
 *
 * NO FLASH, AND WHY THAT IS A STRUCTURAL PROPERTY HERE RATHER THAN A CAREFUL SEQUENCE.
 * This controller SEEDS ITSELF FROM THE STAMP. It reads `root.getAttribute('data-theme')`
 * and adopts it; it does not decide a theme of its own and then apply it. So the value
 * that painted the first frame is the value the store starts with, and the first thing a
 * component reads is the thing already on screen. A controller that resolved the theme
 * independently — even with identical rules — could disagree with the stamp for one
 * frame, and one frame of the wrong palette on a wall tablet is exactly the flash the
 * pre-paint stamp exists to prevent.
 *
 * BUG S11, BOTH HALVES. "The boot script writes 'dark' and persists it; the
 * `prefers-color-scheme` branch is commented out, so first run is indistinguishable from
 * a deliberate choice" (`LAYOUT_SPEC_DRAFT.md` §7.1 S11, `index.html:15-31` of the old
 * skin). The first half is the stamp's (it never writes). The second half is shared:
 * the stamp consults `prefers-color-scheme` when nothing is stored, and so does this
 * module — through the SAME precedence, written once as `resolveTheme()`:
 *
 *      stored choice  ->  prefers-color-scheme  ->  DEFAULT_THEME
 *
 * and "no stored choice" stays a real state for as long as the user has not chosen. That
 * is what `source` reports, and it is why `followSystem` is possible at all: a machine
 * whose user has never picked a theme follows the panel; one whose user has picked stays
 * picked, for ever, whatever the OS does.
 *
 * EVERYTHING IS INJECTED, INCLUDING THE ROOT AND THE MEDIA QUERY. No `document`, no
 * `window`, no `matchMedia` reached for from module scope — so this file runs under
 * `node:test` against a two-line fake, and `src/components/app-root.js` is the one file
 * that hands it the real ones (`rea-transport.js:56-58` states the same rule for the
 * transport: the app shell reads ambient state once, in a file that is allowed to).
 *
 * THE CHART IS ALREADY LISTENING. `plot-surface.js:492-503` observes `data-theme` on
 * `document.documentElement` and rebuilds its palette when it moves (chart-C2 — "theme
 * switch loses step boundaries"). So a theme change made here reaches the chart with no
 * wiring between the two: the attribute IS the channel.
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

/**
 * The precedence, in one place, as data.
 *
 * @param {string|null} stored       the persisted choice, already normalised
 * @param {boolean|null} prefersLight  what the media query says, or null for "not asked"
 * @returns {{theme: string, source: string}}
 */
export function resolveTheme(stored, prefersLight) {
    const chosen = normaliseTheme(stored);
    if (chosen) return { theme: chosen, source: THEME_SOURCE.STORED };
    if (prefersLight === true) return { theme: 'light', source: THEME_SOURCE.SYSTEM };
    if (prefersLight === false) return { theme: 'dark', source: THEME_SOURCE.SYSTEM };
    return { theme: DEFAULT_THEME, source: THEME_SOURCE.DEFAULT };
}

const NOOP = () => {};

/**
 * @param {object} deps
 * @param {{getAttribute: Function, setAttribute: Function}} deps.root
 *        the element carrying the stamp — `document.documentElement` in the app.
 * @param {{get: Function, set: Function}} [deps.storage]
 *        the storage router (`createStorageRouter`). Absent = nothing is persisted, which
 *        is a legitimate configuration (a private-mode WebView) and not an error.
 * @param {{matches: boolean, addEventListener?: Function, removeEventListener?: Function}} [deps.media]
 *        the result of `matchMedia(LIGHT_QUERY)`. Absent = the preference is not asked.
 * @param {object} [deps.logger]
 */
export function createThemeController({ root, storage = null, media = null, logger = null } = {}) {
    if (!root || typeof root.setAttribute !== 'function' || typeof root.getAttribute !== 'function') {
        throw new Error('createThemeController: a root element must be injected (document.documentElement)');
    }
    const log = logger && logger.scope ? logger.scope('theme') : logger;
    const warn = (log && log.warn) || NOOP;

    /* THE SEED IS THE STAMP, not a fresh resolution — see the header. A root with no
     * stamp at all (a harness page that forgot it, a fragment under test) falls back to
     * the default rather than to nothing: an unthemed document paints the light `:root`
     * band, and silently disagreeing with it would be worse than saying so. */
    const stamped = normaliseTheme(root.getAttribute(THEME_ATTRIBUTE));
    const store = createStore(
        {
            theme: stamped ?? DEFAULT_THEME,
            /* `null` until `hydrate()` has asked the router: before that the theme on
             * screen is a fact but WHY it is on screen is not known, and guessing
             * 'default' here would make a stored 'dark' indistinguishable from a first
             * run for the whole of boot — S11's own confusion, one layer up. */
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
        /** The current `{theme, source, stamped, hydrated}`. Frozen; replaced, never mutated. */
        get state() { return store.get(); },

        /** The current theme name — the value 90 % of callers want. */
        get theme() { return store.get().theme; },

        /** Observe. The current state is replayed to a late subscriber immediately. */
        subscribe(listener) { return store.subscribe(listener); },

        /**
         * Read the stored choice through the router and settle the theme.
         *
         * EXPLICIT, like every other store in this tree: nothing here reads or writes at
         * construction. Safe to call twice; the second call re-reads and re-settles.
         *
         * NEVER WRITES (S11). Hydration can only ever produce a stamp, and "no stored
         * choice" survives it — which is the whole point of the bug.
         */
        async hydrate() {
            let stored = null;
            if (storage && typeof storage.get === 'function') {
                try {
                    stored = normaliseTheme(await storage.get(THEME_KEY));
                } catch (error) {
                    // The router already swallows backend failures; this catches a
                    // router that is missing its layer, which is a wiring mistake and
                    // must not take the app down over a colour.
                    warn(`theme: could not read the stored choice — ${error && error.message}`);
                }
            }
            if (destroyed) return store.get();
            const { theme, source } = resolveTheme(stored, prefersLight());
            stamp(theme);
            return publish(theme, source);
        },

        /**
         * Choose a theme. Stamps first, persists second — the paint is not held behind a
         * storage round trip, and a storage failure leaves the user with the theme they
         * asked for rather than with an inexplicable revert.
         */
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

        /**
         * Follow the panel's preference for as long as the user has not chosen one.
         *
         * The listener is OWNED: added once, removed by `destroy()`, and never re-added
         * on a second call. Re-binding a handler on every event is bug S15's mechanism
         * (`scaling.js:39-41, 48-86` rewrites `innerHTML` and re-binds on every resize),
         * and a leaked listener is S10's; a shell gets exactly one of these and hands it
         * back when it goes.
         */
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

        /** Whether the system listener is currently attached — the leak test's oracle. */
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
