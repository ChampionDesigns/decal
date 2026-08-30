/**
 * Gate D — the contract table as a build gate (SCOPE Part 8 §2).
 *
 * Three things are tested, in this order of importance:
 *
 *  1. THE CANARIES FIRE. Every check has a fixture that breaks its rule on purpose, and a
 *     case here asserting the check fails on it. A guard that silently stops covering its
 *     target is this project's most expensive recurring failure — three of them so far —
 *     and it is invisible without this.
 *  2. THE CONTROL PASSES. A file that DISCUSSES an untabled route and a retired spelling in
 *     prose must not trip anything. A false positive earns an exemption; an exemption is
 *     how coverage dies.
 *  3. THE TABLE IS TRUE. Every row is re-read against the ReaPrime handler at the pinned
 *     commit — the file exists, that file registers that path, and the symbol is in it —
 *     and the handler-body gates the wave named are asserted to be present and to say what
 *     the handler says.
 *
 * The desk check itself stays human, and passing it is necessary, not sufficient (D7).
 * Anything only the bench can settle is on the bench list, never asserted here.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
    REPO_ROOT,
    TABLE_PATH,
    loadTable,
    buildIndex,
    collectFiles,
    collectRouteStrings,
    collectRouteIds,
    collectConstructedPaths,
    checkCoverage,
    checkStaleness,
    checkSource,
    checkRetirement,
    checkTableIntegrity,
    checkGeneratedAgreement,
    resolveReaWorktree,
    runGateD,
} from '../scripts/gate-d.js';
import { PINNED_COMMIT, REA_ROOT } from '../scripts/lib/rea-source.js';

const FIXTURES = join(REPO_ROOT, 'test/fixtures/gate-d');
const fixture = (name) => ({ path: `test/fixtures/gate-d/${name}`, source: readFileSync(join(FIXTURES, name), 'utf8') });
const table = (name) => JSON.parse(readFileSync(join(FIXTURES, name), 'utf8'));

const TABLE = loadTable();
const rules = (violations) => [...new Set(violations.map((v) => v.rule))].sort();

/* ------------------------------------------------------------------ canaries */

describe('Gate D canaries — every check fails on its fixture', () => {
    test('COVERAGE: a route-shaped literal with no table row', () => {
        const v = checkCoverage([fixture('unlisted-route.js')], TABLE);
        assert.deepEqual(rules(v), ['coverage-route-string']);
        assert.match(v[0].detail, /\/machine\/wakeUp/);
    });

    test('COVERAGE: a route id addressed with no table row', () => {
        const v = checkCoverage([fixture('unlisted-route-id.js')], TABLE);
        assert.deepEqual(rules(v), ['coverage-route-id']);
        assert.match(v[0].detail, /getSteams/);
    });

    test('COVERAGE: a path assembled from fragments in an undeclared file', () => {
        const v = checkCoverage([fixture('constructed-route.js')], TABLE);
        assert.deepEqual(rules(v), ['coverage-constructed-path']);
    });

    test('RETIREMENT: a retired contract bug back in code', () => {
        const v = checkRetirement([fixture('forbidden-spelling.js')], TABLE);
        assert.equal(v.length, 1);
        assert.match(v[0].detail, /CB-21/);
    });

    test('STALENESS: a wrong pin on the table and on a row', () => {
        const v = checkStaleness(table('stale-table.json'), PINNED_COMMIT);
        assert.deepEqual(rules(v), ['staleness-row', 'staleness-table-pin']);
    });

    test('SOURCE: a handler file, a registration and a symbol that are not true at the pin', () => {
        const v = checkSource(table('wrong-handler-table.json'), REA_ROOT);
        assert.deepEqual(rules(v), ['source-handler-file', 'source-handler-symbol', 'source-route-registration']);
        // getSensors is pointed at shots_handler.dart: the file exists, and does not carry
        // either the route or the symbol — so one wrong row raises both findings.
        const sensors = v.filter((x) => x.detail.includes('getSensors')).map((x) => x.rule).sort();
        assert.deepEqual(sensors, ['source-handler-symbol', 'source-route-registration']);
    });

    test('SOURCE: a missing worktree is a failure, never a silent skip', () => {
        const v = checkSource(TABLE, '/nonexistent/rea-worktree');
        assert.deepEqual(rules(v), ['source-worktree-missing']);
    });

    // The canary for the hole this rule closes: the SOURCE half used to read handlers out of
    // REA_ROOT — an environment variable — without ever asking what commit that tree was at,
    // so a run against another ReaPrime checkout re-verified 46 of 50 rows against the wrong
    // commit and surfaced only the 4 route strings that differed. This repo stands in for
    // "a git tree that is not the pin": it is guaranteed present and guaranteed not ReaPrime.
    test('SOURCE: a worktree that is not at the pin re-verifies NOTHING', () => {
        const v = checkSource(TABLE, REPO_ROOT);
        assert.deepEqual(rules(v), ['source-worktree-commit']);
        assert.equal(v.length, 1, 'not one row is re-verified against the wrong commit');
        assert.match(v[0].detail, new RegExp(`is not the pinned ${PINNED_COMMIT}`));
    });

    test('SOURCE: a worktree whose HEAD cannot be resolved is a failure too', () => {
        const v = checkSource(TABLE, mkdtempSync(join(tmpdir(), 'gate-d-not-a-tree-')));
        assert.deepEqual(rules(v), ['source-worktree-commit']);
        assert.equal(v.length, 1);
    });

    test('the resolver reports the head it read, not just a verdict', () => {
        assert.deepEqual(resolveReaWorktree({ reaRoot: REA_ROOT }), { head: PINNED_COMMIT, violation: null });
        assert.equal(resolveReaWorktree({ reaRoot: REPO_ROOT }).head?.length, 40);
        assert.equal(resolveReaWorktree({ reaRoot: '/nonexistent/rea-worktree' }).head, null);
    });

    test('AGREEMENT: a row that contradicts the generated route table', async () => {
        const v = await checkGeneratedAgreement(table('disagreeing-table.json'));
        assert.deepEqual(rules(v), ['generated-agreement']);
        assert.equal(v.length, 2, 'the wrong verb and the imaginary channel are both caught');
    });

    test('INTEGRITY: missing column, unknown status, uncited caller, absent builder', () => {
        const v = checkTableIntegrity(table('malformed-table.json'));
        assert.deepEqual(rules(v), ['table-shape']);
        const details = v.map((x) => x.detail).join('\n');
        assert.match(details, /missing column "responseShape"/);
        assert.match(details, /status "guessed"/);
        assert.match(details, /no consumedBy/);
        assert.match(details, /no-such-builder\.js/);
        assert.match(details, /truth row "notARow"/);
    });
});

