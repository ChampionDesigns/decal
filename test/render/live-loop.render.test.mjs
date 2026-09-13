/**
 * THE 15 Hz LIVE LOOP.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { launch, GATE_A_GEOMETRIES, BENCH } from '../harness/index.js';
import { DRILL_COLOUR } from '../harness/assertions.js';

const REPO = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const MODULES = ['/test/fixtures/live-loop-fixture.js', '/test/fixtures/probe-screen.js'];

const BUDGET_HZ = 15;

const SCRIPT = {
    rate: BUDGET_HZ,
    timeline: [
        { phase: 'pre-shot', frames: 12 },
        { phase: 'in-shot', frames: 220 },
        { phase: 'post-shot', seconds: 1 },
    ],
};

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

async function startMock(args = []) {
    const port = await freePort();
    const child = spawn('python3', ['tools/mock_rea.py', '--port', String(port), ...args],
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

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

/* ═══════════════════════════════════════════════════════════════════════════
 * THE RUN
 * ═════════════════════════════════════════════════════════════════════════ */

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`the 15 Hz live loop @ ${geometry.name} (${geometry.width}x${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {
        let mock;
        let page;
        let scriptPath;
        /** Everything the run produced. Filled by the driver test, read by the rest. */
        const run = { phases: {}, errors: null };

        before(async () => {
            const fs = await import('node:fs/promises');
            const os = await import('node:os');
            scriptPath = path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'live-loop-')), 'run.json');
            await fs.writeFile(scriptPath, JSON.stringify(SCRIPT));
            mock = await startMock(['--ws-script', scriptPath]);
            page = await browser.newPage({ geometry });
        });

        after(async () => {
            try {
                await page?.close();
            } finally {
                mock?.stop();
                const fs = await import('node:fs/promises');
                await fs.rm(path.dirname(scriptPath), { recursive: true, force: true });
            }
        });

        const need = (key) => {
            assert.ok(run[key], `the run did not reach '${key}' — see the driver test`);
            return run[key];
        };

        test('DRIVE: boot the real shell against the mock and play the recorded shot', async (t) => {
            const clock = {};
            const mark = async (name, fn) => {
                const t0 = Date.now();
                const value = await fn();
                clock[name] = Date.now() - t0;
                return value;
            };

            await mark('mount', async () => {
                await page.mount('', MODULES);
                run.boot = await page.evalFn((port) => window.__loop.mount({ port }), mock.port);
            });

            await mark('idle-head', async () => {
                await page.evalFn(() => window.__loop.pushMachineFrame('idle'));
                await page.settle(2);
                run.headerIdleBefore = await page.evalFn(() => window.__loop.header());
                run.stateIdleBefore = await page.evalFn(() => window.__loop.state());
            });

            await mark('stream-start', async () => {
                run.streamStart = await page.evalFn(() => window.__loop.startStream());
                await page.evalFn(() => window.__loop.untilMachineState('espresso'));
                run.headerRunning = await page.evalFn(() => window.__loop.header());
                run.firstSamples = await page.evalFn(() => window.__loop.untilInShot(20));
            });

            run.window = await mark('rate-window', () => page.evalFn(
                (ms) => window.__loop.rateWindow(ms), 4000,
            ));

            run.reload = await mark('reload', () => page.evalFn(() => window.__loop.reloadScreen()));

            await mark('canvas', async () => {
                await page.setToken('--ui-channel-pressure', DRILL_COLOUR);
                run.canvasA = await page.evalFn(() => window.__loop.canvasSample());
                await new Promise((r) => setTimeout(r, 2500));
                run.canvasB = await page.evalFn(() => window.__loop.canvasSample());
                /* The band between the two samples' x maxima is shot-time that did not
                 * exist when the first sample was taken. Ink there is ADVANCE. */
                run.drillNew = await page.evalFn(
                    (from, to) => window.__loop.drillBand(from, to),
                    run.canvasA.xMax + 0.05, run.canvasB.xMax,
                );
                run.drillOld = await page.evalFn(
                    (from, to) => window.__loop.drillBand(from, to),
                    run.canvasA.xMin, run.canvasA.xMax - 0.05,
                );
                await page.setToken('--ui-channel-pressure', null);
            });

            run.sweep = await mark('sweep', async () => {
                const box = await page.evalFn(() => window.__loop.plotBox());
                const readings = [];
                for (let i = 1; i <= 7; i += 1) {
                    const x = box.left + (box.width * i) / 8;
                    const y = box.top + box.height / 2;
                    await page.mouse('mouseMoved', x, y);
                    readings.push(await page.evalFn(() => window.__loop.cursor()));
                }
                return { box, readings };
            });

            run.footLive = await mark('foot-live', () => page.evalFn(() => window.__loop.footBandVsGate6()));

            await mark('shot-end', async () => {
                run.closedPhase = await page.evalFn(() => window.__loop.untilShotClosed());
                run.quietFrames = await page.evalFn(() => window.__loop.untilQuiet(600));
                await page.settle(2);
                run.footFrozen = await page.evalFn(() => window.__loop.footBandVsGate6());
                run.canvasFinal = await page.evalFn(() => window.__loop.canvasSample());
            });

            run.staleness = await mark('staleness', () => page.evalFn(() => window.__loop.stalenessProbe(2400)));

            await mark('idle-tail', async () => {
                await page.evalFn(() => window.__loop.pushMachineFrame('idle'));
                await page.evalFn(() => window.__loop.untilMachineState('idle'));
                await page.settle(2);
                run.headerIdleAfter = await page.evalFn(() => window.__loop.header());
            });

            run.final = await page.evalFn(() => window.__loop.state());
            run.phases = clock;
            run.pageErrors = page.pageErrors.slice();

            t.diagnostic(`${geometry.name}: ${run.final.machineFrames} machine frames · `
                + `${run.final.samples} samples · ${run.final.inShot} in-shot · `
                + `${run.final.derivations} derivations · ${run.final.paints} paints`);
            t.diagnostic(`${geometry.name} window: ${run.window.frames} frames / `
                + `${run.window.derivations} derivations / ${run.window.paints} paints in `
                + `${run.window.seconds}s = ${run.window.framesPerSecond} Hz in, `
                + `${run.window.derivationsPerSecond} Hz derived, ${run.window.paintsPerSecond} Hz painted`);
            t.diagnostic(`${geometry.name} wall ms: ${JSON.stringify(clock)}`);

            assert.deepEqual(run.pageErrors, [], 'the whole run must be free of page errors');
        });

        test('the screen took its buffer off the shell — nothing set `shot` by hand', () => {
            const boot = need('boot');
            assert.equal(boot.phase, 'ready', 'the shell reached ready against the mock');
            assert.equal(boot.route, 'live');
            assert.equal(boot.fixtureSetShot, false);
            assert.equal(boot.screenShotIsLiveShot, true,
                '<live-screen>.shot must BE `boot.live.shot` — the one line this item owns');
            assert.deepEqual(boot.sockets, [
                '/ws/v1/devices',
                '/ws/v1/display',
                '/ws/v1/machine/shotState',
                '/ws/v1/machine/snapshot',
                '/ws/v1/machine/waterLevels',
                '/ws/v1/plugins/weather.reaplugin/weather',
                '/ws/v1/scale/snapshot',
                '/ws/v1/update',
            ], 'the eight channels the live layer opens, dialled by the app and by nothing else');
        });

        test('1. socket -> store -> chart: every frame reaches the buffer, and the redraws stay inside the budget', (t) => {
            const w = need('window');
            const final = need('final');
            t.diagnostic(`${geometry.name} loop: ${w.frames} arrivals -> ${w.samples} samples -> `
                + `${w.derivations} derivations -> ${w.paints} paints in ${w.seconds}s `
                + `(${w.framesPerSecond}/${w.derivationsPerSecond}/${w.paintsPerSecond} Hz); `
                + `whole run ${final.machineFrames} frames, ${final.samples} samples, `
                + `${final.derivations} derivations, ${final.paints} paints, `
                + `dropped ${JSON.stringify(final.dropped)}`);

            assert.ok(w.frames >= 30,
                `the machine channel really streamed during the window: ${w.frames} frames in ${w.seconds}s`);
            assert.ok(w.framesPerSecond > BUDGET_HZ * 0.6 && w.framesPerSecond < BUDGET_HZ * 1.25,
                `and at the rate it was asked for: ${w.framesPerSecond} Hz against ${BUDGET_HZ}`);

            assert.ok(w.samples >= w.frames - 1,
                `every arrival became a sample: ${w.samples} samples for ${w.frames} frames`);

            /* THE CEILING. A redraw per arrival is the most the loop may do; anything more
             * is work nothing asked for ("dead weight on the 15 Hz path"). */
            assert.ok(w.derivations <= w.frames,
                `derivations (${w.derivations}) must never exceed arrivals (${w.frames})`);
            assert.ok(w.paints <= w.derivations + 1,
                `and paints (${w.paints}) must not exceed derivations (${w.derivations})`);

            assert.ok(w.derivationsPerSecond <= BUDGET_HZ * 1.1,
                `the chart redrew at ${w.derivationsPerSecond} Hz — the budget is ${BUDGET_HZ}`);
            assert.ok(w.paintsPerSecond <= BUDGET_HZ * 1.1,
                `and painted at ${w.paintsPerSecond} Hz`);
            assert.ok(w.derivations > 0, 'and it did redraw — a still chart proves nothing');

            assert.ok(final.dropped.unusable === 0,
                `no sample was unusable: ${JSON.stringify(final.dropped)}`);
        });

        test('2. the drawn series advances: two canvas samples, and drilled ink in the new time', (t) => {
            const a = need('canvasA');
            const b = need('canvasB');
            const drillNew = need('drillNew');
            const drillOld = need('drillOld');
            t.diagnostic(`${geometry.name} canvas ${a.width}x${a.height}: `
                + `in-shot ${a.inShot} -> ${b.inShot}, x max ${a.xMax.toFixed(2)} -> ${b.xMax.toFixed(2)}s, `
                + `ink ${a.ink} -> ${b.ink} px, checksums ${a.checksum} / ${b.checksum}; `
                + `drilled pressure: ${drillNew.drilled}px in the ${drillNew.width}px of new time, `
                + `${drillOld.drilled}px in the ${drillOld.width}px behind it`);

            assert.ok(a.inShot > 0 && b.inShot > a.inShot,
                `the shot grew between the samples: ${a.inShot} -> ${b.inShot} in-shot samples`);
            assert.ok(b.xMax > a.xMax,
                `and the plot's own x scale grew with it: ${a.xMax} -> ${b.xMax}`);
            assert.notEqual(a.checksum, b.checksum,
                'the CANVAS PIXELS must differ between the two timestamps — a chart that '
                + 'redraws the same picture is not drawing the shot');
            assert.ok(a.ink > 0 && b.ink > 0, 'and both samples have something on them');

            assert.ok(drillNew.width > 2,
                `the new-time band is wide enough to look at: ${drillNew.width}px`);
            assert.ok(drillNew.drilled > 0,
                `the pressure trace is drawn in shot-time that did not exist at the first `
                + `sample (${drillNew.drilled} drilled pixels in ${drillNew.width}px)`);
            assert.ok(drillOld.drilled > 0,
                `and the earlier seconds are still drawn (${drillOld.drilled} drilled pixels)`);
        });

        test('2b. the running shot draws NO cursor under the pointer', () => {
            const { readings } = need('sweep');
            assert.ok(readings.every((r) => !r.active && r.idx === null),
                `no cursor at any swept point mid-stream: ${JSON.stringify(readings.map((r) => r.idx))}`);
        });

        test('3. the foot band tracks the derivation — within a frame live, exactly when frozen', (t) => {
            const live = need('footLive');
            const frozen = need('footFrozen');
            t.diagnostic(`${geometry.name} foot band LIVE (${live.inShot} in-shot): rendered `
                + `${JSON.stringify(live.rendered)} vs gate6 ${JSON.stringify(live.gate6)}`);
            t.diagnostic(`${geometry.name} foot band FROZEN (${frozen.inShot} in-shot): rendered `
                + `${JSON.stringify(frozen.rendered)}; total seconds ${frozen.raw.totalSeconds}, `
                + `weight ${frozen.raw.totalWeight}, volume ${frozen.raw.totalVolume}`);

            assert.equal(live.derivationOk, true, 'gate 6 answered for the live buffer');
            assert.ok(live.inShot > 0);
            assert.notEqual(live.rendered['total.time'], live.dash,
                'the Total row has a time on it while the shot runs');
            assert.notEqual(live.rendered['total.weight'], live.dash,
                'and a weight — the scale channel is in the sample stream');

            const renderedTime = Number(live.rendered['total.time']);
            const gate6Time = Number(live.gate6['total.time']);
            assert.ok(Number.isFinite(renderedTime) && Number.isFinite(gate6Time));
            assert.ok(Math.abs(renderedTime - gate6Time) <= 0.6,
                `mid-shot the phase table is within a frame of gate 6: rendered ${renderedTime}s `
                + `vs derived ${gate6Time}s`);

            /* FROZEN: the shot has closed, no frame can land, and the two must agree cell
             * for cell — the table and the plot read ONE model. */
            assert.equal(frozen.derivationOk, true);
            assert.deepEqual(
                Object.fromEntries(Object.entries(frozen.rendered).map(([k, v]) => [k, v === frozen.dash ? null : v])),
                frozen.gate6,
                'with the buffer frozen every phase-table cell must equal gate 6\'s own number',
            );
            assert.equal(frozen.rendered['total.time'], String(frozen.rounded.totalSeconds));
            assert.equal(frozen.rendered['total.weight'], String(frozen.rounded.totalWeight));
        });

        test('4. a screen mounted mid-stream draws the shot SO FAR, not the tail it saw', (t) => {
            const r = need('reload');
            t.diagnostic(`${geometry.name} reload in ${r.wallMs}ms: in-shot ${r.before.inShot} -> `
                + `${r.after.inShot}, first t ${r.before.firstT} -> ${r.after.firstT}, `
                + `derivations on the new screen ${r.after.derivations}, buffer subscribers `
                + `${r.before.subscribers} -> ${r.away.subscribers} (away) -> ${r.after.subscribers}, `
                + `samples ${r.before.samples} -> ${r.away.samples} (with no screen on the page) `
                + `-> ${r.after.samples}`);

            assert.equal(r.sameElement, false, 'the route swap really replaced the element');
            assert.equal(r.after.shotIsLiveShot, true,
                'and the new screen took the same buffer off the shell');
            assert.ok(r.before.inShot > 0, `the outgoing screen had drawn ${r.before.inShot} samples`);
            assert.ok(r.away.samples > r.before.samples,
                `frames really arrived while no screen was on the page: ${r.before.samples} -> `
                + `${r.away.samples} samples`);
            assert.ok(r.after.inShot > r.before.inShot,
                `THE MISSED-FRAMES TRAP: the incoming screen drew ${r.after.inShot} in-shot samples, `
                + `the outgoing one had ${r.before.inShot} — a screen that only listened to new `
                + 'publishes would have started from zero');
            assert.equal(r.after.firstT, r.before.firstT,
                'and its axis starts at the SHOT\'s own origin, not at the moment it mounted');
            const arrived = r.after.samples - r.away.samples;
            assert.ok(r.after.derivations >= 1,
                'the shot so far is read off the buffer rather than waited for');
            const RECORD_ARRIVAL = 1;
            assert.ok(r.after.derivations <= 1 + RECORD_ARRIVAL + Math.max(0, arrived),
                `${r.after.derivations} derivations for ${arrived} samples since the mount — `
                + 'the incoming screen replayed the buffer rather than deriving it once');
            assert.equal(r.away.subscribers, r.before.subscribers - 1,
                'while it was away the buffer had one subscriber fewer — the outgoing screen '
                + 'took its subscription with it (S10\'s class)');
            assert.equal(r.after.subscribers, r.before.subscribers,
                'and the incoming one restored exactly one, never two');
            assert.ok(r.away.frames > 0);
        });

        test('5. machine state drives the header band: idle -> espresso -> idle', (t) => {
            const before = need('headerIdleBefore');
            const running = need('headerRunning');
            const after = need('headerIdleAfter');
            t.diagnostic(`${geometry.name} header: `
                + `[${before.machineStateAttribute}] chip "${before.chipText}" tone=${before.chipTone} `
                + `dim=${before.dim} stop=${before.stopButtons} h=${before.headerHeight} -> `
                + `[${running.machineStateAttribute}] chip "${running.chipText}" tone=${running.chipTone} `
                + `dim=${running.dim} stop=${running.stopButtons} h=${running.headerHeight} -> `
                + `[${after.machineStateAttribute}] chip "${after.chipText}" tone=${after.chipTone} `
                + `dim=${after.dim} stop=${after.stopButtons} h=${after.headerHeight}`);

            assert.equal(before.machineStateProperty, 'idle',
                'the constructed idle frame reached the screen through the store');
            assert.equal(before.machineStateAttribute, 'idle',
                'and is reflected, so a selector can name it (Appendix 15)');
            assert.equal(before.chipText, 'Machine idle', 'the status chip says so');
            assert.equal(before.chipTone, 'ok', 'and the dot is the green one');
            assert.equal(before.dim, null, 'nothing is dimmed while the machine is idle (L11)');
            assert.equal(before.stopButtons, 0, 'and there is no abort target for a shot nobody is pulling');

            assert.equal(running.machineStateProperty, 'espresso',
                'the recording\'s own state name arrived over the socket');
            assert.equal(running.machineStateAttribute, 'espresso');
            assert.equal(running.chipText, 'Pulling a shot');
            assert.equal(running.chipTone, 'active',
                'the dot turns red while the machine is doing something');
            assert.equal(running.dim, 'all', 'and espresso dims every other group (live-dimming.js)');
            assert.equal(running.stopButtons, 1, 'the STOP target is on screen while a shot runs');
            assert.equal(Math.round(running.headerHeight), Math.round(before.headerHeight),
                'the header band does not change height as the state changes — the state '
                + 'changes WEIGHT, never position (Appendix item 3)');

            assert.equal(after.machineStateProperty, 'idle', 'and back to idle at the end');
            assert.equal(after.chipTone, 'ok', 'and the dot is green again');
            assert.equal(after.dim, null, 'the dimming is lifted with the state that caused it');
            assert.equal(after.stopButtons, 0);
        });

        test('a channel that goes quiet reaches the screen: the store ticks itself and the chip says so', (t) => {
            const probe = need('staleness');
            t.diagnostic(`${geometry.name} staleness after ${probe.waitedMs}ms of silence `
                + `(age ${probe.machineAgeMs}ms, budget 2000ms): with no hand call `
                + `machine=${probe.beforeTick.machine} scale=${probe.beforeTick.scale}; `
                + `after one refreshStaleness() machine=${probe.afterTick.machine} `
                + `scale=${probe.afterTick.scale}; chip "${probe.chip.text}" `
                + `tone=${probe.chip.tone} dots=${probe.chip.dots} data-feed=${probe.chip.feed} `
                + `(machineState property still "${probe.chip.machineStateProperty}", `
                + `${probe.chip.stopButtons} stop buttons)`);

            assert.ok(probe.machineAgeMs > 2000,
                `the machine channel had been silent for ${probe.machineAgeMs}ms`);
            assert.equal(probe.beforeTick.machine, 'stale',
                'nobody called refreshStaleness in this probe — the SCREEN\'s own tick must '
                + 'have, or the shipping app shows a frozen reading for ever');
            assert.equal(probe.afterTick.machine, 'stale',
                'and a hand call agrees with the tick rather than correcting it');

            assert.equal(probe.chip.feed, 'stale', 'the chip carries the feed\'s own word');
            assert.equal(probe.chip.text, 'No reading',
                'the chip went on naming a state nobody is sending');
            assert.equal(probe.chip.tone, null,
                'a state colour is a claim about a state, and none is arriving');
            assert.equal(probe.chip.dots, 0, 'so no dot is drawn at all');
        });

        test('the shot the screen drew is the recorded one, start to finish', () => {
            const final = need('final');
            const frozen = need('footFrozen');
            assert.ok(final.shotId, 'the buffer opened on the mock\'s own shot id');
            assert.equal(final.shotOpen, false, 'and closed on its `finished` frame');
            assert.equal(final.joinedLate, false,
                'the sequencer said `preheating` first, so nothing was missed at the head');
            assert.ok(final.inShot >= 200,
                `the whole in-shot stretch was drawn: ${final.inShot} samples`);
            assert.ok(frozen.inShot === final.inShot,
                'and the frozen derivation is the same shot the chart is holding');
        });
    });
}

