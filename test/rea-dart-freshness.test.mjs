
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
        const manager = read(CONNECTION_MANAGER);
        assert.match(manager, /phase\.name|\.name/, 'connection_manager serialises enum members by name');
    });

    test('an enum that grows upstream fails HERE, not on a bench frame', () => {
        const members = parseEnum(read(CONNECTION_MANAGER), 'ConnectionPhase');
        assert.notDeepEqual(Object.values(CONNECTION_PHASE), [...members, 'somethingNew']);
    });
});

describe('rea-devices.js — the ConnectionError tables the banner rule reads', () => {
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
        const source = readReaFile(DE1_HANDLER);
        assert.match(source.path, /rea-reanchor-v3/);
        assert.ok(servedCapabilities(source.text).includes('wakeSchedule'));
    });
});

describe('feed-readers.js — the shot-state KEY set, from ShotStateEvent.toJson', () => {
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
        assert.deepEqual([...written].sort(), [...addressed].sort(),
            'ShotStateEvent.toJson and readShotStateFrame no longer address the same set');
    });

    test('the decision block\'s four keys are the ones ShotDecision serialises', () => {
        const written = jsonKeys(read(SHOT_EVENT_DART), 'class ShotDecision');
        assert.deepEqual([...written].sort(), ['data', 'details', 'kind', 'reason']);
    });
});
