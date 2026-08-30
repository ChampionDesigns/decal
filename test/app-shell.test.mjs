/**
 * app-shell.test.mjs — the application shell without a browser.
 *
 * Wave 5.1, item `live-app-shell`. Three things are testable here and are tested here
 * rather than in the rendering suite, because they are logic and a browser makes logic
 * SLOWER to test, not better:
 *
 *   the route table and the router's string half   (src/lib/app-routes.js)
 *   the theme, including both halves of bug S11    (src/lib/theme.js + index.html)
 *   the boot SEQUENCE — what it opens, in what order, and what it does when a
 *   step fails                                     (src/lib/app-boot.js)
 *
 * plus the standing contract check for the endpoints the boot touches: every route this
 * screen's boot causes a request or a socket on is a row in `src/data/CONTRACTS.json`,
 * stamped at the pinned commit (DECISIONS.md:144-157 — contract checking is a BUILD
 * activity, done at the moment the screen is built).
 *
 * THE TWO COPIES OF THE THEME PRECEDENCE ARE COMPARED, NOT RESTATED. `index.html`'s
 * pre-paint stamp cannot import anything (nothing is importable before first paint), so
 * the precedence exists twice on purpose. This file runs the REAL script text out of
 * `index.html` against the same inputs it hands `resolveTheme()` and asserts the two
 * agree — which is the only way a duplicated rule stays one rule.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createContext, runInContext } from 'node:vm';

import {
    ROUTES, DEFAULT_ROUTE_ID, PLANNED_ROUTE_IDS, ROUTE_MATCH, ROUTE_HASH_PREFIX,
    routeIds, routeFor, hashFor, routeIdFromHash, resolveRoute, assertRouteTable,
} from '../src/lib/app-routes.js';
import {
    THEMES, DEFAULT_THEME, THEME_ATTRIBUTE, THEME_KEY, THEME_SOURCE, LIGHT_QUERY,
    normaliseTheme, resolveTheme, createThemeController,
} from '../src/lib/theme.js';
import { createAppBoot, bootFromWindow, BOOT_PHASE, BOOT_STEP } from '../src/lib/app-boot.js';
import { pluginEndpointPath } from '../src/data/rea-ws-channels.js';
import { WEATHER_ENDPOINT, WEATHER_PLUGIN_ID } from '../src/lib/weather-model.js';
import { createMemoryBackend } from '../src/lib/storage-backends.js';
import { FEED } from '../src/stores/live-stores.js';
import { FEED_STATUS } from '../src/stores/feed-store.js';
import { WS_CHANNELS } from '../src/data/rea-ws-channels.js';
import { STORAGE_PREFIX, LAYERS } from '../src/lib/storage-routes.js';

const repo = (relative) => fileURLToPath(new URL(`../${relative}`, import.meta.url));
const repoFile = (relative) => readFileSync(repo(relative), 'utf8');

/* ===========================================================================
 * The route table and the router's string half
 * ======================================================================== */

describe('app-routes', () => {
    test('the table is well formed and Live is the default', () => {
        assertRouteTable(ROUTES);
        assert.equal(DEFAULT_ROUTE_ID, 'live');
        assert.deepEqual(routeIds(ROUTES), ['live', 'selector', 'settings', 'editor', 'history']);
        assert.equal(ROUTES.live.tag, 'live-screen');
        assert.equal(ROUTES.live.module, 'src/screens/live-screen.js');
        // Wave 5.3. The row and the screen land together, which is what the next test
        // checks for every row rather than for this one.
        assert.equal(ROUTES.selector.tag, 'selector-screen');
        assert.equal(ROUTES.selector.module, 'src/screens/selector-screen.js');
        // Wave 5.4, by the same rule.
        assert.equal(ROUTES.settings.tag, 'settings-screen');
        assert.equal(ROUTES.settings.module, 'src/screens/settings-screen.js');
        // Wave 5.5, by the same rule.
        assert.equal(ROUTES.editor.tag, 'editor-screen');
        assert.equal(ROUTES.editor.module, 'src/screens/editor-screen.js');
        // Wave 5.6, by the same rule, and the last application of it: History is a
        // ROUTE (LAYOUT_SPEC_DRAFT.md §4.5, "not a display:flex toggle"), so it has a
        // row here exactly like the other four rather than a toggle inside Live.
        assert.equal(ROUTES.history.tag, 'history-screen');
        assert.equal(ROUTES.history.module, 'src/screens/history-screen.js');
    });

    test('nothing is planned any more, and nothing is both built and planned', () => {
        // THE LIST IS EMPTY AS OF WAVE 5.6, and this test says so in the one way that
        // cannot be read two ways. The disjointness check below is now VACUOUS — an
        // empty list contains nothing — so asserting only that would be a test that
        // passes because there is nothing to check, which is the shape this tree keeps
        // catching. The first assertion is therefore about the LIST, and it fails the
        // day a sixth screen is named without being built AND the day someone deletes
        // the mechanism instead of emptying it.
        assert.deepEqual([...PLANNED_ROUTE_IDS], [],
            'every screen src/screens/README.md names is built; `history` was the last to leave');
        assert.ok(Array.isArray(PLANNED_ROUTE_IDS), 'the mechanism stays — a sixth screen is named here first');

        for (const id of routeIds(ROUTES)) {
            assert.ok(!PLANNED_ROUTE_IDS.includes(id),
                `'${id}' is both built and planned — remove it from PLANNED_ROUTE_IDS`);
        }
    });

    test('the module a route names is a file that exists', () => {
        // The route table is the shell's only link to a screen. A row pointing at a file
        // nobody wrote resolves to a boot error at runtime and to nothing at all in a
        // review, which is the failure mode this one line removes.
        for (const id of routeIds(ROUTES)) {
            const source = repoFile(ROUTES[id].module);
            assert.match(
                source,
                new RegExp(`customElements\\.define\\(['"]${ROUTES[id].tag}['"]`),
                `${ROUTES[id].module} must define <${ROUTES[id].tag}>`,
            );
        }
    });

    test('a hash is read the same however it is spelled', () => {
        for (const spelling of ['#/live', '#live', '/live', 'live', '#//live', '#/live/', '#/live/detail', '#/live?x=1']) {
            assert.equal(routeIdFromHash(spelling), 'live', spelling);
        }
        for (const empty of ['', '#', '#/', '   ', null, undefined, 42]) {
            assert.equal(routeIdFromHash(empty), null, JSON.stringify(empty));
        }
        // Not an identifier: answered null rather than passed on to a table lookup.
        assert.equal(routeIdFromHash('#/../etc/passwd'), null);
    });

    test('hashFor and routeIdFromHash are each other\'s inverse', () => {
        // The spread of PLANNED_ROUTE_IDS is kept although it is empty today: the pair
        // has to hold for a planned name too, and that is exactly when the next wave
        // adds one.
        for (const id of [...routeIds(ROUTES), ...PLANNED_ROUTE_IDS]) {
            assert.equal(hashFor(id), `${ROUTE_HASH_PREFIX}${id}`);
            assert.equal(routeIdFromHash(hashFor(id)), id);
        }
    });

    test('an unknown route defaults rather than blanking the app, and says which it was', () => {
        const matched = resolveRoute('#/live');
        assert.equal(matched.match, ROUTE_MATCH.MATCHED);
        assert.equal(matched.planned, false);

        const empty = resolveRoute('');
        assert.equal(empty.id, DEFAULT_ROUTE_ID);
        assert.equal(empty.match, ROUTE_MATCH.DEFAULTED);
        assert.equal(empty.requested, null);

        // THE PLANNED EXAMPLE HAS RUN OUT, and this is where it is recorded rather
        // than quietly deleted. `settings` was this test's example until wave 5.4 built
        // it, `editor` until 5.5, and `history` until 5.6 — each moved out of
        // PLANNED_ROUTE_IDS in the same change that added its ROUTES row, which is the
        // rule working. With the list empty there is no input left that answers
        // `planned: true`, so what is asserted now is the state that replaced it:
        // `history` MATCHES, and a typo still defaults without claiming to be planned.
        const wasPlanned = resolveRoute('#/history');
        assert.equal(wasPlanned.id, 'history', 'the last planned name is now a built route');
        assert.equal(wasPlanned.match, ROUTE_MATCH.MATCHED);
        assert.equal(wasPlanned.planned, false, 'and a built route is never planned');

        const typo = resolveRoute('#/liev');
        assert.equal(typo.id, DEFAULT_ROUTE_ID);
        assert.equal(typo.match, ROUTE_MATCH.DEFAULTED);
        assert.equal(typo.planned, false);
        assert.equal(typo.requested, 'liev');

        // THE MECHANISM IS STILL LIVE WITH NO NAMES IN THE LIST — and it is PROVED here,
        // on a table and a planned list of this file's own, not asserted about the
        // shipping pair. The shipping list being empty is the fact above, and a fact
        // cannot exercise a branch: with nothing planned there is no hash that reaches
        // `planned: true`, so the day a sixth screen is named the branch would be
        // running for the first time in production. `resolveRoute` takes BOTH tables as
        // arguments for this reason, and the defaults are the shipping pair, so what
        // runs below is the same function the app runs with two names substituted.
        const table = { live: ROUTES.live, history: ROUTES.history };
        const planned = ['roaster'];

        const wasNamedFirst = resolveRoute('#/roaster', table, { planned });
        assert.equal(wasNamedFirst.id, DEFAULT_ROUTE_ID, 'a planned name still renders the default');
        assert.equal(wasNamedFirst.match, ROUTE_MATCH.DEFAULTED, 'it is a fallback, not a match');
        assert.equal(wasNamedFirst.requested, 'roaster');
        assert.equal(wasNamedFirst.planned, true, 'and the shell can say the screen is coming');

        // One letter different, and that is the whole point of the list: a name in
        // NEITHER the table nor the list is a typo, and gets no such promise.
        const typoOnTheSameTable = resolveRoute('#/rooster', table, { planned });
        assert.equal(typoOnTheSameTable.match, ROUTE_MATCH.DEFAULTED);
        assert.equal(typoOnTheSameTable.requested, 'rooster');
        assert.equal(typoOnTheSameTable.planned, false);

        // A built route is never planned even when someone lists it as both — the
        // disjointness rule as BEHAVIOUR, where the test above states it as a rule.
        const built = resolveRoute('#/history', table, { planned: ['history'] });
        assert.equal(built.match, ROUTE_MATCH.MATCHED);
        assert.equal(built.planned, false);

        // And on the shipping pair, which is what the app calls: nothing is planned.
        assert.equal(resolveRoute('#/nowhere').requested, 'nowhere');
        assert.equal(resolveRoute('#/nowhere').planned, false);
    });

    test('a malformed table is refused where the mistake is', () => {
        assert.throws(() => assertRouteTable({}), /empty/);
        assert.throws(() => assertRouteTable({ a: { id: 'a', tag: 'nohyphen', module: 'x.js' } }), /hyphen/);
        assert.throws(() => assertRouteTable({ a: { id: 'b', tag: 'a-b', module: 'x.js' } }), /carries id/);
        assert.throws(() => assertRouteTable({ a: { id: 'a', tag: 'a-b' } }), /module specifier/);
    });

    test('routeFor never throws on rubbish', () => {
        for (const bad of [null, undefined, '', 42, {}, 'nope']) assert.equal(routeFor(bad), null);
    });
});

