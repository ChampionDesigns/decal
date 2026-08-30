/**
 * live-shot-order.render.test.mjs — the Live band's arrows walk the history in TIME order.
 *
 * Written 30 August 2026, round 4 of the fix campaign. Ben, testing the deployed build on
 * the tablet: *"when I tap the previous shot button it doesn't show the previous but some
 * other shot, like the order is all messed up"*, and *"the history on the live page is not
 * done well"*.
 *
 * WHAT WAS ACTUALLY BROKEN. The arrows step an integer index through the shots store's
 * `items`, and until `orderShots` the store published that array exactly as the wire sent
 * it. Nothing between the socket and the arrow ever read a shot's `timestamp`. Measured
 * here on 30 August, before the fix: with a page emitted in any order but time order,
 * "Older" walked the emission verbatim — 08:40, then 13:30, then 08:06, then 11:38 — which
 * is Ben's sentence, reproduced.
 *
 * WHY A STAGED SERVER IS THE HONEST INSTRUMENT. The tablet's own ReaPrime answers in strict
 * timestamp order today (192.168.1.73, all 921 shots, read-only, 30 Aug 2026), so a test
 * against a faithful server can only ever show the arrows agreeing with it by luck. The
 * claim under test is that the CLIENT decides the order, and the only way to see a client
 * decide is to move the server off the answer and watch the client hold. The fixture's
 * `serveOrder(mode)` is that move, and it is the only thing in it a real server does not
 * do — `limit`, `offset` and the `order` reading are `_getShots`'s own arithmetic.
 *
 * REAL PRESSES ON REAL CONTROLS. Every step below is `#shot-older` / `#shot-newer` being
 * clicked inside a mounted `<live-screen>` over a real `createAppBoot`, a real transport
 * and the shipping shots store. Nothing dispatches `shot-step` by hand: the event's
 * direction convention (+1 older) is part of what can be wrong.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';

const MODULES = ['/test/fixtures/live-shot-order-fixture.js'];
const STAGE = '<div id="stage" style="inline-size: 100%; block-size: 100dvh"></div>';

/**
 * The staged archive, newest first, as `live-shot-order-fixture.js` holds it. Two shots
 * share one instant on purpose — "the next older one" has to stay answerable when two
 * shots claim the same moment.
 */
const IN_TIME_ORDER = [
    'shot-t0',      // 2026-08-29 13:30
    'shot-t1',      // 2026-08-29 11:38
    'shot-tie-a',   // 2026-08-29 08:40  ─┬─ one instant, two shots
    'shot-tie-b',   // 2026-08-29 08:40  ─┘
    'shot-t4',      // 2026-08-29 08:30
    'shot-t5',      // 2026-08-29 08:06
    'shot-t6',      // 2026-08-28 07:48
];

const TIED = ['shot-tie-a', 'shot-tie-b'];

/**
 * The expected walk for a given emission, tie and all.
 *
 * THE TIED PAIR'S INTERNAL ORDER IS THE SERVER'S, NOT A CONSTANT — that is the rule, so
 * the expectation has to be built from the emission rather than written down once. Two
 * shots at one instant cannot be told apart by the field they carry, so the honest answer
 * is the order they arrived in, and a test that hard-coded one side of the tie would be
 * pinning an accident of the fixture instead of the rule.
 */
