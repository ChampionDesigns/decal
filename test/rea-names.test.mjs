
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import {
    SNAPSHOT_KEYS,
    SNAPSHOT_DERIVED_KEYS,
    SCALE_KEYS,
    ESTIMATOR_CHANNELS,
    ESTIMATOR_ALWAYS_PRESENT_CHANNELS,
    MILK_PROBE_CHANNELS,
    SENSOR_ID_SUFFIX,
    RENAMES,
    SEVEN_RENAMES,
    SEVEN_RENAME_ROWS,
    DEAD_NAMES_GLOBAL,
    DEAD_MACHINE_SNAPSHOT_KEYS,
    deadKeysPresent,
    sensorKindOf,
    findSensorId,
} from '../src/data/rea-names.js';
import { REA_ROOT, resolveCommit, PINNED_COMMIT } from '../scripts/generate-machine-state.js';

const MODELS = 'lib/src/models';
const SOURCES = {
    machine: `${MODELS}/device/machine.dart`,
    scale: 'lib/src/controllers/scale_controller.dart',
    estimator: `${MODELS}/device/impl/bengle/bengle_puck_estimator.dart`,
    milkProbe: `${MODELS}/device/impl/bengle/bengle_milk_probe.dart`,
    shotSnapshot: `${MODELS}/data/shot_snapshot.dart`,
    steamSnapshot: `${MODELS}/data/steam_snapshot.dart`,
};

const read = (key) => {
    const path = join(REA_ROOT, SOURCES[key]);
    assert.ok(existsSync(path), `ReaPrime source missing: ${path} (set REA_ROOT)`);
    return readFileSync(path, 'utf8');
};

/** Body of `<returnType> <name>(…) {` by brace matching, searching after `after`. */
function methodBody(source, signature, after = '') {
    const from = after ? source.indexOf(after) : 0;
    assert.ok(from >= 0, `anchor not found: ${after}`);
    const at = source.indexOf(signature, from);
    assert.ok(at >= 0, `signature not found: ${signature}`);
    const open = source.indexOf('{', at);
    let depth = 0;
    for (let i = open; i < source.length; i += 1) {
        if (source[i] === '{') depth += 1;
        else if (source[i] === '}') {
            depth -= 1;
            if (depth === 0) return source.slice(open + 1, i);
        }
    }
    return assert.fail(`unterminated body for ${signature}`);
}

