// The staleness gate for src/data/rea-routes.generated.js.
//
// SCOPE Part 2 §7: every committed generated file has its generator in scripts/ and a test
// that regenerates it and fails on a diff. The artifact is committed so a contributor can
// clone and open index.html with no toolchain; this test is what stops "committed" from
// decaying into "hand-edited".
//
// Byte equality alone would pass if the generator and the artifact were wrong together, so
// the checks below also re-derive the headline facts from the yml text independently of
// the parser, and pin the provenance stamp to the bytes it claims to describe.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
    check,
    render,
    extractRest,
    extractSockets,
    applyExceptions,
    deriveId,
    toClientRoute,
    literal,
    SPEC_EXCEPTIONS,
    REST_REL,
    WS_REL,
    REPO_ROOT,
    OUT_FILE,
    GenerateRoutesError,
} from '../scripts/generate-rea-routes.js';
import { REA_ROOT, PINNED_COMMIT, resolveReaCommit } from '../scripts/lib/rea-source.js';
import { parseYaml } from '../scripts/lib/yaml-subset.js';
import { PINNED_COMMIT as MACHINE_STATE_PIN } from '../scripts/generate-machine-state.js';
import {
    REST_ROUTES,
    SOCKET_CHANNELS,
    REA_ROUTE_EXCEPTIONS,
    REA_ROUTES_SOURCE,
} from '../src/data/rea-routes.generated.js';

const restText = readFileSync(join(REA_ROOT, REST_REL), 'utf8');
const wsText = readFileSync(join(REA_ROOT, WS_REL), 'utf8');

describe('the committed artifact is what the generator produces', () => {
    test('regenerating produces no diff', () => {
        const result = check();
        if (result.stale) {
            assert.fail('src/data/rea-routes.generated.js is stale — run: node scripts/generate-rea-routes.js');
        }
        assert.equal(result.ok, true);
    });

    test('the CLI check exits 0 on a fresh tree', () => {
        const out = execFileSync(process.execPath, ['scripts/generate-rea-routes.js', '--check'],
            { cwd: REPO_ROOT, encoding: 'utf8' });
        assert.match(out, /is fresh/);
    });

    test('generation is deterministic — same bytes in, same bytes out', () => {
        assert.equal(render(), render());
    });

    test('the artifact says it is generated, loudly', () => {
        const artifact = readFileSync(OUT_FILE, 'utf8');
        assert.match(artifact.split('\n')[0], /GENERATED FILE — DO NOT EDIT/);
        assert.match(artifact, /scripts\/generate-rea-routes\.js/);
    });
});

describe('provenance', () => {
    test('one pin, not two — the two generators agree on the commit', () => {
        assert.equal(PINNED_COMMIT, MACHINE_STATE_PIN);
    });

    test('the reference worktree is at the pinned commit', () => {
        assert.equal(resolveReaCommit(), PINNED_COMMIT);
        assert.equal(REA_ROUTES_SOURCE.commit, PINNED_COMMIT);
    });

    test('the stamped hashes are the hashes of the files that were read', async () => {
        const { createHash } = await import('node:crypto');
        const sha = (text) => createHash('sha256').update(text).digest('hex');
        assert.equal(REA_ROUTES_SOURCE.rest.sha256, sha(restText));
        assert.equal(REA_ROUTES_SOURCE.websocket.sha256, sha(wsText));
        assert.equal(REA_ROUTES_SOURCE.rest.file, REST_REL);
        assert.equal(REA_ROUTES_SOURCE.websocket.file, WS_REL);
    });

    test('the stamped counts describe the emitted tables', () => {
        assert.equal(REA_ROUTES_SOURCE.counts.routes, REST_ROUTES.length);
        assert.equal(REA_ROUTES_SOURCE.counts.channels, SOCKET_CHANNELS.length);
        assert.equal(REA_ROUTES_SOURCE.counts.exceptions, REA_ROUTE_EXCEPTIONS.length);
        assert.equal(REA_ROUTES_SOURCE.counts.conditional, REST_ROUTES.filter((r) => r.conditional).length);
    });
});

