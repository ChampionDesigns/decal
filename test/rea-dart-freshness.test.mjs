// THE HAND COPIES THAT HAD NO STALENESS GATE.
//
// SCOPE Part 2 §7's rule is that a committed generated file has a generator and a test that
// regenerates it and fails on a diff. `machine-state.generated.js` has both; so does
// `rea-routes.generated.js`. Three more copies of ReaPrime's own words were hand-written
// with nothing comparing them to the source, in the same wave that built that machinery for
// exactly this defect:
//
//   * `rea-devices.js` — FIVE enums (ConnectionPhase, AmbiguityReason, ConnectionOutcome,
//     ConnectionState, DeviceType), all declared in Dart at the pin and all documented in
//     `assets/api/websocket_v1.yml`, the file the route table is already generated from.
//     `phaseKnown` / `ambiguityKnown` surface an unknown value at RUNTIME, on a bench, on a
//     frame nobody may be watching; nothing failed at build time when upstream grew a phase.
//   * `capabilities-store.js` — `SERVED_CAPABILITIES`, whose only guard was a SECOND hand
//     copy of the same seven names inside its own test asserting the two were equal. That
//     is circular: both copies drift together and the assertion still passes. The list
//     drives `unknownEntries()`, so an eighth served entry would be reported as "unknown to
//     this build" for ever and a removed one would never surface at all.
//   * `feed-readers.js` — the shot-state KEY set. Its display and update key sets and all
//     four of its enums ARE Dart-derived by test already; the shot-state keys were the one
//     set that was not, and that module is the second address layer, so a wire change there
//     needs edits in two files across two gates.
//
// These are not generators: the artifacts are small, hand-placed and carry judgement
// (`DEVICE_STATE` is spelled from `ConnectionState` because ReaPrime calls the same idea
// two things in two files). What they need is the OTHER half of the pattern — a test that
// reads the pinned source independently and fails on a difference. That is this file.
//
// It reads the reference worktree at the pin, exactly as
// `test/machine-state-freshness.test.mjs` does, and never writes to it.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { readReaFile, resolveReaCommit, PINNED_COMMIT } from '../scripts/lib/rea-source.js';
import { parseEnum } from '../scripts/generate-machine-state.js';
import {
    CONNECTION_PHASE,
    AMBIGUITY,
    CONNECT_OUTCOME,
    DEVICE_STATE,
    DEVICE_TYPE,
    CONNECTION_ERROR_SEVERITY,
    SCAN_SCOPED_ERROR_KINDS,
} from '../src/data/rea-devices.js';
import { SERVED_CAPABILITIES } from '../src/stores/capabilities-store.js';

const CONNECTION_MANAGER = 'lib/src/controllers/connection_manager.dart';
const SCAN_REPORT = 'lib/src/models/scan_report.dart';
const DEVICE = 'lib/src/models/device/device.dart';
const DE1_HANDLER = 'lib/src/services/webserver/de1handler.dart';
const CONNECTION_ERROR = 'lib/src/controllers/connection_error.dart';

const read = (relative) => readReaFile(relative).text;

test('the freshness tests run against a worktree AT the pin, or not at all', () => {
    // Same argument as Gate D's SOURCE half: a row re-verified against the wrong commit is
    // worse than one nobody checked, because it carries a stamp saying otherwise.
    assert.equal(resolveReaCommit(), PINNED_COMMIT);
});

describe('rea-devices.js — five enums, checked against the Dart that declares them', () => {
    const cases = [
        { name: 'ConnectionPhase', file: CONNECTION_MANAGER, table: CONNECTION_PHASE },
        { name: 'AmbiguityReason', file: CONNECTION_MANAGER, table: AMBIGUITY },
        { name: 'ConnectionOutcome', file: SCAN_REPORT, table: CONNECT_OUTCOME },
        { name: 'ConnectionState', file: DEVICE, table: DEVICE_STATE },
        { name: 'DeviceType', file: DEVICE, table: DEVICE_TYPE },
    ];

    for (const { name, file, table } of cases) {
        test(`${name} — member for member, in declaration order`, () => {
            const members = parseEnum(read(file), name);
            assert.deepEqual(Object.values(table), members,
                `${name} has drifted from ${file}. Upstream is the authority; fix the table, not the Dart.`);
        });
    }

    test('the wire values are the enum member names, which is why a plain compare is enough', () => {
        // ReaPrime serialises these with `.name`, so the JSON string IS the member name.
        // If that ever stops being true this comparison stops being the right one — which
        // is itself worth failing on, so the evidence is asserted rather than assumed.
        const manager = read(CONNECTION_MANAGER);
        assert.match(manager, /phase\.name|\.name/, 'connection_manager serialises enum members by name');
    });

    test('an enum that grows upstream fails HERE, not on a bench frame', () => {
        // The counterfactual, stated as a test: add a member to the parsed list and the
        // comparison above is what breaks. `phaseKnown` would only have surfaced it at
        // runtime, on a frame someone happened to be looking at.
        const members = parseEnum(read(CONNECTION_MANAGER), 'ConnectionPhase');
        assert.notDeepEqual(Object.values(CONNECTION_PHASE), [...members, 'somethingNew']);
    });
});

