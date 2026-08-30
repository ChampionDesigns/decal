/**
 *.6, hist-route-conversion and bug H9's surviving half, in a real engine at both Gate A geometries.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';

const MODULES = ['/test/fixtures/history-route-fixture.js'];

const ENTRY = 'app-root >>> live-screen >>> #history-entry';
const BACK = 'app-root >>> history-screen >>> #back';

const ENTRY_CONTROL = `${ENTRY} >>> button`;
const BACK_CONTROL = `${BACK} >>> button`;

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`history route @ ${geometry.name} (${geometry.width}x${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

        const booted = (fn) => browser.withPage({ geometry }, async (page) => {
            await page.mount('', MODULES);
            const state = await page.evalFn(() => window.__history.mount());
            assert.deepEqual(page.pageErrors, [], 'the shell must boot without throwing');
            return fn(page, state);
        });

        test('the shell boots to Live, and no History screen is in the document at all',
            () => booted(async (page, state) => {
                assert.equal(state.route, 'live');
                assert.equal(state.screenTag, 'live-screen');
                assert.equal(state.historyScreens, 0,
                    'mountedWhileInactive: an inactive screen is NOT in the document (that is the overlay)');
                assert.ok(await page.exists(ENTRY),
                    'the Live foot band carries the entry affordance (§4.5: "its entry point in the Live foot band")');
            }));

        test('the entry affordance navigates by keyboard, and the address is the state',
            () => booted(async (page) => {
                await page.focusVisible(ENTRY_CONTROL);
                await page.press('Enter');
                const state = await page.evalFn(() => window.__history.waitForScreen('history-screen'));

                assert.equal(state.route, 'history', 'the shell reports the route it mounted');
                assert.equal(state.hash, '#/history', 'and the ADDRESS is the state — a hash, pushed');
                assert.equal(state.screenTag, 'history-screen');
                assert.equal(state.historyScreens, 1, 'exactly one History screen');
                assert.equal(state.liveScreens, 0,
                    'and the Live screen was REMOVED, not hidden — the whole of overlay -> route');

                assert.equal(state.activeInvoker, 'back',
                    `focus must land on the screen's own first control, not on <body>: ${state.activePath}`);
                assert.match(state.activePath, /history-screen/);
            }));

        test('back restores the route AND the caret, to the affordance that left',
            () => booted(async (page) => {
                const before = await page.evalFn(() => window.__history.state());

                await page.focusVisible(ENTRY_CONTROL);
                await page.press('Enter');
                const inHistory = await page.evalFn(() => window.__history.waitForScreen('history-screen'));
                assert.equal(inHistory.screenTag, 'history-screen');

                await page.focusVisible(BACK_CONTROL);
                await page.press('Enter');
                const back = await page.evalFn(() => window.__history.waitForScreen('live-screen'));

                assert.equal(back.route, 'live', 'back lands on Live');
                assert.equal(back.hash, '', 'and back POPS the entry that was pushed rather than pushing a third');
                assert.equal(back.historyScreens, 0, 'the History screen went with the route');
                assert.equal(back.liveScreens, 1, 'and exactly one Live screen came back');

                assert.equal(back.activeInvoker, 'history-entry',
                    `focus must return to the affordance that left: ${back.activePath}`);
                assert.match(back.activePath, /live-screen/);

                assert.equal(back.hashListeners, before.hashListeners,
                    'a swap must not add a listener (bug S10)');
            }));

        test('H9: no aria-modal, no orphaned inert, nothing left aria-hidden — on either screen',
            () => booted(async (page) => {
                const modalOnly = (list) => {
                    for (const entry of list) {
                        assert.match(entry, /^dialog:/,
                            `only a native <dialog> may carry aria-modal, got ${entry}`);
                        assert.match(entry, /:closed$/,
                            `nothing modal is up while a route is showing, got ${entry}`);
                    }
                };

                const onLive = await page.evalFn(() => window.__history.state());
                modalOnly(onLive.ariaModal);
                assert.deepEqual(onLive.screenBlockedBy, []);
                assert.deepEqual(onLive.suppressedScreens, []);

                await page.focusVisible(ENTRY_CONTROL);
                await page.press('Enter');
                const onHistory = await page.evalFn(() => window.__history.waitForScreen('history-screen'));

                modalOnly(onHistory.ariaModal);
                assert.ok(!onHistory.ariaModal.some((entry) => entry.startsWith('history-screen')),
                    'a route is not modal: H9 is aria-modal="true" with nothing inert behind it');
                assert.deepEqual(onHistory.screenBlockedBy, [],
                    'nothing inert, hidden or aria-hidden stands between the screen and the document');
                assert.deepEqual(onHistory.suppressedScreens, [],
                    'and no screen is present-but-suppressed — the one that is not showing is not there');

                const reachable = await page.evalFn(() => {
                    const out = [];
                    const walk = (root) => {
                        for (const el of root.querySelectorAll('*')) {
                            if (el.tagName === 'LIVE-SCREEN') out.push('live-screen');
                            if (el.shadowRoot) walk(el.shadowRoot);
                        }
                    };
                    walk(document);
                    return out;
                });
                assert.deepEqual(reachable, [],
                    'every control behind the old overlay stayed focusable; here there is no behind');
            }));

        test('in and out five times leaves one screen, one listener and no page error',
            () => booted(async (page) => {
                const first = await page.evalFn(() => window.__history.state());

                for (let i = 0; i < 5; i += 1) {
                    await page.focusVisible(ENTRY_CONTROL);
                    await page.press('Enter');
                    const there = await page.evalFn(() => window.__history.waitForScreen('history-screen'));
                    assert.equal(there.historyScreens, 1, `swap ${i}: one History screen`);
                    assert.equal(there.liveScreens, 0, `swap ${i}: the old screen was removed, not hidden`);

                    await page.focusVisible(BACK_CONTROL);
                    await page.press('Enter');
                    const home = await page.evalFn(() => window.__history.waitForScreen('live-screen'));
                    assert.equal(home.historyScreens, 0, `swap ${i}: and it went away again`);
                    assert.equal(home.hashListeners, first.hashListeners, `swap ${i}: no listener added`);
                }

                const after = await page.evalFn(() => window.__history.teardown());
                assert.equal(after.hashListeners, 0, 'the shell removes its listener on disconnect');
                assert.deepEqual(page.pageErrors, []);
            }));

        const staged = (want, fn) => booted(async (page) => {
            await page.focusVisible(ENTRY_CONTROL);
            await page.press('Enter');
            await page.evalFn(() => window.__history.waitForScreen('history-screen'));
            await page.evalFn((p) => window.__history.stage({
                shotOptions: [
                    { value: 'shot-1', label: '13 Aug 14:32' },
                    { value: 'shot-2', label: '13 Aug 09:07' },
                ],
                shotA: 'shot-1',
                shotB: 'shot-2',
                page: p,
            }), want);
            await page.evalFn((p) => window.__history.stagePages({ page: p }), want);
            return fn(page);
        });

        const pageBoxes = (page) => page.evalFn(() => {
            const screen = document.querySelector('app-root')
                ?.shadowRoot?.querySelector('history-screen');
            const bar = screen?.shadowRoot?.querySelector('#tabs');
            const slot = screen?.shadowRoot?.querySelector('slot[name="page"]');
            const mounted = slot ? slot.assignedElements({ flatten: true }) : [];
            const held = bar?.panels instanceof Map ? [...bar.panels.values()] : [];
            return {
                showing: screen?.page ?? null,
                boxes: mounted.map((el) => ({
                    name: el.getAttribute('data-page'),
                    height: +el.getBoundingClientRect().height.toFixed(2),
                    display: getComputedStyle(el).display,
                })),
                heldAreMounted: held.length > 0 && held.every((el) => mounted.includes(el)),
            };
        });

        for (const want of ['flow', 'power', 'data']) {
            test(`pages assigned after first render: only "${want}" has a box`,
                () => staged(want, async (page) => {
                    const state = await pageBoxes(page);

                    assert.equal(state.showing, want, 'the screen is on the tab the caller asked for');
                    assert.equal(state.boxes.length, 3,
                        'all three pages are mounted — the power page joined them in fix run 6');
                    assert.equal(state.heldAreMounted, true,
                        'every element the tab bar holds is one of the MOUNTED pages — a name-keyed '
                        + 'guard leaves it holding the detached fallbacks instead');

                    const shown = state.boxes.filter((b) => b.height > 0);
                    assert.equal(shown.length, 1,
                        `exactly one page has a box; both did before this fix (${JSON.stringify(state.boxes)})`);
                    assert.equal(shown[0].name, want, 'and it is the one the tab bank names');

                    for (const other of state.boxes.filter((b) => b.name !== want)) {
                        assert.equal(other.height, 0,
                            `the ${other.name} page is not showing and has no box at all`);
                        assert.equal(other.display, 'none',
                            'and it is not painting into the shared cell');
                    }

                    assert.deepEqual(page.pageErrors, []);
                }));
        }
    });
}
