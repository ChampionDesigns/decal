/**
 * gallery.render.test.mjs — the gallery scaffold, driven the way the capture battery
 * will drive it.
 *
 * The gallery is scaffolding rather than shipping surface, but it is scaffolding the
 * rest of the run stands on: Gate B's capture battery walks it, every wave from 1 to
 * 4 adds entries to it, and "the gallery gives them subjects from the first
 * component on" (SCOPE Part 10 §13). A gallery that silently stops mounting is a
 * battery photographing an empty stage — the same class of failure as a guard that
 * stops covering its target.
 *
 * So this suite asserts the machine-facing contract, not the look:
 *   - every registered state mounts, settles, and leaves no page error;
 *   - `window.__gallery.states()` enumerates them with unique ids;
 *   - `?state=` and `?theme=` select on load, so a battery can navigate instead of
 *     scripting;
 *   - `document.body.dataset.gallerySettled` is the signal to shoot on;
 *   - a state's `hostStyle` really resizes the container the component reads.
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, BENCH } from '../harness/index.js';

const GALLERY = '/tools/gallery/index.html';

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

test('the gallery enumerates its states with unique ids', async () => {
    await browser.withPage({ geometry: BENCH }, async (page) => {
        await page.goto(GALLERY);
        await page.eval('window.__gallery.ready');
        const states = await page.eval('JSON.stringify(window.__gallery.states())');
        const parsed = JSON.parse(states);
        assert.ok(parsed.length >= 1, 'the gallery must have at least one subject tonight');
        assert.equal(new Set(parsed.map((s) => s.id)).size, parsed.length, 'state ids are capture filenames');
        assert.deepEqual(page.pageErrors, []);
    });
});

test('every registered state mounts and settles', async () => {
    await browser.withPage({ geometry: BENCH }, async (page) => {
        await page.goto(GALLERY);
        await page.eval('window.__gallery.ready');
        const states = JSON.parse(await page.eval('JSON.stringify(window.__gallery.states())'));

        for (const state of states) {
            await page.evalFn((id) => window.__gallery.show(id), state.id);
            const body = await page.evalFn(() => ({
                shown: document.body.dataset.galleryState,
                settled: document.body.dataset.gallerySettled,
                children: document.getElementById('stage-host').childElementCount,
            }));
            assert.equal(body.shown, state.id);
            assert.equal(body.settled, '1', `${state.id} never settled`);
            assert.ok(body.children > 0, `${state.id} mounted nothing`);
            assert.deepEqual(page.pageErrors, [], `${state.id} threw`);
        }
    });
});

test('?state= and ?theme= select on load, so the battery can just navigate', async () => {
    await browser.withPage({ geometry: BENCH }, async (page) => {
        await page.goto(`${GALLERY}?state=base-fixture--narrow-container&theme=light`);
        await page.eval('window.__gallery.ready');
        const shown = await page.eval('document.body.dataset.galleryState');
        const theme = await page.eval('document.documentElement.dataset.theme');
        assert.equal(shown, 'base-fixture--narrow-container');
        assert.equal(theme, 'light');

        // And the theme really reaches the mounted component, through tokens only.
        const ink = await page.prop('base-fixture >>> #plain', 'color');
        const token = await page.resolveToken('--ui-text', 'color');
        assert.equal(ink, token);
    });
});

test('a state\'s hostStyle resizes the container the component reads', async () => {
    await browser.withPage({ geometry: BENCH }, async (page) => {
        await page.goto(`${GALLERY}?state=base-fixture--default`);
        await page.eval('window.__gallery.ready');
        const wide = await page.prop('base-fixture >>> #container-probe', 'block-size');

        await page.evalFn((id) => window.__gallery.show(id), 'base-fixture--narrow-container');
        const narrow = await page.prop('base-fixture >>> #container-probe', 'block-size');

        assert.equal(wide, '40px', 'the default state fills the stage');
        assert.equal(narrow, '10px', 'hostStyle 380px puts the component below its own 400px breakpoint');
        // Same viewport for both — which is the whole of spec §2.1 Rule 1.
        assert.equal(await page.eval('innerWidth'), BENCH.width);
    });
});

test('the gallery is theme-switchable in place', async () => {
    await browser.withPage({ geometry: BENCH }, async (page) => {
        await page.goto(`${GALLERY}?theme=dark`);
        await page.eval('window.__gallery.ready');
        const dark = await page.prop('base-fixture >>> #plain', 'background-color');
        await page.click('header button[data-theme="light"]');
        const light = await page.prop('base-fixture >>> #plain', 'background-color');
        assert.notEqual(dark, light, 'the two theme blocks must differ, or theming is not wired');
    });
});