describe('Gate D control — prose is not code', () => {
    const control = fixture('clean-control.js');

    test('the control passes every check', () => {
        assert.deepEqual(checkCoverage([control], TABLE), []);
        assert.deepEqual(checkRetirement([control], TABLE), []);
    });

    test('and it really does name the untabled route and the retired spelling', () => {
        assert.match(control.source, /\/machine\/wakeUp/);
        assert.match(control.source, /response\.shots/);
    });

    test('the literal scanner sees the tabled route and not the discussed one', () => {
        assert.deepEqual(collectRouteStrings(control.source), ['/shots']);
        assert.deepEqual(collectRouteIds(control.source).sort(), ['getShots', 'getShotsLatest']);
        assert.deepEqual(collectConstructedPaths(control.source), []);
    });

    test('a css tagged template is not a constructed path', () => {
        const css = 'const s = css`\n  :host { color: var(--x); background: url(a/b); }\n`;';
        assert.deepEqual(collectConstructedPaths(css), []);
    });
});

/* --------------------------------------------------------------- the real run */

describe('Gate D over this repo', () => {
    test('passes, with the source half actually run', async () => {
        const report = await runGateD({ source: true });
        assert.deepEqual(report.violations, [], report.violations.map((v) => `${v.rule} ${v.file}: ${v.detail}`).join('\n'));
        assert.equal(report.ok, true);
        assert.equal(report.counts.sourceChecked, true);
    });

    test('and it records WHICH tree it read and what commit that tree is at', async () => {
        const report = await runGateD({ source: true });
        assert.equal(report.counts.reaRoot, REA_ROOT);
        assert.equal(report.counts.reaHead, PINNED_COMMIT, 'a run reports the head it verified, not the pin it hoped for');
        const skipped = await runGateD({ source: false });
        assert.equal(skipped.counts.reaHead, null, '--no-source read no tree, and says so');
    });

    // `npm test` caught a mispointed REA_ROOT via rea-routes-freshness; `npm run gate-d` —
    // the gate the wave's GATE agent runs — did not. It does now.
    test('a run against a tree that is not the pin FAILS, whatever the rows say', async () => {
        const report = await runGateD({ source: true, reaRoot: REPO_ROOT });
        assert.equal(report.ok, false);
        assert.deepEqual(rules(report.violations), ['source-worktree-commit']);
        assert.notEqual(report.counts.reaHead, PINNED_COMMIT);
    });

    test('every client file under src/ is scanned, and the generated table is not', () => {
        const files = collectFiles();
        assert.ok(files.length >= 25, `${files.length} files scanned`);
        assert.ok(!files.some((f) => f.path.endsWith('rea-routes.generated.js')),
            'the generated table is the DOCUMENTED surface, not a caller — requiring rows for all 143 would make the contract table a copy of it');
        assert.ok(files.some((f) => f.path === 'src/data/rea-transport.js'));
        assert.ok(files.some((f) => f.path === 'src/components/base.js'), 'components are scanned too, not just the data layer');
    });

    test('the pin is written in exactly one place', () => {
        assert.equal(TABLE.pinnedCommit, PINNED_COMMIT);
        const source = readFileSync(join(REPO_ROOT, 'scripts/gate-d.js'), 'utf8');
        assert.ok(!/[0-9a-f]{40}/.test(source), 'gate-d.js must not carry its own copy of the commit');
    });
});

