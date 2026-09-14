#!/usr/bin/env node
/**
 * The unused-export gate. An exported function in `src/` that no other `src/` module
 * imports is a module nothing calls, and the answer is to wire it up or delete it.
 *
 * A custom element's class is exempt: callers name the tag, not the class. Anything else
 * that is right to be uncalled is listed in `tools/export-ledger.json`.
 */

import { readFileSync, readdirSync, statSync, existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { comments, strings, stripComments } from './lib/source-scan.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LEDGER = path.join(REPO, 'tools', 'export-ledger.json');
const RULE = 'Exported functions in src/ that no other src/ module calls. `vouched` gives a reason a '
    + 'reader can check against the code; `baseline` is a plain list, so the gate fails on the next '
    + 'one rather than on all of them. Rewrite it with --baseline only to drop a name that now has a '
    + 'caller: the list may shrink, never grow.';

/** Every `.js` and `.mjs` file under a directory, depth first. */
function walk(dir, out = []) {
    if (!existsSync(dir)) return out;
    for (const name of readdirSync(dir).sort()) {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) walk(full, out);
        else if (name.endsWith('.js') || name.endsWith('.mjs')) out.push(full);
    }
    return out;
}

/** The lines inside a multi-line comment or literal, where a declaration is only text. */
function interior(source) {
    const skip = new Set();
    for (const unit of [...comments(source), ...strings(source)]) {
        const span = unit.text.split('\n').length;
        for (let i = 1; i < span; i += 1) skip.add(unit.line + i);
    }
    return skip;
}

/**
 * The exported function names of one source, with the line each is declared on. Functions
 * only: an exported constant a test reads instead of retyping is the normal shape here, so
 * widening this reports hundreds of names that are not faults.
 */
function exportsOf(source) {
    const skip = interior(source);
    const found = new Map();
    source.split('\n').forEach((line, i) => {
        if (skip.has(i + 1)) return;
        const m = /^\s*export\s+(?:async\s+)?function\*?\s+([A-Za-z_$][\w$]*)/.exec(line);
        if (m) found.set(m[1], i + 1);
    });
    return found;
}

/**
 * Every name this source imports or re-exports, from anywhere. A re-export counts as a use
 * of the far module's name and as an export of this one, which is what makes a barrel file
 * honest. An import resolved from a variable is not followed: the gate does not guess.
 */
function importsOf(text) {
    const names = new Set();
    for (const m of text.matchAll(/(?:import|export)\s*\{([^}]*)\}\s*from/g)) {
        for (const part of m[1].split(',')) {
            const name = part.trim().split(/\s+as\s+/)[0].trim();
            if (name) names.add(name);
        }
    }
    return names;
}

const srcFiles = walk(path.join(REPO, 'src'));
const outsideFiles = [...walk(path.join(REPO, 'test')), ...walk(path.join(REPO, 'tools'))];

const usedInSrc = new Set();
const usedOutside = new Set();
const declared = [];

for (const file of srcFiles) {
    const raw = readFileSync(file, 'utf8');
    const bare = stripComments(raw, { dropStrings: true });
    const defines = /customElements\.define\s*\(/.test(bare);
    for (const [name, line] of exportsOf(raw)) {
        declared.push({ name, file: path.relative(REPO, file), line, defines });
    }
    for (const name of importsOf(bare)) usedInSrc.add(name);
}
for (const file of outsideFiles) {
    for (const name of importsOf(stripComments(readFileSync(file, 'utf8'), { dropStrings: true }))) {
        usedOutside.add(name);
    }
}

const ledger = existsSync(LEDGER) ? JSON.parse(readFileSync(LEDGER, 'utf8')) : {};
const vouched = ledger.vouched ?? {};
const baseline = new Set(ledger.baseline ?? []);
const listed = new Set([...Object.keys(vouched), ...baseline]);

const uncalled = declared.filter((row) => !usedInSrc.has(row.name) && !row.defines);
const reported = uncalled.filter((row) => !listed.has(row.name));
const testOnly = reported.filter((row) => usedOutside.has(row.name));
const unused = reported.filter((row) => !usedOutside.has(row.name));
const names = new Set(uncalled.map((row) => row.name));
const stale = [...listed].filter((name) => !names.has(name));

if (process.argv.includes('--baseline')) {
    const kept = [...names].filter((name) => !(name in vouched)).sort();
    for (const name of kept) if (!baseline.has(name)) console.log(`  + ${name}`);
    for (const name of stale) console.log(`  - ${name}`);
    writeFileSync(LEDGER, `${JSON.stringify({ _rule: RULE, vouched, baseline: kept }, null, 2)}\n`);
    console.log(`gate-export: ledger rewritten — ${kept.length} baselined, ${Object.keys(vouched).length} vouched`);
    process.exit(0);
}

console.log(`gate-export: ${srcFiles.length} source files, ${declared.length} exported functions, `
    + `${Object.keys(vouched).length} vouched, ${baseline.size} baselined`);

for (const row of unused) {
    console.log(`  UNUSED EXPORT     ${row.file}:${row.line}  ${row.name} — nothing imports it`);
}
for (const row of testOnly) {
    console.log(`  TEST-ONLY EXPORT  ${row.file}:${row.line}  ${row.name} — only test/ and tools/ import it`);
}
for (const name of stale) {
    console.log(`  STALE ENTRY       tools/export-ledger.json  ${name} — listed, but no export of that name is uncalled`);
}

const bad = unused.length + testOnly.length + stale.length;
if (bad === 0) {
    console.log('gate-export: OK — every export in src/ is reached from src/');
    process.exit(0);
}
console.log(`gate-export: ${unused.length} unused, ${testOnly.length} test-only, ${stale.length} stale entries`);
console.log('  Each is an exported function that no other module in src/ calls. Wire it up, delete');
console.log('  it, or list it in tools/export-ledger.json with a reason a reader can check.');
process.exit(1);