describe('the coalescing window when the socket outruns the budget (60 Hz)', () => {
    let mock;
    const geometry = BENCH;

    before(async () => { mock = await startMock(['--ws-rate', '60', '--ws-phase', 'in-shot']); });
    after(() => { mock?.stop(); });

    test('the scheduler coalesces to one derivation per animation frame, and the ratio is recorded',
        (t) => browser.withPage({ geometry }, async (page) => {
            await page.mount('', MODULES);
            await page.evalFn((port) => window.__loop.mount({ port }), mock.port);
            await page.evalFn(() => window.__loop.startStream());
            await page.evalFn(() => window.__loop.untilInShot(30, 30000));
            const w = await page.evalFn((ms) => window.__loop.rateWindow(ms), 3000);
            const state = await page.evalFn(() => window.__loop.state());
            await page.evalFn(() => window.__loop.teardown());

            t.diagnostic(`60 Hz: ${w.framesPerSecond} Hz in, ${w.derivationsPerSecond} Hz derived, `
                + `${w.paintsPerSecond} Hz painted (${w.frames} frames / ${w.derivations} derivations `
                + `in ${w.seconds}s) · ${state.samples} samples buffered`);

            assert.ok(w.frames > 60, `the channel really ran fast: ${w.framesPerSecond} Hz`);
            assert.ok(w.samples >= w.frames - 1,
                'EVERY frame is still buffered — coalescing is about drawing, never about '
                + `dropping telemetry (${w.samples} samples for ${w.frames} frames)`);
            assert.ok(w.derivations <= w.frames,
                `the scheduler coalesced ${w.frames} arrivals into ${w.derivations} derivations`);
            assert.ok(w.derivationsPerSecond <= 62,
                `and never redraws faster than the display: ${w.derivationsPerSecond} Hz`);
            assert.deepEqual(page.pageErrors, []);
        }));
});
