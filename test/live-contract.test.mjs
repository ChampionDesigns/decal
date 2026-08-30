/**
 * live-contract.test.mjs — the Live screen's contract check, as a BUILD activity.
 *
 * ITEM `live-contract-check`. The standing rule, `DECISIONS.md:144-157` and SCOPE Part 3
 * §7: "Every endpoint a screen calls gets its path, verb, request body and response shape
 * checked against the ReaPrime handler AS IT IS WRITTEN, at the moment the screen is
 * built." Not before, not in a later audit pass — now, in the same commit as the caller.
 *
 * WHY THIS EXISTS BESIDE GATE D. Gate D asks a repo-wide question ("does every route the
 * client addresses have a row, and is every row true at the pin?"). This asks a screen-
 * shaped one: THESE six rows are the ones Live's connection-and-gates cluster depends on,
 * this is what each one is depended on FOR, and if a row's shape moves, the assertion that
 * fails names the screen that breaks. The D7 episode is the reason it is worth writing
 * twice: "a 'missing endpoint' claim that was false on both halves, caught only by opening
 * the handler" (UPSTREAM_WORK.md, top).
 *
 * THE 31 LIVE CONTRACT BUGS ARE A FLOOR, NOT A CEILING (`CAPABILITY_DIFF.md`, the one
 * section usable unedited). Two of them are this cluster's and are asserted below by their
 * mechanism rather than by their number: an absent `GHC` key read as `false`, and an
 * arm-time refusal that never reaches a person.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '../scripts/lib/source-scan.js';
import { collectRouteIds } from '../scripts/gate-d.js';

const REPO = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const read = (rel) => readFileSync(path.join(REPO, rel), 'utf8');
const TABLE = JSON.parse(read('src/data/CONTRACTS.json'));

const restRow = (id) => TABLE.rest.find((row) => row.id === id);
const socketRow = (id) => TABLE.sockets.find((row) => row.id === id);

/**
 * WHAT THIS SCREEN TOUCHES — the cluster's declared contract surface.
 *
 * `why` is the half a route table cannot hold: which item depends on the row, and what
 * would break if the shape moved. It is also this suite's own honesty check — a row that
 * cannot be given a `why` is a row this screen does not actually need.
 */
const SURFACE = Object.freeze([
    {
        kind: 'socket', id: 'devices', path: '/ws/v1/devices',
        by: 'src/lib/connection-surface.js via src/data/rea-devices.js (feeds[FEED.CONNECTION])',
        why: 'B8 — the FULL connectionStatus is what makes "still trying", "failed" and "two machines, pick one" three different pictures',
    },
    {
        kind: 'rest', id: 'putDevicesConnect', verb: 'PUT', path: '/api/v1/devices/connect',
        by: 'src/data/rea-devices.js createDevicesLink.connect, reached from <live-connection> through the screen',
        why: 'B8\'s second half — the park is ANSWERED. Rendering it without this preserves the old failure',
    },
    {
        kind: 'rest', id: 'getMachineInfo', verb: 'GET', path: '/api/v1/machine/info',
        by: 'src/stores/machine-info-store.js',
        why: 'A3/R3 — the GHC gate answers from this body through r3GroupHeadControllerCapability, and never from a machine name',
    },
    {
        kind: 'rest', id: 'getMachineCapabilities', verb: 'GET', path: '/api/v1/machine/capabilities',
        by: 'src/stores/capabilities-store.js (the routes helper)',
        why: 'A3 — the served seven are the capability answer for every gate that has one; [] is ReaPrime\'s own answer, not a failure',
    },
    {
        kind: 'rest', id: 'postMachineProfile', verb: 'POST', path: '/api/v1/machine/profile',
        by: 'src/stores/profile-arm-store.js',
        why: 'B9 — the arm-time 400 IS the refusal surface\'s source, and it exists today with zero upstream work',
    },
    {
        kind: 'socket', id: 'machineSnapshot', path: '/ws/v1/machine/snapshot',
        by: 'src/screens/live-wiring.js via feeds[FEED.MACHINE]',
        why: 'L11 — the ONE dimming owner reads the machine state from the store, never from a class somebody toggled',
    },
]);

