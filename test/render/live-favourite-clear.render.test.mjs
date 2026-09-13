/**
 * Clearing a favourite from the Live rail, and whether the screen says what became of
 * the press. The store and the screen are the shipped ones; only the transport and a
 * router whose writes refuse are supplied.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, BENCH } from '../harness/index.js';

const MODULE = ['/src/screens/live-screen.js'];
const STAGE = '<div id="stage" style="inline-size: 100%; block-size: 100dvh"><live-screen></live-screen></div>';

/** Two rows, so a rail can hold one and a clear can be about a real profile. */
const RECORDS = [
    {
        id: 'profile:one', profile: { title: 'Extractamundo Dos!', version: '2', author: 'Decent', steps: [] },
        visibility: 'visible', isDefault: false, parentId: null, metadata: null,
        createdAt: '2026-09-01T10:00:00', updatedAt: '2026-09-01T10:00:00',
    },
    {
        id: 'profile:two', profile: { title: 'Temp test', version: '2', author: 'Decent', steps: [] },
        visibility: 'visible', isDefault: false, parentId: null, metadata: null,
        createdAt: '2026-09-01T11:00:00', updatedAt: '2026-09-01T11:00:00',
    },
];

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

/**
 * A Live screen with the real library store behind it. `writes` says whether the router
 * persists, and the rail is seeded before `load()` so slot two really holds a profile.
 */
const stand = (writes, fn) => browser.withPage({ geometry: BENCH }, async (page) => {
    await page.mount(STAGE, MODULE);
    await page.evalFn(async (persists, records) => {
        const { createProfileLibraryStore } = await import('/src/stores/profile-library-store.js');
        const { createProfileArmStore } = await import('/src/stores/profile-arm-store.js');
        const { createStorageRouter } = await import('/src/lib/storage-router.js');
        const { createMemoryBackend } = await import('/src/lib/storage-backends.js');
        const { LAYERS } = await import('/src/lib/storage-routes.js');
        const { FAVOURITES_KEY, FAVOURITES_SEEDED_KEY } = await import('/src/lib/profile-rules.js');

        const answers = {
            '/profiles': { ok: true, status: 200, data: records, notModified: false },
            '/workflow': { ok: true, status: 200, data: {}, notModified: false },
        };
        const transport = {
            request: async (path, options = {}) => answers[`${options.method ?? 'GET'} ${path}`]
                ?? answers[path]
                ?? { ok: false, kind: 'http', status: 503, message: 'no recording', problem: null },
        };
        const backing = createStorageRouter({
            backends: {
                [LAYERS.kv]: createMemoryBackend(),
                [LAYERS.kvNumpad]: createMemoryBackend(),
                [LAYERS.local]: createMemoryBackend(),
                [LAYERS.session]: createMemoryBackend(),
            },
        });
        await backing.set(FAVOURITES_KEY, {
            0: records[0].id, 1: records[1].id, 2: null, 3: null, 4: null,
        });
        await backing.set(FAVOURITES_SEEDED_KEY, true);
        /* Reads normally, refuses every write; the refusal is a flag rather than a wiring, so a
           retry after storage came back is a second press against the same surface. */
        window.__favWrites = false;
        const storage = persists ? backing : {
            ...backing,
            get: (...a) => backing.get(...a),
            set: async (...a) => (window.__favWrites ? backing.set(...a) : false),
        };

        const library = createProfileLibraryStore({
            transport, storage, arm: createProfileArmStore({ transport }),
        });
        await library.load();

        const screen = document.querySelector('live-screen');
        screen.boot = { library };
        await screen.updateComplete;
        window.__fav = { library, backing, screen };
    }, writes, RECORDS);
    await page.settle(4);
    assert.deepEqual(page.pageErrors, [], 'the screen must mount without throwing');
    await fn(page);
    assert.deepEqual(page.pageErrors, [], 'and run without throwing');
});

