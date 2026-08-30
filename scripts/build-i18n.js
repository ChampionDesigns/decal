#!/usr/bin/env node
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

export function generate({ sourceDir = DEFAULT_SOURCE_DIR } = {}) {
  const table = readTable(sourceDir);
  const overlays = readOverlays(sourceDir, table.sourceLanguage);
  const tableText = readFileSync(table.path, 'utf8');
  const problems = [];
  const files = [];
  const coverage = [];

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
      if (value.trim() !== '' && !sameSet(placeholders(key), placeholders(value))) {
        problems.push(
          `${overlay.language}.json: "${key}" expects placeholders ` +
          `{${[...placeholders(key)].join('} {')}} but the translation has ` +
          `{${[...placeholders(value)].join('} {')}}`);
      }
    }
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
