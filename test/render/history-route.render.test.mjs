/**
 * history-route.render.test.mjs — wave 5.6, `hist-route-conversion` and bug H9's
 * surviving half, in a real engine at both Gate A geometries.
 *
 * WHAT ONLY A BROWSER CAN SAY, and it is the phase's headline proof. The route TABLE is
 * pinned without a DOM in `test/app-shell.test.mjs`; what needs the engine is that
 * History is REACHED like a place and LEFT like a place:
 *
 *   - the Live foot band's affordance navigates, by keyboard, and the address changes.
 *     It rides BESIDE the rating control rather than under it, which is a measured
 *     placement recorded at the call site in `live-screen.js` — stacked as a third row
 *     it takes the controls column to 248px against a band that clamps at 240px (40% of
 *     600) and fires C2's last-resort scroll at the design floor, and in the header's
 *     destination cluster it takes the favourites bank under `--ui-hit-min`. This suite
 *     asserts the affordance is ON LIVE and that it NAVIGATES; where it sits and what
 *     it costs is `live-bands.render.test.mjs`'s, so neither file states it twice;
 *   - the screen that is not showing IS NOT IN THE DOCUMENT — not hidden, not inert,
 *     not `display: none`, not there. An always-mounted screen behind a style is the
 *     `display:flex` toggle §4.5 replaces, wearing a route's name;
 *   - focus lands deterministically on arrival and is RESTORED to the affordance that
 *     left, which is the phase-2 dialog contract (`invoker`) applied to a route — the
 *     only part of H9 that survives the conversion;
 *   - nothing carries `aria-modal`, nothing is left `inert`, nothing is left
 *     `aria-hidden`. H9 is all four at once ("both big overlays are aria-modal=true
 *     with nothing inert, nothing aria-hidden, no focus trap and no focus restore"),
 *     and a route must not reproduce any of them in a new costume;
 *   - and the swap leaks nothing: one `hashchange` listener, before and after.
 *
 * A8: nothing here opens a file. Every assertion is a rendered state read out of the
 * live document.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';

const MODULES = ['/test/fixtures/history-route-fixture.js'];

const ENTRY = 'app-root >>> live-screen >>> #history-entry';
const BACK = 'app-root >>> history-screen >>> #back';

/* THE CONTROL INSIDE THE AFFORDANCE. Focus goes inward: #1 forwards `focus()` to the
 * native button in its own shadow root, so the box a keyboard actually lands on is that
 * button and the affordance is its host. The suite focuses the control and asserts on
 * the host, which is the same element a person would name. */
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

        /* -- 1. the route exists and Live is where you start ---------------- */

        test('the shell boots to Live, and no History screen is in the document at all',
            () => booted(async (page, state) => {
                assert.equal(state.route, 'live');
                assert.equal(state.screenTag, 'live-screen');
                assert.equal(state.historyScreens, 0,
                    'mountedWhileInactive: an inactive screen is NOT in the document (that is the overlay)');
                assert.ok(await page.exists(ENTRY),
                    'the Live foot band carries the entry affordance (§4.5: "its entry point in the Live foot band")');
            }));

        /* -- 2. in, by keyboard --------------------------------------------- */

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

                /* FOCUS LANDS DETERMINISTICALLY. Not "wherever the browser left it":
                 * the caret is on the way out, which is the control a keyboard user
                 * needs first and the one a screen reader announces the screen by. */
                assert.equal(state.activeInvoker, 'back',
                    `focus must land on the screen's own first control, not on <body>: ${state.activePath}`);
                assert.match(state.activePath, /history-screen/);
            }));

        /* -- 3. back, by keyboard, with the caret put back ------------------ */

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

                /* backRestoresFocus. The dialog contract, applied to a route: the
                 * invoker is named on the way out and the caret returns to it — across
                 * a swap that destroyed and rebuilt the element it names. */
                assert.equal(back.activeInvoker, 'history-entry',
                    `focus must return to the affordance that left: ${back.activePath}`);
                assert.match(back.activePath, /live-screen/);

                assert.equal(back.hashListeners, before.hashListeners,
                    'a swap must not add a listener (bug S10)');
            }));

        /* -- 4. H9, all four halves of it ----------------------------------- */

        test('H9: no aria-modal, no orphaned inert, nothing left aria-hidden — on either screen',
            () => booted(async (page) => {
                /* WHERE aria-modal IS ALLOWED TO BE, and it is not nowhere: the
                 * phase-2 dialog contract EARNS it on a native <dialog> opened with
                 * showModal() — H9's complaint is not the attribute, it is the
                 * attribute with nothing inert, nothing aria-hidden, no trap and no
                 * restore behind it. Live carries `<ui-dialog>`'s numpad, CLOSED, and
                 * a closed dialog holding the attribute it will need is correct. So
                 * the assertion is: only a native dialog may carry it, and none of
                 * them is open while a route is on screen. */
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

                /* AND THERE IS NOTHING TO TRAP. The document holds one screen, so the
                 * focusable set IS this screen: the trap a modal needs is a question
                 * about a document with two layers, and this one has none. */
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

        /* -- 5. the swap is clean, five times over -------------------------- */

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

        /* -- 6. the pages a CALLER assigns are the pages #32 shows ----------- */

        /**
         * WAVE 5.6's ONE BLOCK, and it is a ROUTE-level defect rather than a page one.
         *
         * A caller that assigns pages AFTER the screen has rendered its own fallback
         * replaces the two ELEMENTS while the page NAMES stay `flow data`. `#wirePages`
         * keyed its early return on the names, so `bar.panels` went on pointing at the
         * two DETACHED fallbacks and NEITHER mounted page was ever marked hidden: both
         * painted into the one grid cell — flow and data both 591 tall at bench and both
         * 404.75 at the floor — with shot B's phase-table Total row showing through the
         * 12px gap between the flow page's two chart cards. `api.stagePages()` is that
         * path and every gallery frame of this screen drives it, so both captured
         * History frames photographed the defect.
         *
         * A8: read as rendered boxes. On EITHER tab exactly one page has a box, the other
         * has none, and every element the tab bar holds is one of the pages that are
         * actually mounted — the last clause is what a name-keyed guard cannot satisfy.
         */
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