/* ===========================================================================
 * The theme — and both halves of bug S11
 * ======================================================================== */

/** A `documentElement` double: the two methods the controller is allowed to use. */
function fakeRoot(initial = null) {
    const attrs = new Map();
    if (initial) attrs.set(THEME_ATTRIBUTE, initial);
    return {
        writes: 0,
        getAttribute(name) { return attrs.has(name) ? attrs.get(name) : null; },
        setAttribute(name, value) { this.writes += 1; attrs.set(name, value); },
    };
}

/** A `matchMedia` result double, with the listener bookkeeping the leak test reads. */
function fakeMedia(matches) {
    const listeners = new Set();
    return {
        matches,
        addEventListener(type, fn) { if (type === 'change') listeners.add(fn); },
        removeEventListener(type, fn) { if (type === 'change') listeners.delete(fn); },
        listenerCount() { return listeners.size; },
        emit(next) { this.matches = next; for (const fn of [...listeners]) fn({ matches: next }); },
    };
}

/** A storage-router double: logical keys in, JSON-able values out. */
function fakeStorage(initial = {}) {
    const map = new Map(Object.entries(initial));
    return {
        writes: [],
        async get(key) { return map.has(key) ? map.get(key) : undefined; },
        async set(key, value) { this.writes.push([key, value]); map.set(key, value); return true; },
        raw: map,
    };
}

