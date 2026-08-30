/**
 * The cluster in a real engine, at Gate A's two.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';
import { WebSocketClient } from '../harness/ws.js';
import { assertTokenDrill } from '../harness/assertions.js';

const REPO = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));

const MODULES = ['/test/fixtures/live-gates-fixture.js'];
const STAGE = '<div id="stage" style="inline-size: 100%; block-size: 100dvh"></div>';

const S = 'live-screen';
const CONNECTION = `${S} >>> live-connection`;
const CARD = `${S} >>> ui-chart-card`;
const STRIP = `${S} >>> .ghc-strip`;

/** The arm-time refusal, exactly as the contract row spells the body. */
const REFUSED = {
    ok: false,
    kind: 'http',
    status: 400,
    message: 'Unsupported profile',
    problem: {
        error: 'Unsupported profile',
        message: 'This machine cannot run a Lever step in "Blooming espresso".',
    },
};

/* ─────────────────────────────────────── the mock, for the frames it can script */

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

async function startMock(args) {
    const port = await freePort();
    const child = spawn('python3', ['tools/mock_rea.py', '--port', String(port), ...args],
        { cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (b) => { stderr += b; });
    child.stdout.resume();
    const deadline = Date.now() + 15000;
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

/** The first readable devices frame this mock serves, verbatim. */
async function firstDevicesFrame(port) {
    const client = await WebSocketClient.connect(`ws://127.0.0.1:${port}/ws/v1/devices`);
    const frame = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('no devices frame')), 8000);
        client.on('message', (raw) => {
            let parsed;
            try { parsed = JSON.parse(raw); } catch { return; }
            if (!parsed || !Array.isArray(parsed.devices)) return;
            clearTimeout(timer);
            resolve(parsed);
        });
    });
    client.close();
    return frame;
}

let browser;
let mocks = [];
/** The scripted states, keyed by the picture each one is meant to produce. */
const FRAMES = {};

before(async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'decal-render-b8-'));
    const parkFile = path.join(dir, 'park.json');
    const readyFile = path.join(dir, 'ready.json');
    writeFileSync(parkFile, JSON.stringify({
        timeline: [{ phase: 'idle' }], devices: { pendingAmbiguity: 'machinePicker', connected: [] },
    }));
    writeFileSync(readyFile, JSON.stringify({ timeline: [{ phase: 'idle' }] }));

    const [parked, connected, launched] = await Promise.all([
        startMock(['--ws-script', parkFile]),
        startMock(['--ws-script', readyFile]),
        launch(),
    ]);
    mocks = [parked, connected];
    browser = launched;

    FRAMES.machinePicker = await firstDevicesFrame(parked.port);
    FRAMES.ready = await firstDevicesFrame(connected.port);

    const status = (over) => ({
        phase: 'idle', foundMachines: [], foundScales: [], pendingAmbiguity: null, error: null, ...over,
    });
    FRAMES.scanning = { ...FRAMES.ready, scanning: true, connectionStatus: status({ phase: 'scanning' }) };
    FRAMES.connectingMachine = { ...FRAMES.ready, connectionStatus: status({ phase: 'connectingMachine' }) };
    FRAMES.connectingScale = { ...FRAMES.ready, connectionStatus: status({ phase: 'connectingScale' }) };
    FRAMES.error = {
        ...FRAMES.ready,
        connectionStatus: status({
            phase: 'idle',
            error: {
                kind: 'bleFailure', severity: 'error', timestamp: '2026-08-18T00:00:00Z',
                message: 'The machine stopped answering.', suggestion: 'Power-cycle the machine.',
            },
        }),
    };
    FRAMES.idle = { ...FRAMES.ready, devices: [], connectionStatus: status({ phase: 'idle' }) };

    const ADAPTER_OFF = {
        kind: 'adapterOff', severity: 'error', timestamp: '2026-08-27T21:37:16.637241Z',
        message: 'Bluetooth is turned off.',
        suggestion: 'Turn Bluetooth on to scan for Bluetooth devices.',
    };
    FRAMES.readyAdapterOff = {
        ...FRAMES.ready,
        connectionStatus: status({ phase: 'ready', error: ADAPTER_OFF }),
    };
    FRAMES.idleAdapterOff = {
        ...FRAMES.ready, devices: [],
        connectionStatus: status({ phase: 'idle', error: ADAPTER_OFF }),
    };
    FRAMES.machineGone = {
        ...FRAMES.ready, devices: [],
        connectionStatus: status({
            phase: 'ready',
            error: {
                kind: 'machineDisconnected', severity: 'error',
                timestamp: '2026-08-18T00:00:00Z',
                message: 'Machine disconnected unexpectedly.',
                suggestion: 'Check the machine is powered on and in range, then reconnect.',
            },
        }),
    };
    FRAMES.unreadable = { ...FRAMES.ready, connectionStatus: 'connected' };
});