const expectedWalk = (emitted) => {
    const tieOrder = emitted.filter((id) => TIED.includes(id));
    let taken = 0;
    return IN_TIME_ORDER.map((id) => (TIED.includes(id) ? tieOrder[taken++] : id));
};

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`live shot order @ ${geometry.name} (${geometry.width}x${geometry.height})`, () => {

        const staged = (mode, fn) => browser.withPage({ geometry }, async (page) => {
            await page.mount(STAGE, MODULES);
            await page.settle(6);
            const emitted = await page.evalFn(async (m) => {
                const api = window.__shotOrder;
                api.reset();
                const order = api.serveOrder(m);
                const mounted = await api.mount({ limit: 25 });
                return { order, mounted };
            }, mode);
            assert.equal(emitted.mounted.rows, IN_TIME_ORDER.length, 'the whole archive is in the window');
            assert.deepEqual(page.pageErrors, [], 'the band must mount without throwing');
            await fn(page, emitted.order);
            assert.deepEqual(page.pageErrors, [], 'the band must run without throwing');
        });

        /* ═══════════════════════════════════════════════════════════════════
         * The band opens on the newest shot, whatever order the page arrived in
         * ═════════════════════════════════════════════════════════════════ */

        for (const mode of ['desc', 'shuffled', 'page-shuffled', 'asc', 'insertion']) {
            test(`the band opens on the newest shot when the page arrives ${mode}`, async () => {
                await staged(mode, async (page, emitted) => {
                    const opened = await page.evalFn(() => window.__shotOrder.band());
                    assert.equal(
                        opened.id, IN_TIME_ORDER[0],
                        `the newest shot is the band's, not the wire's first row (${emitted[0]})`,
                    );
                    /* The PAINTED identity line agrees with the property — the date a
                     * person reads off the glass is the shot the arrows are standing on. */
                    assert.equal(opened.when, '2026/08/29 13:30');
                });
            });

            test(`"Older" walks strictly back in time when the page arrives ${mode}`, async () => {
                await staged(mode, async (page, emitted) => {
                    const walked = await page.evalFn(async () => {
                        const seen = await window.__shotOrder.walkOlder(6);
                        return seen.map((b) => ({ id: b.id, at: b.timestamp }));
                    });
                    assert.deepEqual(walked.map((b) => b.id), expectedWalk(emitted));
                    /* Stated as a property as well as a sequence, because the sequence is
                     * only right if this is: every step is to an instant no later than the
                     * one before it, and the whole walk is monotonic. */
                    for (let i = 1; i < walked.length; i += 1) {
                        assert.ok(
                            walked[i].at <= walked[i - 1].at,
                            `step ${i} went FORWARD in time: ${walked[i - 1].at} -> ${walked[i].at}`,
                        );
                    }
                });
            });

            test(`"Newer" mirrors it exactly when the page arrives ${mode}`, async () => {
                await staged(mode, async (page, emitted) => {
                    const back = await page.evalFn(async () => {
                        await window.__shotOrder.walkOlder(6);
                        const seen = await window.__shotOrder.walkNewer(6);
                        return seen.map((b) => ({ id: b.id, at: b.timestamp }));
                    });
                    assert.deepEqual(back.map((b) => b.id), expectedWalk(emitted).slice().reverse());
                    for (let i = 1; i < back.length; i += 1) {
                        assert.ok(
                            back[i].at >= back[i - 1].at,
                            `step ${i} went BACKWARD in time: ${back[i - 1].at} -> ${back[i].at}`,
                        );
                    }
                });
            });
        }

        /* ═══════════════════════════════════════════════════════════════════
         * Ties — the pair the arrows must visit, in a stable order
         * ═════════════════════════════════════════════════════════════════ */

        test('both shots at one instant are visited, and in the order the server gave them', async () => {
            await staged('shuffled', async (page, emitted) => {
                const walked = await page.evalFn(async () => {
                    const seen = await window.__shotOrder.walkOlder(6);
                    return seen.map((b) => b.id);
                });
                const tie = walked.filter((id) => TIED.includes(id));
                assert.equal(tie.length, 2, 'neither shot of the tied pair is skipped');
                const first = walked.indexOf(tie[0]);
                assert.equal(walked.indexOf(tie[1]), first + 1,
                    'the tied pair is adjacent — nothing sorts between them');
                assert.equal(first, 2, 'and the pair sits where its instant belongs');
                /* THE RULE, not the constant: the pair keeps the order the WIRE sent, so
                 * two shots the field cannot tell apart are not silently reshuffled by
                 * this client either. `shuffled` emits them tie-b first, which is why
                 * this assertion is worth making here and nowhere else. */
                assert.deepEqual(tie, emitted.filter((id) => TIED.includes(id)));
            });
        });

        /* ═══════════════════════════════════════════════════════════════════
         * The window's two edges
         * ═════════════════════════════════════════════════════════════════ */

        test('the arrows stop at the true ends of the window, not at the array\'s ends', async () => {
            await staged('page-shuffled', async (page) => {
                const ends = await page.evalFn(async () => {
                    const api = window.__shotOrder;
                    const atNewest = { band: api.band().id, reach: api.reach() };
                    await api.walkOlder(6);
                    const atOldest = { band: api.band().id, reach: api.reach() };
                    /* One more press past the end must move nothing at all. */
                    const past = await api.stepOlder();
                    return { atNewest, atOldest, past: past.id };
                });
                assert.equal(ends.atNewest.band, IN_TIME_ORDER[0]);
                assert.deepEqual(ends.atNewest.reach, { older: true, newer: false },
                    'at the newest row only "Older" is live');
                assert.equal(ends.atOldest.band, IN_TIME_ORDER[IN_TIME_ORDER.length - 1]);
                assert.deepEqual(ends.atOldest.reach, { older: false, newer: true },
                    'at the oldest row in the window only "Newer" is live');
                assert.equal(ends.past, IN_TIME_ORDER[IN_TIME_ORDER.length - 1],
                    'a press past the end holds the row it is on');
            });
        });

        test('a window narrower than the archive walks its own rows in time order', async () => {
            /* `limit: 3` is the shape the real band is always in — 25 rows over an archive
             * of 921 — and the reach is the WINDOW, which is the stated design (the whole
             * archive is the History screen's pager, `live-wiring.js #onShotStep`).
             *
             * `page-shuffled` is the mode that belongs here and `shuffled` is not, and the
             * difference is the boundary of what this fix can claim. A server that orders
             * the whole ARCHIVE wrongly hands over the wrong three rows, and no client can
             * sort its way back to rows it was never sent — that is a wrong WINDOW and it
             * is reported, not repaired. What the client owns is the order INSIDE the page
             * it was given, which is what this asserts. */
            await browser.withPage({ geometry }, async (page) => {
                await page.mount(STAGE, MODULES);
                await page.settle(6);
                const out = await page.evalFn(async () => {
                    const api = window.__shotOrder;
                    api.reset();
                    const emitted = api.serveOrder('page-shuffled');
                    await api.mount({ limit: 3 });
                    const seen = await api.walkOlder(2);
                    return {
                        emitted, held: api.heldIds(),
                        walked: seen.map((b) => b.id), reach: api.reach(),
                    };
                });
                assert.deepEqual(out.held, IN_TIME_ORDER.slice(0, 3),
                    'a short window holds the newest rows the server sent, in time order');
                assert.deepEqual(out.walked, IN_TIME_ORDER.slice(0, 3));
                assert.deepEqual(out.reach, { older: false, newer: true },
                    'the third row of three is the end of the reach, and says so');
                assert.deepEqual(page.pageErrors, []);
            });
        });

        /* ═══════════════════════════════════════════════════════════════════
         * A press always moves exactly one row, including after the window shrinks
         * ═════════════════════════════════════════════════════════════════ */

        test('a press still moves one row after the window has shrunk under the index', async () => {
            /* BOTH WINDOW SIZES EXIST IN ONE SESSION: `app-boot.js askShots()` reads 25
             * into this store and `history-viewer.js start()` re-reads the SAME store at
             * 20 when the History screen opens. So an index reached on the wide window can
             * outlive it. The band clamps on read, so it draws the last row — and the step
             * used to be computed from the STALE index, which landed back on the row
             * already showing and ate the press. */
            await browser.withPage({ geometry }, async (page) => {
                await page.mount(STAGE, MODULES);
                await page.settle(6);
                const out = await page.evalFn(async () => {
                    const api = window.__shotOrder;
                    api.reset();
                    api.serveOrder('desc');
                    await api.mount({ limit: 25 });
                    await api.walkOlder(6);                 // index 6, the oldest of seven
                    const wide = api.band().id;
                    /* The History screen re-reads the same store at its own page size. */
                    await window.__shotOrder.reread(4);
                    const afterShrink = api.band().id;
                    const oneBack = await api.stepNewer();
                    return { wide, afterShrink, oneBack: oneBack.id, held: api.heldIds() };
                });
                assert.equal(out.wide, 'shot-t6', 'the wide window reaches the oldest row');
                assert.deepEqual(out.held, IN_TIME_ORDER.slice(0, 4));
                assert.equal(out.afterShrink, 'shot-tie-b',
                    'the band clamps to the last row of the narrower window');
                assert.equal(out.oneBack, 'shot-tie-a',
                    'and ONE press of "Newer" moves ONE row from there');
                assert.deepEqual(page.pageErrors, []);
            });
        });
    });
}
