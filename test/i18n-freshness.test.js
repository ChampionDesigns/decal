// The staleness gate for the committed artifact (SCOPE Part 2 §7: "every committed
// generated file has its generator in scripts/ and a test that regenerates it and
// fails on a diff"). The cautionary tale is the old tree's app.css — a checked-in
// build artifact whose pipeline had quietly stopped running, so new work compiled to
// nothing. Here a stale i18n/en.json is a red test, not a silent lie.
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

// WHY THIS TEST IS SHAPED THE WAY IT IS (wave 0a review, finding lib-3). For the
// SOURCE language the key IS the text, so a store loaded from i18n/en.json answers
// t() identically to a store with nothing loaded at all — measured: 0 differences
// across all authored keys. The first version of this test asserted store.t(key) ===
// key and passed against `new Translations()`; deleting the store.set() would not
// have turned it red. That is precisely the recorded failure class this wave's
// canary rule exists for, so every assertion below is one an EMPTY store fails.
//
// The store's own behaviour (casing drift, key-as-fallback, placeholder filling) is
// i18n.test.js's job, where the table's values differ from its keys and the
// assertions can bite. What is left here is the artifact→runtime link: the committed
// file's key set, and the fact that the runtime resolves through it.
test('the committed en.json drives the runtime store end to end', () => {
  const payload = JSON.parse(readFileSync(join(REPO_ROOT, 'i18n', 'en.json'), 'utf8'));
  const { entries } = readTable();
  const keys = entries.map((e) => e.key);

  assert.equal(payload.language, 'en');
  assert.deepEqual(
    Object.keys(payload.strings).sort(), [...keys].sort(),
    'the committed file\'s key set is the authored table\'s — the link the runtime depends on',
  );

  // Marked values: an unloaded store returns the key, a loaded one returns the mark.
  // This is the assertion that fails if the payload never reaches the store.
  const mark = (key) => `«${key}»`;
  const loaded = new Translations();
  loaded.set(payload.language, Object.fromEntries(Object.keys(payload.strings).map((k) => [k, mark(k)])));
  assert.deepEqual(
    keys.filter((key) => loaded.t(key) !== mark(key)), [],
    'every authored key must resolve through the committed file, not through the fallback',
  );

  // The contrast, stated rather than assumed, so the check above can never quietly go
  // vacuous again: the same keys against a store with nothing in it.
  const empty = new Translations();
  assert.deepEqual(
    keys.filter((key) => empty.t(key) !== key), [],
    'an empty store answers with the key — which is why the marked store above is the real test',
  );
  assert.notEqual(loaded.t(keys[0]), empty.t(keys[0]));

  // The real payload, read as VALUES rather than assumed equal to the keys, so this
  // still means something the day a language other than the source one is generated.
  const store = new Translations();
  store.set(payload.language, payload.strings);
  assert.equal(store.language, payload.language);
  assert.deepEqual(keys.filter((key) => store.t(key) !== payload.strings[key]), []);

  // Interpolation runs on the TABLE's value, not on the key: mark one and watch the
  // mark come back filled.
  const withPlaceholder = entries.find((e) => /\{\w+\}/.test(e.key));
  if (withPlaceholder) {
    const filled = loaded.t(withPlaceholder.key, { value: 1, n: 1, total: 2 });
    assert.equal(filled.slice(0, 1), '«', `the table's value must be what gets filled: "${filled}"`);
    assert.ok(!/\{(value|n|total)\}/.test(filled), `placeholders unfilled in "${filled}"`);
  }
});
