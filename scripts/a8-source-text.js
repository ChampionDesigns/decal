#!/usr/bin/env node
/**
 * a8-source-text.js — A8's guard: no test may match the SOURCE TEXT of a stylesheet or
 * a component module.
 *
 *     node scripts/a8-source-text.js            # scan test/, exit 1 on a new reader
 *     node scripts/a8-source-text.js --json     # machine-readable, for the wave GATE agent
 *
 * ===========================================================================
 * WHY
 * ===========================================================================
 * SCOPE Part 5 §5, on the profile editor: "A8 (accepted) bites hardest here: the old
 * editor is pinned by tests that regex-match the stylesheet's source text for the
 * 1920x1200 lock and the 64px literals — TESTS THAT MADE THE DEFECTS UNREMOVABLE. The
 * rewrite's editor lands with rendering tests asserting computed styles, and no test
 * anywhere may match source text (OQ-11 is answered by A8; the 29 text-scan test files
 * do not port, CARRY_FORWARD.md §7)."
 *
 * §7.4 records both halves of the damage. E1: `test/slate-editor-view-contract.test.mjs`
 * regex-matches `profile-editor-v3.css` for `width: 1920px; … height: 1200px;` and pins
 * the `64px`/`62px` literals, so REMOVING THE CANVAS LOCK FAILS THE TEST. E8: the
 * `--pe-scale` engine "is declared, documented, exported and tested — and wired to
 * nothing ... the tests pass against a layout engine the app does not use." A test that
 * reads source text asserts about a FILE; the app renders a BOX; and the day the two
 * disagree the test defends the file.
 *
 * ===========================================================================
 * WHAT IT LOOKS FOR — A PATH INSIDE A READ'S OWN ARGUMENTS
 * ===========================================================================
 * A violation is a SHIPPED-SOURCE PATH (`styles/…`, `src/components|screens|lib|stores/…`
 * — the last two added when the guard was found not to reach them — or anything ending
 * `.css`) written inside the ARGUMENT SPAN of a filesystem READ (`readFileSync` /
 * `readFile` / `readdirSync` / `readdir`).
 *
 * ARGUMENT-SCOPED, NOT FILE-SCOPED, and the difference is the guard's credibility.
 * "Somewhere in this file there is a read, and somewhere else there is a component
 * path" fires on `test/render/ui-menu.render.test.mjs`, which reads a GALLERY ENTRY and
 * separately names `/src/components/ui-menu.js` as the specifier it MOUNTS. A guard that
 * fires on a clean render test is a guard someone switches off, which is the same
 * outcome as one that fires on nothing (Gate C's canary README says so in as many
 * words).
 *
 * AND IT FOLLOWS ONE HOP THROUGH A HELPER, because "reading a .css/.js file and
 * asserting on its contents is a block wherever you find it, INCLUDING IN A HELPER".
 * A local declaration whose body contains a read — `const repoFile = (rel) =>
 * readFileSync(repo(rel), 'utf8')` — makes `repoFile` a read for the rest of the scan,
 * so `repoFile('src/components/app-root.js')` is caught at the call site where the path
 * actually is. That one hop is where the tree's real readers live; a second hop would
 * be a call graph, and this is a guard.
 *
 * THREE HOPS IN TOTAL, each one level deep and each one because the tree actually uses
 * it: a read helper (`const repoFile = (rel) => readFileSync(…)`), a path binding
 * (`const SOURCE = new URL('../src/components/ui-slider.js', …)`), and a for-of over a
 * list of paths (`for (const file of OVERLAY_FILES) read(file)`).
 *
 * THE STATED LIMIT, so the reach is documented rather than assumed: a path that arrives
 * at a read only through an IMPORTED table is not statically visible. There is one such
 * file in the tree today — `test/app-shell.test.mjs`, which does
 * `repoFile(ROUTES[id].module)` to prove each route names a module that EXISTS, an
 * existence check with no assertion about content. It is named here rather than
 * ledgered, because a ledger entry for a file the scan cannot see would read as coverage
 * this guard does not have.
 *
 * Prose in a comment is not code, so comments are blanked first — the same construction
 * note Gate C's canary README makes for the colour guard.
 *
 * THIS IS NOT A GATE C GUARD, and that is deliberate. Gate C's four guards scan AUTHORED
 * CSS BLOCKS and its runner is shaped around `check(blocks)`; this one scans test files.
 * Folding it in would change that contract and the "4/4 guards" the wave gate reports.
 * It ships as its own module with its own canary instead, and moving it into `GUARDS` is
 * one registration line the day the runner grows a second surface.
 *
 * ===========================================================================
 * THE LEDGER, AND WHY IT IS A RATCHET AND NOT AN ALLOWLIST
 * ===========================================================================
 * The tree already contains files that read component source for reasons that are not
 * A8's: checking that a route's module EXISTS, that a gallery entry file is registered,
 * that a generated artifact is fresh. A guard that failed the build on all of them
 * would be switched off within a day, which is the same outcome as one that fires on
 * nothing.
 *
 * So every such file is LEDGERED, by exact path, with a reason — and the ledger is
 * closed: a file not in it that trips both signals is a violation, and a ledgered file
 * that no longer trips them is ROT and is also a violation, because an entry that has
 * stopped protecting what it was written for may be shadowing a rename. That is Gate C's
 * own exemption-rot construction, and the reason it exists there is the reason it exists
 * here: "the check used to test whether the exempt path appeared in THIS run's scanned
 * file list, which is a different fact. It now stats the file."
 *
 * The ratchet is what the wave needs: the count can only go down, no new suite can pin a
 * defect by its source text, and the 29 text-scan files do not come back one at a time
 * as "temporary" pins.
 */

