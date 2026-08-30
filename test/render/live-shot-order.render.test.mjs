/**
 * The Live band's arrows walk the history in TIME order.
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

        test('a press still moves one row after the window has shrunk under the index', async () => {
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