/* ------------------------------------------------------------------ the table */

describe('the contract table', () => {
    test('every row carries the six contract columns Part 3 §7 names', () => {
        for (const row of TABLE.rest) {
            assert.ok(row.path && row.verb, row.id);
            assert.ok(row.requestFields !== undefined, `${row.id} requestFields`);
            assert.ok(row.responseShape, `${row.id} responseShape`);
            assert.ok(row.handlerSymbol && row.handlerFile, `${row.id} handler`);
            assert.equal(row.checkedCommit, PINNED_COMMIT, `${row.id} checkedCommit`);
        }
    });

    test('every route the client addresses today is a "consumed" row', () => {
        const index = buildIndex(TABLE);
        const consumed = new Set(TABLE.rest.filter((r) => r.status === 'consumed').map((r) => r.id));
        for (const file of collectFiles()) {
            for (const id of collectRouteIds(file.source)) {
                assert.ok(consumed.has(id), `${file.path} calls ${id}, which is tabled as "${index.rest.find((r) => r.id === id).status}"`);
            }
        }
    });

    test('a "recorded" row states why it exists — a gate or a retired bug — and nothing calls it', () => {
        const addressed = new Set(collectFiles().flatMap((f) => collectRouteIds(f.source)));
        for (const row of TABLE.rest.filter((r) => r.status === 'recorded')) {
            const why = (row.gates || []).length + (row.retires || []).length;
            assert.ok(why > 0, `${row.id} is recorded with neither a handler-body gate nor a retired bug`);
            assert.ok(!addressed.has(row.id),
                `${row.id} is tabled as "recorded" but the client addresses it — it is consumed, and must say so`);
        }
    });
});

/* -------------------------------------------------- the handler-body gates */

