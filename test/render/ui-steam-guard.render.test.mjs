/**
 * The puff guard, rendered: it covers the screen, it blurs what is behind it, and it
 * carries the one press that ends the puff.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';

const MODULE = ['/src/components/ui-steam-guard.js'];

/* The guard is positioned against its own screen, so the stage stands in for one. */
const MARKUP = `
    <style>
      #screen {
          position: relative;
          inline-size: 100vw;
          block-size: 100vh;
          background-color: var(--ui-fascia);
      }
    </style>
    <div id="screen">
        <p id="behind">the chart behind the guard</p>
        <ui-steam-guard id="guard" open></ui-steam-guard>
        <ui-steam-guard id="shut"></ui-steam-guard>
    </div>`;

const near = (got, want, what, tol = 1.01) => assert.ok(
    Math.abs(got - want) <= tol,
    `${what}: expected ${want}, got ${got}`,
);

let browser;

before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`ui-steam-guard @ ${geometry.name} (${geometry.width}x${geometry.height})`, () => {
        const mounted = (fn) => browser.withPage({ geometry }, async (page) => {
            await page.mount(MARKUP, MODULE);
            assert.deepEqual(page.pageErrors, [], 'the component must mount without throwing');
            return fn(page);
        });

        test('shut: nothing renders and nothing takes a press', () => mounted(async (page) => {
            assert.equal((await page.computed('#shut', ['display'])).display, 'none');
            assert.equal(await page.exists('#shut >>> .panel'), false);
            assert.equal(await page.exists('#shut >>> button'), false);
        }));

        test('open: the guard covers its screen and blurs what is behind it',
            () => mounted(async (page) => {
                const screen = await page.box('#screen');
                const host = await page.box('#guard');
                near(host.width, screen.width, 'the guard spans the screen');
                near(host.height, screen.height, 'and its full height');

                const scrim = await page.computed('#guard >>> .scrim',
                    ['background-color', 'backdrop-filter']);
                assert.match(scrim['backdrop-filter'], /blur\(/, 'the background is blurred');
                assert.notEqual(scrim['background-color'], 'rgba(0, 0, 0, 0)', 'the scrim paints');
            }));

        test('the panel takes between a quarter and a third of the screen area',
            () => mounted(async (page) => {
                const screen = await page.box('#screen');
                const panel = await page.box('#guard >>> .panel');
                const share = (panel.width * panel.height) / (screen.width * screen.height);
                assert.ok(share >= 0.2 && share <= 0.36, `the panel takes ${share} of the area`);

                /* CENTRED, LIKE A MODAL. Both midpoints, not one. */
                near(panel.left + panel.width / 2, screen.left + screen.width / 2,
                    'centred across', 2);
                near(panel.top + panel.height / 2, screen.top + screen.height / 2,
                    'centred down', 2);
            }));

        test('the headline carries the danger ink, and it is the only place that does',
            () => mounted(async (page) => {
                const danger = await page.resolveToken('--ui-status-danger');
                const headline = await page.computed('#guard >>> .headline', ['color']);
                assert.equal(headline.color, danger);

                const reason = await page.computed('#guard >>> .reason', ['color']);
                assert.notEqual(reason.color, danger, 'the reason is ordinary ink, not loud');
            }));

        test('it states what is happening, why, and what to do', () => mounted(async (page) => {
            const text = await page.evalFn((id) => {
                const root = document.getElementById(id).shadowRoot;
                return [...root.querySelectorAll('p')].map((p) => p.textContent.trim());
            }, 'guard');
            assert.deepEqual(text, [
                'Steam is still on',
                'The wand puffs quietly, so it is easy to miss.',
                'Press stop to purge and clean it.',
            ]);
        }));

        test('the guard carries its own stop, and the press leaves the component',
            () => mounted(async (page) => {
                assert.equal(await page.exists('#guard >>> #stop >>> button'), true,
                    'the user never has to reach the rail');

                await page.recordEvents('#screen', ['stop-request']);
                await page.click('#guard >>> #stop >>> button');
                await page.settle(2);
                const events = await page.recordedEvents();
                assert.equal(events.length, 1,
                    'one stop-request escapes the guard, so there is ONE stop path, not two');
            }));

        test('nothing behind the guard can be pressed through it', () => mounted(async (page) => {
            const scrim = await page.box('#guard >>> .scrim');
            const behind = await page.box('#behind');
            assert.ok(scrim.top <= behind.top && scrim.bottom >= behind.bottom,
                'the scrim covers what is behind it');
            const hit = await page.eval(
                `document.elementFromPoint(${Math.round(behind.left + 2)}, ${Math.round(behind.top + 2)}).tagName`,
            );
            assert.equal(String(hit).toLowerCase(), 'ui-steam-guard');
        }));
    });
}