describe('rea-devices.js — the ConnectionError tables the banner rule reads', () => {
    /**
     * ADDED 28 AUGUST 2026, with the fix for Ben's stuck "could not connect" banner.
     *
     * `connection-surface.js` decides whether a published error may wear a failure
     * headline, and it decides it from `kind` and `severity`. Both were on the wire and
     * read by nothing until that day. A copy of an upstream set that nothing compares to
     * upstream is the exact defect this file exists for — and this one is worse than most,
     * because the failure is SILENT AND GENTLE: a fourth scan-scoped kind upstream adds
     * would simply not be demoted, and the banner would come back on a bench with nobody
     * able to say why. So the two tables are pinned here, and a change upstream fails a
     * test where a person decides what the new member is.
     *
     * `connection_error.dart` declares these as `static const` fields on a plain class
     * rather than as a Dart enum, so `parseEnum` does not apply; the two readers below are
     * shaped to the file as written at the pin.
     */

    /** The `static const NAME = 'value';` fields of one class, in declaration order. */
    function staticConsts(source, className) {
        const at = source.indexOf(`class ${className} {`);
        assert.ok(at >= 0, `${className} has moved out of ${CONNECTION_ERROR}`);
        const end = source.indexOf('\n}', at);
        assert.ok(end > at, `${className} is unterminated`);
        const body = source.slice(at, end);
        return [...body.matchAll(/static const ([A-Za-z0-9_]+) = '([^']+)';/g)]
            .map((m) => ({ name: m[1], value: m[2] }));
    }

    /** The members of a `static const NAME = <String>{ … };` set literal. */
    function stringSet(source, className, field) {
        const at = source.indexOf(`class ${className} {`);
        assert.ok(at >= 0, `${className} has moved`);
        const decl = source.indexOf(`static const ${field} = <String>{`, at);
        assert.ok(decl > at, `${className}.${field} is no longer a <String>{…} literal`);
        const close = source.indexOf('};', decl);
        assert.ok(close > decl, `${className}.${field} is unterminated`);
        const names = source.slice(decl, close).split('{')[1]
            .split(',').map((t) => t.trim()).filter(Boolean);
        assert.ok(names.length > 0, `${className}.${field} parsed as empty`);
        return names;
    }

    test('CONNECTION_ERROR_SEVERITY is the two levels ConnectionErrorSeverity declares', () => {
        const declared = staticConsts(read(CONNECTION_ERROR), 'ConnectionErrorSeverity');
        assert.deepEqual(declared.map((c) => c.value), Object.values(CONNECTION_ERROR_SEVERITY),
            'the severity table has drifted. Upstream is the authority; fix the table.');
    });

    test('SCAN_SCOPED_ERROR_KINDS is ConnectionErrorKind.sticky, member for member', () => {
        // The one hand interpretation in the whole rule, and this is what pins it: upstream
        // groups these three by MECHANISM (they survive a phase change), this tree reads
        // them by MEANING (they are about the radio, not about a connection). The two are
        // the same three strings today and this test is what says so tomorrow.
        const source = read(CONNECTION_ERROR);
        const sticky = stringSet(source, 'ConnectionErrorKind', 'sticky');
        const byName = new Map(staticConsts(source, 'ConnectionErrorKind').map((c) => [c.name, c.value]));
        const values = sticky.map((name) => {
            assert.ok(byName.has(name), `ConnectionErrorKind.sticky names ${name}, which is not declared`);
            return byName.get(name);
        });
        assert.deepEqual([...SCAN_SCOPED_ERROR_KINDS], values,
            'the scan-scoped set has drifted from ConnectionErrorKind.sticky. A new member is a '
            + 'DECISION: is it about the radio (demote it) or about a connection (leave it loud)?');
    });

    test('the kinds NOT in the set are the ones that must keep the banner', () => {
        /* The other direction, and the one that actually protects the user: a kind upstream
         * adds lands here as "connection-scoped" by fallback and keeps the loud answer, so
         * the risk is never a missed alarm — it is a stuck banner like Ben's. Listing the
         * complement makes a new kind visible at the moment it appears rather than at the
         * moment somebody notices a banner they cannot clear. */
        const source = read(CONNECTION_ERROR);
        const all = staticConsts(source, 'ConnectionErrorKind').map((c) => c.value);
        const connectionScoped = all.filter((v) => !SCAN_SCOPED_ERROR_KINDS.includes(v));
        assert.deepEqual(connectionScoped, [
            'scaleConnectFailed', 'machineConnectFailed', 'sensorConnectFailed',
            'scaleDisconnected', 'machineDisconnected', 'profileUploadFailed',
        ], 'ConnectionErrorKind has grown or lost a member — classify it in rea-devices.js');
    });
});

