/**
 * The core-loop-and-REST cluster: sel-core-loop, sel-highlight-by-id, sel-restore-to-factory, sel-versions-entry-point, sel-refusal-surfacing, sel-components, sel-contract-table, list-row-built-once, confirm-primary, real-listbox, hit-floor-one-owner.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';

const REPO = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const MODULES = ['/test/fixtures/selector-loop-fixture.js'];
const STAGE = '<div id="stage" style="inline-size: 100%; block-size: 100dvh"></div>';

const S = 'selector-screen';
const ROWS = `${S} >>> #rows`;
const ROW = `${S} >>> #rows ui-list-row`;
const CONFIRM = `${S} >>> #confirm`;
/* The detail pane's four boxes, spelled as the skeleton suite spells them — the refusal
 * pin below reads the SAME tracks that suite reads, in the state it cannot mount. */
const DETAIL_PANE = `${S} >>> #detail-pane`;
const CARD = `${S} >>> #preview`;
const NOTES_REGION = `${S} >>> #detail-pane >>> #notes`;
const BANNER = `${S} >>> #refusal`;

/** The recorded listing, read here so no id, title or count is typed into this file. */
const FIXTURE = JSON.parse(readFileSync(
    path.join(REPO, 'tools/rea-fixtures/api__v1__profiles~includeHidden=true.json'), 'utf8',
));
const WORKFLOW = JSON.parse(readFileSync(
    path.join(REPO, 'tools/rea-fixtures/api__v1__workflow.json'), 'utf8',
));

const LISTABLE = FIXTURE.filter((r) => r.visibility !== 'hidden' && r.visibility !== 'deleted');
const RESTORABLE = FIXTURE.filter(
    (r) => r.visibility === 'hidden' && r.isDefault && r.metadata && r.metadata.filename,
);

/**
 * The arm-time refusal, spelled exactly as the contract row spells it:
 * "400 {error:'Unsupported profile', message} on the capability refusal".
 */
const REFUSAL_BODY = {
    error: 'Unsupported profile',
    message: 'This machine cannot run a Lever step in "Blooming espresso".',
};

const px = (value) => parseFloat(value);
const near = (got, want, what, tol = 0.51) => assert.ok(
    Math.abs(got - want) <= tol, `${what}: expected ${want}, got ${got}`,
);

function freePort() {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.on('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const { port } = server.address();
            server.close(() => resolve(port));
        });
    });
}

