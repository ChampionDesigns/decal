import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, BENCH } from '../harness/index.js';

const MODULES = ['/test/fixtures/settings-shell-fixture.js'];
const STAGE = '<div id="stage" style="inline-size: 100%; block-size: 100dvh"></div>';

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

describe('the panel rows follow fresh display frames', () => {
    let page;

    before(async () => {
        page = await browser.newPage({ geometry: BENCH });
        await page.mount(STAGE, MODULES);
        await page.evalFn(() => window.__settings.mount().then(() => true));
        assert.deepEqual(page.pageErrors, [], 'the screen must mount without throwing');
    });

    after(async () => { await page?.close(); });

    const openScreen = async () => {
        await page.evalFn(async () => {
            await window.__settings.selectCategory('display');
            await window.__settings.selectLeaf('display-screen');
            return true;
        });
        await page.settle();
    };

    const frame = async (value) => {
        await page.evalFn((f) => window.__settings.displayFrame(f).then(() => true), value);
        await page.settle();
    };

    const rows = () => page.evalFn(() => {
        const leaf = document.querySelector('settings-screen').shadowRoot.getElementById('leaf');
        const rowFor = (id) => leaf.shadowRoot.querySelector(`[data-row="${id}"]`);
        const slider = rowFor('display-screen-brightness')?.control?.[0] ?? null;
        const wake = rowFor('display-wake-lock-enabled')?.control?.[0] ?? null;
        const input = slider?.shadowRoot?.querySelector('input') ?? null;
        return {
            brightness: slider ? Number(slider.value) : null,

            announced: input?.getAttribute('aria-valuetext') ?? null,
            thumb: input ? Number(input.value) : null,
            wakeLock: wake ? wake.checked === true : null,
        };
    });

    test('a fresh brightness frame moves the thumb and what it announces together', async () => {
        await frame({ brightness: 80, wakeLockOverride: false });
        await openScreen();
        assert.equal((await rows()).brightness, 80, 'the row opens on what the panel serves');

        await frame({ brightness: 20, wakeLockOverride: false });

        const shown = await rows();
        assert.equal(shown.brightness, 20, 'a fresh frame is what the row shows');
        assert.equal(shown.thumb, 20, 'and the thumb is where the panel is');
        assert.match(String(shown.announced), /\b20\b/,
            'and the announced value is the same reading, not the one before it');
    });

    test('a capped brightness is drawn, not the brightness that was asked for', async () => {
        await frame({ brightness: 80, wakeLockOverride: false });
        await openScreen();

        await frame({ brightness: 30, requestedBrightness: 90, wakeLockOverride: false });

        const shown = await rows();
        assert.equal(shown.brightness, 30, 'the row states the panel, not the request');
        assert.match(String(shown.announced), /\b30\b/, 'and says so out loud');
    });

    test('a frame that moves only the wake lock still repaints the switch', async () => {
        await frame({ brightness: 40, wakeLockOverride: false });
        await openScreen();
        assert.equal((await rows()).wakeLock, false, 'the lock is off to begin with');

        await frame({ brightness: 40, wakeLockOverride: true });

        const shown = await rows();
        assert.equal(shown.wakeLock, true,
            'the lock is held, and a frame carrying no new brightness must still say so');
        assert.equal(shown.brightness, 40, 'and the brightness beside it is unchanged');
    });

    test('the echo of a brightness this page asked for updates the value it announces', async () => {
        await frame({ brightness: 80, wakeLockOverride: false });
        await openScreen();

        await page.evalFn(() => window.__settings.change('display-screen-brightness', 56)
            .then((ok) => ok));
        await page.settle();
        await frame({ brightness: 56, wakeLockOverride: false });

        const shown = await rows();
        assert.equal(shown.brightness, 56, 'the panel answered and the row agrees');
        assert.match(String(shown.announced), /\b56\b/,
            'the accessible value is derived from the same reading as the thumb');
        assert.deepEqual(await page.evalFn(() => window.__settings.brightnessSent().slice(-1)), [56],
            'and the panel was commanded once, with the number that was chosen');
    });
});