const mapKeys = (body) => [...body.matchAll(/^[ \t]*(?:if \([^)]*\)\s*)?['"](\w+)['"]\s*:/gm)].map((m) => m[1]);

/** Every key in a one-line map literal, in order. */
const inlineMapKeys = (body) => [...body.matchAll(/['"](\w+)['"]\s*:/g)].map((m) => m[1]);

describe('the source is the pinned one', () => {
    test('every table below was read at the commit Wave 0b stamps', () => {
        assert.equal(resolveCommit(), PINNED_COMMIT);
    });
});

describe('MachineSnapshot', () => {
    const body = methodBody(read('machine'), 'Map<String, dynamic> toJson()', 'class MachineSnapshot');

    test('the twelve unconditional keys and the three derived ones, in serialiser order', () => {
        assert.deepEqual(mapKeys(body), [...SNAPSHOT_KEYS, ...SNAPSHOT_DERIVED_KEYS]);
        assert.equal(SNAPSHOT_KEYS.length, 12);
        assert.equal(SNAPSHOT_DERIVED_KEYS.length, 3);
    });

    test('the derived three are the CONDITIONAL ones — key presence is the validity signal', () => {
        for (const key of SNAPSHOT_DERIVED_KEYS) {
            assert.match(body, new RegExp(`if \\(${key} != null\\)`),
                `${key} must be emitted only when non-null`);
        }
        for (const key of SNAPSHOT_KEYS) {
            assert.doesNotMatch(body, new RegExp(`if \\(${key} != null\\)`),
                `${key} is unconditional and must not be treated as gated`);
        }
    });

    test('weight, weightFlow and milkTemperature are NOT on the machine snapshot', () => {
        // 633f6f68: "MachineSnapshot stays pure machine telemetry".
        for (const dead of ['weight', 'weightFlow', 'milkTemperature']) {
            assert.equal(mapKeys(body).includes(dead), false, `${dead} must be gone`);
        }
    });

    test('fromJson reads a fixed key list with no unknown-key bag — why absence is permanent', () => {
        const from = methodBody(read('machine'), 'factory MachineSnapshot.fromJson');
        const readKeys = [...from.matchAll(/json\[["'](\w+)["']\]/g)].map((m) => m[1]);
        assert.deepEqual([...new Set(readKeys)].sort(), [...SNAPSHOT_KEYS].sort());
        assert.doesNotMatch(from, /json\.entries|addAll|\.\.\.json/,
            'an unknown-key bag here would change the permanence rule');
    });
});

describe('WeightSnapshot — the one gravimetric source', () => {
    const body = methodBody(read('scale'), 'Map<String, dynamic> toJson()');

    test('the scale keys, in serialiser order, and weightFlow among them', () => {
        assert.deepEqual(mapKeys(body), [...SCALE_KEYS]);
        assert.ok(SCALE_KEYS.includes('weightFlow'));
    });

    test('nothing on the scale is conditional, so null is its absence signal', () => {
        assert.doesNotMatch(body, /if \(/);
    });
});

describe('the puck estimator sensor', () => {
    const source = read('estimator');

    test('the channel list matches SensorInfo.dataChannels, in order', () => {
        const declared = [...source.matchAll(/DataChannel\(key: '(\w+)'/g)].map((m) => m[1]);
        assert.deepEqual(declared, [...ESTIMATOR_CHANNELS]);
    });

    test('every channel the old skin renamed is here under its real name', () => {
        for (const name of ['r1', 'r2', 'compliance', 'flags', 'collapseEventCount',
            'collapseLastEventT', 'collapseLastEventMagnitude', 'collapseLastEventConcavity']) {
            assert.ok(ESTIMATOR_CHANNELS.includes(name), name);
        }
    });

    test('the always-present six are exactly the unconditional entries of encodeSample', () => {
        const body = methodBody(source, 'static Map<String, dynamic> encodeSample');
        const entries = [...body.matchAll(/(if \([^)]*\)\s*)?['"](\w+)['"]\s*:/g)];
        const unconditional = entries.filter((m) => !m[1]).map((m) => m[2]);
        assert.deepEqual(unconditional.sort(), [...ESTIMATOR_ALWAYS_PRESENT_CHANNELS].sort());
        const conditional = entries.filter((m) => m[1]).map((m) => m[2]);
        assert.ok(conditional.includes('r2') && conditional.includes('compliance'));
        assert.deepEqual([...unconditional, ...conditional].sort(), [...ESTIMATOR_CHANNELS].sort());
    });
});

describe('the milk probe', () => {
    test('its channels are timestamp and temperature — not milkTemperature', () => {
        const declared = [...read('milkProbe').matchAll(/DataChannel\(key: '(\w+)'/g)].map((m) => m[1]);
        assert.deepEqual(declared, [...MILK_PROBE_CHANNELS]);
        assert.equal(MILK_PROBE_CHANNELS.includes('milkTemperature'), false);
    });

    test('a stored steam session still persists its own milkTemperature double', () => {
        const body = methodBody(read('steamSnapshot'), 'Map<String, Object?> toJson()');
        assert.deepEqual(inlineMapKeys(body), ['machine', 'milkTemperature']);
    });
});

describe('sensor ids and the stored sensors map', () => {
    test('the id suffixes are the ones ReaPrime mints', () => {
        assert.match(read('estimator'), new RegExp(`\\$\\{_machineDeviceId\\(bengle\\)\\}${SENSOR_ID_SUFFIX.puckEstimator}`));
        assert.match(read('milkProbe'), new RegExp(`\\$\\{_machineDeviceId\\(bengle\\)\\}${SENSOR_ID_SUFFIX.milkProbe}`));
    });

    test('ShotSnapshot omits `sensors` entirely rather than writing an empty map', () => {
        const body = methodBody(read('shotSnapshot'), 'Map<String, Object?> toJson()');
        assert.match(body, /if \(sensors != null && sensors!\.isNotEmpty\) "sensors": sensors/);
        assert.deepEqual(mapKeys(body), ['machine', 'scale', 'volume', 'sensors']);
    });

    test('kind lookup and listing lookup agree', () => {
        assert.equal(sensorKindOf('X-puckestimator'), 'puckEstimator');
        assert.equal(sensorKindOf('X-milkprobe'), 'milkProbe');
        assert.equal(sensorKindOf('X'), null);
        assert.equal(sensorKindOf(null), null);
        assert.equal(findSensorId(['a-milkprobe', 'a-puckestimator'], 'puckEstimator'), 'a-puckestimator');
        assert.equal(findSensorId([{ id: 'a-milkprobe' }], 'puckEstimator'), null);
    });
});

describe('the rename table', () => {
    test("Part 6's seven ROWS cover twelve names, and every one is here", () => {
        assert.equal(new Set(SEVEN_RENAMES.map((r) => r.sevenRow)).size, SEVEN_RENAME_ROWS);
        assert.deepEqual(SEVEN_RENAMES.map((r) => r.dead), [
            'puckResistance', 'loadImpedance', 'hydraulicPower',
            'fusedR1', 'fusedR2', 'fusedC', 'estFlags',
            'detEventCount', 'detLastEventT', 'detLastEventMag', 'detLastEventConc',
            'weightFlow',
        ]);
        assert.deepEqual([...SEVEN_RENAMES].map((r) => r.sevenRow), [1, 2, 3, 4, 4, 5, 5, 6, 6, 6, 6, 7]);
    });

    test('the rows beyond the seven are the same commit\'s other casualties', () => {
        const rest = RENAMES.filter((r) => r.sevenRow === null).map((r) => r.dead);
        assert.deepEqual(rest.sort(), ['estLag', 'fusedConf', 'milkTemperature', 'vAbs', 'weight']);
    });

    test('every live name on the right-hand side is a name the server actually writes', () => {
        const live = {
            machine: [...SNAPSHOT_KEYS, ...SNAPSHOT_DERIVED_KEYS],
            scale: SCALE_KEYS,
            estimator: ESTIMATOR_CHANNELS,
            milkProbe: MILK_PROBE_CHANNELS,
        };
        for (const row of RENAMES) {
            assert.ok(live[row.on], `unknown container ${row.on}`);
            assert.ok(live[row.on].includes(row.live), `${row.dead} -> ${row.live} on ${row.on}`);
        }
    });

    test('a globally dead name is dead everywhere — it appears in no live table', () => {
        const everything = new Set([
            ...SNAPSHOT_KEYS, ...SNAPSHOT_DERIVED_KEYS, ...SCALE_KEYS,
            ...ESTIMATOR_CHANNELS, ...MILK_PROBE_CHANNELS,
        ]);
        for (const dead of DEAD_NAMES_GLOBAL) assert.equal(everything.has(dead), false, dead);
    });

    test('the machine-scoped dead names are alive elsewhere, which is why they are scoped', () => {
        const scoped = RENAMES.filter((r) => r.scope === 'machine').map((r) => r.dead);
        assert.deepEqual(scoped.sort(), ['milkTemperature', 'weight', 'weightFlow']);
        assert.ok(SCALE_KEYS.includes('weightFlow') && SCALE_KEYS.includes('weight'));
        assert.ok(DEAD_MACHINE_SNAPSHOT_KEYS.includes('weightFlow'));
        assert.ok(!DEAD_NAMES_GLOBAL.includes('weightFlow'));
    });

    test('deadKeysPresent reports, in table order, and never returns a value', () => {
        const found = deadKeysPresent({ flow: 1, fusedR2: 9, weight: 18, puckResistance: 2 });
        assert.deepEqual(found, ['puckResistance', 'fusedR2', 'weight']);
        assert.deepEqual(deadKeysPresent({ flow: 1 }), []);
        assert.deepEqual(deadKeysPresent(null), []);
        assert.ok(found.every((k) => typeof k === 'string'), 'names only — never values');
    });
});