/** Press "Clear this favourite" on the disc a person reads as `slot`. The mark is 1-based. */
const clear = (page, slot) => page.evalFn(async (mark) => {
    const { screen } = window.__fav;
    screen.dispatchEvent(new CustomEvent('favourite-action', {
        detail: { action: 'clear', slot: mark, value: null },
        bubbles: true,
        composed: true,
    }));
    await new Promise((resolve) => setTimeout(resolve, 120));
    await screen.updateComplete;
}, slot);

/** What the banner says, and what the rail holds. */
const surface = (page) => page.evalFn(async () => {
    const { library, backing, screen } = window.__fav;
    const banner = screen.shadowRoot.getElementById('refusal');
    await banner.updateComplete;
    const alert = banner.shadowRoot.getElementById('banner');
    return {
        kind: banner.getAttribute('kind'),
        said: alert ? alert.textContent.replace(/\s+/g, ' ').trim() : null,
        slot: library.get().favourites.assignments[1] ?? null,
        stored: (await backing.get('favouriteProfiles'))[1] ?? null,
    };
});

describe('clearing a favourite from the Live rail', () => {

    test('says so when the rail could not be persisted, and leaves the slot alone',
        () => stand(false, async (page) => {
            await clear(page, 2);
            const shown = await surface(page);
            assert.equal(shown.slot, 'profile:two',
                'the store patches nothing on a failed write, so the disc still holds it');
            assert.equal(shown.stored, 'profile:two',
                'and it comes back at the next load, which is what a silent clear hides');
            assert.equal(shown.kind, 'favourite', 'the banner is up');
            assert.ok(shown.said.includes('Favourite 2 could not be cleared'),
                `the banner reads "${shown.said}"`);
        }));

    test('says nothing when it worked, and the slot is empty',
        () => stand(true, async (page) => {
            await clear(page, 2);
            const shown = await surface(page);
            assert.equal(shown.slot, null, 'the disc is empty');
            assert.equal(shown.stored, null, 'and stays empty across a load');
            assert.equal(shown.kind, null, 'a press that worked says nothing');
        }));

    test('a retry that succeeds takes the failed press\'s sentence away',
        () => stand(false, async (page) => {
            await clear(page, 2);
            assert.equal((await surface(page)).kind, 'favourite',
                'the press that could not be persisted says so');

            await page.evalFn(() => { window.__favWrites = true; return true; });
            await clear(page, 2);

            const shown = await surface(page);
            assert.equal(shown.slot, null, 'the disc is empty this time');
            assert.equal(shown.stored, null, 'and the rail persisted, so it stays empty');
            assert.equal(shown.kind, null,
                `the slot is empty, so nothing may still say it could not be cleared — "${shown.said}"`);
        }));

    test('a second failure replaces the sentence rather than stacking on it',
        () => stand(false, async (page) => {
            await clear(page, 2);
            await clear(page, 1);

            const shown = await page.evalFn(async () => {
                const { screen } = window.__fav;
                const banner = screen.shadowRoot.getElementById('refusal');
                await banner.updateComplete;
                const alert = banner.shadowRoot.getElementById('banner');
                return {
                    banners: banner.shadowRoot.querySelectorAll('#banner').length,
                    said: alert.textContent.replace(/\s+/g, ' ').trim(),
                };
            });
            assert.equal(shown.banners, 1, 'one press, one banner');
            assert.ok(shown.said.includes('Favourite 1'),
                `the sentence is about the press in hand — "${shown.said}"`);
            assert.ok(!shown.said.includes('Favourite 2'),
                'and not about the one before it as well');
        }));

    test('the banner goes away when it is dismissed',
        () => stand(false, async (page) => {
            await clear(page, 2);
            assert.equal((await surface(page)).kind, 'favourite');
            await page.evalFn(async () => {
                const { screen } = window.__fav;
                const banner = screen.shadowRoot.getElementById('refusal');
                banner.shadowRoot.getElementById('dismiss').click();
                await screen.updateComplete;
            });
            assert.equal((await surface(page)).kind, null,
                'a banner nothing can put away is furniture');
        }));
});