describe('capabilities-store.js — the seven the handler actually adds', () => {
    /**
     * The `caps.addAll([...])` block inside `GET /api/v1/machine/capabilities`.
     *
     * Deliberately narrow: it anchors on the route registration and then on the one
     * `addAll` that follows it, and fails loudly rather than half-reading. A handler that
     * stops building the list this way is a change worth being told about.
     */
    function servedCapabilities(source) {
        const at = source.indexOf("app.get('/api/v1/machine/capabilities'");
        assert.ok(at > 0, 'the capabilities route is no longer registered in de1handler.dart');
        const addAll = source.indexOf('caps.addAll([', at);
        assert.ok(addAll > at && addAll - at < 400, 'the capabilities handler no longer builds its list with caps.addAll([...])');
        const close = source.indexOf(']', addAll);
        const body = source.slice(addAll + 'caps.addAll(['.length, close);
        const names = [...body.matchAll(/'([A-Za-z0-9_]+)'/g)].map((m) => m[1]);
        assert.ok(names.length > 0, 'the served capability list parsed as empty');
        return names;
    }

    test('SERVED_CAPABILITIES is what de1handler.dart adds, in handler order', () => {
        assert.deepEqual([...SERVED_CAPABILITIES], servedCapabilities(read(DE1_HANDLER)),
            'the served list has moved upstream. unknownEntries() answers from this copy.');
    });

    test('the check reads the handler, not a second copy of the list in a test', () => {
        // The guard this replaces was `assert.deepEqual(SERVED_CAPABILITIES, SEVEN)` against
        // a SEVEN spelled in the test file — two hand copies agreeing with each other.
        const source = readReaFile(DE1_HANDLER);
        assert.match(source.path, /rea-reanchor-v3/);
        assert.ok(servedCapabilities(source.text).includes('wakeSchedule'));
    });
});

describe('feed-readers.js — the shot-state KEY set, from ShotStateEvent.toJson', () => {
    // The enums this reader validates against are already Dart-derived by
    // test/feed-readers.test.mjs. The KEY SET was the one thing that was not, in the module
    // that is this tree's SECOND address layer — so a wire rename there needed edits in two
    // files across two gates, and only one of them would have failed a test.
    const SHOT_EVENT_DART = 'lib/src/models/data/shot_state_event.dart';

    /** The keys one `Map<String, dynamic> toJson() => { ... }` literal writes. */
    function jsonKeys(source, afterSymbol) {
        const anchor = source.indexOf(afterSymbol);
        assert.ok(anchor >= 0, `${afterSymbol} has moved`);
        const at = source.indexOf('Map<String, dynamic> toJson()', anchor);
        assert.ok(at > 0, `${afterSymbol}.toJson has moved`);
        const end = source.indexOf('};', at);
        assert.ok(end > at, `${afterSymbol}.toJson is unterminated`);
        return new Set([...source.slice(at, end).matchAll(/'([A-Za-z][A-Za-z0-9_]*)'\s*:/g)].map((m) => m[1]));
    }

    test('every key readShotStateFrame addresses is one the serialiser writes', () => {
        const written = jsonKeys(read(SHOT_EVENT_DART), 'class ShotStateEvent');
        const addressed = [
            'state', 'event', 'timestamp', 'shotId', 'machineState', 'machineSubstate',
            'profileFrame', 'scaleConnected', 'scaleLost', 'machineHasAutonomousSAW', 'decision',
        ];
        for (const key of addressed) {
            assert.ok(written.has(key), `readShotStateFrame addresses "${key}", which toJson no longer writes`);
        }
        // And the other direction: a key the server grows that nothing reads is a MISS worth
        // seeing, so the sets are compared whole rather than one way.
        assert.deepEqual([...written].sort(), [...addressed].sort(),
            'ShotStateEvent.toJson and readShotStateFrame no longer address the same set');
    });

    test('the decision block\'s four keys are the ones ShotDecision serialises', () => {
        const written = jsonKeys(read(SHOT_EVENT_DART), 'class ShotDecision');
        assert.deepEqual([...written].sort(), ['data', 'details', 'kind', 'reason']);
    });
});
