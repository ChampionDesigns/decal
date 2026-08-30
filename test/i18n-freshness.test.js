
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { check, readTable, REPO_ROOT } from '../scripts/build-i18n.js';
import { Translations } from '../src/lib/i18n.js';

test('the committed i18n/ files are exactly what the generator produces', () => {
  const result = check();
  assert.deepEqual(result.stale, [], 'run: node scripts/build-i18n.js');
  assert.deepEqual(result.missing, [], 'run: node scripts/build-i18n.js');
  assert.deepEqual(result.orphan, [], 'a language file in i18n/ with no source in i18n/source/');
  assert.equal(result.ok, true);
});

test('the CLI freshness check exits 0 on a clean tree', () => {
  const out = execFileSync(process.execPath, ['scripts/build-i18n.js', '--check'],
    { cwd: REPO_ROOT, encoding: 'utf8' });
  assert.match(out, /i18n\/ is fresh/);
});

test('v1 ships English only (D2) and the table is not empty', () => {
  const result = check();
  assert.deepEqual(result.coverage.map((c) => c.language), ['en']);
  assert.ok(result.keys > 0, 'the authored string table has entries');
});

test('the committed en.json drives the runtime store end to end', () => {
  const payload = JSON.parse(readFileSync(join(REPO_ROOT, 'i18n', 'en.json'), 'utf8'));
  const { entries } = readTable();
  const keys = entries.map((e) => e.key);

  assert.equal(payload.language, 'en');
  assert.deepEqual(
    Object.keys(payload.strings).sort(), [...keys].sort(),
    'the committed file\'s key set is the authored table\'s — the link the runtime depends on',
  );

  const mark = (key) => `«${key}»`;
  const loaded = new Translations();
  loaded.set(payload.language, Object.fromEntries(Object.keys(payload.strings).map((k) => [k, mark(k)])));
  assert.deepEqual(
    keys.filter((key) => loaded.t(key) !== mark(key)), [],
    'every authored key must resolve through the committed file, not through the fallback',
  );

  const empty = new Translations();
  assert.deepEqual(
    keys.filter((key) => empty.t(key) !== key), [],
    'an empty store answers with the key — which is why the marked store above is the real test',
  );
  assert.notEqual(loaded.t(keys[0]), empty.t(keys[0]));

  const store = new Translations();
  store.set(payload.language, payload.strings);
  assert.equal(store.language, payload.language);
  assert.deepEqual(keys.filter((key) => store.t(key) !== payload.strings[key]), []);

  const withPlaceholder = entries.find((e) => /\{\w+\}/.test(e.key));
  if (withPlaceholder) {
    const filled = loaded.t(withPlaceholder.key, { value: 1, n: 1, total: 2 });
    assert.equal(filled.slice(0, 1), '«', `the table's value must be what gets filled: "${filled}"`);
    assert.ok(!/\{(value|n|total)\}/.test(filled), `placeholders unfilled in "${filled}"`);
  }
});
