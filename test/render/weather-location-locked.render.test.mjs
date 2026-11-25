import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';

const LIVE = ['/src/screens/live-screen.js'];
const MODAL = ['/src/screens/weather-modal.js'];
const STAGE = '<div id="stage" style="inline-size: 100%; block-size: 100dvh"><live-screen></live-screen></div>';
const geometry = GATE_A_GEOMETRIES[0];
const LOCKED_NOTE = 'Set the location in Decaid Lab. This skin cannot change it.';

const FRESH = Object.freeze({
    ok: true, place: 'Brunswick, Victoria, Australia', ageMinutes: 3,
    isDay: true, code: 2, temperature: 21.4, units: 'metric', high: 26, low: 12,
    periods: [
        { id: 'am', label: 'AM', probability: 20, amount: 0.2 },
        { id: 'pm', label: 'PM', probability: 70, amount: 4.2 },
        { id: 'night', label: 'NIGHT', probability: 35, amount: 1.1 },
    ],
});

const PLACE = () => {
    const text = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : null);
    const modal = window.__h.q('live-screen')?.shadowRoot.querySelector('weather-modal')
        ?? document.querySelector('weather-modal');
    const root = modal ? modal.shadowRoot : null;
    return {
        open: Boolean(modal),
        locked: modal ? modal.locked : null,
        place: text(root?.querySelector('.place .current')),
        buttons: root ? root.querySelectorAll('.place button').length : null,
        field: Boolean(root?.querySelector('#place')),
        note: text(root?.querySelector('.place .note.locked')),
        empty: text(root?.querySelector('.body > .note')),
    };
};

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

describe('the weather location, when this skin cannot write plugin settings', () => {
    test('the Live screen opens the detail with the place and no way to change it', () => browser.withPage(
        { geometry },
        async (page) => {
            await page.mount(STAGE, LIVE);
            await page.settle(6);
            await page.evalFn(async () => {
                const { createWeatherStore } = await import('/src/stores/weather-store.js');
                const { createPluginsStore } = await import('/src/stores/plugins-store.js');
                const { r2MachineLimits } = await import('/src/data/adapters-r.js');
                let listener = null;
                const sockets = {
                    channel: () => ({ subscribe: (f) => { listener = f; return () => { listener = null; }; } }),
                };
                const weather = createWeatherStore({ sockets });
                weather.attach();
                window.__requests = [];
                const transport = {
                    socketUrl: () => 'ws://test',
                    url: (path) => `http://test${path}`,
                    async request(path, { method = 'GET' } = {}) {
                        window.__requests.push(`${method} ${path}`);
                        return { ok: false, status: 401, kind: 'http' };
                    },
                };
                const plugins = createPluginsStore({ transport });
                const screen = window.__h.q('live-screen');
                screen.limits = r2MachineLimits(['cupWarmer']).value;
                screen.boot = { weather, plugins };
                await screen.updateComplete;
                window.__send = (frame) => listener && listener(frame);
            });
            await page.settle(4);
            await page.evalFn((r) => window.__send(r), FRESH);
            await page.settle(4);
            await page.click('live-screen >>> ui-weather-corner >>> .card');
            await page.settle(4);
            const seen = await page.evalFn(PLACE);
            assert.equal(seen.open, true, 'the corner still opens the detail');
            assert.equal(seen.locked, true);
            assert.equal(seen.place, FRESH.place, 'the place is still read and shown');
            assert.equal(seen.buttons, 0, 'no Change button');
            assert.equal(seen.field, false);
            assert.equal(seen.note, LOCKED_NOTE);
            const requests = await page.eval('window.__requests');
            assert.deepEqual(requests.filter((key) => !key.startsWith('GET ')), []);
            assert.deepEqual(page.pageErrors, []);
        },
    ));

    test('a locked detail with no reading says to set the location in Decaid Lab', () => browser.withPage(
        { geometry },
        async (page) => {
            await page.mount('<weather-modal id="m" open locked></weather-modal>', MODAL);
            await page.evalFn(() => { window.__h.need('#m').reading = { ok: false, reason: 'no_location' }; });
            await page.settle(3);
            const seen = await page.evalFn(PLACE);
            assert.equal(seen.empty, 'No reading yet. Set a location in Decaid Lab and it will arrive shortly.');
            assert.equal(seen.place, 'Not set');
            assert.equal(seen.buttons, 0, 'no Set button');
            assert.equal(seen.note, LOCKED_NOTE);
            assert.deepEqual(page.pageErrors, []);
        },
    ));
});
