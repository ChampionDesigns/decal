/**
 * live-favourite-carry.render.test.mjs — the favourite hold-menu's two broken outcomes,
 * pinned at the OUTCOME rather than at any step along the way.
 *
 * Written 29 August 2026 for the fix campaign's cluster L. Two findings, one menu:
 *
 *   F-027  "Clear button" was scored DEAD. Every step worked — the hold opened the right
 *          menu on the right cell, the item was live, `#onFavouriteAction` routed `clear`
 *          to `setFavourite(slot, null)` — and over 10.5 s NOTHING was sent. The break was
 *          a units mismatch at the last inch: `<ui-favourites-bank>` answers with the
 *          1-based number a person reads off the disc and `setFavourite` keys the
 *          assignments map by ARRAY INDEX, so clearing the fifth slot called
 *          `setFavourite(5, …)`, hit the `0..4` range guard and was refused into a log
 *          line. On the other four it would have emptied the NEIGHBOUR.
 *
 *   F-025 / F-001  "Replace with" (and "Browse Profiles" on an empty slot) opened the
 *          selector and carried nothing, so Confirm did what Confirm always does and
 *          LOADED the profile. Ben found it by hand: "when I click confirm it doesn't
 *          change the favourite, it just loads it like the normal profile page." The fix
 *          is the one the source's own comment prescribed — a pending INTENT the selector
 *          consumes, never a write performed up front.
 *
 * THE NON-DESTRUCTIVE PROPERTY IS PART OF THE SUBJECT, not a side condition. On 28 August
 * 2026 an earlier "Replace with" cleared the slot before opening the selector and silently
 * emptied Ben's slot 3. So there are tests here for the two abandon paths — press Replace
 * and leave, press Replace and confirm nothing — and both assert that the rail is
 * UNTOUCHED. A fix for F-025 that reintroduces the up-front write fails this file.
 *
 * WHY IT IS A RENDER TEST AND NOT A UNIT ONE. The fault is the JOIN: two screens, one
 * boot, a session row written on one and read on the other. Both halves passed their own
 * suites for weeks. `test/fixtures/live-selector-carry-fixture.js` mounts them in turn on
 * a real `createAppBoot` over real memory backends, and every assertion below reads the
 * store, the router or the request log — never an internal.
 *
 * BOTH GATE A GEOMETRIES, as every render suite here: the carry is the same carry at both,
 * and a hold that misses its cell at one size is exactly the kind of thing that would hide
 * a regression at the other.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';

const MODULES = ['/test/fixtures/live-selector-carry-fixture.js'];
const STAGE = '<div id="stage" style="inline-size: 100%; block-size: 100dvh"></div>';

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`favourite carry @ ${geometry.name} (${geometry.width}x${geometry.height})`, () => {

        const mounted = (fn) => browser.withPage({ geometry }, async (page) => {
            await page.mount(STAGE, MODULES);
            await page.settle(6);
            const seeded = await page.evalFn(() => window.__carry.mount());
            assert.equal(seeded.favourites, 5, 'the rail auto-populates its five slots');
            assert.deepEqual(page.pageErrors, [], 'the pair must mount without throwing');
            await fn(page);
            assert.deepEqual(page.pageErrors, [], 'the pair must run without throwing');
        });

        /* ═══════════════════════════════════════════════════════════════════
         * F-027 — "Clear button" empties the slot that was held
         * ═════════════════════════════════════════════════════════════════ */

        test('F-027 — clearing the FIFTH slot empties the fifth slot', () => mounted(async (page) => {
            /* THE FIFTH IS THE ONE THE AUDIT DROVE, and it is the one the range guard ate:
             * slot 5 as a 1-based mark is index 5 to `setFavourite`, which refuses
             * anything outside 0..4. Nothing was sent, and the finding scored DEAD. */
            const before5 = await page.evalFn(() => window.__carry.favourites());
            assert.ok(before5[4], 'the fifth slot starts filled');

            const menu = await page.evalFn(() => window.__carry.holdFavourite(4));
            assert.equal(menu.open, true, 'the hold opens the menu on the fifth cell');
            assert.ok(menu.items.includes('clear'), 'and it offers Clear');

            await page.evalFn(() => window.__carry.pressMenuItem('clear'));

            const after5 = await page.evalFn(() => window.__carry.favourites());
            const held = await page.evalFn(() => window.__carry.assignments());
            assert.equal(after5[4], null, 'the fifth cell prints no name');
            assert.ok(!held['4'], 'and the assignments map holds nothing at index 4');
        }));

        test('F-027 — and it empties THAT slot, not the one beside it', () => mounted(async (page) => {
            /* THE OFF-BY-ONE'S OTHER FACE. On slots one to four the old code did fire —
             * at the neighbour. A test that only drove the fifth would call this fixed
             * while a press on cell 2 still emptied cell 3. */
            const before2 = await page.evalFn(() => window.__carry.favourites());
            await page.evalFn(() => window.__carry.holdFavourite(1));
            await page.evalFn(() => window.__carry.pressMenuItem('clear'));
            const after2 = await page.evalFn(() => window.__carry.favourites());

            assert.equal(after2[1], null, 'the held cell is empty');
            assert.equal(after2[2], before2[2], 'and its neighbour is exactly as it was');
            assert.equal(after2[0], before2[0], 'as is the one before it');
        }));

        test('F-027 — the clear reaches the WIRE, and survives a re-read', () => mounted(async (page) => {
            await page.evalFn(() => window.__carry.holdFavourite(4));
            await page.evalFn(() => window.__carry.clearRequests());
            await page.evalFn(() => window.__carry.pressMenuItem('clear'));

            /* THE AUDIT'S OWN MEASUREMENT, INVERTED: it watched 10.5 s and counted zero
             * requests. One POST to the rail's key is what a working clear looks like. */
            /* THE RAIL'S KEY EXACTLY. `favouriteProfilesSeeded` is a DIFFERENT row — the
             * first-launch latch — and it shares this one's prefix, so a substring match
             * would count the store's own bookkeeping as a rail write. */
            const writes = await page.evalFn(() => window.__carry
                .requests('/store/decal/favouriteProfiles')
                .filter((r) => r.method === 'POST'
                    && r.path === '/api/v1/store/decal/favouriteProfiles'));
            assert.equal(writes.length, 1, `one write, not ${writes.length}: ${JSON.stringify(writes)}`);
            assert.equal(writes[0].body['4'], null, 'and it carries an empty slot 4');

            const stored = await page.evalFn(() => window.__carry.stored('favouriteProfiles'));
            assert.ok(stored, 'the key is stored');
            assert.ok(!stored['4'], 'and slot 4 is empty in the document that persisted');
        }));

        /* ═══════════════════════════════════════════════════════════════════
         * F-025 / F-001 — the held slot travels, and Confirm assigns
         * ═════════════════════════════════════════════════════════════════ */

        /* ═════════════════════════════════════════════════════════════════
         * ROUND 2 — the two words Ben changed (decisions D13 and D15)
         *
         * Both labels described the WIDGET rather than the act. "Clear button" is
         * Slate's, where the thing cleared really is a button on a toolbar; here it
         * is one of five favourites and the row left "which button?" to the reader.
         * "Browse Profiles" implied plain browsing on a menu whose one item now
         * FILLS the slot you held — the open question `L0444` recorded, settled by
         * D15 as fill.
         *
         * THESE ARE ASSERTED ON THE MENU'S OWN ITEMS, not on the source text (a8),
         * and by the id→label pairing rather than by position, so a reordered menu
         * fails on the wording it actually shows.
         * ═════════════════════════════════════════════════════════════ */

        test('D13 — a filled slot offers "Clear this favourite", not "Clear button"',
            () => mounted(async (page) => {
                const menu = await page.evalFn(() => window.__carry.holdFavourite(3));
                const rows = menu.items.map((id, i) => [id, menu.labels[i]]);
                const clear = rows.find(([id]) => id === 'clear');
                assert.deepEqual(clear, ['clear', 'Clear this favourite'],
                    `the danger row names what it clears — menu was ${JSON.stringify(rows)}`);
                assert.equal(menu.labels.includes('Clear button'), false,
                    'and the widget-shaped wording is gone from the menu entirely');

                /* THE REST OF THE MENU IS UNTOUCHED, which is the half a rename can
                 * break by accident: D13 changed one string and not the shape. */
                assert.deepEqual(menu.items, ['edit', 'replace', '---', 'clear'],
                    'the filled menu still offers Edit, Replace with, and the clear');
            }));

        test('D15 — an empty slot offers "Choose for this slot", not "Browse Profiles"',
            () => mounted(async (page) => {
                await page.evalFn(() => window.__carry.holdFavourite(4));
                await page.evalFn(() => window.__carry.pressMenuItem('clear'));
                const menu = await page.evalFn(() => window.__carry.holdFavourite(4));

                assert.deepEqual(menu.items, ['browse'],
                    'an empty slot still offers the one thing that fills it');
                assert.deepEqual(menu.labels, ['Choose for this slot'],
                    `and it now says so — menu was ${JSON.stringify(menu.labels)}`);
            }));

        test('F-025 — "Replace with" carries the held slot as a PENDING INTENT',
            () => mounted(async (page) => {
                const pendingBefore = await page.evalFn(() => window.__carry.stored('pendingAssignmentIndex'));
                assert.equal(pendingBefore, null, 'nothing is pending before the gesture');

                await page.evalFn(() => window.__carry.holdFavourite(3));
                await page.evalFn(() => window.__carry.armLibraryOpen());
                await page.evalFn(() => window.__carry.pressMenuItem('replace'));

                /* THE KEY THE REGISTRY DECLARES, holding the 0-BASED index the store
                 * speaks: "Which favourite slot the selector is filling. Dies with the
                 * tab by design." (storage-routes.js:311.) */
                const pending = await page.evalFn(() => window.__carry.stored('pendingAssignmentIndex'));
                assert.equal(pending, 3, 'the fourth disc is index 3 to the store');
                assert.equal(await page.evalFn(() => window.__carry.libraryOpens()), 1,
                    'and the selector is still opened, exactly once');
            }));

        test('F-025 — NOTHING is written to the rail on the way out', () => mounted(async (page) => {
            /* THE 28 AUGUST CONSTRAINT, as a test. The old branch cleared the slot before
             * opening the selector; the whole fix is a pending intent INSTEAD of a write. */
            const before4 = await page.evalFn(() => window.__carry.favourites());
            await page.evalFn(() => window.__carry.holdFavourite(3));
            await page.evalFn(() => window.__carry.clearRequests());
            await page.evalFn(() => window.__carry.pressMenuItem('replace'));

            const writes = await page.evalFn(() => window.__carry
                .requests('/store/decal/favouriteProfiles'));
            assert.deepEqual(writes, [], 'the rail is not touched by the trip out');
            assert.deepEqual(await page.evalFn(() => window.__carry.favourites()), before4,
                'and every cell still prints what it printed');
        }));

        test('D01 — Confirm with a pending slot ASSIGNS **and LOADS** the picked profile',
            () => mounted(async (page) => {
                /* BEN'S OVERRIDE OF ROUND 1, 29 August 2026. Round 1 built this branch as
                 * assign-without-load and flagged it: `L0307` names the slot and not the
                 * machine, so a trip made to change a shortcut arguably should not change
                 * what is running. Ben's answer is that assigning a profile to a slot
                 * LOADS it — the same thing a press on a favourite disc does — so there
                 * is one answer to "what does picking a profile for a slot do" rather
                 * than two that depend on which door you came through.
                 *
                 * IT IS ASSERTED AT THE WIRE, not at the store: the load is a POST to
                 * /machine/profile and nothing else on this path makes one. */
                await page.evalFn(() => window.__carry.holdFavourite(3));
                await page.evalFn(() => window.__carry.pressMenuItem('replace'));
                await page.evalFn(() => window.__carry.show('selector'));

                const picked = await page.evalFn(() => window.__carry.offRailId());
                await page.evalFn((id) => window.__carry.selectRow(id), picked);
                await page.evalFn(() => window.__carry.armNavigate());
                await page.evalFn(() => window.__carry.clearRequests());
                await page.evalFn(() => window.__carry.confirm());

                const armed = await page.evalFn(() => window.__carry.requests('/machine/profile'));
                assert.equal(armed.length, 1,
                    'the picked profile is put on the machine, exactly once — '
                    + `saw ${JSON.stringify(armed)}`);

                /* AND THE SLOT IS STILL FILLED. The load is the half D01 adds; the
                 * assignment is the half F-025 built and it must survive the addition. */
                const held = await page.evalFn(() => window.__carry.assignments());
                assert.equal(held['3'], picked, 'the held slot still takes the profile');

                /* AND IT STILL ENDS ON LIVE, which is what makes the round trip a trip. */
                assert.deepEqual(await page.evalFn(() => window.__carry.navigations()), ['live'],
                    'the gesture ends where it started');
            }));

        test('F-025 — Confirm with a pending slot ASSIGNS, at the slot that was held',
            () => mounted(async (page) => {
                await page.evalFn(() => window.__carry.holdFavourite(3));
                await page.evalFn(() => window.__carry.pressMenuItem('replace'));
                await page.evalFn(() => window.__carry.show('selector'));

                const picked = await page.evalFn(() => window.__carry.offRailId());
                const title = await page.evalFn(() => window.__carry.offRailTitle());
                const chose = await page.evalFn((id) => window.__carry.selectRow(id), picked);
                assert.equal(chose.picked, true, 'the row is in the listing');

                await page.evalFn(() => window.__carry.armNavigate());
                await page.evalFn(() => window.__carry.clearRequests());
                await page.evalFn(() => window.__carry.confirm());

                /* THE PROVEN LINE, WORD FOR WORD: "`kv favouriteProfiles` holds the picked
                 * profile's id at the held slot's position … with `session
                 * pendingAssignmentIndex` naming that same slot while the selector is
                 * open." The first half is here; the second was asserted above. */
                const held = await page.evalFn(() => window.__carry.assignments());
                assert.equal(held['3'], picked,
                    `slot 3 holds the picked profile — got ${JSON.stringify(held)}`);

                const stored = await page.evalFn(() => window.__carry.stored('favouriteProfiles'));
                assert.equal(stored['3'], picked, 'and that is what persisted');

                /* AND THE CELL PRINTS ITS NAME, which is the half a person sees. */
                await page.evalFn(() => window.__carry.show('live'));
                const cells = await page.evalFn(() => window.__carry.favourites());
                assert.equal(cells[3], title, `the cell reads "${title}"`);
            }));

        test('F-025 — the pending key is CONSUMED, so the next Confirm loads as before',
            () => mounted(async (page) => {
                await page.evalFn(() => window.__carry.holdFavourite(3));
                await page.evalFn(() => window.__carry.pressMenuItem('replace'));
                await page.evalFn(() => window.__carry.show('selector'));
                await page.evalFn(async () => window.__carry.selectRow(window.__carry.offRailId()));
                await page.evalFn(() => window.__carry.confirm());

                const pending = await page.evalFn(() => window.__carry.stored('pendingAssignmentIndex'));
                assert.equal(pending, null, 'the intent dies with the gesture that made it');

                /* AND NOW THE PLAIN LOOP, UNCHANGED. A second Confirm with nothing pending
                 * is the ordinary one: it arms the machine and goes to Live. This is the
                 * regression guard on the whole selector — the fix must not make every
                 * Confirm an assignment. */
                const heldBefore = await page.evalFn(() => window.__carry.assignments());
                await page.evalFn(() => window.__carry.show('selector'));
                await page.evalFn(async () => window.__carry.selectRow(window.__carry.offRailId()));
                await page.evalFn(() => window.__carry.armNavigate());
                await page.evalFn(() => window.__carry.clearRequests());
                await page.evalFn(() => window.__carry.confirm());

                const armed = await page.evalFn(() => window.__carry.requests('/machine/profile'));
                assert.equal(armed.length, 1, 'the machine is asked for the profile');
                assert.deepEqual(await page.evalFn(() => window.__carry.navigations()), ['live'],
                    'and the plain Confirm still leaves for Live');
                assert.deepEqual(await page.evalFn(() => window.__carry.assignments()), heldBefore,
                    'while the rail is untouched by a load');
            }));

        test('F-025 — leaving the selector any other way clears the intent and writes nothing',
            () => mounted(async (page) => {
                const before4 = await page.evalFn(() => window.__carry.favourites());
                await page.evalFn(() => window.__carry.holdFavourite(3));
                await page.evalFn(() => window.__carry.pressMenuItem('replace'));
                await page.evalFn(() => window.__carry.show('selector'));
                await page.evalFn(async () => window.__carry.selectRow(window.__carry.offRailId()));

                await page.evalFn(() => window.__carry.clearRequests());
                await page.evalFn(() => window.__carry.leave());

                const pending = await page.evalFn(() => window.__carry.stored('pendingAssignmentIndex'));
                assert.equal(pending, null, 'the abandoned intent does not outlive the visit');
                const writes = await page.evalFn(() => window.__carry
                    .requests('/store/decal/favouriteProfiles')
                    .filter((r) => r.method === 'POST'));
                assert.deepEqual(writes, [], 'and nothing was written to the rail');
                assert.deepEqual(await page.evalFn(() => window.__carry.favourites()), before4,
                    'the rail is exactly as it was — this is the 28 August property');
            }));

        test('F-025 — "Browse Profiles" on an EMPTY slot fills that slot', () => mounted(async (page) => {
            /* L0444's face of the same fault. The empty slot is made by the gesture that
             * makes one — Clear — which is F-027's fix doing the staging for this test. */
            await page.evalFn(() => window.__carry.holdFavourite(4));
            await page.evalFn(() => window.__carry.pressMenuItem('clear'));
            const emptied = await page.evalFn(() => window.__carry.favourites());
            assert.equal(emptied[4], null, 'slot 5 is empty');

            const menu = await page.evalFn(() => window.__carry.holdFavourite(4));
            assert.deepEqual(menu.items, ['browse'], 'an empty slot offers the one thing that fills it');
            await page.evalFn(() => window.__carry.pressMenuItem('browse'));
            assert.equal(await page.evalFn(() => window.__carry.stored('pendingAssignmentIndex')), 4,
                'and it carries the empty slot the same way');

            await page.evalFn(() => window.__carry.show('selector'));
            const picked = await page.evalFn(() => window.__carry.offRailId());
            await page.evalFn((id) => window.__carry.selectRow(id), picked);
            await page.evalFn(() => window.__carry.confirm());

            const held = await page.evalFn(() => window.__carry.assignments());
            assert.equal(held['4'], picked, 'the empty slot now holds the picked profile');
        }));
    });
}
