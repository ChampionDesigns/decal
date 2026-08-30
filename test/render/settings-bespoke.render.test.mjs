/**
 * settings-bespoke.render.test.mjs — the nine bespoke leaves, measured off the engine.
 * Wave 5.4: `bespoke-leaves-nine`, `d7-led-live-preview`, `d9-calibration-surfaces`,
 * `q14-toggle-pill`.
 *
 * WHAT ONLY A BROWSER CAN ANSWER, and it is the whole reason this file is separate from
 * `test/settings-bespoke.test.mjs`: whether nine leaves land on ONE measure (T1, T21),
 * whether the wizard card MOVES between its states (the first cut of this rebuild was
 * rejected for exactly that), whether the tile grid reflows, and whether #38 is centred
 * where three shell rules used to left-align it (T11). None of those is a fact about
 * source text and none of them can be asserted from one.
 *
 * BOTH GATE A GEOMETRIES. The leaf pane is the elastic region and the lighting leaf's two
 * columns are an INTRINSIC auto-fit rather than a breakpoint, so the same section is
 * measured in two boxes and the column count is allowed to differ between them — what may
 * not differ is the measure.
 *
 * THE FIXTURE IS ARMED BEFORE IT IS MEASURED (the 5.2 carry-forward, and it bites hardest
 * here): three of the nine are capability-gated and render NOTHING until the served array
 * says PRESENT, so a suite that measured before `capabilities([...])` resolved would
 * measure an empty box and pass.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';

const MODULES = ['/test/fixtures/settings-shell-fixture.js'];
const STAGE = '<div id="stage" style="inline-size: 100%; block-size: 100dvh"></div>';

/** The nine, with the category each one is reached through. */
/* THE GATEWAY GROUP LEFT THIS LIST ON 26 AUGUST 2026. Its 885px was T21's FINDING — "a
 * third live measure, documented nowhere" — rather than a requirement, and the page is
 * four registry rows now (Ben: "take Slate's inputs but lay them out like every other
 * page"). A leaf leaves this list the moment its content is rows, which is the direction
 * the list is supposed to move. */
/* NAMED FOR WHAT IT IS, NOT FOR HOW MANY. It was `NINE` and held nine until
 * 28 August 2026, when `display-screen` became primitive and left it holding
 * eight under a name that said otherwise. */
const BESPOKE_PANES = Object.freeze([
    ['machine', 'machine-machine-info'],
    ['machine', 'machine-sleep-wake-schedules'],
    ['display', 'display-skin'],
    ['updates', 'updates-skin-app'],
    ['units-language', 'units-language-select-language'],
    ['calibration', 'calibration-load-cells'],
    /* `display-screen` LEFT ON 28 AUGUST 2026. Its bespoke half was the brightness
     * slider and nothing else, and `ARCHETYPE.SLIDER` turned that into a registry
     * row — so the leaf is primitive and its two surviving assertions (the floor of
     * 10, and the served value outranking the stored one) moved to
     * `settings-leaves.render.test.mjs`, which is where rows are measured. */
    ['accessories', 'accessories-lighting'],
]);

/** The three that are gated on the served capability array (A3). */
const GATED = Object.freeze(['machine-sleep-wake-schedules', 'calibration-load-cells', 'accessories-lighting']);

const near = (got, want, what, tol = 0.51) => assert.ok(
    Math.abs(got - want) <= tol,
    `${what}: expected ${want}, got ${got}`,
);

