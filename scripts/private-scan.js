/**
 * Scans the tree for content that must not ship in a public repo: a developer's name or
 * home path, a LAN address that is not documentation range, a credential, and references
 * to files and documents this repo does not contain.
 *
 * Reports every hit and exits non-zero. Add a rule here rather than fixing one by hand
 * twice. Each rule carries its own allowances, so one rule's exception cannot silence
 * another's finding.
 */
import { execFileSync } from 'node:child_process';

/** This file states every pattern, so it must not search itself. */
/** The two scanners state the patterns, so neither may scan itself or the other. */
const SELF = ['scripts/private-scan.js', 'scripts/prose-scan.js'];

const OLD_SKIN_FILES = 'slate-(shell|live|components|tokens)\\.css|profile-editor-v3\\.css'
    + '|(context-menu|notes-modal|numpad-modal|time-picker-modal)\\.(css|js)'
    + '|dark-mode\\.css|main\\.css|settings\\.html|profile_(editor|selector)\\.js'
    + '|shot-rating\\.js|steam-mode\\.js|uplot-legend\\.js|chart-(components|palette|uplot)\\.js';

/** `pattern` is searched with `git grep -E`; `allow` exempts a matching line. */
const RULES = [
    {
        name: 'secret',
        pattern: 'ghp_|github_pat_|AKIA[0-9A-Z]{16}|BEGIN [A-Z ]*PRIVATE KEY',
    },
    {
        name: 'a person',
        pattern: '\\bBen\\b|championdesigns|\\bRay\\b|\\bVid\\b',
    },
    {
        name: 'an email address',
        pattern: '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}',
        allow: [
            /user@example\.com/,           // a fixture's example address
            /help@decentespresso\.com/,    // the public support address the app links to
        ],
    },
    {
        name: 'home path',
        pattern: '/home/[a-z]|/Users/[a-z]|~/[a-z]+/',
    },
    {
        name: 'LAN address',
        pattern: '\\b(192\\.168|10\\.[0-9]+|172\\.(1[6-9]|2[0-9]|3[01]))\\.[0-9]+\\.[0-9]+',
        // a host field's example, where a real-looking address helps the reader
        allow: [/placeholder="192\.168\.1\.50"/],
    },
    {
        name: 'absent document',
        pattern: '(CARRY_FORWARD|DECISIONS|DEFERRED_QUESTIONS|FINDINGS|LAYOUT_SPEC_DRAFT'
            + '|SCOPE|UPSTREAM_WORK)\\.md|SCOPE Part',
    },
    {
        name: 'absent file',
        pattern: OLD_SKIN_FILES,
    },
    {
        name: 'working folder',
        pattern: '_skinlab|realine-run|_audit/|Decal-Canary',
    },
];

let hits = 0;
for (const { name, pattern, allow = [] } of RULES) {
    let out = '';
    try {
        out = execFileSync(
            'git',
            ['grep', '--untracked', '-nIE', pattern, '--', '.', ...SELF.map((f) => `:!${f}`)],
            { encoding: 'utf8' },
        );
    } catch {
        continue; // git grep exits 1 when nothing matches
    }
    for (const line of out.split('\n').filter(Boolean)) {
        if (allow.some((re) => re.test(line))) continue;
        console.log(`  ${name}: ${line.slice(0, 140)}`);
        hits += 1;
    }
}

console.log(hits ? `\n${hits} must not ship` : 'private-scan: clean');
process.exit(hits ? 1 : 0);
