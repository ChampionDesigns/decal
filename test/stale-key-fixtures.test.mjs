
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { DEAD_NAMES_GLOBAL, DEAD_MACHINE_SNAPSHOT_KEYS } from '../src/data/rea-names.js';
import { readStoredMeasurement } from '../src/data/rea-address.js';
import { isNoReading } from '../src/data/reading.js';

const REPO = fileURLToPath(new URL('../', import.meta.url));

const DECLARED_EXEMPT = Object.freeze([
    'test/fixtures/dead-names/reads-dead-name.js',
    'test/fixtures/dead-names/clean-control.js',
]);

/** Where a human writes a payload by hand. `tools/rea-fixtures/` is deliberately absent. */
const AUTHORED_FIXTURE_DIRS = Object.freeze([
    'test/fixtures',
    'tools/fixtures',
    'tools/gallery/entries',
]);

/** The capture corpus: what the server actually answered, hash-pinned in FIXTURES.sha256. */
const RECORDED_DIR = 'tools/rea-fixtures';

const walk = (dir) => (existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true }).flatMap((entry) => (
        entry.isDirectory() ? walk(`${dir}/${entry.name}`) : [`${dir}/${entry.name}`]))
    : []);

export function deadKeyPaths(value, names = DEAD_NAMES_GLOBAL, path = '') {
    if (Array.isArray(value)) {
        return value.flatMap((item, i) => deadKeyPaths(item, names, `${path}[${i}]`));
    }
    if (!value || typeof value !== 'object') return [];
    return Object.entries(value).flatMap(([key, item]) => [
        ...(names.includes(key) ? [`${path}/${key}`] : []),
        ...deadKeyPaths(item, names, `${path}/${key}`),
    ]);
}

describe('the dead suites died with their modules', () => {
    const RETIRED = ['fused', 'detector', 'derived-channels', 'historical-gflow', 'loadcell-cal'];

    test('no module and no suite carries a retired name', () => {
        const files = [...walk(`${REPO}src`), ...walk(`${REPO}test`)].map((p) => p.slice(REPO.length));
        const offenders = files.filter((path) => {
            const base = path.split('/').pop().replace(/\.(test\.)?m?js$/, '');
            return RETIRED.includes(base);
        });
        assert.deepEqual(offenders, [],
            'fused.js, detector.js and derived-channels.js are DROP/REPLACE and stay dead');
    });

    test('and nothing imports one, so none of them comes back by the side door', () => {
        const offenders = [];
        for (const path of [...walk(`${REPO}src`), ...walk(`${REPO}test`)]) {
            if (!/\.m?js$/.test(path)) continue;
            const source = readFileSync(path, 'utf8');
            for (const name of RETIRED) {
                const re = new RegExp(`from\\s+['"][^'"]*\\b${name}\\.js['"]`);
                if (re.test(source)) offenders.push(`${path.slice(REPO.length)} imports ${name}.js`);
            }
        }
        assert.deepEqual(offenders, []);
    });

    test('cup-warmer survives only as the ReaPrime-backed store, with no local model behind it', () => {
        assert.ok(existsSync(`${REPO}src/stores/cup-warmer.js`));
        assert.ok(existsSync(`${REPO}test/cup-warmer-store.test.mjs`));
        assert.equal(existsSync(`${REPO}test/cup-warmer.test.mjs`), false,
            'the old suite hand-built a local cup-warmer model that no longer exists');
    });
});