/** The two leaf halves and the pane, as boxes. One round trip. */
const paneReport = (page) => page.evalFn(() => {
    const root = document.querySelector('settings-screen').shadowRoot;
    const pane = root.getElementById('leaf-pane');
    const box = (el) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.x, width: r.width, height: r.height, top: r.top };
    };
    const bespoke = root.getElementById('bespoke');
    const paneStyle = getComputedStyle(pane);
    return {
        measure: box(pane.shadowRoot.getElementById('leaf')),
        pane: box(pane),
        /* THE PANE'S OWN ARITHMETIC, so the claim can be about the DECLARATION rather
         * than about a number. `clientWidth` already excludes the scrollbar, which is
         * the only thing that legitimately moves the leaf's width between leaves —
         * scrollbars stay VISIBLE here (T16), so a taller leaf really does have 15px
         * less room, and a suite that demanded one pixel count would be asserting the
         * absence of a scrollbar. */
        paneContent: pane.clientWidth
            - parseFloat(paneStyle.paddingInlineStart) - parseFloat(paneStyle.paddingInlineEnd),
        /* RESOLVED, NOT PARSED. `--ui-measure-wide` is `84ch` and a `ch` is a property of
         * the element it resolves on, so the only honest way to read it in pixels is to
         * put a box of that width in the same place the leaf sits and measure it. The
         * probe is removed before anything else is read. */
        measureWide: (() => {
            const probe = document.createElement('div');
            probe.style.cssText = 'position:absolute;visibility:hidden;inline-size:var(--ui-measure-wide)';
            pane.shadowRoot.append(probe);
            const width = probe.getBoundingClientRect().width;
            probe.remove();
            return width;
        })(),
        primitive: box(root.getElementById('leaf')),
        bespoke: box(bespoke),
        bespokeTags: bespoke
            ? [...bespoke.shadowRoot.querySelectorAll('*')]
                .map((el) => el.localName).filter((tag) => tag.startsWith('ui-'))
            : [],
        paneScrollsInline: pane.scrollWidth > pane.clientWidth + 1,
    };
});

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`settings bespoke leaves @ ${geometry.name} (${geometry.width}x${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {
        let page;

        before(async () => {
            page = await browser.newPage({ geometry });
            await page.mount(STAGE, MODULES);
            await page.evalFn(() => window.__settings.mount().then(() => true));
            assert.deepEqual(page.pageErrors, [], 'the screen must mount without throwing');
        });

        after(async () => { await page?.close(); });

        const show = async (categoryId, leafId) => {
            await page.evalFn(async (c, l) => {
                await window.__settings.selectCategory(c);
                await window.__settings.selectLeaf(l);
                return true;
            }, categoryId, leafId);
            await page.settle();
        };

        /** Serve the capability array (or refuse to, which is the mock's own behaviour). */
        const serve = async (entries) => {
            await page.evalFn((e) => window.__settings.capabilities(e).then(() => true), entries);
            await page.settle();
        };

        /* ═══════════════════════════════════════════════════════════════════
         * 1. A3 — THE THREE GATED LEAVES, AGAINST THE MOCK'S OWN VERDICT
         * ═════════════════════════════════════════════════════════════════ */

        describe('fail-closed covers UNKNOWN as well as ABSENT', () => {
            test('with the capability read FAILING, the three gated leaves render nothing', async () => {
                await serve(null);
                for (const leafId of GATED) {
                    const category = BESPOKE_PANES.find(([, id]) => id === leafId)[0];
                    await show(category, leafId);
                    const report = await paneReport(page);
                    assert.deepEqual(report.bespokeTags, [],
                        `${leafId} rendered a surface while its capability was UNKNOWN`);
                    near(report.bespoke.height, 0, `${leafId} occupies no space`, 1.01);
                }
            });

            test('an EMPTY served array is a real answer and closes them too', async () => {
                await serve([]);
                for (const leafId of GATED) {
                    const category = BESPOKE_PANES.find(([, id]) => id === leafId)[0];
                    await show(category, leafId);
                    const report = await paneReport(page);
                    assert.deepEqual(report.bespokeTags, [], `${leafId} rendered on a DE1`);
                }
            });

            /* A GATE IS A STATE, NOT A ONE-SHOT VERDICT. Every other test in this file
             * serves the capability array BEFORE it shows a leaf, which is the one order
             * that cannot see the defect this test exists for: the capability read is
             * asynchronous (and fails by default, which is what the mock does), so the
             * REAL first order is leaf-then-answer. `deps` is memoised per boot, so
             * nothing about the leaf's properties changes when the answer lands — without
             * a subscription the leaf asks "may I render" exactly once, is told no, and
             * stays shut, or opens without ever issuing the read it suppressed. */
            test('a capability that arrives AFTER the leaf is on screen opens the surface AND the read', async () => {
                await serve(null);
                await show('accessories', 'accessories-lighting');
                const shut = await paneReport(page);
                assert.deepEqual(shut.bespokeTags, [], 'the gate is closed while the answer is UNKNOWN');

                /* NO RE-SELECT. The leaf stays exactly where it is; only the machine's
                 * answer changes, which is what happens in the app. */
                await serve(['ledStrip']);
                await page.settle();
                const opened = await paneReport(page);
                assert.ok(opened.bespokeTags.includes('ui-bank'),
                    `the surface opened but the LED read never went out: ${JSON.stringify(opened.bespokeTags)}`);
                assert.ok(!opened.bespokeTags.includes('ui-empty-state'),
                    'a leaf stuck on "the lighting is not readable" is the gate having latched');
            });

            test('the wizard reads the machine when ITS gate opens late, too', async () => {
                await serve(null);
                await show('calibration', 'calibration-load-cells');
                assert.deepEqual((await paneReport(page)).bespokeTags, [], 'shut while UNKNOWN');

                await serve(['scaleCalibration']);
                await page.settle();
                const opened = await paneReport(page);
                assert.ok(opened.bespokeTags.includes('ui-wizard-column'), 'the wizard is on screen');
                /* THE READ, not the render: the store holds a machine state only if
                 * `#load()` ran after the gate opened. */
                const loaded = await page.evalFn(() => {
                    const snapshot = window.__settings.stores().calibration.get();
                    return { step: snapshot?.state?.step ?? null, load: snapshot?.load ?? null };
                });
                assert.ok(loaded.step, `the calibration read was never issued: ${JSON.stringify(loaded)}`);
            });

            test('the five ungated leaves render either way — a gate must not be a blanket', async () => {
                await serve(null);
                for (const [category, leafId] of BESPOKE_PANES.filter(([, id]) => !GATED.includes(id))) {
                    await show(category, leafId);
                    const report = await paneReport(page);
                    assert.ok(report.bespokeTags.length > 0, `${leafId} rendered nothing`);
                }
            });
        });

        /* ═══════════════════════════════════════════════════════════════════
         * 2. THE ONE MEASURE — T1 and T21
         * ═════════════════════════════════════════════════════════════════ */

        describe('eight leaves, one measure (T1, T21)', () => {
            test('every bespoke section takes the ONE measure — the pane\'s, by the pane\'s own formula', async () => {
                await serve(['ledStrip', 'scaleCalibration', 'wakeSchedule']);
                const seen = [];
                for (const [category, leafId] of BESPOKE_PANES) {
                    await show(category, leafId);
                    const report = await paneReport(page);
                    assert.ok(report.bespoke, `${leafId} has no bespoke section`);

                    /* (a) THE SECTION IS THE LEAF BOX. Not narrower, not wider, not inset. */
                    near(report.bespoke.width, report.measure.width, `${leafId} width vs the leaf box`);
                    near(report.bespoke.x, report.measure.x, `${leafId} left edge vs the leaf box`);
                    assert.equal(report.paneScrollsInline, false, `${leafId} makes the pane scroll sideways`);

                    /* (b) AND THE LEAF BOX IS THE PANE'S ONE DECLARATION, evaluated:
                     * `min(100%, var(--ui-measure-wide))`. This is the assertion that
                     * kills T1 and T21, and it is about the FORMULA rather than a pixel
                     * count — the two live measures Slate had (1263 on the wizard, 885 on
                     * the gateway group) were two DECLARATIONS, and a leaf here has
                     * nowhere to put one. */
                    const expected = Math.min(report.paneContent, report.measureWide);
                    near(report.measure.width, expected, `${leafId} vs min(100%, --ui-measure-wide)`, 1.01);
                    seen.push({ leafId, width: Math.round(report.measure.width), expected: Math.round(expected) });
                }

                /* WHAT VARIATION IS ALLOWED, AND IT IS EXACTLY ONE THING. Widths differ
                 * only where the pane's own content width differs, which happens when a
                 * long leaf takes a scrollbar — visible by design (T16). Every leaf still
                 * lands on the same expression, so the number of DECLARATIONS is one. */
                for (const row of seen) {
                    assert.equal(row.width, row.expected, `${row.leafId} left the formula`);
                }
                const distinct = new Set(seen.map((r) => r.width));
                assert.ok(distinct.size <= 2,
                    `more measures than the scrollbar explains: ${JSON.stringify(seen)}`);
            });

            test('the wizard is not one pixel wider than the leaf beside it (T1)', async () => {
                await serve(['scaleCalibration']);
                await show('calibration', 'calibration-load-cells');
                const wizard = await paneReport(page);
                /* THE LEAF BESIDE IT IS THE SKIN LIST NOW. The gateway group stopped
                 * being bespoke on 26 Aug 2026, and this comparison needs two BESPOKE
                 * sections to compare. `display-skin` is the nearest neighbour that still
                 * has one and is not itself gated. */
                await show('display', 'display-skin');
                const other = await paneReport(page);

                /* T1 WAS "63px WIDER", so what is asserted is the FORMULA and then the
                 * one difference the formula allows. Both leaves land on the pane's one
                 * declaration evaluated in their own pane; the only thing that
                 * legitimately moves that between two leaves is the VISIBLE scrollbar a
                 * long leaf takes (T16). A scrollbar makes a leaf NARROWER by exactly its
                 * own width. Any other difference is T1 walking back in.
                 *
                 * WHICH LEAF SCROLLS IS NOT PART OF THE CLAIM, and pinning it cost a
                 * false failure on 26 August 2026. This read "the wizard card's ten-state
                 * height makes the wizard the leaf that scrolls" and asserted the
                 * direction — wizard never wider. Then the bespoke seam gained the 18px
                 * every other gap on the page already had, `display-skin` crossed the
                 * bench's short window, and the two swapped over: the skin list took the
                 * scrollbar and the wizard did not. Nothing about T1 changed, and the
                 * suite reported a width regression.
                 *
                 * SO THE COMPARISON IS SYMMETRIC. Each leaf is its own pane's formula,
                 * and the gap between the two widths equals the gap between the two
                 * panes' content widths — which is zero when neither or both scroll, and
                 * one scrollbar when exactly one does, in whichever direction. */
                near(wizard.bespoke.width, Math.min(wizard.paneContent, wizard.measureWide),
                    'the wizard is the pane\'s formula, evaluated');
                near(other.bespoke.width, Math.min(other.paneContent, other.measureWide),
                    'and so is the leaf beside it');
                near(other.bespoke.width - wizard.bespoke.width, other.paneContent - wizard.paneContent,
                    'the only difference between the two is the scrollbar');
                near(
                    (wizard.bespoke.x + wizard.bespoke.width) - (other.bespoke.x + other.bespoke.width),
                    (wizard.paneContent - other.paneContent),
                    'the RIGHT edge, which is the edge T1 was about, moves only with the scrollbar',
                );
            });

            /* T21's LEAF HAS NO BESPOKE HALF ANY MORE, so the claim moves to the half it
             * does have: four registry rows, in the pane's one measure box, with nothing
             * on the page able to declare 885 or anything else. */
            test('the gateway group takes the measure, not 885 (T21)', async () => {
                await show('extensions', 'extensions-decent-app-settings');
                const report = await paneReport(page);
                assert.equal(report.bespoke, null, 'the leaf is not bespoke any more');
                near(report.primitive.width, report.measure.width, 'the rows are the leaf');
                assert.notEqual(Math.round(report.primitive.width), 885);
            });

            test('the primitive half and the bespoke half share the measure box', async () => {
                await show('display', 'display-skin');
                const report = await paneReport(page);
                near(report.primitive.width, report.bespoke.width, 'the two halves of one leaf');
                assert.ok(report.bespoke.top > report.primitive.top,
                    'the bespoke section sits BELOW the heading and the registry rows');
            });
        });

        /* ═══════════════════════════════════════════════════════════════════
         * 3. D9 — THE WIZARD CARD DOES NOT JUMP
         * ═════════════════════════════════════════════════════════════════ */

        /* THE WALK IS FIVE STEPS SINCE 26 AUGUST 2026 (Ben: "1 Start, 2 Zero, 3 weight on
         * the left cell, 4 weight moved to the right cell, 5 check"), the card is gone
         * ("remove the card and match the settings style"), and there is a Start over
         * button ("restore a way to start over").
         *
         * WHAT SURVIVES FROM THE THREE-STEP SUITE, and it is the part that was earned: the
         * primary button is ONE element whose label and action swap in place, the status
         * slot keeps its space whether it says anything or not, and the section does not
         * jump as the machine moves. The old "same height in EVERY state" pin does not
         * survive intact and should not: two of the five steps deliberately show no weight
         * stepper (a step that asks no question draws no control), so the section is one
         * height while the machine is working and a second while it is not. Both are
         * pinned below, which is a sharper claim than one number was.
         */
        describe('the load-cell walk: five steps, one button, no card', () => {
            /** The section's box, the button's words and the status line, in one trip. */
            const wizardReport = (p) => p.evalFn(() => {
                const bespoke = document.querySelector('settings-screen').shadowRoot.getElementById('bespoke');
                const root = bespoke.shadowRoot;
                const section = root.getElementById('wizard-surface');
                const button = root.getElementById('cal-primary');
                const status = root.getElementById('status');
                const chips = [...root.getElementById('wizard').shadowRoot.querySelectorAll('.steps li')];
                const r = section.getBoundingClientRect();
                const s = status.getBoundingClientRect();
                const stepper = root.getElementById('cal-weight');
                const live = root.getElementById('cal-live');
                return {
                    card: { width: r.width, height: r.height },
                    /* THE ONE-FACT LIVE READING (point 103), which is null on the steps
                     * that do not draw it and a string wherever it does. Whitespace is
                     * collapsed because it is a <dl> and the markup indents. */
                    live: live ? live.textContent.replace(/\s+/g, ' ').trim() : null,
                    surface: section.textContent.replace(/\s+/g, ' ').trim(),
                    status: { height: s.height, text: status.textContent.trim() },
                    button: button.textContent.trim(),
                    buttonCount: root.querySelectorAll('ui-button').length,
                    restart: Boolean(root.getElementById('cal-restart')),
                    stepperCount: root.querySelectorAll('ui-stepper').length,
                    stepperHeight: stepper ? stepper.getBoundingClientRect().height : 0,
                    heading: root.querySelector('#wizard-surface h3').textContent.trim(),
                    current: Number(root.getElementById('wizard').getAttribute('current')),
                    chips: chips.length,
                    cards: root.querySelectorAll('ui-card').length,
                };
            });

            const drive = async (state) => {
                await page.evalFn((s) => window.__settings.calibrationState(s).then(() => true), state);
                await page.settle();
            };

            /* A WALK THAT HAS NOT BEEN STARTED, which needs a leaf change and not merely a
             * re-render.
             *
             * The two booleans the walk holds survive a re-render on purpose — a page that
             * forgot where you were every time a machine frame arrived would be unusable —
             * and they reset when the LEAF changes, because the physical setup (tray off,
             * weight placed) is not something the page can remember for you. So a test
             * that wants step one goes somewhere else and comes back, which is what a user
             * does. */
            const freshWalk = async () => {
                await show('calibration', 'calibration-hardware');
                await show('calibration', 'calibration-load-cells');
            };

            /** Press Start, so the walk is open. Step 1 writes nothing to the machine. */
            const startWalk = async () => {
                await page.evalFn(() => {
                    const root = document.querySelector('settings-screen').shadowRoot
                        .getElementById('bespoke').shadowRoot;
                    root.getElementById('cal-primary').click();
                    return true;
                });
                await page.settle();
            };

            const IDLE = { step: 'idle', status: 'none', secondsRemaining: 0, subState: 'settling', detectedCell: 'none' };

            test('step one writes nothing, and says what is about to happen', async () => {
                await serve(['scaleCalibration']);
                await show('calibration', 'calibration-load-cells');
                await drive(IDLE);
                await freshWalk();

                const intro = await wizardReport(page);
                assert.equal(intro.chips, 5, 'five steps, Ben"s own');
                assert.equal(intro.current, 1, 'and the walk opens on the first');
                assert.match(intro.button, /start/i);
                assert.equal(intro.stepperCount, 0, 'nothing is being weighed yet');
                assert.equal(intro.restart, false, 'there is nothing to start over from');
                assert.equal(intro.cards, 0, 'and no card anywhere on the page');

                await startWalk();
                const server = await page.evalFn(() => window.__settings.server());
                assert.equal(server.calibration.step, 'idle',
                    'Start opens the walk and touches NOTHING on the machine');
                const zero = await wizardReport(page);
                assert.equal(zero.current, 2, 'it moves to the zero');
                assert.match(zero.button, /zero/i);
                assert.equal(zero.restart, true, 'and the escape appears with the walk');
            });

            test('the button swaps LABEL AND ACTION in place as the machine moves', async () => {
                await serve(['scaleCalibration']);
                await show('calibration', 'calibration-load-cells');
                await drive(IDLE);
                await freshWalk();
                await startWalk();

                const labelAt = async (state) => {
                    await drive(state);
                    return (await wizardReport(page)).button;
                };

                const zero = (await wizardReport(page)).button;
                const busy = await labelAt({ ...IDLE, step: 'zeroing', secondsRemaining: 9 });
                const failed = await labelAt({ ...IDLE, step: 'error', status: 'badDelta', subState: 'error', detectedCell: 'b' });

                assert.match(zero, /zero/i);
                assert.match(busy, /stop/i, 'a machine that is working offers a way to stop it');
                assert.match(failed, /try again/i);
                assert.equal(new Set([zero, busy, failed]).size, 3, 'three states, three words');
            });

            test('the section does not jump while the machine works', async () => {
                await serve(['scaleCalibration']);
                await show('calibration', 'calibration-load-cells');
                await drive(IDLE);
                await freshWalk();
                await startWalk();

                /* THE STATES A RUN ACTUALLY PASSES THROUGH, all of which show no stepper —
                 * the zero step and the two the machine drives. What is pinned is that the
                 * section keeps ONE height across them, which is what the status slot's
                 * floor and the body copy's floor are for. */
                const seen = [];
                for (const state of [
                    IDLE,
                    { ...IDLE, step: 'zeroing', secondsRemaining: 15 },
                    { ...IDLE, step: 'zeroing', secondsRemaining: 3, subState: 'averaging' },
                ]) {
                    await drive(state);
                    seen.push({ label: `${state.step}/${state.secondsRemaining}`, ...(await wizardReport(page)) });
                }
                const heights = new Set(seen.map((row) => Math.round(row.card.height)));
                assert.equal(heights.size, 1,
                    `the section moved: ${JSON.stringify(seen.map((row) => [row.label, Math.round(row.card.height)]))}`);
                for (const row of seen) {
                    assert.ok(row.button.length > 0, 'the button always says something');
                    assert.ok(row.status.height > 0, 'the status slot is always there, full or empty');
                }
            });

            test('the weight is asked for on the three steps that weigh, and on no other', async () => {
                await serve(['scaleCalibration']);
                await show('calibration', 'calibration-load-cells');
                await drive(IDLE);
                await freshWalk();
                await startWalk();
                assert.equal((await wizardReport(page)).stepperCount, 0, 'the zero asks for no weight');

                /* A ZEROING RUN THAT FINISHES is the machine's own path to the first latch.
                 *
                 * THIS DROVE `zeroing` THEN `idle` UNTIL 27 AUGUST 2026, AND `idle` IS THE
                 * ABORT. The leaf agreed, so the pair passed and pinned an assumption the
                 * source itself flagged as unread. The firmware settles it: a zero that
                 * finishes is written `step = Complete` by `updateScaleCalProcedure`
                 * (`System.cpp:2455`), the only writer of Idle is the abort command
                 * (`:2350`), and a zero is not a cal point so its `calStatus` stays 0xFF
                 * throughout (`:2434`) — which ReaPrime decodes as `none`. So the success
                 * edge is complete-with-no-status, and that is what is driven here. */
                await drive({ ...IDLE, step: 'zeroing', secondsRemaining: 5 });
                await drive({ ...IDLE, step: 'complete', subState: 'done', secondsRemaining: 0 });
                const left = await wizardReport(page);
                assert.equal(left.current, 3);
                assert.match(left.heading, /left/i);
                assert.equal(left.stepperCount, 1, 'and now it asks');
                assert.ok(left.stepperHeight > 0, 'laid out, not merely present');

                /* ONE CELL LATCHED IS THE MACHINE'S OWN WORD FOR IT. */
                await drive({ ...IDLE, status: 'incomplete', detectedCell: 'a' });
                const right = await wizardReport(page);
                assert.equal(right.current, 4);
                assert.match(right.heading, /right/i);
                assert.equal(right.stepperCount, 1);

                await drive({ ...IDLE, status: 'ok', detectedCell: 'b' });
                const check = await wizardReport(page);
                assert.equal(check.current, 5);
                assert.match(check.button, /finish/i);
                assert.equal(check.stepperCount, 1, 'the check still shows what was entered');
            });

            /* THE OTHER HALF OF THE SAME FIX, AND THE ONE THAT SAYS WHY IT WAS A BUG.
             *
             * `#calStage` used to read `status === 'ok' || step === COMPLETE` as "show the
             * Check". Because a successful ZERO also lands on `complete`, that test fired
             * the instant the zero finished: the wizard jumped from step 2 to step 5, and
             * the only button on step 5 is Finish. The weight calibration — the whole
             * point of the page — could not be reached through the UI at all.
             *
             * DRIVEN WITHOUT A PRECEDING ZEROING RUN, so `_calZeroed` is false and nothing
             * but the old bug could put this state on the Check. A walk that has started
             * and has not been told the cells are zeroed belongs on the zero. */
            test('a bare complete does not jump the walk to the Check', async () => {
                await serve(['scaleCalibration']);
                await show('calibration', 'calibration-load-cells');
                await drive(IDLE);
                await freshWalk();
                await startWalk();

                await drive({ ...IDLE, step: 'complete', subState: 'done', secondsRemaining: 0 });
                const after = await wizardReport(page);
                assert.notEqual(after.current, 5,
                    'complete with no status is a finished ZERO, not a finished calibration');
                assert.equal(after.current, 2, 'and with no zero seen, the walk is still on the zero');
                assert.doesNotMatch(after.button, /finish/i,
                    'a walk that has weighed nothing is not offered a way to finish');
            });

            test('the countdown and the nine-value diagnosis reach the status slot', async () => {
                await serve(['scaleCalibration']);
                await show('calibration', 'calibration-load-cells');
                await drive({
                    step: 'zeroing', subState: 'averaging', secondsRemaining: 7, status: 'none', detectedCell: 'none',
                });
                const counting = await wizardReport(page);
                assert.match(counting.status.text, /7/, 'the countdown is on screen, not only in the store');

                await drive({
                    step: 'error', subState: 'error', secondsRemaining: 0, status: 'badDelta', detectedCell: 'b',
                });
                const diagnosed = await wizardReport(page);
                /* THE POINT OF THE REBUILD: the old skin showed a generic HTTP error here.
                 *
                 * AND THE SENTENCE ITSELF WAS WRONG UNTIL 27 AUGUST 2026. It read "The two
                 * load cells disagree. Check the weight is centred", which was written off
                 * the enum's NAME. `badDelta` is "non-positive or implausible per-cell
                 * delta" (`CLoadCellCal.hpp:64`) — one cell not seeing the weight — and
                 * centring the mass is the instruction that produces `notIsolated`, the
                 * opposite failure. This asserts the remedy the machine actually wants:
                 * the weight on one cell, not bridging both. */
                assert.match(diagnosed.status.text, /did not see the weight/i,
                    'badDelta is a sentence, not a status code');
                assert.doesNotMatch(diagnosed.status.text, /centred/i,
                    'and it is not the instruction that causes notIsolated');
                assert.match(diagnosed.status.text, /Cell B/, 'and the auto-detected cell rides with it');
            });

            /* `incomplete` IS A SUCCESS AND USED TO READ AS A FAILURE.
             *
             * `CLoadCellCal.hpp:57-58` says it in as many words: "Incomplete means this
             * point latched fine and we're waiting for the other one." It is what the
             * machine reports after the FIRST of the two latches, which is to say every
             * time a user does this correctly. The status slot said "The calibration did
             * not finish" while the step above it said to move the weight — the page
             * arguing with itself at the one moment the user needs to trust it.
             *
             * ASSERTED ON THE RENDERED SLOT, not on the table: what matters is the words a
             * person reads, and A8's whole argument is that a test asserting about a FILE
             * defends the file on the day the box disagrees with it. */
            test('one cell latched reads as progress, not as a failure', async () => {
                await serve(['scaleCalibration']);
                await show('calibration', 'calibration-load-cells');
                await drive(IDLE);
                await freshWalk();
                await startWalk();
                await drive({
                    step: 'complete', subState: 'done', secondsRemaining: 0,
                    status: 'incomplete', detectedCell: 'a',
                });
                const latched = await wizardReport(page);
                assert.doesNotMatch(latched.status.text, /did not finish|fail/i,
                    'the machine said one cell is done, which is not a failure');
                assert.match(latched.status.text, /move the weight/i,
                    'and the sentence names the next thing to do');
                assert.equal(latched.current, 4, 'the walk is on the second cell');
            });

            test('pressing Zero sends ONE command, and it is the machine\'s vocabulary', async () => {
                await serve(['scaleCalibration']);
                await show('calibration', 'calibration-load-cells');
                await drive(IDLE);
                await freshWalk();
                await startWalk();

                await page.evalFn(() => window.__settings.pressWizard());
                await page.settle();
                const server = await page.evalFn(() => window.__settings.server());
                assert.equal(server.calibration.step, 'zeroing', 'the machine was asked to zero');
            });

            /* WHAT THE SCALE READS, ON THE STEP THAT ASKS YOU TO EMPTY IT (point 103).
             *
             * THE AUDIT'S ARGUMENT WAS ABOUT THE ZERO and the half-fix was on the check:
             * the reading was subscribed, held and drawn only by `#calCheck`, which renders
             * on stage 5 alone. The zero step asks the user to take the cup platform and
             * the drip tray off and then gave them no way to confirm they had — before
             * spending fifteen seconds averaging whatever is actually on the cells.
             *
             * AND THE HEIGHT CLAIM IS THE OTHER HALF. The row is drawn whether or not a
             * frame has arrived — the absence is the dash, never a zero — so the section
             * is exactly as tall either way and the button cannot move under a finger when
             * the first frame lands. That is asserted here rather than assumed, because
             * "the card must not move" is the rule this rebuild was once rejected for
             * breaking. */
            const scale = async (grams, options) => {
                await page.evalFn(
                    (g, o) => window.__settings.scaleWeight(g, o ?? undefined).then(() => true),
                    grams,
                    options ?? null,
                );
                await page.settle();
            };

            test('the zero step shows what the scale reads, and its absence does not move the box', async () => {
                await serve(['scaleCalibration']);
                await show('calibration', 'calibration-load-cells');
                await drive(IDLE);
                await freshWalk();
                await startWalk();

                await scale(null);
                const silent = await wizardReport(page);
                assert.equal(silent.current, 2, 'the walk is on the zero');
                assert.ok(silent.live, 'the reading is drawn on the zero step, not only on the check');
                assert.match(silent.live, /what the scale reads/i);
                assert.match(silent.live, /\u2013/, 'a scale that has said nothing shows the absence dash (A7)');
                assert.doesNotMatch(silent.live, /0(\.0)? g/, 'and never a zero nobody weighed');

                await scale(0.4);
                const reading = await wizardReport(page);
                assert.match(reading.surface, /0\.4 g/, 'the live gram figure is on the wizard surface');
                assert.equal(Math.round(reading.card.height), Math.round(silent.card.height),
                    'the section is the same height with a frame and without one');

                /* THE THIRD STATE, AND IT MUST LOOK LIKE THE FIRST. A held weight whose
                 * source has gone is not a reading — `feed-store.js`'s own STALE — and off
                 * the raw frame the leaf used to go on printing it for ever. Under this
                 * particular sentence a frozen 0.4 g would tell the user the cells are
                 * clear when nobody is still measuring them. */
                await scale(0.4, { stale: true });
                const gone = await wizardReport(page);
                assert.match(gone.live, /\u2013/, 'a stale weight reads as an absence, not as a number');
                assert.doesNotMatch(gone.live, /0\.4/, 'the last frame is not held on screen');

                /* AND THE TWO WEIGHT STEPS GET IT TOO — the isolated-cell procedure turns
                 * on the mass sitting on ONE cell, so a number that moves when the weight
                 * lands is how a user knows it landed. */
                await scale(201.3);
                await drive({ ...IDLE, step: 'zeroing', secondsRemaining: 5 });
                await drive({ ...IDLE, step: 'complete', subState: 'done', secondsRemaining: 0 });
                const left = await wizardReport(page);
                assert.equal(left.current, 3, 'the first weight step');
                assert.match(left.surface, /201\.3 g/, 'and it says what the cell is carrying');

                await scale(null);
            });
        });

        /* ═══════════════════════════════════════════════════════════════════
         * 4. D7 — THE LED DRILL, AGAINST A SLOW MOCK
         * ═════════════════════════════════════════════════════════════════ */

        describe('the LED preview: one write in flight, latest-wins, no timer', () => {
            test('N rapid swatch presses leave exactly one write on the wire, last colour wins', async () => {
                await serve(['ledStrip']);
                await show('accessories', 'accessories-lighting');

                const drill = await page.evalFn(async () => {
                    const api = window.__settings;
                    api.holdLed();
                    const before = api.ledCounters();

                    /* SEVEN PRESSES, THROUGH THE COMPONENT — a swatch click, not a store
                     * call, so what is exercised is the whole path a finger takes. */
                    const peak = [];
                    for (let i = 1; i <= 7; i += 1) {
                        await api.pickSwatch(i);
                        peak.push(api.ledParked());
                    }
                    const midFlight = api.ledCounters();

                    /* Let them answer, one round at a time, until the chain drains. */
                    let rounds = 0;
                    while (api.ledParked() > 0 && rounds < 10) {
                        api.releaseLed();
                        await new Promise((r) => setTimeout(r, 0));
                        rounds += 1;
                    }
                    await api.stores().led.settled();

                    const out = {
                        before, midFlight, after: api.ledCounters(), peak,
                        parkedNow: api.ledParked(),
                        server: api.server(),
                        shown: api.stores().led.hex('frontStrip', 'awake'),
                    };
                    /* PUT THE MOCK BACK. `holdLed()` above sets a flag with no expiry,
                     * and every later test in this page shares the server. */
                    api.freeLed();
                    return out;
                });

                assert.deepEqual([...new Set(drill.peak)], [1],
                    `never more than one write on the wire: saw ${JSON.stringify(drill.peak)}`);
                assert.equal(drill.midFlight.intents, 7, 'seven presses, seven intents');
                assert.equal(drill.midFlight.sent, 1, 'one of them on the wire');
                assert.equal(drill.after.peakInFlight, 1);
                assert.ok(drill.after.sent < drill.after.intents,
                    'the intermediate colours were DROPPED, not queued');

                /* LATEST-WINS, AT THE MACHINE. The last preset pressed is the colour the
                 * fake server is left holding and the colour the row shows. */
                const expected = drill.server.ledLast.frontStrip.awake;
                assert.equal(drill.shown.toLowerCase(),
                    `#${expected.slice(0, 2)}${expected.slice(4, 6)}${expected.slice(8, 10)}`.toLowerCase());
            });

            test('the whole path — component, store, colour maths — contains no timer', async () => {
                const sources = await page.evalFn(async () => {
                    const paths = [
                        '/src/stores/led-strip-store.js',
                        '/src/lib/led-colour.js',
                        '/src/screens/settings-bespoke-leaf.js',
                        '/src/components/ui-colour-swatch-row.js',
                    ];
                    const out = {};
                    for (const path of paths) out[path] = await (await fetch(path)).text();
                    return out;
                });
                /* GREPPED IN THE BROWSER, over the files actually served — a source read
                 * from disk in node proves the repo, this proves what the page ran. */
                for (const [path, text] of Object.entries(sources)) {
                    const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
                    for (const spelling of [/setTimeout/, /setInterval/, /\bdebounce\b/i, /\bthrottle\b/i]) {
                        assert.doesNotMatch(code, spelling, `${path} schedules the LED write (${spelling})`);
                    }
                }
            });

            /* ───────────────────────────────────────────────────────────────
             * cmp-ss-1 — THE POWER SWITCH, WITH SLATE'S SEMANTICS
             *
             * The leaf shipped with no power control of any kind and no declaration
             * of the drop. prov_diff missingElements settings-accessories-lighting,
             * both themes: [i=69] span "Power", [i=70] label.slate-switch. Slate's
             * behaviour is settings.js:4344-4356 — off remembers and blacks out, on
             * restores, and the switch's own state is read off the colour.
             * ─────────────────────────────────────────────────────────────── */

            test('OFF blacks every zone of the bank and ON restores what each one was', async () => {
                await serve(['ledStrip']);
                await show('accessories', 'accessories-lighting');

                const run = await page.evalFn(async () => {
                    const api = window.__settings;
                    api.freeLed();
                    const led = api.stores().led;
                    const bespoke = api.bespokeEl();
                    const zones = ['frontStrip', 'backStrip', 'frontSwitch'];
                    const readAll = () => Object.fromEntries(zones.map((z) => [z, led.hex(z, 'awake')]));

                    /* A KNOWN LIT STATE FIRST, through the component, so the memory is
                     * filled by the same path a finger fills it by. */
                    await api.pickSwatch(1);
                    await led.settled();
                    const lit = readAll();

                    const press = async (checked) => {
                        const el = bespoke.shadowRoot.getElementById('led-power');
                        el.dispatchEvent(new CustomEvent('change', {
                            detail: { checked }, bubbles: true, composed: true,
                        }));
                        await led.settled();
                        await bespoke.updateComplete;
                    };

                    const wasOn = led.isOn('awake');
                    const beforeCounters = led.counters();
                    await press(false);
                    const off = { strip: readAll(), isOn: led.isOn('awake'), counters: led.counters() };
                    await press(true);
                    const on = { strip: readAll(), isOn: led.isOn('awake') };

                    return { lit, wasOn, off, on, beforeCounters, server: api.server().ledLast };
                });

                assert.equal(run.wasOn, true, 'the bank starts lit, so there is something to switch off');

                /* OFF: every zone black, and the switch reads off. */
                for (const [zone, hex] of Object.entries(run.off.strip)) {
                    assert.equal(hex, '#000000', `${zone} is still lit after the power switch went off`);
                }
                assert.equal(run.off.isOn, false, 'a bank with nothing lit is off, derived from the colour');

                /* ONE INTENT, NOT THREE. Three zones changed and exactly one more PUT
                 * went out — the whole reason power is a strip intent rather than three
                 * preview() calls into one latest-wins slot. */
                assert.equal(run.off.counters.sent - run.beforeCounters.sent, 1,
                    'three zones went dark in one write, or the latest-wins slot dropped two of them');
                assert.equal(run.off.counters.peakInFlight, 1);

                /* ON: exactly what was there before, not a default. */
                assert.deepEqual(run.on.strip, run.lit,
                    'powering back on must restore the remembered colours, not a warm white');
                assert.equal(run.on.isOn, true);
            });

            test('a bank that was never lit comes on at the warm-white default', async () => {
                await serve(['ledStrip']);
                await show('accessories', 'accessories-lighting');
                const run = await page.evalFn(async () => {
                    const api = window.__settings;
                    api.freeLed();
                    const led = api.stores().led;
                    const bespoke = api.bespokeEl();
                    const press = async (checked) => {
                        bespoke.shadowRoot.getElementById('led-power').dispatchEvent(new CustomEvent('change', {
                            detail: { checked }, bubbles: true, composed: true,
                        }));
                        await led.settled();
                        await bespoke.updateComplete;
                    };
                    /* Black it out FIRST and forget, so nothing is remembered — the
                     * cold-start case, which is the only one the default answers. */
                    await press(false);
                    led.forget();
                    await led.load();
                    await press(false);
                    await press(true);
                    return {
                        strip: ['frontStrip', 'backStrip', 'frontSwitch']
                            .map((zone) => led.hex(zone, 'awake')),
                        isOn: led.isOn('awake'),
                    };
                });
                /* LED_DEFAULT_ON = 'FFFFAAAA5555' (settings.js:3827) -> #FFAA55. */
                assert.deepEqual(run.strip.map((hex) => hex.toLowerCase()),
                    ['#ffaa55', '#ffaa55', '#ffaa55']);
                assert.equal(run.isOn, true);
            });

            test('the switch reads the colour, not a stored flag — a hand-picked black reads off', async () => {
                await serve(['ledStrip']);
                await show('accessories', 'accessories-lighting');
                const state = await page.evalFn(async () => {
                    const api = window.__settings;
                    api.freeLed();
                    const led = api.stores().led;
                    const bespoke = api.bespokeEl();
                    for (const zone of ['frontStrip', 'backStrip', 'frontSwitch']) {
                        await led.preview(zone, 'awake', '#000000');
                        await led.settled();
                    }
                    await bespoke.updateComplete;
                    const el = bespoke.shadowRoot.getElementById('led-power');
                    return { checked: el.checked, isOn: led.isOn('awake') };
                });
                assert.equal(state.isOn, false);
                assert.equal(state.checked, false,
                    'the switch is derived from the strip, so black by hand is Off with no second state');
            });

            /* ───────────────────────────────────────────────────────────────
             * cmp-ss-2 — THE CHIP TAP SHORTCUT
             *
             * Slate's current-colour cells are BUTTONS calling
             * ledSelectCell(zone, state) (settings.js:3893/4319); the rebuild made
             * them spans and the shortcut went with them, undeclared. The new copy
             * around them stands (Ben: not objected to) — this is about the tap.
             * ─────────────────────────────────────────────────────────────── */

            /* ───────────────────────────────────────────────────────────────
             * TWO SAVE AFFORDANCES ON ONE SCREEN, and the big one did nothing.
             *
             * This leaf carries NO registry rows, so the screen's change count was always
             * zero on it — and `#onCommit` branches on `dirty`, so the header's primary Save
             * took the not-dirty path and simply CLOSED the page. Meanwhile every wheel drag
             * and every preset press had already gone out as a live PUT, which the store's
             * own contract note says "PUSHES LIVE AND DOES NOT PERSIST": only the commit
             * route writes NVM. So a person picked colours, pressed the big Save at the top
             * right, walked away, and lost them at the next power cycle — while the button
             * that would have kept them sat further down the page saying "Keep these
             * colours".
             *
             * ONE COMMIT GESTURE PER SCREEN is the model this screen already states. An
             * uncommitted preview is a pending change: the header counts it, Save commits
             * it, Cancel resets it — reset being "reload NVM", which is what Cancel means
             * everywhere else. The leaf's own two buttons are gone with the duplication.
             * ─────────────────────────────────────────────────────────────── */

            test('an uncommitted preview is counted, saved by Save and discarded by Cancel', async () => {
                await serve(['ledStrip']);
                await show('accessories', 'accessories-lighting');
                /* THIS SUITE SHARES ONE PAGE and the cases above this one drive the picker,
                 * so the strip arrives here already showing something NVM does not hold —
                 * which is the state under test, not the starting point for it. `reset()`
                 * reloads NVM, which is exactly how a person would clear it. */
                await page.evalFn(() => window.__settings.stores().led.reset().then(() => true));
                await page.settle();

                const clean = await page.evalFn(() => {
                    const screen = document.querySelector('settings-screen');
                    return {
                        dirty: window.__settings.stores().led.get().dirty,
                        count: Number(screen.shadowRoot.getElementById('band').getAttribute('change-count')),
                        buttons: [
                            Boolean(window.__settings.bespokeEl().shadowRoot.getElementById('led-commit')),
                            Boolean(window.__settings.bespokeEl().shadowRoot.getElementById('led-reset')),
                        ],
                    };
                });
                assert.equal(clean.dirty, false, 'a freshly-read strip matches NVM');
                assert.equal(clean.count, 0, 'and there is nothing to save');
                assert.deepEqual(clean.buttons, [false, false],
                    'the leaf no longer carries a second Save and a second Cancel');

                const previewed = await page.evalFn(async () => {
                    const led = window.__settings.stores().led;
                    await led.preview('frontStrip', 'awake', '#112233');
                    await led.settled();
                    const screen = document.querySelector('settings-screen');
                    await screen.updateComplete;
                    return {
                        dirty: led.get().dirty,
                        count: Number(screen.shadowRoot.getElementById('band').getAttribute('change-count')),
                        commits: window.__settings.server().ledCommits,
                    };
                });
                assert.equal(previewed.dirty, true, 'a PUT lights the machine and persists nothing');
                assert.equal(previewed.count, 1, 'so the header says there is one thing to save');
                assert.equal(previewed.commits, 0, 'and nothing has reached NVM yet');

                const saved = await page.evalFn(async () => {
                    const screen = document.querySelector('settings-screen');
                    const seen = [];
                    const listener = (event) => seen.push(event.detail?.route ?? null);
                    document.addEventListener('navigate', listener);
                    screen.shadowRoot.getElementById('band').shadowRoot.getElementById('save').click();
                    await new Promise((r) => setTimeout(r, 30));
                    document.removeEventListener('navigate', listener);
                    return {
                        commits: window.__settings.server().ledCommits,
                        dirty: window.__settings.stores().led.get().dirty,
                        left: seen,
                    };
                });
                assert.equal(saved.commits, 1, 'Save writes NVM — this is the whole finding');
                assert.equal(saved.dirty, false, 'and there is nothing left to save');
                assert.deepEqual(saved.left, ['live'], 'then it leaves, as Save does everywhere');

                await show('accessories', 'accessories-lighting');
                const cancelled = await page.evalFn(async () => {
                    const led = window.__settings.stores().led;
                    await led.preview('frontStrip', 'awake', '#445566');
                    await led.settled();
                    const screen = document.querySelector('settings-screen');
                    await screen.updateComplete;
                    const before = window.__settings.server().ledResets;
                    screen.shadowRoot.getElementById('band').shadowRoot.getElementById('cancel').click();
                    await new Promise((r) => setTimeout(r, 30));
                    return {
                        resets: window.__settings.server().ledResets - before,
                        dirty: led.get().dirty,
                    };
                });
                assert.equal(cancelled.resets, 1,
                    'Cancel reloads NVM, which is what discarding a preview IS on this route');
                assert.equal(cancelled.dirty, false);

                await show('accessories', 'accessories-lighting');
                const nothingToSave = await page.evalFn(async () => {
                    const screen = document.querySelector('settings-screen');
                    const before = window.__settings.server().ledCommits;
                    screen.shadowRoot.getElementById('band').shadowRoot.getElementById('save').click();
                    await new Promise((r) => setTimeout(r, 30));
                    return window.__settings.server().ledCommits - before;
                });
                assert.equal(nothingToSave, 0,
                    'a clean page still just closes — Save must not post a commit nobody asked for');
                await show('accessories', 'accessories-lighting');
            });

            test('the grid reports the two colours the machine holds, and Both is not one', async () => {
                /* THE THIRD ROW COULD NEVER DISAGREE WITH THE FIRST. The grid mapped over
                 * all three `LED_ZONE_ITEMS` and filled the Both row from
                 * `store.hex(ledLeadZone('both'))` — which is `zones[0]`, which is
                 * `frontStrip` — so "Both" was the Front row's colour BY CONSTRUCTION. A
                 * readout asserting a value the machine does not hold is a fabricated value,
                 * which A7 forbids more strictly than Slate does; Slate draws two zone rows
                 * (`settings.js:3893`) because there are two stored colours to report.
                 *
                 * THE AFFORDANCE IS NOT LOST: the Zone bank above still offers Both as a
                 * WRITE target, and the State bank selects the column, so "both / asleep" is
                 * still one press on each of two controls. Two lists, two questions — what
                 * may be written, and what is held. */
                await serve(['ledStrip']);
                await show('accessories', 'accessories-lighting');
                const grid = await page.evalFn(() => {
                    const root = window.__settings.bespokeEl().shadowRoot;
                    return {
                        zones: [...root.querySelectorAll('#current .chip')].map((el) => el.dataset.zone),
                        labels: [...root.querySelectorAll('#current .ui-caption')].map((el) => el.textContent.trim()),
                        offered: [...root.getElementById('led-zone').shadowRoot.querySelectorAll('button')]
                            .map((el) => el.textContent.trim()),
                    };
                });
                assert.equal(grid.zones.length, 4, 'four chips: two zones across two states');
                assert.deepEqual([...new Set(grid.zones)], ['front', 'rear']);
                assert.deepEqual(grid.labels, ['Front', 'Rear']);
                assert.deepEqual(grid.offered, ['Front', 'Rear', 'Both'],
                    'and Both is still offered as a write target, which is what it is');
            });

            test('the wheel is asked for Slate’s rendered diameter, in design units', async () => {
                /* BOTH SKINS CONFIGURE iro AT 300; the 1.5x the audit measured is the SCALE
                 * COMPENSATION. Slate counter-scales its picker so it paints at 300 SCREEN
                 * pixels whatever the geometry, while this skin's host counter-zooms so the
                 * wheel paints at the size a design-unit sibling does — about 200 physical
                 * pixels at the bench tablet's S of 0.667. The architecture is right and does
                 * not move; the ASKED-FOR SIZE does, because the reason for tolerating a
                 * small target expired when Ben moved the presets into the left column on
                 * 26 August and left room in the right one. */
                await serve(['ledStrip']);
                await show('accessories', 'accessories-lighting');
                const seen = await page.evalFn(() => {
                    const root = window.__settings.bespokeEl().shadowRoot;
                    const wheel = root.getElementById('led-wheel');
                    const column = wheel.closest('.column');
                    return {
                        size: wheel.size,
                        width: Math.round(wheel.getBoundingClientRect().width),
                        columnWidth: Math.round(column.getBoundingClientRect().width),
                        overflow: column.scrollWidth - column.clientWidth,
                    };
                });
                assert.equal(seen.size, 440, "Slate's rendered diameter, expressed in design units");
                assert.ok(seen.width > 300,
                    `the wheel still paints at the size it asks for: ${seen.width}`);
                assert.ok(seen.overflow <= 1,
                    `the right column must not overflow: ${seen.overflow}px past its box`);
            });

            test('a chip is a button, and pressing one moves BOTH banks to that cell', async () => {
                await serve(['ledStrip']);
                await show('accessories', 'accessories-lighting');

                const before = await page.evalFn(() => {
                    const root = window.__settings.bespokeEl().shadowRoot;
                    return {
                        zone: root.getElementById('led-zone').value,
                        bank: root.getElementById('led-bank').value,
                        tags: [...root.querySelectorAll('#current .chip')].map((el) => el.localName),
                        names: [...root.querySelectorAll('#current .chip')].map((el) => el.getAttribute('aria-label')),
                    };
                });
                assert.deepEqual([...new Set(before.tags)], ['button'],
                    'the current-colour chips must be pressable');
                assert.ok(before.names.every(Boolean),
                    `a chip with no text needs a name: ${JSON.stringify(before.names)}`);

                /* A CELL THAT IS NOT THE CURRENT ONE, so the press has somewhere to go. */
                const target = await page.evalFn((state) => {
                    const root = window.__settings.bespokeEl().shadowRoot;
                    const chip = [...root.querySelectorAll('#current .chip')].find((el) => (
                        el.dataset.zone !== state.zone || el.dataset.bank !== state.bank
                    ));
                    return { zone: chip.dataset.zone, bank: chip.dataset.bank };
                }, before);

                /* SCROLL IT UNDER THE FINGER FIRST. The pane scrolls, page.click is a real
                 * hit test, and a hit test outside the viewport reaches nothing — or the
                 * wrong chip, which is what "the State bank did not follow" looked like.
                 * The bespoke leaves grew about 45px on 26 August 2026, when every page
                 * gained a rule and a description (O5, O6), and that put the colour grid
                 * below the fold at the floor geometry. */
                await page.evalFn((t) => {
                    window.__settings.bespokeEl().shadowRoot
                        .querySelector(`#current .chip[data-zone="${t.zone}"][data-bank="${t.bank}"]`)
                        ?.scrollIntoView({ block: 'center' });
                }, target);
                await page.settle();
                await page.click(`settings-screen >>> #bespoke >>> #current .chip[data-zone="${target.zone}"][data-bank="${target.bank}"]`);
                await page.settle();

                const after = await page.evalFn(() => {
                    const root = window.__settings.bespokeEl().shadowRoot;
                    const chips = [...root.querySelectorAll('#current .chip')];
                    /* ARIA-PRESSED IS THE ONLY SPELLING (parity surface 3). It used to
                     * be read off a second `data-current` attribute that said the same
                     * thing, and the pair could drift; the ring is now driven off the
                     * aria state, so this reads what the paint reads. */
                    const current = chips.filter((el) => el.getAttribute('aria-pressed') === 'true');
                    const style = current.length ? getComputedStyle(current[0]) : null;
                    const other = chips.find((el) => el.getAttribute('aria-pressed') !== 'true');
                    return {
                        zone: root.getElementById('led-zone').value,
                        bank: root.getElementById('led-bank').value,
                        marked: current.map((el) => `${el.dataset.zone}:${el.dataset.bank}`),
                        stillData: chips.some((el) => el.hasAttribute('data-current')),
                        currentFill: style?.backgroundColor ?? null,
                        currentBorder: style?.borderTopWidth ?? null,
                        restingBorder: other ? getComputedStyle(other).borderTopWidth : null,
                        /* READ OFF THE CHIP, NOT RE-DERIVED FROM THE STORE. This asked
                         * `led.hex(el.dataset.zone, …)` — and since 24 Aug 2026 a chip's
                         * `data-zone` is a GROUP the UI names (`front` / `rear` / `both`,
                         * Ben's "make the 3 option 'Both'"), not a wire zone the store
                         * speaks, so the store answered null and the assertion below threw
                         * on it. The leaf's own inline fill is what the assertion is
                         * actually about — "the current cell must still be the machine's
                         * colour" — and reading it needs no second translation. */
                        wantFill: current.length
                            ? current[0].style.getPropertyValue('--_ui-chip-fill').trim()
                            : null,
                    };
                });
                assert.equal(after.zone, target.zone, 'the Zone bank did not follow the chip');
                assert.equal(after.bank, target.bank, 'the State bank did not follow the chip');
                /* ONE current chip, and it says so in aria as well as in paint. */
                assert.deepEqual(after.marked, [`${target.zone}:${target.bank}`]);
                assert.equal(after.stillData, false,
                    'data-current is a second spelling of aria-pressed — one state, one attribute');

                /* THE COLLISION selectionSurface WOULD OTHERWISE CAUSE, pinned.
                 * The fragment paints `background-color: var(--ui-selected-face)` on
                 * anything with aria-pressed="true", and this cell IS the colour the
                 * machine is wearing. Remove `.chip[aria-pressed="true"]`'s own
                 * background-color line and this assertion goes red with the face. */
                const hex = after.wantFill.replace('#', '');
                const want = `rgb(${parseInt(hex.slice(0, 2), 16)}, ${parseInt(hex.slice(2, 4), 16)}, `
                    + `${parseInt(hex.slice(4, 6), 16)})`;
                assert.equal(after.currentFill, want,
                    'the current cell must still be the machine\'s colour, not the selected face');

                /* And the ring that Slate\'s own !important block flattens away
                 * (settings-accessories-lighting [i=52], border-top-width 1px on all
                 * four cells) is drawn here: strong on the current cell, plain on the
                 * others. */
                assert.notEqual(after.currentBorder, after.restingBorder,
                    'the current cell is not marked at all');
            });

            test('the zone and state banks pick which palette entry is edited', async () => {
                await serve(['ledStrip']);
                await show('accessories', 'accessories-lighting');
                const moved = await page.evalFn(async () => {
                    const bespoke = window.__settings.bespokeEl();
                    const bank = bespoke.shadowRoot.getElementById('led-bank');
                    /* PRESS THE BANK IT IS NOT ON, read off the control rather than
                     * assumed. Every subtest in this describe shares ONE page, and the
                     * chip-press test above leaves `_ledBank` wherever it left it — so a
                     * hard-coded 'sleeping' was a no-op whenever that ran first, and this
                     * assertion measured nothing at all while reporting a pass. */
                    const now = bank.getAttribute('value');
                    const other = now === 'sleeping' ? 'awake' : 'sleeping';
                    const before = bespoke.shadowRoot.getElementById('led-presets').getAttribute('value');
                    bank.dispatchEvent(new CustomEvent('change', {
                        detail: { value: other }, bubbles: true, composed: true,
                    }));
                    await bespoke.updateComplete;
                    return {
                        now, other, before,
                        after: bespoke.shadowRoot.getElementById('led-presets').getAttribute('value'),
                    };
                });
                assert.notEqual(moved.now, moved.other, 'the two banks hold different colours');
                assert.notEqual(moved.before, moved.after,
                    'the swatch row follows the bank, so a press edits the entry the user chose');
            });
        });

        /* ═══════════════════════════════════════════════════════════════════
         * cmp-ss-4 — THE VERSION KEEPS ITS v
         *
         * prov_diff settings-display-skin: [i=56] "v0.3.5" against Decal's "0.3.5"
         * and [i=61] "v0.4.0" against "0.4.0" — Beanie and NSX are in BOTH corpora at
         * the same served versions, so the prefix is composition and not fixture.
         * ═════════════════════════════════════════════════════════════════ */

        describe('cmp-ss-4: skin versions print their v', () => {
            test('the cards and the update list use the one formatter', async () => {
                await show('display', 'display-skin');
                const cards = await page.evalFn(() => {
                    const root = window.__settings.bespokeEl().shadowRoot;
                    return [...root.querySelectorAll('.skin-card')].map((card) => ({
                        skin: card.dataset.skin,
                        version: card.querySelector('.ui-numeric')?.textContent.trim() ?? null,
                    }));
                });
                assert.ok(cards.length >= 2, `no skin cards to read: ${JSON.stringify(cards)}`);
                for (const card of cards) {
                    assert.match(card.version, /^v\d/, `${card.skin} prints ${card.version}`);
                }
                /* THE FIXTURE SERVES BARE NUMBERS — Beanie 0.3.5, NSX 0.4.0, the same
                 * values Slate's corpus carries — so a v on screen is this skin adding
                 * it, which is the whole claim. */
                const beanie = cards.find((card) => card.skin === 'beanie');
                assert.equal(beanie?.version, 'v0.3.5');

                /* THE SCAN IS THE UPDATE LIST'S, NOT THE WHOLE PANE'S (27 August 2026).
                 * It used to walk every `.ui-numeric` in the leaf, which was the same set
                 * while the page held nothing but skin rows. The page now also carries the
                 * Decaid block, whose Version, Build and Commit are numeric-role values of
                 * a completely different kind — an app version, an app build string and a
                 * commit hash, none of which this skin prefixes and none of which this
                 * claim is about. Narrowing the scan keeps the claim the one it was
                 * written for: SKIN versions print their v. */
                await show('updates', 'updates-skin-app');
                const rows = await page.evalFn(() => {
                    const root = window.__settings.bespokeEl().shadowRoot;
                    return [...root.querySelectorAll('#update-list .ui-numeric')].map((el) => el.textContent.trim());
                });
                const versions = rows.filter((text) => /\d/.test(text) && !text.includes('/'));
                assert.ok(versions.length > 0, `no versions in the update list: ${JSON.stringify(rows)}`);
                for (const version of versions) {
                    assert.match(version, /^v\d/, `the update list prints ${version}`);
                }
            });
        });

        /* ═══════════════════════════════════════════════════════════════════
         * 4b. cmp-ss-3 — THE THEME PICKER IS BACK, AND IT IS THE ONLY ONE
         *
         * Slate's Display > Skin leaf carries a heading and a two-cell radiogroup
         * (prov-baseline settings-display-skin [i=43] p.slate-heading "Theme"
         * [629,304,916,26], [i=44] div.slate-bank.slate-theme-bank role=radiogroup
         * "Dark Light" [1569,285,260,64]). Decal's had none, nothing declared the
         * drop, and `createThemeController`'s set() had zero non-test callers — a user
         * could not choose a theme in the app at all.
         * ═════════════════════════════════════════════════════════════════ */

        describe('cmp-ss-3: Display > Skin chooses the theme', () => {
            const bank = () => page.evalFn(() => {
                const el = window.__settings.bespokeEl().shadowRoot.getElementById('theme-bank');
                if (!el) return null;
                const rect = el.getBoundingClientRect();
                return {
                    value: el.value,
                    role: el.getAttribute('role'),
                    label: el.getAttribute('aria-label'),
                    width: rect.width,
                    height: rect.height,
                    items: [...el.shadowRoot.querySelectorAll('.item')].map((item) => ({
                        label: item.textContent.trim(),
                        width: item.getBoundingClientRect().width,
                        checked: item.getAttribute('aria-checked'),
                    })),
                };
            });

            test('two cells, Slate\'s two and no third, in a bank that has a box', async () => {
                await show('display', 'display-skin');
                const got = await bank();
                assert.ok(got, 'the theme bank is not on the Skin leaf');
                assert.deepEqual(got.items.map((item) => item.label), ['Dark', 'Light']);
                assert.equal(got.role, 'radiogroup', 'the same aria spelling Slate used');
                assert.equal(got.height, 64, 'the bank floor is --ui-control-h');
                /* cmp-sm-2's fix, on the leaf that landed after it: n equal cells with a
                 * real box, not two hairlines. */
                assert.ok(got.width > 100, `the bank measured ${got.width}px`);
                assert.equal(got.items[0].width, got.items[1].width, 'two equal cells');
            });

            test('it shows the theme that is painted, and pressing the other one moves the stamp', async () => {
                await show('display', 'display-skin');
                const before = await bank();
                const stampBefore = await page.evalFn(() => window.__settings.themeStamp());
                assert.equal(before.value, stampBefore,
                    'the bank shows the stamp, not a value of its own');

                const other = stampBefore === 'dark' ? 'light' : 'dark';
                await page.click(`settings-screen >>> #bespoke >>> #theme-bank >>> #item-${other === 'dark' ? 0 : 1}`);
                await page.settle();

                const after = await page.evalFn(() => ({
                    stamp: window.__settings.themeStamp(),
                    source: window.__settings.theme().state.source,
                    theme: window.__settings.theme().theme,
                }));
                /* THE STAMP IS THE CHANNEL — the sheets and plot-surface both read it,
                 * so this is what "the theme changed" means. */
                assert.equal(after.stamp, other, `pressing ${other} did not restamp the root`);
                assert.equal(after.theme, other);
                /* AND THE CHOICE IS RECORDED AS A CHOICE. Without this the controller
                 * still thinks nobody has chosen, and followSystem would take the theme
                 * back at the next change of the panel's preference — S11 from the other
                 * side, and the reason the bank writes through set() and not the router. */
                assert.equal(after.source, 'stored');

                const shown = await bank();
                assert.equal(shown.value, other, 'the bank follows the controller it wrote to');

                /* PUT IT BACK: this suite shares one page and one controller. */
                await page.evalFn((back) => window.__settings.theme().set(back).then(() => true), stampBefore);
                await page.settle();
            });

            test('no controller, no control — a leaf that cannot write renders no bank', async () => {
                await show('display', 'display-skin');
                const gone = await page.evalFn(async () => {
                    const el = window.__settings.bespokeEl();
                    const had = Boolean(el.shadowRoot.getElementById('theme-bank'));
                    el.theme = null;
                    await el.updateComplete;
                    const now = Boolean(el.shadowRoot.getElementById('theme-bank'));
                    const skins = Boolean(el.shadowRoot.getElementById('skin-grid')
                        || el.shadowRoot.getElementById('skins-empty'));
                    el.theme = window.__settings.theme();
                    await el.updateComplete;
                    return { had, now, skins, back: Boolean(el.shadowRoot.getElementById('theme-bank')) };
                });
                assert.equal(gone.had, true);
                assert.equal(gone.now, false, 'a bank with nothing to write to must not render');
                assert.equal(gone.skins, true, 'the rest of the leaf is unaffected');
                assert.equal(gone.back, true);
            });
        });

        /* ═══════════════════════════════════════════════════════════════════
         * 5. THE TILE GRID REFLOWS — §4.4's "only genuinely fluid layout"
         * ═════════════════════════════════════════════════════════════════ */

        /* THE TILE GRID BECAME A PICKER ON 26 AUGUST 2026 (Ben: "keep the page looking
         * like Slate's but add a dropdown to choose the language. More languages are
         * expected later").
         *
         * THE GRID WAS RIGHT FOR THE PAGE IT WAS DESIGNED FOR AND WRONG FOR THE ONE THAT
         * SHIPPED. Auto-fill over thirty tiles is how you choose at a glance; with ONE
         * language installed it drew a single filled tile that could not be pressed to any
         * effect — a control that looks as though it has lost its options.
         *
         * WHAT THE THREE OLD CASES PROVED, AND WHERE IT WENT. The reflow and the
         * four-plus-one selection dials are properties of `ui-tile-grid` and of the
         * selection surface, and BOTH have their own suites
         * (`test/render/ui-tile-grid.render.test.mjs`, and the surface's own parity file).
         * What was specific to this leaf — that the current language is marked and that
         * choosing writes ONE key — is what survives here.
         *
         * `ui-tile-grid` NOW HAS NO SCREEN CALLER, only its gallery entry. That is worth
         * saying plainly rather than leaving to be discovered: it is a Wave-1 primitive
         * with its own tests, it is not deleted, and nothing in `src/screens/` composes it.
         */
        describe('select-language: the picker, and one key', () => {
            test('the current language is selected, and choosing writes one key', async () => {
                await show('units-language', 'units-language-select-language');
                await page.evalFn(() => window.__settings.languages([
                    { code: 'en', endonym: 'English', english: 'English', partial: false },
                    { code: 'fr', endonym: 'français', english: 'French', partial: false },
                    { code: 'ja', endonym: '日本語', english: 'Japanese', partial: true },
                ]).then(() => true));
                await page.settle();

                const shown = await page.evalFn(() => {
                    const select = window.__settings.bespokeEl().shadowRoot.getElementById('language-select');
                    return {
                        options: [...select.shadowRoot.querySelectorAll('option')].map((o) => o.value),
                        labels: [...select.shadowRoot.querySelectorAll('option')].map((o) => o.textContent.trim()),
                        value: select.value,
                    };
                });
                assert.deepEqual(shown.options, ['en', 'fr', 'ja'], 'the picker offers what it is given');
                assert.equal(shown.value, 'en', 'and the current one is selected');
                /* THE NAME A READER LOOKS FOR IS THE ONE THEY USE, with the English name
                 * beside it — and a half-translated language says so before it is chosen. */
                assert.match(shown.labels[1], /français \(French\)/);
                assert.match(shown.labels[2], /partial/);

                const after = await page.evalFn(async () => {
                    const select = window.__settings.bespokeEl().shadowRoot.getElementById('language-select');
                    select.dispatchEvent(new CustomEvent('change', {
                        detail: { value: 'fr' }, bubbles: true, composed: true,
                    }));
                    await new Promise((r) => setTimeout(r, 0));
                    return window.__settings.stores().settings.value('language');
                });
                assert.equal(after, 'fr', 'choosing writes the one language key');
            });

            test('the page gives its one instruction ONCE, exactly as its sibling does', async () => {
                /* THE DEFECT THIS PINS. Select Language rendered FOUR pieces of copy and
                 * TWO names for one select: the leaf description "The language this app is
                 * written in.", a section heading "Display language", a row label
                 * "Language", and a caption "Choose the language for the application
                 * interface." Its siblings Temperature and Time each carry one label and no
                 * caption, and the Time row states the rule in its own comment: "A row on a
                 * one-row page inherits the page's sentence; it does not repeat it."
                 *
                 * SO THIS IS A CONSISTENCY TEST AND NOT A SPELLING TEST, which is what
                 * makes it worth having: the same three assertions are made about all three
                 * leaves, and the two that were already right pass unchanged. A future
                 * caption added to any of them fails here. */
                /* TWO LEAVES SINCE 28 AUGUST 2026, NOT THREE. Temperature and Time merged
                 * into `units-language-units`, so the cluster is Select Language and Units.
                 * The rule this pins is unchanged and now covers both rows of the merged
                 * page at once: one sentence, on the leaf description, and no caption
                 * anywhere else. */
                const leaves = [
                    ['units-language', 'units-language-select-language', 'The language this app is written in.'],
                    ['units-language', 'units-language-units', 'Celsius or Fahrenheit, and how the time is written.'],
                ];
                for (const [cluster, leaf, sentence] of leaves) {
                    await show(cluster, leaf);
                    const seen = await page.evalFn(() => {
                        const bespoke = window.__settings.bespokeEl();
                        const leafEl = window.__settings.leafEl();
                        const captions = bespoke
                            ? [...bespoke.shadowRoot.querySelectorAll('.ui-caption')].map((n) => n.textContent.trim())
                            : [];
                        const desc = leafEl?.shadowRoot?.getElementById('leaf-desc');
                        const rowCaptions = leafEl
                            ? [...leafEl.shadowRoot.querySelectorAll('ui-settings-row')]
                                .map((r) => r.getAttribute('caption') || '')
                                .filter(Boolean)
                            : [];
                        return { captions, rowCaptions, desc: desc ? desc.textContent.trim() : null };
                    });
                    assert.deepEqual(seen.captions, [],
                        `${leaf} draws no bespoke caption — the leaf description is the sentence`);
                    assert.deepEqual(seen.rowCaptions, [],
                        `${leaf} draws no row caption either`);
                    assert.equal(seen.desc, sentence,
                        `${leaf}'s one sentence is the leaf description`);
                }
            });

            test('one name for the select, and it is Slate\'s more precise pair', async () => {
                /* "Display language" over an H1 that reads "Select Language", where the row
                 * label used to read "Language" and a section heading above it read
                 * "Display language" — two names for one control. The select's accessible
                 * name was already the surviving one, so this asserts the visible label now
                 * agrees with it rather than differing from it. */
                await show('units-language', 'units-language-select-language');
                const named = await page.evalFn(() => {
                    const root = window.__settings.bespokeEl().shadowRoot;
                    const headings = [...root.querySelectorAll('.ui-heading')].map((n) => n.textContent.trim());
                    const select = root.getElementById('language-select');
                    return { headings, label: select.getAttribute('label') };
                });
                assert.deepEqual(named.headings, ['Display language'],
                    'exactly one visible name for the one control on the page');
                assert.equal(named.label, 'Display language',
                    'and the accessible name is the same words');
            });
        });

        /* ═══════════════════════════════════════════════════════════════════
         * 6. T11 — THE EMPTY STATES RENDER AS AUTHORED
         * ═════════════════════════════════════════════════════════════════ */

        describe('#38 renders centred, as authored (T11)', () => {
            test('every empty state this cluster can show is centred inside its own root', async () => {
                await serve(['wakeSchedule']);
                /* THE SLEEP/WAKE LEAF LEFT THIS LIST ON 24 AUG 2026. It was here because
                 * it drew two "not built in this version" notes and nothing else; it now
                 * draws the presence switch, the sleep-after band and the schedule list,
                 * because `presence-store.js` opened the doors those controls needed.
                 *
                 * `updates-firmware-update` takes its place. The fixture serves no
                 * firmware catalog, so that leaf draws the state a machine with nothing
                 * to offer draws — which is the same #38 in the same cluster. */
                /* AND THE GATEWAY GROUP LEFT IT ON 26 AUG 2026, for the same kind of
                 * reason: it drew ONE "not shown here" note, and all four of the settings
                 * it apologised for turned out to be fields of a document this skin
                 * already had a client for. It draws four registry rows now. */
                const cases = [
                    ['updates', 'updates-firmware-update'],
                ];
                for (const [category, leafId] of cases) {
                    await show(category, leafId);
                    const report = await page.evalFn(() => {
                        const root = window.__settings.bespokeEl().shadowRoot;
                        return [...root.querySelectorAll('ui-empty-state')].map((el) => {
                            const inner = el.shadowRoot.getElementById('empty');
                            const heading = el.shadowRoot.getElementById('heading');
                            const style = getComputedStyle(inner);
                            const hostBox = el.getBoundingClientRect();
                            const headBox = heading ? heading.getBoundingClientRect() : null;
                            return {
                                id: el.id,
                                textAlign: style.textAlign,
                                justifyItems: style.justifyItems,
                                leftGap: headBox ? headBox.left - hostBox.left : null,
                                rightGap: headBox ? hostBox.right - headBox.right : null,
                            };
                        });
                    });
                    assert.ok(report.length > 0, `${leafId} shows no empty state`);
                    for (const state of report) {
                        /* T11: "authored centred and rendered left-aligned by three shell
                         * rules". Nothing outside a shadow root can reach these, so the
                         * authored value IS the rendered one — asserted as the computed
                         * value AND as symmetry of the box, since a centre that is only
                         * declared is what T11 was. */
                        assert.equal(state.textAlign, 'center', `${leafId}/${state.id} is not centred`);
                        near(state.leftGap, state.rightGap, `${leafId}/${state.id} sits off-centre`, 2.01);
                    }
                }
            });
        });

        /* ═══════════════════════════════════════════════════════════════════
         * 7. Q14 — CONFIRMED ON SCREEN
         * ═════════════════════════════════════════════════════════════════ */


        /* ═══════════════════════════════════════════════════════════════════
         * 8. THE SIX THAT COMPOSE — each one the component §4.4 names
         * ═════════════════════════════════════════════════════════════════ */

        describe('each leaf composes the component §4.4 gives it', () => {
            test('the named component is on screen for each of the nine', async () => {
                await serve(['ledStrip', 'scaleCalibration', 'wakeSchedule']);
                const expected = {
                    /* NEITHER IS A CARD ANY MORE (26 Aug 2026). Ben asked, page after
                     * page, for the cards to go — "drop the card, use the same layout as
                     * the other pages" — so machine info is a definition LIST in a flat
                     * group and sleep/wake is its schedule list. What §4.4 promised each
                     * leaf is a LAYOUT, and the layout is what these assertions are about;
                     * the component that used to draw the box is not. */
                    'machine-machine-info': 'ui-button',
                    'machine-sleep-wake-schedules': 'ui-list-row',
                    'display-skin': 'ui-card-grid',
                    /* THE TRACK WAS THIS LEAF'S §4.4 COMPONENT AND IT IS GONE (27 Aug
                     * 2026), so what stands in its place is the control that actually does
                     * the leaf's work. Same correction as the two cards above, for the same
                     * reason: §4.4 promised a LAYOUT, the layout is what these assertions
                     * are about, and a component that no longer draws anything on the page
                     * cannot go on being asserted.
                     *
                     * WHY IT WENT. Relabelled honestly the bar said, in a bar, exactly what
                     * the line above it said in words — and it fills solid for ever once
                     * "Update all skins" has been pressed once. The COUNT it drew is still
                     * on the page and is pinned by 'the update list states its count in
                     * words', so the reading did not leave with the component. */
                    'updates-skin-app': 'ui-button',
                    /* A PICKER SINCE 26 AUG 2026, not a grid of one — see the describe
                     * block above. §4.4 promised this leaf a LAYOUT for choosing a
                     * language; what it needs at one language is a list that says it is
                     * one. */
                    'units-language-select-language': 'ui-select',
                    'calibration-load-cells': 'ui-wizard-column',
                    'accessories-lighting': 'ui-colour-swatch-row',
                };
                for (const [category, leafId] of BESPOKE_PANES) {
                    await show(category, leafId);
                    const report = await paneReport(page);
                    assert.ok(report.bespokeTags.includes(expected[leafId]),
                        `${leafId} does not compose ${expected[leafId]} (saw ${report.bespokeTags.join(', ')})`);
                }
            });

            test('the machine-info card lists what the machine actually said', async () => {
                await show('machine', 'machine-machine-info');
                const rows = await page.evalFn(() => {
                    const list = window.__settings.bespokeEl().shadowRoot.querySelector('.facts');
                    return [...list.querySelectorAll('dt')].map((dt, i) => ({
                        term: dt.textContent.trim(),
                        value: list.querySelectorAll('dd')[i]?.textContent.trim() ?? null,
                    }));
                });
                const terms = rows.map((r) => r.term);
                /* THE FOUR NAMED FIELDS COME FIRST AND IN ORDER; anything after them is
                 * whatever the machine put in `extra`, which the fixture may or may not
                 * carry. Asserting the prefix rather than the whole list is what lets this
                 * page keep up with a firmware that reports more than it did last month —
                 * which is the change Ben asked for ("add refill kit", "add voltage"). */
                assert.deepEqual(terms.slice(0, 4),
                    ['Model', 'Firmware version', 'Serial number', 'Group head controller']);
                assert.equal(rows[0].value, 'Bengle');
                assert.equal(rows[1].value, '282');
                /* AND THE INTERNAL BITMASK IS NEVER ONE OF THEM. "Profile Mode Caps 15"
                 * answers no question a user has — Slate's own P33, carried. */
                assert.ok(!terms.some((term) => /profile mode caps/i.test(term)));
            });

            test('the skin grid is two-up and marks exactly one card active', async () => {
                await show('display', 'display-skin');
                const grid = await page.evalFn(() => {
                    const root = window.__settings.bespokeEl().shadowRoot;
                    const cards = [...root.querySelectorAll('.skin-card')];
                    return {
                        cards: cards.length,
                        active: cards.filter((c) => c.hasAttribute('data-active')).length,
                        columns: new Set(cards.map((c) => Math.round(c.getBoundingClientRect().x))).size,
                        buttons: root.querySelectorAll('.skin-card ui-button, .skin-card button').length,
                    };
                });
                assert.ok(grid.cards >= 2);
                assert.equal(grid.active, 1);
                /* THE TILES ARE THE SWITCH SINCE 26 AUGUST 2026 (Ben: "use Slate
                 * completely"). This assertion used to read "a card that cannot switch
                 * skins is a card, not a button that does nothing" — correct while the
                 * page said switching was done elsewhere, and that sentence was true of
                 * the SKIN rather than of the machine: the three routes have been in the
                 * table throughout.
                 *
                 * SO THE CLAIM INVERTS AND SHARPENS: every card except the active one is
                 * pressable, and the active one is not — pressing the skin you are already
                 * in would stop and restart the server for no change. */
                assert.equal(grid.buttons, grid.cards - 1,
                    'every card but the active one is a press target');
            });

            test('the update list states its count in words, and draws no bar under them', async () => {
                /* THIS TEST USED TO ASSERT THE BAR. It read "the update list shows a real
                 * progress track over a real count" and checked that `#check-progress`
                 * spanned the list. The bar is gone as of 27 August 2026 and the count it
                 * measured is not — so the claim inverts rather than being deleted.
                 *
                 * WHY THE BAR WENT. Ben asked on 26 August for it to say what it is: "the
                 * tablet's memory and how full it is". That cannot be built — nothing
                 * ReaPrime serves reports the tablet's storage — so it was relabelled to
                 * the one real quantity within reach, how many installed skins the machine
                 * has ever checked for a newer version. Relabelled, it said in a bar
                 * exactly what the line above it already said in words, and it fills solid
                 * for ever the moment "Update all skins" is pressed once. A duplicate
                 * reading that stops varying is the defect class this fork removes, so on
                 * 27 August Ben took the recommendation to drop it.
                 *
                 * THE COUNT IS STILL A READING AND IS STILL PINNED: same numerator, same
                 * denominator, now only in text. Nothing was lost with the bar. */
                await show('updates', 'updates-skin-app');
                const got = await page.evalFn(() => {
                    const root = window.__settings.bespokeEl().shadowRoot;
                    const numbers = [...root.querySelectorAll('#updates .ui-numeric')]
                        .map((el) => el.textContent.trim())
                        .filter((text) => /^\d+\s*\/\s*\d+$/.test(text));
                    return {
                        bar: Boolean(root.getElementById('check-progress')),
                        count: numbers[0] ?? null,
                        labelled: [...root.querySelectorAll('#updates .ui-caption')]
                            .some((el) => /checked for a newer version/i.test(el.textContent)),
                        rows: root.querySelectorAll('.update-row').length,
                    };
                });
                assert.equal(got.bar, false, 'the track restated the line above it and never varied again');
                assert.ok(got.count, 'the count itself survives — it was the honest half');
                const [checked, total] = got.count.split('/').map((n) => Number(n.trim()));
                assert.equal(total, got.rows, 'the denominator is still the list itself');
                assert.ok(checked > 0 && checked < total,
                    'the fixture has some checked and some not, so the count is neither end');
                assert.equal(got.labelled, true, 'a number with no words next to it is what got it read as a disk gauge');
            });

            test('the lighting leaf is two columns when there is room and one when there is not', async () => {
                await serve(['ledStrip']);
                await show('accessories', 'accessories-lighting');
                const at = async (width) => {
                    await page.evalFn((w) => {
                        window.__settings.stage().style.inlineSize = `${w}px`;
                        return true;
                    }, width);
                    await page.settle();
                    return page.evalFn(() => {
                        const root = window.__settings.bespokeEl().shadowRoot;
                        const grid = root.getElementById('lighting');
                        const columns = [...grid.children].map((c) => Math.round(c.getBoundingClientRect().x));
                        return {
                            columns: new Set(columns).size,
                            overflow: grid.scrollWidth > grid.clientWidth + 1,
                        };
                    });
                };
                const wide = await at(1900);
                const narrow = await at(900);
                assert.equal(wide.overflow, false);
                assert.equal(narrow.overflow, false);
                assert.ok(wide.columns >= narrow.columns,
                    'the two columns collapse to one intrinsically, with no breakpoint');

                await page.evalFn(() => {
                    window.__settings.stage().style.inlineSize = '100%';
                    return true;
                });
                await page.settle();
            });
        });

        /* ═══════════════════════════════════════════════════════════════════
         * THE CONNECTION PAGES — Ben, 26 August 2026: "end with a list of
         * previously connected devices", "same setup" on the scale.
         *
         * WHAT THE MACHINE PAGE SAID BEFORE THIS: nothing at all about whether
         * the machine was connected — no dot, no word, no badge, on the page
         * whose whole subject is the connection.
         * ═════════════════════════════════════════════════════════════════ */

        describe('the connection pages list what the machine remembers', () => {
            test('every remembered device is a row, with the actions its state allows', async () => {
                await show('connection', 'connection-machine');
                const rows = await page.evalFn(() => {
                    const root = window.__settings.bespokeEl().shadowRoot;
                    return [...root.querySelectorAll('.device')].map((row) => ({
                        id: row.dataset.device,
                        connected: row.hasAttribute('data-connected'),
                        word: row.querySelector('ui-status-chip')?.textContent.trim(),
                        actions: [...row.querySelectorAll('ui-button')].map((b) => b.className),
                    }));
                });
                assert.equal(rows.length, 2, 'both machines, the remembered one included');

                const live = rows.find((row) => row.connected);
                const remembered = rows.find((row) => !row.connected);
                assert.ok(live, 'the connected machine is marked');
                /* `available: false` OUTRANKS THE STATE, because a remembered device's
                 * stored state is whatever it was when it went away. */
                assert.equal(remembered.word, 'Unavailable');

                /* THE ACTIONS FOLLOW THE STATE. A connected device can be disconnected and
                 * CANNOT be forgotten — forgetting a live pairing is a two-step action
                 * wearing one button, and Slate makes the same choice. */
                assert.deepEqual(live.actions, ['device-disconnect']);
                assert.deepEqual(remembered.actions, ['device-connect', 'device-forget']);
            });

            test('forgetting a device asks the machine, and the list re-reads', async () => {
                await show('connection', 'connection-machine');
                const gone = await page.evalFn(async () => {
                    const root = window.__settings.bespokeEl().shadowRoot;
                    const row = [...root.querySelectorAll('.device')]
                        .find((r) => !r.hasAttribute('data-connected'));
                    const id = row.dataset.device;
                    row.querySelector('.device-forget').click();
                    await new Promise((r) => setTimeout(r, 60));
                    return { id, left: window.__settings.server().devices.map((d) => d.id) };
                });
                await page.settle();
                assert.ok(!gone.left.includes(gone.id), 'the machine was asked to forget it');
                const after = await page.evalFn(() => window.__settings.bespokeEl()
                    .shadowRoot.querySelectorAll('.device').length);
                assert.equal(after, 1, 'and the page re-read rather than assuming');
            });

            test('the scale page lists what is remembered AND what a search found, apart', async () => {
                await show('connection', 'connection-scale');
                await page.evalFn(() => window.__settings.stores().scaleConnect.scan());
                await page.settle();
                const seen = await page.evalFn(() => {
                    const root = window.__settings.bespokeEl().shadowRoot;
                    return {
                        remembered: [...root.querySelectorAll('#devices .device')].map((r) => r.dataset.device),
                        found: [...root.querySelectorAll('#found .device')].map((r) => r.dataset.found),
                    };
                });
                /* THE TWO LISTS ARE DIFFERENT QUESTIONS: a remembered device is one to
                 * reconnect to, a found one is one you have just met. Merging them loses
                 * the distinction a person acts on. */
                assert.deepEqual(seen.remembered, ['scale-01']);
                assert.deepEqual(seen.found, ['scale-1'], 'and a device already remembered is not listed twice');
            });

            test('the MACHINE page shows what a search found too — it showed nothing at all', async () => {
                /* MEASURED LIVE at 1281x801 before this: pressing Search on
                 * connection-machine left `#found` absent and the device rows unchanged,
                 * while the store reached status 'done' with results in it. No "Searching…",
                 * no results, no "nothing found" — the audit's original complaint about this
                 * page (no path from nothing-connected to connected) surviving in a new
                 * shape, for machines only. `#foundList` has taken the type as a parameter
                 * since it was written; only the Scale page ever called it. */
                await show('connection', 'connection-machine');
                await page.evalFn(() => window.__settings.stores().scaleConnect.scan());
                await page.settle();
                const seen = await page.evalFn(() => {
                    const root = window.__settings.bespokeEl().shadowRoot;
                    return {
                        hasFound: !!root.getElementById('found'),
                        found: [...root.querySelectorAll('#found .device')].map((r) => r.dataset.found),
                    };
                });
                assert.equal(seen.hasFound, true, 'the found section is in the tree at all');
                assert.deepEqual(seen.found, ['machine-1'],
                    'the scanned machine, and not the scanned scale — the list is typed');
            });

            test('the chip prints a WORD, not ReaPrime’s wire token', async () => {
                /* `word` fell through to `device.state`, which is a `ConnectionState` token.
                 * The chip's `text-transform: uppercase` hid that for three of the five
                 * values — measured live, the connected machine's chip textContent was the
                 * literal string 'connected' — but 'discovered' reads DISCOVERED, where
                 * Slate says 'Available' and is right: available is what a person can act
                 * on, discovered is an implementation word. */
                await show('connection', 'connection-machine');
                await page.evalFn(() => window.__settings.stores().scaleConnect.scan());
                await page.settle();
                const words = await page.evalFn(() => {
                    const root = window.__settings.bespokeEl().shadowRoot;
                    return {
                        remembered: [...root.querySelectorAll('#devices .device')]
                            .map((r) => r.querySelector('ui-status-chip')?.textContent.trim()),
                        found: [...root.querySelectorAll('#found .device')]
                            .map((r) => r.querySelector('ui-status-chip')?.textContent.trim()),
                    };
                });
                assert.ok(words.remembered.includes('Connected'),
                    `the connected machine says Connected, not 'connected' — saw ${JSON.stringify(words.remembered)}`);
                assert.ok(!words.remembered.some((w) => w && w === w.toLowerCase()),
                    'no wire token survives into the chip');
            });

            test('the Preferred column is NAMED, once, over the track it belongs to', async () => {
                /* The switch carried an aria-label and no visible name at all, and a column
                 * of unlabelled switches on a connection page is unreadable — "preferred" is
                 * not a guessable meaning. Ben's instruction was about PLACEMENT, not the
                 * word: "keep each row clean, the Preferred label currently pushes its
                 * toggle down." A header over the grid track satisfies both halves. */
                await show('connection', 'connection-machine');
                const report = await page.evalFn(() => {
                    const root = window.__settings.bespokeEl().shadowRoot;
                    const heads = [...root.querySelectorAll('.device-head')];
                    const rows = [...root.querySelectorAll('.device')];
                    const heights = rows.map((r) => Math.round(r.getBoundingClientRect().height));
                    const cell = heads[0]?.querySelector('.ui-microcap');
                    const sw = rows[0]?.querySelector('.device-preferred');
                    return {
                        heads: heads.length,
                        word: cell?.textContent.trim() ?? null,
                        heights,
                        /* THE WORD LANDS ON THE SWITCH TRACK, which is the half of Ben's
                         * note a bare sentence above the list would not have satisfied. */
                        aligned: cell && sw
                            ? Math.abs(cell.getBoundingClientRect().left - sw.getBoundingClientRect().left) < 40
                            : false,
                    };
                });
                assert.equal(report.heads, 1, 'the word is stated once, whatever the row count');
                assert.equal(report.word, 'Preferred');
                assert.equal(report.aligned, true, 'over the switch column, not floating above the list');
                assert.equal(new Set(report.heights).size, 1,
                    'and no row is taller than its neighbours — the regression Ben reported');
            });

            test('both pages say that Search does not connect for you', async () => {
                /* THE ONLY PLACE THE SKIN STATED THIS, and the rebuild deleted it with the
                 * bordered scan card it lived in. Decal's scan sends `connect=false` on
                 * purpose and Slate's does not, so Slate's Search joins whatever it finds
                 * and Decal's does not — an undocumented right choice reads as a broken
                 * button. It is on both pages now; the Machine page never had it. */
                for (const leaf of ['connection-machine', 'connection-scale']) {
                    await show('connection', leaf);
                    const said = await page.evalFn(() => window.__settings.bespokeEl()
                        .shadowRoot.getElementById('devices-search-note')?.textContent.trim() ?? null);
                    assert.match(said ?? '', /Nothing is connected automatically/, `${leaf} does not say it`);
                }
            });

            test('a REFUSED device action is reported where the button was pressed', async () => {
                /* `writeError` was one slot written by five operations and read in ONE
                 * place: the WiFi form on the Scale page. So a Forget that ReaPrime
                 * answered 503 printed "That address was refused." under a form about
                 * addresses, and printed NOTHING on the Machine page, which has no WiFi
                 * section at all. One is a lie and one is silence. */
                await page.evalFn(() => window.__settings.failRoute('PUT /devices/forget'));
                await show('connection', 'connection-machine');
                /* A ROW WITH A FORGET BUTTON ON IT, whatever an earlier case left behind.
                 * Only a NOT-connected device can be forgotten, and the case above this one
                 * removes the remembered machine — so disconnect the live one if that is all
                 * there is. Disconnecting is a real action with a real route and it leaves
                 * the page in a state the page can be in. */
                await page.evalFn(async () => {
                    const root = window.__settings.bespokeEl().shadowRoot;
                    if (root.querySelector('.device-forget')) return true;
                    root.querySelector('.device-disconnect')?.click();
                    await new Promise((r) => setTimeout(r, 80));
                    return true;
                });
                await page.settle();
                const machine = await page.evalFn(async () => {
                    const root = window.__settings.bespokeEl().shadowRoot;
                    const row = [...root.querySelectorAll('.device')]
                        .find((r) => r.querySelector('.device-forget'));
                    row.querySelector('.device-forget').click();
                    await new Promise((r) => setTimeout(r, 80));
                    return {
                        said: root.getElementById('devices-refusal')?.textContent.trim() ?? null,
                        wifi: !!root.getElementById('wifi-refusal'),
                    };
                });
                await page.settle();
                assert.match(machine.said ?? '', /forget/i,
                    'the sentence names the operation that was refused');
                assert.equal(machine.wifi, false, 'and the Machine page has no WiFi section to hide it in');

                await show('connection', 'connection-scale');
                const scale = await page.evalFn(async () => {
                    const root = window.__settings.bespokeEl().shadowRoot;
                    const row = [...root.querySelectorAll('#devices .device')]
                        .find((r) => r.querySelector('.device-forget'));
                    row.querySelector('.device-forget').click();
                    await new Promise((r) => setTimeout(r, 80));
                    return {
                        devices: !!root.getElementById('devices-refusal'),
                        wifi: !!root.getElementById('wifi-refusal'),
                    };
                });
                assert.equal(scale.devices, true, 'the refusal is under the list it happened in');
                assert.equal(scale.wifi, false,
                    'and NOT under the WiFi form, which is about an address this action has none of');
                await page.evalFn(() => window.__settings.failRoute('PUT /devices/forget', false));
            });

            test('a FAILED read says so — it used to take the whole section with it', async () => {
                /* `loadDevices` publishes an error and leaves `known` at null, and the leaf
                 * returned `nothing` for BOTH — so a machine that refused the read took the
                 * heading, the empty state and all with it. On the Machine page that put the
                 * page back exactly where the audit found it: an address field and nothing
                 * else, with no indication anything had gone wrong. */
                /* THE STATE IS DRIVEN ON THE STORE, not through the wire, and the reason is
                 * that the state only exists BEFORE the first successful read: `known` stays
                 * null until one lands, and this page has been opened several times by the
                 * cases above. A driver that failed the route now would produce
                 * "read once, then refused", which is a different picture. Swapping `get`
                 * for the length of the assertion states the store's own three-way answer
                 * directly, which is the decision this leaf is being measured on. */
                await show('connection', 'connection-machine');
                const said = await page.evalFn(async () => {
                    const store = window.__settings.stores().scaleConnect;
                    const real = store.get.bind(store);
                    store.get = () => ({ ...real(), known: null, error: { ok: false, reason: 'refused' } });
                    const leaf = window.__settings.bespokeEl();
                    leaf.requestUpdate();
                    await leaf.updateComplete;
                    const root = leaf.shadowRoot;
                    const report = {
                        heading: !!root.getElementById('devices'),
                        error: root.getElementById('devices-error')?.textContent.trim() ?? null,
                        rows: root.querySelectorAll('#devices .device').length,
                    };
                    store.get = real;
                    leaf.requestUpdate();
                    await leaf.updateComplete;
                    return report;
                });
                assert.equal(said.heading, true, 'the section survives a refused read');
                assert.match(said.error ?? '', /could not be asked/);
                assert.equal(said.rows, 0, 'and it does not pretend to a list it does not have');
                await page.settle();
            });
        });

        /* ═══════════════════════════════════════════════════════════════════
         * SWITCHING A SKIN — three calls in one order, because the default is
         * a preference and starting the server is what re-points it.
         * ═════════════════════════════════════════════════════════════════ */

        describe('the skin tiles switch, and the order is what makes it work', () => {
            test('pressing a tile sets the default AND restarts the server', async () => {
                await show('display', 'display-skin');
                const before = await page.evalFn(() => ({
                    def: window.__settings.server().skinDefault,
                    serving: window.__settings.server().skinServing,
                }));
                assert.equal(before.serving, 'decal');

                await page.evalFn(async () => {
                    const root = window.__settings.bespokeEl().shadowRoot;
                    const tile = [...root.querySelectorAll('.skin-card')]
                        .find((c) => !c.hasAttribute('data-active'));
                    tile.querySelector('.skin-press').click();
                    await new Promise((r) => setTimeout(r, 80));
                    return true;
                });
                await page.settle();

                const after = await page.evalFn(() => ({
                    def: window.__settings.server().skinDefault,
                    serving: window.__settings.server().skinServing,
                }));
                assert.notEqual(after.def, before.def, 'the default moved');
                assert.equal(after.serving, after.def,
                    'and the server is serving it — setting the default alone would have '
                    + 'changed nothing a reload would show');

                const prompt = await page.evalFn(() => Boolean(
                    window.__settings.bespokeEl().shadowRoot.getElementById('skin-switched')));
                assert.equal(prompt, true, 'and the page offers the reload rather than taking it');
            });
        });

        /* ═══════════════════════════════════════════════════════════════════
         * FIRMWARE — Ben, 26 August 2026: "check it is valid, then offer an
         * UPDATE FW button behind a confirmation."
         *
         * BEFORE THIS, CHOOSING A FILE WAS THE FLASH.
         * ═════════════════════════════════════════════════════════════════ */

        describe('nothing flashes without a class check and a confirmation', () => {
            /**
             * Hand the file button a File without opening a picker.
             *
             * IT BUILDS A REAL HEADER NOW. This helper used to pass `new Uint8Array(size)`
             * — a file of zeros with a plausible name — and that was enough, because the
             * check was an extension and a size. As of 27 August 2026 the check reads the
             * image's BOARD MARKER, so a file of zeros is correctly refused as carrying no
             * firmware header at all, and a test that wants to exercise the accept path has
             * to hand over something that genuinely is an image of the right kind.
             *
             * THE MARKER IS WRITTEN LITTLE-ENDIAN BY HAND, not imported from the module, so
             * these cases fail if the module's reading of the header ever stops agreeing
             * with the header the firmware tooling actually writes.
             */
            const pick = (p, name, size, marker = null) => p.evalFn(async ([n, bytes, mark]) => {
                const body = new Uint8Array(bytes);
                if (mark !== null) new DataView(body.buffer).setUint32(4, mark, true);
                const root = window.__settings.bespokeEl().shadowRoot;
                const button = root.getElementById('firmware-file');
                button.dispatchEvent(new CustomEvent('file-pick', {
                    detail: { file: new File([body], n), files: [] },
                    bubbles: true,
                    composed: true,
                }));
                await new Promise((r) => setTimeout(r, 40));
                const dialog = root.getElementById('firmware-confirm');
                const refusal = root.getElementById('firmware-rejected');
                return {
                    open: dialog?.open === true,
                    rejected: Boolean(refusal),
                    why: refusal ? refusal.textContent.replace(/\s+/g, ' ').trim() : null,
                };
            }, [name, size, marker]);

            /* THE FIXTURE MACHINE IS A BENGLE — `firmwareCatalog` serves `model: 'Bengle'`,
             * which is the literal string ReaPrime reports for Bengle hardware
             * (`DecentMachineModel.fromInt`, anything >= 128). So "the wrong image" here is
             * a DE1 one, which is the direction Ben named first. */
            const DE1_MARKER = 0xDE100001;
            const BENGLE_MARKER = 0xBE100001;

            test('a file that is not an image is refused before any dialog opens', async () => {
                await show('updates', 'updates-firmware-update');
                await page.evalFn(() => window.__settings.firmwareCatalog({}));
                await page.settle();
                const shot = await pick(page, 'holiday.jpg', 4096);
                assert.equal(shot.open, false, 'no confirmation for something that is not firmware');
                assert.equal(shot.rejected, true, 'and the page says so');
            });

            test('DE1 FIRMWARE IS REFUSED ON A BENGLE, and the refusal names both', async () => {
                /* BEN, 27 AUGUST 2026: "ensure we dont try and flash a DE1 FW onto Bengle
                 * or the other way around." This is that sentence, on the page.
                 *
                 * IT IS THE SKIN'S JOB AND NOT THE SERVER'S, which is the part worth
                 * remembering: the file picker posts to the RAW route, and `_uploadRaw`
                 * refuses an empty body and nothing else — no header parse, no marker, no
                 * eligibility. Upstream's own test uploads a ONE-BYTE image and gets a 200.
                 * There is nothing behind this check.
                 *
                 * AND THE SENTENCE NAMES BOTH SIDES, because "wrong firmware" invites the
                 * reader to try again with something else that is also wrong. */
                await show('updates', 'updates-firmware-update');
                await page.evalFn(() => window.__settings.firmwareCatalog({}));
                await page.settle();
                const shot = await pick(page, 'de1-1358.bin', 200 * 1024, DE1_MARKER);
                assert.equal(shot.open, false, 'a wrong-machine image must never reach a confirmation');
                assert.equal(shot.rejected, true);
                assert.match(shot.why, /DE1/, 'it says which image was picked');
                assert.match(shot.why, /Bengle/, 'and which machine this is');
                const nothing = await page.evalFn(() => window.__settings.server().firmwareWrites ?? 0);
                assert.equal(nothing, 0, 'and nothing reached the wire');
            });

            test('the right image for this machine opens a confirmation, and only confirming sends it', async () => {
                await show('updates', 'updates-firmware-update');
                await page.evalFn(() => window.__settings.firmwareCatalog({}));
                await page.settle();
                const chosen = await pick(page, 'bengle.bin', 200 * 1024, BENGLE_MARKER);
                assert.equal(chosen.open, true, 'the confirmation is what stands between the tap and the flash');

                const nothingYet = await page.evalFn(() => window.__settings.server().firmwareWrites ?? 0);
                assert.equal(nothingYet, 0, 'choosing a file is not flashing it');
            });

            test('a machine that has not said what it is refuses a GOOD image', async () => {
                /* ReaPrime'S OWN RULE, mirrored: `machine_model_unknown` sits in the same
                 * force-proof set as `model_incompatible` on the managed route, so not even
                 * `force: true` will flash to a machine whose model did not read. The raw
                 * route has no such rule, so the skin supplies it. */
                await show('updates', 'updates-firmware-update');
                await page.evalFn(() => window.__settings.firmwareCatalog({
                    machine: { build: 336, model: 'Unknown' },
                }));
                await page.settle();
                const shot = await pick(page, 'bengle.bin', 200 * 1024, BENGLE_MARKER);
                assert.equal(shot.open, false);
                assert.equal(shot.rejected, true);
                assert.match(shot.why, /has not said which model/i);
            });
        });

        test('nothing in this walk threw', () => {
            assert.deepEqual(page.pageErrors, []);
        });

        /* ═══════════════════════════════════════════════════════════════════
         * 9. THE TEN LEAVES OF 24 AUGUST 2026 — Ben: "lets fix all the
         *    settings pages then now"
         * ═══════════════════════════════════════════════════════════════════
         *
         * EVERY ONE OF THEM WAS A DOOR WITH NOBODY WALKING THROUGH IT. What is worth
         * photographing is not that a card appears — it is that the surface reaches the
         * store, that the store reaches the route, and that a refusal is reported rather
         * than swallowed. So these press things and read what changed on the server.
         * ═════════════════════════════════════════════════════════════════ */

        /* ════════════════════════════════════════════════════════════════════
         * NO CONTROL IS ZERO-WIDE, on any bespoke leaf
         * ═══════════════════════════════════════════════════════════════════ */

        describe('every control a bespoke leaf draws has a size', () => {
            /* THE DEFECT CLASS, and it has now appeared four times in three shapes.
             *
             * A text field states no width of its own — ui-text-field declares no host
             * block at all and lays out as a block — so wherever it lands in a
             * shrink-to-fit context it computes ZERO and draws as a sliver. It happened
             * inside a space-between flex row on three pages (fixed by `.form-row`), in a
             * settings row's `flex: none` control track (fixed in the leaf renderer), and
             * a fourth time in the WiFi-scale address row, which was in a `.sw-row` and
             * kept the defect after the other three were fixed. MEASURED beside Slate's
             * page: about 40px wide and 55 tall — narrower than it was tall.
             *
             * SO THE CLAIM IS THE CLASS, not the three call sites. The walk renders every
             * bespoke leaf and fails any interactive control that is zero-wide or crosses
             * a pane edge. Two CSS px of tolerance for subpixel layout.
             *
             * CAPABILITIES ARE SERVED, because a gated leaf that draws nothing photographs
             * as a page with no defects rather than as a page not measured. */
            test('no field, button, switch or bank is zero-wide or outside its pane', async () => {
                await serve(['cupWarmer', 'integratedScale', 'stopAtWeight', 'ledStrip',
                    'scaleCalibration', 'preheat', 'wakeSchedule']);
                const found = await page.evalFn(async () => {
                    const api = window.__settings;
                    const nav = await import('/src/lib/settings-nav.js');
                    const reg = await import('/src/lib/settings-leaves.js');
                    const screen = document.querySelector('settings-screen');
                    const WANT = 'ui-text-field, ui-button, ui-switch, ui-bank, ui-select, ui-stepper';
                    const out = [];
                    for (const cat of nav.SETTINGS_TREE) {
                        for (const leaf of cat.leaves) {
                            if (!Object.hasOwn(reg.BESPOKE_LEAVES, leaf.id)) continue;
                            await api.selectCategory(cat.id);
                            await api.selectLeaf(leaf.id);
                            await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
                            const root = screen.shadowRoot.getElementById('bespoke')?.shadowRoot;
                            if (!root) continue;
                            const pane = screen.shadowRoot.getElementById('leaf-pane').getBoundingClientRect();
                            for (const el of root.querySelectorAll(WANT)) {
                                const b = el.getBoundingClientRect();
                                /* A control the page has hidden has no box at all, which is
                                 * not the defect — the defect is a control that is DRAWN
                                 * and has no width. */
                                if (b.width === 0 && b.height === 0) continue;
                                out.push({
                                    leaf: leaf.id, tag: el.localName,
                                    id: el.id || null,
                                    w: Math.round(b.width),
                                    over: Math.round(Math.max(b.right - pane.right, pane.left - b.left)),
                                });
                            }
                        }
                    }
                    return out;
                });

                assert.ok(found.length > 40, `the walk must reach real controls, got ${found.length}`);
                assert.deepEqual(found.filter((c) => c.w <= 0), [],
                    'a drawn control with no width states no size and landed in a shrink-to-fit box');
                assert.deepEqual(found.filter((c) => c.over > 2), [],
                    'a control outside its pane is drawn outside the surface holding it');
            });
        });

        /* ════════════════════════════════════════════════════════════════════
         * THE DECAID PAGE READS THE MACHINE, which nothing could prove
         * ═══════════════════════════════════════════════════════════════════ */

        describe('the app-settings rows show what the app is set to', () => {
            /* THE FIXTURE'S `/settings` PAYLOAD DID NOT CARRY THESE FOUR KEYS. The page
             * went from an apology to four controls on 26 August 2026 and the mock never
             * grew the keys behind them, so all four rows read ABSENT in every test and
             * every capture — and nothing could tell a row that works from a row that
             * does not. Exactly the shape of the reset table's NOW column, found the same
             * way: by sweeping every row for something on the other end.
             *
             * `webUiPath` IS A READING and the assertion says so. It is writable on the
             * route and deliberately not offered, because writing it re-points the server
             * at another folder — which is how a skin removes itself from the screen. */
            test('gateway mode, log level and update checks read; the folder is a reading', async () => {
                await show('extensions', 'extensions-decent-app-settings');
                const rows = await page.evalFn(() => {
                    const leaf = window.__settings.leafEl().shadowRoot;
                    return [...leaf.querySelectorAll('ui-settings-row')].map((r) => ({
                        id: r.dataset.row,
                        reading: r.shadowRoot.getElementById('reading')?.textContent.trim() ?? null,
                        value: r.control[0]?.value ?? null,
                        checked: r.control[0]?.checked ?? null,
                        controls: r.control.length,
                    }));
                });
                const by = Object.fromEntries(rows.map((r) => [r.id, r]));

                assert.equal(by['extensions-decent-app-gateway'].value, 'tracking',
                    'the bank shows the mode the app is in, not the first option');
                assert.equal(by['extensions-decent-app-log-level'].value, 'INFO',
                    'the select shows the level the logger is at');
                assert.equal(by['extensions-decent-app-updates'].checked, false,
                    'the switch shows the app\'s own setting, not a default');

                const path = by['extensions-decent-app-path'];
                assert.equal(path.controls, 0, 'the folder is shown and never offered');
                assert.match(path.reading, /webui\/decal$/, 'and it is the served path');
            });
        });

        /* ════════════════════════════════════════════════════════════════════
         * THE CUP WARMER'S TWO TEMPERATURES, which were one for a fortnight
         * ═══════════════════════════════════════════════════════════════════ */

        describe('the setpoint and the plate reading are two numbers', () => {
            /* FOUND 26 August 2026 by photographing the page beside Slate's, which prints
             * the two as separate rows and so made the absence of one of them visible.
             *
             * `GET /machine/cupWarmer` serves BOTH. `temperature` is `matSetPoint`, the
             * number this page exists to set. `currentTemperature` is the live reading off
             * the plate — typed `Future<double?>`, and null whenever the warmer is off.
             * The door read the LIVE one and handed it over as the setting, so the Target
             * temperature stepper had been displaying however warm the mat happened to be,
             * and pressing + moved from there rather than from the target.
             *
             * The same rebuild had dropped Slate's 'Current temperature' row, so the live
             * value had nowhere left to appear and nothing to contradict it. One row
             * absent and one row wrong, off one wire.
             *
             * THE TWO NUMBERS ARE DELIBERATELY DIFFERENT HERE. A fixture whose setpoint
             * and reading agree cannot fail this test however the door is wired. */
            test('the stepper shows the setpoint and the reading row shows the plate', async () => {
                await serve(['cupWarmer', 'preheat']);
                await page.evalFn(() => window.__settings.cupWarmerState({
                    temperature: 62, enabled: true, currentTemperature: 38.5,
                }).then(() => true));
                await show('accessories', 'accessories-cup-warmer');

                const rows = await page.evalFn(() => {
                    const leaf = window.__settings.leafEl().shadowRoot;
                    return [...leaf.querySelectorAll('ui-settings-row')].map((r) => ({
                        id: r.dataset.row,
                        reading: r.shadowRoot.getElementById('reading')?.textContent.trim() ?? null,
                        value: r.control[0]?.value ?? null,
                    }));
                });

                const target = rows.find((r) => r.id === 'accessories-cup-warmer-target');
                assert.equal(target.value, 62, 'the stepper is the SETPOINT, not the plate');

                const now = rows.find((r) => r.id === 'accessories-cup-warmer-now');
                assert.ok(now, 'Slate prints the plate reading and so does this page');
                /* AND IT CARRIES ITS UNIT SINCE 26 AUGUST 2026. The row shipped with no
                 * `limit` and no `unit`, so `#readingFormat` returned undefined and the
                 * number printed bare — while the Target stepper four lines above it printed
                 * "62 °C", and in Fahrenheit would have printed "144 °F" beside a plate
                 * reading with no dimension at all. One decimal is Slate's own resolution
                 * (`formatTemp(cupWarmer.currentTemperature, 1)`), and it is the useful one:
                 * a plate creeping to setpoint is exactly the reading where tenths say
                 * something. */
                assert.equal(now.reading, '38.5 °C', 'and it is the live reading, not the setpoint');
                assert.equal(now.value, null, 'a reading has no control');
            });

            test('a warmer that is off reports no reading, and the row dashes', async () => {
                await serve(['cupWarmer', 'preheat']);
                /* THE MACHINE'S OWN ANSWER when the warmer is off is null, not zero, and a
                 * cold plate and a plate not reporting are different states. */
                await page.evalFn(() => window.__settings.cupWarmerState({
                    temperature: 62, enabled: false, currentTemperature: null,
                }).then(() => true));
                await show('accessories', 'accessories-cup-warmer');

                const now = await page.evalFn(() => {
                    const leaf = window.__settings.leafEl().shadowRoot;
                    const r = leaf.querySelector('ui-settings-row[data-row="accessories-cup-warmer-now"]');
                    return r?.shadowRoot.getElementById('reading')?.textContent.trim() ?? null;
                });
                assert.equal(now, '—', 'null is an absence, never a zero the machine did not measure');
            });
        });

        /* ════════════════════════════════════════════════════════════════════
         * ONE RHYTHM ACROSS THE SEAM, not just inside each half
         * ═══════════════════════════════════════════════════════════════════ */

        describe('a bespoke leaf keeps the page rhythm where its two halves meet', () => {
            /* MEASURED 26 August 2026. A bespoke page is TWO stacked elements —
             * <settings-leaf> for the name, the rule, the description and the registry
             * rows, and <settings-bespoke-leaf> under it — and the pane between them is
             * display: block. Every other vertical gap on every settings page is 18 CSS
             * px: description to first row, and row to row, on all thirty-seven leaves.
             * The seam into the bespoke half was ZERO. On Brightness and Plugins its
             * first heading touched the page description; on Skin its first group touched
             * the last registry row.
             *
             * BOTH SEAMS ARE MEASURED HERE, because they are different code paths that
             * happened to share one cause: a leaf with no registry rows meets the
             * description, and a leaf with rows meets the last of them. */
            const seamOf = (categoryId, leafId) => page.evalFn(async (c, l) => {
                await window.__settings.selectCategory(c);
                await window.__settings.selectLeaf(l);
                await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
                const screen = document.querySelector('settings-screen').shadowRoot;
                const bespoke = screen.getElementById('bespoke').getBoundingClientRect();
                const leaf = screen.getElementById('leaf').shadowRoot;
                const rows = [...leaf.querySelectorAll('ui-settings-row')];
                const above = rows.length > 0
                    ? rows[rows.length - 1].getBoundingClientRect()
                    : leaf.getElementById('leaf-desc').getBoundingClientRect();
                return { rows: rows.length, seam: Math.round(bespoke.top - above.bottom) };
            }, categoryId, leafId);

            test('the seam is the same 18px the rows use, with rows above it and without', async () => {
                await serve(['ledStrip']);

                /* PLUGINS IS THE NO-ROWS CASE NOW. Brightness was, until the 28 Aug merge
                 * gave it Display Size and Wake Lock and made it Screen — so the leaf this
                 * assertion was written against stopped being an example of the thing it
                 * asserts. The comment above already named the other one. */
                const noRows = await seamOf('extensions', 'extensions-plugins');
                assert.equal(noRows.rows, 0, 'Plugins holds no registry rows, so the seam is to the description');
                assert.equal(noRows.seam, 18, 'and it is one rhythm step, not zero');

                const withRows = await seamOf('display', 'display-skin');
                assert.ok(withRows.rows > 0, 'Skin holds registry rows, so the seam is to the last of them');
                assert.equal(withRows.seam, 18, 'and it is the same step again');

                /* THE THIRD CASE LASTED ONE AFTERNOON. The page merge gave `display-screen`
                 * a bespoke slider over two registry rows and this pinned that shape;
                 * `ARCHETYPE.SLIDER`, the same day, made the leaf primitive so it has no
                 * bespoke half to measure a seam to. The shape itself is still covered —
                 * `display-screen-saver` and `display-skin` both have it. */
            });
        });

        /* ════════════════════════════════════════════════════════════════════
         * THE RESET TABLE'S NOW COLUMN — the half that was never wired
         * ═══════════════════════════════════════════════════════════════════ */

        describe('Default load settings says what the reset would actually change', () => {
            /* TWO SEPARATE HOLES MADE ONE BLANK COLUMN, and neither was visible from
             * inside this suite until the page was photographed on 26 August 2026.
             *
             * ONE: `settings-leaf-model.load()` read the machine document only when the
             * leaf held a `SOURCE.MACHINE` row. This leaf holds no registry rows at all —
             * it is a table and a button — so no read fired, and on the tablet the column
             * was correct only if the person had opened a machine page first in the same
             * session. `LEAVES_READING_MACHINE_DOC` now names the leaf.
             *
             * TWO: this fixture's bespoke bundle had no `machineValue` key, though the
             * app's own bundle in `settings-model.js` always had one. So even with the
             * read fired the leaf's fallback returned undefined for all eight fields.
             *
             * WHAT IS ASSERTED IS THE COMPARISON, not eight numbers. The table exists to
             * answer "would this change anything", and the fixture's machine differs from
             * the factory values on five of the eight, so a column of dashes and a column
             * of matches are both wrong answers and both fail here. */
            test('every NOW cell reads the machine, and the reset would move five of eight', async () => {
                await show('calibration', 'calibration-default-load-settings');
                const table = await page.evalFn(() => {
                    const root = window.__settings.bespokeEl().shadowRoot;
                    return [...root.querySelectorAll('#defaults-list .reset')].map((row) => {
                        const cells = [...row.querySelectorAll('span')].map((c) => c.textContent.trim());
                        return { field: row.dataset.field, now: cells[2], fallback: cells[3] };
                    });
                });

                assert.equal(table.length, 8, 'eight settings move, and each one is a line');
                const dashes = table.filter((row) => row.now === '\u2014' || row.now === '\u2013' || row.now === '');
                assert.deepEqual(dashes, [], 'a NOW cell that dashes means the machine was never read');

                const fan = table.find((row) => row.field === 'fan');
                assert.equal(fan.now, '30', 'the fixture machine holds 30');
                assert.equal(fan.fallback, '55', 'and the factory value is 55');

                const moving = table.filter((row) => row.now !== row.fallback);
                assert.equal(moving.length, 5, 'five of the eight differ, so the column earns its place');
            });

            test('a reset repaints THIS page, not just the ones you visit next', async () => {
                /* THE OLD SKIN'S OWN BUG, in the one place it had survived: "Reset-to-
                 * defaults repainted the PRE-reset values under a toast that said it had
                 * worked." The DE1 client invalidates both HTTP caches on a successful
                 * reset, so every other page re-reads on its next visit — but this page
                 * SHOWS the eight, and the settings model holds its own copy of the
                 * document, which invalidating a cache does not touch. The table went on
                 * printing the values from before the reset. */
                await show('calibration', 'calibration-default-load-settings');
                const nowColumn = () => page.evalFn(() => {
                    const root = window.__settings.bespokeEl().shadowRoot;
                    return [...root.querySelectorAll('#defaults-list .reset')].map((row) => {
                        const cells = [...row.querySelectorAll('span')].map((c) => c.textContent.trim());
                        return [row.dataset.field, cells[2]];
                    });
                });
                const before = Object.fromEntries(await nowColumn());
                assert.equal(before.fan, '30', 'the fixture machine is not at the factory value');

                await page.evalFn(async () => {
                    const root = window.__settings.bespokeEl().shadowRoot;
                    root.getElementById('defaults-start').click();
                    await new Promise((r) => requestAnimationFrame(r));
                    const dialog = root.querySelector('ui-confirm-dialog');
                    dialog.dispatchEvent(new CustomEvent('confirm', { bubbles: true, composed: true }));
                    await new Promise((r) => setTimeout(r, 40));
                    return true;
                });
                await page.settle();

                const after = Object.fromEntries(await nowColumn());
                assert.equal(after.fan, '55', 'the NOW column shows what the reset just wrote');
            });

            /* THE PAGE COLUMN MUST NAME A PAGE THIS MACHINE HAS (point 133).
             *
             * `leafFor()` searches the whole tree and applies no machine filter — that is
             * `leavesFor` / `leafShownOn`, which the nav uses and this page did not — so on
             * a Bengle the `flowMultiplier` row printed "Flow Multiplier", a leaf gated
             * `machines: ['de1']` and therefore absent from that machine's own sub-nav. A
             * reset page telling you to go and look at a page you cannot open is a route
             * with no client, and the confirm dialog carried the same dangling name in a
             * hard-coded sentence — the more important of the two places, because it is the
             * last thing read before an irreversible button.
             *
             * THE ROW STAYS AND ONLY ITS WHEREABOUTS GOES. `applySettingsDefaults` writes
             * all eight whatever the machine is, so dropping the line would understate what
             * the button does; the Page cell dashes instead, which is A7 applied to a name.
             *
             * DRIVEN ON BOTH CLASSES, because a filter that hid the name on every machine
             * would pass an assertion written only for the Bengle. */
            test('the Page column and the confirm sentence name only pages this machine has', async () => {
                const survey = () => page.evalFn(async () => {
                    const root = window.__settings.bespokeEl().shadowRoot;
                    const { SETTINGS_TREE, leavesFor } = await import('/src/lib/settings-nav.js');
                    const cls = window.__settings.stores().machineClass();
                    const reachable = new Set(SETTINGS_TREE
                        .flatMap((category) => leavesFor(category, cls))
                        .map((leaf) => leaf.name));
                    const dialog = root.querySelector('ui-confirm-dialog');
                    return {
                        machineClass: cls,
                        pages: [...root.querySelectorAll('#defaults-list .reset')]
                            .map((row) => row.querySelector('span').textContent.trim()),
                        reachable: [...reachable],
                        detail: dialog?.getAttribute('detail') ?? '',
                    };
                });

                await serve(['scaleCalibration']);
                await show('calibration', 'calibration-default-load-settings');
                const bengle = await survey();
                assert.equal(bengle.machineClass, 'bengle', 'the served set says Bengle');

                const named = bengle.pages.filter((name) => name !== '–' && name !== '');
                assert.ok(named.length >= 4, `the column went blank: ${JSON.stringify(bengle.pages)}`);
                for (const name of named) {
                    assert.ok(bengle.reachable.includes(name),
                        `the Page column names "${name}", which this machine's nav does not carry`);
                }
                assert.ok(bengle.pages.includes('–'),
                    'the flow-multiplier row keeps its line and dashes its page');

                /* AND THE PAGE IS REACHABLE WHILE THE ROW IS NOT, WHICH IS THE WHOLE
                 * CONDITION SINCE 27 AUGUST 2026 — the half this assertion exists to catch
                 * changed shape under it, and a pin that did not say so would look like it
                 * was still guarding the old one.
                 *
                 * IT USED TO BE A WHOLE PAGE. `calibration-flow-multiplier` carried
                 * `machines: ['de1']`, so "is the leaf shown here" and "can the person see
                 * this setting" were the same question and asking either answered both.
                 * Then the page was split — two DE1-only rows and
                 * `calibration-flow-multiplier-weight`, which belongs on every machine — so
                 * the leaf is now shown on a Bengle and only the FACTOR row
                 * (`calibration-flow-multiplier-factor`, the row this table's line is about)
                 * carries the gate.
                 *
                 * THE READER DID NOT FOLLOW THE GATE DOWN and this test went red on 27
                 * August: `#defaults` asked `leafShownOn` alone, the leaf said yes, and the
                 * Page cell went back to naming a page that does not contain the setting.
                 * The page opens; the row is not on it. Same dangling reference, one level
                 * lower. Pinned as the pair, because either half alone is satisfiable by the
                 * bug: a leaf that were hidden again would dash the cell for the wrong
                 * reason and pass the assertion above. */
                assert.ok(bengle.reachable.includes('Flow Multiplier'),
                    'the Flow Multiplier PAGE is in a Bengle nav — the gate is on the row now, '
                    + 'so a dash here must not be coming from a hidden leaf');
                assert.doesNotMatch(bengle.detail, /flow multiplier/i,
                    'and the confirm sentence does not send a Bengle to a DE1-only page');
                assert.match(bengle.detail, /goes back to the machine/i,
                    'it is still a sentence, not a bare list');

                /* THE DE1 GETS THE PAGE BACK, which is what proves this is a filter rather
                 * than a deletion. The served set IS the class: `de1handler.dart` emits its
                 * seven Bengle entries inside one `if (de1 is BengleInterface)`, so an EMPTY
                 * array is ReaPrime's own "this is not a Bengle" (`adapters-r.js:555-558`). */
                await serve([]);
                await show('calibration', 'calibration-default-load-settings');
                const de1 = await survey();
                assert.equal(de1.machineClass, 'de1', 'the served set says DE1');
                assert.ok(de1.pages.includes('Flow Multiplier'),
                    'a DE1 has that page, so its name belongs in the column');
                assert.match(de1.detail, /flow multiplier/i,
                    'and in the sentence, from the same derivation');

                /* PUT THE MACHINE BACK. This suite shares one page and the served set is
                 * global to it; a DE1 left here would follow every later case, and the
                 * class decides which leaves exist at all. */
                await serve(['scaleCalibration']);
            });

            /* A CAPTION MAY NOT PROMISE A RESTORE THIS BUTTON DOES NOT MAKE (point 111).
             *
             * THE WEIGHT FLOW MULTIPLIER'S CAPTION SAID THE DEFAULT WAS "left to the
             * Restore button, which knows it". It does not. `RESET_FIELDS` is the eight
             * fields `applySettingsDefaults` writes and neither app-side multiplier is
             * among them — the reset moves the MACHINE's `flowMultiplier`, which is a
             * different number on a different document. There is no `MACHINE_FALLBACKS`
             * entry for either, so the recovery value for both was written down NOWHERE in
             * the skin and no button anywhere restored it. Both captions carry their
             * default in prose now (1.0 s and 0.3 s, ReaPrime's own).
             *
             * THE GUARD IS THE PAIRING, not the wording, so it survives a rewrite: any
             * caption that points a reader at the restore has to name a field this button
             * actually moves. Read in the BROWSER because `RESET_FIELDS` lives in a screen
             * module, and asserted against the RENDERED registry rather than against source
             * text (A8). */
            test('no caption promises a restore this button does not make', async () => {
                const offenders = await page.evalFn(async () => {
                    const [{ RESET_FIELDS }, { SETTINGS_ROWS }] = await Promise.all([
                        import('/src/screens/settings-bespoke-leaf.js'),
                        import('/src/lib/settings-leaves.js'),
                    ]);
                    const restored = new Set(RESET_FIELDS.map((row) => row.field));
                    return SETTINGS_ROWS
                        .filter((row) => /restore button|the restore/i.test(String(row.caption ?? '')))
                        .filter((row) => !restored.has(row.field))
                        .map((row) => `${row.id} (${row.field})`);
                });
                assert.deepEqual(offenders, [],
                    'a caption defers to the Restore button for a field the reset never writes');
            });
        });

        describe('the ten new leaves reach their stores', () => {
            const tags = async () => (await paneReport(page)).bespokeTags;

            /* THE TWO CARDS ARE ONE LIST, AND THE SWITCH IS A REGISTRY ROW (26 Aug 2026).
             *
             * Ben: "the card layout is not like the rest of the settings, needs a
             * rewrite." The sleep POLICY — automatic sleep, and how long — became two
             * ordinary settings rows through `presenceDoorFor`, so they are tested with
             * every other row in the leaves suite. What is left here is the half that
             * genuinely needs a layout: the schedule list.
             *
             * THE WRITE IS STILL ASSERTED, from the other side: the row stages through the
             * door and reaches `presence.userPresenceEnabled` on commit. */
            test('sleep and wake schedules draws its schedule list, and the policy is rows', async () => {
                await serve(['wakeSchedule']);
                await show('machine', 'machine-sleep-wake-schedules');
                const seen = await tags();
                assert.ok(!seen.includes('ui-card'), 'the two cards are gone');

                const rows = await page.evalFn(() => {
                    const leaf = window.__settings.leafEl().shadowRoot;
                    return [...leaf.querySelectorAll('ui-settings-row')].map((row) => row.dataset.row);
                });
                assert.ok(rows.includes('machine-sleep-auto'), 'automatic sleep is a row');
                assert.ok(rows.includes('machine-sleep-after'), 'and so is the interval');

                const wrote = await page.evalFn(async () => {
                    const leaf = window.__settings.leafEl().shadowRoot;
                    const row = leaf.querySelector('ui-settings-row[data-row="machine-sleep-auto"]');
                    row.querySelector('ui-switch').dispatchEvent(new CustomEvent('change', {
                        detail: { checked: false }, bubbles: true, composed: true,
                    }));
                    return true;
                });
                assert.ok(wrote);
                await page.settle();
                await page.evalFn(() => window.__settings.model().commit());
                await page.settle();
                assert.equal(
                    await page.evalFn(() => window.__settings.server().presence.userPresenceEnabled),
                    false,
                );
            });

            test('the sleep-after row is bounded by the one limits table, not a leaf number', async () => {
                await serve(['wakeSchedule']);
                await show('machine', 'machine-sleep-wake-schedules');
                const bounds = await page.evalFn(() => {
                    const leaf = window.__settings.leafEl().shadowRoot;
                    const row = leaf.querySelector('ui-settings-row[data-row="machine-sleep-after"]');
                    const stepper = row.querySelector('ui-stepper');
                    return { min: stepper.min, max: stepper.max, step: stepper.step };
                });
                /* BEN'S BAND (26 Aug 2026): "5 minute steps, 5 to 300 minutes". The floor
                 * used to be 0, which meant "never sleeps by itself" — a second job hidden
                 * in the bottom of a range, and the page has an Automatic sleep switch now
                 * that says it properly. */
                assert.deepEqual(bounds, { min: 5, max: 300, step: 5 });
            });

            /* THE CUP WARMER HAS NO BESPOKE HALF AT ALL SINCE 26 AUGUST 2026, and that
             * is what this test now asserts.
             *
             * Ben asked for Slate's order, for the live mat reading to go, and for the
             * pre-warm to stop being capability-gated. Slate's order is four ordinary
             * settings rows, so a DOOR (`cupWarmerDoorFor`) replaced the hand-drawn
             * section and the four rows went into the registry.
             *
             * THE WRITE IS STILL PROVEN END TO END: the row stages, the band commits, and
             * the fake server's own `cupWarmerPreheat.enabled` moves. That is the claim
             * the old test made through a different control. */
            test('the cup warmer is five registry rows and no bespoke section', async () => {
                await serve(['cupWarmer', 'preheat']);
                await show('accessories', 'accessories-cup-warmer');

                const said = await page.evalFn(() => {
                    const bespoke = window.__settings.bespokeEl();
                    const leaf = window.__settings.leafEl().shadowRoot;
                    return {
                        bespoke: Boolean(bespoke),
                        rows: [...leaf.querySelectorAll('ui-settings-row')].map((row) => row.dataset.row),
                    };
                });
                assert.equal(said.bespoke, false, 'the leaf is not bespoke any more');
                /* FOUR BECAME FIVE, and the fifth is the one this list used to say was
                 * deliberately absent: "Slate's order, and no live mat reading among
                 * them". That was the defect written down as intent. Slate prints the
                 * plate's own temperature as its own row, it is the only question this
                 * page cannot answer from its controls — are the cups warm yet — and
                 * dropping it also hid a wire fault, because the door was reading that
                 * same value and serving it as the SETPOINT. See the two tests above. */
                assert.deepEqual(said.rows, [
                    'accessories-cup-warmer-enabled',
                    'accessories-cup-warmer-target',
                    'accessories-cup-warmer-now',
                    'accessories-cup-warmer-prewarm',
                    'accessories-cup-warmer-prewarm-lead',
                ], "Slate's order, plate reading included");

                await page.evalFn(async () => {
                    const leaf = window.__settings.leafEl().shadowRoot;
                    const row = leaf.querySelector('ui-settings-row[data-row="accessories-cup-warmer-prewarm"]');
                    row.querySelector('ui-switch').dispatchEvent(new CustomEvent('change', {
                        detail: { checked: true }, bubbles: true, composed: true,
                    }));
                    return true;
                });
                await page.settle();
                await page.evalFn(() => window.__settings.model().commit());
                await page.settle();
                assert.equal(await page.evalFn(() => window.__settings.server().cupWarmerPreheat.enabled), true);
            });
        });

        /* ═══════════════════════════════════════════════════════════════════
         * THE KEYPAD ON THIS PANE — Ben, 24 August 2026: "In all settings I
         * cannot seem to open the number pad when chaning a spinners value,
         * tapping the number should always open the number pad modal."
         *
         * THE THIRTY-SEVEN REGISTRY LEAVES ALREADY DID. Their steppers reach the
         * SCREEN's keypad through `leaf-edit`, which the screen answers out of the
         * leaf model. A bespoke stepper is not a model row, so `model.rows(leaf)`
         * never finds it: the four steppers on this pane were the only numbers in
         * the app a tap did not open, and the value cell was not even a button.
         *
         * THE RANGE IS THE ASSERTION THAT MATTERS. A pad that opened unbounded
         * would look right and clamp nothing, so each case reads the hint — the
         * port's own sentence for the declared range — rather than merely
         * `open === true`.
         * ═════════════════════════════════════════════════════════════════ */
        describe('a tap on a bespoke stepper number opens the keypad', () => {
            /** Press the stepper's value cell the way a finger does, and report the pad. */
            const tapNumber = (p, stepperId) => p.evalFn(async (id) => {
                const root = window.__settings.bespokeEl().shadowRoot;
                const stepper = root.getElementById(id);
                if (!stepper) return { found: false };
                const cell = stepper.shadowRoot.querySelector('.value');
                cell.click();
                await new Promise((r) => setTimeout(r, 120));
                const pad = root.getElementById('number-pad');
                await pad.updateComplete;
                return {
                    found: true,
                    cellTag: cell.localName,
                    editable: stepper.editable === true,
                    open: pad.open === true,
                    heading: pad.heading,
                    value: pad.value,
                    unit: pad.unit,
                    ranged: pad.ranged,
                    hint: pad.shadowRoot.getElementById('hint').textContent.trim(),
                };
            }, stepperId);

            /** Shut it again, so the next case starts from a closed pad. */
            const shutPad = (p) => p.evalFn(async () => {
                const el = window.__settings.bespokeEl();
                el._typing = null;
                await el.updateComplete;
                return true;
            });

            /* SLEEP AFTER MOVED TO THE PRIMITIVE HALF (26 Aug 2026) and its keypad comes
             * with it: a REGISTRY row reaches the screen's keypad through `leaf-edit`,
             * which is the path the other thirty-odd steppers have always taken. So the
             * claim this case makes is the same one and the route is the shorter one.
             *
             * IT IS TESTED HERE RATHER THAN MOVED because what is being checked is that
             * the control kept its numpad through the move — a page that quietly lost it
             * would look identical. */
            /* SLEEP AFTER MOVED TO THE PRIMITIVE HALF (26 Aug 2026), so its keypad is the
             * SCREEN's, reached through `leaf-edit` like every other registry stepper —
             * the path this whole describe block exists because the bespoke steppers did
             * NOT have.
             *
             * WHAT IS ASSERTED HERE is what could silently be lost in that move: the value
             * cell must still be a pressable button, and the pad it opens must still be
             * bounded. The pad itself belongs to the screen, and the screen's own suite
             * owns the opening; a second reach into its shadow root from here would be a
             * second answer to a question that is already asked.
             *
             * MEASURED BEFORE THE FIX (24 Aug 2026): the cell was a plain div, so there
             * was nothing to press and nothing in the tab order. */
            test('Sleep after is still an editable, bounded stepper after the move to a row', async () => {
                await serve(['wakeSchedule']);
                await show('machine', 'machine-sleep-wake-schedules');
                const got = await page.evalFn(() => {
                    const leaf = window.__settings.leafEl().shadowRoot;
                    const row = leaf.querySelector('ui-settings-row[data-row="machine-sleep-after"]');
                    const stepper = row?.querySelector('ui-stepper');
                    if (!stepper) return { found: false };
                    const cell = stepper.shadowRoot.getElementById('value');
                    return {
                        found: true,
                        cellTag: cell.localName,
                        editable: stepper.editable === true,
                        min: stepper.min,
                        max: stepper.max,
                        step: stepper.step,
                        unit: stepper.unit,
                    };
                });
                assert.equal(got.found, true, 'the leaf renders the stepper');
                assert.equal(got.cellTag, 'button', 'the value cell is pressable');
                assert.equal(got.editable, true, 'so a tap can open the pad');
                /* BEN'S BAND, through the one limits table: 5 to 300 in fives. */
                assert.deepEqual({ min: got.min, max: got.max, step: got.step },
                    { min: 5, max: 300, step: 5 });
                assert.equal(got.unit, 'min');
            });

            test('Calibration weight goes by the MACHINE door, under its served key', async () => {
                await serve(['scaleCalibration']);
                /* A FRESH WALK FIRST. The two booleans the walk holds survive a re-render
                 * and reset on a leaf change, so a test that needs step one goes somewhere
                 * else and comes back — which is what a user does. */
                await show('calibration', 'calibration-hardware');
                await show('calibration', 'calibration-load-cells');
                /* AN IDLE MACHINE FIRST. An earlier case in this file leaves the fake
                 * machine in `error`, where the walk's button is Try again rather than
                 * Start — and a walk that has not been started shows no weight stepper. */
                await page.evalFn(() => window.__settings.calibrationState({
                    step: 'idle', status: 'none', secondsRemaining: 0, subState: 'settling', detectedCell: 'none',
                }).then(() => true));
                await page.settle();
                /* THE STEPPER IS ON THE STEPS THAT WEIGH AND ON NO OTHER (Ben, 26 Aug
                 * 2026), so the walk has to be driven to one of them before there is a
                 * number to tap. Pressing Start opens the walk; a zeroing run that
                 * finishes is the machine's own path to the first latch.
                 *
                 * AND THE SECOND STATE IS `complete`, NOT `idle`, SINCE 27 AUGUST 2026.
                 * The firmware writes `step = Complete` when a zero finishes
                 * (`System.cpp:2455`) and only the abort command writes Idle (`:2350`), so
                 * the pair driven here used to be the abort path and reached step 3 only
                 * because the leaf read the same transition backwards. Both were corrected
                 * together; the load-cell walk's own suite carries the derivation. */
                await page.evalFn(() => window.__settings.pressWizard());
                await page.settle();
                for (const state of [
                    { step: 'zeroing', status: 'none', secondsRemaining: 5, subState: 'settling', detectedCell: 'none' },
                    { step: 'complete', status: 'none', secondsRemaining: 0, subState: 'done', detectedCell: 'none' },
                ]) {
                    await page.evalFn((s) => window.__settings.calibrationState(s).then(() => true), state);
                    await page.settle();
                }
                const stage = await page.evalFn(() => {
                    const root = document.querySelector('settings-screen').shadowRoot
                        .getElementById('bespoke').shadowRoot;
                    return {
                        current: Number(root.getElementById('wizard').getAttribute('current')),
                        button: root.getElementById('cal-primary').textContent.trim(),
                        stepper: Boolean(root.getElementById('cal-weight')),
                    };
                });
                assert.equal(stage.current, 3, `the walk did not reach a weighing step: ${JSON.stringify(stage)}`);
                const got = await tapNumber(page, 'cal-weight');
                assert.equal(got.found, true);
                assert.equal(got.open, true);
                assert.equal(got.heading, 'Calibration weight');
                assert.equal(got.ranged, true,
                    'the range is a machine limit and it arrives through `limits`, not '
                    + 'through the leaf\'s own app-side table — two doors, one per field');
                await shutPad(page);
            });

            /* PRE-WARM LEAD MOVED TO THE PRIMITIVE HALF TOO, on the same day and for the
             * same reason. Its band moved with it, and NARROWED: the server clamps
             * `leadMinutes` to 0..120 (`bengle_interface.dart:49`) and Ben set the control
             * to 5..60 in fives — "5 minute steps, 5 to 60". A narrower band inside the
             * served clamp is a skin choosing what is useful, not a skin disagreeing with
             * the machine, and the pad can no longer offer a number the transport would
             * rewrite.
             *
             * THE TYPED PATH IS THE ROW'S PATH NOW. A registry stepper's confirm goes
             * through the leaf model, stages, and reaches the machine on the band's Save —
             * which is asserted end to end in the cup-warmer case above. */
            test('Pre-warm lead is a bounded row inside the served clamp', async () => {
                await serve(['cupWarmer', 'preheat']);
                await show('accessories', 'accessories-cup-warmer');
                const got = await page.evalFn(() => {
                    const leaf = window.__settings.leafEl().shadowRoot;
                    const row = leaf.querySelector('ui-settings-row[data-row="accessories-cup-warmer-prewarm-lead"]');
                    const stepper = row?.querySelector('ui-stepper');
                    if (!stepper) return { found: false };
                    return {
                        found: true,
                        editable: stepper.editable === true,
                        cellTag: stepper.shadowRoot.getElementById('value').localName,
                        min: stepper.min,
                        max: stepper.max,
                        step: stepper.step,
                        unit: stepper.unit,
                    };
                });
                assert.equal(got.found, true);
                assert.equal(got.editable, true);
                assert.equal(got.cellTag, 'button');
                assert.deepEqual({ min: got.min, max: got.max, step: got.step },
                    { min: 5, max: 60, step: 5 });
                assert.ok(got.min >= 0 && got.max <= 120,
                    'inside bengle_interface.dart:49, which clamps leadMinutes to 0..120');
                assert.equal(got.unit, 'min');
            });
        });

        /* ════════════════════════════════════════════════════════════════════
         * MAINTENANCE — the two pages that ask the machine to do something
         *
         * NEITHER LEAF WAS MOUNTED BY ANY TEST IN THIS TREE until 27 August 2026, and the
         * fixture had recorded every state request the whole time (`stateRequests`) with
         * nothing in `test/` reading it — the harness half built and the assertion half
         * missing, which is the shape this fork exists to remove. Four defects were
         * sitting behind that gap and all four are pinned here:
         *
         *   the CHECKLIST     Transport step 3 said "Empty the drip tray." and step 4 then
         *                     asked for the steam wand to point into it. The purge
         *                     discharges into the tray, so it has to go back.
         *   the REFUSAL       was drawn on STATUS alone, and both pages share one store,
         *                     so a refused purge printed a refusal on the Descaling page
         *                     for a descale nobody had attempted.
         *   the SILENCE       pressing Start changed nothing on screen. The store publishes
         *                     five statuses and only the refusal branch read any of them.
         *   the PRECONDITION  a `needsWater` machine refuses the purge outright, and this
         *                     page's own step 1 tells the reader to empty the tank.
         *
         * ORDER MATTERS IN ONE PLACE and it is stated rather than assumed: the "never
         * entered" case runs FIRST, because the seen-it-run latch is a reading of the
         * machine and deliberately survives a leaf change (see the leaf's `updated`).
         * ═══════════════════════════════════════════════════════════════════ */

        /* ONE MACHINE-STATE STORE, AND IT WAS BUILT TWICE.
         *
         * `app-boot.js` hoists a machine-state store for the shell — the screensaver's wake
         * runs through it, with the injected clock — and `settings-model.js` constructed a
         * SECOND one over the same transport and the same route, which is precisely what
         * `machine-state-store.js`'s own header refuses: "ONE OWNER, AND IT IS NOT A
         * SCREEN." Two instances are two private records of what the machine was last asked
         * for, stamped from two clocks, so a wake refused from the screensaver was invisible
         * to the maintenance pages and a descale refused there was invisible to the shell.
         *
         * THIS IS A RENDER TEST BECAUSE OF THE IMPORTMAP, not because of a box.
         * `settings-model.js` addresses its imports as `src/...`, which resolves in the page
         * and not under node — so the composition root is only reachable from here. */
        describe('the settings bundle takes the shell’s machine-state store', () => {
            const bundleFor = (extra) => page.evalFn(async (withShell) => {
                const model = await import('/src/screens/settings-model.js');
                const { createStorageRouter } = await import('/src/lib/storage-router.js');
                const { createMemoryBackend } = await import('/src/lib/storage-backends.js');
                const { LAYERS } = await import('/src/lib/storage-routes.js');
                const storage = createStorageRouter({
                    backends: {
                        [LAYERS.local]: createMemoryBackend(),
                        [LAYERS.session]: createMemoryBackend(),
                        [LAYERS.kv]: createMemoryBackend(),
                        [LAYERS.kvNumpad]: createMemoryBackend(),
                    },
                });
                const transport = {
                    socketUrl: () => 'ws://probe',
                    url: (path) => `http://probe${path}`,
                    onWrite: () => () => {},
                    async request() { return { ok: false, status: 503 }; },
                };
                /* A MARKED STORE, so identity is provable across the page boundary — an
                 * object cannot be compared by reference through `evalFn`'s serialisation. */
                const shellStore = {
                    marker: 'the shell built this one',
                    subscribe: () => () => {},
                    get: () => null,
                    request: async () => null,
                };
                const boot = withShell
                    ? { storage, transport, machineState: shellStore }
                    : { storage, transport };
                const bundle = model.settingsBespokeFor(boot);
                return {
                    marker: bundle?.machineState?.marker ?? null,
                    built: Boolean(bundle?.machineState),
                    /* AND THE FEED IS IN THE BUNDLE, which is the other half of this wiring:
                     * a boot with no live stores gets null and the maintenance pages report
                     * the request alone. */
                    hasFeedKey: bundle ? Object.hasOwn(bundle, 'machineFeed') : false,
                    feed: bundle?.machineFeed ?? null,
                };
            }, extra);

            test('a boot that carries one is not given a second', async () => {
                const got = await bundleFor(true);
                assert.equal(got.marker, 'the shell built this one',
                    'a second construction is a second place deciding what a state request is');
                assert.equal(got.hasFeedKey, true, 'the machine feed travels in the same bundle');
                assert.equal(got.feed, null, 'and a boot with no live stores honestly has none');
            });

            test('a hand-assembled boot still gets one to work with', async () => {
                const got = await bundleFor(false);
                assert.equal(got.built, true,
                    'a fixture or a gallery page has no shell store to take, and no other reader to disagree with');
                assert.equal(got.marker, null);
            });
        });

        describe('the maintenance pages state their preconditions and report what happened', () => {
            /** The section's checklist, as text, for one procedure. */
            const stepsOf = (procedure) => page.evalFn((id) => {
                const root = window.__settings.bespokeEl().shadowRoot;
                return [...root.querySelectorAll(`#${id} .steps li`)].map((li) => li.textContent.trim());
            }, procedure);

            /** What the section says under the checklist, and whether Start is live. */
            const reportOf = (procedure) => page.evalFn((id) => {
                const root = window.__settings.bespokeEl().shadowRoot;
                const text = (el) => (el ? el.textContent.trim() : null);
                const start = root.getElementById(`${id}-start`);
                return {
                    status: text(root.getElementById(`${id}-status`)),
                    blocked: text(root.getElementById(`${id}-blocked`)),
                    refusal: text(root.getElementById(`${id}-refusal`)),
                    startDisabled: start ? start.disabled === true : null,
                };
            }, procedure);

            /** Press Start and confirm, the way a finger does. */
            const startProcedure = async (procedure) => {
                await page.evalFn(async (id) => {
                    const root = window.__settings.bespokeEl().shadowRoot;
                    root.getElementById(`${id}-start`).click();
                    await new Promise((r) => setTimeout(r, 0));
                    root.getElementById(`${id}-confirm`)
                        .dispatchEvent(new CustomEvent('confirm', { bubbles: true, composed: true }));
                    await new Promise((r) => setTimeout(r, 40));
                    return true;
                }, procedure);
                await page.settle();
            };

            /** Say what the MACHINE reports, through the feed the leaf subscribes to. */
            const machineIs = async (state) => {
                await page.evalFn((s) => window.__settings.machineState(s).then(() => true), state);
                await page.settle();
            };

            /* A LEAF CHANGE AND BACK. Selecting the leaf that is already selected changes
             * no property, so nothing re-renders and no per-page draft resets — which is
             * what a user leaving the page and returning actually does. */
            const revisit = async (leafId) => {
                await show('maintenance', leafId === 'maintenance-transport-mode'
                    ? 'maintenance-machine-descaling' : 'maintenance-transport-mode');
                await show('maintenance', leafId);
            };

            const stateRequestsSince = async (before) => {
                const now = await page.evalFn(() => window.__settings.server().stateRequests);
                return now.slice(before.length);
            };

            test('a machine that never purged is not told it has finished one', async () => {
                await machineIs('idle');
                await show('maintenance', 'maintenance-transport-mode');
                const report = await reportOf('air-purge');
                assert.equal(report.status, null,
                    'a page nobody pressed, over a machine that has done nothing, says nothing');
                assert.equal(report.refusal, null);
                assert.equal(report.blocked, null);
            });

            test('Transport Mode never asks for a tray a previous step removed', async () => {
                await show('maintenance', 'maintenance-transport-mode');
                const li = await stepsOf('air-purge');
                assert.equal(li.length, 4, `four preparation steps, got ${JSON.stringify(li)}`);
                assert.match(li[0], /water tank/i);
                assert.match(li[1], /portafilter/i);
                /* THE FIX. Step 4 points the steam wand into the tray, so step 3 must put
                 * the tray back — and the purge discharges into it either way. */
                assert.match(li[2], /drip tray/i);
                assert.match(li[2], /put it back/i);
                assert.match(li[3], /steam wand/i);
                assert.match(li[3], /tray/i);
            });

            /* THE CONFIRMATION SAYS SOMETHING DIFFERENT ON EACH PAGE, AND THAT IS THE
             * POINT (27 August 2026).
             *
             * ONE SHARED BODY USED TO READ "This cannot be stopped once it has started."
             * under BOTH questions. Descaling can cite that sentence — Slate's own comment
             * at settings.js:975-977 says a descale cannot be interrupted and there is no
             * undo halfway through one. NOTHING corroborates it for an air purge: Slate's
             * transport dialog carries no such claim (its whole body is "Prepare your
             * espresso machine for transport") and its own watcher describes a purge that
             * simply ENDS. The skin was asserting a fact about the machine it could not
             * cite, in the one place a person decides whether to press.
             *
             * WHAT THE PURGE SAYS INSTEAD IS CORROBORATED BY THE PAGE'S OWN COMPLETION
             * SENTENCE — "You can turn your machine off once it is out of water" — so the
             * before and the after agree about the same fact.
             *
             * AND IT MUST NOT MERELY BE A DIFFERENT SENTENCE: the assertion below is that
             * the irreversibility claim is ABSENT from the purge, not just reworded. */
            const confirmDetail = (procedure) => page.evalFn((id) => {
                const root = window.__settings.bespokeEl().shadowRoot;
                const dialog = root.getElementById(`${id}-confirm`);
                return {
                    attribute: dialog ? dialog.getAttribute('detail') : null,
                    /* WHAT THE READER ACTUALLY SEES. The attribute could carry a sentence
                     * the dialog never draws; #detail is the paragraph in its shadow root. */
                    rendered: dialog?.shadowRoot?.getElementById('detail')?.textContent?.trim() ?? null,
                };
            }, procedure);

            test('Descaling keeps the irreversibility warning, which is the one page that can cite it', async () => {
                await show('maintenance', 'maintenance-machine-descaling');
                const detail = await confirmDetail('descale');
                assert.match(detail.attribute, /cannot be stopped once it has started/i);
                assert.equal(detail.rendered, detail.attribute,
                    'the dialog must draw the sentence, not merely carry it');
            });

            test('the air purge makes no claim about being unstoppable, and says what is true instead', async () => {
                await show('maintenance', 'maintenance-transport-mode');
                const detail = await confirmDetail('air-purge');
                assert.doesNotMatch(detail.attribute, /cannot be stopped/i,
                    'nothing anywhere corroborates an irreversible air purge — not Slate, not the handler, '
                    + 'not the machine feed. A shared confirmation body is how the claim got here.');
                assert.doesNotMatch(detail.attribute, /interrupt/i);
                assert.match(detail.attribute, /empty of water/i,
                    'what replaces it is the fact the page\'s own completion sentence also reports');
                assert.equal(detail.rendered, detail.attribute);
            });

            /* AND NO STOP CONTROL, WHICH IS A DELIBERATE ABSENCE RATHER THAN AN OVERSIGHT.
             * Ben has not answered whether a purge can be stopped by asking for idle, or
             * whether the machine needs priming afterwards. `PUT /machine/state/idle` is a
             * route this skin already owns and `idle` sits beside `airPurge` in
             * MachineState, so a stop is SPELLABLE — which is exactly why the absence needs
             * pinning: the easy thing to do is add the button and find out. This test fails
             * the day somebody does, and the comment is why they should ask first. */
            test('neither maintenance page offers a stop, because nobody has said one works', async () => {
                for (const [leaf, procedure] of [
                    ['maintenance-machine-descaling', 'descale'],
                    ['maintenance-transport-mode', 'air-purge'],
                ]) {
                    await show('maintenance', leaf);
                    const controls = await page.evalFn((id) => {
                        const root = window.__settings.bespokeEl().shadowRoot;
                        const section = root.getElementById(id);
                        return [...section.querySelectorAll('ui-button, ui-stop-button')]
                            .map((el) => el.textContent.trim());
                    }, procedure);
                    assert.deepEqual(controls, ['Start'],
                        `${leaf} offers ${JSON.stringify(controls)} — a stop control here would be the other `
                        + 'half of an answer nobody has given');
                }
            });

            test('Descaling names its four steps, the tray among them', async () => {
                await show('maintenance', 'maintenance-machine-descaling');
                const li = await stepsOf('descale');
                assert.equal(li.length, 4, `four preparation steps, got ${JSON.stringify(li)}`);
                assert.match(li[0], /descaling solution/i);
                assert.match(li[2], /put it back/i);
            });

            /* THE WARNING MUST NOT BE THE QUIETEST TEXT ON THE PAGE (row 146). The steps
             * were `.ui-body` — full ink at `--ui-text-base` — and the sentence saying the
             * cycle takes twenty minutes and cannot be interrupted was `.ui-caption`, muted
             * and smaller. Slate puts both in its caption role and the inversion goes away.
             *
             * AND THE NUMBERS MUST SURVIVE IT, which is the whole reason the class is on
             * the `<ol>` and not on the `<li>`: `:where(.ui-caption)` sets `display: block`
             * and on a list item that removes the marker. */
            test('the checklist reads at the same weight as the warning, and keeps its numbers', async () => {
                await show('maintenance', 'maintenance-machine-descaling');
                const seen = await page.evalFn(() => {
                    const root = window.__settings.bespokeEl().shadowRoot;
                    const section = root.getElementById('descale');
                    const caption = section.querySelector('p.ui-caption');
                    const item = section.querySelector('.steps li');
                    const of = (el) => {
                        const s = getComputedStyle(el);
                        return { size: s.fontSize, colour: s.color, display: s.display };
                    };
                    return { caption: of(caption), item: of(item), list: of(section.querySelector('.steps')) };
                });
                assert.equal(seen.item.size, seen.caption.size,
                    'a step drawn larger than the irreversibility warning inverts the page');
                assert.equal(seen.item.colour, seen.caption.colour,
                    'and drawn in fuller ink than the warning, it is louder as well as larger');
                assert.equal(seen.item.display, 'list-item',
                    'the caption role sets display:block; on an <li> that takes the numbers away');
                assert.equal(seen.list.display, 'grid',
                    '.steps must still win the display, or the rhythm goes with the numbers');
            });

            test('Start asks the machine for THIS page’s state, and says it has asked', async () => {
                await machineIs(null);
                await revisit('maintenance-transport-mode');
                const before = await page.evalFn(() => window.__settings.server().stateRequests);
                await startProcedure('air-purge');

                assert.deepEqual(await stateRequestsSince(before), ['airPurge'],
                    'the button asks for the state the page is about, once');
                const report = await reportOf('air-purge');
                assert.match(report.status, /asked to start/i,
                    'the page acknowledged the request rather than looking untouched');
                assert.match(report.status, /not reported starting/i,
                    'and it does not claim the machine has started — a 200 is not a state change');
            });

            /* THE RUNNING BANNER AND THE COMPLETION SENTENCE (row 154). Slate raises both
             * and Decal carried both STRINGS with no reader in `src/`. The completion one
             * is the point of the page: someone packing a machine has no other way to know
             * it is safe to switch off. */
            test('the purge reports itself running, and then says it is safe to switch off', async () => {
                await revisit('maintenance-transport-mode');
                await machineIs('airPurge');
                const running = await reportOf('air-purge');
                assert.match(running.status, /removing water/i,
                    'the machine says it is purging and the page repeats it');

                await machineIs('idle');
                const done = await reportOf('air-purge');
                assert.match(done.status, /turn your machine off/i,
                    'the falling edge is the only moment at which finishing is a fact');
                assert.match(done.status, /ready for transport/i);
            });

            test('Descaling reports itself running off the machine, not off the 200', async () => {
                await show('maintenance', 'maintenance-machine-descaling');
                await machineIs('descaling');
                const running = await reportOf('descale');
                assert.match(running.status, /descaling/i);

                await machineIs('idle');
                const done = await reportOf('descale');
                assert.match(done.status, /finished/i);
            });

            /* THE REFUSAL BELONGS TO THE PAGE THAT ASKED (row 142). Both pages read one
             * store, so before this a refused purge printed a refusal on Descaling too. */
            test('a refused purge is reported on Transport Mode and nowhere else', async () => {
                await machineIs(null);
                await page.evalFn(() => window.__settings.failRoute('PUT /machine/state/airPurge'));
                await revisit('maintenance-transport-mode');
                await startProcedure('air-purge');
                /* CLEARED HERE AND NOT AT THE END. `failing` is a fake-server flag that
                 * outlives this test, so an assertion failing below would leave every
                 * later case talking to a server that refuses the purge — which is a
                 * cascade of red tests naming the wrong defect. */
                await page.evalFn(() => window.__settings.failRoute('PUT /machine/state/airPurge', false));

                const purge = await reportOf('air-purge');
                assert.match(purge.refusal, /refused/i, 'the page that asked reports the refusal');

                await show('maintenance', 'maintenance-machine-descaling');
                const descale = await reportOf('descale');
                assert.equal(descale.refusal, null,
                    'a refusal for a request this page never made is worse than silence');
                /* AND THE ACKNOWLEDGEMENT IS ATTRIBUTED THE SAME WAY. Not `status === null`:
                 * this page legitimately carries its OWN completion sentence from the
                 * descaling case above, because the seen-it-run latch is a reading of the
                 * machine and survives a leaf change. What must never appear here is a
                 * sentence about the purge. */
                assert.doesNotMatch(descale.status ?? '', /asked to start/i,
                    'an acknowledgement of a request this page never made is the same defect');
                assert.doesNotMatch(descale.status ?? '', /water/i,
                    'and no sentence about the purge may appear under the Descaling heading');
            });

            /* THE PRECONDITION THIS PAGE’S OWN STEP 1 CREATES (row 152). Slate refuses to
             * open its dialog on `needsWater` and names the firmware quirk; Decal had no
             * guard and a step telling the reader to empty the tank. */
            test('an out-of-water machine blocks Start and says how to override it', async () => {
                await machineIs('needsWater');
                await show('maintenance', 'maintenance-transport-mode');
                const blocked = await reportOf('air-purge');
                assert.equal(blocked.startDisabled, true,
                    'the page must not walk the reader into pressing a button the machine refuses');
                assert.match(blocked.blocked, /out of water/i);
                assert.match(blocked.blocked, /stop button/i,
                    'the remedy is stated, or the block is just another dead end');

                /* AND DESCALING IS NOT GATED THIS WAY. Slate does not gate it and a descale
                 * starts from a full tank; inventing the same quirk here would be this page
                 * asserting a firmware behaviour nobody has observed. */
                await show('maintenance', 'maintenance-machine-descaling');
                const descale = await reportOf('descale');
                assert.equal(descale.startDisabled, false, 'a descale starts from a full tank');
                assert.equal(descale.blocked, null);

                await machineIs('idle');
                await show('maintenance', 'maintenance-transport-mode');
                const live = await reportOf('air-purge');
                assert.equal(live.startDisabled, false, 'and the block lifts when the machine does');

                const before = await page.evalFn(() => window.__settings.server().stateRequests);
                await startProcedure('air-purge');
                assert.deepEqual(await stateRequestsSince(before), ['airPurge'],
                    'a page that is no longer blocked asks for the state it always meant to');
            });
        });

        /* ════════════════════════════════════════════════════════════════════
         * PLUGINS — Open, the blurb, the version, and the Remove that was not one
         * ═══════════════════════════════════════════════════════════════════ */

        describe('a plugin row offers what the manifest declares and nothing else', () => {
            const rowsOf = () => page.evalFn(() => {
                const root = window.__settings.bespokeEl().shadowRoot;
                return [...root.querySelectorAll('.plugin')].map((row) => ({
                    id: row.dataset.plugin,
                    version: row.querySelector('.plugin-title .ui-numeric')?.textContent.trim() ?? null,
                    blurb: row.querySelector('.plugin-blurb')?.textContent ?? null,
                    open: row.querySelectorAll('.plugin-open').length,
                    settings: row.querySelectorAll('.plugin-settings').length,
                    remove: row.querySelectorAll('.plugin-remove').length,
                }));
            });

            /* OPEN IS DECIDED BY THE ENDPOINT NAMED `ui`, and the reason it is not merely
             * an endpoint of type `http` is measurable on the real six: `_handlePluginApiEndpoint`
             * dispatches ANY http endpoint to the plugin, which picks its own Content-Type,
             * so Visualizer's first one (`status`) answers JSON. Reading "first http
             * endpoint" gave four of six rows a button onto raw JSON. */
            test('Open appears on the row whose manifest declares a `ui` endpoint, and on no other', async () => {
                await show('extensions', 'extensions-plugins');
                const rows = await rowsOf();
                const by = Object.fromEntries(rows.map((r) => [r.id, r]));

                assert.equal(by['settings.reaplugin'].open, 1,
                    'a manifest declaring an endpoint called `ui` has a page this skin can open');
                assert.equal(by['visualizer.reaplugin'].open, 0,
                    'an http endpoint called `status` is a request the plugin answers, not a page');
                assert.equal(by['time-to-ready.reaplugin'].open, 0,
                    'a websocket is not a page either');
            });

            /* THE GEAR, AND THE HOLE IT FILLS. Ben, 30 August 2026: "the settings,
             * plugin, seems to miss anything that allows me to open the settings for it?
             * Might be the case for all plugins?" It was, for every one of them. A row
             * carried an enable switch and an Open button that appears only for a plugin
             * declaring a `ui` page, and nothing ever called `settingFields` — which had
             * been in the store the whole time with exactly one caller, the hand-built
             * Visualizer leaf. A plugin with settings and no page could not be configured
             * at all.
             *
             * THE THREE ROWS THIS STAGE SERVES MAKE THE DISTINCTION EXACTLY: Visualizer
             * declares settings and no `ui` page; Settings Viewer declares a page and an
             * EMPTY settings map; Time To Ready declares neither. So a gear that tracked
             * "has a page", or one that appeared on every row, fails here. */
            test('the gear appears only where there is something to configure', async () => {
                await show('extensions', 'extensions-plugins');
                const rows = await rowsOf();
                const by = Object.fromEntries(rows.map((r) => [r.id, r]));

                assert.equal(by['visualizer.reaplugin'].settings, 1,
                    'it declares four settings, so there is a form to open');
                assert.equal(by['visualizer.reaplugin'].open, 0,
                    'and no `ui` page — the case that had no way in at all');

                assert.equal(by['settings.reaplugin'].settings, 0,
                    'an EMPTY settings map is nothing to configure; a gear onto it would do nothing');
                assert.equal(by['settings.reaplugin'].open, 1,
                    'it has a page, which is a different affordance and stays');

                assert.equal(by['time-to-ready.reaplugin'].settings, 0);
            });

            test('the gear opens THAT plugin’s generated form, and closing clears it', async () => {
                await show('extensions', 'extensions-plugins');
                const opened = await page.evalFn(async () => {
                    const el = window.__settings.bespokeEl();
                    el.shadowRoot
                        .querySelector('.plugin[data-plugin="visualizer.reaplugin"] .plugin-settings')
                        .click();
                    await new Promise((r) => setTimeout(r, 80));
                    const dialog = el.shadowRoot.querySelector('#plugin-settings-dialog');
                    return {
                        open: !!dialog,
                        forWhich: el._pluginSettingsFor ?? null,
                        heading: dialog?.getAttribute('heading') ?? null,
                    };
                });
                assert.equal(opened.open, true, 'the gear opens a dialog');
                assert.equal(opened.forWhich, 'visualizer.reaplugin',
                    'and it is that plugin’s, not the one the Visualizer leaf hard-codes');

                const closed = await page.evalFn(async () => {
                    const el = window.__settings.bespokeEl();
                    el.shadowRoot.querySelector('#plugin-settings-dialog')
                        .dispatchEvent(new CustomEvent('open-change', { detail: { open: false } }));
                    await new Promise((r) => setTimeout(r, 60));
                    return {
                        forWhich: el._pluginSettingsFor,
                        dialog: !!el.shadowRoot.querySelector('#plugin-settings-dialog'),
                    };
                });
                assert.equal(closed.forWhich, null, 'closing clears the selection');
                assert.equal(closed.dialog, false, 'and takes the dialog with it');
            });

            test('Open navigates to the plugin’s own page, with no query string of ours', async () => {
                await show('extensions', 'extensions-plugins');
                const opened = await page.evalFn(async () => {
                    const calls = [];
                    const real = window.open;
                    window.open = (...args) => { calls.push(args); return { closed: false }; };
                    try {
                        const root = window.__settings.bespokeEl().shadowRoot;
                        root.querySelector('.plugin[data-plugin="settings.reaplugin"] .plugin-open').click();
                        await new Promise((r) => setTimeout(r, 20));
                    } finally {
                        window.open = real;
                    }
                    return calls;
                });
                assert.equal(opened.length, 1, 'one press, one navigation');
                const [url, target, features] = opened[0];
                assert.match(url, /\/plugins\/settings\.reaplugin\/ui$/,
                    'the path is the generated table’s, and carries no query of this skin’s '
                    + '— `?layout=baseline` would override a setting the plugin owns');
                assert.equal(target, '_blank');
                assert.match(String(features), /noopener/,
                    'a same-window navigation strands the user on a kiosk with no back control');
            });

            /* A WEBVIEW THAT REFUSES TO OPEN A WINDOW RETURNS NULL AND DOES NOT THROW, so a
             * try/catch around the call caught nothing and the press was silent. */
            test('a refused navigation is reported rather than swallowed', async () => {
                await show('extensions', 'extensions-plugins');
                const said = await page.evalFn(async () => {
                    const real = window.open;
                    window.open = () => null;
                    try {
                        const root = window.__settings.bespokeEl().shadowRoot;
                        root.querySelector('.plugin[data-plugin="settings.reaplugin"] .plugin-open').click();
                        await new Promise((r) => setTimeout(r, 20));
                        return root.getElementById('plugin-open-failed')?.textContent.trim() ?? null;
                    } finally {
                        window.open = real;
                    }
                });
                assert.match(said ?? '', /could not be opened/i);
            });

            /* THE BLURB IS THE SENTENCE, NOT THE ADDRESS. Two of the bundled six end their
             * description with a raw localhost URL; on a kiosk with no address bar it is
             * unreachable, and on THIS page it is a second, worse copy of the Open button
             * one cell to the right. */
            test('the description drops the plugin’s own URL and keeps the sentence', async () => {
                await show('extensions', 'extensions-plugins');
                const rows = await rowsOf();
                const blurb = rows.find((r) => r.id === 'settings.reaplugin').blurb;
                assert.equal(blurb, 'Displays settings.',
                    'the URL goes, the sentence stays, and no trailing space is left behind');
                assert.doesNotMatch(blurb, /http/i);
                for (const row of rows) {
                    assert.doesNotMatch(row.blurb ?? '', /https?:/i,
                        `${row.id} still prints an address in the one line that says what it does`);
                }
            });

            /* `version` IS FREE-FORM MANIFEST TEXT and the row wrote `v${version}` outright,
             * so a manifest that already spells its own v rendered "vv2.0.0". */
            test('the version carries exactly one v, whichever way the manifest spells it', async () => {
                await show('extensions', 'extensions-plugins');
                const rows = await rowsOf();
                const by = Object.fromEntries(rows.map((r) => [r.id, r]));
                assert.equal(by['visualizer.reaplugin'].version, 'v1.5.5', 'a bare number gains one');
                assert.equal(by['settings.reaplugin'].version, 'v2.0.0', 'and a spelled one gains none');
                for (const row of rows) {
                    assert.doesNotMatch(row.version ?? '', /^vv/i, `${row.id} renders a doubled v`);
                }
            });

            /* NO REMOVE, AND IT IS A MEASUREMENT RATHER THAN A CLAIM (row 226). The
             * confirmation said the plugin could never come back; on the pin's bundled six
             * that is false — `_copyBundledPlugins()` restores every one of them at the
             * next app start with auto-load set true again — so what Remove actually did
             * was wipe the plugin's stored settings and its SECURE settings, the Visualizer
             * password among them. The fixture would notice a DELETE. */
            test('no row offers Remove, and no DELETE ever reaches the machine', async () => {
                await show('extensions', 'extensions-plugins');
                const rows = await rowsOf();
                assert.ok(rows.length >= 3, `the list must render, got ${rows.length} rows`);
                for (const row of rows) {
                    assert.equal(row.remove, 0,
                        `${row.id} offers a Remove whose stated consequence is false for a bundled plugin`);
                }
                const deleted = await page.evalFn(() => window.__settings.server().pluginDeletes);
                assert.deepEqual(deleted, [],
                    'the switch is what stops a plugin doing things; deleting one wipes its password '
                    + 'and hands it back at the next boot');
            });

            /* AND THE SWITCH STILL REACHES THE MACHINE, which is the half that must survive
             * the removal: dropping Remove is only defensible because disable does the work. */
            test('the switch is the control that stops a plugin, and it reaches the server', async () => {
                await show('extensions', 'extensions-plugins');
                await page.evalFn(async () => {
                    const root = window.__settings.bespokeEl().shadowRoot;
                    const row = root.querySelector('.plugin[data-plugin="visualizer.reaplugin"]');
                    row.querySelector('ui-switch')
                        .dispatchEvent(new CustomEvent('change', {
                            detail: { checked: false }, bubbles: true, composed: true,
                        }));
                    await new Promise((r) => setTimeout(r, 40));
                    return true;
                });
                await page.settle();
                const served = await page.evalFn(() => window.__settings.server().plugins);
                const visualizer = served.find((p) => p.id === 'visualizer.reaplugin');
                assert.equal(visualizer.autoLoad, false, 'the machine was told to stop loading it');
            });

            /* ═══════════════════════════════════════════════════════════════
             * F-045 — A NUMERIC PLUGIN SETTING OPENED A TEXT KEYBOARD
             *
             * Measured on the tablet: a plugin setting declared `type: "number"` rendered
             * through #26 with no `inputmode`, so the panel offered QWERTY for a
             * digits-only field. The posted value was always correct — this is a keyboard
             * fault, and the only place it can be seen is on the inner input.
             *
             * THE INNER INPUT IS `type="text"` AND THAT IS DELIBERATE. #26's `TEXT_TYPES`
             * excludes `number` on purpose ("`number` belongs to the stepper (#4)"), so
             * the declared type falls back to `text` — which is why the assertions below
             * key off the MANIFEST's declared type rather than the rendered one, and why
             * `inputmode` is the only lever there is.
             *
             * The Visualizer manifest declares six settings and two of them are numbers
             * (`LengthThreshold`, `BackSyncIntervalSeconds`), so the case is driven rather
             * than constructed here.
             * ═════════════════════════════════════════════════════════════ */
            const pluginInputs = () => page.evalFn(() => {
                const root = window.__settings.bespokeEl().shadowRoot;
                /* THE MANIFEST AS THE LEAF SEES IT — through the same store the leaf
                 * reads. `server()`'s plugin snapshot carries only id and autoLoad. */
                const bespoke = window.__settings.bespokeEl();
                const declared = bespoke?.deps?.plugins
                    ?.plugin?.('visualizer.reaplugin')?.settings ?? {};
                return [...root.querySelectorAll('#plugin-settings .form-row')].map((row) => {
                    const key = row.dataset.field;
                    const field = row.querySelector('ui-text-field');
                    const input = field?.shadowRoot?.getElementById('control') ?? null;
                    return {
                        key,
                        declared: declared[key]?.type ?? null,
                        secure: declared[key]?.secure === true,
                        control: row.dataset.control,
                        renderedType: input?.getAttribute('type') ?? null,
                        inputmode: input?.getAttribute('inputmode') ?? null,
                        pattern: input?.getAttribute('pattern') ?? null,
                        invalid: input?.getAttribute('aria-invalid') ?? null,
                    };
                });
            });

            test('F-045: a number field asks for the decimal keyboard, on the input itself', async () => {
                await show('extensions', 'extensions-visualizer');
                const fields = await pluginInputs();
                assert.ok(fields.length > 0, 'the Visualizer form must render its settings');

                const numbers = fields.filter((f) => f.declared === 'number');
                assert.ok(numbers.length >= 2,
                    `the manifest declares two numeric settings, found ${numbers.length}`);
                for (const field of numbers) {
                    assert.equal(field.inputmode, 'decimal',
                        `${field.key} is a digits-only field and offered QWERTY`);
                    /* SPELLED OUT so a later reader does not "fix" this by adding `number`
                     * to #26's TEXT_TYPES: the rendered type is `text` BY DESIGN, and the
                     * keyboard therefore hangs entirely on the attribute above. */
                    assert.equal(field.renderedType, 'text',
                        '#26 refuses type=number on purpose — inputmode is the whole lever');
                }
            });

            test('F-045: and nothing else on the form gains one', async () => {
                await show('extensions', 'extensions-visualizer');
                const fields = await pluginInputs();
                const others = fields.filter((f) => f.declared !== 'number' && f.control === 'field');
                assert.ok(others.length >= 2, 'the form must carry non-numeric fields too');
                for (const field of others) {
                    assert.equal(field.inputmode, null,
                        `${field.key} is not a number and must keep the default keyboard`);
                }
                /* A SECURE FIELD IS A PASSWORD BOX. Even were one declared `number`, a
                 * decimal keypad on a password is a hint about the secret's shape. */
                for (const field of fields.filter((f) => f.secure)) {
                    assert.equal(field.renderedType, 'password');
                    assert.equal(field.inputmode, null);
                }
                /* NO `pattern`, and its absence is deliberate: on a `text` input a pattern
                 * engages `:invalid`, and #26 mirrors validity onto `aria-invalid` — so a
                 * half-typed number would announce itself as wrong while it was still
                 * being typed. Both halves asserted, because the second is the harm. */
                for (const field of fields) {
                    assert.equal(field.pattern, null);
                    assert.equal(field.invalid, null);
                }
            });
        });

        /* ═══════════════════════════════════════════════════════════════════
         * F-035 — "Check for updates" DID NOTHING AND SAID NOTHING
         *
         * The audit measured four zeros on this press: no request of any kind in the whole
         * page log, no storage delta, no console output, and the leaf text byte-identical
         * before and after. It concluded "nothing is wired to it".
         *
         * THE INVESTIGATION SAYS OTHERWISE, and it is written up in FIXLOG S-7. The route
         * EXISTS at gate-d's pin — `update_handler.dart:10-11` registers `GET
         * /api/v1/update` and `GET /ws/v1/update`, and the socket takes a `check` command —
         * and the skin is wired to it end to end. The command is a WEBSOCKET FRAME, which a
         * request log cannot see; what was actually missing is that `send()`'s refusal was
         * discarded, so a press with the socket down produced no effect AND no word.
         *
         * The harness has no websocket, so `check()` here answers `{ok: false}` — which is
         * precisely the state the audit was in, and precisely what must now be visible.
         * ═══════════════════════════════════════════════════════════════════ */

        describe('F-035: a check that cannot be sent says so', () => {
            const decaid = () => page.evalFn(() => {
                const root = window.__settings.bespokeEl().shadowRoot;
                return {
                    button: root.getElementById('app-check')?.textContent?.trim() ?? null,
                    disabled: root.getElementById('app-check')?.disabled === true,
                    state: root.getElementById('app-update-state')?.textContent?.trim() ?? null,
                    refusal: root.getElementById('app-check-refusal')?.textContent?.trim() ?? null,
                };
            });

            const pressCheck = async () => {
                await page.evalFn(() => {
                    window.__settings.bespokeEl().shadowRoot.getElementById('app-check').click();
                    return true;
                });
                await page.settle(2);
            };

            test('the command DOES reach the channel — the wire was never the problem', async () => {
                /* THE AUDIT'S CONCLUSION WAS "nothing is wired to it", and the route it
                 * would need exists at gate-d's pin (`update_handler.dart:10-11`). This is
                 * the refutation: the press reaches the channel, and the reason a request
                 * log saw four zeros is that the command is a WEBSOCKET FRAME. */
                await show('updates', 'updates-skin-app');
                const before = (await page.evalFn(() => window.__settings.updateCommands())).length;
                await pressCheck();
                const after = await page.evalFn(() => window.__settings.updateCommands());
                assert.equal(after.length, before + 1);
                assert.equal(after[after.length - 1], 'check');
                assert.equal((await decaid()).refusal, null,
                    'a delivered command says nothing — the FRAME is the next word');
            });

            test('a press that cannot be delivered names the reason, on the glass', async () => {
                await show('updates', 'updates-skin-app');
                const before = await decaid();
                assert.equal(before.refusal, null, 'nothing is said before anything is pressed');

                /* THE STATE THE AUDIT WAS ACTUALLY IN: `rea-sockets.js`'s own answer for a
                 * socket that is not open. Stated verbatim rather than as a stand-in. */
                await page.evalFn(() => window.__settings
                    .updateSendRefusal('socket is not open').then(() => true));
                await pressCheck();

                const after = await decaid();
                /* THE MEASUREMENT, INVERTED. The audit recorded `textAfter` byte-identical
                 * to `textBefore`; the page must now differ, and differ by a SENTENCE
                 * naming the reason rather than by a spinner that never resolves. */
                assert.notEqual(after.refusal, null,
                    'a press that cannot be delivered must not be silent');
                assert.match(after.refusal, /update check could not be sent/i);
                assert.match(after.refusal, /socket is not open/,
                    'and it must name WHY, in the channel\'s own words');

                /* AND IT DOES NOT PRETEND. The state line still says the honest thing: no
                 * check was made, so whether a newer build exists is still not known. */
                assert.equal(after.state, before.state);

                /* A LATER SUCCESSFUL PRESS TAKES THE LINE BACK DOWN — a refusal that
                 * outlives its cause is the next reader's wrong diagnosis. */
                await page.evalFn(() => window.__settings.updateSendRefusal(null).then(() => true));
                await pressCheck();
                assert.equal((await decaid()).refusal, null);
            });
        });

        /* ═══════════════════════════════════════════════════════════════════
         * F-043 — ONE TIME, TWO SPELLINGS, ONE PRESS APART
         *
         * Measured on the tablet: the USB-Charger Sleep opener read `23:00` while the
         * dialog it opens read `11:00 PM`; a schedule row read `07:00`, its editor
         * `07:00 AM`. `minutesToTime()` was unconditionally 24-hour, `ui-time-picker`'s
         * readout unconditionally 12-hour, and `clockFormat` — the preference that decides
         * it — was consumed nowhere in settings at all.
         *
         * THE ASSERTION IS AN EQUALITY BETWEEN TWO SURFACES, not against a literal, so it
         * holds in whatever locale the harness runs in; the literals are asserted
         * separately in `wall-clock.test.mjs`, where the language is an argument.
         * ═══════════════════════════════════════════════════════════════════ */

        describe('F-043: a time reads the same on the opener and in the dialog it opens', () => {
            /* The fixture's own night times: 1320 = 22:00 and 420 = 07:00. */
            const pickFormat = async (format) => {
                await show('units-language', 'units-language-units');
                await page.evalFn((f) => window.__settings
                    .change('units-language-time-format', f).then(() => true), format);
                await page.settle();
            };

            const sleepPair = async () => {
                await show('accessories', 'accessories-usb-charger');
                const opener = await page.evalFn(() => window.__settings.bespokeEl()
                    .shadowRoot.getElementById('night-sleep')?.textContent?.trim() ?? null);
                await page.evalFn(() => {
                    window.__settings.bespokeEl().shadowRoot.getElementById('night-sleep').click();
                    return true;
                });
                await page.settle(3);
                const dialog = await page.evalFn(() => {
                    const picker = window.__settings.bespokeEl()
                        .shadowRoot.getElementById('night-picker');
                    return {
                        spoken: picker?.shadowRoot?.getElementById('live')?.textContent?.trim() ?? null,
                        hour: picker?.shadowRoot?.querySelector('.digits')?.textContent?.trim() ?? null,
                        format: picker?.getAttribute('clock-format') ?? null,
                    };
                });
                await page.evalFn(() => {
                    const el = window.__settings.bespokeEl().shadowRoot.getElementById('night-dialog');
                    el?.hide?.('test');
                    return true;
                });
                await page.settle(2);
                return { opener, ...dialog };
            };

            test('24-hour: the opener and the picker both say 22:00', async () => {
                await pickFormat('24h');
                const pair = await sleepPair();
                assert.equal(pair.format, '24h', 'the screen must hand the picker the preference');
                assert.equal(pair.opener, '22:00');
                assert.equal(pair.spoken, pair.opener,
                    'one value, one spelling — this pair read 23:00 and 11:00 PM before');
                assert.equal(pair.hour, '22',
                    'and the hour segment is the 24-hour hour, not the dial\'s 10');
            });

            test('12-hour: both move together, and they move', async () => {
                await pickFormat('12h');
                const pair = await sleepPair();
                assert.equal(pair.format, '12h');
                assert.match(pair.opener, /10:00/, 'the same instant, written the other way');
                assert.match(pair.opener, /PM/i);
                assert.equal(pair.spoken, pair.opener);
                assert.equal(pair.hour, '10', 'the dial\'s own numbering, on its own face');
                /* Put the preference back: this suite shares one page. */
                await pickFormat('24h');
            });

            test('a wake-schedule row reads the same way as its editor', async () => {
                await pickFormat('12h');
                await serve(['wakeSchedule']);
                await show('machine', 'machine-sleep-wake-schedules');
                const rows = await page.evalFn(() => [...window.__settings.bespokeEl()
                    .shadowRoot.querySelectorAll('[data-schedule]')]
                    .map((row) => row.querySelector('.ui-heading')?.textContent?.trim() ?? null));
                if (rows.length > 0) {
                    /* THE ROW USED TO PRINT THE WIRE STRING RAW — "07:00" — beside an
                     * editor that said "07:00 AM". Whatever the served schedule's time is,
                     * the row must now be spelled by the same formatter, which in 12-hour
                     * mode means it carries a day period. */
                    for (const label of rows) {
                        assert.match(String(label), /(AM|PM)/i,
                            `a schedule row still prints the wire string: ${label}`);
                    }
                }
                await pickFormat('24h');
                await serve(null);
            });
        });

        /* ═══════════════════════════════════════════════════════════════════
         * 10. UPDATES AND HELP — the 27 August 2026 pass
         * ═══════════════════════════════════════════════════════════════════
         *
         * EVERY CASE BELOW IS A HALF THAT HAD NO OTHER HALF. A route in the generated
         * table with no caller; a socket attached at boot whose frames were parsed and
         * discarded; a badge variant built for a sentence nobody rendered; a store that
         * threw away the body of its own 201; a refusal sentence made unreachable by the
         * control that was supposed to trigger it. None of them is a layout question, and
         * all of them are only provable by driving the page and reading what came back.
         * ═════════════════════════════════════════════════════════════════ */

        describe('Updates › Skin / App reports what an update run DID', () => {
            const rows = () => page.evalFn(() => {
                const root = window.__settings.bespokeEl().shadowRoot;
                return [...root.querySelectorAll('.update-row')].map((row) => ({
                    id: row.dataset.skin,
                    text: row.textContent.replace(/\s+/g, ' ').trim(),
                    badges: [...row.querySelectorAll('ui-badge[variant="attention"]')]
                        .map((b) => b.textContent.trim()),
                }));
            });
            const outcome = () => page.evalFn(() => window.__settings.bespokeEl()
                .shadowRoot.getElementById('updates-outcome')?.textContent.trim() ?? null);
            const pressUpdate = () => page.evalFn(async () => {
                const root = window.__settings.bespokeEl().shadowRoot;
                root.getElementById('skins-update').click();
                await new Promise((r) => setTimeout(r, 60));
                return true;
            });

            test('a run that installs something names the version it installed', async () => {
                await show('updates', 'updates-skin-app');
                await page.evalFn(() => window.__settings.armSkinUpdate({ decal: '0.1.100' }));
                const before = await rows();
                assert.ok(before.some((row) => row.id === 'decal' && row.text.includes('v0.0.1')),
                    `the fixture serves Decal at v0.0.1: ${JSON.stringify(before)}`);
                assert.deepEqual(before.flatMap((row) => row.badges), [],
                    'nothing has been pressed, so nothing is badged');

                await pressUpdate();
                await page.settle();

                const after = await rows();
                const moved = after.find((row) => row.id === 'decal');
                assert.ok(moved.text.includes('v0.1.100'), `the row still shows the old version: ${moved.text}`);
                /* THE BADGE NAMES THE VERSION THIS MACHINE INSTALLED, which is strictly
                 * more than Slate's can say — Slate's names one it asked GitHub about. */
                assert.equal(moved.badges.length, 1);
                assert.match(moved.badges[0], /0\.1\.100/);
                /* AND ONLY THE ROW THAT MOVED. A badge on a skin nothing happened to
                 * would be exactly the "up to date" badge this store refuses to invent. */
                for (const row of after.filter((r) => r.id !== 'decal')) {
                    assert.deepEqual(row.badges, [], `${row.id} did not move and must not be badged`);
                }
                assert.match(await outcome(), /updated/i);
            });

            test('a run that installs nothing says so, and badges nothing', async () => {
                await show('updates', 'updates-skin-app');
                await page.evalFn(() => window.__settings.armSkinUpdate(null));
                await pressUpdate();
                await page.settle();
                assert.match(await outcome(), /already current/i);
                assert.deepEqual((await rows()).flatMap((row) => row.badges), []);
            });

            test('before any press there is no outcome sentence at all', async () => {
                /* TELLING SOMEBODY WHO HAS PRESSED NOTHING THAT EVERYTHING IS CURRENT is an
                 * assertion nobody checked, which is the thing this whole design avoids. */
                await show('display', 'display-skin');
                await show('updates', 'updates-skin-app');
                assert.equal(await outcome(), null);
            });

            test('the row prints the date the machine recorded, not a word that never changes', async () => {
                /* "Checked" BECOMES CONSTANT the moment the button has been pressed once —
                 * every row says it for ever after — while reaMetadata.lastChecked is a
                 * full ISO timestamp sitting unread in the same record. */
                /* THE LANGUAGE IS PINNED FIRST, and it has to be: the date is written in
                 * the language the SKIN is set to, not the browser's, and an earlier case
                 * in this walk chooses French to prove the picker writes its one key. That
                 * is the correct behaviour of both — so this case states the language it is
                 * asserting the spelling of rather than depending on test order. */
                await page.evalFn(() => window.__settings.stores().settings.set('language', 'en'));
                await show('updates', 'updates-skin-app');
                await page.evalFn(() => window.__settings.skinChecked('NSX-skin', '2026-08-12T05:59:27Z'));
                const nsx = (await rows()).find((row) => row.id === 'NSX-skin');
                assert.match(nsx.text, /12/);
                assert.match(nsx.text, /Aug/);
            });

            test('a record that was never checked says so, and an unreadable stamp shows the dash', async () => {
                await page.evalFn(() => window.__settings.stores().settings.set('language', 'en'));
                await show('updates', 'updates-skin-app');
                await page.evalFn(() => window.__settings.skinChecked('beanie', null));
                const never = (await rows()).find((row) => row.id === 'beanie');
                assert.match(never.text, /Never checked/);

                await page.evalFn(() => window.__settings.skinChecked('beanie', 'nonsense'));
                const unreadable = (await rows()).find((row) => row.id === 'beanie');
                assert.doesNotMatch(unreadable.text, /Checked/,
                    'a string that is not a date must not be dressed up as one');
                assert.match(unreadable.text, /–/, 'an unread value shows the dash (A7)');
            });
        });

        describe('Updates › Skin / App has an App half, which its name was already promising', () => {
            const facts = () => page.evalFn(() => {
                const root = window.__settings.bespokeEl().shadowRoot;
                const list = root.getElementById('app-info');
                if (!list) return null;
                return Object.fromEntries([...list.querySelectorAll('.fact')].map((fact) => [
                    fact.dataset.term,
                    fact.querySelector('dd').textContent.trim(),
                ]));
            });
            const block = () => page.evalFn(() => {
                const root = window.__settings.bespokeEl().shadowRoot;
                const section = root.getElementById('app-info');
                const badge = root.getElementById('app-update-badge');
                const install = root.getElementById('app-install');
                const link = root.getElementById('app-release-notes');
                return {
                    text: section ? section.textContent.replace(/\s+/g, ' ').trim() : null,
                    badge: badge ? { variant: badge.getAttribute('variant'), text: badge.textContent.trim() } : null,
                    install: install ? install.textContent.trim() : null,
                    installDisabled: install ? install.hasAttribute('disabled') : null,
                    link: link ? link.getAttribute('href') : null,
                    checkDisabled: root.getElementById('app-check')?.hasAttribute('disabled') ?? null,
                    progress: root.getElementById('app-update-progress')?.value ?? null,
                };
            });

            test('the served build record is on screen, field by field', async () => {
                await show('updates', 'updates-skin-app');
                await page.evalFn(() => window.__settings.appInfo({}));
                const got = await facts();
                assert.ok(got, 'the Decaid section is not drawn at all');
                assert.match(got['app-version'], /1\.0\.0-bengle\.1/);
                assert.match(got['app-version'], /2259/, 'the build number rides with the version');
                assert.equal(got['app-build'], '1.0.0-bengle.1+2259');
                assert.equal(got['app-branch'], 'port/rea-bench-v2');
                assert.equal(got['app-commit'], 'e3313d84');
                assert.equal(got['app-store'], 'No', 'a served false is an answer, not an absence');
            });

            test('a field the server says it does not know shows the dash, never the word', async () => {
                /* build_info.dart defaults commit, commitShort, branch and buildTime to the
                 * literal string "unknown". Printing that beside "Commit" would dress an
                 * absence up as a reading. */
                await show('updates', 'updates-skin-app');
                await page.evalFn(() => window.__settings.appInfo({ commitShort: 'unknown', branch: 'unknown' }));
                const got = await facts();
                assert.equal(got['app-commit'], '–');
                assert.equal(got['app-branch'], '–');
                assert.match(got['app-version'], /1\.0\.0-bengle\.1/, 'and the fields that ARE known are untouched');
            });

            test('a ReaPrime that cannot serve /info draws dashes and no zeros', async () => {
                await show('updates', 'updates-skin-app');
                await page.evalFn(() => window.__settings.appInfo(null));
                const got = await facts();
                for (const [term, value] of Object.entries(got)) {
                    assert.equal(value, '–', `${term} invented a value for a read that failed`);
                }
                await page.evalFn(() => window.__settings.appInfo({}));
            });

            test('an available update badges itself and offers to install the version it names', async () => {
                await show('updates', 'updates-skin-app');
                await page.evalFn(() => window.__settings.appUpdateFrame({
                    phase: 'available',
                    currentVersion: '0.8.1',
                    latestVersion: 'v0.8.2',
                    releaseNotes: null,
                    releaseUrl: 'https://github.com/decentespresso/decaid/releases/tag/v0.8.2',
                    installable: true,
                    progress: null,
                    error: null,
                }));
                const got = await block();
                assert.ok(got.badge, 'the attention variant was built for exactly this sentence');
                assert.equal(got.badge.variant, 'attention');
                assert.match(got.install, /0\.8\.2/, 'the install control names what it would install');
                assert.match(got.text, /0\.8\.2 is available/);
            });

            test('pressing Install sends the command on the socket the feed is already on', async () => {
                await show('updates', 'updates-skin-app');
                await page.evalFn(() => window.__settings.appUpdateFrame({
                    phase: 'available',
                    currentVersion: '0.8.1',
                    latestVersion: 'v0.8.2',
                    releaseUrl: 'https://example.invalid/r',
                    installable: true,
                }));
                await page.evalFn(async () => {
                    window.__settings.bespokeEl().shadowRoot.getElementById('app-install').click();
                    await new Promise((r) => setTimeout(r, 40));
                    return true;
                });
                const sent = await page.evalFn(() => window.__settings.updateCommands());
                assert.ok(sent.includes('install'), `nothing reached the socket: ${JSON.stringify(sent)}`);
            });

            test('a platform that cannot install in-app is told so, and given the link instead', async () => {
                /* `installable` is ReaPrime's own `_isAndroid && hasUpdate`. The skin never
                 * sniffs the platform to work this out. */
                await show('updates', 'updates-skin-app');
                await page.evalFn(() => window.__settings.appUpdateFrame({
                    phase: 'available',
                    currentVersion: '0.8.1',
                    latestVersion: 'v0.8.2',
                    releaseUrl: 'https://github.com/decentespresso/decaid/releases/tag/v0.8.2',
                    installable: false,
                }));
                const got = await block();
                assert.equal(got.install, null, 'a button that could only answer with an error is not drawn');
                assert.match(got.text, /cannot install updates itself/i);
                assert.equal(got.link, 'https://github.com/decentespresso/decaid/releases/tag/v0.8.2');
            });

            test('release notes are a LINK and never Slate’s pasted markdown', async () => {
                /* SLATE'S DEFECT, NAMED SO IT IS NOT INHERITED: it drops the raw string
                 * into a whitespace-pre-line paragraph, and because the string is
                 * GitHub-flavoured markdown the reader gets a literal "## What's Changed",
                 * "* " bullets and unwrapped pull-request URLs. */
                await show('updates', 'updates-skin-app');
                await page.evalFn(() => window.__settings.appUpdateFrame({
                    phase: 'available',
                    currentVersion: '0.8.1',
                    latestVersion: 'v0.8.2',
                    releaseNotes: '## What\'s Changed\n* fixed a thing by @someone in https://github.com/x/y/pull/1\n',
                    releaseUrl: 'https://example.invalid/release',
                    installable: true,
                }));
                const got = await block();
                assert.equal(got.link, 'https://example.invalid/release');
                assert.doesNotMatch(got.text, /##/, 'the markdown reached the screen unrendered');
                assert.doesNotMatch(got.text, /What's Changed/);

                /* AND NO ANCHOR WHERE NO URL WAS SERVED — no placeholder, nothing at all. */
                await page.evalFn(() => window.__settings.appUpdateFrame({
                    phase: 'available',
                    currentVersion: '0.8.1',
                    latestVersion: 'v0.8.2',
                    releaseNotes: '## What\'s Changed',
                    releaseUrl: null,
                    installable: false,
                }));
                const bare = await block();
                assert.equal(bare.link, null);
                assert.doesNotMatch(bare.text, /What's Changed/);
            });

            test('a null latestVersion is NOT KNOWN, and is never drawn as up to date', async () => {
                await show('updates', 'updates-skin-app');
                await page.evalFn(() => window.__settings.appUpdateFrame({
                    phase: 'idle',
                    currentVersion: '0.8.1',
                    latestVersion: null,
                    releaseUrl: 'https://example.invalid/releases',
                    installable: false,
                }));
                const got = await block();
                assert.match(got.text, /not known/i);
                assert.doesNotMatch(got.text, /up to date|newest build/i);
                assert.equal(got.badge, null);
            });

            test('a download in progress shows the machine’s own fraction and disables Check', async () => {
                await show('updates', 'updates-skin-app');
                await page.evalFn(() => window.__settings.appUpdateFrame({
                    phase: 'downloading',
                    currentVersion: '0.8.1',
                    latestVersion: 'v0.8.2',
                    releaseUrl: 'https://example.invalid/r',
                    installable: true,
                    progress: 0.42,
                }));
                const got = await block();
                assert.equal(got.progress, 0.42, 'the track carries the served fraction, never an interpolation');
                assert.equal(got.checkDisabled, true);
                await page.evalFn(() => window.__settings.appUpdateFrame(null));
            });
        });

        describe('the firmware page names the build it would write', () => {
            const firmware = () => page.evalFn(() => {
                const root = window.__settings.bespokeEl().shadowRoot;
                const button = root.getElementById('firmware-latest');
                const newest = root.querySelector('.fact[data-term="newest"] dd');
                const note = root.getElementById('firmware-note');
                const actions = root.querySelector('.device-actions');
                const dialog = root.getElementById('firmware-confirm');
                const noteStyle = note ? getComputedStyle(note) : null;
                return {
                    button: button ? button.textContent.trim() : null,
                    newest: newest ? newest.textContent.trim() : null,
                    note: note ? note.textContent.replace(/\s+/g, ' ').trim() : null,
                    /* DOCUMENT_POSITION_FOLLOWING is 4: the note comes BEFORE the actions. */
                    noteBeforeActions: note && actions
                        ? Boolean(note.compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING)
                        : null,
                    noteBorder: noteStyle ? noteStyle.borderInlineStartWidth : null,
                    noteBackground: noteStyle ? noteStyle.backgroundColor : null,
                    question: dialog ? dialog.getAttribute('question') : null,
                    detail: dialog ? dialog.getAttribute('detail') : null,
                };
            });

            test('the Latest button, the fact row and the confirmation all name the same build', async () => {
                await show('updates', 'updates-firmware-update');
                await page.evalFn(() => window.__settings.firmwareCatalog({
                    machine: { build: 336, model: 'Bengle' },
                    artifacts: [
                        { id: 'de1-336', build: 336, versionLabel: 'v336' },
                        { id: 'de1-340', build: 340, versionLabel: 'v340' },
                    ],
                    recommendedArtifactId: 'de1-340',
                    updateAvailable: true,
                }));
                await page.settle();
                const before = await firmware();
                assert.match(before.button, /340/, 'the button said "latest" and named nothing');
                assert.match(before.newest, /340/);

                /* AND AGAIN INSIDE THE CONFIRMATION, which is the whole point of a
                 * confirmation: "Write this firmware to the machine?" names nothing. */
                await page.evalFn(async () => {
                    window.__settings.bespokeEl().shadowRoot.getElementById('firmware-latest').click();
                    await new Promise((r) => requestAnimationFrame(r));
                    return true;
                });
                await page.settle();
                const asked = await firmware();
                assert.match(asked.question, /340/);
                await page.evalFn(async () => {
                    const dialog = window.__settings.bespokeEl().shadowRoot.getElementById('firmware-confirm');
                    dialog.dispatchEvent(new CustomEvent('cancel', { bubbles: true, composed: true }));
                    await new Promise((r) => setTimeout(r, 40));
                    return true;
                });
            });

            test('a machine with nothing applicable gets no button and a dash, not a zero', async () => {
                await show('updates', 'updates-firmware-update');
                await page.evalFn(() => window.__settings.firmwareCatalog({
                    machine: { build: 340, model: 'Bengle' },
                    artifacts: [{ id: 'de1-340', build: 340, versionLabel: 'v340' }],
                    recommendedArtifactId: null,
                    updateAvailable: false,
                }));
                await page.settle();
                const got = await firmware();
                assert.equal(got.button, null, 'a dead affordance on a page about whether there is anything to do');
                assert.equal(got.newest, '–');
            });

            test('a Bengle is told the app carries nothing for it, NOT that it is up to date', async () => {
                /* THE FALSE THAT MEANT TWO OPPOSITE THINGS. `updateAvailable === false` was
                 * drawn as "This machine is on the newest image it carries". On a DE1 that
                 * is true. On a Bengle it is a fiction, and a structural one:
                 * `FirmwareManifest._validate` throws on any artifact whose machineFamily
                 * is not the literal 'de1', so the bundled catalog CANNOT hold a Bengle
                 * image — not "does not yet", cannot. Every artifact is model_incompatible,
                 * nothing is recommended, no eligibility is unknown, and the server computes
                 * exactly the same `false` it computes for a DE1 that is current.
                 *
                 * A person reading the old sentence concluded their machine was current.
                 * What was true is that this app ships no firmware for their machine at all.
                 * The difference is legible in `supportedModels`, which the page was already
                 * holding and never read. */
                const DE1_ONLY = ['DE1Pro', 'DE1XL', 'DE1XXL', 'DE1XXXL'];
                await show('updates', 'updates-firmware-update');
                await page.evalFn(([models]) => window.__settings.firmwareCatalog({
                    machine: { build: 340, model: 'Bengle' },
                    artifacts: [
                        { id: 'de1-1352', build: 1352, versionLabel: '1352', supportedModels: models },
                        { id: 'de1-1358', build: 1358, versionLabel: '1358', supportedModels: models },
                    ],
                    recommendedArtifactId: null,
                    updateAvailable: false,
                }), [DE1_ONLY]);
                await page.settle();
                const headline = () => page.evalFn(() => window.__settings.bespokeEl()
                    .shadowRoot.getElementById('firmware-headline').textContent.trim());
                const bengle = await headline();
                assert.match(bengle, /carries no firmware for this machine/i);
                assert.doesNotMatch(bengle, /newest image/i,
                    'the sentence that told a Bengle owner their machine was current');

                /* AND THE SAME CATALOG ON A DE1 STILL SAYS THE TRUE THING, which is what
                 * makes this a correction rather than a new blanket sentence. */
                await page.evalFn(([models]) => window.__settings.firmwareCatalog({
                    machine: { build: 1358, model: 'DE1Pro' },
                    artifacts: [
                        { id: 'de1-1352', build: 1352, versionLabel: '1352', supportedModels: models },
                        { id: 'de1-1358', build: 1358, versionLabel: '1358', supportedModels: models },
                    ],
                    recommendedArtifactId: null,
                    updateAvailable: false,
                }), [DE1_ONLY]);
                await page.settle();
                assert.match(await headline(), /newest image/i);
            });

            test('with no grounds the page says what the SERVER said, and invents nothing (A7)', async () => {
                /* A catalog whose artifacts do not declare `supportedModels` gives the page
                 * no basis for the stronger sentence. Null is not "nothing carried". */
                await show('updates', 'updates-firmware-update');
                await page.evalFn(() => window.__settings.firmwareCatalog({
                    machine: { build: 340, model: 'Bengle' },
                    artifacts: [{ id: 'de1-340', build: 340, versionLabel: 'v340' }],
                    recommendedArtifactId: null,
                    updateAvailable: false,
                }));
                await page.settle();
                const said = await page.evalFn(() => window.__settings.bespokeEl()
                    .shadowRoot.getElementById('firmware-headline').textContent.trim());
                assert.match(said, /newest image/i);
                assert.doesNotMatch(said, /carries no firmware/i);
            });

            test('the warning comes before the buttons, is tinted, and agrees with the dialog', async () => {
                /* IT WAS A GREY CAPTION AFTER BOTH CONTROLS. Its whole job is to stop
                 * somebody starting an hour-long write and walking away, and that is
                 * decided BEFORE the tap. */
                await show('updates', 'updates-firmware-update');
                await page.evalFn(() => window.__settings.firmwareCatalog({}));
                await page.settle();
                const got = await firmware();
                assert.equal(got.noteBeforeActions, true, 'the caution still sits after the controls');
                assert.equal(got.noteBorder, '3px', 'Slate’s 3px danger rule down the leading edge');
                assert.notEqual(got.noteBackground, 'rgba(0, 0, 0, 0)', 'the tint is what makes it not a caption');

                /* ONE DURATION, STATED TWICE, MUST BE THE SAME NUMBER. Ben's hour, not
                 * Slate's "several minutes". */
                assert.match(got.note, /up to an hour/);
                assert.match(got.detail, /up to an hour/);
                assert.doesNotMatch(got.note, /several minutes/);

                /* AND WHAT AN INTERRUPTION COSTS, which is answerable from the server:
                 * erase, upload and verify run from the top every time and nothing
                 * resumes. Both places say it. */
                assert.match(got.note, /nothing resumes/);
                assert.match(got.detail, /nothing resumes/);
                assert.match(got.detail, /do not close this page/i,
                    'closing the page really does cancel the flash — the handler cancels on disconnect');
            });
        });

        describe('Help › Talk to Decent tells the truth about this platform', () => {
            const pane = () => page.evalFn(() => {
                const root = window.__settings.bespokeEl().shadowRoot;
                const chip = root.getElementById('account-state');
                const email = root.querySelector('a[href^="mailto:"]');
                return {
                    text: root.textContent.replace(/\s+/g, ' ').trim(),
                    chip: chip ? chip.textContent.trim() : null,
                    steps: [...root.querySelectorAll('ol.steps li')].map((li) => li.textContent.trim()),
                    emptyState: Boolean(root.querySelector('ui-empty-state')),
                    mailto: email ? email.getAttribute('href') : null,
                    emailColour: email ? getComputedStyle(email).color : null,
                    captionColour: (() => {
                        const caption = root.querySelector('.ui-caption');
                        return caption ? getComputedStyle(caption).color : null;
                    })(),
                };
            });

            test('a machine with no account is told where signing in actually happens', async () => {
                await page.evalFn(() => window.__settings.accountState({ loggedIn: false }));
                await show('help', 'help-talk-to-decent');
                const got = await pane();
                assert.equal(got.steps.length, 3);
                /* TWO OF SLATE'S THREE STEPS ARE FALSE HERE. Sign-in is ReaPrime's own
                 * Account page, reached from its launcher, with an email and password
                 * form; and nothing in ReaPrime ADDS a machine — it reads the machines
                 * already on the account and emails support when this one is not among
                 * them. */
                assert.doesNotMatch(got.text, /on your phone/i);
                assert.doesNotMatch(got.text, /add this machine/i);
                assert.match(got.steps.join(' '), /ReaPrime/);
                assert.match(got.steps.join(' '), /email and password/i);
                /* THE THIRD STEP'S PROMISE IS BACK, AND IT IS BACK BECAUSE IT BECAME TRUE
                 * (27 August 2026). This assertion used to be its exact inverse —
                 * `doesNotMatch(/message box/i)` — and it was right: Slate promises a
                 * message box on step three and Decal had not built one, so the sentence
                 * was a promise in copy the code did not keep. The box is built (see the
                 * suite below), so the WEAKER sentence would now be the wrong one: someone
                 * signing in to send a message would be told only that a chip will change.
                 * The test is rewritten rather than deleted, because the claim it makes is
                 * still load-bearing — it is now "this page keeps the promise it makes". */
                assert.match(got.steps[2], /message box/i,
                    'step three promises the message box, which the linked branch now builds');
            });

            test('a machine WITH an account is not shown instructions for linking one', async () => {
                /* THE STRUCTURAL BUG: `linked` was computed and used only for the chip's
                 * label, so a linked machine still got the paragraph and the three steps —
                 * instructions for a thing that has already happened. */
                await page.evalFn(() => window.__settings.accountState({ loggedIn: true }));
                await show('help', 'help-talk-to-decent');
                const got = await pane();
                assert.deepEqual(got.steps, []);
                assert.doesNotMatch(got.text, /Signing in happens/i);
                assert.match(got.text, /signed in/i);
                await page.evalFn(() => window.__settings.accountState({ loggedIn: false }));
            });

            test('the chip is a word and the sentence is a heading, which is Slate’s own shape', async () => {
                /* ui-status-chip is uppercase with cap tracking and WRAPS, so "No Decent
                 * account linked" printed as a four-word tracked pill. Slate puts that
                 * sentence in a heading inside a dashed empty-state card — the very
                 * element ui-empty-state was built from. */
                await page.evalFn(() => window.__settings.accountState({ loggedIn: false }));
                await show('help', 'help-talk-to-decent');
                const out = await pane();
                assert.ok(out.chip.split(/\s+/).length <= 2, `the chip is a sentence again: ${out.chip}`);
                assert.equal(out.emptyState, true);

                await page.evalFn(() => window.__settings.accountState({ loggedIn: true }));
                await show('help', 'help-talk-to-decent');
                const linked = await pane();
                assert.ok(linked.chip.split(/\s+/).length <= 2, `the chip is a sentence again: ${linked.chip}`);
                await page.evalFn(() => window.__settings.accountState({ loggedIn: false }));
            });

            test('the support address is a real link, not grey text on a touch screen', async () => {
                await page.evalFn(() => window.__settings.accountState({ loggedIn: false }));
                await show('help', 'help-talk-to-decent');
                const got = await pane();
                assert.equal(got.mailto, 'mailto:help@decentespresso.com');
                assert.notEqual(got.emailColour, got.captionColour,
                    'an address painted the same as the prose around it is not a link');
            });
        });


        /* ===================================================================
         * Help › Talk to Decent — THE MESSAGE BOX THE PAGE PROMISED
         * ===================================================================
         *
         * Ben, 27 August 2026: build it, in Slate's shape — a compose box plus a thread
         * list, gated on the account actually being linked.
         *
         * WHY THESE ASSERTIONS AND NOT OTHERS. Everything below is a claim that could
         * plausibly go wrong in a way a screenshot would not show:
         *
         *   the surface is BEHIND the account, so a signed-out machine gets no compose box;
         *   an unreadable thread is not an empty one, which is the distinction Slate loses;
         *   the message really leaves on the QUERY STRING, which is the only shape a
         *     read-scoped skin token can use;
         *   the bearer really reaches the wire, which nothing else in the tree proves;
         *   and the draft survives a refusal, which is the difference between a form and a
         *     form that eats what you typed.
         */
        describe('Help › Talk to Decent builds the message box it promises', () => {
            const linkedPane = async () => {
                await page.evalFn(() => window.__settings.accountState({ loggedIn: true }));
                await show('help', 'help-talk-to-decent');
                await page.settle();
            };

            const box = () => page.evalFn(() => {
                const root = window.__settings.bespokeEl().shadowRoot;
                const text = (id) => {
                    const el = root.getElementById(id);
                    return el ? el.textContent.replace(/\s+/g, ' ').trim() : null;
                };
                return {
                    thread: Boolean(root.getElementById('support-thread')),
                    compose: Boolean(root.getElementById('support-compose')),
                    messages: [...root.querySelectorAll('#support-messages .message')].map((li) => ({
                        from: li.dataset.from,
                        text: li.textContent.replace(/\s+/g, ' ').trim(),
                    })),
                    empty: text('support-thread-empty'),
                    error: text('support-thread-error'),
                    noToken: text('support-no-token'),
                    sent: text('support-sent'),
                    sendError: text('support-send-error'),
                    incomplete: text('support-incomplete'),
                    sendDisabled: root.getElementById('support-send')?.disabled ?? null,
                };
            });

            /** Type into the two fields the way the components publish, then press Send. */
            const compose = async (subject, body) => {
                await page.evalFn(async (s, b) => {
                    const root = window.__settings.bespokeEl().shadowRoot;
                    const el = root.getElementById('support-compose');
                    const subjectField = root.getElementById('support-subject');
                    if (subjectField) {
                        subjectField.value = s;
                        subjectField.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
                    }
                    root.getElementById('support-message')?.dispatchEvent(new CustomEvent('notes-input', {
                        detail: { value: b }, bubbles: true, composed: true,
                    }));
                    await new Promise((r) => setTimeout(r, 0));
                    return Boolean(el);
                }, subject, body);
                await page.settle();
            };

            const send = async () => {
                await page.evalFn(async () => {
                    const root = window.__settings.bespokeEl().shadowRoot;
                    root.getElementById('support-send').click();
                    await new Promise((r) => setTimeout(r, 30));
                    return true;
                });
                await page.settle();
            };

            test('a signed-out machine gets no message box at all', async () => {
                await page.evalFn(() => window.__settings.accountState({ loggedIn: false }));
                await show('help', 'help-talk-to-decent');
                const got = await box();
                assert.equal(got.thread, false,
                    'the proxy answers 401 with no linked account — a thread here could only ever fail');
                assert.equal(got.compose, false,
                    'and a compose box with nowhere to send from is the promise defect wearing a form');
            });

            test('a linked machine gets the thread and the compose box, in Slate’s order', async () => {
                await linkedPane();
                const got = await box();
                assert.equal(got.thread, true);
                assert.equal(got.compose, true);
                /* THE THREAD COMES FIRST, which is Slate's own arrangement and the right
                 * one: the compose box is what you do AFTER reading the reply. */
                const order = await page.evalFn(() => {
                    const root = window.__settings.bespokeEl().shadowRoot;
                    return [...root.querySelectorAll('section.group')].map((el) => el.id);
                });
                assert.ok(order.indexOf('support-thread') < order.indexOf('support-compose'),
                    `the compose box is above the conversation: ${order.join(', ')}`);
            });

            test('the thread is the served conversation, oldest first, with each side named', async () => {
                await linkedPane();
                const got = await box();
                assert.equal(got.messages.length, 2);
                /* OLDEST FIRST. The fixture serves them newest-first on purpose — the
                 * upstream's order is not something this skin can rely on, and a
                 * conversation read bottom-to-top is unreadable. */
                assert.match(got.messages[0].text, /grind seems coarse/);
                assert.match(got.messages[1].text, /1\.2 finer/);
                /* WHO WROTE IT. `from_user` is the ONLY thing on the record that says so —
                 * non-empty means Decent, absent means the account. */
                assert.equal(got.messages[0].from, 'you');
                assert.equal(got.messages[1].from, 'decent');
                assert.match(got.messages[1].text, /Ray/);
                assert.equal(got.empty, null, 'a thread with messages must not also say it is empty');
                assert.equal(got.error, null);
            });

            /* THE MALFORMED BODY IS THE REASON THE TRANSPORT READS TEXT.
             *
             * Slate repairs `"subject": ,` with a regex before parsing and nobody writes
             * that by accident — it is the trace of a real body that broke a real parser.
             * Under the transport's ordinary JSON path this would be a DECODE failure whose
             * only surviving evidence is the first 200 characters, so the thread would be
             * unrecoverable from the error. */
            test('a thread with an empty value in it still reads, which is what Slate’s regex was for', async () => {
                await linkedPane();
                await page.evalFn(() => window.__settings.supportThread(
                    '[{"from_user":"Ray","now":1756200000,"subject": ,"body":"No subject on this one."}]',
                ));
                const got = await box();
                assert.equal(got.error, null, 'the one malformed shape Slate documents is repaired, not reported');
                assert.equal(got.messages.length, 1);
                assert.match(got.messages[0].text, /No subject on this one/);
                await page.evalFn(() => window.__settings.supportThread(
                    JSON.stringify([{ from_user: 'Ray', now: 1756200000, subject: 'Re: grinder', body: 'Try 1.2 finer.' }]),
                ));
            });

            /* AND ANYTHING ELSE MALFORMED IS REPORTED RATHER THAN REPAIRED. The repair is
             * one lexical shape, not a JSON parser; a body this skin cannot read must not
             * become an empty conversation. */
            test('an unreadable thread says so, and is never drawn as an empty one', async () => {
                await linkedPane();
                await page.evalFn(() => window.__settings.supportThread('<html>not json at all'));
                const got = await box();
                assert.match(got.error, /could not be read/i);
                assert.equal(got.empty, null,
                    '"you have no messages" and "your messages could not be loaded" are different sentences, '
                    + 'and Slate collapses them — this must not');
                assert.equal(got.messages.length, 0);
            });

            test('an empty conversation is an answer, and it is a different sentence', async () => {
                await linkedPane();
                await page.evalFn(() => window.__settings.supportThread(''));
                const got = await box();
                assert.match(got.empty, /No messages yet/i);
                assert.equal(got.error, null, 'a 200 with no body is the upstream saying "nothing", not a fault');
            });

            test('the upstream’s own refusal token is a refusal, even though it arrives on a 200', async () => {
                await linkedPane();
                await page.evalFn(() => window.__settings.supportThread('0'));
                const got = await box();
                assert.match(got.error, /refused/i,
                    "ReaPrime's own emailSerialMismatch tests body == '0' on a 200; a store reading only the "
                    + 'status would report a refusal as an empty thread');
                await page.evalFn(() => window.__settings.supportThread(
                    JSON.stringify([{ from_user: 'Ray', now: 1756200000, subject: 'Re: grinder', body: 'Try 1.2 finer.' }]),
                ));
            });

            test('sending puts the message on the query string, with the bearer, and re-reads the thread', async () => {
                await linkedPane();
                const before = (await page.evalFn(() => window.__settings.supportSent())).length;
                await compose('Grinder question', 'The grind seems coarse.');
                await send();

                const sent = await page.evalFn(() => window.__settings.supportSent());
                assert.equal(sent.length, before + 1, 'exactly one message reached the wire');
                const last = sent[sent.length - 1];
                assert.equal(last.subject, 'Grinder question');
                assert.match(last.body, /The grind seems coarse\./);

                /* THE BEARER. Nothing else in this tree proves the injected proxy token
                 * reaches a request — and without it the middleware answers 401 and this
                 * page would report an unlinked account, which is a false and
                 * actionable-looking claim. */
                const bearers = await page.evalFn(() => window.__settings.supportBearers());
                assert.ok(bearers.length > 0);
                assert.ok(bearers.every((value) => value === 'Bearer fixture-bearer'),
                    `a proxied call went out without the bearer: ${JSON.stringify(bearers)}`);

                const got = await box();
                assert.match(got.sent, /Message sent/i);
            });

            /* THE ATTACHMENT BLOCK GOES IN THE BODY, which is the only field there is.
             * Slate appends a Markdown bullet list; this appends plain `Name: value` lines,
             * because a support inbox that is not a Markdown viewer shows the asterisks. */
            test('the machine details switch appends to the body and nothing else', async () => {
                await linkedPane();
                await compose('With details', 'Something is wrong.');
                await send();
                const sent = await page.evalFn(() => window.__settings.supportSent());
                const last = sent[sent.length - 1];
                assert.match(last.body, /Something is wrong\./, 'the typed words come first and unaltered');
                assert.match(last.body, /Machine details/);
                assert.match(last.body, /Model: /);
                assert.doesNotMatch(last.body, /\*\*/, 'Markdown asterisks arrive as asterisks in a mail client');
                assert.equal(last.subject, 'With details',
                    'the details belong to the body — a subject carrying them would be unreadable in a list');
            });

            test('Send refuses a blank field on press, and says which, rather than sitting disabled', async () => {
                await linkedPane();
                const before = (await page.evalFn(() => window.__settings.supportSent())).length;
                await compose('A subject on its own', '');
                const armed = await box();
                assert.equal(armed.sendDisabled, false,
                    'a disabled primary reads as an empty slot and makes its own refusal unreachable — the '
                    + 'same settlement the feedback form on this page reached');
                await send();
                const got = await box();
                assert.match(got.incomplete, /both the subject and the message/i);
                const sent = await page.evalFn(() => window.__settings.supportSent());
                assert.equal(sent.length, before, 'and nothing reached the wire');
            });

            test('a refused send keeps the words on screen', async () => {
                await linkedPane();
                await page.evalFn(() => window.__settings.supportSendAnswer('0'));
                await compose('Refused', 'This one will be refused.');
                await send();
                await page.evalFn(() => window.__settings.supportSendAnswer(null));

                const got = await box();
                assert.match(got.sendError, /refused/i);
                const draft = await page.evalFn(() => {
                    const root = window.__settings.bespokeEl().shadowRoot;
                    return {
                        subject: root.getElementById('support-subject')?.value ?? null,
                        message: root.getElementById('support-message')?.value ?? null,
                    };
                });
                assert.equal(draft.subject, 'Refused',
                    'the draft is cleared only on success — a refusal that eats what you typed is worse than the refusal');
                assert.match(draft.message, /will be refused/);
            });

            /* NO BEARER IS A DIFFERENT PAGE, NOT A DISABLED FORM. This is the ordinary
             * state everywhere except a real ReaPrime-served skin: the dev harness and the
             * capture battery both serve this tree themselves, so nothing injects the meta
             * tag the token comes from. It has to say why rather than offering three
             * controls that exist to be refused. */
            test('a page ReaPrime did not serve says why it cannot send, and offers no form', async () => {
                await page.evalFn(() => window.__settings.supportToken(false));
                await linkedPane();
                const got = await box();
                assert.match(got.noToken, /page the machine serves/i);
                assert.doesNotMatch(got.noToken, /try again/i,
                    'without a bearer this page can NEVER reach the proxy; inviting a retry would be advice '
                    + 'that cannot help');
                const fields = await page.evalFn(() => {
                    const root = window.__settings.bespokeEl().shadowRoot;
                    return {
                        subject: Boolean(root.getElementById('support-subject')),
                        send: Boolean(root.getElementById('support-send')),
                    };
                });
                assert.equal(fields.subject, false);
                assert.equal(fields.send, false);
                await page.evalFn(() => window.__settings.supportToken(true));
            });

            /* THE READS ARE SEQUENCED AND THE SECOND IS CONDITIONAL. Opening this leaf on a
             * machine with no account must not send a request to decentespresso.com that
             * can only answer 401. */
            test('opening the page on an account-less machine reaches no third-party host', async () => {
                await page.evalFn(() => window.__settings.supportToken(true));
                await page.evalFn(() => window.__settings.accountState({ loggedIn: false }));
                const before = (await page.evalFn(() => window.__settings.supportBearers())).length;
                await show('help', 'help-send-feedback');
                await show('help', 'help-talk-to-decent');
                const after = (await page.evalFn(() => window.__settings.supportBearers())).length;
                assert.equal(after, before,
                    'the thread read is gated on `loggedIn === true`, so an unlinked machine costs no round trip');
                await page.evalFn(() => window.__settings.accountState({ loggedIn: false }));
            });
        });

        describe('Help › Send Feedback says where a report goes, and what came back', () => {
            const feedback = () => page.evalFn(() => {
                const root = window.__settings.bespokeEl().shadowRoot;
                /* #38 RENDERS ITS HEADING AND ITS BODY INSIDE ITS OWN SHADOW ROOT, so the
                 * leaf's textContent does not carry either — the prose has TWO ways in and
                 * the property is the one out of a screen sheet's reach (ui-empty-state's
                 * own header). A reader that walked only the leaf would report a sent
                 * screen as saying nothing at all. */
                const sentState = root.getElementById('feedback-sent');
                const sentBody = sentState
                    ? [...sentState.shadowRoot.querySelectorAll('#heading, #body')]
                        .map((el) => el.textContent.trim()).join(' ')
                    : '';
                return {
                    text: `${root.textContent} ${sentBody}`.replace(/\s+/g, ' ').trim(),
                    empty: root.getElementById('feedback-empty')?.textContent.trim() ?? null,
                    failed: root.getElementById('feedback-failed')?.textContent.trim() ?? null,
                    sent: Boolean(root.getElementById('feedback-sent')),
                    issue: root.getElementById('feedback-issue')?.getAttribute('href') ?? null,
                    submitDisabled: root.getElementById('feedback-send')?.hasAttribute('disabled') ?? null,
                };
            });
            const type = (text) => page.evalFn(async (value) => {
                const root = window.__settings.bespokeEl().shadowRoot;
                const editor = root.getElementById('feedback-description');
                editor.value = value;
                editor.dispatchEvent(new CustomEvent('notes-input', {
                    detail: { value }, bubbles: true, composed: true,
                }));
                await new Promise((r) => setTimeout(r, 40));
                return true;
            }, text);
            const submit = () => page.evalFn(async () => {
                window.__settings.bespokeEl().shadowRoot.getElementById('feedback-send').click();
                await new Promise((r) => setTimeout(r, 60));
                return true;
            });

            test('the pane says where the report goes and where an answer comes from', async () => {
                await show('help', 'help-send-feedback');
                const got = await feedback();
                /* A SUBMITTED REPORT BECOMES A PUBLIC GITHUB ISSUE, so there is no reply
                 * channel back to this tablet by construction. Slate manufactures one by
                 * XOR-obfuscating the user's email into the issue body. */
                assert.match(got.text, /public/i);
                assert.match(got.text, /help@decentespresso\.com/);
            });

            test('the system-info helper names what is actually attached, and no firmware', async () => {
                /* _collectSystemInfo attaches app version and build, commit, branch,
                 * platform, OS version and Dart version. There is no machine firmware in
                 * it anywhere; Slate says there is, and Decal inherited the sentence. */
                await show('help', 'help-send-feedback');
                const got = await feedback();
                assert.doesNotMatch(got.text, /firmware/i);
                assert.match(got.text, /app version/i);
            });

            test('Submit is pressable with nothing written, and refuses out loud', async () => {
                /* THE GATE MADE ITS OWN REFUSAL UNREACHABLE: a disabled primary is navy at
                 * 38 percent, which reads as an empty slot, and "Write something first."
                 * had no caller at all. */
                await show('help', 'help-send-feedback');
                await type('');
                const armed = await feedback();
                assert.equal(armed.submitDisabled, false);

                const before = await page.evalFn(() => window.__settings.server().feedbackPosts ?? 0);
                await submit();
                await page.settle();
                const got = await feedback();
                assert.ok(got.empty, 'the refusal sentence is still unreachable');
                const after = await page.evalFn(() => window.__settings.server().feedbackPosts ?? 0);
                assert.equal(after, before, 'a refusal must not reach the wire');
            });

            test('a refused send shows the SERVER’s reason, which lives in problem and not in data', async () => {
                await show('help', 'help-send-feedback');
                await page.evalFn(() => window.__settings.feedbackResult({
                    status: 500,
                    body: { success: false, errorMessage: 'Failed to create GitHub issue' },
                }));
                await type('the group head leaks');
                await submit();
                await page.settle();
                const got = await feedback();
                assert.equal(got.failed, 'Failed to create GitHub issue');
                await page.evalFn(() => window.__settings.feedbackResult(null));
            });

            test('a sent report names the issue it became, and links to it', async () => {
                await show('help', 'help-send-feedback');
                await page.evalFn(() => window.__settings.feedbackResult({
                    status: 201,
                    body: {
                        success: true,
                        issueUrl: 'https://github.com/decentespresso/decaid/issues/123',
                        issueNumber: 123,
                    },
                }));
                await type('the group head leaks');
                await submit();
                await page.settle();
                const got = await feedback();
                assert.equal(got.sent, true);
                assert.match(got.text, /#123/);
                assert.equal(got.issue, 'https://github.com/decentespresso/decaid/issues/123');
            });

            test('a 201 that names no issue keeps the plain thank-you and draws no link', async () => {
                await show('help', 'help-send-feedback');
                await page.evalFn(() => window.__settings.feedbackResult({ status: 201, body: { success: true } }));
                await page.evalFn(() => window.__settings.bespokeEl().shadowRoot
                    .getElementById('feedback-sent') === null);
                await type('the group head leaks');
                await submit();
                await page.settle();
                const got = await feedback();
                assert.equal(got.sent, true);
                assert.equal(got.issue, null, 'a link to nowhere is worse than no link');
                assert.doesNotMatch(got.text, /#\d/);
                await page.evalFn(() => window.__settings.feedbackResult(null));
            });
        });

        test('nothing in the Updates and Help walk threw', () => {
            assert.deepEqual(page.pageErrors, []);
        });

    });
}