async function startMock() {
    const port = await freePort();
    const child = spawn('python3', ['tools/mock_rea.py', '--port', String(port)],
        { cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (b) => { stderr += b; });
    child.stdout.resume();
    const deadline = Date.now() + 20000;
    for (;;) {
        if (child.exitCode !== null) throw new Error(`mock exited ${child.exitCode}: ${stderr}`);
        try {
            const res = await fetch(`http://127.0.0.1:${port}/api/v1/info`);
            if (res.ok) { await res.arrayBuffer(); break; }
        } catch { /* not up yet */ }
        if (Date.now() > deadline) throw new Error(`mock never came up: ${stderr}`);
        await new Promise((r) => setTimeout(r, 60));
    }
    return { port, stop: () => child.kill('SIGKILL') };
}

const P13_CENSUS = () => {
    const root = document.querySelector('selector-screen').shadowRoot;
    const FOCUSABLE = 'a[href],button,input,select,textarea,[tabindex],'
        + 'ui-list-row,ui-button,ui-icon-button';
    const walk = (node, out) => {
        for (const el of node.querySelectorAll('*')) {
            if (el.matches(FOCUSABLE)) out.push(el);
            if (el.shadowRoot) walk(el.shadowRoot, out);
        }
        return out;
    };
    return ['confirm-hide', 'confirm-reset', 'confirm-remove', 'share-code', 'versions',
        'restore', 'add'].map((id) => {
        const host = root.getElementById(id);
        if (!host) return { id, missing: true, open: false, candidates: 0, reachable: 0 };
        const inside = walk(host.shadowRoot ?? host, []);
        return {
            id,
            tag: host.tagName.toLowerCase(),
            open: host.open === true,
            candidates: inside.length,
            reachable: inside.filter((el) => el.getClientRects().length > 0).length,
        };
    });
};

/** Shut every overlay, whatever the test before this one left open. */
const P13_SHUT = () => {
    const root = document.querySelector('selector-screen').shadowRoot;
    for (const id of ['confirm-hide', 'confirm-reset', 'confirm-remove', 'share-code',
        'versions', 'restore', 'add']) {
        const el = root.getElementById(id);
        if (el && el.open) el.hide('p13-census');
    }
    return true;
};

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`selector core loop @ ${geometry.name} (${geometry.width}×${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {
        let mock;
        let page;
        /** Everything the driver captured, read by the assertions below. */
        const run = {};

        before(async () => {
            mock = await startMock();
            page = await browser.newPage({ geometry });
            await page.mount(STAGE, MODULES);
            await page.evalFn((port) => window.__sel.mount({ port }), mock.port);
            assert.deepEqual(page.pageErrors, [], 'the screen must mount without throwing');
        });

        after(async () => {
            try { await page?.close(); } finally { mock?.stop(); }
        });

        const need = (key) => {
            assert.ok(run[key] !== undefined, `the run did not reach '${key}' — see the driver test`);
            return run[key];
        };

        test('DRIVE: list, search, select, favourite, confirm', async () => {
            run.loaded = await page.evalFn(() => window.__sel.state());

            run.foldedAtRest = await page.evalFn(() => window.__sel.optionCount());
            run.familiesAtRest = await page.evalFn(() => window.__sel.families());
            run.expandedCount = await page.evalFn(() => window.__sel.expandAll());
            run.refoldOne = await page.evalFn(() => window.__sel.toggleFamily(
                window.__sel.families().names[0],
            ));
            await page.evalFn(() => window.__sel.toggleFamily(window.__sel.families().names[0]));

            run.optionsAtRest = await page.evalFn(() => window.__sel.optionCount());
            run.ariaAtRest = await page.evalFn(() => window.__sel.listboxAria());
            run.rolesAtRest = await page.evalFn(() => window.__sel.listboxRoles());
            run.walkAtRest = await page.evalFn(() => window.__sel.listboxWalk());
            run.optionTags = await page.evalFn(() => window.__sel.optionTags());
            run.optionAffordance = await page.evalFn(() => window.__sel.optionAffordance());
            run.highlight = await page.evalFn(() => window.__sel.highlight());
            run.favouritesAtRest = await page.evalFn(() => window.__sel.favourites());

            await page.evalFn((body) => window.__sel.answer(
                'GET', '/api/v1/profiles', 200, body, 'W/"profiles-1"',
            ), FIXTURE);
            run.conditionalFirst = await page.evalFn(() => window.__sel.reload());
            run.conditionalSecond = await page.evalFn(() => window.__sel.reload());
            run.ifNoneMatchSent = await page.evalFn(() => window.__sel.conditionalCalls('/api/v1/profiles'));
            await page.evalFn(() => window.__sel.forget('GET', '/api/v1/profiles'));
            run.listingCalls = await page.evalFn(() => window.__sel.countCalls('GET', '/api/v1/profiles'));

            /* SEARCH — a family prefix that is real in this fixture. */
            run.searchHits = await page.evalFn(() => window.__sel.search('Tea portafilter'));
            run.searchMiss = await page.evalFn(() => window.__sel.search('zzz-no-such-profile'));
            await page.evalFn(() => window.__sel.search(''));

            /* SELECT — by pointer, through the real row. */
            run.pickedId = await page.evalFn(() => window.__sel.clickRow(0));
            run.detail = await page.evalFn(() => window.__sel.detail());
            run.afterPick = await page.evalFn(() => window.__sel.state());

            run.assignId = await page.evalFn(() => {
                const held = new Set(Object.values(window.__sel.rawFavourites()).filter(Boolean));
                const free = window.__sel.rawListable().find((r) => !held.has(r.id));
                window.__sel.select(free.id);
                return free.id;
            });
            run.favouritePick = await page.evalFn(() => window.__sel.pickFavourite(0));
            await page.evalFn((id) => window.__sel.select(id), run.assignId);
            run.menuSlots = await page.evalFn(() => window.__sel.menuOffers());
            run.railCleared = await page.evalFn(() => window.__sel.clearFavourite(4));
            /* A SECOND UNHELD PROFILE, for the same reason as the first: `assignId` is on
             * slot 1 by now, and the guard refuses a profile the rail already holds
             * WHEREVER it holds it. */
            run.namedId = await page.evalFn(() => {
                const held = new Set(Object.values(window.__sel.rawFavourites()).filter(Boolean));
                const free = window.__sel.rawListable().find((r) => !held.has(r.id));
                window.__sel.select(free.id);
                return free.id;
            });
            run.favouritesAfterAdd = await page.evalFn(() => window.__sel.addFavourite(4));
            await page.evalFn((id) => window.__sel.select(id), run.pickedId);

            /* CONFIRM — the band's button, the dialog, and the arm. The mock answers
             * POST /machine/profile from the contract row's own success branch. */
            const armsBefore = await page.evalFn(
                () => window.__sel.countCalls('POST', '/api/v1/machine/profile'));
            run.confirm = await page.evalFn(() => window.__sel.confirmLoad());
            run.armCalls = await page.evalFn(
                () => window.__sel.countCalls('POST', '/api/v1/machine/profile')) - armsBefore;
            run.armsFromAssigns = armsBefore;
        });

        test('the listing is rule 1\'s answer, not the server\'s', () => {
            const s = need('loaded');
            assert.equal(s.status, 'ready', 'the listing landed');
            assert.equal(s.records, FIXTURE.length, 'every served record is held');
            assert.equal(s.listable, LISTABLE.length,
                'and the LISTABLE set is the hidden/deleted filter — rule 1, client-side');
            assert.equal(need('optionsAtRest'), LISTABLE.length,
                'every listable record is an option, and nothing else is');
            assert.equal(s.restorable, RESTORABLE.length,
                'the hidden bundled records are kept for D6 rather than thrown away');
        });

        test('the listing read is conditional, and a 304 serves the stored body', () => {
            const first = need('loaded');
            const one = need('conditionalFirst');
            const two = need('conditionalSecond');
            assert.ok(need('listingCalls') >= 3, 'the listing was read more than once over the wire');
            assert.equal(one.reads.conditional, 0,
                'the first answer with an ETag is a 200 — there was nothing to match against');
            assert.equal(two.reads.conditional, 1,
                'and the next one is a 304 — If-None-Match is the transport\'s, not the screen\'s');
            assert.ok(need('ifNoneMatchSent') >= 1,
                'the header really went out on the wire; nothing in src/ writes it');
            assert.equal(two.listable, first.listable,
                'a 304 serves the STORED body, so the list is the same list');
            assert.equal(two.status, 'ready', 'and a 304 is not an error');
        });

        test('search narrows the list, and an empty result is a result', () => {
            const family = LISTABLE.filter(
                (r) => (r.profile.title || '').toLowerCase().includes('tea portafilter'),
            ).length;
            assert.ok(family > 1, 'the fixture really does carry this family');
            assert.equal(need('searchHits'), family, 'the filter matches what matchProfiles matches');
            assert.equal(need('searchMiss'), 0, 'and a miss empties the listbox rather than failing');
        });

        test('selecting draws the profile: title, numbers, notes and its own curves', () => {
            const id = need('pickedId');
            assert.ok(id, 'the click reached the row and named a record');
            assert.equal(need('afterPick').selectedId, id, 'and the store holds it');

            const detail = need('detail');
            const record = FIXTURE.find((r) => r.id === id);
            assert.equal(detail.title, record.profile.title, 'the pane names the picked profile');
            assert.equal(detail.notes, (record.profile.notes || '').slice(0, 40),
                'and its notes are the profile\'s own, not a placeholder');
            assert.equal(detail.chartEmpty, false, 'the preview is drawn, not empty');
            assert.ok(detail.series > 0, 'the target curve carries points');
            assert.equal(detail.stepMarks, record.profile.steps.length,
                'one step mark per step in the profile');
        });

        test('cmp-seh-1 — the strip is Temp · Peak · Duration · Steps · Stop at, and the peak is commanded, not limited',
            async () => {
                const ORACLE_TITLE = 'Extractamundo Dos! (2)';
                const chosen = await page.evalFn(
                    (title) => window.__sel.selectByTitle(title), ORACLE_TITLE,
                );
                assert.ok(chosen, `the recorded listing carries ${ORACLE_TITLE}`);
                const tiles = await page.evalFn(() => window.__sel.tiles());

                assert.deepEqual(tiles.map((tile) => tile.key),
                    ['temp', 'peak', 'duration', 'steps', 'stop-at'],
                    'five tiles, in the decided order — Duration is third');
                assert.deepEqual(tiles.map((tile) => tile.label),
                    ['Temp', 'Peak', 'Duration', 'Steps', 'Stop at'],
                    'labelled as Slate labels them, through t()');

                const painted = tiles.map(
                    (tile) => (tile.spokenUnit ? `${tile.reading} ${tile.spokenUnit}` : tile.reading),
                );
                assert.deepEqual(painted, ['83.5 °C', '6.0 bar', '2:00 max', '3', '40 g'],
                    'prov-baseline/profile-selector.json [i=179,181,185,187], verbatim, '
                    + 'with the duration the profile\'s own frames add up to');
                assert.ok(tiles.every((tile) => tile.absent === false),
                    'and this profile answers all five, so no tile is dashing');

                const FLOW_ONLY = 'GHC/manual flow control';
                const flowId = await page.evalFn(
                    (title) => window.__sel.selectByTitle(title), FLOW_ONLY,
                );
                assert.ok(flowId, `the recorded listing carries ${FLOW_ONLY}`);
                const flow = Object.fromEntries(
                    (await page.evalFn(() => window.__sel.tiles())).map((tile) => [tile.key, tile]),
                );
                const flowRecord = FIXTURE.find((r) => r.id === flowId);
                assert.ok(flowRecord.profile.steps.every((step) => step.pump === 'flow'),
                    'every step is a flow step, so nothing in the profile commands a pressure');
                const slateWouldSay = Math.max(
                    ...flowRecord.profile.steps.map((step) => Number(step.limiter?.value) || 0),
                ).toFixed(1);
                assert.equal(slateWouldSay, '9.0',
                    'and Slate would have reported the limiter — the machine default, not a target');

                assert.equal(flow.peak.absent, true,
                    `the peak tile dashes; it reads ${JSON.stringify(flow.peak.reading)}`);
                assert.equal(flow.peak.value, '', 'because there is no commanded pressure to state');
                assert.notEqual(flow.peak.reading, slateWouldSay, 'and emphatically not 9.0 bar');

                assert.equal(flow['stop-at'].absent, true,
                    'target_weight and target_volume are both 0 — ReaPrime\'s unset, so it dashes too');
                assert.equal(flow.temp.reading, '88.0',
                    'the temperature is still the profile\'s own, at one decimal');
                assert.equal(flow.steps.reading, String(flowRecord.profile.steps.length),
                    'and the step count is a count, which every profile can answer');

                const VOLUME_STOP = 'Tea/in a basket';
                const teaId = await page.evalFn(
                    (title) => window.__sel.selectByTitle(title), VOLUME_STOP,
                );
                assert.ok(teaId, `the recorded listing carries ${VOLUME_STOP}`);
                const tea = (await page.evalFn(() => window.__sel.tiles()))
                    .find((tile) => tile.key === 'stop-at');
                const teaRecord = FIXTURE.find((r) => r.id === teaId);
                assert.equal(Number(teaRecord.profile.target_weight), 0,
                    'this profile states no stop weight');
                assert.equal(tea.reading, String(teaRecord.profile.target_volume),
                    'so the tile reads the volume it DOES state');
                assert.equal(tea.spokenUnit, 'mL', 'in that field\'s unit, not the weight\'s');

                /* Put the pane back where the rest of the run left it. */
                await page.evalFn((id) => window.__sel.select(id), need('pickedId'));
            });

        test('the favourite rail is five slots, seeded by rule 4, and pressing one ASSIGNS', () => {
            const rail = need('favouritesAtRest');
            assert.equal(rail.length, 5, 'five slots — the bank ReaPrime\'s KV map has always had');
            assert.ok(rail.some((v) => v !== null), 'rule 4 seeded it on a first launch');

            const after = need('favouritePick');
            assert.equal(after[0], need('assignId'),
                'pressing slot 1 with a profile selected did not seat it there');
        });

        test('an empty slot is a value, and every slot is offered BY NUMBER', () => {
            const offers = need('menuSlots');
            for (const n of [1, 2, 3, 4, 5]) {
                assert.ok(offers.includes(`assign:${n}`), `slot ${n} is offered by number`);
            }
            assert.ok(!offers.includes('add-favourite'),
                'and no implicit "next free slot" action survives beside them');
            const cleared = need('railCleared');
            assert.equal(cleared[4], null, 'a slot can be emptied');
            assert.equal(cleared.filter((v) => v !== null).length, 4, 'and only that one');
            const after = need('favouritesAfterAdd');
            assert.equal(after[4], need('namedId'),
                'and the named slot is the one that takes it');
        });

        test('confirm ARMS THE MACHINE, and asks nothing first', () => {
            const c = need('confirm');
            assert.equal(c.dialogOpened, false, 'no second question');
            assert.equal(need('armCalls'), 1, 'confirming sends exactly one POST /machine/profile');
            /* AND THE ASSIGNS SENT THEIR OWN, which is the other half of the same change:
             * two assigns, two loads. A zero here would mean the press stopped loading. */
            assert.equal(need('armsFromAssigns'), 2,
                'each of the two favourite assignments loaded its profile as well');
            assert.equal(c.refusal, null, 'the mock accepts it, so nothing is refused');
        });

        /* ═══════════════════════════════════════════════════════════════════
         * 2. — A REAL LISTBOX
         * ═════════════════════════════════════════════════════════════════ */

        test('families ship SHUT, which is what makes 91 profiles legible', () => {
            const folded = need('foldedAtRest');
            const families = need('familiesAtRest');
            const all = need('expandedCount');
            assert.ok(families.count > 0, 'the fixture has families to fold');
            assert.equal(families.open, 0,
                'nothing is open on a device that has never been asked — Slate\'s own default');
            assert.ok(folded < all,
                `folded shows ${folded} rows against ${all} open — folding that reveals nothing is not folding`);
        });

        test('a family row is a tree item with aria-expanded, and it toggles', () => {
            const refold = need('refoldOne');
            assert.ok(refold, 'the first family answered the press');
            /* The drive opened everything, so the first press SHUTS. What is asserted is
             * the pair: the state flipped, and the rows went with it. */
            assert.equal(refold.open, false);
            assert.ok(refold.rows < need('expandedCount'),
                'shutting a family takes its members out of the tree, not just out of view');
        });

        test('an open family draws the same seam its siblings do', async () => {
            await page.evalFn(() => window.__sel.expandAll());
            const seam = await page.evalFn(() => {
                const root = document.querySelector('selector-screen').shadowRoot;
                const group = root.querySelector('#rows .group');
                if (!group) return null;
                const cs = getComputedStyle(group);
                const rows = root.getElementById('rows');
                return {
                    display: cs.display,
                    rowGap: cs.rowGap,
                    background: cs.backgroundColor,
                    listBackground: getComputedStyle(rows).backgroundColor,
                    listGap: getComputedStyle(rows).rowGap,
                };
            });
            assert.ok(seam, 'an open family renders a group');
            assert.equal(seam.display, 'grid', 'the group is a seamed grid');
            assert.equal(seam.rowGap, seam.listGap, 'and it gaps by the same --ui-seam');
            assert.equal(seam.background, seam.listBackground,
                'and paints the same divider ink behind its rows');
        });

        test('P12 — the tree has a tab stop and an activedescendant that resolves', () => {
            const aria = need('ariaAtRest');
            assert.equal(aria.role, 'tree');
            assert.equal(aria.tabindex, '0', 'ONE tab stop — the old list had none');
            assert.ok(aria.label, 'and an accessible name');
            assert.ok(aria.activedescendant, 'aria-activedescendant is written');
            assert.equal(aria.resolves, true,
                'and it names an element in the SAME root — an IDREF does not cross a shadow boundary');
            assert.equal(aria.activeIsOption, true, 'what it names is an option');
            assert.equal(aria.optionsWithTabindex, 0,
                'and no option carries a tabindex of its own — activedescendant, not roving');
        });

        test('P12 — only tree items and groups are inside the tree, FLATTENED', () => {
            const roles = need('rolesAtRest');
            const walk = need('walkAtRest');

            assert.ok(walk.walked >= need('optionsAtRest'),
                `the role walk entered ${walk.walked} shadow roots for ${need('optionsAtRest')} options — `
                + 'a probe that does not flatten cannot see what P12 is about');

            assert.ok((roles.button ?? 0) <= 1,
                `at most one reachable row-actions opener, ever — saw ${roles.button} in ${JSON.stringify(roles)}`);
            const unexpected = Object.keys(roles)
                .filter((r) => r !== 'treeitem' && r !== 'group' && r !== 'button');
            assert.deepEqual(unexpected, [],
                `§7.3 P12: non-item children inside the tree — found ${JSON.stringify(roles)}`);
            assert.ok(roles.group > 0, 'the folder families are groups, from profile-folders.js');
            /* EVERY ITEM, families included — which is why this is not `optionsAtRest`.
             * A family row is a treeitem with aria-expanded, and it is exactly the node
             * a <button> here would have replaced. */
            assert.equal(roles.treeitem, need('optionsAtRest') + need('familiesAtRest').count,
                'every profile AND every family is reported as a tree item');
        });

        test('P12 — the keys move the active option, and Enter chooses it', async () => {
            const home = await page.evalFn(() => window.__sel.key('Home'));
            const down = await page.evalFn(() => window.__sel.key('ArrowDown'));
            assert.notEqual(down.activedescendant, home.activedescendant, 'Down moves it');

            const up = await page.evalFn(() => window.__sel.key('ArrowUp'));
            assert.equal(up.activedescendant, home.activedescendant, 'and Up moves it back');

            const end = await page.evalFn(() => window.__sel.key('End'));
            assert.notEqual(end.activedescendant, home.activedescendant, 'End goes to the last row');
            const past = await page.evalFn(() => window.__sel.key('ArrowDown'));
            assert.equal(past.activedescendant, end.activedescendant,
                'and Down at the end CLAMPS rather than wrapping to the top');

            const chosen = await page.evalFn(() => window.__sel.key('Enter'));
            assert.ok(chosen.selectedId, 'Enter chooses the active option');
            assert.ok(end.activedescendant.endsWith(chosen.selectedId),
                'and it chooses the one the keyboard was on');
        });

        test('D21 — the row-actions opener travels with the active row, one at a time',
            async () => {
                await page.evalFn(() => window.__sel.key('End'));
                const roles = await page.evalFn(() => window.__sel.listboxRoles());
                assert.equal(roles.button ?? 0, 1,
                    'the row the keyboard is standing on offers a reachable opener — '
                    + `saw ${JSON.stringify(roles)}`);

                const unexpected = Object.keys(roles)
                    .filter((r) => r !== 'treeitem' && r !== 'group' && r !== 'button');
                assert.deepEqual(unexpected, [],
                    `§7.3 P12 still holds beside it — found ${JSON.stringify(roles)}`);

                const aria = await page.evalFn(() => window.__sel.listboxAria());
                assert.equal(aria.optionsWithTabindex, 0,
                    'the rows are still addressed by aria-activedescendant');
                assert.equal(aria.tabindex, '0', 'and the tree keeps its own single tab stop');
            });

        /* ═══════════════════════════════════════════════════════════════════
         * 3. · — one row, one owner of its box
         * ═════════════════════════════════════════════════════════════════ */

        test('P6 — every option is the same one component, and all 78 answer alike', () => {
            const tags = need('optionTags');
            assert.deepEqual(Object.keys(tags), ['ui-list-row'],
                '§7.3 P6: "the profile row is implemented TWICE" needs a second implementation');

            const affordance = need('optionAffordance');
            assert.equal(affordance.options, tags['ui-list-row'], 'every option is a row');
            assert.equal(affordance.withButton, 0,
                'no row draws a <button> of its own (D11 deleted the one it had), and the '
                + 'trigger the screen slots is a <span>: a real <button> under a '
                + 'role="treeitem" is P12\'s "non-option children inside the listbox"');

            assert.equal(
                affordance.profileRows + affordance.folderRows, affordance.options,
                'every row is one of the two kinds and nothing falls between them');
            assert.ok(affordance.profileRows > 0, 'or this pin is vacuous');
            assert.equal(affordance.profileRowsWithActions, affordance.profileRows,
                'every profile row slots its own actions trigger — all of them, or the '
                + 'menu is a long-press secret on the rows that missed out (P6 exactly)');
            assert.equal(affordance.folderRowsWithActions, 0,
                'and no folder row does: there is no record to act on');
        });

        test('P4 — the hit floor is the token, applied by the one component that owns the box',
            async () => {
                const floor = px(await page.resolveToken('--ui-hit-min', 'block-size'));
                const row = await page.box(ROW);
                assert.ok(row.height >= floor - 0.51,
                    `a row is ${row.height} against the --ui-hit-min floor ${floor} (P4 measured 64 vs a comment claiming 48)`);

                /* THE SCREEN DECLARES NOTHING ABOUT THE BOX. Geometry and paint are in one
                 * root — #26's — so the rule's "one rule here, paint 1300 lines away" has no
                 * second place to live. */
                const declared = await page.computed(ROW, ['block-size', 'min-block-size', 'padding-top']);
                const rowToken = px(await page.resolveToken('--ui-list-row', 'block-size'));
                near(px(declared['block-size']), rowToken, 'the row is --ui-list-row tall, from #26');

                const slot = await page.box(`${S} >>> #favourites >>> ui-favourite-slot`);
                assert.ok(slot.width > 0 && slot.height > 0, 'the rail\'s slots are on screen');
            });

        /* ═══════════════════════════════════════════════════════════════════
         * 4. — the confirm button has a real primary treatment
         * ═════════════════════════════════════════════════════════════════ */

        test('P8 — Confirm is not Cancel painted twice, in the band and in the dialog',
            async () => {
                const band = await page.computed(`${CONFIRM} >>> .btn`, ['background-color']);
                const cancel = await page.computed(`${S} >>> #cancel >>> .btn`, ['background-color']);
                assert.notEqual(band['background-color'], cancel['background-color'],
                    '§7.3 P8: "measured transparent, identical to Cancel beside it"');
                assert.ok(!/rgba\(0, 0, 0, 0\)|transparent/.test(band['background-color']),
                    'and the primary variant actually paints a fill');

                await page.evalFn(async () => {
                    const screen = document.querySelector('selector-screen');
                    screen.shadowRoot.getElementById('confirm-hide').show({ reason: 'test' });
                    await screen.updateComplete;
                });
                await page.settle(2);
                const dialogConfirm = await page.computed(
                    `${S} >>> #confirm-hide >>> #confirm >>> .btn`, ['background-color'],
                );
                const dialogCancel = await page.computed(
                    `${S} >>> #confirm-hide >>> #cancel >>> .btn`, ['background-color'],
                );
                assert.notEqual(dialogConfirm['background-color'], dialogCancel['background-color'],
                    'the dialog\'s affirmative action is painted apart from its cancel — #19\'s tone table');
                await page.evalFn(() => {
                    document.querySelector('selector-screen').shadowRoot
                        .getElementById('confirm-hide').hide('test');
                    return true;
                });
                await page.settle(2);
            });

        /* ═══════════════════════════════════════════════════════════════════
         * 5. — the preview host is unpadded
         * ═════════════════════════════════════════════════════════════════ */

        test('chart-C3 — the plot host carries no inset, and the frame carries it instead',
            async () => {
                const host = await page.evalFn(() => window.__sel.chartHost());
                assert.deepEqual(host.plotPadding, ['0px', '0px', '0px', '0px'],
                    'chart-C3 measured 32px of padding on #profile-preview-chart; uPlot sizes '
                    + 'from clientWidth/clientHeight — the PADDING box — so a padded host overflows '
                    + 'by exactly its padding');
                assert.ok(host.framePadding.some((v) => px(v) > 0),
                    'the inset lives on the FRAME, so the card still has its margin');
                near(host.plotWidth, host.wellWidth, 'the plot fills its well exactly — no overflow');
                assert.ok(host.plotHeight > 0, 'and it has a height to draw in');
                assert.ok(host.canvasWidth > 0 && host.canvasWidth <= host.wellWidth + 0.51,
                    'the canvas is inside the well rather than hanging out of it');
            });

        test('R1 — with no id in the report the highlight is the title match, MARKED provisional',
            () => {
                const s = need('loaded');
                const title = WORKFLOW.profile.title;
                const matches = FIXTURE.filter((r) => r.profile.title === title);
                assert.equal(matches.length, 1,
                    'the recorded workflow names a title that is unique in this listing');
                assert.equal(s.loaded.id, matches[0].id, 'so the id resolves — and it is an ID');
                assert.equal(s.loaded.known, true);
                assert.equal(s.loaded.provisional, true,
                    'R1 has NOT landed, and every answer says so');
                assert.match(s.loaded.basis, /PROVISIONAL \(R1\)/,
                    'the adapter\'s own sentence reaches the state unaltered');

                const marked = need('highlight');
                assert.equal(marked.length, 1, 'exactly one row carries the loaded badge');
                assert.equal(marked[0].id, matches[0].id, 'and it is the right row');
                assert.equal(marked[0].provisional, true,
                    'THE MARKING REACHES THE SCREEN: data-r1-provisional on the highlighted row');
            });

        test('R1 — when the report carries profile.id the highlight is by id and NOT provisional',
            async () => {
                const target = LISTABLE[3];
                await page.evalFn((body) => window.__sel.answer('GET', '/api/v1/workflow', 200, body), {
                    ...WORKFLOW,
                    profile: { ...WORKFLOW.profile, id: target.id, title: 'a title no record carries' },
                });
                const s = await page.evalFn(() => window.__sel.reload());
                assert.equal(s.loaded.id, target.id, 'the id came off the report');
                assert.equal(s.loaded.provisional, false, 'and it is no longer provisional');
                assert.match(s.loaded.basis, /R1 HAS LANDED/);

                const marked = await page.evalFn(() => window.__sel.highlight());
                assert.equal(marked.length, 1);
                assert.equal(marked[0].provisional, false,
                    'so the row loses its provisional marking — which is how the review sees R1 land');
            });

        test('R1 — a duplicate title is REPORTED, never resolved by picking the first',
            async () => {
                const counts = new Map();
                for (const r of FIXTURE) {
                    const t = r.profile.title;
                    counts.set(t, (counts.get(t) ?? 0) + 1);
                }
                const armedTitle = await page.evalFn((id) => window.__sel.titleOf(id), need('pickedId'));
                const dups = [...counts.entries()].filter(([, n]) => n > 1);
                const dup = dups.find(([t]) => t !== armedTitle) ?? dups[0];
                assert.ok(dup, 'the served listing really does carry a duplicate title');
                assert.notEqual(dup[0], armedTitle,
                    'and one the armed memory cannot answer, or this tests the memory rule instead');

                await page.evalFn((body) => window.__sel.answer('GET', '/api/v1/workflow', 200, body), {
                    ...WORKFLOW, profile: { ...WORKFLOW.profile, title: dup[0] },
                });
                const s = await page.evalFn(() => window.__sel.reload());
                assert.equal(s.loaded.id, null, 'no id — never the first match');
                assert.equal(s.loaded.reason, 'ambiguous');
                assert.equal(s.loaded.candidates, dup[1], 'and the candidates are reported');
                assert.deepEqual(await page.evalFn(() => window.__sel.highlight()), [],
                    'so nothing on screen claims to be the loaded profile');

                await page.evalFn(() => window.__sel.forget('GET', '/api/v1/workflow'));
                await page.evalFn(() => window.__sel.reload());
            });

        /* ═══════════════════════════════════════════════════════════════════
         * 7. — the refusal, at the point of picking
         * ═════════════════════════════════════════════════════════════════ */

        test('B9 — a typed 400 renders at the picker, carrying the server\'s own sentence',
            async () => {
                await page.evalFn((body) => window.__sel.answer(
                    'POST', '/api/v1/machine/profile', 400, body,
                ), REFUSAL_BODY);
                await page.evalFn((id) => window.__sel.select(id), LISTABLE[0].id);
                const after = await page.evalFn(() => window.__sel.confirmLoad());

                assert.ok(after.refusal, 'the refusal is held rather than swallowed');
                assert.equal(after.refusal.kind, 'unsupported',
                    'the two 400s are told apart — profileRefusal reads the typed error');
                assert.equal(after.refusal.message, REFUSAL_BODY.message,
                    'and the message is the server\'s, verbatim; #49 does not know the message');

                const banner = await page.evalFn(() => window.__sel.refusalText());
                assert.ok(banner, 'the alert banner is on screen');
                assert.ok(banner.height > 0, 'with a box');
                assert.ok(banner.headline.includes(REFUSAL_BODY.error), 'naming the refusal');
                assert.ok(banner.headline.includes(REFUSAL_BODY.message), 'and its remedy line');
                assert.equal(banner.inDetailPane, true,
                    'AT THE POINT OF PICKING — beside the profile that was picked, in flow');

                assert.equal(banner.kindAttr, null,
                    `the banner carries an inert kind= attribute — ${JSON.stringify(banner.attributes)}`);
                assert.ok(!banner.attributes.includes('kind'), 'and not under any spelling');

                await page.evalFn(() => window.__sel.forget('POST', '/api/v1/machine/profile'));
            });

        test('§4.2 GIVE ORDER, in the refusal state: the chart pays and the notes do not — DQ',
            async () => {
                const plotFloor = px(await page.resolveToken('--ui-chart-min-h', 'block-size'));
                /* AT REST FIRST, and the test above leaves its refusal standing, so the
                 * screen is put back before anything is read. */
                await page.evalFn(() => window.__sel.clearRefusal());
                await page.settle(3);
                const rest = {
                    rows: (await page.prop(DETAIL_PANE, 'grid-template-rows')).trim().split(/\s+/),
                    notes: (await page.box(NOTES_REGION)).height,
                    pane: (await page.box(DETAIL_PANE)).height,
                };

                await page.evalFn((body) => window.__sel.answer(
                    'POST', '/api/v1/machine/profile', 400, body,
                ), REFUSAL_BODY);
                await page.evalFn((id) => window.__sel.select(id), LISTABLE[0].id);
                await page.evalFn(() => window.__sel.confirmLoad());
                await page.settle(3);

                const shown = {
                    rows: (await page.prop(DETAIL_PANE, 'grid-template-rows')).trim().split(/\s+/),
                    notes: (await page.box(NOTES_REGION)).height,
                    pane: (await page.box(DETAIL_PANE)).height,
                    card: (await page.box(CARD)).height,
                    banner: (await page.box(BANNER)).height,
                };

                near(shown.pane, rest.pane, 'the pane itself does not change size — the loss is internal', 1);
                assert.ok(shown.banner > 0, 'the banner is on screen and has a box');

                const clearsFloor = px(shown.rows[2]) >= plotFloor;
                assert.ok(shown.card >= plotFloor,
                    `and the card is on its own floor (${shown.card}px), overflowing its track`);
                if (geometry.name === 'bench') {
                    assert.ok(clearsFloor,
                        `bench regained its room on 25 Aug 2026 and the chart track is `
                        + `${shown.rows[2]} against a ${plotFloor}px plot floor — if this is `
                        + 'under the floor again, the band or the inset grew back');
                    return;
                }
                assert.ok(!clearsFloor,
                    `the chart track is ${shown.rows[2]} against a ${plotFloor}px plot floor — `
                    + 'if this now passes the floor, the give order was fixed: update this pin '
                    + 'and DEFERRED_QUESTIONS_core-loop.md §11');

                const chartUnderFloorBy = plotFloor - px(shown.rows[2]);
                const notesGave = rest.notes - shown.notes;
                assert.ok(notesGave < chartUnderFloorBy,
                    `§4.2 has this ordering the other way round: the chart is ${chartUnderFloorBy.toFixed(2)}px `
                    + `under its floor while the notes gave ${notesGave.toFixed(2)}px `
                    + `(${rest.notes} -> ${shown.notes}). "Notes should give before the chart is destroyed."`);

                await page.evalFn(() => window.__sel.forget('POST', '/api/v1/machine/profile'));
                await page.evalFn(() => window.__sel.clearRefusal());
                await page.settle(2);
            });

        /* ═══════════════════════════════════════════════════════════════════
         * 8. — the versions entry point
         * ═════════════════════════════════════════════════════════════════ */

        test('B11 / Q7 — the detail pane\'s overflow menu opens the versions surface',
            async () => {
                const parented = LISTABLE.find((r) => r.parentId);
                const lineage = parented
                    ? [FIXTURE.find((r) => r.id === parented.parentId) ?? parented, parented].filter(Boolean)
                    : [LISTABLE[0]];
                const subject = parented ?? LISTABLE[0];

                await page.evalFn((body) => window.__sel.answer(
                    'GET', `/api/v1/profiles/${encodeURIComponent(body.id)}/lineage`, 200, body.rows,
                ), { id: subject.id, rows: lineage });

                await page.evalFn((id) => window.__sel.select(id), subject.id);
                const opened = await page.evalFn(() => window.__sel.versions());
                assert.equal(opened.open, true, 'the menu item opens the dialog');
                assert.equal(opened.status, 'ready');
                assert.equal(opened.rows, lineage.length, 'and it lists the lineage the server served');
            });

        test('B11 — a ONE-ENTRY lineage means "no other versions", not a fault',
            async () => {
                const subject = LISTABLE[1];
                await page.evalFn((body) => window.__sel.answer(
                    'GET', `/api/v1/profiles/${encodeURIComponent(body.id)}/lineage`, 200, [body.row],
                ), { id: subject.id, row: subject });
                await page.evalFn((id) => window.__sel.select(id), subject.id);
                const opened = await page.evalFn(() => window.__sel.versions());
                assert.equal(opened.status, 'none',
                    'getLineage always adds the profile itself, so a list of one IS the empty answer');
                assert.equal(opened.rows, 0);
                assert.match(opened.text, /no other versions/i,
                    'and the screen says so as a fact, not as an error');
            });

        /* ═══════════════════════════════════════════════════════════════════
         * 9. — restore to factory, without the purge half
         * ═════════════════════════════════════════════════════════════════ */

        test('D6 — restore offers the hidden bundled profiles and round-trips one back',
            async () => {
                const opened = await page.evalFn(() => window.__sel.openRestore());
                assert.equal(opened.present, true, 'the entry point exists — there is something to restore');
                assert.equal(opened.open, true);
                assert.equal(opened.offers, RESTORABLE.length,
                    'the offer list is hidden AND isDefault AND carrying a bundle filename');

                const first = RESTORABLE[0];
                const restored = { ...first, visibility: 'visible' };
                await page.evalFn((body) => window.__sel.answer(
                    'POST', `/api/v1/profiles/restore/${encodeURIComponent(body.filename)}`, 200, body.record,
                ), { filename: first.metadata.filename, record: restored });
                await page.evalFn((body) => window.__sel.answer('GET', '/api/v1/profiles', 200, body),
                    FIXTURE.map((r) => (r.id === first.id ? restored : r)));

                const after = await page.evalFn(() => window.__sel.restoreFirst());
                assert.equal(after.filename, first.metadata.filename,
                    'the path parameter is the BUNDLE FILENAME, off the record\'s own metadata');
                assert.equal(after.restore.status, 'restored');
                assert.equal(after.listable, LISTABLE.length + 1,
                    'and the re-read listing carries it back — one more listable profile');
                assert.equal(after.restorable, RESTORABLE.length - 1, 'one fewer to restore');

                await page.evalFn(() => window.__sel.forget('GET', '/api/v1/profiles'));
            });

        test('D6 — the purge half is not on this screen', async () => {
            const purge = await page.evalFn(() => window.__sel.countCallsEndingIn('DELETE', '/purge'));
            assert.equal(purge, 0, 'nothing here purges; Part 1 defers the purge half');
            const controls = await page.eval(`(function () {
                var root = document.querySelector('selector-screen').shadowRoot;
                return root.textContent.toLowerCase().indexOf('purge');
            })()`);
            assert.equal(Number(controls), -1, 'and no control on the screen offers one');
        });

        /* ═══════════════════════════════════════════════════════════════════
         * 10. HELD — the overlays did not become grid children
         * ═════════════════════════════════════════════════════════════════ */

        test('the loop added seven overlays and the grid still has two ITEMS', async () => {
            const items = await page.eval(`(function () {
                var root = document.querySelector('selector-screen').shadowRoot;
                return JSON.stringify(Array.prototype.map.call(root.children, function (c) {
                    var pos = getComputedStyle(c).position;
                    return {
                        tag: c.tagName.toLowerCase(),
                        inFlow: pos !== 'fixed' && pos !== 'absolute',
                    };
                }));
            })()`);
            const laid = JSON.parse(items);
            assert.deepEqual(laid.filter((c) => c.inFlow).map((c) => c.tag),
                ['ui-page-header', 'selector-split'],
                '§7.3 P1: four dialogs parsing as children of the grid is the defect');
            const overlays = await page.eval(`(function () {
                var root = document.querySelector('selector-screen').shadowRoot;
                return JSON.stringify({
                    dialogs: root.querySelectorAll('ui-dialog, ui-confirm-dialog').length,
                    menus: root.querySelectorAll('ui-menu').length,
                    screenMenus: root.querySelectorAll('.toolbar ui-menu').length,
                    rowMenus: root.querySelectorAll('ui-menu.row-menu').length,
                    rows: root.querySelectorAll('[role="treeitem"]').length,
                    nativeDialogsInThisRoot: root.querySelectorAll('dialog').length,
                });
            })()`);
            const found = JSON.parse(overlays);
            assert.equal(found.dialogs, 6,
                'six dialog surfaces: confirm-hide, confirm-reset, confirm-remove, share-code, versions, restore');
            assert.equal(found.screenMenus, 1, 'the add menu on the list toolbar');
            assert.ok(found.rowMenus > 0, 'the rows really do carry their own menus');
            assert.ok(found.rowMenus < found.rows,
                'and the folder headings do not — a family has no actions of its own');
            assert.equal(found.menus, found.rowMenus + 1,
                'every menu is a row\'s or the toolbar\'s — nothing else holds one');
            assert.equal(found.nativeDialogsInThisRoot, 0,
                'every native <dialog> is inside its own component root, not this grid');
        });

        test('the list region still scrolls and the listbox still does not', async () => {
            assert.equal(await page.prop(ROWS, 'overflow-y'), 'visible',
                'the listbox is not a scroll region — the pane owns the scrollport');
            assert.equal(await page.prop(`${S} >>> #list-pane >>> #list`, 'overflow-y'), 'auto',
                'and the pane still does (§4.2 names two scroll regions)');
        });

        test('P13 — every dialog and both menus hold nothing reachable while closed',
            async () => {
                const census = async () => {
                    await page.evalFn(P13_SHUT);
                    await page.settle(2);
                    return page.evalFn(P13_CENSUS);
                };

                const closed = await census();
                assert.equal(closed.length, 7, 'six dialog surfaces and the add menu');
                assert.deepEqual(closed.filter((o) => o.missing).map((o) => o.id), [],
                    'an overlay this screen is supposed to own is not in its root');
                for (const overlay of closed) {
                    assert.equal(overlay.open, false, `${overlay.id} would not close`);
                    assert.equal(overlay.reachable, 0,
                        `${overlay.id} (${overlay.tag}) leaves ${overlay.reachable} focusables `
                        + 'reachable while closed — the old skin left 16');
                }
                assert.ok(closed.reduce((n, o) => n + o.candidates, 0) > 0,
                    'the census found no focusable candidates anywhere — the walk never '
                    + 'entered the overlays, so "reachable: 0" is not a measurement');

                /* OPEN — the guard on the guard. A selection first: Confirm is not offered
                 * without one, and this test must not depend on what the loop left behind. */
                await page.evalFn(() => window.__sel.select(window.__sel.ids({ limit: 1 })[0]));
                await page.evalFn(async () => {
                    const screen = document.querySelector('selector-screen');
                    screen.shadowRoot.getElementById('confirm-hide').show({ reason: 'test' });
                    await screen.updateComplete;
                });
                await page.settle(2);
                const open = await page.evalFn(P13_CENSUS);
                const confirm = open.find((o) => o.id === 'confirm-hide');
                assert.equal(confirm.open, true, 'the confirm dialog opened');
                assert.ok(confirm.reachable > 0,
                    'an OPEN dialog must reach its own controls through the boundaries, or '
                    + 'the closed census above is blind rather than clean');
                for (const overlay of open.filter((o) => !o.open)) {
                    assert.equal(overlay.reachable, 0,
                        `${overlay.id} woke up beside an open dialog`);
                }

                /* AND SHUT AGAIN — after a real open, which is the state hides in. */
                for (const overlay of await census()) {
                    assert.equal(overlay.open, false, `${overlay.id} would not close`);
                    assert.equal(overlay.reachable, 0,
                        `${overlay.id} stayed reachable after an open/close cycle`);
                }
            });
    });
}
