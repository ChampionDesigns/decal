/**
 * The application shell without a browser.
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

describe('app-routes', () => {
    test('the table is well formed and Live is the default', () => {
        assertRouteTable(ROUTES);
        assert.equal(DEFAULT_ROUTE_ID, 'live');
        assert.deepEqual(routeIds(ROUTES), ['live', 'selector', 'settings', 'editor', 'history']);
        assert.equal(ROUTES.live.tag, 'live-screen');
        assert.equal(ROUTES.live.module, 'src/screens/live-screen.js');
        assert.equal(ROUTES.selector.tag, 'selector-screen');
        assert.equal(ROUTES.selector.module, 'src/screens/selector-screen.js');
        assert.equal(ROUTES.settings.tag, 'settings-screen');
        assert.equal(ROUTES.settings.module, 'src/screens/settings-screen.js');
        assert.equal(ROUTES.editor.tag, 'editor-screen');
        assert.equal(ROUTES.editor.module, 'src/screens/editor-screen.js');
        assert.equal(ROUTES.history.tag, 'history-screen');
        assert.equal(ROUTES.history.module, 'src/screens/history-screen.js');
    });

    test('nothing is planned any more, and nothing is both built and planned', () => {
        assert.deepEqual([...PLANNED_ROUTE_IDS], [],
            'every screen src/screens/README.md names is built; `history` was the last to leave');
        assert.ok(Array.isArray(PLANNED_ROUTE_IDS), 'the mechanism stays — a sixth screen is named here first');

        for (const id of routeIds(ROUTES)) {
            assert.ok(!PLANNED_ROUTE_IDS.includes(id),
                `'${id}' is both built and planned — remove it from PLANNED_ROUTE_IDS`);
        }
    });

    test('the module a route names is a file that exists', () => {
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

        const wasPlanned = resolveRoute('#/history');
        assert.equal(wasPlanned.id, 'history', 'the last planned name is now a built route');
        assert.equal(wasPlanned.match, ROUTE_MATCH.MATCHED);
        assert.equal(wasPlanned.planned, false, 'and a built route is never planned');

        const typo = resolveRoute('#/liev');
        assert.equal(typo.id, DEFAULT_ROUTE_ID);
        assert.equal(typo.match, ROUTE_MATCH.DEFAULTED);
        assert.equal(typo.planned, false);
        assert.equal(typo.requested, 'liev');

        const table = { live: ROUTES.live, history: ROUTES.history };
        const planned = ['roaster'];

        const wasNamedFirst = resolveRoute('#/roaster', table, { planned });
        assert.equal(wasNamedFirst.id, DEFAULT_ROUTE_ID, 'a planned name still renders the default');
        assert.equal(wasNamedFirst.match, ROUTE_MATCH.DEFAULTED, 'it is a fallback, not a match');
        assert.equal(wasNamedFirst.requested, 'roaster');
        assert.equal(wasNamedFirst.planned, true, 'and the shell can say the screen is coming');

        const typoOnTheSameTable = resolveRoute('#/rooster', table, { planned });
        assert.equal(typoOnTheSameTable.match, ROUTE_MATCH.DEFAULTED);
        assert.equal(typoOnTheSameTable.requested, 'rooster');
        assert.equal(typoOnTheSameTable.planned, false);

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

/** A devices frame the address layer accepts — the minimum shape. */
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

        assert.deepEqual(fetchImpl.calls, [
            { url: 'http://127.0.0.1:8080/api/v1/plugins', method: 'GET' },
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
        assert.equal(fetchImpl.calls.length, 8, 'one set at boot');

        fetchImpl.state.connected = true;
        const devices = devicesSocket(createSocket);
        devices.emit('open', {});
        devices.emit('message', { data: JSON.stringify(machineFrame('m-1')) });
        await settle(boot);

        assert.equal(fetchImpl.calls.length, 12,
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
        assert.equal(fetchImpl.calls.length, 12, 'nothing is asked of a machine that is not there');

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
        const boundary = body.indexOf('export function bootFromWindow');
        assert.ok(boundary > 0);
        for (const match of ambient) {
            assert.ok(match.index > boundary,
                `'${match[0]}' is read outside bootFromWindow — the module stops being testable without a browser`);
        }
    });
});

describe('the stored ReaPrime address decides which machine the app talks to', () => {
    const windowWith = (stored, hostname = 'page-host') => ({
        location: { hostname, protocol: 'http:' },
        fetch: async () => ({ ok: true, status: 200, json: async () => ({ capabilities: [] }) }),
        localStorage: {
            getItem: (key) => (key === `${STORAGE_PREFIX}reaHostname` ? stored : null),
        },
    });

    test('a stored address is used instead of the page\'s own host', () => {
        const boot = bootFromWindow({ window: windowWith('"192.0.2.10"'), createSocket: fakeSocketFactory() });
        assert.match(boot.transport.baseUrl, /192\.0\.2\.10/);
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
        /* A locked-down WebView THROWS on the property itself. That is not an error here
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

describe('the tablet\'s brightness reaches the panel', () => {
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
            assert.equal(WS_CHANNELS[id].path, row.path);
        }
    });

    test('the shell names no route string and no route id of its own', () => {
        for (const file of ['src/lib/app-boot.js', 'src/components/app-root.js', 'src/lib/app-routes.js']) {
            const body = repoFile(file).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
            assert.equal(/['"`]\/(api|ws)\/v1/.test(body), false, `${file} spells a ReaPrime path`);
        }
    });
});