after(async () => {
    await browser?.close();
    for (const mock of mocks) mock.stop();
});

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`live connection & gates @ ${geometry.name} (${geometry.width}x${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

        const mounted = (fn) => browser.withPage({ geometry }, async (page) => {
            await page.mount(STAGE, MODULES);
            await page.evalFn(() => window.__live.mount());
            await page.settle(6);
            assert.deepEqual(page.pageErrors, [], 'the screen must mount with its stores attached');
            return fn(page);
        });

        /** Everything a person could tell two connection states apart by. */
        const picture = (page) => page.evalFn(() => {
            const el = window.__h.q('live-screen >>> live-connection');
            const root = el.shadowRoot;
            const banner = root.querySelector('ui-alert-banner');
            const text = (node) => (node ? node.textContent.trim() : null);
            const box = el.getBoundingClientRect();
            return {
                surface: el.getAttribute('surface'),
                visible: box.height > 0,
                headline: banner ? text(banner) : null,
                remedy: text(root.querySelector('#remedy-text')),
                hasChoose: !!root.querySelector('#choose'),
                dialogOpen: !!root.querySelector('#picker[open]'),
                bannerRole: banner ? banner.getAttribute('role') : null,
                choices: [...root.querySelectorAll('#choices ui-button')].map((b) => b.textContent.trim()),
            };
        });

        const show = async (page, key) => {
            await page.evalFn((frame) => window.__live.pushDevices(frame), FRAMES[key]);
            await page.settle(3);
            return picture(page);
        };

        const showHeld = async (page, key, status) => {
            await page.evalFn((frame, feedStatus) => window.__live.pushDevices(frame, feedStatus),
                FRAMES[key], status);
            await page.settle(3);
            return picture(page);
        };

        /* ── B8 · the states are distinguishable, on screen ──────────────── */

        test('every connection state draws a different picture', () => mounted(async (page) => {
            const keys = ['idle', 'scanning', 'connectingMachine', 'connectingScale', 'error', 'machinePicker'];
            const seen = new Map();
            for (const key of keys) {
                const shot = await show(page, key);
                const signature = JSON.stringify([shot.surface, shot.headline, shot.remedy, shot.hasChoose]);
                assert.ok(!seen.has(signature),
                    `${key} renders exactly like ${seen.get(signature)} — that IS bug B8`);
                seen.set(signature, key);
                assert.ok(shot.visible, `${key} rendered nothing at all`);
                assert.ok(shot.headline && shot.headline.length > 0, `${key} has no headline`);
            }

            // And the three the spec names by hand are three, not one.
            assert.equal(seen.size, keys.length);
        }));

        test('"still trying" and "failed" say different things, and "failed" says the server\'s', () =>
            mounted(async (page) => {
                const trying = await show(page, 'connectingMachine');
                const failed = await show(page, 'error');
                assert.notEqual(trying.headline, failed.headline);
                assert.match(failed.remedy, /The machine stopped answering\./,
                    'the server\'s own message must reach the person');
                assert.match(failed.remedy, /Power-cycle the machine\./, 'and its suggestion with it');
                assert.equal(failed.hasChoose, false, 'a failure is not a question');
            }));

        test('a connected machine costs this screen NOTHING — no banner, no row', () =>
            mounted(async (page) => {
                const quiet = await show(page, 'ready');
                assert.equal(quiet.surface, 'ready');
                assert.equal(quiet.visible, false, 'the surface must collapse when there is nothing to say');

                const gauges = await page.box(`${S} >>> .gauges`);
                const block = await page.box(`${S} >>> .stats-block`);
                const withoutNotices = await page.evalFn(() => {
                    const root = window.__h.q('live-screen').shadowRoot;
                    const block = root.querySelector('.stats-block');
                    const notices = root.querySelector('.notices');
                    if (!notices) return +block.getBoundingClientRect().height.toFixed(2);
                    notices.style.display = 'none';
                    const h = +block.getBoundingClientRect().height.toFixed(2);
                    notices.style.display = '';
                    return h;
                });
                assert.ok(block.height >= gauges.height - 0.51, 'the readings are inside the block');
                assert.ok(Math.abs(block.height - withoutNotices) < 0.51,
                    `the quiet notices spent ${(block.height - withoutNotices).toFixed(2)}px of the column`);
            }));

        test('a DEAD socket holding a ready frame does not render as connected', () => mounted(async (page) => {
            const live = await show(page, 'ready');
            assert.equal(live.surface, 'ready');
            assert.equal(live.visible, false, 'the connected case must still cost nothing');

            const dropped = await showHeld(page, 'ready', 'stale');
            const gone = await showHeld(page, 'ready', 'unavailable');

            assert.deepEqual([dropped.surface, gone.surface], ['stale', 'unavailable'],
                'the same ready frame at a dead feed rendered as a live machine');
            for (const shot of [dropped, gone]) {
                assert.ok(shot.visible, 'a machine that has gone away rendered as nothing at all');
                assert.ok(shot.headline && shot.headline.length > 0, 'no headline on a dead feed');
                assert.equal(shot.hasChoose, false, 'a lost connection is not a question');
            }
            assert.notEqual(dropped.headline, gone.headline,
                '"reconnecting" and "the source gave up" are two states, not one');

            // And the surface comes BACK when a frame does: the marker is not a latch here.
            const back = await show(page, 'ready');
            assert.equal(back.surface, 'ready');
        }));

        test('a Bluetooth error cannot say "could not connect" about a machine that IS connected',
            () => mounted(async (page) => {

                const connected = FRAMES.readyAdapterOff.devices
                    .filter((d) => d.type === 'machine' && d.state === 'connected');
                assert.equal(connected.length, 1, 'the frame under test has no connected machine');

                const before = await show(page, 'ready');
                assert.equal(before.visible, false, 'the control: a connected machine draws nothing');

                const withAdapterOff = await show(page, 'readyAdapterOff');
                assert.equal(withAdapterOff.surface, 'ready',
                    'a Bluetooth adapter error outranked phase: ready over a live machine');
                assert.equal(withAdapterOff.visible, false,
                    'the banner Ben could not get rid of is still on screen');
                assert.equal(withAdapterOff.headline, null, 'and it drew no headline at all');
            }));

        test('the adapter error is a note under the state, not a headline of its own',
            () => mounted(async (page) => {
                const idle = await show(page, 'idle');
                const withAdapterOff = await show(page, 'idleAdapterOff');

                const headlineOnly = (shot) =>
                    shot.headline.slice(0, shot.headline.length - shot.remedy.length).trim();

                assert.equal(withAdapterOff.surface, 'idle', 'nothing tried, so nothing failed');
                assert.equal(headlineOnly(withAdapterOff), headlineOnly(idle),
                    'the headline is the state\'s, and the state has not changed');
                assert.ok(headlineOnly(idle).length > 0, 'the headline reading came back empty');
                assert.ok(withAdapterOff.remedy.startsWith(idle.remedy),
                    `the state's own line was replaced rather than added to: ${withAdapterOff.remedy}`);
                assert.match(withAdapterOff.remedy, /Bluetooth is turned off\./,
                    'the reason must still reach the person');
                assert.match(withAdapterOff.remedy, /Turn Bluetooth on to scan/,
                    'and the suggestion with it');
                assert.equal(withAdapterOff.bannerRole, 'status',
                    'a radio that is off must not interrupt a screen reader');
            }));

        test('a machine that really went away STILL reaches the banner', () => mounted(async (page) => {
            const gone = await show(page, 'machineGone');
            assert.equal(gone.surface, 'error', 'the machine went away and the screen said nothing');
            assert.ok(gone.visible, 'a lost machine drew no rows at all');
            assert.equal(gone.bannerRole, 'alert', 'and it must interrupt');
            assert.match(gone.remedy, /Machine disconnected unexpectedly\./);
        }));

        test('the three "no readable frame" pictures are three pictures', () => mounted(async (page) => {
            const never = await (async () => {
                await page.evalFn(() => window.__live.pushDevicesState({ status: 'never', value: null }));
                await page.settle(2);
                return picture(page);
            })();
            const unreadable = await show(page, 'unreadable');
            const unavailable = await (async () => {
                await page.evalFn(() => window.__live.pushDevicesState({ status: 'unavailable', value: null }));
                await page.settle(2);
                return picture(page);
            })();

            assert.deepEqual(
                [never.surface, unreadable.surface, unavailable.surface],
                ['waiting', 'unreadable', 'unavailable'],
            );
            assert.equal(new Set([never.headline, unreadable.headline, unavailable.headline]).size, 3,
                'a malformed frame must not read as "the machine went away"');
        }));

        /* ── B8 · the park is ANSWERABLE ─────────────────────────────────── */

        test('the park opens a real dialog over the found machines, and the choice is SENT', () =>
            mounted(async (page) => {
                const parked = await show(page, 'machinePicker');
                assert.equal(parked.surface, 'machinePicker');
                assert.equal(parked.dialogOpen, true, 'ReaPrime is waiting; the question opens itself');
                assert.ok(parked.choices.length >= 1, 'the dialog offers nothing to choose');
                assert.equal(parked.hasChoose, true, 'and the banner can re-open it');

                // The dialog is the library's, in the top layer — not a box in the flow.
                const dialog = await page.computed(`${CONNECTION} >>> ui-dialog >>> dialog`, ['position']);
                assert.equal(dialog.position, 'fixed', 'the picker is #18, in the top layer');

                const expected = FRAMES.machinePicker.connectionStatus.foundMachines[0].id;
                await page.evalFn(() => {
                    window.__h.q('live-screen >>> live-connection').shadowRoot
                        .querySelector('#choices ui-button').shadowRoot.querySelector('button').click();
                });
                await page.settle(3);

                const sent = await page.evalFn(() => window.__live.connects);
                assert.deepEqual(sent, [expected],
                    'the choice never reached the devices link — the park is rendered, not answered');
            }));

        /* ── B8 · the choice is one a person can actually make (cross-4) ─── */

        test('two machines with ONE name are two different choices, and the id is what differs', () =>
            mounted(async (page) => {
                const parked = await show(page, 'machinePicker');
                assert.equal(parked.surface, 'machinePicker');

                const ids = FRAMES.machinePicker.connectionStatus.foundMachines.map((d) => d.id);
                assert.ok(ids.length >= 2, 'the mock no longer serves an ambiguous list');
                assert.equal(new Set(FRAMES.machinePicker.connectionStatus.foundMachines
                    .map((d) => d.name)).size, 1, 'and the two names are still one name');

                assert.equal(parked.choices.length, ids.length);
                assert.equal(new Set(parked.choices).size, ids.length,
                    `${parked.choices.length} choices, ${new Set(parked.choices).size} distinct labels — `
                    + 'the answer to "choose which machine to use" is a coin flip');
                for (const id of ids) {
                    assert.ok(parked.choices.some((label) => label.includes(id)),
                        `no row carries ${id}, so nothing on screen distinguishes them`);
                }

                // Pressing the SECOND row sends the second id — the rows are not swapped.
                await page.evalFn(() => {
                    window.__h.q('live-screen >>> live-connection').shadowRoot
                        .querySelectorAll('#choices ui-button')[1].shadowRoot
                        .querySelector('button').click();
                });
                await page.settle(3);
                assert.deepEqual(await page.evalFn(() => window.__live.connects), [ids[1]]);
            }));

        test('a name that already tells the rows apart is not padded with a MAC address', () =>
            mounted(async (page) => {
                const status = FRAMES.machinePicker.connectionStatus;
                const named = {
                    ...FRAMES.machinePicker,
                    connectionStatus: {
                        ...status,
                        foundMachines: [
                            { name: 'Kitchen', id: 'DA:BA:AF:20:7A:03', type: 'machine', state: 'discovered' },
                            {
                                name: 'Bar', id: 'usb-2e8a-a-8549628789ABCDEF',
                                type: 'machine', state: 'discovered', available: false,
                            },
                        ],
                    },
                };
                await page.evalFn((f) => window.__live.pushDevices(f), named);
                await page.settle(3);

                const rows = await page.evalFn(() => [...window.__h
                    .q('live-screen >>> live-connection').shadowRoot
                    .querySelectorAll('#choices ui-button')]
                    .map((host) => ({
                        name: host.querySelector('.choice-name')?.textContent.trim() ?? null,
                        id: host.querySelector('.choice-id')?.textContent.trim() ?? null,
                        note: host.querySelector('.choice-note')?.textContent.trim() ?? null,
                    })));

                assert.deepEqual(rows.map((r) => r.name), ['Kitchen', 'Bar']);
                assert.deepEqual(rows.map((r) => r.id), [null, null],
                    'the ids are noise on a list whose names already differ');
                assert.equal(rows[0].note, null, 'nothing was said about the first machine');
                assert.match(rows[1].note, /Not visible right now/,
                    'available: false is a real server field and the row must carry it');
            }));

        test('the choice affordance FILLS the row the sheet says it fills', () =>
            mounted(async (page) => {
                await show(page, 'machinePicker');
                const rows = await page.evalFn(() => [...window.__h
                    .q('live-screen >>> live-connection').shadowRoot
                    .querySelectorAll('#choices ui-button')]
                    .map((host) => ({
                        host: +host.getBoundingClientRect().width.toFixed(2),
                        control: +host.shadowRoot.querySelector('button')
                            .getBoundingClientRect().width.toFixed(2),
                        height: +host.shadowRoot.querySelector('button')
                            .getBoundingClientRect().height.toFixed(2),
                    })));

                assert.ok(rows.length >= 2, 'no choices to measure');
                for (const row of rows) {
                    assert.ok(row.host - row.control < 0.51,
                        `the row is ${row.host}px and its button is ${row.control}px — `
                        + 'the affordance is a small box at the left of a wide row');
                    assert.ok(row.height >= 48, `hit floor: ${row.height}px (L22)`);
                }
            }));

        /* ── Appendix 15 · the banner interrupts only when it should (c-gates-chart-6) ── */

        test('an ordinary boot does not interrupt a screen reader four times', () =>
            mounted(async (page) => {
                const polite = ['scanning', 'connectingMachine', 'connectingScale', 'idle'];
                for (const key of polite) {
                    const shot = await show(page, key);
                    assert.equal(shot.bannerRole, 'status',
                        `${key} is progress, and it interrupts (role=${shot.bannerRole})`);
                }

                // The boot's first state — nothing has arrived yet — is progress too.
                await page.evalFn(() => window.__live.pushDevicesState({ status: 'never', value: null }));
                await page.settle(2);
                assert.equal((await picture(page)).bannerRole, 'status');
            }));

        test('a fault and an unanswered question DO interrupt', () => mounted(async (page) => {
            for (const key of ['error', 'unreadable', 'machinePicker']) {
                const shot = await show(page, key);
                assert.equal(shot.bannerRole, 'alert',
                    `${key} is not a progress notice — it must interrupt`);
            }
            assert.equal((await showHeld(page, 'ready', 'stale')).bannerRole, 'alert');
            assert.equal((await showHeld(page, 'ready', 'unavailable')).bannerRole, 'alert');

            // And the politeness travels WITH the state, on one long-lived element.
            const back = await show(page, 'scanning');
            assert.equal(back.bannerRole, 'status',
                'the role is stuck at the value the first render gave it');
        }));

        /* ── B9 · the refusal surface ────────────────────────────────────── */

        /** Arm a profile against a scripted answer, then let the screen paint. */
        const armWith = async (page, answer) => {
            const status = await page.evalFn((body) => {
                window.__live.answer('/machine/profile', body);
                return window.__live.armProfile();
            }, answer);
            await page.settle(4);
            return status;
        };

        test('a 400 "Unsupported profile" puts the server\'s sentence in the alert banner', () =>
            mounted(async (page) => {
                const quiet = await page.evalFn(() => {
                    const el = window.__h.q('live-screen >>> live-refusal');
                    return { kind: el.getAttribute('kind'), height: el.getBoundingClientRect().height };
                });
                assert.equal(quiet.kind, null, 'nothing refused, nothing shown');
                assert.equal(quiet.height, 0, 'and no row spent on it');

                assert.equal(await armWith(page, REFUSED), 'refused');

                const state = await page.evalFn(() => {
                    const el = window.__h.q('live-screen >>> live-refusal');
                    const root = el.shadowRoot;
                    const message = root.querySelector('#message');
                    return {
                        kind: el.getAttribute('kind'),
                        height: el.getBoundingClientRect().height,
                        headline: root.querySelector('ui-alert-banner').textContent.trim(),
                        message: message ? message.textContent.trim() : null,
                        banner: !!root.querySelector('ui-alert-banner'),
                    };
                });

                assert.equal(state.kind, 'unsupported', 'the two 400s are told apart, as attributes');
                assert.equal(state.banner, true, 'the surface is #49, not a box this screen drew');
                assert.match(state.headline, /Unsupported profile/);
                assert.equal(state.message, REFUSED.problem.message,
                    'the server\'s sentence is rendered verbatim - this is the worst failure shape');
                assert.ok(state.height > 0, 'the refusal is on screen');
            }));

        test('dismissing it clears the STORE, not just the element', () => mounted(async (page) => {
            await armWith(page, REFUSED);
            await page.evalFn(() => {
                window.__h.q('live-screen >>> live-refusal').shadowRoot
                    .querySelector('#dismiss').shadowRoot.querySelector('button').click();
                return true;
            });
            await page.settle(4);

            const after_ = await page.evalFn(() => ({
                status: window.__live.armState().status,
                kind: window.__h.q('live-screen >>> live-refusal').getAttribute('kind'),
            }));
            assert.equal(after_.status, 'idle', 'the element hid a refusal the store still held');
            assert.equal(after_.kind, null);
        }));

        const NO_MACHINE = {
            ok: false,
            kind: 'http',
            status: 500,
            message: 'POST /machine/profile -> 500',
            problem: { error: 'DeviceNotConnectedException: machine not connected' },
        };

        /** Whatever the banner is showing, as strings a person could read off the glass. */
        const bannerPicture = (page) => page.evalFn(() => {
            const el = window.__h.q('live-screen >>> live-refusal');
            const root = el.shadowRoot;
            const message = root.querySelector('#message');
            return {
                kind: el.getAttribute('kind'),
                height: el.getBoundingClientRect().height,
                headline: root.querySelector('ui-alert-banner').textContent.trim(),
                message: message ? message.textContent.trim() : null,
            };
        });

        test('an arm that never reached the machine SAYS SO, and says why', () =>
            mounted(async (page) => {
                await page.evalFn((frame) => window.__live.pushDevices(frame), FRAMES.idle);
                await page.settle(3);

                assert.equal(await armWith(page, NO_MACHINE), 'failed',
                    'a 500 is a failure and is NOT dressed up as a refusal');

                const shown = await bannerPicture(page);
                assert.equal(shown.kind, 'undelivered',
                    'the surface renders it, and it is told apart from the two 400s as an attribute');
                assert.ok(shown.height > 0, 'silence was the bug — the banner must be on screen');
                assert.match(shown.headline, /has not been given this profile/,
                    'and it must not claim the choice failed: the document HAS been written');
                assert.match(shown.message, /No machine is connected/,
                    'the WHY is the thing Ben could not see anywhere');
            }));

        test('with a machine connected the same failure reads as a retry, not an absence', () =>
            mounted(async (page) => {
                await page.evalFn((frame) => window.__live.pushDevices(frame), FRAMES.ready);
                await page.settle(3);

                assert.equal(await armWith(page, NO_MACHINE), 'failed');
                const shown = await bannerPicture(page);
                assert.equal(shown.kind, 'undelivered');
                assert.doesNotMatch(shown.message, /No machine is connected/);
                assert.match(shown.message, /sent it again/);
            }));

        /* ── A3 / L1 · the GHC strip ─────────────────────────────────────── */

        test('unknown capability renders NO strip — fail-closed, and it is not a polarity choice', () =>
            mounted(async (page) => {
                const gate = await page.evalFn(() => {
                    window.__live.applyMachineInfo({ version: '1293', serialNumber: '1', extra: {} });
                    return new Promise((r) => setTimeout(() => r({
                        ghc: window.__h.q('live-screen').ghc,
                        strip: !!window.__h.q('live-screen').shadowRoot.querySelector('.ghc-strip'),
                    }), 60));
                });
                assert.equal(gate.ghc, false, 'an absent GHC key must never read as an answer');
                assert.equal(gate.strip, false);
            }));

        test('the capability decides, and the R3 provenance is on the rendered strip', () =>
            mounted(async (page) => {
                const { polarity } = await page.evalFn(() => import('/src/screens/live-gates.js')
                    .then((m) => ({ polarity: m.GHC_STRIP_SHOWS_WHEN })));

                const showing = polarity === 'present' ? { GHC: true } : { GHC: false };
                const hiding = polarity === 'present' ? { GHC: false } : { GHC: true };

                const off = await page.evalFn((body) => {
                    window.__live.applyMachineInfo(body);
                    return new Promise((r) => setTimeout(() => r(
                        !!window.__h.q('live-screen').shadowRoot.querySelector('.ghc-strip')), 60));
                }, hiding);
                assert.equal(off, false, 'the strip rendered on the machine the capability says it must not');

                const on = await page.evalFn((body) => {
                    window.__live.applyMachineInfo(body);
                    return new Promise((r) => setTimeout(() => {
                        const strip = window.__h.q('live-screen').shadowRoot.querySelector('.ghc-strip');
                        r(strip ? { tag: strip.dataset.rTag, adapter: strip.dataset.rAdapter } : null);
                    }, 60));
                }, showing);
                assert.ok(on, 'the strip did not render on the machine the capability says it must');
                assert.equal(on.tag, 'R3', 'the interim is not greppable from the DOM');
                assert.equal(on.adapter, 'r3GroupHeadControllerCapability');
            }));

        test('L1: the strip is a ROW under the chart, never a layer over its time axis', () =>
            mounted(async (page) => {
                const { polarity } = await page.evalFn(() => import('/src/screens/live-gates.js')
                    .then((m) => ({ polarity: m.GHC_STRIP_SHOWS_WHEN })));
                const chartBefore = await page.box(CARD);

                await page.evalFn((body) => {
                    window.__live.applyMachineInfo(body);
                }, polarity === 'present' ? { GHC: true } : { GHC: false });
                await page.settle(4);

                const strip = await page.box(STRIP);
                const chartAfter = await page.box(CARD);
                const style = await page.computed(STRIP, ['position']);
                const floor = parseFloat(await page.prop(CARD, 'min-block-size'));

                assert.equal(style.position, 'static', 'L1 is an absolutely positioned strip');
                assert.ok(strip.height > 0, 'the strip rendered');
                assert.ok(strip.y >= chartAfter.y, 'the strip is below the top of the chart');
                assert.ok(chartAfter.height <= chartBefore.height + 0.51,
                    'the chart did not pay for the strip, so something else did');
                if (chartAfter.height > floor + 0.51) {
                    assert.ok(strip.y >= chartAfter.y + chartAfter.height - 0.51,
                        'the strip overlaps the chart — L1, measured 855...933 over a chart bottom of 900');
                }
            }));

        /* ── L11 · ONE dimming owner ─────────────────────────────────────── */

        /** Every rail track, with what it is painted and whether anyone wrote inline. */
        const railTracks = (page) => page.evalFn(() => {
            const rail = window.__h.q('live-screen').shadowRoot.querySelector('live-rail');
            return [...rail.children].map((el) => ({
                group: el.getAttribute('data-dim-group'),
                keepsInput: el.hasAttribute('data-dim-keeps-input'),
                row: el.getAttribute('data-row') ?? el.className,
                opacity: getComputedStyle(el).opacity,
                pointerEvents: getComputedStyle(el).pointerEvents,
                inline: el.getAttribute('style'),
            }));
        });

        test('espresso recedes the targets, leaves the STOP track alone, and writes no inline style', () =>
            mounted(async (page) => {
                const resting = await railTracks(page);
                assert.ok(resting.length > 1, 'the rail has tracks to measure');
                const dimToken = parseFloat(await page.evalFn(() => getComputedStyle(
                    window.__h.q('live-screen')).getPropertyValue('--ui-opacity-dim')));
                assert.ok(dimToken > 0 && dimToken < 1, `--ui-opacity-dim is ${dimToken}`);
                assert.equal(await page.evalFn(() => window.__h.q('live-screen').getAttribute('dim')), null,
                    'the rail is dimmed with no machine state at all');

                await page.evalFn(() => window.__live.pushMachineState('espresso'));
                await page.settle(4);

                const dim = await page.evalFn(() => window.__h.q('live-screen').getAttribute('dim'));
                assert.equal(dim, 'all', 'the one owner did not publish its answer');

                const running = await railTracks(page);
                const grouped = running.filter((t) => t.group);
                const exempt = running.filter((t) => !t.group);

                assert.ok(grouped.length > 0, 'no rail track carries a dim group');

                for (const track of grouped) {
                    assert.equal(parseFloat(track.opacity), dimToken,
                        `${track.row} is at ${track.opacity}, not the dim token - a second owner is painting it`);
                    assert.equal(track.pointerEvents, track.keepsInput ? 'auto' : 'none',
                        `${track.row} (keepsInput ${track.keepsInput}) answers ${track.pointerEvents}`);
                }
                const pressable = grouped.filter((t) => t.keepsInput);
                assert.equal(pressable.length, 2,
                    `exactly the two preset banks keep their press, got ${pressable.map((t) => t.row).join(', ')}`);
                assert.ok(exempt.length > 0, 'the mode track lost its exemption');
                for (const [i, track] of running.entries()) {
                    if (track.group) continue;
                    assert.equal(track.opacity, resting[i].opacity, 'the STOP track receded - worse than L11');
                    assert.notEqual(track.pointerEvents, 'none', 'the abort target stopped answering');
                }

                // THE MECHANISM OF L11, banned: nobody wrote a style attribute.
                for (const track of running) {
                    assert.equal(track.inline, null, `${track.row} carries an inline style — "Inline wins"`);
                }
            }));

        test('the drill lands: ONE token owns the dim, so re-pointing it moves the rail', () =>
            mounted(async (page) => {
                await page.evalFn(() => window.__live.pushMachineState('espresso'));
                await page.settle(4);

                const dimmed = await page.evalFn(() => {
                    const rail = window.__h.q('live-screen').shadowRoot.querySelector('live-rail');
                    const el = [...rail.children].find((n) => n.getAttribute('data-dim-group'));
                    el.id = 'drill-target';
                    return el.getAttribute('data-dim-group');
                });
                assert.ok(dimmed, 'no dimmed track to drill');

                await assertTokenDrill(page, {
                    token: '--ui-opacity-dim',
                    value: '0.137',
                    expected: '0.137',
                    read: (p) => p.evalFn(() => getComputedStyle(
                        window.__h.q('live-screen').shadowRoot.querySelector('#drill-target')).opacity),
                });
            }));

        test('the mode in use never recedes — steam leaves the steam rows alone', () =>
            mounted(async (page) => {
                await page.evalFn(() => window.__live.pushMachineState('steam'));
                await page.settle(4);

                const dim = await page.evalFn(() => window.__h.q('live-screen').getAttribute('dim'));
                assert.equal(dim, 'except-steam');

                const dimToken = parseFloat(await page.evalFn(() => getComputedStyle(
                    window.__h.q('live-screen')).getPropertyValue('--ui-opacity-dim')));
                const tracks = await railTracks(page);
                const steam = tracks.filter((t) => t.group === 'steam');
                assert.ok(steam.length > 0, 'the rail did not recompose into steam mode');
                for (const track of steam) {
                    assert.notEqual(parseFloat(track.opacity), dimToken,
                        'the mode the machine is using receded');
                    assert.notEqual(track.pointerEvents, 'none', 'and it stopped answering a tap');
                }
                for (const track of tracks.filter((t) => t.group && t.group !== 'steam')) {
                    assert.equal(parseFloat(track.opacity), dimToken, `${track.row} stayed lit during steam`);
                }
            }));

        test('a dead machine feed lifts the dim — the rail does not stay receded for ever', () =>
            mounted(async (page) => {
                const dimToken = parseFloat(await page.evalFn(() => getComputedStyle(
                    window.__h.q('live-screen')).getPropertyValue('--ui-opacity-dim')));

                await page.evalFn(() => window.__live.pushMachineState('espresso'));
                await page.settle(4);
                assert.equal(await page.evalFn(() => window.__h.q('live-screen').getAttribute('dim')), 'all',
                    'the machine is running and the rail did not recede');

                for (const status of ['stale', 'unavailable']) {
                    await page.evalFn((s) => window.__live.setMachineFeedStatus(s), status);
                    await page.settle(4);

                    const held = await page.evalFn(() => window.__live.machineFeed());
                    assert.equal(held.status, status);
                    assert.equal(held.state, 'espresso',
                        'the feed cleared its value — the deletion rule says it must not');

                    const dim = await page.evalFn(() => window.__h.q('live-screen').getAttribute('dim'));
                    assert.equal(dim, null,
                        `a ${status} feed still recedes the rail, and nothing will ever lift it`);

                    const tracks = await railTracks(page);
                    for (const track of tracks) {
                        assert.notEqual(parseFloat(track.opacity), dimToken,
                            `${track.row} is still at the dim token behind a ${status} feed`);
                        assert.notEqual(track.pointerEvents, 'none',
                            `${track.row} still refuses a tap behind a ${status} feed`);
                    }

                    assert.equal(
                        await page.evalFn(() => window.__h.q('live-screen').getAttribute('machine-state')),
                        'espresso',
                        'the last-known state stopped travelling — that takes the abort target with it');
                    assert.equal(
                        await page.evalFn(() => window.__h.q('live-screen')
                            .shadowRoot.querySelectorAll('ui-stop-button').length),
                        1, 'the STOP target went away on a stale feed, which is the worse bug');
                }

                // A frame arrives: the feed is believable again and the dim comes back.
                await page.evalFn(() => window.__live.pushMachineState('espresso'));
                await page.settle(4);
                assert.equal(await page.evalFn(() => window.__h.q('live-screen').getAttribute('dim')), 'all',
                    'a live reading must recede the rail again — the lift is not a latch of its own');
            }));

        test('an idle machine dims nothing, and an unknown state dims nothing either', () =>
            mounted(async (page) => {
                const resting = await railTracks(page);
                const dimToken = parseFloat(await page.evalFn(() => getComputedStyle(
                    window.__h.q('live-screen')).getPropertyValue('--ui-opacity-dim')));

                for (const state of ['idle', 'negotiatingFirmware', 'sleeping']) {
                    await page.evalFn((s) => window.__live.pushMachineState(s), state);
                    await page.settle(3);
                    const dim = await page.evalFn(() => window.__h.q('live-screen').getAttribute('dim'));
                    assert.equal(dim, null, `${state} dimmed the rail`);
                    const tracks = await railTracks(page);
                    for (const track of tracks) {
                        assert.notEqual(parseFloat(track.opacity), dimToken,
                            `${state} applied the dim token - an unknown state must never hide the rail`);
                    }
                    assert.equal(tracks.length, resting.length, `${state} changed the rail's shape`);
                }
            }));

        describe('the DYE2 handoff', () => {
            const HANDOFF = 'live-screen >>> ui-rating-control >>> #handoff';

            /** Wait for the plugin listing to land, which is what makes the button possible. */
            const withListing = async (page) => {
                await page.evalFn(async () => {
                    await window.__live.loadPlugins();
                    return true;
                });
                await page.settle(4);
            };

            test('an unread listing offers nothing, and a loaded DYE2 offers the button', () =>
                mounted(async (page) => {
                    await withListing(page);
                    assert.equal(await page.exists(HANDOFF), true,
                        'a machine whose listing reports DYE2 loaded is offered the button');

                    await page.evalFn(() => window.__live.pluginsLoaded('dye2.reaplugin', false));
                    await page.settle(4);
                    assert.equal(await page.exists(HANDOFF), false,
                        'DYE2 present but not running serves a page that would not answer');

                    const autoLoad = await page.evalFn(() => window.__live.pluginAutoLoad('dye2.reaplugin'));
                    assert.equal(autoLoad, true,
                        'the discriminator under test is `loaded`, and this proves the two really differ here');

                    await page.evalFn(() => window.__live.pluginsLoaded('dye2.reaplugin', true));
                    await page.settle(4);
                    assert.equal(await page.exists(HANDOFF), true, 'and it comes back when the plugin does');
                }));

            test('the press opens DYE2’s bean picker in a new context, through pageUrl', () =>
                mounted(async (page) => {
                    await withListing(page);
                    const got = await page.evalFn(async () => {
                        const opens = [];
                        const original = window.open;
                        window.open = (...args) => { opens.push(args); return {}; };
                        const button = window.__h.q('live-screen').shadowRoot
                            .querySelector('ui-rating-control').shadowRoot.getElementById('handoff');
                        const label = button.textContent.trim();
                        button.click();
                        await new Promise((r) => setTimeout(r, 0));
                        window.open = original;
                        return { opens, label };
                    });

                    assert.equal(got.opens.length, 1,
                        'the press must reach a navigation, or it is the old silent no-op');
                    const [url, target, features] = got.opens[0];
                    assert.match(url, /\/api\/v1\/plugins\/dye2\.reaplugin\/bean-picker$/,
                        `the handoff went to ${url}`);
                    assert.equal(target, '_blank');
                    assert.equal(features, 'noopener',
                        'a same-window navigation strands a kiosk with no back control');

                    assert.equal(got.label, 'Beans');
                    const notes = await page.evalFn(() => window.__h.q('live-screen').shadowRoot
                        .querySelector('ui-rating-control').shadowRoot
                        .getElementById('notes').textContent.trim());
                    assert.notEqual(got.label, notes,
                        'two buttons a hand\'s width apart must not read the same');
                }));

            test('the shot id is not smuggled into the URL, and no global is installed', () =>
                mounted(async (page) => {
                    await withListing(page);
                    const got = await page.evalFn(async () => {
                        const opens = [];
                        const original = window.open;
                        window.open = (...args) => { opens.push(args); return {}; };
                        window.__h.q('live-screen').shadowRoot.querySelector('ui-rating-control')
                            .shadowRoot.getElementById('handoff').click();
                        await new Promise((r) => setTimeout(r, 0));
                        window.open = original;
                        return { url: opens[0]?.[0] ?? null, global: typeof window.openDye2ForShot };
                    });
                    assert.equal(got.url.includes('?'), false, `a query string appeared: ${got.url}`);
                    assert.equal(got.global, 'undefined',
                        'the skin installs no window global for DYE2 and expects none');
                }));
        });
    });
}
