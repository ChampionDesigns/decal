
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { generate, write, check, readTable } from '../scripts/build-i18n.js';

function fixture({ table, overlays = {} }) {
  const root = mkdtempSync(join(tmpdir(), 'decal-i18n-'));
  const sourceDir = join(root, 'i18n', 'source');
  const outDir = join(root, 'i18n');
  mkdirSync(sourceDir, { recursive: true });
  writeFileSync(join(sourceDir, 'strings.json'),
    typeof table === 'string' ? table : JSON.stringify(table, null, 2) + '\n');
  for (const [language, map] of Object.entries(overlays)) {
    writeFileSync(join(sourceDir, `${language}.json`),
      typeof map === 'string' ? map : JSON.stringify(map, null, 2) + '\n');
  }
  test.after(() => rmSync(root, { recursive: true, force: true }));
  return { root, sourceDir, outDir };
}

const simpleTable = {
  sourceLanguage: 'en',
  strings: [
    { key: 'Save' },
    { key: 'Steam' },
    { key: 'Step {n} of {total}', note: 'editor' },
  ],
};

const parse = (files, name) => JSON.parse(files.find((f) => f.name === name).text);

test('round trip: the generated source-language file is exactly the authored key set', () => {
  const { sourceDir } = fixture({ table: simpleTable });
  const { files, report } = generate({ sourceDir });
  assert.deepEqual(files.map((f) => f.name), ['en.json']);
  const en = parse(files, 'en.json');
  assert.equal(en.language, 'en');
  assert.deepEqual(Object.keys(en.strings), ['Save', 'Steam', 'Step {n} of {total}']);
  for (const [key, value] of Object.entries(en.strings)) assert.equal(value, key);
  assert.equal(report.keys, 3);
  assert.deepEqual(report.coverage, [{ language: 'en', translated: 3, missing: 0 }]);
});

test('the generated envelope names its generator, its inputs and their hash', () => {
  const { sourceDir } = fixture({ table: simpleTable });
  const en = parse(generate({ sourceDir }).files, 'en.json');
  assert.equal(en.generatedBy, 'scripts/build-i18n.js');
  assert.deepEqual(en.generatedFrom, ['i18n/source/strings.json']);
  assert.match(en.sourceSha256, /^[0-9a-f]{64}$/);
});

test('a missing translation is ABSENT from the language file, never filled with English', () => {
  const { sourceDir } = fixture({
    table: simpleTable,
    overlays: { de: { Save: 'Speichern' } },
  });
  const { files, report } = generate({ sourceDir });
  const de = parse(files, 'de.json');
  assert.deepEqual(Object.keys(de.strings), ['Save']);
  assert.equal(de.strings.Steam, undefined, 'the runtime falls back to the key, the build does not guess');
  assert.deepEqual(report.coverage.find((c) => c.language === 'de'), {
    language: 'de', translated: 1, missing: 2,
  });
});

test('an empty or whitespace translation counts as missing', () => {
  const { sourceDir } = fixture({
    table: simpleTable,
    overlays: { de: { Save: '', Steam: '   ' } },
  });
  const { files, report } = generate({ sourceDir });
  assert.deepEqual(Object.keys(parse(files, 'de.json').strings), []);
  assert.equal(report.coverage.find((c) => c.language === 'de').missing, 3);
});

test('translations keep source order, so the file diffs like the table', () => {
  const { sourceDir } = fixture({
    table: simpleTable,
    overlays: { de: { Steam: 'Dampf', Save: 'Speichern' } },
  });
  const de = parse(generate({ sourceDir }).files, 'de.json');
  assert.deepEqual(Object.keys(de.strings), ['Save', 'Steam']);
});

test('CANARY — a translation for a key that no longer exists fails the build', () => {
  const { sourceDir } = fixture({
    table: simpleTable,
    overlays: { de: { Save: 'Speichern', 'Deleted key': 'Weg' } },
  });
  assert.throws(() => generate({ sourceDir }), /Deleted key.*not in strings\.json/s);
});

test('CANARY — a duplicate key fails the build', () => {
  const { sourceDir } = fixture({
    table: { sourceLanguage: 'en', strings: [{ key: 'Save' }, { key: 'Save' }] },
  });
  assert.throws(() => generate({ sourceDir }), /duplicate key "Save"/);
});

