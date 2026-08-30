/**
 * mock-contract.test.mjs — Gate B rule 4, inside `npm test`.
 *
 * "The battery is only as honest as mock_rea's frames" (SCOPE Part 8 §2, Gate B change
 * 4). `tools/check_mock_contract.py` holds the capture mock to the SAME table Gate D
 * holds the client to, and this suite is what keeps the checker itself honest:
 *
 *   * the control — the real fixture set, the real ledger — passes, and passes with the
 *     counts a reader can compare against the wave record rather than a bare boolean;
 *   * every rule fires on its own canary. Seven are deliberately wrong FIXTURES on disk
 *     in `test/fixtures/mock-contract/`; four mutate the ledger or the table into a temp
 *     file, because copying a 500-line ledger to break one field would rot the copy;
 *   * the three things the port DELETED stay deleted: the canned `{"success": true}`
 *     write reply, the three-deep chain of candidate contract tables, and `_resolve`'s
 *     endpoint fallback, which answered every `/shots?…` query from the one recorded
 *     `limit=20` page. All three are the A7 defect — a plausible answer standing where
 *     an absence should be visible — and a deleted fallback with no test is a fallback
 *     waiting to be helpfully restored.
 *
 * Python by design: the checker lives beside the mock it checks, and shelling out is how
 * `tools-port.test.mjs` already covers the capture rig. If python3 is missing these fail
 * loudly rather than skipping — a green suite that quietly stopped covering the capture
 * rig is exactly the decay Gate C's canary rule exists to prevent.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const CHECKER = 'tools/check_mock_contract.py';
const LEDGER = path.join(REPO, 'tools/mock-fixture-ledger.json');
const TABLE = path.join(REPO, 'src/data/CONTRACTS.json');
const CANARIES = path.join(REPO, 'test/fixtures/mock-contract');

/** Run the checker; returns its parsed report whether it passed or failed. */
function check(args = []) {
    try {
        return JSON.parse(execFileSync('python3', [CHECKER, '--json', ...args],
            { cwd: REPO, encoding: 'utf8' }));
    } catch (err) {
        if (err.stdout) return JSON.parse(err.stdout);
        throw new Error(`python3 ${CHECKER} ${args.join(' ')} failed:\n${err.stderr ?? err.message}`);
    }
}

const rules = (report) => [...new Set(report.findings.filter((f) => f.blocking).map((f) => f.rule))];

/** A mutant of a real JSON document, written where the checker can be pointed at it. */
function mutate(source, edit) {
    const dir = mkdtempSync(path.join(tmpdir(), 'decal-mock-canary-'));
    const doc = JSON.parse(readFileSync(source, 'utf8'));
    edit(doc);
    const file = path.join(dir, path.basename(source));
    writeFileSync(file, JSON.stringify(doc, null, 1));
    return file;
}

test('the control passes: every frame the mock can serve is vouched for', () => {
    const report = check();
    assert.equal(report.ok, true,
        JSON.stringify(report.findings.filter((f) => f.blocking), null, 1));
    assert.equal(report.counts.blocking, 0);
    // Counts, not just a boolean: a checker that silently stopped looking at anything
    // also reports ok. Every fixture is accounted for in exactly one bucket.
    const c = report.counts;
    assert.equal(c.vouched + c.unadopted + c.ledgered + c.nonJson + c.failed, c.fixtures,
        `every fixture belongs to exactly one bucket: ${JSON.stringify(c)}`);
    assert.equal(c.failed, 0);
    assert.ok(c.routesChecked >= 24, `only ${c.routesChecked} routes checked`);
    assert.ok(c.writeRowsChecked >= 20, `only ${c.writeRowsChecked} write rows checked`);
    assert.equal(report.pin, JSON.parse(readFileSync(TABLE, 'utf8')).pinnedCommit);
    assert.equal(report.sourceChecked, true);
});

test('the ledger accounts for every fixture the table does not', () => {
    const report = check();
    const ledger = JSON.parse(readFileSync(LEDGER, 'utf8'));
    // Nothing is declared that is not also derived: `ledger-stale` covers the reverse.
    for (const entry of [...ledger.nonJson, ...ledger.unadopted, ...ledger.findings]) {
        assert.ok(entry.checkedCommit === undefined || entry.checkedCommit === report.pin,
            `${entry.fixture} is stamped at ${entry.checkedCommit}, not the pin`);
        assert.ok(entry.handlerFile && entry.handlerSymbol && entry.evidence,
            `${entry.fixture} has no handler evidence`);
    }
    assert.equal(report.counts.ledgered, ledger.findings.length);
    assert.equal(report.counts.nonJson, ledger.nonJson.length);
    assert.equal(report.counts.unadopted, ledger.unadopted.length);
});

