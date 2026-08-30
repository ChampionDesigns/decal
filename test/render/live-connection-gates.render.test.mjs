/**
 * live-connection-gates.render.test.mjs — the cluster in a real engine, at Gate A's two.
 *
 * The derivations are proved without a browser in `test/live-connection-gates.test.mjs`;
 * what needs an engine is everything that is a BOX or a CASCADE:
 *
 *   B8  each connection state renders a different thing, and the picker is a real dialog
 *       whose choice reaches the devices link — measured, not asserted about a template;
 *   B9  the refusal banner appears on a mocked 400 carrying the server's own sentence;
 *   A3  the GHC strip is ABSENT while the capability is unknown or says no, and present
 *       when it says yes — read off the rendered tree, not off a property;
 *   L1  when it is present it is a GRID ROW: `position: static`, under the chart, and the
 *       chart is the box that gave it the space;
 *   L11 ONE dimming owner, proved by DRILLING the token: re-point `--ui-opacity-dim` and
 *       the dimmed row's computed opacity must follow it. An inline `opacity` anywhere in
 *       the chain pins the row and the drill does not land — which is bug L11 exactly,
 *       turned into a test that bites.
 *
 * THE DEVICES FRAMES ARE THE MOCK'S. `before` starts `tools/mock_rea.py` with a run script
 * that parks on `machinePicker`, reads the frames off a real WebSocket, and hands them to
 * the page. So the parked picture is drawn from a frame that came off a socket. The three
 * states no mock can script — a `connectionStatus.error`, a malformed frame, a source that
 * gave up — are built here, to `DevicesStateAggregator._buildSnapshot`'s shape.
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

    // The states the mock has no script for, built to the aggregator's own shape: it
    // writes all five keys unconditionally, so these are frames and not fragments.
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

    /* ── BEN'S OWN FRAME, 28 AUGUST 2026 ──────────────────────────────────────────
     * Read live off his tablet's `/ws/v1/devices` while the machine was on USB with
     * Bluetooth switched off, and `GET /api/v1/machine/state` was answering `idle` with
     * live pressure. The device list is the mock's connected one; `connectionStatus` is
     * his, verbatim, hours-old timestamp included.
     *
     * "for some reason now I cannot get rid of the 'could not connect' banner, it says
     * bluetooth is off which it is but Bengle can connect over USB (which it is now) so
     * doesn't need bluetooth turned on."
     *
     * Before the fix this drew surface="error", headline "Could not connect", role="alert",
     * 88.8px tall — measured on the tablet, over a machine that was answering. */
    const ADAPTER_OFF = {
        kind: 'adapterOff', severity: 'error', timestamp: '2026-08-27T21:37:16.637241Z',
        message: 'Bluetooth is turned off.',
        suggestion: 'Turn Bluetooth on to scan for Bluetooth devices.',
    };
    FRAMES.readyAdapterOff = {
        ...FRAMES.ready,
        connectionStatus: status({ phase: 'ready', error: ADAPTER_OFF }),
    };
    /* THE SAME ADAPTER ERROR WITH NOTHING CONNECTED. Not a banner either — an adapter that
     * is off is a scan problem at every phase — but not silence: the state has a headline
     * of its own and the server's sentence goes under it. */
    FRAMES.idleAdapterOff = {
        ...FRAMES.ready, devices: [],
        connectionStatus: status({ phase: 'idle', error: ADAPTER_OFF }),
    };
    /* THE MACHINE ACTUALLY WENT AWAY, at the phase that has not caught up yet: upstream
     * emits `machineDisconnected` and moves no phase, so this is `ready` over an empty
     * bench. It MUST still reach the banner — the fix must not silence it. */
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
    // A frame that arrives and cannot be read: `connectionStatus` is not an object, which
    // is `readConnectionStatus`'s null and therefore `readDevicesFrame`'s null.
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
                /* role="alert" is an ASSERTIVE live region; role="status" is polite. The
                 * component sets `alert` on itself unless the call site chose — so this is
                 * read off the rendered element, which is the only place the answer is. */
                bannerRole: banner ? banner.getAttribute('role') : null,
                choices: [...root.querySelectorAll('#choices ui-button')].map((b) => b.textContent.trim()),
            };
        });

        const show = async (page, key) => {
            await page.evalFn((frame) => window.__live.pushDevices(frame), FRAMES[key]);
            await page.settle(3);
            return picture(page);
        };

        /** The same frame, at a feed status other than LIVE — a value the store still holds
         *  after its source went (`feed-store.js`'s deletion rule). */
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

                /* THE CLAIM IS ABOUT THE NOTICES, and it is measured against them since
                 * parity surface 1 gave the stat cluster the heading §4.1 always
                 * specified ("<stat-cluster>  auto  (heading + gauges)"). It used to read
                 * `block.height === gauges.height`, which was the same claim while the
                 * readings were the whole of the block; the block is now legitimately
                 * taller than its gauges by the identity line, and what must still cost
                 * nothing is the QUIET NOTICE — so the block is measured against the sum
                 * of the rows that are not it. */
                const gauges = await page.box(`${S} >>> .gauges`);
                const block = await page.box(`${S} >>> .stats-block`);
                /* MEASURED BY REMOVING IT rather than by summing the block's children.
                 * The stat block gained a row GAP with parity 7-live-polish (Slate leaves
                 * 21px between the profile name and the first readout's microcap —
                 * ORACLE #profile-name [i=92] bottom 201 against the Time label [i=96]
                 * top 222), and a sum of children counts no gaps, so the old spelling
                 * charged the quiet notices for space the grid spends on its own rows.
                 * The claim was always that a notice with nothing to say costs the column
                 * NO HEIGHT; hiding it and re-measuring says exactly that. */
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
            /* The one wrong answer that is invisible. `ready` collapses the host to zero
             * rows, so a surface that reads `ready` when the source has gone paints
             * NOTHING and the screen looks connected. The store keeps the value across
             * both transitions on purpose (feed-store.js's deletion rule), which is why
             * the marker has to be read here. Wave 5.1, c-gates-chart-1. */
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

        /* ── B8 · an error is not automatically "failed" (Ben, 28 August 2026) ── */

        test('a Bluetooth error cannot say "could not connect" about a machine that IS connected',
            () => mounted(async (page) => {
                /* THE BUG, ON HIS FRAME, IN A REAL ENGINE. `ready` is the surface that
                 * draws nothing, so the proof is the same shape as the dead-socket proof
                 * above and pointing the other way: there the wrong answer HID a banner,
                 * here the wrong answer SHOWED one. Both are measured as a box. */
                /* THE PRECONDITION, ASSERTED RATHER THAN ASSUMED. The mock's own device
                 * list has a machine connected over USB — `usb-2e8a-a-…`, the recording's
                 * connected entry — which is what makes this frame Ben's situation and not
                 * merely a phase that says `ready`. A test that silently lost the machine
                 * would still pass on rule 1 alone and would stop proving rule 3. */
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
                /* WHERE THE INFORMATION WENT. With nothing connected there IS a banner —
                 * the state has earned one — and the server's own two sentences print
                 * under the state's own line rather than replacing it. Neither sentence is
                 * invented and neither is thrown away. */
                const idle = await show(page, 'idle');
                const withAdapterOff = await show(page, 'idleAdapterOff');

                /* `picture().headline` is the banner's WHOLE text — the strip's headline
                 * plus whatever is slotted into `remedy` — so the state's own headline is
                 * what is left when the remedy is taken off the end. Neither of these two
                 * surfaces carries a button, so there is nothing else in there. */
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
            /* THE MUTATION CHECK, RENDERED. `phase: ready` over an empty bench is the
             * window upstream leaves open when a machine drops, and it is the one error
             * that most needs the alarm. If the fix read the phase alone it would be
             * silenced here — which is why it reads the device list too. */
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

                /* The recorded list the mock serves holds two machines both called
                 * "Bengle" (tools/rea-fixtures/api__v1__devices.json), one on a BLE MAC and
                 * one on a USB path. Before wave 5.1 the row rendered `name ?? id`, so the
                 * dialog offered two buttons reading the same word and the connect command
                 * sent one of two ids the person could not tell apart. */
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
                /* The disambiguator is for the rows that need it. Two machines a person
                 * named themselves read as their names, and the id — which is a MAC or a
                 * USB path — stays out of the way. The third line is the SERVER's
                 * `available: false` ("known about, not visible right now"), rendered only
                 * where the server set it: the socket's hand-built `foundMachines` entries
                 * carry four keys and no `available` (tools/ws_frames.py:567), and nothing
                 * on this screen fills that in or sniffs a transport out of an id. */
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
                /* `.choices ui-button { display: block }` stretched the HOST and left the
                 * pressable control shrink-wrapped to its label: 772px of row, a 105.89px
                 * button at its left, at both Gate A geometries. Above the 48px floor, so
                 * L22 stayed green and no suite saw it. The control is what a finger and a
                 * focus ring land on, so the control is what gets measured. */
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
                /* `<ui-alert-banner>` sets role="alert" on itself unless the call site
                 * chose one (ui-alert-banner.js:366-372), and role="alert" is an assertive
                 * live region. The call site set nothing, so every routine boot state —
                 * waiting → scanning → connectingMachine → connectingScale → ready — cut
                 * across whatever the reader was saying. The same screen's chart summary
                 * already refuses exactly this (role=status, live-screen.js). */
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
            /* A dead source is a fault whichever kind it is, and both are held frames. */
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

        /* ── B9 · THE OTHER ENDING, WHICH USED TO SAY NOTHING AT ALL ─────── */

        /**
         * Ben, 27 August 2026, machine disconnected: "now I cannot seem to select a
         * favorite, do I need a machine connected to pick one". The slot highlighted, it
         * snapped back, Edit profile opened the profile from before, AND NOTHING WAS SAID
         * ANYWHERE. `profileRefusal()` words a 400 with a problem body and nothing else,
         * which is right — but a disconnected machine is a 500 (`withDe1` catches
         * `DeviceNotConnectedException` at `de1handler.dart:608`), so the arm store
         * published FAILED with a raw transport result and this surface read only the
         * REFUSED half. Two endings, one voice.
         *
         * THE BODY BELOW IS THE ONE THE MACHINE ACTUALLY PRODUCES, not a hand-rolled
         * failure: `jsonError({'error': e.toString(), 'st': ...})` over
         * `DeviceNotConnectedException.toString()` (`errors.dart:22`).
         */
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
                /* THE SAME DERIVATION THE CONNECTION BAND USES, so the two cannot
                 * disagree about whether there is a machine. A connected DE1 that will
                 * not take the upload is a BLE fault, and ReaPrime retries that one itself
                 * on a 3 s / 10 s / 30 s ladder (`workflow_device_sync.dart`), so saying
                 * "no machine is connected" here would be false. */
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
                /* THE RESTING PICTURE IS NOT ALL-OPAQUE, and the difference matters. A
                 * stepper whose limit row the table does not carry renders DISABLED, and
                 * the base paints that with --ui-opacity-disabled (.38). That is a second
                 * opacity on the same box - so the test is not "nothing is dim at rest",
                 * it is "the dim owner's token is what changes, and only where the map
                 * says". The two do not fight: an outer-tree rule (live-screen's) beats a
                 * component's own :host rule whatever the specificity, so when both apply
                 * the dim wins, deterministically and with no !important anywhere. */
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

                /* THE PAINT IS THE SAME FOR EVERY GROUPED TRACK, AND THE INPUT IS NOT — F-038,
                 * Ben 30 August 2026: "A defect — make them pressable."
                 *
                 * This loop read, for EVERY grouped track:
                 *
                 *     assert.equal(track.pointerEvents, 'none', `${track.row} still answers a tap`);
                 *
                 * and that line was the fault, pinned. Wave 3 measured all eight preset
                 * cells resolving to <live-rail> during a live shot because the dim rule
                 * takes pointer-events away with the opacity; nothing was disabled and
                 * nothing said so. The two preset banks now carry `data-dim-keeps-input`
                 * and keep the press. THE OPACITY HALF IS UNCHANGED for every track,
                 * including theirs — a bank on a mode the machine is not using still reads
                 * "not now", which was never the complaint. */
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

        /**
         * THE OTHER HALF OF FAIL-VISIBLE. The map was total over the STATE vocabulary — an
         * unknown name recedes nothing — and blind to the FEED, so a machine channel that
         * went away holding `espresso` kept `dim="all"` with every dimmable track at the
         * dim token and `pointer-events: none`. Nothing could lift it: a latched STALE is
         * not undone by the clock and UNAVAILABLE is not either, so only a new frame could,
         * and none was coming. After a socket blip mid-espresso the whole rail was receded
         * AND inert for the rest of the session, with `<ui-stop-button>` the one exempt
         * control still answering. Both dead statuses are checked, because the blip case is
         * STALE and it is the one that was reported.
         */
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

                    // WHAT MUST NOT CHANGE WITH IT: the state name still travels, so the
                    // header keeps reporting (as "No reading") and the STOP target stays.
                    // A feed that stopped talking is not a machine that stopped pulling.
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

        /* ===================================================================
         * THE DYE2 HANDOFF — the listener the component never had
         *
         * Ben, 27 August 2026: "Have the button open the bean picker page for now, I need
         * to do more work on this though."
         *
         * WHAT WAS WRONG BEFORE. `ui-rating-control` has published `dye-handoff` since it
         * was built, its header documents the event, and its own render suite exercises the
         * button — and NOTHING in `src/` listened. The Live screen never set `handoff`
         * either, so the button was unreachable as well as unheard: a finished half with no
         * other half, in the exact place the component's header had already warned about it
         * ("a handoff that leads nowhere is then a fact the screen knows, not a silent
         * no-op in a leaf").
         *
         * IT IS TESTED HERE AND NOT IN THE BANDS SUITE, and the reason is worth writing
         * down because it is the whole shape of the fix. The bands suite mounts
         * `<live-screen>` BARE and sets properties by hand; `dye2` is not a property a test
         * may set, because the WIRING owns it — the moment a boot is attached,
         * `hostUpdate` computes it from the plugin listing and overwrites anything a test
         * put there. So the only honest way to see the button is to give the screen a real
         * boot with a real plugins store over a recorded `GET /api/v1/plugins`, which is
         * exactly what this fixture is. The path under test is therefore the whole path:
         * listing -> store -> gate -> property -> button -> pageUrl -> navigation.
         *
         * THE GATE IS THE PLUGIN LISTING AND NOT A STORED PREFERENCE, which is a decision
         * rather than a detail. `dye2Enabled` was the obvious gate and it is retired: its
         * only writer — the DYE2 settings leaf — was deleted on Ben's own call on 26 August
         * ("delete the DYE2 leaf and move what it does into Plugins"), so a gate on it
         * would have been a gate on a value nothing can set, and the button would have been
         * unreachable on every machine for ever.
         * =================================================================== */
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
                    /* THE FIXTURE STARTS THE READ ON MOUNT, so by the time `mounted` has
                     * settled the button is already there. What can still be asserted is
                     * the OTHER side, which is the one that matters: a listing whose DYE2
                     * is not loaded must draw nothing. A button offered before a
                     * destination is established is the dead-end control the old skin
                     * measured on the bench — "button visible, window.openDye2ForShot
                     * undefined", where every tap did nothing at all. */
                    await withListing(page);
                    assert.equal(await page.exists(HANDOFF), true,
                        'a machine whose listing reports DYE2 loaded is offered the button');

                    await page.evalFn(() => window.__live.pluginsLoaded('dye2.reaplugin', false));
                    await page.settle(4);
                    assert.equal(await page.exists(HANDOFF), false,
                        'DYE2 present but not running serves a page that would not answer');

                    /* AND `autoLoad` IS NOT THE ANSWER. The Plugins page's SWITCH reads it
                     * — the persistent value, so a control does not flicker off while a
                     * plugin restarts — and this is a LINK to a page that plugin serves, so
                     * the question is "will that URL answer", which is `loaded`. The
                     * fixture leaves autoLoad true above; the button is still gone. */
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
                    /* THE ADDRESS IS THE ROUTE TABLE'S, THROUGH `pageUrl`. The screen may
                     * not spell a path — it may not even import a store — so the two halves
                     * come from `src/lib/plugin-pages.js` and the URL is composed by the one
                     * function in the skin that turns a plugin and an endpoint into an
                     * address. */
                    assert.match(url, /\/api\/v1\/plugins\/dye2\.reaplugin\/bean-picker$/,
                        `the handoff went to ${url}`);
                    assert.equal(target, '_blank');
                    assert.equal(features, 'noopener',
                        'a same-window navigation strands a kiosk with no back control');

                    /* THE WORD IS THE DESTINATION'S, NOT SLATE'S. The component's built-in
                     * label is Slate's "Full notes", honest there because that one button
                     * was the route to a shot's notes AND to DYE. Here "All notes" sits
                     * directly above it and goes somewhere else entirely.
                     *
                     * F-028, BEN, 30 AUGUST 2026: "Relabel to Beans." This line read
                     * `assert.equal(got.label, 'DYE2')` until then and it pinned the
                     * superseded wording — the vendor's product name rather than the thing
                     * the page does. THE ASSERTION ABOVE IS THE OTHER HALF OF THE
                     * DECISION and is deliberately untouched: the same press still opens
                     * the same `bean-picker` endpoint in the same new context, so this one
                     * test now says "the word changed, the destination did not". */
                    assert.equal(got.label, 'Beans');
                    const notes = await page.evalFn(() => window.__h.q('live-screen').shadowRoot
                        .querySelector('ui-rating-control').shadowRoot
                        .getElementById('notes').textContent.trim());
                    assert.notEqual(got.label, notes,
                        'two buttons a hand\'s width apart must not read the same');
                }));

            /* NOTHING IS CARRIED, AND THAT IS THE "FOR NOW". The component publishes the
             * shot id and the screen ignores it, because no DYE2 endpoint at the pin
             * documents a way to receive one. The old skin's answer was
             * `window.openDye2ForShot(shotId)` — a global the audit measured as undefined
             * on the bench, so every tap did nothing. An honest button that opens the right
             * page with no context beats one that pretends to carry some. */
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
