/**
 * One shot whose record never lands, and every pull after it. A pending shot is
 * dismissed when a person presses Older, and the dismissal is released when the shell
 * names a new shot; it does not move the arrows.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, BENCH } from '../harness/index.js';

const MODULES = ['/test/fixtures/live-saved-shot-fixture.js'];
const STAGE = '<div id="stage" style="inline-size: 100%; block-size: 100dvh"></div>';

/** Everything the band's state comes down to, read off the mounted screen. */
const INSTALL = () => {
    window.__band = () => {
        const screen = window.__h.q('live-screen');
        const card = screen.renderRoot.querySelector('ui-chart-card');
        return {
            browsing: screen.browsingHistory,
            shotId: screen.shotId,
            canStepOlder: !screen.renderRoot.getElementById('shot-older').disabled,
            chartDraws: card ? Boolean(card.derivation) : null,
        };
    };
    return true;
};

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

/** `instantRetry` spends the shell's whole looking window at once; the asks are unchanged. */
const staged = (fn, { instantRetry = true } = {}) => browser.withPage({ geometry: BENCH }, async (page) => {
    await page.mount(STAGE, MODULES);
    await page.evalFn(() => window.__savedShot.reset());
    await page.evalFn((instant) => window.__savedShot.mount({ instantRetry: instant }), instantRetry);
    assert.deepEqual(page.pageErrors, [], 'the shell boots without throwing');
    await page.evalFn(INSTALL);
    await fn(page);
});

/** Pull a shot whose record the server never writes, and wait for the app to give up. */
const loseAShot = (page, id) => page.evalFn(async (shotId) => {
    await window.__savedShot.pullShot({ id: shotId, title: 'Lost', landAfter: 9999 });
    const started = performance.now();
    while (window.__savedShot.saved().status !== 'unavailable' && performance.now() - started < 8000) {
        await new Promise((resolve) => { setTimeout(resolve, 20); });
    }
    return { saved: window.__savedShot.saved(), ...window.__band() };
}, id);

describe('a shot whose record never lands @ bench', () => {
    test('the next shot releases the dismissal, and the band is about that shot',
        () => staged(async (page) => {
            const lost = await loseAShot(page, 'shot-lost');
            assert.equal(lost.saved.status, 'unavailable',
                'the shell gave up on the record, which is the state under test');

            const stepped = await page.evalFn(async () => {
                await window.__savedShot.stepOlder();
                return window.__band();
            });
            assert.equal(stepped.browsing, true,
                'stepping off a shot with no record IS browsing — the band is about a stored row');

            const next = await page.evalFn(async () => {
                await window.__savedShot.pullShot({ id: 'shot-next', title: 'Next', landAfter: 1 });
                await window.__savedShot.letItLand(2);
                return { saved: window.__savedShot.saved(), ...window.__band() };
            });

            assert.equal(next.saved.status, 'ready', 'the second shot did land');
            assert.equal(next.shotId, 'shot-next', 'and the band names it');
            assert.equal(next.browsing, false,
                'the band is back on the newest shot — the lost record does not latch it');
            assert.deepEqual(page.pageErrors, []);
        }));

    test('a LATER shot whose record is slow still draws its own plot',
        () => staged(async (page) => {
            await loseAShot(page, 'shot-lost');
            await page.evalFn(() => window.__savedShot.stepOlder());
            await page.evalFn(async () => {
                await window.__savedShot.pullShot({ id: 'shot-next', title: 'Next', landAfter: 1 });
                await window.__savedShot.letItLand(2);
                return true;
            });

            const third = await page.evalFn(async () => {
                await window.__savedShot.pullShot({ id: 'shot-third', title: 'Third', landAfter: 9999 });
                return { saved: window.__savedShot.saved(), ...window.__band() };
            });

            assert.equal(third.chartDraws, true,
                'the chart draws the shot that has just been pulled');
            assert.equal(third.browsing, false,
                'and the band is not browsing, because nobody stepped off THIS shot');
            assert.deepEqual(page.pageErrors, []);
        }));

    test('a republish about the SAME shot releases nothing', () => staged(async (page) => {
        const stepped = await page.evalFn(async () => {
            await window.__savedShot.pullShot({ id: 'shot-slow', title: 'Slow', landAfter: 9999 });
            const before = window.__savedShot.saved();
            await window.__savedShot.stepOlder();
            return { before, ...window.__band() };
        });
        assert.equal(stepped.before.status, 'waiting',
            'the step happens while the shell is still looking for the record');
        assert.equal(stepped.browsing, true, 'and it puts the band on a stored row');

        const gaveUp = await page.evalFn(async () => {
            const started = performance.now();
            while (window.__savedShot.saved().status !== 'unavailable'
                && performance.now() - started < 8000) {
                await new Promise((resolve) => { setTimeout(resolve, 20); });
            }
            return { saved: window.__savedShot.saved(), ...window.__band() };
        });

        assert.equal(gaveUp.saved.status, 'unavailable', 'the shell used up its looks');
        assert.ok(gaveUp.saved.attempts > stepped.before.attempts,
            'republishing about the same shot several times on the way');
        assert.equal(gaveUp.browsing, true,
            'and the band stayed where the person put it');
        assert.deepEqual(page.pageErrors, []);
    }, { instantRetry: false }));
});