test('CANARY — two keys differing only in case fail the build', () => {
  // Runtime lookup is case-insensitive, so one would silently shadow the other.
  const { sourceDir } = fixture({
    table: { sourceLanguage: 'en', strings: [{ key: 'Off' }, { key: 'OFF' }] },
  });
  assert.throws(() => generate({ sourceDir }), /differ only in case/);
});

test('CANARY — a translation that loses or invents a placeholder fails the build', () => {
  const lost = fixture({
    table: simpleTable,
    overlays: { de: { 'Step {n} of {total}': 'Schritt {n}' } },
  });
  assert.throws(() => generate({ sourceDir: lost.sourceDir }), /expects placeholders/);

  const invented = fixture({
    table: simpleTable,
    overlays: { fr: { Save: 'Enregistrer {value}' } },
  });
  assert.throws(() => generate({ sourceDir: invented.sourceDir }), /expects placeholders/);
});

test('CANARY — the source language may not be authored as an overlay', () => {
  const { sourceDir } = fixture({ table: simpleTable, overlays: { en: { Save: 'Save!' } } });
  assert.throws(() => generate({ sourceDir }), /source language is authored in strings\.json/);
});

test('a malformed table fails with every problem listed, not just the first', () => {
  const { sourceDir } = fixture({
    table: { sourceLanguage: 'en', strings: [{ key: '' }, { note: 'x' }, 'Save'] },
  });
  try {
    generate({ sourceDir });
    assert.fail('expected a BuildError');
  } catch (error) {
    assert.equal(error.problems.length, 3);
  }
});

test('invalid JSON in the table is reported as such', () => {
  const { sourceDir } = fixture({ table: '{ "sourceLanguage": "en", ' });
  assert.throws(() => generate({ sourceDir }), /strings\.json is not valid JSON/);
});

test('readTable keeps authored notes and rejects non-string ones', () => {
  const ok = fixture({ table: simpleTable });
  assert.equal(readTable(ok.sourceDir).entries[2].note, 'editor');
  const bad = fixture({
    table: { sourceLanguage: 'en', strings: [{ key: 'Save', note: 7 }] },
  });
  assert.throws(() => readTable(bad.sourceDir), /non-string "note"/);
});

test('generation is deterministic: same source, byte-identical output', () => {
  const { sourceDir } = fixture({ table: simpleTable, overlays: { de: { Save: 'Speichern' } } });
  const first = generate({ sourceDir }).files.map((f) => f.text);
  const second = generate({ sourceDir }).files.map((f) => f.text);
  assert.deepEqual(first, second);
});

test('write() writes once and reports nothing changed on a second run', () => {
  const { sourceDir, outDir } = fixture({ table: simpleTable });
  assert.deepEqual(write({ sourceDir, outDir }).changed, ['en.json']);
  assert.deepEqual(write({ sourceDir, outDir }).changed, []);
  assert.equal(JSON.parse(readFileSync(join(outDir, 'en.json'), 'utf8')).strings.Save, 'Save');
});

test('check() is clean after a write, stale after a source edit', () => {
  const { sourceDir, outDir } = fixture({ table: simpleTable });
  write({ sourceDir, outDir });
  assert.equal(check({ sourceDir, outDir }).ok, true);

  writeFileSync(join(sourceDir, 'strings.json'), JSON.stringify({
    sourceLanguage: 'en', strings: [...simpleTable.strings, { key: 'Flush' }],
  }, null, 2) + '\n');
  const stale = check({ sourceDir, outDir });
  assert.equal(stale.ok, false);
  assert.deepEqual(stale.stale, ['en.json']);
});

test('check() reports a language file that was never generated', () => {
  const { sourceDir, outDir } = fixture({ table: simpleTable });
  const result = check({ sourceDir, outDir });
  assert.deepEqual(result.missing, ['en.json']);
  assert.equal(result.ok, false);
});

test('CANARY — a hand-written language file with no source is an orphan', () => {
  const { sourceDir, outDir } = fixture({ table: simpleTable });
  write({ sourceDir, outDir });
  writeFileSync(join(outDir, 'fr.json'), '{"language":"fr","strings":{}}\n');
  const result = check({ sourceDir, outDir });
  assert.deepEqual(result.orphan, ['fr.json']);
  assert.equal(result.ok, false);
});
