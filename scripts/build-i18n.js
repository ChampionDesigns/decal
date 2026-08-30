#!/usr/bin/env node
// The i18n build (D2). Reads the authored table in i18n/source/ and writes one
// generated file per language into i18n/. No dependencies, no toolchain: node only.
//
// Why a build step at all: the old skin fetched a 1.5 MB CSV at every boot and
// parsed it in the browser (slate app/src/modules/i18n.js:16-76). Per-language JSON
// generated here removes the fetch, the parser and the 32 unused language columns
// from the runtime entirely.
//
// Generated files are COMMITTED so contributors need no toolchain — which
// reintroduces the app.css risk in miniature (a checked-in artifact whose generator
// silently stopped running). The rule from SCOPE Part 2 §7 closes it: every
// committed generated file has its generator here and a test that regenerates it
// and fails on a diff. `--check` is that test's engine.
//
//   node scripts/build-i18n.js            write i18n/<lang>.json
//   node scripts/build-i18n.js --check    exit 1 if any committed file is stale
//
// Validation is a guard, so it ships with canaries (test/i18n-generator.test.js):
// duplicate keys, keys differing only in case, translations for keys that no longer
// exist, and placeholder sets that disagree with the key are ALL build failures.
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const REPO_ROOT = fileURLToPath(new URL('../', import.meta.url));
export const DEFAULT_SOURCE_DIR = join(REPO_ROOT, 'i18n', 'source');
export const DEFAULT_OUT_DIR = join(REPO_ROOT, 'i18n');

const PLACEHOLDER = /\{(\w+)\}/g;

class BuildError extends Error {
  constructor(problems) {
    super(`i18n build failed:\n  - ${problems.join('\n  - ')}`);
    this.name = 'BuildError';
    this.problems = problems;
  }
}

const placeholders = (text) => new Set([...String(text).matchAll(PLACEHOLDER)].map((m) => m[1]));
const sameSet = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));

/** Parse and validate i18n/source/strings.json. Collects every problem, not the first. */
export function readTable(sourceDir = DEFAULT_SOURCE_DIR) {
  const path = join(sourceDir, 'strings.json');
  if (!existsSync(path)) throw new BuildError([`missing authored table: ${path}`]);
  let raw;
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new BuildError([`${basename(path)} is not valid JSON: ${error.message}`]);
  }

  const problems = [];
  if (typeof raw.sourceLanguage !== 'string' || !raw.sourceLanguage) {
    problems.push('strings.json needs a "sourceLanguage" (e.g. "en")');
  }
  if (!Array.isArray(raw.strings)) problems.push('strings.json needs a "strings" array');
  if (problems.length) throw new BuildError(problems);

  const entries = [];
  const seen = new Map();      // exact key -> index
  const seenLower = new Map(); // lowercased key -> first exact key
  raw.strings.forEach((entry, i) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      problems.push(`strings[${i}] is not an object like {"key": "..."}`);
      return;
    }
    const { key, note } = entry;
    if (typeof key !== 'string' || key === '') {
      problems.push(`strings[${i}] has no non-empty string "key"`);
      return;
    }
    if (note !== undefined && typeof note !== 'string') {
      problems.push(`strings[${i}] ("${key}") has a non-string "note"`);
    }
    if (seen.has(key)) {
      problems.push(`duplicate key "${key}" (strings[${seen.get(key)}] and strings[${i}])`);
      return;
    }
    // Lookup is case-insensitive at runtime (src/lib/i18n.js), so two keys differing
    // only in case cannot both be addressed — one would shadow the other silently.
    const lower = key.toLowerCase();
    if (seenLower.has(lower)) {
      problems.push(
        `keys "${seenLower.get(lower)}" and "${key}" differ only in case; ` +
        'lookup is case-insensitive, so keep one — English renders the caller\'s own casing');
      return;
    }
    seen.set(key, i);
    seenLower.set(lower, key);
    entries.push({ key, note });
  });
  if (problems.length) throw new BuildError(problems);
  return { sourceLanguage: raw.sourceLanguage, entries, path };
}

/** Every i18n/source/<lang>.json beside the table: a flat {key: translation} map. */
export function readOverlays(sourceDir = DEFAULT_SOURCE_DIR, sourceLanguage = 'en') {
  const names = readdirSync(sourceDir)
    .filter((n) => n.endsWith('.json') && n !== 'strings.json')
    .sort();
  const problems = [];
  const overlays = [];
  for (const name of names) {
    const language = name.slice(0, -'.json'.length);
    const path = join(sourceDir, name);
    if (language === sourceLanguage) {
      problems.push(`${name}: the source language is authored in strings.json, not here`);
      continue;
    }
    let raw;
    try {
      raw = JSON.parse(readFileSync(path, 'utf8'));
    } catch (error) {
      problems.push(`${name} is not valid JSON: ${error.message}`);
      continue;
    }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      problems.push(`${name} must be a flat {"<key>": "<translation>"} object`);
      continue;
    }
    overlays.push({ language, path, map: raw });
  }
  if (problems.length) throw new BuildError(problems);
  return overlays;
}

const sha256 = (parts) => {
  const hash = createHash('sha256');
  for (const [name, text] of parts) hash.update(name).update('\0').update(text).update('\0');
  return hash.digest('hex');
};

const render = (payload) => JSON.stringify(payload, null, 2) + '\n';

/**
 * Build every language file. Returns the exact bytes each file should have, plus a
 * coverage report — which is also the answer to "which visible strings have no
 * translation?", the one idea worth keeping from the retired i18n_audit.mjs.
 */