// --------------------------------------------------------------------------- //
// The canaries. One rule each.
// --------------------------------------------------------------------------- //

const FIXTURE_CANARIES = [
    ['shape-kind', 'an object where the row says an array'],
    ['keys-missing', 'eight of the nine keys the handler writes'],
    ['keys-extra', 'a seventh key on a six-key row'],
    ['forbidden-spelling', 'a retired contract bug (CB-18) alive inside a served frame'],
    ['invariant', 'three items for limit=2, which a SQL LIMIT cannot produce'],
    ['unvouched-route', 'a recording of a route with no row anywhere'],
    ['verb-not-served', 'a GET fixture for a route the table has only as POST'],
    ['unparseable', 'a recorded HTML page nobody declared as one'],
];

/** `unparseable/` breaks the rule named `fixture-unparseable`; the rest are eponymous. */
const RULE_OF = { unparseable: 'fixture-unparseable' };

for (const [rule, why] of FIXTURE_CANARIES) {
    test(`canary: ${rule} — ${why}`, () => {
        const report = check(['--fixtures-dir', path.join(CANARIES, rule),
            '--ledger', path.join(CANARIES, 'canary-ledger.json')]);
        assert.equal(report.ok, false, `the ${rule} canary did not fail the check`);
        assert.deepEqual(rules(report), [RULE_OF[rule] ?? rule],
            `the ${rule} canary fired ${JSON.stringify(rules(report))} — a canary that fires `
            + 'someone else\'s rule proves nothing about its own');
    });
}

test('canary: ledger-stale — a declared finding that no longer reproduces', () => {
    const file = mutate(LEDGER, (doc) => { doc.findings[0].rules = ['keys-missing']; });
    const report = check(['--ledger', file]);
    assert.equal(report.ok, false);
    assert.ok(rules(report).includes('ledger-stale'), JSON.stringify(rules(report)));
    // And the entry stops suppressing: the real findings come back with it.
    assert.ok(rules(report).includes('keys-extra'),
        'a stale ledger entry must stop hiding the finding underneath it');
});

test('canary: ledger-unstamped — a ledger that is not stamped at the pin', () => {
    const file = mutate(LEDGER, (doc) => { doc.pinnedCommit = '0'.repeat(40); });
    const report = check(['--ledger', file]);
    assert.equal(report.ok, false);
    assert.deepEqual(rules(report), ['ledger-unstamped'], JSON.stringify(rules(report)));
});

test('canary: ledger-source — an entry anchored on the wrong handler file', () => {
    /* THIS CANARY NAMED A LIST THAT CAN LEGITIMATELY EMPTY, AND ON 27 AUGUST 2026 IT DID.
     *
     * It mutated `unadopted[0]`, and the unadopted list held exactly one entry:
     * `api__v1__info.json`. That route gained a client that day — Updates › Skin / App
     * finally has an App half — so it moved into the contract table, and a ledger entry
     * beside a table row is two records of one route, which `check_mock_contract.py` fails
     * as `ledger-stale` in as many words. The list went to zero and the canary stopped
     * proving anything: it threw a TypeError, which reads as a broken test rather than as
     * a guard that has lost its target.
     *
     * `ledger-source` WALKS ALL THREE LISTS — nonJson, unadopted and findings — so the
     * canary takes whichever one has an entry, and ASSERTS there is one. A canary that
     * cannot fail is worse than no canary; a canary that cannot RUN at least says so, and
     * this one now says which. */
    const anchored = (doc) => doc.nonJson?.[0] ?? doc.unadopted?.[0] ?? doc.findings?.[0] ?? null;
    assert.ok(anchored(JSON.parse(readFileSync(LEDGER, 'utf8'))),
        'the ledger carries no handler-anchored entry at all — this canary has no target');
    const file = mutate(LEDGER, (doc) => {
        anchored(doc).handlerFile = 'lib/src/services/webserver/shots_handler.dart';
    });
    const report = check(['--ledger', file]);
    assert.equal(report.ok, false);
    assert.deepEqual(rules(report), ['ledger-source'], JSON.stringify(rules(report)));
});

test('canary: shape-unparsed — an unreadable success clause is never a pass', () => {
    const file = mutate(TABLE, (doc) => {
        for (const row of doc.rest) {
            if (row.id === 'getDevices') row.responseShape = '200 whatever the machine feels like';
        }
    });
    const report = check(['--table', file]);
    assert.equal(report.ok, false);
    assert.ok(rules(report).includes('shape-unparsed'), JSON.stringify(rules(report)));
});

test('canary: table — a table that is not stamped at the pin', () => {
    const file = mutate(TABLE, (doc) => { doc.pinnedCommit = '0'.repeat(40); });
    const report = check(['--table', file, '--fixtures-dir', path.join(CANARIES, 'no-fixtures'),
        '--ledger', path.join(CANARIES, 'canary-ledger.json')]);
    assert.equal(report.ok, false);
    assert.deepEqual(rules(report), ['table'], JSON.stringify(rules(report)));
});