describe('the contract surface this screen depends on', () => {
    test('every row this cluster touches is in the table, with the path and verb it uses', () => {
        for (const entry of SURFACE) {
            const row = entry.kind === 'rest' ? restRow(entry.id) : socketRow(entry.id);
            assert.ok(row, `${entry.id} has no contract row — ${entry.why}`);
            assert.equal(row.path, entry.path, `${entry.id} path`);
            if (entry.kind === 'rest') assert.equal(row.verb, entry.verb, `${entry.id} verb`);
        }
    });

    test('every row carries its handler evidence, at THIS build\'s pin', () => {
        for (const entry of SURFACE) {
            const row = entry.kind === 'rest' ? restRow(entry.id) : socketRow(entry.id);
            assert.ok(row.handlerSymbol, `${entry.id} names no handler symbol`);
            assert.ok(row.handlerFile, `${entry.id} names no handler file`);
            assert.equal(row.checkedCommit, TABLE.pinnedCommit,
                `${entry.id} was checked against a different commit than the table's pin`);
        }
    });

    test('every REST row this cluster calls is tabled as CONSUMED, and names its caller', () => {
        // Gate D asserts this repo-wide; here it is asserted with the CALLER named, which
        // is what turns "some file addresses this" into "this screen depends on this".
        for (const entry of SURFACE.filter((e) => e.kind === 'rest')) {
            const row = restRow(entry.id);
            assert.equal(row.status, 'consumed',
                `${entry.id} is "${row.status}" but ${entry.by} calls it`);
            assert.ok(row.consumedBy.length > 0, `${entry.id} names no consumer`);
        }
    });

    test('the two rows this wave turned from recorded into consumed name the module that did it', () => {
        assert.ok(restRow('getMachineInfo').consumedBy.some((c) => c.includes('machine-info-store')),
            'the GHC gate\'s feed is not cited on its own row');
        assert.ok(restRow('postMachineProfile').consumedBy.some((c) => c.includes('profile-arm-store')),
            'the refusal surface\'s caller is not cited on its own row');
    });

    test('the route ids the cluster addresses are exactly the ones it declares', () => {
        const files = ['src/stores/machine-info-store.js', 'src/stores/profile-arm-store.js'];
        const addressed = new Set(files.flatMap((f) => collectRouteIds(read(f))));
        assert.deepEqual([...addressed].sort(), ['getMachineInfo', 'postMachineProfile'],
            'a store reached a route this screen never declared, or stopped reaching one it did');
    });
});

describe('the handler-body gates this cluster actually leans on', () => {
    test('GHC: an absent key is not a false — the gate the whole A3 item rests on', () => {
        const row = restRow('getMachineInfo');
        const gate = row.gates.find((g) => g.kind === 'key-presence-is-the-answer');
        assert.ok(gate, 'the row lost the gate that says an absent GHC is unknown');
        assert.match(gate.meaning, /ABSENT key means an older or different server — not `false`/);
        assert.match(row.responseShape, /GHC:bool/);
        // And the adapter still behaves that way, which is the half a table cannot assert.
        assert.match(read('src/data/adapters-r.js'), /machine\/info answer has no GHC key/);
    });

    test('the arm-time refusal is a typed 400 and not an opaque 500 (B9)', () => {
        const row = restRow('postMachineProfile');
        assert.match(row.responseShape, /400 \{error:'Unsupported profile', message\}/);
        assert.match(row.responseShape, /400 \{error:'Invalid profile', message\}/);
        const gate = row.gates.find((g) => g.kind === 'arm-time-refusal');
        assert.ok(gate, 'the row lost the gate B9 depends on');
        assert.match(gate.action, /SEND the profile and surface the server's `message` verbatim/);
        // The reader that turns that body into a refusal reads the same two strings.
        const profile = stripComments(read('src/data/rea-profile.js'));
        assert.match(profile, /error === 'Unsupported profile'/);
    });

    test('the arm route takes the BARE profile — the asymmetry a second wrapper gets wrong', () => {
        const row = restRow('postMachineProfile');
        const gate = row.gates.find((g) => g.kind === 'shape-asymmetry');
        assert.ok(gate);
        assert.match(gate.meaning, /BARE profile; POST \/profiles takes it WRAPPED/);
        assert.equal(restRow('postProfiles').requestFields.body.profile !== undefined
            || JSON.stringify(restRow('postProfiles').requestFields.body).includes('profile'), true,
            'the wrapped sibling stopped being wrapped, which would make the asymmetry stale');
    });

    test('connect: the outcome is in the STATUS, never inferred from a later frame (B8)', () => {
        const row = restRow('putDevicesConnect');
        const gate = row.gates.find((g) => g.kind === 'outcome-in-status');
        assert.ok(gate, 'the row lost the gate the picker\'s answer path depends on');
        assert.match(row.responseShape, /409 conflict; 503 failed; 504 timedOut/);
        assert.match(row.notes.join(' '), /The verb is PUT\. A POST 404s\./);
    });

    test('the devices socket carries the whole B8 state, and takes the connect command', () => {
        const row = socketRow('devices');
        assert.match(row.carries, /connectionStatus/);
        assert.ok(row.commands.join(' ').includes('connect'),
            'the answer path is gone from the socket row');
        assert.equal(row.status, 'consumed');
    });

    test('capabilities: [] is an ANSWER, and the served set is still seven with no GHC', () => {
        const row = restRow('getMachineCapabilities');
        assert.match(row.responseShape, /\[\] otherwise/);
        assert.ok(!/GHC|groupHead/i.test(row.responseShape),
            'a served GHC entry would retire the R3 interim this screen is built on');
        assert.match(row.notes.join(' '), /\[\] is ReaPrime's own answer for a non-Bengle machine/);
    });
});
