#!/usr/bin/env node
import fsp from 'node:fs/promises';
import path from 'node:path';
import { REPO_ROOT } from './lib/authored-css.js';

/** Where tests live. One root; a test outside it is not a test. */
export const DEFAULT_TEST_ROOTS = Object.freeze(['test']);

export const DEFAULT_EXCLUDE = Object.freeze(['test/fixtures/canaries']);

export const READ_NAMES = Object.freeze(['readFileSync', 'readFile', 'readdirSync', 'readdir']);

/**
 * A local declaration whose body contains a read — the one helper hop. Both shapes the
 * tree actually uses: an arrow/expression const, and a function declaration.
 */
const HELPER_CONST = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=[^;\n]*?\b(?:readFileSync|readFile|readdirSync|readdir)\s*\(/g;
const HELPER_FN = /function\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{[\s\S]{0,400}?\b(?:readFileSync|readFile|readdirSync|readdir)\s*\(/g;

const SOURCE_PATH = /(['"`])[^'"`\n]*(?:styles\/[\w.@-]*|src\/(?:components|screens|lib|stores)\/[\w.@-]*|\.css)[^'"`\n]*\1/g;

const BINDING = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g;

/** `for (const file of OVERLAY_FILES)` — the loop variable inherits the list's paths. */
const FOR_OF = /for\s*\(\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s+of\s+([A-Za-z_$][\w$]*)/g;

/**
 * The text between a call's parentheses, balanced. `open` is the index of the `(`.
 * Returns null for an unterminated call, which a parse error would have caught first.
 */
function argumentSpan(code, open) {
    let depth = 0;
    let quote = null;
    for (let i = open; i < code.length; i += 1) {
        const ch = code[i];
        if (quote) {
            if (ch === '\\') { i += 1; continue; }
            if (ch === quote) quote = null;
            continue;
        }
        if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
        if (ch === '(') depth += 1;
        else if (ch === ')') {
            depth -= 1;
            if (depth === 0) return code.slice(open + 1, i);
        }
    }
    return null;
}

/** One declaration's initializer: to the first `;` outside a string, capped. */
function initializer(code, from, cap = 4000) {
    let quote = null;
    const end = Math.min(code.length, from + cap);
    for (let i = from; i < end; i += 1) {
        const ch = code[i];
        if (quote) {
            if (ch === '\\') { i += 1; continue; }
            if (ch === quote) quote = null;
            continue;
        }
        if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
        if (ch === ';') return code.slice(from, i);
    }
    return code.slice(from, end);
}

export const LEDGER = Object.freeze({
    'test/base-conventions.test.mjs':
        'the wave-0a conventions suite — it is the file that proves the SCANNER works, so '
        + 'it necessarily opens what the scanner opens',
    'test/chart-channel-keys.test.mjs':
        'reads styles/chart-channels.css as a REGISTRY: every channel key has a token and '
        + 'every token has a key. A cross-check between two lists, never a look',
    'test/chart-tokens.test.mjs':
        'the other half of the same registry cross-check, from the reader\'s side',
    'test/live-connection-gates.test.mjs':
        'reads the Live gate modules to cross-check the gate ids they enumerate',
    'test/live-screen.test.mjs':
        'the questions a measurement cannot ask about the Live screen\'s COMPOSITION — '
        + 'which file defines which tag; its geometry is test/render/live-screen.render.test.mjs',
    'test/overlay-hygiene.test.mjs':
        'Gate C\'s own meta-test: it opens the ten overlay surfaces to prove the GUARD '
        + 'covers them. A guard that has stopped scanning its target is invisible from '
        + 'anywhere else (Part 8 §2)',
    'test/profile-library-store.test.mjs':
        'cross-checks which module names the store\'s routes',
    'test/settings-bespoke.test.mjs':
        'the nine bespoke leaves\' registry cross-check — which leaf composes which tag',
    'test/settings-leaves.test.mjs':
        'the 37-leaf registry cross-check, same shape',
    'test/settings-skeleton.test.mjs':
        'the questions a measurement cannot ask about the Settings shell; its geometry '
        + 'is test/render/settings-skeleton.render.test.mjs',
    'test/storage-routes.test.mjs':
        'B7\'s routing table cross-check against the token sheets',
    'test/type-roles-gallery-entry.test.mjs':
        'proves type-roles.js defines NO custom element — an absence, which has no box '
        + 'to measure',
    'test/ui-screensaver-tokens.test.mjs':
        'cross-checks the screensaver token NAMES against styles/tokens.css',
    'test/ui-slider-thumb-parity.test.mjs':
        'proves the two vendor thumb pseudo-elements are declared from ONE source — the '
        + 'one claim in the tree that is about the declaration and not about the box, '
        + 'because ::-moz-range-thumb cannot be measured in Chrome (bug T22)',

    'test/app-shell.test.mjs':
        'reads src/lib/app-boot.js to prove bootFromWindow is the ONLY place ambient '
        + 'state is read — a containment claim about where a name may appear, which is '
        + 'what keeps the module node-testable and has no rendered box',
    'test/capabilities-store.test.mjs':
        'A3: reads src/stores/capabilities-store.js with strings dropped to prove the '
        + 'store names NO machine model in code — an absence, and the assertion fails '
        + 'when a model sniff arrives rather than when one is removed',
    'test/chart-feed.test.mjs':
        'reads src/lib/chart-feed.js to prove the feed holds no clock of its own (no '
        + 'Date.now, performance.now, setInterval, setTimeout) — the shot\'s clock is '
        + 'ReaPrime\'s stamps, and this is that absence',
    'test/estimator-link-store.test.mjs':
        'reads src/stores/estimator-link-store.js to prove the module reads no channel '
        + 'name of its own — the same absence shape as capabilities-store',
    'test/live-targets.test.mjs':
        'reads src/lib/live-targets.js to prove it IMPORTS the generated machine-state '
        + 'enum instead of hand-copying it — a one-source claim, and the old skin\'s '
        + 'hand copy shipped a state in neither direction',
    'test/machine-limits.test.mjs':
        'reads src/lib/machine-limits.js to prove the RETIRED steam table (130, 170) has '
        + 'no foothold in the module and that the file cites its own decisions (R2/B2/B3) '
        + '— an anti-pin: it fires when a dead bound comes back, never when a live one '
        + 'moves, which is B2 defended rather than frozen',
    'test/wall-clock.test.mjs':
        'reads src/lib/wall-clock.js, and both claims are ANTI-PINS — the shape '
        + 'machine-limits.test.mjs is ledgered for. One asserts the module reaches for NO '
        + 'ambient state (no clock of its own, no navigator locale), so the caller can '
        + 'hand it a fixed instant and this skin\'s own language setting; the other '
        + 'asserts that no SECOND copy of the Intl option bag exists in the two surfaces '
        + 'that show a clock. Both fire when something comes back and never when a live '
        + 'value moves: the formatter itself is asserted by its OUTPUT, and the module '
        + 'was extracted on 24 Aug 2026 precisely because a second copy would let the '
        + 'Live header and the screensaver disagree about what a time looks like, '
        + 'silently, each right on its own screen',
    'test/screensaver-policy.test.mjs':
        'reads src/lib/screensaver-policy.js to prove every named import is USED — a '
        + 'dead import is an unfinished intention, and one shipped here undetected '
        + 'because Gate C has no unused-import guard',
    'test/settings-nav.test.mjs':
        'the module is DOM-free by construction (Part 2 §2), so T12 — no ordinal '
        + 'interpolated into a nav name, exactly one navName — has no box to measure; '
        + 'the file says so at its own line 19',
    'test/settings-store.test.mjs':
        'reads src/stores/settings-store.js to prove no model string reaches the '
        + 'capability gate — gating reads the served array only, and the absence is the '
        + 'claim',
    'test/shot-source-selector.test.mjs':
        'a whole describe called "what this module must not contain": no copy of '
        + 'ReaPrime\'s 0.3 gate constant, no computation of the quantities it selects '
        + 'between. Absences, and both would be invisible in any rendered output',
});

/**
 * Blank JavaScript comments while keeping every byte's line number. Blanked, not
 * deleted: a violation is reported at a line, and a stripper that shortens the file
 * reports it at the wrong one.
 */
export function blankJsComments(source) {
    let out = '';
    let i = 0;
    const n = source.length;
    let quote = null;

    while (i < n) {
        const ch = source[i];
        const next = source[i + 1];

        if (quote) {
            out += ch;
            if (ch === '\\') { out += next ?? ''; i += 2; continue; }
            if (ch === quote) quote = null;
            i += 1;
            continue;
        }

        if (ch === '"' || ch === "'" || ch === '`') { quote = ch; out += ch; i += 1; continue; }

        if (ch === '/' && next === '/') {
            while (i < n && source[i] !== '\n') { out += ' '; i += 1; }
            continue;
        }

        if (ch === '/' && next === '*') {
            out += '  ';
            i += 2;
            while (i < n && !(source[i] === '*' && source[i + 1] === '/')) {
                out += source[i] === '\n' ? '\n' : ' ';
                i += 1;
            }
            out += '  ';
            i += 2;
            continue;
        }

        out += ch;
        i += 1;
    }
    return out;
}

/** Every `.js`/`.mjs`/`.cjs` file under the roots, repo-relative, sorted. */
export async function listTestFiles(roots = DEFAULT_TEST_ROOTS, {
    root = REPO_ROOT,
    exclude = DEFAULT_EXCLUDE,
} = {}) {
    const skip = exclude.map((p) => `${p.replace(/\/+$/, '')}/`);
    const found = [];
    const walk = async (dir) => {
        let entries;
        try { entries = await fsp.readdir(dir, { withFileTypes: true }); } catch { return; }
        for (const entry of entries) {
            const abs = path.join(dir, entry.name);
            if (entry.isDirectory()) { await walk(abs); continue; }
            if (!/\.(?:js|mjs|cjs)$/.test(entry.name)) continue;
            const rel = path.relative(root, abs).split(path.sep).join('/');
            if (skip.some((prefix) => rel.startsWith(prefix))) continue;
            found.push(rel);
        }
    };
    for (const rel of roots) await walk(path.resolve(root, rel));
    return found.sort();
}

export function findSourceTextReads(source) {
    const code = blankJsComments(source);
    const lineOf = (index) => code.slice(0, index).split('\n').length;

    /* One hop: anything locally declared over a read reads, for the rest of this scan. */
    const helpers = new Set();
    for (const re of [HELPER_CONST, HELPER_FN]) {
        for (const m of code.matchAll(re)) helpers.add(m[1]);
    }

    const pathBindings = new Map();
    for (const m of code.matchAll(BINDING)) {
        const init = initializer(code, m.index + m[0].length);
        const found = init.match(SOURCE_PATH);
        if (found) pathBindings.set(m[1], { text: found[0], line: lineOf(m.index) });
    }

    for (const m of code.matchAll(FOR_OF)) {
        const source = pathBindings.get(m[2]);
        if (source && !pathBindings.has(m[1])) {
            pathBindings.set(m[1], { text: `${m[2]}: ${source.text}`, line: source.line });
        }
    }

    const names = [...new Set([...READ_NAMES, ...helpers])];
    const callSites = new RegExp(`\\b(${names.map((n) => n.replace(/\$/g, '\\$')).join('|')})\\s*\\(`, 'g');

    const hits = [];
    for (const call of code.matchAll(callSites)) {
        const open = call.index + call[0].length - 1;
        const args = argumentSpan(code, open);
        if (args === null) continue;

        for (const m of args.matchAll(SOURCE_PATH)) {
            hits.push({
                call: call[1],
                callLine: lineOf(call.index),
                line: lineOf(open + 1 + m.index),
                text: m[0],
                via: helpers.has(call[1]) ? 'helper' : 'literal',
            });
        }

        for (const [name, binding] of pathBindings) {
            if (!new RegExp(`\\b${name.replace(/\$/g, '\\$')}\\b`).test(args)) continue;
            hits.push({
                call: call[1],
                callLine: lineOf(call.index),
                line: binding.line,
                text: `${name} = ${binding.text}`,
                via: 'binding',
            });
        }
    }

    return {
        hits,
        helpers: [...helpers],
        pathBindings: [...pathBindings.keys()],
        hit: hits.length > 0,
    };
}

export async function runSourceTextScan({
    root = REPO_ROOT,
    roots = DEFAULT_TEST_ROOTS,
    exclude = DEFAULT_EXCLUDE,
    ledger = LEDGER,
    checkRot = true,
} = {}) {
    const files = await listTestFiles(roots, { root, exclude });
    const violations = [];
    const ledgered = [];
    const clean = [];

    for (const rel of files) {
        const source = await fsp.readFile(path.resolve(root, rel), 'utf8');
        const found = findSourceTextReads(source);
        if (!found.hit) { clean.push(rel); continue; }
        if (Object.prototype.hasOwnProperty.call(ledger, rel)) { ledgered.push(rel); continue; }
        const first = found.hits[0];
        violations.push({
            file: rel,
            line: first.line,
            message: 'a test reads the source text of a stylesheet or a component module',
            detail: `${first.call}(…) at line ${first.callLine}, path ${first.text}`
                + (first.via === 'helper' ? ' — through a local read helper' : '')
                + (first.via === 'binding' ? ' — through a local path binding' : '')
                + (found.hits.length > 1 ? `, and ${found.hits.length - 1} more` : ''),
            fix: 'assert on a COMPUTED STYLE or a RENDERED BOX (test/render/, test/harness/) — '
                + 'A8: a test that matches source text makes the defect it describes unremovable',
        });
    }

    if (checkRot) {
        for (const rel of Object.keys(ledger)) {
            if (ledgered.includes(rel)) continue;
            violations.push({
                file: rel,
                line: 0,
                message: clean.includes(rel)
                    ? `ledger rot: ${rel} no longer reads source text`
                    : `ledger rot: ${rel} is not a test file in this tree`,
                detail: 'an entry that has stopped protecting what it was written for may be '
                    + 'shadowing a rename (Gate C\'s exemption-rot rule, same reason)',
                fix: `remove ${rel} from LEDGER in scripts/a8-source-text.js`,
            });
        }
    }

    return {
        root,
        roots,
        files,
        scanned: files.length,
        ledgered,
        clean: clean.length,
        violations,
        ok: violations.length === 0,
    };
}

export function formatReport(report) {
    const lines = [];
    lines.push(`A8 — ${report.scanned} test files, ${report.ledgered.length} ledgered, `
        + `${report.clean} clean of source text`);
    for (const v of report.violations) {
        lines.push(`  ${v.file}:${v.line}  ${v.message}`);
        if (v.detail) lines.push(`      ${v.detail}`);
        if (v.fix) lines.push(`      fix: ${v.fix}`);
    }
    lines.push(report.ok
        ? 'A8: OK — no test matches the source text of a style or component file'
        : `A8: FAILED — ${report.violations.length} violation${report.violations.length === 1 ? '' : 's'}`);
    return lines.join('\n');
}

const isMain = process.argv[1]
    && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);

if (isMain) {
    const report = await runSourceTextScan({});
    if (process.argv.includes('--json')) {
        process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
        process.stdout.write(`${formatReport(report)}\n`);
    }
    process.exit(report.ok ? 0 : 1);
}