test('canary: refusal-not-wired — the ledger refuses a frame the live mock serves', () => {
    const file = mutate(LEDGER, (doc) => {
        doc.findings.push({
            fixture: 'api__v1__devices.json', path: '/api/v1/devices', rules: [],
            disposition: 'refuse', handlerSymbol: 'DevicesHandler._deviceList',
            handlerFile: 'lib/src/services/webserver/devices_handler.dart',
            checkedCommit: doc.pinnedCommit, evidence: 'canary',
        });
    });
    const report = check(['--ledger', file]);
    assert.equal(report.ok, false);
    assert.ok(rules(report).includes('refusal-not-wired'), JSON.stringify(rules(report)));
});

test('canary: envelope — a recorded 404 page claimed to be a 200 JSON body', () => {
    const file = mutate(LEDGER, (doc) => {
        doc.nonJson[0].serveAs = { status: 200, contentType: 'application/json' };
    });
    const report = check(['--ledger', file]);
    assert.equal(report.ok, false);
    assert.ok(rules(report).includes('envelope'), JSON.stringify(rules(report)));
});

test('canary: write-frame — the mock\'s synthesized write reply against a moved row', () => {
    const file = mutate(TABLE, (doc) => {
        for (const row of doc.rest) {
            if (row.id === 'postStoreByNamespaceByKey') row.responseShape = "200 {ok:'yes'}";
        }
    });
    const report = check(['--table', file, '--fixtures-dir', path.join(CANARIES, 'no-fixtures'),
        '--ledger', path.join(CANARIES, 'canary-ledger.json')]);
    assert.equal(report.ok, false);
    assert.deepEqual(rules(report), ['write-frame'], JSON.stringify(report.findings));
});

// --------------------------------------------------------------------------- //
// The three deleted fallbacks stay deleted (A7)
// --------------------------------------------------------------------------- //

test('mutating verbs are answered from the table, never a canned success', () => {
    const out = execFileSync('python3', ['-c', `
import sys, json; sys.path.insert(0, 'tools')
import mock_rea
print(json.dumps({f"{v} {p}": [mock_rea.write_response(p, v)[0],
                               mock_rea.write_response(p, v)[1].decode()]
                  for v, p in [("POST", "/api/v1/machine/settings"),
                               ("PUT", "/api/v1/machine/cupWarmer"),
                               ("POST", "/api/v1/store/decal/k"),
                               ("PUT", "/api/v1/devices/disconnect"),
                               ("POST", "/api/v1/profiles"),
                               ("PUT", "/api/v1/nonesuch")]}))
`], { cwd: REPO, encoding: 'utf8' });
    const replies = JSON.parse(out);
    for (const [route, [, body]] of Object.entries(replies)) {
        assert.ok(!body.includes('"success"'),
            `${route} still answers with the canned success shape ReaPrime sends on no route`);
    }
    // Quoting the handler, where the row states the whole body …
    assert.deepEqual(replies['POST /api/v1/machine/settings'], [202, '']);
    assert.deepEqual(replies['PUT /api/v1/machine/cupWarmer'], [200, '{"status": "accepted"}']);
    assert.deepEqual(replies['POST /api/v1/store/decal/k'], [200, '{}']);
    assert.deepEqual(replies['PUT /api/v1/devices/disconnect'], [200, 'null']);
    // … and refusing where it does not, rather than inventing a ProfileRecord.
    assert.equal(replies['POST /api/v1/profiles'][0], 501);
    assert.equal(replies['PUT /api/v1/nonesuch'][0], 501);
});

test('the mock has exactly one contract table and no candidate chain', () => {
    const source = readFileSync(path.join(REPO, 'tools/mock_rea.py'), 'utf8');
    assert.ok(!/contract_table_path/.test(source),
        'the three-deep candidate chain is back: an instrument that falls back to another '
        + 'table passes against whichever reference still exists');
    for (const gone of ['tools/mock-contract.json', 'tools/derive_mock_contract.py']) {
        assert.ok(!existsSync(path.join(REPO, gone)),
            `${gone} is the provisional fixture-derived table Gate D's supersedes; it is a `
            + 'second reference and was deleted with the chain');
    }
    const checker = readFileSync(path.join(REPO, CHECKER), 'utf8');
    assert.ok(/CONTRACTS\.json/.test(checker), 'the checker no longer names the Gate D table');
});

