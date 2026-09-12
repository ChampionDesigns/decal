/**
 * Every comment and every prose string in the tree, checked against what a public repo
 * may say. A comment explains what the code does and why it must stay that way. It does
 * not name a person, another skin, a decision, a wave, a gate, or a file this repo does
 * not contain.
 *
 * This is the definition of clean, not a sampling of it: `npm run prose-scan` reads all
 * prose from every tracked file and reports each unit that breaks a rule. Add a rule
 * here rather than fixing the same class of thing by hand twice.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

import { comments, strings } from './lib/source-scan.js';

/**
 * The two scanners state the patterns and the baseline records what they find, so none
 * of the three may be scanned: each one quotes the text it exists to report.
 */
const BASELINE = 'tools/prose-baseline.json';
const BASELINE_RULE = 'Every prose finding this tree already carries, so the gate passes on what is '
    + 'here and fails on anything added. An entry is a file, a rule, the matched words, and a digest '
    + 'of the unit holding them. The list may only shrink: rewrite it with --baseline after cleaning, '
    + 'never to quieten something new.';
const SELF = ['scripts/prose-scan.js', 'scripts/private-scan.js', BASELINE];

/** Never read for prose: third-party code, binaries, and recorded server responses. */
const SKIP = [/^vendor\//, /^fonts\//, /^tools\/rea-fixtures\//, /\.(png|woff2?|ttf|sha256)$/,
    /^package(-lock)?\.json$/];   // configuration, not prose

const RULES = [
    ['a person', /\b(Ben|Ray|Vid)\b|championdesigns/],
    ['another skin', /\bslate\b|\bSlate\b|the reference skin|the old skin|\breaLine\b|\bRadian\b|\bStreamline\b|old (sheet|editor|modal|picker|palette|selector)|current skin/],
    ['a file not in this repo', /(?<![.\w])[A-Za-z][\w-]*(?:\.[\w-]+)*\.(?:css|js|mjs|py|md|json|html)\b(?!\()/, isAbsentFile],
    ['a document not in this repo', /(CARRY_FORWARD|DECISIONS|DEFERRED_QUESTIONS|FINDINGS|LAYOUT_SPEC_DRAFT|SCOPE|UPSTREAM_WORK|ITEMS|Api|Skins)\.(md|json)\b|\bSCOPE\b|\bscope\//],
    ['a spec section', /§\s?[\d.]+|\bspec\b|Appendix\s+\d+/, notAPublicStandard],
    ['the work, not the code', /[Ww]ave\s+\d|\bGate\s+[A-F0-9]\b|\bthe audit\b|\bthe corpus\b|\bORACLE\b|\bthe oracle\b|provenance (walk|corpus|probe|run)|\bthe rewrite\b|\bthis wave\b|\bsign-off\b/],
    ['a decision id', /(?<![A-Za-z0-9_])(?:[ABCDELOPQT]\d{1,2}|CB-\d+|OQ-\d+|DQ-\d+)(?![A-Za-z0-9_])/],
    ['a date', /\b\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}\b|\b20\d\d-\d\d-\d\d\b/],
];

/** Matches that are the thing itself, not a reference to something a reader cannot see. */
const ALLOW = [
    /^render\.test\.mjs$/,           // the naming pattern for a rendering suite, not a file
    /^desc\.json$/,                   // the tail of a recorded fixture's query string
    /^current skin$/,               // "Check for current skin updates" is product English
    /^R[123]$/,                       // the adapter registry, defined in src/data/adapters-r.js
    /^P0$/,                           // a lever step's initial pressure
    /^F([1-9]|1[0-2])$/,              // keyboard function keys
    /^E[1-9]\d?$/,                    // an element index in a measurement
];

const allTracked = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'],
    { encoding: 'utf8' }).split('\n').filter(Boolean);
const basenames = new Set(allTracked.map((f) => f.split('/').pop()));

