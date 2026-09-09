
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parseYaml, splitKey, scalarText, stripComment, YamlSubsetError } from '../scripts/lib/yaml-subset.js';
import { REA_ROOT } from '../scripts/lib/rea-source.js';
import { REST_REL, WS_REL } from '../scripts/generate-rea-routes.js';

const parse = (text) => parseYaml(text, { file: 'test.yml' });

describe('scalars', () => {
    test('plain scalars resolve by type', () => {
        assert.equal(scalarText('20'), 20);
        assert.equal(scalarText('-3'), -3);
        assert.equal(scalarText('1.5'), 1.5);
        assert.equal(scalarText('true'), true);
        assert.equal(scalarText('false'), false);
        assert.equal(scalarText('null'), null);
        assert.equal(scalarText('~'), null);
        assert.equal(scalarText(''), null);
        assert.equal(scalarText('timestamp'), 'timestamp');
    });

    test('a version-like token stays a string', () => {
        assert.equal(scalarText('3.0.3'), '3.0.3');
        assert.equal(scalarText('1.0.0'), '1.0.0');
    });

    test('OFF is a string, not a boolean — YAML 1.2, and it is a log level', () => {
        assert.equal(scalarText('OFF'), 'OFF');
        assert.equal(scalarText('on'), 'on');
        assert.equal(scalarText('no'), 'no');
    });

    test('quotes are removed and escapes applied', () => {
        assert.equal(scalarText('"200"'), '200');
        assert.equal(scalarText("'{tablet-ip}:8080'"), '{tablet-ip}:8080');
        assert.equal(scalarText('"a\\nb"'), 'a\nb');
        assert.equal(scalarText("'it''s'"), "it's");
    });
});

describe('comments', () => {
    test('a trailing comment is stripped', () => {
        assert.equal(stripComment('type: string # a comment'), 'type: string');
    });

    test('a # inside quotes survives — every $ref depends on it', () => {
        assert.equal(stripComment('$ref: "#/components/schemas/Error"'), '$ref: "#/components/schemas/Error"');
        assert.equal(stripComment("$ref: '#/channels/Devices'"), "$ref: '#/channels/Devices'");
    });

    test('a full-line comment parses away entirely', () => {
        assert.deepEqual(parse('# Machine specific API\na: 1\n'), { a: 1 });
    });
});

describe('mappings and sequences', () => {
    test('nested block mappings', () => {
        assert.deepEqual(parse('a:\n  b:\n    c: 1\n'), { a: { b: { c: 1 } } });
    });

    test('a sequence of mappings, first key on the dash line', () => {
        assert.deepEqual(
            parse('parameters:\n  - in: query\n    name: limit\n  - in: path\n    name: id\n'),
            { parameters: [{ in: 'query', name: 'limit' }, { in: 'path', name: 'id' }] },
        );
    });

    test('a quoted key keeps its text', () => {
        assert.deepEqual(parse('responses:\n  "200":\n    description: ok\n'), { responses: { 200: { description: 'ok' } } });
    });

    test('a key with an empty value is null, not an empty object', () => {
        assert.deepEqual(parse('a:\nb: 1\n'), { a: null, b: 1 });
    });

    test('splitKey ignores colons inside quotes and inside flow collections', () => {
        assert.deepEqual(splitKey('name: "Legacy: filter by ids"'), { key: 'name', rest: '"Legacy: filter by ids"' });
        assert.deepEqual(splitKey('enum: [a, b]'), { key: 'enum', rest: '[a, b]' });
        assert.equal(splitKey('just a scalar'), null);
    });

    test('a duplicate key is an error, never a silent last-wins', () => {
        assert.throws(() => parse('a: 1\na: 2\n'), YamlSubsetError);
    });
});