test('a missing recording reads as absent, not as an empty machine', () => {
    const out = execFileSync('python3', ['-c', `
import sys, json, urllib.request; sys.path.insert(0, 'tools')
import mock_rea
httpd = mock_rea.start(port=0)
port = httpd.server_address[1]
try:
    req = urllib.request.Request(f"http://127.0.0.1:{port}/api/v1/there/is/no/such/route")
    try:
        r = urllib.request.urlopen(req, timeout=5); print(json.dumps([r.status, r.read().decode()]))
    except urllib.error.HTTPError as e:
        print(json.dumps([e.code, e.read().decode()]))
finally:
    httpd.shutdown(); httpd.server_close()
`], { cwd: REPO, encoding: 'utf8' });
    const [status, body] = JSON.parse(out);
    assert.equal(status, 503, 'a miss must not answer 200 {} — an empty object renders as '
        + '"the machine has nothing" rather than "this instrument has no recording"');
    assert.ok(!/^\{\}$/.test(body.trim()));
    assert.match(body, /no recorded response/);
    // 404 is ReaPrime's feature-absent signal (_bengleFirmwareGate). An instrument that
    // manufactures it teaches a capability store that a feature is missing.
    assert.notEqual(status, 404);
});

test('a query with no recording reads as absent, not as a different page', () => {
    // `_resolve` used to fall back from an exact miss to any recording of the same
    // endpoint, so this exact request came back 200 with 21 items, limit 20, offset 0:
    // four times the rows asked for, at the wrong offset, echoing a page size nobody
    // requested. The recorded query is asked alongside it, because a mock that answers
    // 503 to everything would pass the first half and photograph nothing.
    const out = execFileSync('python3', ['-c', `
import sys, json, urllib.request, urllib.error; sys.path.insert(0, 'tools')
import mock_rea
httpd = mock_rea.start(port=0)
port = httpd.server_address[1]
def get(path):
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}{path}", timeout=5) as r:
            return [r.status, r.read().decode()]
    except urllib.error.HTTPError as e:
        return [e.code, e.read().decode()]
try:
    print(json.dumps({p: get(p) for p in ["/api/v1/shots?limit=5&offset=0&order=desc",
                                          "/api/v1/shots?limit=100&offset=40",
                                          "/api/v1/shots",
                                          "/api/v1/shots?limit=20&offset=0&order=desc"]}))
finally:
    httpd.shutdown(); httpd.server_close()
`], { cwd: REPO, encoding: 'utf8' });
    const replies = JSON.parse(out);
    for (const path of ['/api/v1/shots?limit=5&offset=0&order=desc',
        '/api/v1/shots?limit=100&offset=40', '/api/v1/shots']) {
        const [status, body] = replies[path];
        assert.equal(status, 503,
            `${path} answered ${status}; no fixture is named for it, so a 200 is the one `
            + 'recorded page wearing another request\'s query');
        assert.match(body, /no recorded response/);
    }
    const [status, body] = replies['/api/v1/shots?limit=20&offset=0&order=desc'];
    assert.equal(status, 200, 'the recorded query must still be served');
    const page = JSON.parse(body);
    assert.equal(page.items.length, 20);
    assert.equal(page.limit, 20);
});

test('canary: query-fallback — the rule bites when the fallback is put back', () => {
    // The canary restores the deleted code in-process and asks the checker's own rule
    // about it. Without this the rule could be scanning nothing and every run would
    // still be green — "a guard with no canary is a guard nobody has seen bite".
    const out = execFileSync('python3', ['-c', `
import sys, json; sys.path.insert(0, 'tools')
import mock_rea, check_mock_contract

clean = check_mock_contract.check_query_isolation()

exact = mock_rea._resolve
def with_fallback(path, fixtures_dir=None):          # the deleted endpoint fallback
    hit = exact(path, fixtures_dir=fixtures_dir)
    if hit is not None:
        return hit
    root = fixtures_dir or mock_rea.FIXTURES
    endpoint = path.strip("/").split("?")[0].replace("/", "__")
    candidates = sorted(root.glob(f"{endpoint}~*.json"))
    return candidates[0] if candidates else None
mock_rea._resolve = with_fallback
try:
    canary = check_mock_contract.check_query_isolation()
finally:
    mock_rea._resolve = exact
print(json.dumps({"clean": clean, "canary": canary}))
`], { cwd: REPO, encoding: 'utf8' });
    const { clean, canary } = JSON.parse(out);
    assert.deepEqual(clean, [], `the live mock resolves inexactly: ${JSON.stringify(clean)}`);
    assert.ok(canary.length > 0, 'the fallback was restored and query-fallback stayed silent');
    assert.deepEqual([...new Set(canary.map((f) => f.rule))], ['query-fallback']);
    assert.ok(canary.every((f) => f.blocking), 'query-fallback must fail the build, not note it');
    assert.ok(canary.some((f) => f.subject === 'api__v1__shots~limit=20~offset=0~order=desc.json'),
        `the shots list is the recording that used to answer every query: ${JSON.stringify(canary)}`);
});