/**
 * A cited filename is a finding only when this repo does not contain it. Pointing at a
 * file and line a reader can open is useful; pointing into a tree they cannot see is not.
 */
function isAbsentFile(name) {
    return !basenames.has(name.replace(/:\d+.*$/, ''));
}

/**
 * A section number is a finding unless it belongs to a public standard. "CSS Scoping
 * §3.3" is something a reader can look up; "spec §4.4" is not.
 */
let currentUnit = '';
function notAPublicStandard() {
    return !/\b(CSS|WHATWG|W3C|ARIA|WAI|RFC|ECMA|HTML|DOM)\b/.test(currentUnit);
}

const tracked = allTracked.filter((f) => !SELF.includes(f) && !SKIP.some((re) => re.test(f)));

/**
 * A string is prose only when it reads like a sentence. One line at a time, so a
 * tagged template is a set of units rather than one unit the size of a stylesheet.
 */
const PROSE_MIN = 25;

function jsStrings(source) {
    const out = [];
    for (const literal of strings(source)) {
        literal.text.split('\n').forEach((raw, offset) => {
            const text = raw.trim();
            if (text.length >= PROSE_MIN && text.includes(' ')) {
                out.push({ line: literal.line + offset, text });
            }
        });
    }
    return out;
}

/** Every unit of prose in one file, as {line, text}. */
function prose(file) {
    let source = '';
    try {
        source = readFileSync(file, 'utf8');
    } catch {
        return [];
    }
    const lineAt = (index) => source.slice(0, index).split('\n').length;
    if (/\.(js|mjs)$/.test(file)) return [...comments(source), ...jsStrings(source)];
    if (/\.py$/.test(file)) {
        const out = source.split('\n')
            .map((l, i) => ({ line: i + 1, text: l.trim() }))
            .filter((r) => r.text.startsWith('#'));
        for (const m of source.matchAll(/"""([\s\S]*?)"""/g)) {
            out.push({ line: lineAt(m.index), text: m[1] });
        }
        return out;
    }
    if (/\.css$/.test(file)) {
        return [...source.matchAll(/\/\*[\s\S]*?\*\//g)].map((m) => ({ line: lineAt(m.index), text: m[0] }));
    }
    if (/\.html$/.test(file)) {
        return [...source.matchAll(/<!--[\s\S]*?-->/g)].map((m) => ({ line: lineAt(m.index), text: m[0] }));
    }
    if (/\.md$/.test(file)) {
        return source.split('\n').map((l, i) => ({ line: i + 1, text: l })).filter((r) => r.text.trim());
    }
    if (/\.json$/.test(file)) {
        const out = [];
        source.split('\n').forEach((l, i) => {
            for (const m of l.matchAll(/"([^"\\]{25,}(?:\\.[^"\\]*)*)"/g)) {
                if (m[1].includes(' ')) out.push({ line: i + 1, text: m[1] });
            }
        });
        return out;
    }
    return [];
}

const findings = [];
for (const file of tracked) {
    for (const unit of prose(file)) {
        currentUnit = unit.text;
        for (const [rule, pattern, extra] of RULES) {
            const global = new RegExp(pattern.source, `${pattern.flags.replace('g', '')}g`);
            let hit = null;
            for (const m of unit.text.matchAll(global)) {
                if (ALLOW.some((re) => re.test(m[0]))) continue;
                if (extra && !extra(m[0])) continue;
                hit = m[0];
                break;
            }
            if (!hit) continue;
            findings.push({ file, line: unit.line, rule, match: hit, text: unit.text });
            break;
        }
    }
}

const flatten = (text) => text.replace(/\s+/g, ' ').trim();

/** A file, a rule and a key all admit spaces, so the composite key may not. */
const SEP = '\u0000';

/**
 * A finding's identity, which has to survive the lines around it moving: the matched
 * words and a digest of the unit holding them, with whitespace collapsed. Reflowing a
 * comment keeps its identity; rewording one does not.
 */
function key(finding) {
    const digest = createHash('sha256').update(flatten(finding.text)).digest('hex').slice(0, 12);
    return `${finding.match}:${digest}`;
}

function readBaseline() {
    if (!existsSync(BASELINE)) return {};
    return JSON.parse(readFileSync(BASELINE, 'utf8')).entries ?? {};
}

/** The findings as {file: {rule: [key]}}, every level sorted so a rewrite diffs small. */
function buildBaseline(all) {
    const entries = {};
    for (const f of all) {
        const byRule = entries[f.file] ?? (entries[f.file] = {});
        (byRule[f.rule] ?? (byRule[f.rule] = [])).push(key(f));
    }
    const ordered = {};
    for (const file of Object.keys(entries).sort()) {
        ordered[file] = {};
        for (const rule of Object.keys(entries[file]).sort()) ordered[file][rule] = entries[file][rule].sort();
    }
    return ordered;
}

const held = new Map();
for (const [file, byRule] of Object.entries(readBaseline())) {
    for (const [rule, keys] of Object.entries(byRule)) {
        for (const k of keys) {
            const id = [file, rule, k].join(SEP);
            held.set(id, (held.get(id) ?? 0) + 1);
        }
    }
}

const fresh = [];
for (const f of findings) {
    const id = [f.file, f.rule, key(f)].join(SEP);
    const left = held.get(id) ?? 0;
    if (left > 0) held.set(id, left - 1);
    else fresh.push(f);
}
const stale = [...held].filter(([, n]) => n > 0).map(([id, n]) => {
    const [file, rule, k] = id.split(SEP);
    return { file, rule, match: k.slice(0, k.lastIndexOf(':')), count: n };
}).sort((a, b) => a.file.localeCompare(b.file));
const staleCount = stale.reduce((n, s) => n + s.count, 0);

const show = (mark, f) => {
    console.log(`  ${mark}${f.file}:${f.line}  [${f.rule}: ${f.match}]`);
    console.log(`      ${flatten(f.text).slice(0, 120)}`);
};

if (process.argv.includes('--baseline')) {
    for (const f of fresh) show('+ ', f);
    for (const s of stale) console.log(`  - ${s.file}  [${s.rule}: ${s.match}] ×${s.count}`);
    writeFileSync(BASELINE, `${JSON.stringify({ _rule: BASELINE_RULE, entries: buildBaseline(findings) }, null, 2)}\n`);
    console.log(`prose-scan: baseline rewritten — ${findings.length} recorded, ${fresh.length} added, ${staleCount} dropped`);
    process.exit(0);
}

const only = process.argv.slice(2).find((a) => !a.startsWith('--'));
const shown = only ? fresh.filter((f) => f.rule === only || f.file.startsWith(only)) : fresh;
const limit = Number(process.env.PROSE_LIMIT ?? 40);
for (const f of shown.slice(0, limit)) show('', f);
if (shown.length > limit) console.log(`  … ${shown.length - limit} more`);
for (const s of stale.slice(0, limit)) {
    console.log(`  CLEANED  ${s.file}  [${s.rule}: ${s.match}] ×${s.count} — re-run with --baseline to drop it`);
}

if (fresh.length) {
    const byRule = new Map();
    for (const f of fresh) byRule.set(f.rule, (byRule.get(f.rule) ?? 0) + 1);
    console.log('');
    for (const [rule, n] of [...byRule].sort((a, b) => b[1] - a[1])) {
        console.log(`  ${String(n).padStart(5)}  ${rule}`);
    }
    console.log(`  ${String(fresh.length).padStart(5)}  NEW, in ${new Set(fresh.map((f) => f.file)).size} files`);
}

const carried = findings.length - fresh.length;
if (fresh.length || staleCount) {
    console.log(`prose-scan: ${fresh.length} new, ${staleCount} cleaned, ${carried} carried by the baseline`);
} else {
    console.log(`prose-scan: clean — nothing new, ${carried} carried by the baseline`);
}
process.exit(fresh.length || staleCount ? 1 : 0);