import fsp from 'node:fs/promises';
import path from 'node:path';
import { REPO_ROOT } from './lib/authored-css.js';

/** Where tests live. One root; a test outside it is not a test. */
export const DEFAULT_TEST_ROOTS = Object.freeze(['test']);

/**
 * The canaries violate this rule ON PURPOSE, so the default scan steps around them and
 * `test/a8-source-text.test.mjs` points the scan AT them instead. Gate C's canary README
 * states the same thing for the colour guard: "a guard that walks test/ without
 * excluding this directory will fail the build on its own canaries — which is itself
 * worth a test". Exact prefix, never a pattern.
 */
export const DEFAULT_EXCLUDE = Object.freeze(['test/fixtures/canaries']);

/**
 * The reads. `readdirSync` counts: listing `src/components/` and asserting on the names
 * is reading the tree's source, one level up.
 */
export const READ_NAMES = Object.freeze(['readFileSync', 'readFile', 'readdirSync', 'readdir']);

/**
 * A local declaration whose body contains a read — the one helper hop. Both shapes the
 * tree actually uses: an arrow/expression const, and a function declaration.
 */
const HELPER_CONST = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=[^;\n]*?\b(?:readFileSync|readFile|readdirSync|readdir)\s*\(/g;
const HELPER_FN = /function\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{[\s\S]{0,400}?\b(?:readFileSync|readFile|readdirSync|readdir)\s*\(/g;

/**
 * A path into the SHIPPED SOURCE, inside a string. The quote is part of the match so a
 * bare word in prose cannot trip it (prose is blanked anyway; this is the second line of
 * defence).
 *
 * FOUR SUBTREES, NOT TWO. The pattern reached `src/components/` and `src/screens/` —
 * the two directories the OLD editor's pins happened to live in — and stopped there, so
 * `src/lib/` and `src/stores/` were outside the guard while it reported clean. Those are
 * where this wave's highest-risk pinning surface lives: `readFileSync(
 * 'src/lib/machine-limits.js')` matched against a declared bound is THE ranges table (B2)
 * pinned by source text, and the same shape over `src/stores/` pins a route. A8's own
 * words are "reading a .css/.js file and asserting on its contents is a block WHEREVER
 * you find it", and a guard that has stopped covering its target is invisible from
 * anywhere else (Part 8 §2).
 *
 * `src/data/` IS DELIBERATELY NOT IN THE LIST, and this is the one judgement call in the
 * widening rather than an oversight. That subtree is the tree's REGISTRIES — the contract
 * table (`CONTRACTS.json`, read by five suites as the oracle every route is checked
 * against), the generated route module, the machine-state enum — and reading a registry
 * to cross-check a list against another list is the shape the ledger already blesses
 * fourteen times over. The canary states it as a rule the guard is tested on ("a fixture
 * and a generated data module are not styles", `test/a8-source-text.test.mjs`), so moving
 * it would be re-deciding that, not extending it. Recorded as a deferred question with
 * its reversal: one alternation puts `data` in.
 *
 * A BARE `src/` WAS TRIED FIRST AND IS WRONG, which is worth writing down so it is not
 * tried again: it matches ReaPrime's own `lib/src/services/webserver/de1handler.dart`,
 * and re-reading the handler AS WRITTEN AT THE PIN is required of every caller in this
 * tree. A guard that fires on the thing the standing orders mandate is a guard someone
 * switches off.
 *
 * Widening the PATTERN is not widening the SCAN: this is still matched only inside a
 * read's own argument span (see `findSourceTextReads`), so a suite that MOUNTS
 * `/src/lib/…` as a module specifier is untouched.
 */
const SOURCE_PATH = /(['"`])[^'"`\n]*(?:styles\/[\w.@-]*|src\/(?:components|screens|lib|stores)\/[\w.@-]*|\.css)[^'"`\n]*\1/g;

/** A local binding, so `const SOURCE = new URL('../src/components/ui-slider.js', …)` counts. */
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

/**
 * THE LEDGER. Exact paths, never patterns — a pattern is how an exemption quietly grows
 * to cover a file nobody meant it to. Each entry says what the file reads and why that
 * is not an assertion about source text.
 *
 * NOTHING FROM WAVE 5.5 IS IN IT AND NOTHING FROM IT MAY BE ADDED: A8 is a wave-wide
 * block, and the editor's own suites are rendering tests by construction. The count moved
 * 14 -> 24 once, when the PATTERN grew `src/lib/` and `src/stores/` and found ten
 * pre-existing readers it had never been able to see (the block below). That is the
 * ratchet working — a file that was always inside the rule became visible — and it is not
 * a licence: an entry is earned by being an ABSENCE or a REGISTRY CROSS-CHECK, never by
 * being inconvenient to fix.
 */
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

    /* -------------------------------------------------------------------------
     * REACHED WHEN THE PATTERN GREW `src/lib/` AND `src/stores/` (wave 5.5 fix).
     *
     * These ten pre-date the widening: they were always inside A8's RULE and were
     * outside its PATTERN, which is the state Part 8 §2 calls invisible. Walked one
     * at a time when the pattern changed, and every one of them turned out to be the
     * same shape — a NEGATIVE-SPACE claim about a module's own text. "This module
     * declares no clock." "No model name reaches this gate." "The retired 130/170
     * steam table has no foothold here." "Every named import is used."
     *
     * An absence has no box to measure, which is the ledger's existing test (see
     * type-roles-gallery-entry above), and — the load-bearing half — an absence
     * assertion CANNOT DO A8'S DAMAGE. A8's harm is a test that pins a literal so
     * that removing the defect fails the build. These fail when a defect ARRIVES.
     * `machine-limits.test.mjs` is the clearest case and the one worth naming: it
     * asserts the retired steam numbers are NOT declared, which is the opposite of
     * pinning the table B2 protects.
     *
     * Ten entries is a big jump on fourteen, and the ratchet still holds: each is an
     * exact path, each carries its reason, each is a file that exists today, and the
     * rot check fails the build the day one of them stops reading. Nothing in wave
     * 5.5 is here and nothing from it may be added.
     * ---------------------------------------------------------------------- */
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

/**
 * Every place this file reads the source text of a stylesheet or a component module,
 * with the line the PATH is written on — because that is the line an author has to
 * change, and a guard that reports the wrong line gets ignored.
 */
export function findSourceTextReads(source) {
    const code = blankJsComments(source);
    const lineOf = (index) => code.slice(0, index).split('\n').length;

    /* One hop: anything locally declared over a read reads, for the rest of this scan. */
    const helpers = new Set();
    for (const re of [HELPER_CONST, HELPER_FN]) {
        for (const m of code.matchAll(re)) helpers.add(m[1]);
    }

    /* And one hop the other way: a local binding that HOLDS a style-or-component path
     * — `const SOURCE = new URL('../src/components/ui-slider.js', …)`, or an array of
     * them — is that path, wherever its name is handed to a read. This is the shape the
     * tree's real readers use, and without it the guard reads as clean while a suite
     * regex-matches a component two lines further down. */
    const pathBindings = new Map();
    for (const m of code.matchAll(BINDING)) {
        const init = initializer(code, m.index + m[0].length);
        const found = init.match(SOURCE_PATH);
        if (found) pathBindings.set(m[1], { text: found[0], line: lineOf(m.index) });
    }

    /* A loop over a list of paths hands each one to the body under a new name. One hop,
     * for the same reason as the two above: `for (const file of OVERLAY_FILES) read(file)`
     * is a read of every path in that list, and a guard that cannot see it has silently
     * stopped covering its target. */
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

/**
 * Scan the tree.
 *
 * @param opts.root     repo root (the canary test points this at a fixture directory)
 * @param opts.roots    scan roots inside it
 * @param opts.ledger   the closed set of files allowed to trip both signals
 * @param opts.checkRot default true; an entry that no longer trips is reported
 */
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

/* ===========================================================================
 * CLI
 * =========================================================================== */

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
