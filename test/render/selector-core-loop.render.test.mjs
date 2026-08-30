/**
 * selector-core-loop.render.test.mjs — wave 5.3, the core-loop-and-REST cluster:
 * `sel-core-loop`, `sel-highlight-by-id`, `sel-restore-to-factory`,
 * `sel-versions-entry-point`, `sel-refusal-surfacing`, `sel-components`,
 * `sel-contract-table`, `bug-P6-list-row-built-once`, `bug-P8-confirm-primary`,
 * `bug-P12-real-listbox`, `bug-P4-hit-floor-one-owner`,
 * `bug-chartC3-unpadded-preview-host`.
 *
 * THE MOCK IS THE DATA, AND THE APP IS THE APP. `tools/mock_rea.py` serves its recorded
 * 147-record listing, its workflow report and its favourites map over a real socket on an
 * ephemeral port; `createAppBoot` builds the real transport against it; the real store,
 * the real rules module and the real adapters run in between. What is scripted is named
 * in `test/fixtures/selector-loop-fixture.js` and is only what the mock cannot answer:
 * the arm-time REFUSAL, the restore (a typed success body the mock refuses to invent),
 * and the lineage (no recording exists).
 *
 * BOTH GATE A GEOMETRIES. The loop is the same loop at both; what differs is the box it
 * runs in, which is why the numbers are recorded per geometry.
 *
 * THE MOCK IS STARTED ON AN EPHEMERAL PORT, per geometry, and torn down after. Wave 3
 * recorded browser/port contention as an intermittency hazard and the capture battery
 * owns 8080; nothing here may take it.
 *
 * ONE MOUNT PER GEOMETRY, MANY TESTS. The listing is 147 records over a real socket and
 * re-mounting it per assertion is thirty seconds of nothing; the loop's steps are ordered
 * anyway (you cannot confirm before you select). So a driver test walks the loop and the
 * assertions read what it captured — a failure then names the STEP rather than the chain.
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

/**
 * P13's census on THIS screen: what a CLOSED overlay still holds in the tab order.
 *
 * REACHABLE MEANS A PAINTED BOX, not `hidden` and not an attribute. A native <dialog>
 * closes to `display: none` and a `display: none` subtree has no client rect at all; the
 * old skin's DaisyUI `.modal` stand-in closes to `opacity: 0`, which paints every control
 * inside it and is exactly how the row's SIXTEEN were counted. So the question "is this
 * thing still tabbable" is answered by geometry rather than by the markup that claims it.
 *
 * IT WALKS SHADOW ROOTS, and the whole census is worthless if it stops at the first
 * boundary — `#confirm-hide` is a `display: contents` host over `<ui-dialog>` one root
 * deeper, so a light-DOM-only walk sees none of its five controls and reports a serene
 * zero. `candidates` is the guard on the guard: it counts what the walk FOUND, so a
 * regression to a shallow probe reads as nothing-found rather than as a green assertion.
 *
 * Self-contained on purpose — `page.evalFn` stringifies it, so it may close over nothing.
 */
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
    /* `actions` LEFT THIS LIST on 25 August 2026: it is a <div> of three worded buttons
     * now, not a menu ("Copy slate"), so it has no `open` and nothing to shut - and its
     * three buttons are reachable BY DESIGN, which is what a P13 census would have called
     * a leak. `confirm-reset` and `confirm-remove` joined it in the same change. */
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

        /* ═══════════════════════════════════════════════════════════════════
         * 1. THE LOOP, END TO END, AGAINST THE MOCK
         *    list -> search -> select -> favourite -> confirm
         * ═════════════════════════════════════════════════════════════════ */

        test('DRIVE: list, search, select, favourite, confirm', async () => {
            run.loaded = await page.evalFn(() => window.__sel.state());

            /* THE TREE OPENS BEFORE THE REST OF THE DRIVE, and the fold is measured on its
             * own below. Families ship SHUT (Slate's own default, and the state that makes
             * 91 profiles legible), so every assertion here about "the listing" would
             * otherwise be about the handful of ungrouped rows. */
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

            /* THE CONDITIONAL READ. Nothing in the app sets a header: `/profiles` is in
             * CONDITIONAL_ROUTES, so `rea-transport.js` stores the ETag off the first
             * answer, sends `If-None-Match` on the next, and turns the 304 into an
             * ordinary ok result carrying `notModified` and the STORED body. The store
             * counts them, so "the read was conditional" is a number, not a belief.
             *
             * THE SERVER HALF IS SCRIPTED AND THE FINDING IS RECORDED: `tools/mock_rea.py`
             * sends no ETag on anything, so the instrument cannot exercise a path the
             * getProfiles row's `conditional` gate promises. The fixture's scripted answer
             * behaves as `jsonOkConditional` does; everything on the client side of it is
             * the shipping transport. */
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

            /* FAVOURITE — put the picked profile on slot 1 by pressing the disc.
             *
             * A PROFILE THE RAIL DOES NOT ALREADY HOLD, because the duplicate guard
             * refuses one that does (Ben, 25 Aug 2026: "Assigning a profile already on a
             * slot: Copy Slate"). Rule 4 seeds the rail by title, so `clickRow(0)` can
             * land on a profile that is already seated - it did the moment the list was
             * sorted - and the press would then be correctly refused rather than seated.
             * `run.pickedId` stays what row 0 is, for every other assertion in this file;
             * this picks its own subject. */
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
            /* A DELTA, NOT A TOTAL. Every favourite assignment now arms the machine too
             * (Ben, 25 Aug 2026: "Slate's press also loads the profile onto the
             * machine... yes do that as well"), and the two assigns above this line each
             * send their own POST. A total would count them against Confirm and read as
             * "Confirm sent three", which is the opposite of what this test is about. */
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

        /**
         * cmp-seh-1 — THE SUMMARY STRIP'S ROSTER, AND THE PEAK TRAP UNDER IT.
         *
         * The finding: the strip shipped Yield / Volume / Time / Temperature where Slate
         * paints Temp / Peak / Duration / Steps / Stop at, dropping Peak and Steps with no
         * manifest row naming the change. Ben's roster is Slate's set minus Duration —
         * Temp · Peak · Steps · Stop At — and his one instruction about it is "PEAK MUST BE
         * COMPUTED CORRECTLY".
         *
         * THE EXPECTED READINGS ARE THE ORACLE'S OWN PAINTED TEXT, not this file's
         * arithmetic over the record. `prov-baseline/profile-selector.json` [i=178..187]
         * holds five label/value pairs for the same profile the mock serves, and four of
         * them are this roster: Temp "83.5 °C", Peak "6.0 bar", Steps "3", Stop at "40 g".
         * Recomputing them here from `record.profile` would assert that the screen agrees
         * with a second implementation written in a test; quoting Slate's screen asserts
         * that it agrees with the machine this skin replaces.
         *
         * THE TRAP IS TESTED WITH A PROFILE THAT SPRINGS IT. Slate read a non-pressure
         * step's LIMITER as its peak (`profile-totals.js:31-33`, read-only), so a profile
         * whose every step is flow reported its limiter — usually the machine's default
         * 9.0 bar — as a pressure the shot would reach. "GHC/manual flow control" is that
         * profile in the recorded listing: two flow steps, both limited at 9.0, and NOTHING
         * in it commands a pressure at all. The right answer is the tile's own dash, and
         * the assertion states Slate's number so the trap is named rather than assumed.
         *
         * AND THE ABSENCES ARE READ THROUGH #34, not off the binding — see `tiles()` in the
         * fixture for why. A dash a person can see plus a sentence a screen reader hears is
         * the claim; `value=""` is only its mechanism.
         */
        test('cmp-seh-1 — the strip is Temp · Peak · Duration · Steps · Stop at, and the peak is commanded, not limited',
            async () => {
                const ORACLE_TITLE = 'Extractamundo Dos! (2)';
                const chosen = await page.evalFn(
                    (title) => window.__sel.selectByTitle(title), ORACLE_TITLE,
                );
                assert.ok(chosen, `the recorded listing carries ${ORACLE_TITLE}`);
                const tiles = await page.evalFn(() => window.__sel.tiles());

                /* DURATION CAME BACK on 25 August 2026, third of five. Ben: "Add duration
                 * and bunch them up on the left side of the chart like Slate has done."
                 * It had been dropped when the strip was cut to Slate's four; Slate's own
                 * strip carries it, and the row is left-bunched rather than spread, so the
                 * space it takes is space the strip already had. */
                assert.deepEqual(tiles.map((tile) => tile.key),
                    ['temp', 'peak', 'duration', 'steps', 'stop-at'],
                    'five tiles, in Ben\'s order — Duration is third');
                assert.deepEqual(tiles.map((tile) => tile.label),
                    ['Temp', 'Peak', 'Duration', 'Steps', 'Stop at'],
                    'labelled as Slate labels them, through t()');

                /* THE ORACLE'S OWN STRIP, rebuilt from what each tile paints: the reading
                 * and the unit beside it are two elements here and one span there. */
                const painted = tiles.map(
                    (tile) => (tile.spokenUnit ? `${tile.reading} ${tile.spokenUnit}` : tile.reading),
                );
                assert.deepEqual(painted, ['83.5 °C', '6.0 bar', '2:00 max', '3', '40 g'],
                    'prov-baseline/profile-selector.json [i=179,181,185,187], verbatim, '
                    + 'with the duration the profile\'s own frames add up to');
                assert.ok(tiles.every((tile) => tile.absent === false),
                    'and this profile answers all five, so no tile is dashing');

                /* -- THE TRAP ------------------------------------------------ */
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

                /* -- THE STOP TARGET THE PROFILE ACTUALLY STATES ------------- */
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

            /* IT USED TO SELECT, and Ben reversed that on 23 Aug 2026: "if I select one
             * and then press the favorite button at the bottom it should change that
             * favorite." This screen is where the five slots are MANAGED, and what is in
             * a slot is already one press away in the list beside it — so the press is
             * spent on the gesture that had no home. The menu's "Add to favourites" still
             * takes the first EMPTY slot; this is how a slot already in use gets a new
             * profile, which is the half that was missing. */
            const after = need('favouritePick');
            assert.equal(after[0], need('assignId'),
                'pressing slot 1 with a profile selected did not seat it there');
        });

        test('an empty slot is a value, and every slot is offered BY NUMBER', () => {
            /* `profileManager.js:450` reads `index` in a loop that declares `i`, so the
             * FIRST empty slot throws a ReferenceError and aborts the repaint. Here an
             * empty slot is the ordinary case: it is rendered, it is cleared, and the rail
             * goes on working around it.
             *
             * THE ANTI-OVERWRITE RULE CHANGED SHAPE on 25 August 2026 and got stronger.
             * It used to be "a full rail offers no add", which protected slot 0 by removing
             * the action; the row menu now offers all five slots by number, each labelled
             * with the profile it currently holds ("Favourite 3 — replace Tea"). Nothing is
             * hidden and nothing is silent: you are told which slot and what it costs
             * before you press. That is Slate's design - "Every slot is always offered by
             * number" - and it is why the implicit first-empty-slot action was deleted
             * rather than re-homed. */
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
            /* Ben, 24 Aug 2026 — he said it twice. 23 August: "Pressing confirm in the
             * profile selector doesn close the page, just asks for confirmation." Half of
             * that was fixed (the press leaves for Live) and the half named FIRST was
             * left: a button labelled Confirm that opens a dialog asking you to confirm
             * asks the same question twice. The old skin's own Confirm writes the workflow
             * and returns to the Live page, with no dialog anywhere in it — and loading is
             * reversible, which is what makes the second asking unnecessary rather than
             * merely annoying. */
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
         * 2. P12 — A REAL LISTBOX
         * ═════════════════════════════════════════════════════════════════ */

        /* ═══════════════════════════════════════════════════════════════════
         * 1b. THE FAMILIES FOLD (Ben, 24 August 2026)
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
            /* MOVED HERE FROM THE SKELETON SUITE, which used to find a `.group` in the
             * no-boot demo. The demo renders flat now, so the only real families are the
             * booted ones — which is where this claim belonged anyway. */
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
            /* A TREE SINCE WAVE 5.8, and the change is P12's own rule followed rather than
             * bent. `role="listbox"` owns options and groups; a disclosure is neither, and
             * the assertion below names "a folder disclosure's head row" as the failure it
             * exists to catch. A collapsible grouped single-select list IS a tree, so
             * folding the families made the wrapper one. Everything else P12 asks for —
             * one tab stop, an activedescendant that resolves in the same root, no roving
             * tabindex — is the same claim about a tree as about a listbox. */
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

            /* THE PROBE PIERCES, AND THAT IS ASSERTED BEFORE ANYTHING IT REPORTS IS READ.
             * This assertion passed vacuously for a whole wave because `listboxRoles()`
             * was one `querySelectorAll`, which does not cross a shadow boundary — so the
             * 78 `button "More actions"` nodes each <ui-list-row> rendered INSIDE ITSELF
             * were invisible to the exact test that exists to find them (measured with CDP
             * Accessibility.getFullAXTree; ui-list-row.render.test.mjs:792 reads roles that
             * way for the same reason). One shadow root per row is the floor here: a
             * regression to a light-DOM walk reports zero and fails on this line rather
             * than passing on the next. */
            assert.ok(walk.walked >= need('optionsAtRest'),
                `the role walk entered ${walk.walked} shadow roots for ${need('optionsAtRest')} options — `
                + 'a probe that does not flatten cannot see what P12 is about');

            /* `button` IS ALLOWED HERE SINCE BEN'S DECISION D21 (30 August 2026), AND ONLY
             * BY COUNT. The row-actions opener is focusable on the row
             * aria-activedescendant names and nowhere else, so at most ONE of the 78 is a
             * control at any moment and it moves with the arrow keys. That is not the thing
             * P12 measured — 78 operable nodes, 79 tab stops, every option's name reading
             * "Preinfuse then 45ml of water More actions" — it is one tab stop for the whole
             * listing, which is what the tree already had. The COUNT is the law now, and the
             * assertion below states it; `selector-row-actions-name.render.test.mjs` holds
             * the rest (which row it is on, and that no row's name absorbs it).
             *
             * AT REST THE COUNT IS USUALLY ZERO, because families ship shut and the active
             * node is a family row, which has no menu. The keyboard case below is what
             * measures the state where an opener IS reachable — without it this assertion
             * would pass by accident of the initial selection. */
            assert.ok((roles.button ?? 0) <= 1,
                `at most one reachable row-actions opener, ever — saw ${roles.button} in ${JSON.stringify(roles)}`);
            const unexpected = Object.keys(roles)
                .filter((r) => r !== 'treeitem' && r !== 'group' && r !== 'button');
            /* The family caption is a <span aria-hidden="true"> inside the group and is not
             * reported at all: the walk reports explicit roles and the IMPLICIT roles of
             * operable elements, which is what an accessibility tree exposes and what
             * "only options inside it" is a claim about. A <button> anywhere under here —
             * a row's own affordance, a folder disclosure's head row — arrives as `button`
             * and fails this. */
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
                /* THE STATE THE CENSUS ABOVE CANNOT SEE. At rest the active node is a
                 * family row and no opener is reachable, so "at most one button" passes
                 * with zero and would go on passing if the roving broke. This drives the
                 * keys onto a PROFILE row and re-measures the same walk there. */
                await page.evalFn(() => window.__sel.key('End'));
                const roles = await page.evalFn(() => window.__sel.listboxRoles());
                assert.equal(roles.button ?? 0, 1,
                    'the row the keyboard is standing on offers a reachable opener — '
                    + `saw ${JSON.stringify(roles)}`);

                const unexpected = Object.keys(roles)
                    .filter((r) => r !== 'treeitem' && r !== 'group' && r !== 'button');
                assert.deepEqual(unexpected, [],
                    `§7.3 P12 still holds beside it — found ${JSON.stringify(roles)}`);

                /* AND THE TREE'S OWN TAB STOP IS UNMOVED: no OPTION took a tabindex, which
                 * is the activedescendant-not-roving rule this screen is built on. The
                 * opener is inside an option, not one. */
                const aria = await page.evalFn(() => window.__sel.listboxAria());
                assert.equal(aria.optionsWithTabindex, 0,
                    'the rows are still addressed by aria-activedescendant');
                assert.equal(aria.tabindex, '0', 'and the tree keeps its own single tab stop');
            });

        /* ═══════════════════════════════════════════════════════════════════
         * 3. P6 · P4 — one row, one owner of its box
         * ═════════════════════════════════════════════════════════════════ */

        test('P6 — every option is the same one component, and all 78 answer alike', () => {
            const tags = need('optionTags');
            assert.deepEqual(Object.keys(tags), ['ui-list-row'],
                '§7.3 P6: "the profile row is implemented TWICE" needs a second implementation');

            /* THE HALF THAT WENT MISSING WAS UNIFORMITY, not the affordance itself: "the
             * affordance added to the first never reached the second". One template cannot
             * disagree with itself, and this is that stated as a number — every option
             * slots its own actions trigger, and no row renders a <button> of its own.
             * The VALUE is P12's call (a real button inside a role="option" is its fourth
             * half) and lives in #option() and #rowMenu(); what P6 pins is that the 78
             * rows cannot diverge.
             *
             * UPDATED 30 August 2026, audit D11: this used to read `withNoOverflow`, the
             * count of rows carrying the attribute that suppressed #26's built-in
             * affordance. The affordance and the attribute are both gone, so that count
             * would now be a uniform zero and would pass while measuring nothing. */
            const affordance = need('optionAffordance');
            assert.equal(affordance.options, tags['ui-list-row'], 'every option is a row');
            assert.equal(affordance.withButton, 0,
                'no row draws a <button> of its own (D11 deleted the one it had), and the '
                + 'trigger the screen slots is a <span>: a real <button> under a '
                + 'role="treeitem" is P12\'s "non-option children inside the listbox"');

            /* EACH CLASS IS UNIFORM AND THE TWO ARE EXHAUSTIVE — the P6 pin, and it is
             * a stronger one than the attribute count it replaces. A folder row has no
             * record, so it has no row menu; a profile row always has both. What P6
             * forbids is a row that falls between them, which is what "the affordance
             * added to the first never reached the second" actually was. */
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
                 * root — #26's — so P4's "one rule here, paint 1300 lines away" has no
                 * second place to live. */
                const declared = await page.computed(ROW, ['block-size', 'min-block-size', 'padding-top']);
                const rowToken = px(await page.resolveToken('--ui-list-row', 'block-size'));
                near(px(declared['block-size']), rowToken, 'the row is --ui-list-row tall, from #26');

                const slot = await page.box(`${S} >>> #favourites >>> ui-favourite-slot`);
                assert.ok(slot.width > 0 && slot.height > 0, 'the rail\'s slots are on screen');
            });

        /* ═══════════════════════════════════════════════════════════════════
         * 4. P8 — the confirm button has a real primary treatment
         * ═════════════════════════════════════════════════════════════════ */

        test('P8 — Confirm is not Cancel painted twice, in the band and in the dialog',
            async () => {
                /* THE PAINT IS ON #1'S INNER BUTTON, not on its host: `:host([variant=
                 * "primary"]) .btn` is where the fill lives, and a host-level read would
                 * measure the same transparent box for both and pass P8 for the wrong
                 * reason — which is the shape of the defect itself. */
                const band = await page.computed(`${CONFIRM} >>> .btn`, ['background-color']);
                const cancel = await page.computed(`${S} >>> #cancel >>> .btn`, ['background-color']);
                assert.notEqual(band['background-color'], cancel['background-color'],
                    '§7.3 P8: "measured transparent, identical to Cancel beside it"');
                assert.ok(!/rgba\(0, 0, 0, 0\)|transparent/.test(band['background-color']),
                    'and the primary variant actually paints a fill');

                /* THE DIALOG HALF MOVED TO THE ONE THAT IS STILL THERE. The load confirm
                 * is gone (24 Aug 2026 — see 'confirm ARMS THE MACHINE'); the HIDE confirm
                 * remains, because hiding a profile the user made is not reversible from
                 * this app. #19's tone table is what is being measured either way. */
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
         * 5. chart-C3 — the preview host is unpadded
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

        /* ═══════════════════════════════════════════════════════════════════
         * 6. sel-highlight-by-id — BY ID, and the R1 fallback is marked
         * ═════════════════════════════════════════════════════════════════ */

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
                    /* R1 LANDED. The adapter's own swap branch: "the workflow report now
                     * carries profile.id — R1 HAS LANDED, delete this adapter". The title
                     * is deliberately WRONG here, so a title match could not produce this
                     * answer and the id is provably what was read. */
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
                /* THE ADAPTER MATCHES AGAINST EVERY SERVED RECORD, not the listable ones:
                 * a loaded profile need not still be listable (deleting a bundled profile
                 * hides it, it does not un-load it), and the fail-safe direction is to see
                 * MORE candidates rather than fewer. Measured: 14 duplicate titles over
                 * 84 of the 147 records, against 2 over 4 of the 78 visible ones. */
                const counts = new Map();
                for (const r of FIXTURE) {
                    const t = r.profile.title;
                    counts.set(t, (counts.get(t) ?? 0) + 1);
                }
                /* NOT THE ARMED PROFILE'S OWN TITLE, and this test used to depend on
                 * that by accident. The store has a SECOND rule after R1: when the title
                 * cannot decide, the MEMORY can (profile-library-store.js:436-453) - the
                 * id this skin armed, still carrying the title the machine is running,
                 * returned as provisional and from LOADED_SOURCE.REMEMBERED. That rule is
                 * correct and is not "picking the first"; it is a different question
                 * answered by a different fact.
                 *
                 * The core-loop step above arms whatever `clickRow(0)` picked, so if the
                 * first duplicated title in the fixture happened to be that profile's, the
                 * memory answered and R1's ambiguous path was never reached. It held only
                 * while row 0 was a particular record - which stopped being true on
                 * 25 August 2026, when Ben's "Order: copy slates order" sorted the list.
                 *
                 * So the duplicate is chosen to be one the memory CANNOT answer. That is
                 * what isolates the claim this test is making. */
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
         * 7. B9 — the refusal, at the point of picking
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

                /* AND NOTHING #49 CANNOT CONSUME (P9). The refusal's kind reaches the
                 * person through the server's own two sentences — "Unsupported profile"
                 * and "Invalid profile" — and stays a VALUE on the store's state, asserted
                 * three lines up. It used to be bound onto a `kind` attribute here as well;
                 * ui-alert-banner declares no such property, attribute or rule (its whole
                 * properties map is {_hasHeadline, _hasRemedy}), so that attribute painted
                 * nothing and implied a distinction the surface never made. */
                assert.equal(banner.kindAttr, null,
                    `the banner carries an inert kind= attribute — ${JSON.stringify(banner.attributes)}`);
                assert.ok(!banner.attributes.includes('kind'), 'and not under any spelling');

                await page.evalFn(() => window.__sel.forget('POST', '/api/v1/machine/profile'));
            });

        /**
         * WHAT THE REFUSAL COSTS THE CHART — MEASURED, RECORDED, NOT DECIDED.
         *
         * §4.2's give order is normative and it inverts in this state: "list and chart
         * share the loss until the chart hits --ui-chart-min-h; then the notes cap
         * tightens", and "The chart is never reduced to a strip". With the banner on
         * screen the CHART pays the whole bill and the notes give nothing.
         *
         * THE MECHANISM, and it is a seam rather than either cluster's mistake. The banner
         * is a sibling of the tile strip inside the single slot="summary" div, which is
         * detail-pane grid ROW 2, an `auto` track. Row 2 grows by the banner plus a gap
         * while the PANE'S BLOCK SIZE DOES NOT CHANGE. Row 4 is
         * fit-content(var(--ui-selector-notes-max-share)) — a share of a box that did not
         * shrink, so it does not tighten by one pixel — and grid fills a fit-content track
         * to its growth limit BEFORE a flexible track gets anything (CSS Grid §12.6 before
         * §12.7). Row 3, minmax(0, 1fr), is the only flexible track, so it absorbs
         * everything down to zero. build:skeleton's give-order sweep shrank the STAGE,
         * where 32% of a smaller pane genuinely does tighten; the ordering holds for every
         * row of that table and fails the moment the loss comes from a SIBLING ROW.
         *
         * THIS TEST ASSERTS THE ARRANGEMENT AS IT STANDS, AND WILL FAIL WHEN IT IS FIXED —
         * that is its job, in the same idiom as "B9's trigger" in
         * test/live-connection-gates.test.mjs. The remedy is a design call with three
         * costed options and it is Ben's, recorded in DEFERRED_QUESTIONS_core-loop.md §11
         * (and in DEFERRED_QUESTIONS_skeleton.md §4, whose reversal — a definite floor on
         * the third track — is one of the three). Whoever applies one updates this test in
         * the same commit, and until then the number has a name instead of a belief.
         */
        test('§4.2 GIVE ORDER, in the refusal state: the chart pays and the notes do not — DQ',
            async () => {
                const plotFloor = px(await page.resolveToken('--ui-chart-min-h', 'block-size'));
                /* AT REST FIRST, and the B9 test above leaves its refusal standing, so the
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

                /* THE CHART TRACK, AND IT NOW DEPENDS ON THE SIZE. This was one claim -
                 * "under the plot floor at both geometries", measured at 115.39px on BENCH
                 * and 0px on FLOOR - until 25 August 2026.
                 *
                 * BENCH GAINED 44px THAT DAY and the defect stopped reproducing there.
                 * Ben: "Buttons are too tall, we are using the header height buttons when
                 * we shouldn't" and "The gap between the bottom of the header and the
                 * functions below is too big." Both panes' first row went from
                 * --ui-toolbar-h (120) to --ui-selector-band-h (64) and their inset from 18
                 * to 24, which is 56 back and 12 spent. The chart track measures 186.906px
                 * now, clear of the 160px floor.
                 *
                 * THE GIVE ORDER IS NOT FIXED, and that distinction is the whole point of
                 * keeping this test. Nothing changed about WHICH box gives first; the pane
                 * simply stopped running out at bench. FLOOR still drives the chart to 0px
                 * with the notes at their cap, so DEFERRED_QUESTIONS_core-loop.md §11
                 * stands - it is now reachable at one geometry instead of two.
                 *
                 * SO THE PIN IS PER-SIZE, and it is spelled as "either it clears the floor
                 * or the ordering below catches it" rather than as a number per geometry:
                 * a change that takes bench back under the floor fails on the ordering
                 * assertion, which is the claim that actually matters. */
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

                /* AND THE NOTES GAVE NOTHING AT BENCH — 206.719px before and after, to the
                 * thousandth. At FLOOR they give only what is left AFTER the chart has
                 * reached zero, which is the inversion stated as an ordering rather than as
                 * a pixel: the notes must never be the box still at its cap while the chart
                 * is under its floor. */
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
         * 8. B11 / Q7 — the versions entry point
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
         * 9. D6 — restore to factory, without the purge half
         * ═════════════════════════════════════════════════════════════════ */

        test('D6 — restore offers the hidden bundled profiles and round-trips one back',
            async () => {
                const opened = await page.evalFn(() => window.__sel.openRestore());
                assert.equal(opened.present, true, 'the entry point exists — there is something to restore');
                assert.equal(opened.open, true);
                assert.equal(opened.offers, RESTORABLE.length,
                    'the offer list is hidden AND isDefault AND carrying a bundle filename');

                /* THE ROUND TRIP. The restore answers with the record it un-hid, and the
                 * listing that follows carries it as VISIBLE — which is what the handler
                 * does (existing.copyWith(visibility: visible)) and what a person sees. */
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
            /* THE PATH IS THE CLAIM, and it changed shape in wave 5.8. This screen DOES
             * call `DELETE /api/v1/profiles/<id>` now — that is Hide, ReaPrime's SOFT
             * delete, which sets a visibility and removes nothing. What is still deferred
             * is `DELETE /api/v1/profiles/<id>/purge`, the one route that removes a
             * record. So the count is of paths ENDING in /purge rather than of every
             * DELETE, and the old spelling (every DELETE to /api/v1/profiles) would now
             * fail for the right feature.
             *
             * The other half of this guarantee is `test/profile-library-store.test.mjs`,
             * which walks src/ and fails if a call site for the purge route appears. */
            const purge = await page.evalFn(() => window.__sel.countCallsEndingIn('DELETE', '/purge'));
            assert.equal(purge, 0, 'nothing here purges; Part 1 defers the purge half');
            const controls = await page.eval(`(function () {
                var root = document.querySelector('selector-screen').shadowRoot;
                return root.textContent.toLowerCase().indexOf('purge');
            })()`);
            assert.equal(Number(controls), -1, 'and no control on the screen offers one');
        });

        /* ═══════════════════════════════════════════════════════════════════
         * 10. P1 HELD — the overlays did not become grid children
         * ═════════════════════════════════════════════════════════════════ */

        test('the loop added seven overlays and the grid still has two ITEMS', async () => {
            /* THE CLAIM IS ABOUT GRID ITEMS, NOT DOM CHILDREN, and it was spelled as a name
             * list until the screen grew a toast (25 August 2026, Ben's "Copy Slate" on the
             * favourite-assignment refusals).
             *
             * WHAT P1 IS ABOUT is a dialog LEAKING INTO THE LAYOUT: display:none until it
             * opens, then a third grid item that shoves the two real ones. A name list
             * caught that, but it also catches an element that can never be a grid item at
             * all. CSS is explicit here - an absolutely or fixed positioned child of a grid
             * container is NOT a grid item (css-grid-2 §6) - so ui-toast, whose host is
             * `position: fixed` (ui-toast.js:425), takes no track and moves nothing. It is
             * the same placement editor-screen.js:981 makes, for the same reason.
             *
             * SO THE ASSERTION IS NOW WHAT IT ALWAYS MEANT: every top-level child either
             * takes a track or is out of flow, and exactly two take tracks. That is
             * strictly stronger than the name list - it would still fail on a dialog in
             * flow, and it fails on a positioned element that quietly returned to static,
             * which the name list could not see. */
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
            /* SIX, AND THE ROSTER MOVED TWICE. It was four on 24 Aug 2026 — confirm-hide,
             * share-code, versions, restore; the LOAD confirm went, because a button
             * labelled Confirm that opened a dialog asking you to confirm asked the same
             * question twice, and the hide confirm and the share-code dialog arrived with
             * the add doors.
             *
             * TWO MORE ON 25 AUG 2026, both from the detail pane's three actions (Ben:
             * "Copy slate" on the audit's "Three buttons, or one menu"): confirm-reset for
             * Reset, and confirm-remove for Remove-for-good, the second of which Ben asked
             * to be built "behind a confirm that says plainly it cannot be undone".
             *
             * THE NUMBER IS NOT THE CLAIM; P1 is, and P1 is the assertion above: however
             * many overlays this screen grows, the GRID still has exactly two items. This
             * count is here so a SEVENTH arrives named rather than unnoticed. */
            assert.equal(found.dialogs, 6,
                'six dialog surfaces: confirm-hide, confirm-reset, confirm-remove, share-code, versions, restore');
            /* ONE SCREEN MENU, AND ONE PER ROW — and BOTH halves of that moved on
             * 25 August 2026.
             *
             * THE DETAIL PANE'S OVERFLOW MENU IS GONE. Ben, on the selector audit's "Three
             * buttons, or one menu": "Copy slate." Slate carries Hide / Reset / Edit as
             * three worded buttons in the title row, so the menu that used to hold them is
             * not there to count. What remains at screen level is the add menu on the list
             * toolbar — three doors behind one menu, because they are three ways to do one
             * thing.
             *
             * THE PER-ROW MENUS ARE NEW, from the same day: "add the … so that we can hide
             * it, assign it but maybe we should also have a remove as well?" So the total
             * is the row count plus one rather than a fixed 2.
             *
             * IT IS SPELLED AS ARITHMETIC, not as the 80 this fixture happens to produce:
             * a change to the fixture's listing moves the expectation with it, and a menu
             * that appears on something OTHER than a row still fails.
             *
             * IT COUNTS ROW MENUS AND NOT TREE ITEMS, because they are not the same
             * number: 93 tree items against 79 rows that carry a menu. The difference is
             * the FOLDER headings, which are tree items with children and no actions of
             * their own — there is nothing to hide, reset or assign about a family. */
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

        /* ═══════════════════════════════════════════════════════════════════
         * 11. P13 — A CLOSED OVERLAY IS OUT OF THE TAB ORDER, ON THIS SCREEN
         *
         * ITEMS `bug-P13-closed-dialogs-leave-tab-order`: "Today the selector's DaisyUI
         * `.modal` stand-ins leave 16 focusables reachable inside closed dialogs. This
         * wave inherits and VERIFIES IT ACROSS ITS FOUR DIALOGS; it does not re-build the
         * machinery." Wave 5.2 built the machinery and asserts it at component level
         * (ui-dialog, ui-confirm-dialog, dialog-contract) — but none of those suites mounts
         * `<selector-screen>`, so until this test the wave's own row was undelivered: the
         * behaviour was right by inheritance, and a change that put these four overlays
         * back in the tab order would have failed nothing in the tree (finding cross-2).
         *
         * THE SUBJECT COUNT IS FOUR DIALOGS PLUS TWO MENUS —
         * DEFERRED_QUESTIONS_core-loop.md, "Not built": #confirm-hide (#19), #share-code and #versions
         * (#18), #restore (#18), and #actions (#21) is the context menu. The menu is
         * censused with them because P13 is about an overlay that holds focusables while
         * shut, and a menu holds items.
         *
         * THE OPEN CENSUS IS NOT DECORATION. It is the only thing standing between this
         * test and a vacuous pass: if the walk could not reach inside these hosts, every
         * count would be zero and closed-is-zero would mean nothing. So an OPEN dialog must
         * report reachable controls, and the open-then-close cycle — the half-state the
         * defect actually hides in, where a stand-in has painted its controls once already
         * — must return to zero.
         * ═════════════════════════════════════════════════════════════════ */

        test('P13 — every dialog and both menus hold nothing reachable while closed',
            async () => {
                const census = async () => {
                    await page.evalFn(P13_SHUT);
                    await page.settle(2);
                    return page.evalFn(P13_CENSUS);
                };

                const closed = await census();
                /* SEVEN SINCE 25 Aug 2026: `actions` left (three worded buttons now, not a
                 * menu, and reachable by design), `confirm-reset` and `confirm-remove`
                 * joined. What follows is the roster as it stood on 24 Aug:
                 * the LOAD confirm is gone (a Confirm that asked you to confirm), the HIDE
                 * confirm and the SHARE-CODE dialog arrived, and the add menu joined the
                 * profile-actions one. P13's claim is unchanged and is about all of them. */
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

                /* AND SHUT AGAIN — after a real open, which is the state P13 hides in. */
                for (const overlay of await census()) {
                    assert.equal(overlay.open, false, `${overlay.id} would not close`);
                    assert.equal(overlay.reachable, 0,
                        `${overlay.id} stayed reachable after an open/close cycle`);
                }
            });
    });
}