describe('theme', () => {
    test('the precedence is stored -> prefers-color-scheme -> dark', () => {
        assert.deepEqual(resolveTheme('light', false), { theme: 'light', source: THEME_SOURCE.STORED });
        assert.deepEqual(resolveTheme('dark', true), { theme: 'dark', source: THEME_SOURCE.STORED });
        assert.deepEqual(resolveTheme(null, true), { theme: 'light', source: THEME_SOURCE.SYSTEM });
        assert.deepEqual(resolveTheme(null, false), { theme: 'dark', source: THEME_SOURCE.SYSTEM });
        assert.deepEqual(resolveTheme(null, null), { theme: DEFAULT_THEME, source: THEME_SOURCE.DEFAULT });
        // Rubbish is absent, byte for byte what the stamp does with an unparseable value.
        assert.deepEqual(resolveTheme('DARK', null), { theme: DEFAULT_THEME, source: THEME_SOURCE.DEFAULT });
        assert.equal(normaliseTheme('sepia'), null);
        assert.deepEqual([...THEMES], ['dark', 'light']);
    });

    test('the controller adopts the stamp and does not re-decide it (no flash)', () => {
        // The panel prefers light and nothing is stored — a fresh resolution would say
        // light. The stamp says dark. The controller must agree with the SCREEN.
        const root = fakeRoot('dark');
        const theme = createThemeController({ root, media: fakeMedia(true) });
        assert.equal(theme.theme, 'dark');
        assert.equal(theme.state.stamped, 'dark');
        assert.equal(root.writes, 0, 'construction must not write the attribute');
        theme.destroy();
    });

    test('hydrate settles the theme and never writes storage (bug S11)', async () => {
        const root = fakeRoot('dark');
        const storage = fakeStorage();
        const theme = createThemeController({ root, storage, media: fakeMedia(true) });

        const state = await theme.hydrate();
        assert.deepEqual(storage.writes, [], 'a first run must stay distinguishable from a deliberate choice');
        assert.equal(state.theme, 'light', 'no stored choice: the panel decides');
        assert.equal(state.source, THEME_SOURCE.SYSTEM);
        assert.equal(root.getAttribute(THEME_ATTRIBUTE), 'light');
        theme.destroy();
    });

    test('a stored choice wins over the panel, for ever', async () => {
        const root = fakeRoot('dark');
        const media = fakeMedia(true);
        const theme = createThemeController({ root, storage: fakeStorage({ [THEME_KEY]: 'dark' }), media });
        await theme.hydrate();
        assert.equal(theme.state.source, THEME_SOURCE.STORED);

        theme.followSystem();
        media.emit(true);
        assert.equal(theme.theme, 'dark', 'a chosen theme does not follow the panel');
        theme.destroy();
    });

    test('an unchosen theme follows the panel, and stops the day it is chosen', async () => {
        const root = fakeRoot('dark');
        const media = fakeMedia(false);
        const storage = fakeStorage();
        const theme = createThemeController({ root, storage, media });
        await theme.hydrate();
        theme.followSystem();

        media.emit(true);
        assert.equal(theme.theme, 'light');
        assert.equal(root.getAttribute(THEME_ATTRIBUTE), 'light');

        await theme.set('dark');
        assert.deepEqual(storage.writes, [[THEME_KEY, 'dark']], 'choosing persists through the router');
        media.emit(true);
        assert.equal(theme.theme, 'dark', 'chosen beats the panel from now on');
        theme.destroy();
    });

    test('set stamps, toggles alternate, and rubbish is refused', async () => {
        const root = fakeRoot('dark');
        const theme = createThemeController({ root, storage: fakeStorage() });
        await theme.set('light');
        assert.equal(root.getAttribute(THEME_ATTRIBUTE), 'light');
        await theme.toggle();
        assert.equal(theme.theme, 'dark');
        await assert.rejects(() => theme.set('sepia'), /not one of/);
        theme.destroy();
    });

    test('the attribute is written only when it changes', async () => {
        // Every no-op write fires plot-surface.js's MutationObserver on the root and
        // costs a palette rebuild on the 15 Hz path (chart-C9's class).
        const root = fakeRoot('dark');
        const theme = createThemeController({ root, storage: fakeStorage({ [THEME_KEY]: 'dark' }) });
        await theme.hydrate();
        await theme.set('dark');
        assert.equal(root.writes, 0, 'settling on the theme already stamped writes nothing');
        await theme.set('light');
        assert.equal(root.writes, 1);
        theme.destroy();
    });

    test('the system listener is owned: added once, removed on destroy (S10\'s class)', () => {
        const media = fakeMedia(false);
        const theme = createThemeController({ root: fakeRoot('dark'), media });
        theme.followSystem();
        theme.followSystem();
        theme.followSystem();
        assert.equal(media.listenerCount(), 1, 'three calls, one listener');
        assert.equal(theme.following(), true);
        theme.destroy();
        assert.equal(media.listenerCount(), 0, 'destroy hands the listener back');
        assert.equal(theme.following(), false);
    });

    /**
     * BUG S15, asserted rather than assumed. The test above pins the leak (S10's class:
     * added once, handed back). S15 is a different failure with the same smell —
     * `scaling.js:39-41, 48-86` re-binds its handlers INSIDE the handler, so every
     * resize adds another one and the work grows without bound (`src/lib/theme.js:220`
     * names it as the reason this listener is owned). The distinguishing question is
     * therefore what the count does after the event FIRES, which nothing asked before.
     */
    test('and firing it does not re-bind: the count is flat across events (bug S15)', () => {
        const media = fakeMedia(false);
        const root = fakeRoot('dark');
        const theme = createThemeController({ root, media });
        theme.followSystem();

        for (const prefersLight of [true, false, true, false, true]) media.emit(prefersLight);
        assert.equal(media.listenerCount(), 1, 'a handler that re-binds itself would count 6 here');
        assert.equal(theme.theme, 'light', 'and it is still the one that answers');
        assert.equal(root.writes, 5, 'one stamp per real change, not one per bound copy');

        theme.destroy();
        assert.equal(media.listenerCount(), 0, 'one listener to hand back, not six');
    });

    test('a storage layer that throws leaves the theme applied rather than the app down', async () => {
        const hostile = { get() { throw new Error('no backend'); }, set() { throw new Error('no backend'); } };
        const root = fakeRoot('dark');
        const theme = createThemeController({ root, storage: hostile, media: fakeMedia(true) });
        assert.equal((await theme.hydrate()).theme, 'light');
        await theme.set('dark');
        assert.equal(root.getAttribute(THEME_ATTRIBUTE), 'dark');
        theme.destroy();
    });
});

/* ===========================================================================
 * The pre-paint stamp — the copy that cannot import this module
 * ======================================================================== */

/**
 * The theme stamp, selected by what it writes rather than by being the only pre-paint
 * script — index.html carries a second one since the fit landed (src/lib/app-fit.js).
 * Same change, same reason, in test/storage-routes.test.mjs.
 */
function preePaintStamp() {
    const blocks = [...repoFile('index.html').matchAll(/<script>([\s\S]*?)<\/script>/g)]
        .map((m) => m[1])
        .filter((source) => source.includes('data-theme'));
    assert.equal(blocks.length, 1,
        'index.html should carry exactly one inline script that stamps data-theme');
    return blocks[0];
}

/** Run the real stamp with a given storage and a given media answer. */
function runStamp({ stored = null, prefersLight = null } = {}) {
    let stamped = null;
    const context = {
        localStorage: {
            getItem: (k) => (stored !== null && k === `${STORAGE_PREFIX}theme` ? stored : null),
            setItem() { throw new Error('the stamp must never write'); },
        },
        document: { documentElement: { setAttribute(name, value) { stamped = value; } } },
    };
    if (prefersLight !== null) {
        context.matchMedia = (query) => {
            assert.equal(query, LIGHT_QUERY, 'the stamp and theme.js must ask the same query');
            return { matches: prefersLight };
        };
    }
    runInContext(preePaintStamp(), createContext(context));
    return stamped;
}

describe('the pre-paint theme stamp', () => {
    test('it agrees with resolveTheme on every input (the duplicated rule is one rule)', () => {
        for (const stored of [null, '"dark"', '"light"']) {
            for (const prefersLight of [null, true, false]) {
                const value = stored === null ? null : JSON.parse(stored);
                assert.equal(
                    runStamp({ stored, prefersLight }),
                    resolveTheme(value, prefersLight).theme,
                    `stored=${stored} prefersLight=${prefersLight}`,
                );
            }
        }
    });

    test('it honours prefers-color-scheme on a first run (bug S11, the other half)', () => {
        assert.equal(runStamp({ prefersLight: true }), 'light');
        assert.equal(runStamp({ prefersLight: false }), 'dark');
        assert.equal(runStamp({ prefersLight: null }), DEFAULT_THEME, 'no matchMedia at all: unchanged');
    });

    test('it still decodes what the storage backend writes, and never writes itself', () => {
        assert.equal(runStamp({ stored: '"light"', prefersLight: false }), 'light');
        assert.equal(runStamp({ stored: '{not json', prefersLight: false }), 'dark');
        // setItem throws in the double above, so a write would fail this test loudly.
        assert.equal(runStamp({ prefersLight: true }), 'light');
    });

    test('the two files carry the same default and the same query, written once each', () => {
        const html = repoFile('index.html');
        assert.match(html, /DEFAULT_THEME\s*=\s*'dark'/);
        assert.equal(DEFAULT_THEME, 'dark');
        assert.ok(html.includes(LIGHT_QUERY), 'index.html must ask theme.js\'s LIGHT_QUERY');
        // The harness parses this exact expression out of index.html (server.js:80).
        assert.ok(html.includes("setAttribute('data-theme', stored || DEFAULT_THEME)"));
    });

    /**
     * BUG S14, asserted rather than assumed. "Dead shell markup: `#profile_modal` (its
     * opener does call showModal() but has no callers), `.subpage-fullscreen-toggle`,
     * `class="toast-buttom"`" (§7.1 S14). Retiring it is a STRUCTURAL claim — the
     * document holds one mounted element and nothing that no code reaches — and a
     * structural claim asserted by nobody is a claim nobody can keep. The three names
     * are checked by name because that is what regressed: a copied fragment brings its
     * dead ids with it, and the typo'd class is invisible until someone reads the CSS.
     */
    test('the document carries no dead shell markup (bug S14)', () => {
        const html = repoFile('index.html');
        const body = html.slice(html.indexOf('<body>') + '<body>'.length, html.indexOf('</body>'));
        const elements = [...body.matchAll(/<([a-z][a-z0-9-]*)/gi)].map((m) => m[1].toLowerCase());
        assert.deepEqual(elements, ['app-root'],
            `the body is one mounted element, and it is the router's: ${elements.join(', ')}`);

        for (const dead of ['profile_modal', 'subpage-fullscreen-toggle', 'toast-buttom']) {
            assert.equal(html.includes(dead), false, `index.html carries S14's dead markup: ${dead}`);
        }
    });
});