describe('no authored fixture keys on a name ReaPrime deleted', () => {
    const authored = AUTHORED_FIXTURE_DIRS
        .flatMap((dir) => walk(`${REPO}${dir}`))
        .map((path) => path.slice(REPO.length))
        .filter((path) => !DECLARED_EXEMPT.includes(path));

    test('there are authored fixtures to sweep', () => {
        // Otherwise every assertion below passes by finding nothing.
        assert.ok(authored.length >= 20, `only ${authored.length} authored fixture files found`);
        assert.ok(authored.some((p) => p.endsWith('.json')), 'and some of them are data');
    });

    test('the seven renamed keys and the detEvent* family appear nowhere in one', () => {
        const offenders = [];
        for (const path of authored) {
            const raw = readFileSync(`${REPO}${path}`, 'utf8');
            if (path.endsWith('.json')) {
                let parsed;
                try {
                    parsed = JSON.parse(raw);
                } catch {
                    continue;               // a deliberately unparseable Gate B canary
                }
                for (const hit of deadKeyPaths(parsed)) offenders.push(`${path}: ${hit}`);
                continue;
            }
            for (const name of DEAD_NAMES_GLOBAL) {
                if (new RegExp(`\\b${name}\\b`).test(raw)) offenders.push(`${path}: ${name}`);
            }
        }
        assert.deepEqual(offenders, [],
            'a hand-built fixture is the one place a rename can hide: nothing in the loop is the server');
    });

    test('the exemptions are exactly the dead-name canary pair, and both still exist', () => {
        // A sweep decays through its exemption list. This is the whole list.
        for (const path of DECLARED_EXEMPT) assert.ok(existsSync(`${REPO}${path}`), path);
        assert.equal(DECLARED_EXEMPT.length, 2);
    });

    test('the sweep bites — the canary it exempts would have failed it', () => {
        // Vacuity check: run the sweep's own rule over the file it excuses.
        const canary = readFileSync(`${REPO}test/fixtures/dead-names/reads-dead-name.js`, 'utf8');
        const found = DEAD_NAMES_GLOBAL.filter((name) => new RegExp(`\\b${name}\\b`).test(canary));
        assert.ok(found.length >= 4, `the canary names only ${found.length} dead keys`);
        assert.deepEqual(
            deadKeyPaths({ measurements: [{ machine: { fusedR1: 1, pressure: 9 } }] }),
            ['/measurements[0]/machine/fusedR1'],
            'and the JSON half finds a dead key at depth, with its path');
    });
});

describe('the recorded captures carry them, and that is evidence rather than a defect', () => {
    const recordings = walk(`${REPO}${RECORDED_DIR}`)
        .filter((p) => /api__v1__shots__[0-9a-f-]{36}\.json$/.test(p))
        .map((path) => ({ path: path.slice(REPO.length), body: JSON.parse(readFileSync(path, 'utf8')) }));

    test('all three recordings are present and every one of them carries dead keys', () => {
        assert.equal(recordings.length, 3);
        for (const { path, body } of recordings) {
            const hits = deadKeyPaths(body, DEAD_MACHINE_SNAPSHOT_KEYS);
            assert.ok(hits.length > 0, `${path} carries no legacy key — it is no longer the evidence`);
        }
    });

    test('THE RULE: the reader takes nothing from any of them', () => {
        for (const { path, body } of recordings) {
            const row = body.measurements.find((r) => r && r.machine
                && DEAD_NAMES_GLOBAL.some((name) => Object.hasOwn(r.machine, name)));
            assert.ok(row, `${path} has no row carrying a dead estimator key`);

            const read = readStoredMeasurement(row);
            // Reported as a diagnostic...
            for (const name of DEAD_NAMES_GLOBAL.filter((n) => Object.hasOwn(row.machine, n))) {
                assert.ok(read.machine.deadKeys.includes(name), `${path}: ${name} went unreported`);
            }
            for (const [channel, reading] of Object.entries(read.estimator.channels)) {
                assert.ok(isNoReading(reading),
                    `${path}: estimator.${channel} was populated from a legacy row`);
            }
            assert.equal(read.sensorsRecorded, false,
                'no `sensors` key: this recording predates the sensor envelope entirely');
        }
    });

    test('the capture corpus is the ONLY place a dead key appears as data', () => {
        const elsewhere = [...walk(`${REPO}test`), ...walk(`${REPO}src`), ...walk(`${REPO}tools`)]
            .filter((p) => p.endsWith('.json') && !p.startsWith(`${REPO}${RECORDED_DIR}/`))
            .flatMap((path) => {
                let parsed;
                try {
                    parsed = JSON.parse(readFileSync(path, 'utf8'));
                } catch {
                    return [];
                }
                return deadKeyPaths(parsed, DEAD_MACHINE_SNAPSHOT_KEYS)
                    .map((hit) => `${path.slice(REPO.length)}: ${hit}`);
            });
        assert.deepEqual(elsewhere, []);
    });
});
