/**
 * The nine bespoke leaves, measured off the engine.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';

const MODULES = ['/test/fixtures/settings-shell-fixture.js'];
const STAGE = '<div id="stage" style="inline-size: 100%; block-size: 100dvh"></div>';

/** The nine, with the category each one is reached through. */

const BESPOKE_PANES = Object.freeze([
    ['machine', 'machine-machine-info'],
    ['machine', 'machine-sleep-wake-schedules'],
    ['display', 'display-skin'],
    ['updates', 'updates-skin-app'],
    ['units-language', 'units-language-select-language'],
    ['calibration', 'calibration-load-cells'],

    ['accessories', 'accessories-lighting'],
]);

/** The three that are gated on the served capability array. */
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

        paneContent: pane.clientWidth
            - parseFloat(paneStyle.paddingInlineStart) - parseFloat(paneStyle.paddingInlineEnd),

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

            test('an empty served array removes unsupported leaves and selects a usable page', async () => {
                await serve([]);
                const fallback = {
                    'accessories-lighting': ['accessories', 'accessories-usb-charger'],
                    'accessories-cup-warmer': ['accessories', 'accessories-usb-charger'],
                    'calibration-load-cells': ['calibration', 'calibration-flow-multiplier'],
                    'machine-sleep-wake-schedules': ['machine', 'machine-steam'],
                };
                for (const [leafId, [category, expected]] of Object.entries(fallback)) {
                    await show(category, leafId);
                    const actual = await page.evalFn((id) => {
                        const screen = __settings.screen();
                        return {
                            selected: screen.leafId,
                            rendered: screen.shadowRoot.getElementById('leaf').leafId,
                            listed: [...screen.shadowRoot.querySelectorAll('ui-nav-row, ui-subnav-row')]
                                .some((row) => row.dataset.id === id),
                        };
                    }, leafId);
                    assert.equal(actual.listed, false, `${leafId} is not offered`);
                    assert.equal(actual.selected, expected);
                    assert.equal(actual.rendered, expected);
                }
            });

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
         * 2. THE ONE MEASURE — and
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

                    const expected = Math.min(report.paneContent, report.measureWide);
                    near(report.measure.width, expected, `${leafId} vs min(100%, --ui-measure-wide)`, 1.01);
                    seen.push({ leafId, width: Math.round(report.measure.width), expected: Math.round(expected) });
                }

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

                await show('display', 'display-skin');
                const other = await paneReport(page);

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
                assert.equal(intro.chips, 5, 'five steps, as decided');
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

                await drive({ ...IDLE, step: 'zeroing', secondsRemaining: 5 });
                await drive({ ...IDLE, step: 'complete', subState: 'done', secondsRemaining: 0 });
                const left = await wizardReport(page);
                assert.equal(left.current, 3);
                assert.match(left.heading, /left/i);
                assert.equal(left.stepperCount, 1, 'and now it asks');
                assert.ok(left.stepperHeight > 0, 'laid out, not merely present');

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

                assert.match(diagnosed.status.text, /did not see the weight/i,
                    'badDelta is a sentence, not a status code');
                assert.doesNotMatch(diagnosed.status.text, /centred/i,
                    'and it is not the instruction that causes notIsolated');
                assert.match(diagnosed.status.text, /Cell B/, 'and the auto-detected cell rides with it');
            });

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

                await scale(0.4, { stale: true });
                const gone = await wizardReport(page);
                assert.match(gone.live, /\u2013/, 'a stale weight reads as an absence, not as a number');
                assert.doesNotMatch(gone.live, /0\.4/, 'the last frame is not held on screen');

                await scale(201.3);
                await drive({ ...IDLE, step: 'zeroing', secondsRemaining: 5 });
                await drive({ ...IDLE, step: 'complete', subState: 'done', secondsRemaining: 0 });
                const left = await wizardReport(page);
                assert.equal(left.current, 3, 'the first weight step');
                assert.match(left.surface, /201\.3 g/, 'and it says what the cell is carrying');

                await scale(null);
            });

            test('a weight from a source that gave up reads as an absence too', async () => {
                await serve(['scaleCalibration']);
                await show('calibration', 'calibration-load-cells');
                await drive(IDLE);
                await freshWalk();
                await startWalk();

                await scale(0.4);
                const live = await wizardReport(page);
                assert.match(live.surface, /0\.4 g/, 'the fresh reading is drawn, or there is nothing to withdraw');

                await scale(0.4, { status: 'unavailable' });
                const gone = await wizardReport(page);
                assert.match(gone.live, /\u2013/,
                    'a source that gave up still holds its last frame, and that is not a reading');
                assert.doesNotMatch(gone.live, /0\.4/,
                    'the walk went on printing a weight nobody is measuring');

                await scale(null);
            });
        });

        describe('the LED palette is a draft, and Save is the only write', () => {
            test('N rapid swatch presses leave NOTHING on the wire; Save sends the last colour', async () => {
                await serve(['ledStrip']);
                await show('accessories', 'accessories-lighting');

                const drill = await page.evalFn(async () => {
                    const api = window.__settings;
                    const before = api.ledCounters();
                    const beforeServer = api.server();

                    for (let i = 1; i <= 7; i += 1) await api.pickSwatch(i);
                    const midDrag = api.ledCounters();
                    const duringServer = api.server();

                    await api.stores().led.commit();
                    await api.stores().led.settled();

                    return {
                        before,
                        midDrag,
                        after: api.ledCounters(),
                        duringServer,
                        server: api.server(),
                        shown: api.stores().led.hex('frontStrip', 'awake'),
                    };
                });

                assert.equal(drill.midDrag.intents - drill.before.intents, 7,
                    'seven presses, seven intents');
                assert.equal(drill.midDrag.sent, drill.before.sent,
                    'and NONE of them reached the machine: a PUT stores the palette');
                assert.equal(drill.duringServer.ledWrites, drill.server.ledWrites - 1,
                    'exactly one write for the whole drag, and it happened on Save');
                assert.equal(drill.after.sent - drill.before.sent, 1);
                assert.equal(drill.after.peakInFlight, 1, 'never two writes at once');

                const expected = drill.server.ledLast.frontStrip.awake;
                assert.equal(drill.shown.toLowerCase(),
                    `#${expected.slice(0, 2)}${expected.slice(4, 6)}${expected.slice(8, 10)}`.toLowerCase());
            });

            test('a colour picked and cancelled leaves the machine holding what it held', async () => {
                await serve(['ledStrip']);
                await show('accessories', 'accessories-lighting');

                const run = await page.evalFn(async () => {
                    const api = window.__settings;
                    const led = api.stores().led;

                    await api.pickSwatch(1);
                    await led.commit();
                    await led.settled();
                    const saved = api.server();

                    await api.pickSwatch(4);
                    const picked = {
                        server: api.server(),
                        shown: led.hex('frontStrip', 'awake'),
                        dirty: led.get().dirty,
                    };

                    await led.reset();
                    return {
                        saved,
                        picked,
                        after: {
                            server: api.server(),
                            shown: led.hex('frontStrip', 'awake'),
                            dirty: led.get().dirty,
                        },
                    };
                });

                assert.equal(run.picked.server.ledWrites, run.saved.ledWrites,
                    'picking a colour must not write the stored palette');
                assert.deepEqual(run.picked.server.ledLast, run.saved.ledLast,
                    'the machine is still holding the palette that was saved');
                assert.equal(run.picked.dirty, true, 'and the header counts one thing to save');

                assert.equal(run.after.dirty, false, 'Cancel leaves nothing staged');
                assert.equal(run.after.server.ledWrites, run.saved.ledWrites,
                    'and it writes nothing of its own to put anything back');
                assert.notEqual(run.after.shown, run.picked.shown,
                    'the picker is back on the palette the machine holds, not the cancelled colour');
                const held = run.saved.ledLast.frontStrip.awake;
                const heldHex = `#${held.slice(0, 2)}${held.slice(4, 6)}${held.slice(8, 10)}`;
                assert.equal(run.after.shown.toLowerCase(), heldHex.toLowerCase());
            });

            test('OFF blacks every SELECTED zone and ON restores what each one was', async () => {
                await serve(['ledStrip']);
                await show('accessories', 'accessories-lighting');

                const run = await page.evalFn(async () => {
                    const api = window.__settings;
                    api.freeLed();
                    const led = api.stores().led;
                    const bespoke = api.bespokeEl();
                    const zones = ['frontStrip', 'backStrip', 'frontSwitch'];
                    const readAll = () => Object.fromEntries(zones.map((z) => [z, led.hex(z, 'awake')]));

                    const bank = bespoke.shadowRoot.getElementById('led-zone');
                    bank.dispatchEvent(new CustomEvent('change', {
                        detail: { value: 'both' }, bubbles: true, composed: true,
                    }));
                    await bespoke.updateComplete;

                    await api.pickSwatch(1);
                    const lit = readAll();

                    const press = async (checked) => {
                        const el = bespoke.shadowRoot.getElementById('led-power');
                        el.dispatchEvent(new CustomEvent('change', {
                            detail: { checked }, bubbles: true, composed: true,
                        }));
                        await bespoke.updateComplete;
                    };

                    const wasOn = led.isOn('awake', zones);
                    const beforeServer = api.server();
                    await press(false);
                    const off = { strip: readAll(), isOn: led.isOn('awake', zones), server: api.server() };
                    await press(true);
                    const on = { strip: readAll(), isOn: led.isOn('awake', zones) };

                    await press(false);
                    await led.commit();
                    await led.settled();

                    return {
                        lit, wasOn, off, on, beforeServer, server: api.server(),
                        counters: led.counters(),
                    };
                });

                assert.equal(run.wasOn, true, 'the bank starts lit, so there is something to switch off');

                /* OFF: every zone black, and the switch reads off. */
                for (const [zone, hex] of Object.entries(run.off.strip)) {
                    assert.equal(hex, '#000000', `${zone} is still lit after the power switch went off`);
                }
                assert.equal(run.off.isOn, false, 'a bank with nothing lit is off, derived from the colour');
                assert.equal(run.off.server.ledWrites, run.beforeServer.ledWrites,
                    'and the machine has not been written to: the switch drafts like the picker');

                /* ON: exactly what was there before, not a default. */
                assert.deepEqual(run.on.strip, run.lit,
                    'powering back on must restore the remembered colours, not a warm white');
                assert.equal(run.on.isOn, true);

                assert.equal(run.server.ledWrites - run.beforeServer.ledWrites, 1,
                    'three zones went dark in one write');
                for (const zone of ['frontStrip', 'backStrip', 'frontSwitch']) {
                    assert.equal(run.server.ledLast[zone].awake, '000000000000',
                        `${zone} did not travel with the palette that was saved`);
                }
                assert.equal(run.counters.peakInFlight, 1);
            });

            test('a bank that was never lit comes on at the warm-white default', async () => {
                await serve(['ledStrip']);
                await show('accessories', 'accessories-lighting');
                const run = await page.evalFn(async () => {
                    const api = window.__settings;
                    api.freeLed();
                    const led = api.stores().led;
                    const bespoke = api.bespokeEl();
                    const bank = bespoke.shadowRoot.getElementById('led-zone');
                    bank.dispatchEvent(new CustomEvent('change', {
                        detail: { value: 'both' }, bubbles: true, composed: true,
                    }));
                    await bespoke.updateComplete;
                    const press = async (checked) => {
                        bespoke.shadowRoot.getElementById('led-power').dispatchEvent(new CustomEvent('change', {
                            detail: { checked }, bubbles: true, composed: true,
                        }));
                        await bespoke.updateComplete;
                    };
                    /* Black it out FIRST and forget, so nothing is remembered — the
                     * cold-start case, which is the only one the default answers.
                     *
                     * AND THE BLACK HAS TO BE SAVED NOW. `press(false)` previews: since
                     * the re-pin it POSTs the live registers and leaves the STORED
                     * palette alone, so the `load()` below used to re-read the black the
                     * preview had written and now re-reads the fixture's lit palette —
                     * `#ffc180` — which is a remembered colour, not a cold start. The
                     * commit is what makes the machine's stored colour black, which is
                     * the state this test is about, and it is the same two steps a
                     * finger takes: turn the strip off, then Save. */
                    await press(false);
                    await led.commit();
                    await led.settled();
                    led.forget();
                    await led.load();
                    await press(true);
                    return {
                        strip: ['frontStrip', 'backStrip', 'frontSwitch']
                            .map((zone) => led.hex(zone, 'awake')),
                        isOn: led.isOn('awake', ['frontStrip', 'backStrip', 'frontSwitch']),
                    };
                });
                /* LED_DEFAULT_ON = 'FFFFAAAA5555' -> #FFAA55. */
                assert.deepEqual(run.strip.map((hex) => hex.toLowerCase()),
                    ['#ffaa55', '#ffaa55', '#ffaa55']);
                assert.equal(run.isOn, true);
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

                for (const [path, text] of Object.entries(sources)) {
                    const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
                    for (const spelling of [/setTimeout/, /setInterval/, /\bdebounce\b/i, /\bthrottle\b/i]) {
                        assert.doesNotMatch(code, spelling, `${path} schedules the LED write (${spelling})`);
                    }
                }
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
                        await led.previewSettled();
                    }
                    await bespoke.updateComplete;
                    const el = bespoke.shadowRoot.getElementById('led-power');
                    return { checked: el.checked, isOn: led.isOn('awake', ['frontStrip', 'frontSwitch']) };
                });
                assert.equal(state.isOn, false);
                assert.equal(state.checked, false,
                    'the switch is derived from the strip, so black by hand is Off with no second state');
            });

            test('an unsaved palette is counted, stored by Save and discarded by Cancel', async () => {
                await serve(['ledStrip']);
                await show('accessories', 'accessories-lighting');

                await page.evalFn(() => window.__settings.stores().led.reset().then(() => true));
                await page.settle();

                const clean = await page.evalFn(() => {
                    const screen = document.querySelector('settings-screen');
                    return {
                        dirty: window.__settings.stores().led.get().dirty,
                        count: Number(screen.shadowRoot.getElementById('band').getAttribute('change-count')),
                        writes: window.__settings.server().ledWrites,
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
                    await led.previewSettled();
                    const screen = document.querySelector('settings-screen');
                    await screen.updateComplete;
                    return {
                        dirty: led.get().dirty,
                        count: Number(screen.shadowRoot.getElementById('band').getAttribute('change-count')),
                        writes: window.__settings.server().ledWrites,
                        previews: window.__settings.server().ledPreviews,
                    };
                });
                assert.equal(previewed.dirty, true, 'a colour chosen is an edit the machine has not been given');
                assert.equal(previewed.count, 1, 'so the header says there is one thing to save');
                assert.equal(previewed.writes - clean.writes, 0,
                    'no palette went out with it — the stored one is untouched until Save');
                assert.ok(previewed.previews > 0,
                    'and the strip has to have been shown it, or the wheel is dead on the machine');

                const saved = await page.evalFn(async () => {
                    const screen = document.querySelector('settings-screen');
                    const seen = [];
                    const listener = (event) => seen.push(event.detail?.route ?? null);
                    document.addEventListener('navigate', listener);
                    screen.shadowRoot.getElementById('band').shadowRoot.getElementById('save').click();
                    await new Promise((r) => setTimeout(r, 30));
                    document.removeEventListener('navigate', listener);
                    return {
                        writes: window.__settings.server().ledWrites,
                        dirty: window.__settings.stores().led.get().dirty,
                        left: seen,
                    };
                });
                assert.equal(saved.writes - previewed.writes, 1,
                    'Save stores the palette, once — this is the whole finding');
                assert.equal(saved.dirty, false, 'and there is nothing left to save');
                assert.deepEqual(saved.left, ['live'], 'then it leaves, as Save does everywhere');

                await show('accessories', 'accessories-lighting');
                const cancelled = await page.evalFn(async () => {
                    const led = window.__settings.stores().led;
                    await led.preview('frontStrip', 'awake', '#445566');
                    await led.previewSettled();
                    const screen = document.querySelector('settings-screen');
                    await screen.updateComplete;
                    const before = window.__settings.server();
                    screen.shadowRoot.getElementById('band').shadowRoot.getElementById('cancel').click();
                    await new Promise((r) => setTimeout(r, 30));
                    return {
                        resets: window.__settings.server().ledResets - before.ledResets,
                        writes: window.__settings.server().ledWrites - before.ledWrites,
                        dirty: led.get().dirty,
                    };
                });
                assert.equal(cancelled.resets, 1,
                    'Cancel re-reads the palette, which is what the route is for');
                assert.equal(cancelled.writes, 0,
                    'and it writes nothing: the cancelled colour never left the tablet');
                assert.equal(cancelled.dirty, false);

                await show('accessories', 'accessories-lighting');
                const nothingToSave = await page.evalFn(async () => {
                    const screen = document.querySelector('settings-screen');
                    const before = window.__settings.server();
                    screen.shadowRoot.getElementById('band').shadowRoot.getElementById('save').click();
                    await new Promise((r) => setTimeout(r, 30));
                    const after = window.__settings.server();
                    return after.ledWrites - before.ledWrites;
                });
                assert.equal(nothingToSave, 0,
                    'a clean page still just closes — Save must not write a palette nobody edited');
                await show('accessories', 'accessories-lighting');
            });

            test('the grid reports the two colours the machine holds, and Both is not one', async () => {

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

                const hex = after.wantFill.replace('#', '');
                const want = `rgb(${parseInt(hex.slice(0, 2), 16)}, ${parseInt(hex.slice(2, 4), 16)}, `
                    + `${parseInt(hex.slice(4, 6), 16)})`;
                assert.equal(after.currentFill, want,
                    'the current cell must still be the machine\'s colour, not the selected face');

                assert.notEqual(after.currentBorder, after.restingBorder,
                    'the current cell is not marked at all');
            });

            test('the zone and state banks pick which palette entry is edited', async () => {
                await serve(['ledStrip']);
                await show('accessories', 'accessories-lighting');
                const moved = await page.evalFn(async () => {
                    const bespoke = window.__settings.bespokeEl();
                    const bank = bespoke.shadowRoot.getElementById('led-bank');

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

                const beanie = cards.find((card) => card.skin === 'beanie');
                assert.equal(beanie?.version, 'v0.3.5');

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
                const target = `settings-screen >>> #bespoke >>> #theme-bank >>> #item-${other === 'dark' ? 0 : 1}`;
                await page.evalFn((selector) => {
                    window.__h.need(selector).scrollIntoView({ block: 'center', inline: 'nearest' });
                    return true;
                }, target);
                await page.settle();
                const visible = await page.evalFn((selector) => {
                    const button = window.__h.need(selector).getBoundingClientRect();
                    const pane = __settings.screen().shadowRoot.getElementById('leaf-pane').getBoundingClientRect();
                    return button.top >= pane.top && button.bottom <= pane.bottom;
                }, target);
                assert.equal(visible, true, 'the theme choice is inside the visible scroll pane before the pointer press');
                await page.click(target);
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

        describe('#38 renders centred, as authored (T11)', () => {
            test('every empty state this cluster can show is centred inside its own root', async () => {
                await serve(['wakeSchedule']);

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

                        assert.equal(state.textAlign, 'center', `${leafId}/${state.id} is not centred`);
                        near(state.leftGap, state.rightGap, `${leafId}/${state.id} sits off-centre`, 2.01);
                    }
                }
            });
        });

        describe('each leaf composes the component §4.4 gives it', () => {
            test('the named component is on screen for each of the nine', async () => {
                await serve(['ledStrip', 'scaleCalibration', 'wakeSchedule']);
                const expected = {

                    'machine-machine-info': 'ui-button',
                    'machine-sleep-wake-schedules': 'ui-list-row',
                    'display-skin': 'ui-card-grid',

                    'updates-skin-app': 'ui-button',

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

                assert.deepEqual(terms.slice(0, 4),
                    ['Model', 'Firmware version', 'Serial number', 'Group head controller']);
                assert.equal(rows[0].value, 'Bengle');
                assert.equal(rows[1].value, '282');

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

                assert.equal(grid.buttons, grid.cards - 1,
                    'every card but the active one is a press target');
            });

            test('the update list states its count in words, and draws no bar under them', async () => {

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

                assert.equal(remembered.word, 'Unavailable');

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

                        aligned: cell && sw
                            ? Math.abs(cell.getBoundingClientRect().left - sw.getBoundingClientRect().left) < 40
                            : false,
                    };
                });
                assert.equal(report.heads, 1, 'the word is stated once, whatever the row count');
                assert.equal(report.word, 'Preferred');
                assert.equal(report.aligned, true, 'over the switch column, not floating above the list');
                assert.equal(new Set(report.heights).size, 1,
                    'and no row is taller than its neighbours — the reported regression');
            });

            test('both pages say that Search does not connect for you', async () => {

                for (const leaf of ['connection-machine', 'connection-scale']) {
                    await show('connection', leaf);
                    const said = await page.evalFn(() => window.__settings.bespokeEl()
                        .shadowRoot.getElementById('devices-search-note')?.textContent.trim() ?? null);
                    assert.match(said ?? '', /Nothing is connected automatically/, `${leaf} does not say it`);
                }
            });

            test('a REFUSED device action is reported where the button was pressed', async () => {

                await page.evalFn(() => window.__settings.failRoute('PUT /devices/forget'));
                await show('connection', 'connection-machine');

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

        describe('nothing flashes without a class check and a confirmation', () => {

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

        /* ════════════════════════════════════════════════════════════════════
         * NO CONTROL IS ZERO-WIDE, on any bespoke leaf
         * ═══════════════════════════════════════════════════════════════════ */

        describe('every control a bespoke leaf draws has a size', () => {

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

        describe('the app-settings rows show what the app is set to', () => {

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

        describe('the setpoint and the plate reading are two numbers', () => {

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

                const noRows = await seamOf('extensions', 'extensions-plugins');
                assert.equal(noRows.rows, 0, 'Plugins holds no registry rows, so the seam is to the description');
                assert.equal(noRows.seam, 18, 'and it is one rhythm step, not zero');

                const withRows = await seamOf('display', 'display-skin');
                assert.ok(withRows.rows > 0, 'Skin holds registry rows, so the seam is to the last of them');
                assert.equal(withRows.seam, 18, 'and it is the same step again');

            });
        });

        describe('Default load settings says what the reset would actually change', () => {

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

                assert.ok(bengle.reachable.includes('Flow Multiplier'),
                    'the Flow Multiplier PAGE is in a Bengle nav — the gate is on the row now, '
                    + 'so a dash here must not be coming from a hidden leaf');
                assert.doesNotMatch(bengle.detail, /flow multiplier/i,
                    'and the confirm sentence does not send a Bengle to a DE1-only page');
                assert.match(bengle.detail, /goes back to the machine/i,
                    'it is still a sentence, not a bare list');

                await serve([]);
                await show('calibration', 'calibration-default-load-settings');
                const de1 = await survey();
                assert.equal(de1.machineClass, 'de1', 'the served set says DE1');
                assert.ok(de1.pages.includes('Flow Multiplier'),
                    'a DE1 has that page, so its name belongs in the column');
                assert.match(de1.detail, /flow multiplier/i,
                    'and in the sentence, from the same derivation');

                await serve(['scaleCalibration']);
            });

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

                assert.deepEqual(bounds, { min: 5, max: 300, step: 5 });
            });

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

                assert.deepEqual({ min: got.min, max: got.max, step: got.step },
                    { min: 5, max: 300, step: 5 });
                assert.equal(got.unit, 'min');
            });

            test('Calibration weight goes by the MACHINE door, under its served key', async () => {
                await serve(['scaleCalibration']);

                await show('calibration', 'calibration-hardware');
                await show('calibration', 'calibration-load-cells');

                await page.evalFn(() => window.__settings.calibrationState({
                    step: 'idle', status: 'none', secondsRemaining: 0, subState: 'settling', detectedCell: 'none',
                }).then(() => true));
                await page.settle();

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

                await page.evalFn(() => window.__settings.failRoute('PUT /machine/state/airPurge', false));

                const purge = await reportOf('air-purge');
                assert.match(purge.refusal, /refused/i, 'the page that asked reports the refusal');

                await show('maintenance', 'maintenance-machine-descaling');
                const descale = await reportOf('descale');
                assert.equal(descale.refusal, null,
                    'a refusal for a request this page never made is worse than silence');

                assert.doesNotMatch(descale.status ?? '', /asked to start/i,
                    'an acknowledgement of a request this page never made is the same defect');
                assert.doesNotMatch(descale.status ?? '', /water/i,
                    'and no sentence about the purge may appear under the Descaling heading');
            });

            test('an out-of-water machine blocks Start and says how to override it', async () => {
                await machineIs('needsWater');
                await show('maintenance', 'maintenance-transport-mode');
                const blocked = await reportOf('air-purge');
                assert.equal(blocked.startDisabled, true,
                    'the page must not walk the reader into pressing a button the machine refuses');
                assert.match(blocked.blocked, /out of water/i);
                assert.match(blocked.blocked, /stop button/i,
                    'the remedy is stated, or the block is just another dead end');

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

                for (const field of fields) {
                    assert.equal(field.pattern, null);
                    assert.equal(field.invalid, null);
                }
            });
        });

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

        describe('a refused write is said out loud, on the control that asked', () => {
            const text = (id) => page.evalFn((elementId) => window.__settings.bespokeEl()
                .shadowRoot.getElementById(elementId)?.textContent?.trim() ?? null, id);

            const fail = async (key, on = true) => {
                await page.evalFn(([k, flag]) => window.__settings.failRoute(k, flag), [key, on]);
            };

            test('a schedule the machine refuses keeps its dialog, its values AND a reason', async () => {
                await serve(['wakeSchedule']);
                await show('machine', 'machine-sleep-wake-schedules');
                await fail('POST /presence/schedules');
                await page.evalFn(() => {
                    window.__settings.bespokeEl().shadowRoot.getElementById('schedule-add').click();
                    return true;
                });
                await page.settle();
                await page.evalFn(() => {
                    const root = window.__settings.bespokeEl().shadowRoot;
                    root.getElementById('schedule-dialog').querySelector('[slot="actions"][variant="primary"]').click();
                    return true;
                });
                await page.settle(3);

                const shown = await page.evalFn(() => {
                    const root = window.__settings.bespokeEl().shadowRoot;
                    return {
                        open: Boolean(root.getElementById('schedule-dialog')),
                        refusal: root.getElementById('schedule-refusal')?.textContent?.trim() ?? null,
                    };
                });
                assert.equal(shown.open, true, 'the draft stays on screen, as it always did');
                assert.notEqual(shown.refusal, null, 'and now the page says why it is still there');
                assert.match(shown.refusal, /not saved/i);
                assert.match(shown.refusal, /503|refuse/i,
                    'the machine own words ride along with the sentence');

                await fail('POST /presence/schedules', false);
                await page.evalFn(() => {
                    const root = window.__settings.bespokeEl().shadowRoot;
                    root.getElementById('schedule-dialog').querySelector('[slot="actions"][variant="primary"]').click();
                    return true;
                });
                await page.settle(3);
                const after = await page.evalFn(() => {
                    const root = window.__settings.bespokeEl().shadowRoot;
                    return {
                        open: Boolean(root.getElementById('schedule-dialog')),
                        refusal: root.getElementById('schedule-refusal')?.textContent?.trim() ?? null,
                    };
                });
                assert.equal(after.open, false, 'the retry saved it and the dialog shut');
                assert.equal(after.refusal, null, 'and the sentence went with the refusal');
            });

            test('a calibration command the machine refuses says so on the wizard', async () => {
                await serve(['scaleCalibration']);
                await show('calibration', 'calibration-load-cells');
                await page.evalFn(() => window.__settings.pressWizard());
                await page.settle();
                await fail('PUT /machine/scaleCalibration');
                await page.evalFn(() => window.__settings.pressWizard());
                await page.settle(3);

                const refusal = await text('cal-refusal');
                assert.notEqual(refusal, null, 'a refused Zero must not look like a Zero nobody pressed');
                assert.match(refusal, /not sent|would not/i);
                await fail('PUT /machine/scaleCalibration', false);
            });

            test('a plugin Save the machine refuses keeps the draft and names the failure', async () => {
                await show('extensions', 'extensions-visualizer');
                await fail('POST /plugins/visualizer.reaplugin/settings');
                await page.evalFn(() => {
                    const root = window.__settings.bespokeEl().shadowRoot;
                    const row = root.querySelector('#plugin-settings .form-row[data-field="Username"]');
                    const field = row.querySelector('ui-text-field');
                    field.value = 'someone-else';
                    field.dispatchEvent(new CustomEvent('change', {
                        detail: { value: 'someone-else' }, bubbles: true, composed: true,
                    }));
                    return true;
                });
                await page.settle();
                await page.evalFn(() => {
                    window.__settings.bespokeEl().shadowRoot.getElementById('plugin-save').click();
                    return true;
                });
                await page.settle(3);

                const shown = await page.evalFn(() => {
                    const root = window.__settings.bespokeEl().shadowRoot;
                    const row = root.querySelector('#plugin-settings .form-row[data-field="Username"]');
                    return {
                        refusal: root.getElementById('plugin-refusal')?.textContent?.trim() ?? null,
                        typed: row.querySelector('ui-text-field')?.value ?? null,
                        saveDisabled: root.getElementById('plugin-save')?.hasAttribute('disabled') ?? null,
                    };
                });
                assert.notEqual(shown.refusal, null, 'a refused Save must not read as an unpressed one');
                assert.match(shown.refusal, /not saved/i);
                assert.equal(shown.typed, 'someone-else', 'and the typed value is still there to retry');
                assert.equal(shown.saveDisabled, false, 'with the button still live to retry it');
                await fail('POST /plugins/visualizer.reaplugin/settings', false);
            });

            test('a night-mode time the machine refuses does not look saved', async () => {
                await show('accessories', 'accessories-usb-charger');
                await fail('POST /settings');
                await page.evalFn(() => {
                    window.__settings.bespokeEl().shadowRoot.getElementById('night-sleep').click();
                    return true;
                });
                await page.settle();
                await page.evalFn(() => {
                    const picker = window.__settings.bespokeEl().shadowRoot.getElementById('night-picker');
                    picker.dispatchEvent(new CustomEvent('change', {
                        detail: { value: '05:45' }, bubbles: true, composed: true,
                    }));
                    return true;
                });
                await page.settle(3);

                const refusal = await text('night-refusal');
                assert.notEqual(refusal, null,
                    'this store answers false and publishes nothing, so the page is the only witness');
                assert.match(refusal, /not saved/i);
                await fail('POST /settings', false);
            });

            test('a palette the machine refuses is still on screen, with the reason under it', async () => {
                await serve(['ledStrip']);
                await show('accessories', 'accessories-lighting');
                await fail('PUT /machine/ledStrip');
                await page.evalFn(() => window.__settings.pickSwatch(3));
                await page.settle();
                await page.evalFn(async () => {
                    await window.__settings.stores().led.commit();
                    await window.__settings.bespokeEl().updateComplete;
                    return true;
                });
                await page.settle(2);

                const shown = await page.evalFn(() => ({
                    refusal: window.__settings.bespokeEl().shadowRoot
                        .getElementById('led-refusal')?.textContent?.trim() ?? null,
                    dirty: window.__settings.stores().led.get().dirty,
                }));
                assert.notEqual(shown.refusal, null);
                assert.match(shown.refusal, /would not take|not connected/i);
                assert.equal(shown.dirty, true, 'and the change is still staged to try again');

                await fail('PUT /machine/ledStrip', false);
                await page.evalFn(() => window.__settings.stores().led.reset().then(() => true));
                await page.settle();
            });

            test('ONE STATUS, and it says which of the three things is happening', async () => {

                await serve(['ledStrip']);
                await show('accessories', 'accessories-lighting');
                await page.evalFn(() => window.__settings.stores().led.reset().then(() => true));
                await page.settle();

                const clean = await text('led-status');
                assert.notEqual(clean, null, 'a page with no status is a page that says nothing');
                assert.doesNotMatch(clean, /as you pick them/i,
                    'the write that stores the colours is not the one a drag makes');
                assert.doesNotMatch(clean, /only show while the machine is asleep/i,
                    'the preview route is exactly what shows an asleep colour on an awake machine');
                assert.match(clean, /Save/, 'so the sentence names the gesture that keeps them');
                assert.ok(clean.split(/[.!?]/).filter((part) => part.trim() !== '').length <= 2,
                    `one short status, not a paragraph: ${clean}`);

                await page.evalFn(async () => {
                    await window.__settings.pickSwatch(4);
                    await window.__settings.stores().led.previewSettled();
                    await window.__settings.bespokeEl().updateComplete;
                    return true;
                });
                await page.settle();
                assert.match(String(await text('led-status')), /showing on the machine/i,
                    'the strip is following the picker and the page does not say so');

                await page.evalFn(() => window.__settings.stores().led.reset().then(() => true));
                await page.settle();
            });

            test('A REAL POINTER DRAG ON THE WHEEL REACHES THE STRIP, and coalesces on the way',
                async () => {

                    await serve(['ledStrip']);
                    await show('accessories', 'accessories-lighting');
                    await page.evalFn(() => window.__settings.stores().led.reset().then(() => true));
                    await page.settle();

                    const before = await page.evalFn(() => {

                        window.__settings.bespokeEl().shadowRoot.getElementById('led-wheel')
                            .scrollIntoView({ block: 'center' });
                        window.__settings.clearWire();
                        return window.__settings.ledCounters();
                    });
                    await page.settle(2);

                    const box = await page.box('settings-screen >>> #bespoke >>> #led-wheel >>> .IroWheel');
                    const at = (step) => {
                        const turn = (step * 20 * Math.PI) / 180;
                        return {
                            x: box.x + box.width / 2 + Math.cos(turn) * box.width * 0.37,
                            y: box.y + box.height / 2 + Math.sin(turn) * box.height * 0.37,
                        };
                    };
                    const held = { button: 'left', buttons: 1 };
                    await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...at(0) });
                    await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...at(0), ...held, clickCount: 1 });
                    for (let step = 1; step <= 12; step += 1) {
                        await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...at(step), ...held });
                        await page.settle(1);
                    }
                    await page.send('Input.dispatchMouseEvent', {
                        type: 'mouseReleased', ...at(12), button: 'left', buttons: 0, clickCount: 1,
                    });
                    await page.settle(2);

                    const drag = await page.evalFn(async () => {
                        const api = window.__settings;
                        await api.stores().led.previewSettled();
                        await api.bespokeEl().updateComplete;
                        return {
                            wire: api.wire(),
                            server: api.server(),
                            counters: api.ledCounters(),
                            hex: api.stores().led.hex('frontStrip', 'awake'),
                            dirty: api.stores().led.get().dirty,
                            status: api.bespokeEl().shadowRoot
                                .getElementById('led-status').textContent.trim(),
                        };
                    });

                    assert.ok(drag.counters.intents - before.intents > 2,
                        `a real drag has to produce real events: ${drag.counters.intents - before.intents} intents`);
                    assert.ok(drag.wire.length > 0,
                        'a drag on the wheel put NOTHING on the wire — the whole finding');
                    assert.deepEqual([...new Set(drag.wire)], ['POST /machine/ledStrip/preview'],
                        `a drag sent something other than previews: ${drag.wire.join(', ')}`);
                    assert.equal(drag.counters.sent, before.sent,
                        'and it must never touch the stored palette: every PUT is a flash write');
                    assert.equal(drag.counters.previewPeak, 1, 'one request in flight, never two');
                    assert.ok(drag.wire.length <= drag.counters.intents - before.intents,
                        `the slot has to coalesce, or a drag is a request per frame: `
                        + `${drag.wire.length} requests for ${drag.counters.intents - before.intents} frames`);

                    const shown = drag.server.ledShown.frontStrip;
                    assert.equal(
                        `#${shown.slice(0, 2)}${shown.slice(4, 6)}${shown.slice(8, 10)}`.toLowerCase(),
                        drag.hex.toLowerCase(),
                        'the strip is showing a colour the picker is not',
                    );
                    assert.equal(drag.dirty, true, 'and it is still an edit nobody has saved');
                    assert.match(drag.status, /showing on the machine/i);

                    await show('machine', 'machine-steam');
                    await page.settle(2);
                    const left = await page.evalFn(() => ({
                        shown: window.__settings.server().ledShown,
                        clears: window.__settings.server().ledPreviewClears,
                        dirty: window.__settings.stores().led.get().dirty,
                    }));
                    assert.equal(left.shown, null,
                        'walking to another page left the tried colour on the strip for hours');
                    assert.ok(left.clears > 0, 'and nothing ended the preview');
                    assert.equal(left.dirty, true,
                        'leaving the leaf is not Cancel — the header still counts the edit');

                    await show('accessories', 'accessories-lighting');
                    await page.evalFn(() => window.__settings.stores().led.reset().then(() => true));
                    await page.settle();
                });

            test('the grid is called Colours, because a draft is not what the machine holds', async () => {
                await serve(['ledStrip']);
                await show('accessories', 'accessories-lighting');
                const headings = await page.evalFn(() => [...window.__settings.bespokeEl()
                    .shadowRoot.querySelectorAll('#lighting .ui-heading')].map((el) => el.textContent.trim()));
                assert.ok(headings.includes('Colours'),
                    `the grid reads the draft, so "Current colours" is a claim about the machine: ${headings.join(' / ')}`);
                assert.ok(!headings.includes('Current colours'), 'and the old label is gone');
            });

            test('the brightness slider is named, and zero says Off rather than nothing', async () => {

                await serve(['ledStrip']);
                await show('accessories', 'accessories-lighting');

                const lit = await page.evalFn(async () => {
                    const api = window.__settings;
                    await api.stores().led.reset();
                    await api.pickSwatch(1);
                    await api.bespokeEl().updateComplete;
                    const wheel = api.bespokeEl().shadowRoot.getElementById('led-wheel');
                    await wheel.updateComplete;
                    const row = wheel.shadowRoot.getElementById('brightness');
                    return { text: row?.textContent.replace(/\s+/g, ' ').trim() ?? null };
                });
                assert.notEqual(lit.text, null, 'the slider has no name and no value beside it');
                assert.match(lit.text, /Brightness/, 'the ordinary name, where a label goes');
                assert.match(lit.text, /\d+%/, 'and the value the slider is showing');

                const dark = await page.evalFn(async () => {
                    const api = window.__settings;
                    const bespoke = api.bespokeEl();
                    bespoke.shadowRoot.getElementById('led-power').dispatchEvent(new CustomEvent('change', {
                        detail: { checked: false }, bubbles: true, composed: true,
                    }));
                    await bespoke.updateComplete;
                    const wheel = bespoke.shadowRoot.getElementById('led-wheel');
                    await wheel.updateComplete;
                    return {
                        text: wheel.shadowRoot.getElementById('brightness')?.textContent
                            .replace(/\s+/g, ' ').trim() ?? null,
                        hex: api.stores().led.hex('frontStrip', 'awake'),
                    };
                });
                assert.equal(dark.hex, '#000000', 'the strip has to be dark, or this proves nothing');
                assert.match(String(dark.text), /Off/,
                    'zero brightness with no word for it is what makes a working wheel look broken');
                assert.doesNotMatch(String(dark.text), /0%/,
                    'Off is the word; a number beside it would be two answers to one question');

                const near = await page.evalFn(() => {
                    const root = window.__settings.bespokeEl().shadowRoot;
                    const wheel = root.getElementById('led-wheel').getBoundingClientRect();
                    const power = root.getElementById('led-power').getBoundingClientRect();
                    return power.top - wheel.bottom;
                });
                assert.ok(near >= 0 && near < 80,
                    `Power belongs next to the word Off, not a column away: ${near}px below the wheel`);

                await page.evalFn(() => window.__settings.stores().led.reset().then(() => true));
                await page.settle();
            });

            test('POWER FOLLOWS THE SELECTED ZONE — Front leaves the rear strip alone', async () => {

                await serve(['ledStrip']);
                await show('accessories', 'accessories-lighting');

                const run = await page.evalFn(async () => {
                    const api = window.__settings;
                    const bespoke = api.bespokeEl();
                    await api.stores().led.reset();
                    const bank = bespoke.shadowRoot.getElementById('led-zone');
                    bank.dispatchEvent(new CustomEvent('change', {
                        detail: { value: 'front' }, bubbles: true, composed: true,
                    }));
                    await bespoke.updateComplete;
                    await api.pickSwatch(1);
                    await api.stores().led.previewSettled();
                    const before = api.stores().led.hex('backStrip', 'awake');

                    const was = api.server();
                    bespoke.shadowRoot.getElementById('led-power').dispatchEvent(new CustomEvent('change', {
                        detail: { checked: false }, bubbles: true, composed: true,
                    }));
                    await bespoke.updateComplete;
                    await api.stores().led.previewSettled();
                    const led = api.stores().led;
                    return {
                        before,
                        front: led.hex('frontStrip', 'awake'),
                        switchZone: led.hex('frontSwitch', 'awake'),
                        rear: led.hex('backStrip', 'awake'),
                        editing: bespoke.shadowRoot.getElementById('led-editing').textContent
                            .replace(/\s+/g, ' ').trim(),
                        preview: api.server().ledPreviewLast,
                        was,
                    };
                });

                assert.match(run.editing, /Front/, 'the page has to say Front, or there is no contradiction');
                assert.equal(run.front, '#000000');
                assert.equal(run.switchZone, '#000000', 'the switch rides with the front');
                assert.equal(run.rear, run.before,
                    'Power off beside "Front" darkened the rear strip');
                assert.equal(run.preview.backStrip, undefined,
                    'and named it in a preview body that had no business naming it');

                await page.evalFn(() => window.__settings.stores().led.reset().then(() => true));
                await page.settle();
            });
        });

        describe('the version line is a reading of the versions, never of the phase', () => {
            const line = () => page.evalFn(() => {
                const root = window.__settings.bespokeEl().shadowRoot;
                return {
                    state: root.getElementById('app-update-state')?.textContent?.trim() ?? null,
                    badge: root.getElementById('app-update-badge')?.textContent?.trim() ?? null,
                    install: root.getElementById('app-install')?.textContent?.trim() ?? null,
                    error: root.getElementById('app-update-error')?.textContent?.trim() ?? null,
                };
            });

            const frame = async (value) => {
                await page.evalFn((f) => window.__settings.appUpdateFrame(f).then(() => true), value);
                await page.settle();
            };

            test('a download that failed still says a newer build is there', async () => {
                await show('updates', 'updates-skin-app');
                await frame({
                    phase: 'error',
                    currentVersion: '1.0.0-bengle.1',
                    latestVersion: '9.0.0',
                    releaseUrl: 'https://example.invalid/releases',
                    installable: true,
                    error: 'Update failed: download interrupted',
                });
                const shown = await line();
                assert.match(shown.state, /9\.0\.0/,
                    'the version it found does not stop existing because the download failed');
                assert.doesNotMatch(shown.state, /newest build/i,
                    'and the installed build is not the newest — that is why there was a download');
                assert.notEqual(shown.error, null, 'the failure is still reported');
                assert.equal(shown.install, null,
                    'and Install is not offered again from an error frame without a fresh check');
            });

            test('an error that names no version claims nothing at all', async () => {
                await show('updates', 'updates-skin-app');
                await frame({
                    phase: 'error',
                    currentVersion: '1.0.0-bengle.1',
                    latestVersion: null,
                    releaseUrl: 'https://example.invalid/releases',
                    installable: false,
                    error: 'Update check failed: network unreachable',
                });
                const shown = await line();
                assert.doesNotMatch(shown.state, /newest build/i,
                    'a check that failed is not a check that found nothing');
                assert.match(shown.state, /not known/i);
                assert.equal(shown.badge, null);
            });

            test('up to date is claimed when the newest version IS the one running', async () => {
                await show('updates', 'updates-skin-app');
                await frame({
                    phase: 'available',
                    currentVersion: '2.5.0',
                    latestVersion: '2.5.0',
                    releaseUrl: 'https://example.invalid/releases',
                    installable: false,
                });
                const shown = await line();
                assert.match(shown.state, /newest build/i,
                    'two named versions that match is the strongest claim there is');
                assert.equal(shown.badge, null, 'and nothing is offered');
                assert.equal(shown.install, null);
            });

            test('a check that completed and found nothing says THAT, and not more', async () => {
                await show('updates', 'updates-skin-app');
                await frame({
                    phase: 'idle',
                    currentVersion: '1.0.0-bengle.1',
                    latestVersion: null,
                    releaseUrl: 'https://example.invalid/releases',
                    installable: false,
                });

                assert.match((await line()).state, /not known/i);

                await frame({
                    phase: 'checking',
                    currentVersion: '1.0.0-bengle.1',
                    latestVersion: null,
                    releaseUrl: 'https://example.invalid/releases',
                    installable: false,
                });
                assert.match((await line()).state, /Looking for a newer build/i);

                await frame({
                    phase: 'idle',
                    currentVersion: '1.0.0-bengle.1',
                    latestVersion: null,
                    releaseUrl: 'https://example.invalid/releases',
                    installable: false,
                });
                const shown = await line();
                assert.match(shown.state, /No newer build was found/i,
                    'the server reported its own comparison, and that is what is said');
                assert.doesNotMatch(shown.state, /newest build/i,
                    'which is a weaker claim than naming the newest version, on purpose');
                await frame(null);
            });
        });

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

                    for (const label of rows) {
                        assert.match(String(label), /(AM|PM)/i,
                            `a schedule row still prints the wire string: ${label}`);
                    }
                }
                await pickFormat('24h');
                await serve(null);
            });
        });

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
                await page.evalFn(() => window.__settings.armSkinUpdate({ 'decal': '0.1.100' }));
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

                assert.equal(moved.badges.length, 1);
                assert.match(moved.badges[0], /0\.1\.100/);

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

                await show('updates', 'updates-firmware-update');
                await page.evalFn(() => window.__settings.firmwareCatalog({}));
                await page.settle();
                const got = await firmware();
                assert.equal(got.noteBeforeActions, true, 'the caution still sits after the controls');
                assert.equal(got.noteBorder, '3px', 'Slate’s 3px danger rule down the leading edge');
                assert.notEqual(got.noteBackground, 'rgba(0, 0, 0, 0)', 'the tint is what makes it not a caption');

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

                assert.doesNotMatch(got.text, /on your phone/i);
                assert.doesNotMatch(got.text, /add this machine/i);
                assert.match(got.steps.join(' '), /ReaPrime/);
                assert.match(got.steps.join(' '), /email and password/i);

                assert.match(got.steps[2], /message box/i,
                    'step three promises the message box, which the linked branch now builds');
            });

            test('a machine WITH an account is not shown instructions for linking one', async () => {

                await page.evalFn(() => window.__settings.accountState({ loggedIn: true }));
                await show('help', 'help-talk-to-decent');
                const got = await pane();
                assert.deepEqual(got.steps, []);
                assert.doesNotMatch(got.text, /Signing in happens/i);
                assert.match(got.text, /signed in/i);
                await page.evalFn(() => window.__settings.accountState({ loggedIn: false }));
            });

            test('the chip is a word and the sentence is a heading, which is Slate’s own shape', async () => {

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

                assert.match(got.messages[0].text, /grind seems coarse/);
                assert.match(got.messages[1].text, /1\.2 finer/);
                /* WHO WROTE IT. `from_user` is the ONLY thing on the record that says so
                 * non-empty means Decent, absent means the account. */
                assert.equal(got.messages[0].from, 'you');
                assert.equal(got.messages[1].from, 'decent');
                assert.match(got.messages[1].text, /Support/);
                assert.equal(got.empty, null, 'a thread with messages must not also say it is empty');
                assert.equal(got.error, null);
            });

            test('a thread with an empty value in it still reads, which is what Slate’s regex was for', async () => {
                await linkedPane();
                await page.evalFn(() => window.__settings.supportThread(
                    '[{"from_user":"Support","now":1756200000,"subject": ,"body":"No subject on this one."}]',
                ));
                const got = await box();
                assert.equal(got.error, null, 'the one malformed shape Slate documents is repaired, not reported');
                assert.equal(got.messages.length, 1);
                assert.match(got.messages[0].text, /No subject on this one/);
                await page.evalFn(() => window.__settings.supportThread(
                    JSON.stringify([{ from_user: 'Support', now: 1756200000, subject: 'Re: grinder', body: 'Try 1.2 finer.' }]),
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
                    JSON.stringify([{ from_user: 'Support', now: 1756200000, subject: 'Re: grinder', body: 'Try 1.2 finer.' }]),
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

                const bearers = await page.evalFn(() => window.__settings.supportBearers());
                assert.ok(bearers.length > 0);
                assert.ok(bearers.every((value) => value === 'Bearer fixture-bearer'),
                    `a proxied call went out without the bearer: ${JSON.stringify(bearers)}`);

                const got = await box();
                assert.match(got.sent, /Message sent/i);
            });

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

                assert.match(got.text, /public/i);
                assert.match(got.text, /help@decentespresso\.com/);
            });

            test('the system-info helper names what is actually attached, and no firmware', async () => {

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
