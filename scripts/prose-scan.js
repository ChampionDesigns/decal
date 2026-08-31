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
import { readFileSync } from 'node:fs';

import { comments } from './lib/source-scan.js';

/** The two scanners state the patterns, so neither may scan itself or the other. */
const SELF = ['scripts/prose-scan.js', 'scripts/private-scan.js'];

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

/** Every unit of prose in one file, as {line, text}. */
function prose(file) {
    let source = '';
    try {
        source = readFileSync(file, 'utf8');
    } catch {
        return [];
    }
    const lineAt = (index) => source.slice(0, index).split('\n').length;
    if (/\.(js|mjs)$/.test(file)) return comments(source);
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

const only = process.argv[2];
const shown = only ? findings.filter((f) => f.rule === only || f.file.startsWith(only)) : findings;
for (const f of shown.slice(0, Number(process.env.PROSE_LIMIT ?? 40))) {
    console.log(`  ${f.file}:${f.line}  [${f.rule}: ${f.match}]`);
    console.log(`      ${f.text.replace(/\s+/g, ' ').trim().slice(0, 120)}`);
}
if (shown.length > Number(process.env.PROSE_LIMIT ?? 40)) {
    console.log(`  … ${shown.length - Number(process.env.PROSE_LIMIT ?? 40)} more`);
}

const byRule = new Map();
for (const f of findings) byRule.set(f.rule, (byRule.get(f.rule) ?? 0) + 1);
if (findings.length) {
    console.log('');
    for (const [rule, n] of [...byRule].sort((a, b) => b[1] - a[1])) {
        console.log(`  ${String(n).padStart(5)}  ${rule}`);
    }
    console.log(`  ${String(findings.length).padStart(5)}  TOTAL, in ${new Set(findings.map((f) => f.file)).size} files`);
} else {
    console.log('prose-scan: clean');
}
process.exit(findings.length ? 1 : 0);