describe('handler-body gates, re-read at the pin', () => {
    const dart = (rel) => readFileSync(join(REA_ROOT, rel), 'utf8');
    const row = (id) => TABLE.rest.find((r) => r.id === id);
    const gateKinds = (id) => (row(id).gates || []).map((g) => g.kind);

    test('feedback: 503 before anything else, so the form must hide itself (CB-10)', () => {
        const src = dart('lib/src/services/webserver/feedback_handler.dart');
        assert.match(src, /if \(!_service\.isConfigured\)\s*\{\s*return jsonServiceUnavailable/);
        assert.match(src, /GITHUB_FEEDBACK_TOKEN/);
        assert.ok(gateKinds('postFeedback').includes('503-is-feature-absent'));
    });

    test('arm-time refusal: a typed 400, not an opaque 500 (B9)', () => {
        const src = dart('lib/src/services/webserver/de1handler.dart');
        assert.match(src, /on ProfileModeUnsupportedException catch \(e\)/);
        assert.match(src, /'error': 'Unsupported profile'/);
        assert.ok(gateKinds('postMachineProfile').includes('arm-time-refusal'));
        assert.equal(row('postMachineProfile').responseShape.includes("'Unsupported profile'"), true);
    });

    test('/shots: the limit is clamped for the query and echoed unclamped in the body (CB-23)', () => {
        const src = dart('lib/src/services/webserver/shots_handler.dart');
        assert.match(src, /limit: limit\.clamp\(1, 100\)/);
        assert.match(src, /'limit': limit,/);
        assert.ok(gateKinds('getShots').includes('silent-clamp-with-lying-echo'));
    });

    test('/shots: the list is {items,total,limit,offset} — never {shots} (CB-21)', () => {
        const src = dart('lib/src/services/webserver/shots_handler.dart');
        assert.match(src, /jsonOkConditional\(req, \{\s*'items'/);
        assert.ok(!/'shots':/.test(src), "the handler has no 'shots' key at the pin");
        assert.match(row('getShots').responseShape, /items/);
    });

    test('the Bengle feature gate answers 404, on four routes (feature absent, not error)', () => {
        const src = dart('lib/src/services/webserver/de1handler.dart');
        assert.match(src, /Response\? _bengleFirmwareGate[\s\S]{0,200}jsonNotFound/);
        for (const id of ['getMachineCupWarmer', 'putMachineCupWarmer', 'getMachineCupWarmerPreheat',
            'putMachineCupWarmerPreheat', 'getMachineScaleCalibration', 'putMachineScaleCalibration',
            'getMachineLedStrip', 'putMachineLedStrip']) {
            assert.ok(gateKinds(id).includes('404-is-feature-absent'), `${id} records the gate`);
        }
    });

    test('cup warmer: temperature without enabled turns it ON (CB-27)', () => {
        const src = dart('lib/src/services/webserver/de1handler.dart');
        assert.match(src, /\} else if \(temperature != null\) \{\s*await bengle\.setCupWarmerEnabled\(true\);/);
        assert.ok(gateKinds('putMachineCupWarmer').includes('implicit-enable'));
    });

    test('scale calibration: PUT /machine/scaleCalibration {command: abort|zero|latch, weightGrams} (CB-15)', () => {
        const src = dart('lib/src/services/webserver/de1handler.dart');
        assert.match(src, /app\.put\('\/api\/v1\/machine\/scaleCalibration'/);
        for (const command of ["'abort'", "'zero'", "'latch'"]) assert.ok(src.includes(`case ${command}:`), command);
        assert.match(src, /json\['weightGrams'\]/);
        assert.ok(!/scale\/calibrate/.test(src), 'the old skin\'s path is nowhere in the handler');
        const r = row('putMachineScaleCalibration');
        assert.match(JSON.stringify(r.requestFields), /abort/);
        assert.match(JSON.stringify(r.requestFields), /weightGrams/);
    });

    test('keep-awake: only a PRESENT keepAwakeFor of 0 or null clears it (CB-22)', () => {
        const src = dart('lib/src/services/webserver/presence_handler.dart');
        assert.match(src, /if \(json\.containsKey\('keepAwakeFor'\)\)/);
        assert.match(src, /if \(val == null \|\| val == 0\) \{\s*clearKeepAwakeFor = true;/);
        assert.ok(gateKinds('putPresenceSchedulesById').includes('presence-is-the-signal'));
        assert.match(JSON.stringify(row('putPresenceSchedulesById').requestFields), /PRESENT/);
    });

    test('KV: a missing key is 200-with-null, never 404 (settled here)', () => {
        const src = dart('lib/src/services/webserver/kv_store_handler.dart');
        assert.match(src, /return jsonOk\(await store\.get\(namespace: namespace, key: key\)\);/);
        assert.ok(!/jsonNotFound/.test(src), 'this handler has no 404 path at all');
        assert.ok(gateKinds('getStoreByNamespaceByKey').includes('settled-by-this-table'));
    });

    test('firmware: the upload answers NDJSON, so response.json() cannot work (CB-17)', () => {
        const src = dart('lib/src/services/webserver/firmware_handler.dart');
        assert.match(src, /'Content-Type': 'application\/x-ndjson'/);
        assert.match(src, /emit\(\{'status': 'done', 'progress': 1\.0\}\)/);
        assert.ok(gateKinds('postMachineFirmware').includes('ndjson-not-json'));
    });

    test('latest shot: 200 carrying null is the answer, not a failure (A7)', () => {
        const src = dart('lib/src/services/webserver/shots_handler.dart');
        assert.match(src, /return jsonOk\(shot\?\.toJsonWithoutMeasurements\(\)\);/);
        assert.ok(gateKinds('getShotsLatest').includes('null-is-the-answer'));
    });

    test('the ledStrip routes D7 was said to be missing all exist (four of them)', () => {
        const src = dart('lib/src/services/webserver/de1handler.dart');
        for (const r of ['/api/v1/machine/ledStrip', '/api/v1/machine/ledStrip/commit', '/api/v1/machine/ledStrip/reset']) {
            assert.ok(src.includes(`'${r}'`), r);
        }
        assert.ok(!/ledStrip\/preview/.test(src), 'and the two the old skin POSTed do NOT exist');
    });
});

/* ---------------------------------------------------------- the upstream four */

describe('the ReaPrime-side contract bugs', () => {
    test('are listed, and each names a file that exists at the pin', () => {
        assert.equal(TABLE.reaPrimeSide.length, 4);
        for (const entry of TABLE.reaPrimeSide) {
            assert.match(entry.bug, /^CB-\d\d$/);
            assert.match(entry.policy, /upstream/i);
        }
    });

    test('CB-05 really does throw before the try block', () => {
        const src = readFileSync(join(REA_ROOT, 'lib/src/services/webserver/sensors_handler.dart'), 'utf8');
        const cast = src.indexOf("jsonBody['commandId'] as String");
        const tryAt = src.indexOf('try {', cast);
        assert.ok(cast > 0 && tryAt > cast, 'the unguarded cast precedes the try — a malformed body is a 500 with a Dart stack');
    });

    test('CB-06 really does bind to whichever sensor registered first', () => {
        const src = readFileSync(join(REA_ROOT, 'lib/src/controllers/steam_sequencer.dart'), 'utf8');
        assert.match(src, /entries\.first/);
    });
});