describe('the table covers the documented surface, counted from the yml text', () => {
    // Independent of the parser: count the path keys and the verb keys by indentation.
    const pathLines = restText.split('\n').filter((l) => /^ {2}\/api\/v1[^\s:]*:\s*$/.test(l));
    const verbLines = restText.split('\n').filter((l) => /^ {4}(get|put|post|delete|patch|head|options):\s*$/.test(l));
    const channelLines = wsText.split('\n').filter((l) => /^ {4}address: /.test(l));

    test('every documented path appears in the table', () => {
        const inTable = new Set(REST_ROUTES.map((r) => r.path));
        const documented = pathLines.map((l) => l.trim().slice(0, -1));
        assert.equal(documented.length, REA_ROUTES_SOURCE.counts.paths);
        for (const path of documented) assert.ok(inTable.has(path), `${path} is documented but not in the table`);
    });

    test('the operation count is the documented verb count plus the added exception rows', () => {
        const added = REA_ROUTE_EXCEPTIONS
            .filter((e) => e.effect.startsWith('added '))
            .reduce((n, e) => n + e.routes.length - 1, 0);
        assert.equal(REST_ROUTES.length, verbLines.length + added);
    });

    test('every documented channel address appears in the table', () => {
        const addresses = channelLines.map((l) => `/${l.trim().slice('address: '.length)}`);
        assert.equal(addresses.length, SOCKET_CHANNELS.length);
        const inTable = new Set(SOCKET_CHANNELS.map((c) => c.address));
        for (const address of addresses) assert.ok(inTable.has(address), `${address} is documented but not in the table`);
    });

    test('ids and method+route keys are unique', () => {
        assert.equal(new Set(REST_ROUTES.map((r) => r.id)).size, REST_ROUTES.length);
        assert.equal(new Set(REST_ROUTES.map((r) => `${r.method} ${r.route}`)).size, REST_ROUTES.length);
        assert.equal(new Set(SOCKET_CHANNELS.map((c) => c.route)).size, SOCKET_CHANNELS.length);
    });

    test('every row is fully addressed: a method, both path spellings, and a spec line', () => {
        for (const r of REST_ROUTES) {
            assert.match(r.method, /^(GET|PUT|POST|DELETE|PATCH|HEAD|OPTIONS)$/);
            assert.ok(r.path.startsWith('/api/v1/'), r.id);
            assert.equal(r.route, toClientRoute(r.path));
            assert.ok(Number.isInteger(r.specLine) && r.specLine > 0, `${r.id} has no spec line`);
            assert.equal(r.pathParams.length, (r.route.match(/</g) || []).length, `${r.id} path params`);
        }
    });

    test('the whole table is deeply frozen', () => {
        assert.ok(Object.isFrozen(REST_ROUTES));
        assert.ok(Object.isFrozen(REST_ROUTES[0]));
        assert.ok(Object.isFrozen(REST_ROUTES.find((r) => r.query.length > 0).query[0]));
        assert.ok(Object.isFrozen(SOCKET_CHANNELS[0].receives));
    });
});

describe('the generator refuses rather than guesses', () => {
    const restSpec = parseYaml(restText, { file: REST_REL });

    test('a path outside /api/v1 is a hard failure', () => {
        assert.throws(() => toClientRoute('/ws/v1/machine/snapshot'), GenerateRoutesError);
    });

    test('an unknown path-item key is a hard failure', () => {
        const spec = { paths: { '/api/v1/x': { summary: 'not a verb' } } };
        assert.throws(() => extractRest(spec, ''), /unexpected path-item key/);
    });

    test('a header or cookie parameter is a hard failure', () => {
        const spec = {
            paths: { '/api/v1/x': { get: { parameters: [{ in: 'header', name: 'X' }], responses: {} } } },
        };
        assert.throws(() => extractRest(spec, ''), /unsupported parameter location/);
    });

    test('an undeclared path template parameter is a hard failure', () => {
        const spec = { paths: { '/api/v1/x/{id}': { get: { parameters: [], responses: {} } } } };
        assert.throws(() => extractRest(spec, ''), /is not declared/);
    });

    test('a $ref query parameter is refused, not silently flattened', () => {
        const spec = {
            paths: {
                '/api/v1/x': {
                    get: {
                        parameters: [{ in: 'query', name: 'state', schema: { $ref: '#/components/schemas/MachineState' } }],
                        responses: {},
                    },
                },
            },
        };
        assert.throws(() => extractRest(spec, ''), /resolve it deliberately/);
    });

    test('a socket channel with no address is a hard failure', () => {
        assert.throws(() => extractSockets({ channels: { X: {} } }, ''), /has no address/);
    });

    test('an exception that is no longer needed fails the build with the remedy', () => {
        // Simulate the upstream fix landing: drop `orderBy` from the parsed spec and the
        // generator must refuse to run rather than carry a workaround nobody needs.
        const fixed = structuredClone(restSpec);
        fixed.paths['/api/v1/shots'].get.parameters =
            fixed.paths['/api/v1/shots'].get.parameters.filter((p) => p.name !== 'orderBy');
        assert.throws(
            () => applyExceptions(fixed, extractRest(fixed, restText)),
            /The upstream fix has landed: DELETE the shots-orderBy-not-read exception/,
        );
    });

    test('every exception carries the remedy for its own deletion', () => {
        for (const e of SPEC_EXCEPTIONS) {
            assert.match(e.goneMessage, /DELETE the .* exception/);
            assert.equal(typeof e.stillNeeded, 'function');
            assert.ok(e.handlerFile && e.handlerSymbol && e.handlerEvidence, e.id);
        }
    });
});

describe('the emitter', () => {
    test('derived ids are stable and readable', () => {
        assert.equal(deriveId('get', '/api/v1/shots'), 'getShots');
        assert.equal(deriveId('get', '/api/v1/shots/{id}'), 'getShotsById');
        assert.equal(deriveId('put', '/api/v1/machine/cupWarmer/preheat'), 'putMachineCupWarmerPreheat');
        assert.equal(deriveId('get', '/api/v1/bean-batches/{id}'), 'getBeanBatchesById');
    });

    test('a colliding id is a hard failure, never a silent overwrite', () => {
        const spec = { paths: { '/api/v1/a/b': { get: { responses: {} } }, '/api/v1/a-b': { get: { responses: {} } } } };
        assert.throws(() => extractRest(spec, ''), /collides/);
    });

    test('literals are valid, readable JS', () => {
        assert.equal(literal(['a', 'b']), '["a", "b"]');
        assert.equal(literal(null), 'null');
        assert.equal(literal({ a: 1, b: 'x' }), '{ a: 1, b: "x" }');
        assert.match(literal({ 'content-type': 1 }), /"content-type": 1/);
    });
});