/* ===========================================================================
 * The boot sequence
 * ======================================================================== */

/** A WebSocket double. Records the URL; nothing opens by itself. */
function fakeSocketFactory() {
    const sockets = [];
    const factory = (url) => {
        const listeners = new Map();
        const socket = {
            url,
            closed: false,
            addEventListener(type, fn) {
                if (!listeners.has(type)) listeners.set(type, new Set());
                listeners.get(type).add(fn);
            },
            removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
            close() { this.closed = true; },
            /** RECORDED, NOT DISCARDED. Until 26 August 2026 nothing in the skin ever
             *  sent on a socket, so a fake that threw away every send cost nothing. The
             *  display channel carries `setBrightness` now and this is how a test sees it. */
            sent: [],
            send(payload) { this.sent.push(payload); },
            /** Drive the channel from the test side. */
            emit(type, event) { for (const fn of [...(listeners.get(type) ?? [])]) fn(event); },
            listenerCount() { return [...listeners.values()].reduce((n, set) => n + set.size, 0); },
        };
        sockets.push(socket);
        return socket;
    };
    factory.sockets = sockets;
    factory.urls = () => sockets.map((s) => s.url);
    /** The socket for one path, so a test can drive it or read what it was sent. */
    factory.forPath = (needle) => sockets.find((s) => String(s.url).includes(needle)) ?? null;
    factory.sentOn = (needle) => (factory.forPath(needle)?.sent ?? []).map((p) => {
        try { return JSON.parse(p); } catch { return p; }
    });
    return factory;
}

/** A fetch double that answers the capability read and records every call. */
function fakeFetch(answer = { ok: true, status: 200, body: { capabilities: ['cupWarmer'] } }) {
    const calls = [];
    const impl = async (url, options = {}) => {
        calls.push({ url, method: options.method ?? 'GET' });
        if (typeof answer === 'function') return answer(url, options);
        return {
            ok: answer.ok,
            status: answer.status,
            headers: { get: () => null },
            text: async () => JSON.stringify(answer.body ?? null),
        };
    };
    impl.calls = calls;
    return impl;
}

const LOCATION = { hostname: '127.0.0.1', protocol: 'http:' };

/** A devices frame the address layer accepts — the minimum B8 shape. */
const DEVICES_FRAME = {
    devices: [],
    scanning: false,
    connectionStatus: { phase: 'connecting', foundMachines: [], foundScales: [], pendingAmbiguity: null },
};

function bootWith({ fetchImpl = fakeFetch(), createSocket = fakeSocketFactory(), importModule = async () => ({}), ...rest } = {}) {
    const boot = createAppBoot({ fetch: fetchImpl, createSocket, location: LOCATION, importModule, ...rest });
    return { boot, fetchImpl, createSocket };
}