export function generate({ sourceDir = DEFAULT_SOURCE_DIR } = {}) {
  const table = readTable(sourceDir);
  const overlays = readOverlays(sourceDir, table.sourceLanguage);
  const tableText = readFileSync(table.path, 'utf8');
  const problems = [];
  const files = [];
  const coverage = [];

  // The source language: the key IS the text, so the file is the key set made
  // explicit. It ships (rather than being implied by "no file") so every language
  // loads through one code path, and so translators have the string list verbatim.
  files.push({
    name: `${table.sourceLanguage}.json`,
    text: render({
      language: table.sourceLanguage,
      generatedBy: 'scripts/build-i18n.js',
      generatedFrom: ['i18n/source/strings.json'],
      sourceSha256: sha256([['strings.json', tableText]]),
      strings: Object.fromEntries(table.entries.map((e) => [e.key, e.key])),
    }),
  });
  coverage.push({ language: table.sourceLanguage, translated: table.entries.length, missing: 0 });

  for (const overlay of overlays) {
    const known = new Set(table.entries.map((e) => e.key));
    for (const key of Object.keys(overlay.map)) {
      if (!known.has(key)) {
        problems.push(`${overlay.language}.json translates "${key}", which is not in strings.json`);
        continue;
      }
      const value = overlay.map[key];
      if (typeof value !== 'string') {
        problems.push(`${overlay.language}.json: "${key}" is not a string`);
        continue;
      }
      // A translation that loses (or invents) a placeholder renders a literal
      // "{value}" on screen, or drops the number entirely. Cheap to catch here.
      if (value.trim() !== '' && !sameSet(placeholders(key), placeholders(value))) {
        problems.push(
          `${overlay.language}.json: "${key}" expects placeholders ` +
          `{${[...placeholders(key)].join('} {')}} but the translation has ` +
          `{${[...placeholders(value)].join('} {')}}`);
      }
    }
    // Missing and empty are the same thing: absent from the generated file, so the
    // runtime falls back to the key — which is the English text (i18n.js:203's rule,
    // carried). Nothing is ever silently filled in with English at build time.
    const strings = {};
    let missing = 0;
    for (const { key } of table.entries) {
      const value = overlay.map[key];
      if (typeof value === 'string' && value.trim() !== '') strings[key] = value;
      else missing += 1;
    }
    files.push({
      name: `${overlay.language}.json`,
      text: render({
        language: overlay.language,
        generatedBy: 'scripts/build-i18n.js',
        generatedFrom: ['i18n/source/strings.json', `i18n/source/${overlay.language}.json`],
        sourceSha256: sha256([
          ['strings.json', tableText],
          [`${overlay.language}.json`, readFileSync(overlay.path, 'utf8')],
        ]),
        strings,
      }),
    });
    coverage.push({
      language: overlay.language,
      translated: table.entries.length - missing,
      missing,
    });
  }

  if (problems.length) throw new BuildError(problems);
  return { files, report: { keys: table.entries.length, coverage } };
}

/** Write the generated files. Returns the report plus which files actually changed. */
export function write({ sourceDir = DEFAULT_SOURCE_DIR, outDir = DEFAULT_OUT_DIR } = {}) {
  const { files, report } = generate({ sourceDir });
  const changed = [];
  for (const file of files) {
    const path = join(outDir, file.name);
    const current = existsSync(path) ? readFileSync(path, 'utf8') : null;
    if (current !== file.text) {
      writeFileSync(path, file.text);
      changed.push(file.name);
    }
  }
  return { ...report, changed, files: files.map((f) => f.name) };
}

/**
 * Compare the committed files against a fresh build without touching the tree.
 * `stale` = present but different, `missing` = never generated, `orphan` = an
 * i18n/*.json no source backs (a hand-edited language file, the failure mode this
 * whole build step exists to make impossible).
 */
export function check({ sourceDir = DEFAULT_SOURCE_DIR, outDir = DEFAULT_OUT_DIR } = {}) {
  const { files, report } = generate({ sourceDir });
  const stale = [];
  const missing = [];
  for (const file of files) {
    const path = join(outDir, file.name);
    if (!existsSync(path)) missing.push(file.name);
    else if (readFileSync(path, 'utf8') !== file.text) stale.push(file.name);
  }
  const expected = new Set(files.map((f) => f.name));
  const orphan = readdirSync(outDir)
    .filter((n) => n.endsWith('.json') && !expected.has(n))
    .sort();
  return { ...report, stale, missing, orphan, ok: !stale.length && !missing.length && !orphan.length };
}

function main(argv) {
  const wanted = argv.includes('--check');
  try {
    if (wanted) {
      const result = check();
      for (const { language, translated, missing } of result.coverage) {
        console.log(`  ${language}: ${translated}/${result.keys} translated, ${missing} missing`);
      }
      if (result.ok) {
        console.log(`i18n/ is fresh (${result.keys} keys, ${result.coverage.length} languages)`);
        return 0;
      }
      for (const name of result.stale) console.error(`STALE: i18n/${name} — run: node scripts/build-i18n.js`);
      for (const name of result.missing) console.error(`MISSING: i18n/${name} — run: node scripts/build-i18n.js`);
      for (const name of result.orphan) console.error(`ORPHAN: i18n/${name} has no source in i18n/source/`);
      return 1;
    }
    const result = write();
    for (const { language, translated, missing } of result.coverage) {
      console.log(`  ${language}: ${translated}/${result.keys} translated, ${missing} missing`);
    }
    console.log(result.changed.length
      ? `wrote ${result.changed.map((n) => `i18n/${n}`).join(', ')}`
      : `i18n/ already up to date (${result.files.length} files)`);
    return 0;
  } catch (error) {
    console.error(error instanceof BuildError ? error.message : error);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv.slice(2)));
}