describe('flow collections', () => {
    test('inline sequences', () => {
        assert.deepEqual(parse('tags: [Devices]\n'), { tags: ['Devices'] });
        assert.deepEqual(parse('enum: [asc, desc]\n'), { enum: ['asc', 'desc'] });
    });

    test('an empty flow mapping', () => {
        assert.deepEqual(parse('example: {}\n'), { example: {} });
    });

    test('a flow sequence opening on its own line and spanning many', () => {
        assert.deepEqual(
            parse('enum:\n  [\n    booting,\n    busy,\n    idle,\n  ]\n'),
            { enum: ['booting', 'busy', 'idle'] },
        );
    });
});

describe('block scalars', () => {
    test('literal keeps its line breaks', () => {
        assert.equal(parse('d: |\n  one\n  two\n').d, 'one\ntwo\n');
    });

    test('folded joins lines with spaces and keeps blank lines as breaks', () => {
        assert.equal(parse('d: >\n  one\n  two\n\n  three\n').d, 'one two\nthree\n');
    });

    test('the - indicator strips the trailing newline', () => {
        assert.equal(parse('d: >-\n  one\n  two\n').d, 'one two');
    });

    test('a block scalar ends at the first line indented no further than its key', () => {
        assert.deepEqual(parse('a: |\n  text\nb: 1\n'), { a: 'text\n', b: 1 });
    });
});

describe('refusals — the subset says no rather than guessing', () => {
    const refused = [
        ['anchors', 'base: &defaults\n  a: 1\n'],
        ['multi-document streams', 'a: 1\n---\nb: 2\n'],
        ['merge keys', 'a:\n  <<: *defaults\n'],
        ['explicit keys', '? a\n: 1\n'],
        ['tab indentation', 'a:\n\tb: 1\n'],
    ];
    for (const [name, text] of refused) {
        test(name, () => { assert.throws(() => parse(text)); });
    }

    test('an unterminated flow collection is an error', () => {
        assert.throws(() => parse('a: [1, 2\n'), YamlSubsetError);
    });

    test('errors name the file and the line', () => {
        try {
            parse('a: 1\n---\nb: 2\n');
            assert.fail('expected a throw');
        } catch (e) {
            assert.match(e.message, /test\.yml:2:/);
        }
    });
});

describe('the two real specs', () => {
    const rest = parseYaml(readFileSync(join(REA_ROOT, REST_REL), 'utf8'), { file: REST_REL });
    const ws = parseYaml(readFileSync(join(REA_ROOT, WS_REL), 'utf8'), { file: WS_REL });

    test('rest_v1.yml parses to the expected shape', () => {
        assert.equal(rest.openapi, '3.0.3');
        // 101 -> 112 and 82 -> 97 at the 42f67f69 re-pin: purely additive, nothing removed.
        // New paths: machine/ledStrip/preview(+/clear), machine/stopAtWeight,
        // machine/calibration/{target}, bean-batches, plugins/{id}/source,
        // plugins/install/github-release, .../github-branch, plugins/update,
        // plugins/{id}/update/approve, diagnostics/ble.
        assert.equal(Object.keys(rest.paths).length, 112);
        assert.equal(Object.keys(rest.components.schemas).length, 97);
    });

    test('websocket_v1.yml parses to the expected shape', () => {
        assert.equal(ws.asyncapi, '3.0.0');
        assert.equal(Object.keys(ws.channels).length, 13);
        assert.equal(Object.keys(ws.operations).length, 17);
    });

    test('a deep value survives the walk intact', () => {
        const limit = rest.paths['/api/v1/shots'].get.parameters.find((p) => p.name === 'limit');
        assert.deepEqual(limit.schema, { type: 'integer', default: 20, minimum: 1, maximum: 100 });
    });

    test('the long multi-line flow enum is read whole', () => {
        const states = rest.components.schemas.MachineState.enum;
        assert.ok(Array.isArray(states));
        assert.equal(states.length, 20);
        assert.equal(states[0], 'booting');
        assert.equal(states[states.length - 1], 'fwUpgrade');
        assert.ok(states.every((s) => typeof s === 'string'));
    });

    test('the log-level enum keeps OFF as a string', () => {
        assert.ok(rest.components.schemas.ReaSettings.properties.logLevel.enum.includes('OFF'));
    });
});