describe('app-boot', () => {
    test('nothing opens at construction — the whole layer waits for start()', () => {
        const { boot, createSocket, fetchImpl } = bootWith();
        assert.equal(boot.state.phase, BOOT_PHASE.IDLE);
        assert.deepEqual(createSocket.urls(), []);
        assert.deepEqual(fetchImpl.calls, []);
        assert.equal(boot.live.attached(), false);
        boot.destroy();
    });

    test('start opens the eight feeds, asks for capabilities once, and mounts Live', async () => {
        const loaded = [];
        const { boot, createSocket, fetchImpl } = bootWith({
            importModule: async (specifier) => { loaded.push(specifier); return {}; },
        });

        const state = await boot.start();
        await boot.capabilitiesSettled();

        assert.equal(state.phase, BOOT_PHASE.READY);
        assert.equal(state.step, BOOT_STEP.DONE);
        assert.equal(state.route.id, 'live');
        assert.equal(state.route.tag, 'live-screen');
        assert.deepEqual(loaded, ['src/screens/live-screen.js']);

        /* The eight channels the live layer opens, by their own table's paths — the boot
         * spells no path of its own.
         *
         * THE EIGHTH IS THE WEATHER PLUGIN'S, and it is built rather than tabled: the
         * address layer's `pluginEndpoint` row is a TEMPLATE, so `pluginEndpointPath` is
         * the declared builder and the only thing allowed to fill it in. It is bounded —
         * three attempts — so a machine without the plugin stops dialling and the corner
         * is simply absent, which is why an eighth socket is not an eighth dependency.
         *
         * THE TANK JOINED THEM ON 23 Aug 2026. Ben: "Tank just shows as -, no water level
         * being shown." The tile had been built and dashed since the band was made, and
         * its own note named the gap exactly: the channel was tabled, and no feed in
         * live-stores.js attached it. */
        assert.deepEqual(createSocket.urls().sort(), [
            WS_CHANNELS.devices.path,
            WS_CHANNELS.display.path,
            WS_CHANNELS.machineSnapshot.path,
            WS_CHANNELS.waterLevels.path,
            WS_CHANNELS.scaleSnapshot.path,
            WS_CHANNELS.shotState.path,
            WS_CHANNELS.update.path,
            pluginEndpointPath(WEATHER_PLUGIN_ID, WEATHER_ENDPOINT),
        ].map((p) => `ws://127.0.0.1:8080${p}`).sort());

        await boot.machineInfoSettled();

        await boot.workflowSettled();
        await boot.cupWarmerSettled();

        /* FIVE READS, EACH ONCE, EACH ON ITS OWN TABLED ROUTE AND EACH OWNED BY ONE STORE.
         *
         * The second one arrived with `live-capability-gates-ghc` (wave 5.1). The
         * capability store will not fetch `machine/info` — "one store, one route", its own
         * rule — and BOTH R3 gates answer from that body, so until a store owned the feed
         * `groupHeadController()` and `profileModes()` were pinned at `unknown` for ever.
         * `machine-info-store.js` owns it and the boot hands the BODY to
         * `applyMachineInfo`, so neither store learned the other's route.
         *
         * THE THIRD IS THE LIVE RAIL'S, and it is the read whose absence made the rail
         * dead. `<live-screen>` declares `targets` and nothing set them, so every stepper,
         * every preset cell and the keypad's Confirm rendered disabled on any machine —
         * and the one handler that writes `targets` sat behind those very controls. The
         * ten numbers live on ONE document, the workflow (DQ-707), and `workflow-store.js`
         * owns it. Asked on the start path beside the other two and gated on nothing: the
         * rail renders its dashes until it lands, which is what it renders when there is
         * nothing to say.
         *
         * THE FOURTH AND FIFTH ARRIVED WITH BEN'S LIVE-COMPOSITION RULING (22 Aug 2026),
         * and they are the same shape of gap the third was. `<live-screen>` declared
         * `favourites`, `profileName`, `storedDerivation` and `shotId` and nothing under
         * src/ ever wrote any of them (DQ-1-D: "profileName + favourites have NO OWNER …
         * P-1's shape twice more"), so the header's five favourite slots rendered as five
         * numbered blanks and the chart and the foot band said "no shot yet" on a machine
         * with 321 stored shots. The listing owns the first, the shots store the second.
         * NEITHER IS MACHINE-GATED — profiles and stored shots outlive the machine being
         * switched on — which is why they do not appear in the re-read set below.
         *
         * THE SHOTS PAGE IS ASKED AT limit=1, deliberately: the Live page wants one thing
         * from the list (the newest shot's id, `items[0]` at order=desc) and the page's
         * own `total` answers "how many are there" whatever the limit is.
         *
         * THE SIXTH IS THE MAT, and it is LAST because it is the only one that waits.
         * Slate's header carries a Warmer control (#cupwarmer-toggle-btn [i=9]) and
         * Decal's had none, with `src/stores/cup-warmer.js` written whole and called
         * from nowhere — the same finished-half-with-no-other-half as the two above.
         * It chains on the capability read rather than racing it, because the store's
         * sequence is A3's ("the capability list first, the handler's own 404 second
         * and authoritative") and an unchained read sees `entries()` null, reads that
         * as "not known yet" and asks for the PRE-HEAT route as well on every boot.
         * With the list in hand and only `cupWarmer` on it, that second request is
         * correctly not made — which is what makes this list six entries and not seven.
         *
         * IT IS MACHINE-GATED, unlike the fourth and fifth, so it DOES appear in the
         * re-read set below: a mat state read off the machine that just left is exactly
         * the stale answer `invalidate()` exists for.
         *
         * AND A SEVENTH SINCE 27 AUGUST 2026 — ReaPrime's own preferences, `GET /settings`.
         * It is here for ONE FIELD: `stopHotWaterAtWeight` is what decides whether a
         * hot-water pour ends on millilitres or on the scale, and it is therefore what the
         * Live rail's stop caption says and what the unit beside its number means. The rail
         * used to answer that from a KV row of its own (`hotWaterStopMode`), which is two
         * stores for one fact and could disagree with the Settings page — measured
         * disagreeing on the recorded mock, whose machine holds the field true while the
         * rail printed "Volume stop" and "240 mL". The store is the shell's rather than the
         * settings screen's for the same reason the cup warmer's is: two constructions of one
         * store break B7 as thoroughly as two keys would.
         *
         * IT IS NOT MACHINE-GATED. `GET /api/v1/settings` is ReaPrime's document, not
         * `withDe1`'s, so it answers with or without a machine — which is why it is asked
         * once at start and does NOT appear in the re-read set below. */
        assert.deepEqual(fetchImpl.calls, [
            { url: 'http://127.0.0.1:8080/api/v1/machine/capabilities', method: 'GET' },
            { url: 'http://127.0.0.1:8080/api/v1/machine/info', method: 'GET' },
            { url: 'http://127.0.0.1:8080/api/v1/workflow', method: 'GET' },
            { url: 'http://127.0.0.1:8080/api/v1/profiles?includeHidden=true', method: 'GET' },
            { url: 'http://127.0.0.1:8080/api/v1/shots?limit=25&offset=0&order=desc', method: 'GET' },
            { url: 'http://127.0.0.1:8080/api/v1/settings', method: 'GET' },
            { url: 'http://127.0.0.1:8080/api/v1/machine/cupWarmer', method: 'GET' },
        ]);
        assert.equal(boot.capabilities.state.status, 'ready');
        assert.equal(boot.capabilities.offers('cupWarmer'), true);
        assert.equal(boot.capabilities.offers('ledStrip'), false, 'fail-closed: absent is not present');

        boot.destroy();
    });

    test('the devices socket is the answer path AND the connection feed, not two sockets', async () => {
        const { boot, createSocket } = bootWith();
        await boot.start();
        const devicesUrl = `ws://127.0.0.1:8080${WS_CHANNELS.devices.path}`;
        assert.equal(createSocket.urls().filter((u) => u === devicesUrl).length, 1);
        assert.ok(boot.devices, 'the B8 answer path is exposed, never re-implemented');
        boot.destroy();
    });

    test('the connection feed is mirrored into the boot state, never re-derived', async () => {
        const { boot, createSocket } = bootWith();
        await boot.start();
        assert.equal(boot.state.connection, FEED_STATUS.NEVER, 'nothing has arrived yet');

        const devices = createSocket.sockets.find((s) => s.url.endsWith(WS_CHANNELS.devices.path));
        devices.emit('open', {});
        devices.emit('message', { data: JSON.stringify(DEVICES_FRAME) });

        assert.equal(boot.state.connection, FEED_STATUS.LIVE);
        assert.equal(boot.live.feed(FEED.CONNECTION).get().status, FEED_STATUS.LIVE,
            'the boot state is the feed\'s own word for it');
        boot.destroy();
    });

    test('a capability read that fails does not stop the screen (fail-closed, not fail-shut)', async () => {
        const { boot } = bootWith({
            fetchImpl: fakeFetch({ ok: false, status: 500, body: { error: 'no machine' } }),
        });
        const state = await boot.start();
        await boot.capabilitiesSettled();

        assert.equal(state.phase, BOOT_PHASE.READY, 'the screen mounts anyway — B8 has to be renderable');
        assert.equal(boot.capabilities.state.status, 'error');
        assert.equal(boot.capabilities.state.entries, null, 'a failed read is NOT an empty capability set');
        assert.equal(boot.capabilities.offers('cupWarmer'), false, 'unknown gates closed');
        assert.equal(boot.state.capabilities, 'error');
        boot.destroy();
    });

    test('a screen module that will not load is the one real boot error, and it names itself', async () => {
        const { boot } = bootWith({
            importModule: async () => { throw new Error('404 not found'); },
        });
        const state = await boot.start();
        assert.equal(state.phase, BOOT_PHASE.ERROR);
        assert.equal(state.step, BOOT_STEP.SCREEN);
        assert.equal(state.route, null);
        assert.match(state.error.message, /404/);
        assert.equal(state.error.specifier, 'src/screens/live-screen.js');
        boot.destroy();
    });

    test('a route swap loads the new module and publishes the new tag', async () => {
        const table = {
            live: ROUTES.live,
            probe: { id: 'probe', tag: 'probe-screen', module: 'test/fixtures/probe-screen.js', label: 'Probe' },
        };
        const loaded = [];
        const { boot } = bootWith({
            routes: table,
            importModule: async (specifier) => { loaded.push(specifier); return {}; },
        });
        await boot.start();
        assert.equal(boot.state.route.tag, 'live-screen');

        await boot.goto('probe');
        assert.equal(boot.state.route.tag, 'probe-screen');
        assert.equal(boot.state.phase, BOOT_PHASE.READY);

        await boot.goto('live');
        assert.equal(boot.state.route.tag, 'live-screen');
        assert.deepEqual(loaded, [
            'src/screens/live-screen.js',
            'test/fixtures/probe-screen.js',
            'src/screens/live-screen.js',
        ], 'each swap loads its own module; nothing is re-entered by accident');
        boot.destroy();
    });

    test('stop() detaches every feed and leaves nothing subscribed (bug S10\'s class)', async () => {
        const { boot, createSocket } = bootWith();
        assert.equal(boot.attachments(), 0);
        await boot.start();
        assert.equal(boot.live.attached(), true);
        assert.equal(boot.attachments(), 1, 'the boot watches the connection feed while it runs');

        boot.stop();
        assert.equal(boot.live.attached(), false);
        assert.equal(boot.attachments(), 0, 'and hands the subscription back');
        for (const socket of createSocket.sockets) {
            assert.equal(socket.listenerCount(), 0, `${socket.url}: listeners were removed before close`);
        }

        // Start / stop ten times: a shell that leaks one subscription per boot is S10.
        for (let i = 0; i < 10; i += 1) {
            await boot.start();
            assert.equal(boot.attachments(), 1, `cycle ${i}: one subscription, never two`);
            boot.stop();
        }
        assert.equal(boot.attachments(), 0, 'ten boots, no accumulation');
        assert.equal(boot.watchers(), 0, 'and nothing left watching the boot state either');
        boot.destroy();
    });

    /* ───────────────────────────────────────────────────────────────────────────
     * THE TWO MACHINE-SHAPED ANSWERS ARE RE-ASKED WHEN THE MACHINE CHANGES.
     *
     * Both reads run inside `withDe1`, so both answer 500 with no machine connected —
     * the ordinary way an app opens. The boot read therefore lands on `unavailable`,
     * `applyMachineInfo(null)` is applied, and until this wiring existed NOTHING re-read
     * either one: `refresh()` and `forget()` had no caller anywhere under `src/`. A user
     * who connected a machine after opening the app — including through this cluster's
     * own picker — kept `groupHeadController()` at `unknown` and never saw the GHC strip
     * for the whole session.
     * ─────────────────────────────────────────────────────────────────────────── */

    /** A devices frame with (or without) a CONNECTED machine, as the aggregator writes one. */
    const machineFrame = (id) => ({
        devices: id === null ? [] : [{ id, name: 'a machine', type: 'machine', state: 'connected' }],
        scanning: false,
        connectionStatus: {
            phase: id === null ? 'idle' : 'ready',
            foundMachines: [], foundScales: [], pendingAmbiguity: null,
        },
    });

    /** A fetch that is 500 (`withDe1`, no machine) until a machine is said to be there. */
    function machineDependentFetch() {
        const state = { connected: false, info: { version: '1293', model: 'x', serialNumber: '1', GHC: true, extra: {} } };
        const impl = fakeFetch((url) => {
            const body = url.endsWith('/machine/capabilities') ? { capabilities: ['cupWarmer'] } : state.info;
            if (!state.connected) {
                return { ok: false, status: 500, headers: { get: () => null }, text: async () => JSON.stringify({ e: 'no de1' }) };
            }
            return { ok: true, status: 200, headers: { get: () => null }, text: async () => JSON.stringify(body) };
        });
        impl.state = state;
        return impl;
    }

    const devicesSocket = (createSocket) =>
        createSocket.sockets.find((s) => s.url.endsWith(WS_CHANNELS.devices.path));

    async function settle(boot) {
        await boot.capabilitiesSettled();
        await boot.machineInfoSettled();
        await boot.cupWarmerSettled();
        // The re-read is started from a subscriber, so the promises above may be the ones
        // it replaced. One more turn of all three is enough for the second set.
        await boot.capabilitiesSettled();
        await boot.machineInfoSettled();
        // The mat's read CHAINS on the capability read, so it settles a turn after it.
        await boot.cupWarmerSettled();
        await boot.cupWarmerSettled();
    }

    test('a machine that connects AFTER the app opened re-reads both answers (the GHC strip appears)', async () => {
        const fetchImpl = machineDependentFetch();
        const { boot, createSocket } = bootWith({ fetchImpl });

        await boot.start();
        await settle(boot);
        assert.equal(boot.machineInfo.get().status, 'unavailable', 'the documented 500 — no machine to ask');
        assert.equal(boot.capabilities.groupHeadController().capability, 'unknown',
            'and the R3 gate is fail-closed on it');
        /* SEVEN at boot, not two: the rail's workflow read joined the pair (DQ-707 — the
         * Live rail's ten targets live on that document and nothing read it, which is why
         * every rail control rendered disabled), the profile listing and the shots page
         * joined it with Ben's Live-composition ruling, the cup warmer joined it with
         * the header's restored Warmer control, and ReaPrime's own preferences joined it
         * on 27 August 2026 with the rail's hot-water stop condition. All seven are asked on
         * the same path and gated on nothing. */
        assert.equal(fetchImpl.calls.length, 7, 'one set at boot');

        // The user connects a machine. ReaPrime publishes it on the devices socket, which
        // is the ONE event that changes both answers.
        fetchImpl.state.connected = true;
        const devices = devicesSocket(createSocket);
        devices.emit('open', {});
        devices.emit('message', { data: JSON.stringify(machineFrame('m-1')) });
        await settle(boot);

        /* ELEVEN: the seven above plus the FOUR machine-shaped answers, re-asked once each —
         * capabilities, the workflow, machine info and the cup warmer. The listing, the
         * shots page and ReaPrime's preferences are NOT re-asked, and that is the decision
         * rather than an omission — a profile library, a stored-shot history and the app's
         * own settings belong to the box, not to the machine that has just been switched on,
         * so re-reading them on a connect would be requests that cannot change their answer.
         *
         * `stopHotWaterAtWeight` IS ON THE BOX SIDE OF THAT LINE even though it is about the
         * machine's behaviour, and the test of which side a read is on is not what the value
         * describes — it is WHOSE DOCUMENT it is. `GET /api/v1/settings` is ReaPrime's own
         * and answers with no machine attached; the four re-read routes all go through
         * `withDe1` and answer 500 without one.
         *
         * THE MAT IS ON THE MACHINE SIDE OF THAT LINE, which is the whole reason it is
         * in this set: a warmer state read off the machine that just left is exactly
         * the stale answer the store's `invalidate()` exists to prevent, and the
         * header would otherwise paint the previous machine's ON. */
        assert.equal(fetchImpl.calls.length, 11,
            'the four MACHINE answers were re-asked, and exactly once each — the rail\'s '
            + 'targets belong to the machine that is here now, so a swap re-reads them too');
        assert.equal(boot.machineInfo.get().status, 'ready');
        assert.equal(boot.capabilities.groupHeadController().capability, 'present',
            'the GHC gate answers for the machine that is now there — the whole point of the item');
        assert.equal(boot.capabilities.offers('cupWarmer'), true, 'and the served seven landed too');
        assert.equal(boot.attachments(), 1, 'still ONE subscription on the live layer, never two');
        boot.destroy();
    });

    test('a machine that goes away is FORGOTTEN — the previous machine never describes the next', async () => {
        const fetchImpl = machineDependentFetch();
        fetchImpl.state.connected = true;
        const { boot, createSocket } = bootWith({ fetchImpl });

        await boot.start();
        const devices = devicesSocket(createSocket);
        devices.emit('open', {});
        devices.emit('message', { data: JSON.stringify(machineFrame('m-1')) });
        await settle(boot);
        assert.equal(boot.capabilities.groupHeadController().capability, 'present');

        // It goes. The frame says so; the feed is LIVE, so this is a fact and not a blip.
        fetchImpl.state.connected = false;
        devices.emit('message', { data: JSON.stringify(machineFrame(null)) });
        await settle(boot);

        assert.equal(boot.machineInfo.get().info, null, 'the departed machine\'s info was kept');
        assert.equal(boot.capabilities.groupHeadController().capability, 'unknown',
            'the departed machine\'s GHC flag was kept — the stale answer forget() exists to prevent');
        assert.equal(boot.capabilities.offers('cupWarmer'), false, 'and its capability set with it');
        assert.equal(fetchImpl.calls.length, 11, 'nothing is asked of a machine that is not there');

        // A DIFFERENT machine arrives: it gets its own answers, not the first one's.
        fetchImpl.state.connected = true;
        fetchImpl.state.info = { version: '1293', model: 'y', serialNumber: '2', GHC: false, extra: {} };
        devices.emit('message', { data: JSON.stringify(machineFrame('m-2')) });
        await settle(boot);
        assert.equal(boot.machineInfo.get().info.serialNumber, '2');
        assert.equal(boot.capabilities.groupHeadController().capability, 'absent',
            'the second machine reports GHC:false — a real answer, and it is not m-1\'s `present`');
        boot.destroy();
    });

    test('a held frame behind a dead feed is not a disconnect — nothing is forgotten on a blip', async () => {
        const fetchImpl = machineDependentFetch();
        fetchImpl.state.connected = true;
        const { boot, createSocket } = bootWith({ fetchImpl });

        await boot.start();
        const devices = devicesSocket(createSocket);
        devices.emit('open', {});
        devices.emit('message', { data: JSON.stringify(machineFrame('m-1')) });
        await settle(boot);
        const asked = fetchImpl.calls.length;

        // The socket closes. The VALUE survives, marked stale (the deletion rule) — so the
        // frame still names the machine it named, and nothing here has learned otherwise.
        devices.emit('close', {});
        await settle(boot);

        assert.equal(boot.state.connection, FEED_STATUS.STALE, 'the feed says the source went');
        assert.equal(boot.capabilities.groupHeadController().capability, 'present',
            'a socket blip is not a machine going away, and must not wipe the answer');
        assert.equal(fetchImpl.calls.length, asked, 'nor re-ask for a machine nothing said had changed');
        boot.destroy();
    });

    test('start() after destroy() is refused rather than half-working', async () => {
        const { boot } = bootWith();
        await boot.start();
        boot.destroy();
        await assert.rejects(() => boot.start(), /after destroy/);
    });

    test('the shell builds ONE cup-warmer store, and the settings screen takes it', () => {
        /* B7 BROKEN BY CONSTRUCTION RATHER THAN BY A SECOND KEY, and that is what made it
         * invisible: two instances of one store each behave correctly on their own.
         *
         * `app-boot.js` hoisted a cup-warmer store for the Live header's Warmer button, and
         * `settings-model.js` went on building its own for the settings page's door — while
         * still carrying a comment saying the store had "no caller anywhere in src/". The
         * boot's copy is refreshed at boot and on `machineChanged` and nothing else, so
         * changing the mat target on the Settings page and pressing Save left the Live
         * header showing the OLD setpoint until the machine reconnected.
         *
         * A SOURCE ASSERTION AND AN ANTI-PIN, which is the shape this file is ledgered for:
         * it fires when a second construction comes back and never when a live value moves.
         * `settings-model.js` cannot be imported here — it addresses its dependencies
         * through the page's importmap — so the count is read where it is written. */
        const boot = repoFile('src/lib/app-boot.js');
        const shell = repoFile('src/screens/settings-model.js');
        assert.equal((boot.match(/createCupWarmerStore\(/g) ?? []).length, 1,
            'the shell assembles it, exactly once');
        assert.doesNotMatch(
            shell.replace(/\/\*[\s\S]*?\*\//g, ' '),
            /createCupWarmerStore\(/,
            'the settings screen must take boot.cupWarmer, not build a second store over the same routes',
        );
    });

    /* A Window whose storage is a Map, so a test can see what actually landed. The
     * existing `windowWith` above answers reads only; these tests are about WRITES. */
    const fakeWindowFor = (store) => ({
        location: { hostname: 'page-host', protocol: 'http:' },
        fetch: async () => ({ ok: true, status: 200, json: async () => ({ capabilities: [] }) }),
        localStorage: {
            getItem: (key) => (store.has(key) ? store.get(key) : null),
            setItem: (key, value) => { store.set(key, String(value)); },
            removeItem: (key) => { store.delete(key); },
        },
        sessionStorage: {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
        },
    });

    /* THE SCREEN-SAVER SETTING DID NOT SURVIVE A RELOAD, AND THIS IS WHY.
     *
     * `createAppBoot` defaults `local` and `session` to memory and used to say "No row
     * this build ships reads a `local` key through this router". The screen-saver rows
     * then shipped as `layer: local`, so the write answered ok, the saver changed, and the
     * value was gone at the next load. Measured on the bench tablet 28 August 2026: 23
     * keys in localStorage and exactly one of them the skin's.
     *
     * Asserted through `boot.storage` on a real logical key rather than on the shape of
     * the backends map, because the defect was never in the map — it was that nothing
     * carried a Window to it. */
    test('bootFromWindow writes a local-layer setting to the window it was given', async () => {
        const store = new Map();
        const win = fakeWindowFor(store);
        const boot = bootFromWindow({ window: win, createSocket: () => ({}) });

        assert.equal(await boot.storage.set('screensaverType', 'clock'), true);
        assert.equal(store.get('decal.screensaverType'), JSON.stringify('clock'),
            'the value must reach the real localStorage, not an in-memory stand-in');
        assert.equal(await boot.storage.get('screensaverType'), 'clock');
    });

    test('an injected backends still wins, so a test keeps control', async () => {
        const store = new Map();
        const win = fakeWindowFor(store);
        const boot = bootFromWindow({
            window: win,
            createSocket: () => ({}),
            backends: { [LAYERS.local]: createMemoryBackend(), [LAYERS.session]: createMemoryBackend() },
        });

        await boot.storage.set('screensaverType', 'clock');
        assert.equal(store.size, 0, 'an injected backend must not be overridden by the window');
    });

    test('a WebView that throws on localStorage still boots', async () => {
        const win = fakeWindowFor(new Map());
        Object.defineProperty(win, 'localStorage', {
            get() { throw new Error('private mode'); },
        });

        const boot = bootFromWindow({ window: win, createSocket: () => ({}) });
        assert.equal(await boot.storage.set('screensaverType', 'clock'), true,
            'a shell that cannot remember a setting still has to boot');
    });

    test('bootFromWindow is the only place ambient state is read, and it says so', () => {
        const source = repoFile('src/lib/app-boot.js');
        const body = source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
        const ambient = [...body.matchAll(/\b(globalThis|window|document|localStorage|navigator)\b/g)];
        // Every remaining mention must be inside bootFromWindow, which is the last
        // function in the file. Cheap, and it is what keeps the module node-testable.
        const boundary = body.indexOf('export function bootFromWindow');
        assert.ok(boundary > 0);
        for (const match of ambient) {
            assert.ok(match.index > boundary,
                `'${match[0]}' is read outside bootFromWindow — the module stops being testable without a browser`);
        }
    });
});

/* ===========================================================================
 * THE REAPRIME ADDRESS — the other key nothing read
 * ======================================================================== */

describe('the stored ReaPrime address decides which machine the app talks to', () => {
    /* THE FIELD DID NOTHING. Connection > Machine has offered a `ReaPrime address` since
     * the settings screen was built; it wrote the routed key and nothing read it, so a
     * tablet pointed at another host kept talking to the one that served the page.
     *
     * IT IS READ IN `bootFromWindow` and nowhere else — the one function that touches
     * ambient state, and the only place that CAN read this key: the storage router's KV
     * layers are addressed at the very machine this value names, which is why the routing
     * table calls it a `local` row and says "Cannot live in the store it addresses." */
    const windowWith = (stored, hostname = 'page-host') => ({
        location: { hostname, protocol: 'http:' },
        fetch: async () => ({ ok: true, status: 200, json: async () => ({ capabilities: [] }) }),
        localStorage: {
            getItem: (key) => (key === `${STORAGE_PREFIX}reaHostname` ? stored : null),
        },
    });

    test('a stored address is used instead of the page\'s own host', () => {
        const boot = bootFromWindow({ window: windowWith('"192.168.1.99"'), createSocket: fakeSocketFactory() });
        assert.match(boot.transport.baseUrl, /192\.168\.1\.99/);
        boot.destroy();
    });

    test('no stored address means the page\'s own host, which is every tablet until now', () => {
        const boot = bootFromWindow({ window: windowWith(null), createSocket: fakeSocketFactory() });
        assert.match(boot.transport.baseUrl, /page-host/);
        boot.destroy();
    });

    test('a blank, a non-string and unreadable storage all mean "no opinion"', () => {
        for (const stored of ['""', '"   "', '42', 'not json at all']) {
            const boot = bootFromWindow({ window: windowWith(stored), createSocket: fakeSocketFactory() });
            assert.match(boot.transport.baseUrl, /page-host/, `stored ${stored} must not re-point the app`);
            boot.destroy();
        }
        /* A locked-down WebView THROWS on the property itself. That is not an error here —
         * it is a device with no answer, and the page's own host is the answer. */
        const throwing = {
            location: { hostname: 'page-host', protocol: 'http:' },
            fetch: async () => ({ ok: true, status: 200, json: async () => ({}) }),
            get localStorage() { throw new Error('private mode'); },
        };
        const boot = bootFromWindow({ window: throwing, createSocket: fakeSocketFactory() });
        assert.match(boot.transport.baseUrl, /page-host/);
        boot.destroy();
    });
});

/* ===========================================================================
 * THE PANEL — the half the brightness slider was missing
 * ======================================================================== */

describe('the tablet\'s brightness reaches the panel', () => {
    /* FOUND 26 AUGUST 2026 by sweeping every settings row for something on the other end.
     * The Brightness page wrote `lastBrightness` into device-scoped storage; nothing
     * outside that page read it, and nothing in the skin had ever sent `setBrightness` on
     * `/ws/v1/display`. The channel was declared and its shape check was written — there
     * was simply no call site, so dragging the slider changed a number on the page and
     * nothing else.
     *
     * THE HANDLER'S FAILURE MODE IS SILENCE, which is why the shape matters more than
     * usual: `display_handler.dart` takes `brightness is int && 0..100` and answers a
     * non-integer with a log line and NO reply. A caller that sends 80.5 gets exactly what
     * it gets for a value that worked. */
    /** The KV read the restore starts is a promise chain; let it land. */
    const settleReads = async () => { for (let i = 0; i < 6; i += 1) await Promise.resolve(); };

    const openDisplay = (createSocket) => {
        const socket = createSocket.forPath('/ws/v1/display');
        assert.ok(socket, 'the boot opens the display socket');
        socket.emit('open', {});
        return socket;
    };

    test('setBrightness goes out as an integer 0..100, and rounds and clamps to get there', async () => {
        const { boot, createSocket } = bootWith();
        await boot.start();
        openDisplay(createSocket);

        assert.deepEqual(boot.live.setBrightness(80), { ok: true });
        assert.deepEqual(boot.live.setBrightness(80.4), { ok: true }, 'a slider can hand over a float');
        assert.deepEqual(boot.live.setBrightness(140), { ok: true }, 'and a caller can be wrong');
        assert.deepEqual(boot.live.setBrightness(-5), { ok: true });

        assert.deepEqual(createSocket.sentOn('/ws/v1/display'), [
            { command: 'setBrightness', brightness: 80 },
            { command: 'setBrightness', brightness: 80 },
            { command: 'setBrightness', brightness: 100 },
            { command: 'setBrightness', brightness: 0 },
        ], 'every one is an integer inside the band the handler accepts');
        boot.destroy();
    });

    test('the wake lock is TAKEN and RELEASED on the same socket the feed owns', async () => {
        /* THE SWITCH WROTE A KEY NOTHING READ. `wakeLockEnabled` had a row on the Wake Lock
         * page, a route in `storage-routes.js` and a default of true — and a sweep of
         * `src/` on 26 August 2026 found those three declarations and NO reader at all.
         * Meanwhile the skin carried FOUR ways to take the lock and called none: two
         * commands on this channel, and a REST pair in the generated table.
         *
         * THE SOCKET PAIR IS THE RIGHT ONE, and the setting's own footnote is why: it
         * promises "The wake lock releases by itself when the connection to the machine
         * drops", and `display_handler.dart` tracks `overrideRequested` PER SOCKET and
         * releases it in both `onDone` and `onError`. Over REST that sentence would be
         * false, because a REST-taken lock outlives the page that asked for it. */
        const { boot, createSocket } = bootWith();
        await boot.start();
        openDisplay(createSocket);

        assert.deepEqual(boot.live.setWakeLock(true), { ok: true });
        assert.deepEqual(boot.live.setWakeLock(false), { ok: true });
        /* ANYTHING THAT IS NOT `true` IS A RELEASE. A truthy non-boolean is not somebody
         * asking to hold the screen awake. */
        assert.deepEqual(boot.live.setWakeLock('yes'), { ok: true });

        assert.deepEqual(createSocket.sentOn('/ws/v1/display'), [
            { command: 'requestWakeLock' },
            { command: 'releaseWakeLock' },
            { command: 'releaseWakeLock' },
        ]);
        boot.destroy();
    });

    test('a shut socket refuses the wake lock too, and says which half failed', async () => {
        const { boot } = bootWith();
        await boot.start();
        const result = boot.live.setWakeLock(true);
        assert.equal(result.ok, false);
        assert.match(result.reason, /socket is not open|not attached/);
        boot.destroy();
    });

    test('a shut socket is a REFUSAL, not a silent no-op', async () => {
        const { boot } = bootWith();
        await boot.start();
        /* The feed is attached and the socket has not opened, which is the ordinary state
         * for the first moments of a boot — and exactly when a restore would fire. */
        const result = boot.live.setBrightness(50);
        assert.equal(result.ok, false);
        assert.match(result.reason, /socket is not open/);
        boot.destroy();
    });

    test('there is NO restore at boot, which is Q13\'s answer', async () => {
        /* A restore lived in `app-boot` for about an hour on 26 August 2026 — it read
         * `lastBrightness` when the display socket opened and sent it, so the preference
         * would survive a reload. `overlay-hygiene.test.mjs` refused it and was right.
         *
         * ReaPrime RESTORES BRIGHTNESS ITSELF when it sees an awake machine at requested
         * brightness 0, and with a fully black screensaver that makes two restore paths on
         * the wake edge — of which exactly one side may drive. The skin drives the DIM and
         * stands back on the RESTORE. A socket opening after a sleep IS that edge.
         *
         * So a boot sends NOTHING on this channel, whatever is stored. */
        const kv = createMemoryBackend({ lastBrightness: 42 });
        const { boot, createSocket } = bootWith({ backends: { kv } });
        await boot.start();
        openDisplay(createSocket);
        await settleReads();
        assert.deepEqual(createSocket.sentOn('/ws/v1/display'), [],
            'the skin has no opinion about brightness at a moment ReaPrime already owns');
        boot.destroy();
    });

    test('a value the handler would drop in silence never leaves', async () => {
        const { boot, createSocket } = bootWith();
        await boot.start();
        openDisplay(createSocket);
        assert.deepEqual(boot.live.setBrightness('bright'), { ok: false, reason: 'brightness must be a number' });
        assert.deepEqual(createSocket.sentOn('/ws/v1/display'), [], 'nothing went out');
        boot.destroy();
    });
});

/* ===========================================================================
 * The contract check for what the boot touches (DECISIONS.md:144-157)
 * ======================================================================== */

describe('the boot\'s contract surface', () => {
    const table = JSON.parse(repoFile('src/data/CONTRACTS.json'));
    const pin = table.pinnedCommit;

    test('the one REST route the boot causes is tabled, at the pin', () => {
        const row = table.rest.find((r) => r.id === 'getMachineCapabilities');
        assert.ok(row, 'GET /api/v1/machine/capabilities must be in the table');
        assert.equal(row.path, '/api/v1/machine/capabilities');
        assert.equal(row.verb, 'GET');
        assert.deepEqual(row.requestFields, { query: [], body: null });
        assert.equal(row.checkedCommit, pin);
        assert.equal(row.status, 'consumed');
    });

    test('the six sockets the boot opens are tabled, at the pin', () => {
        const opened = ['machineSnapshot', 'scaleSnapshot', 'shotState', 'devices', 'display', 'update'];
        for (const id of opened) {
            const row = table.sockets.find((r) => r.id === id);
            assert.ok(row, `${id} must be in the socket table`);
            assert.equal(row.checkedCommit, pin, `${id} was checked at a different commit`);
            assert.equal(row.status, 'consumed');
            // And the path the boot dials is the path the table records, because both
            // come from the same WS_CHANNELS row.
            assert.equal(WS_CHANNELS[id].path, row.path);
        }
    });

    test('the shell names no route string and no route id of its own', () => {
        // Gate D scans for these; this is the same rule stated where the shell can see
        // it, because the shell is exactly the file most tempted to spell a path.
        for (const file of ['src/lib/app-boot.js', 'src/components/app-root.js', 'src/lib/app-routes.js']) {
            const body = repoFile(file).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
            assert.equal(/['"`]\/(api|ws)\/v1/.test(body), false, `${file} spells a ReaPrime path`);
        }
    });
});
