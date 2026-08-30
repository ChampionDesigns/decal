#!/usr/bin/env node
/**
 * gate-d.js — the contract table as a build gate (SCOPE Part 8 §2, Gate D).
 *
 * Part 3 §7 makes contract checking a BUILD activity: every endpoint the skin adopts has
 * its path, verb, request body and response shape checked against the ReaPrime handler as
 * the call is written, and the answer is recorded in `src/data/CONTRACTS.json` with the
 * handler symbol, the handler file and the commit it was checked at. The desk check stays
 * human. This file automates the two halves that can be automated, plus two that fall out
 * of having the table at all:
 *
 *   COVERAGE   a route string in the client with no table entry fails the build.
 *   STALENESS  a table entry whose checked-commit is not the pinned commit fails the build.
 *   SOURCE     the worktree the handlers are read from is AT the pin, and every entry's
 *              handler file still exists there, still registers that path, and still
 *              contains that symbol. (Coverage says the CLIENT is tabled; this says the
 *              TABLE is still true of the server.)
 *   RETIREMENT the spellings of the retired contract bugs appear nowhere in the client.
 *
 * WHY STALENESS IS A GATE AND NOT A CHORE. ReaPrime is EXPECTED to move under this build —
 * A2, and the R1–R8 work list. Contract drift is a certainty, not a risk. The stamp turns
 * "did anyone re-check?" from a question nobody asks into a diff.
 *
 * WHY THE SOURCE HALF RESOLVES THE WORKTREE'S HEAD FIRST. Staleness compares three strings
 * that all live in this repo — the table's pin, each row's stamp, and PINNED_COMMIT — so on
 * its own it proves only that the repo agrees with itself. It says nothing about the commit
 * the handlers were actually read at, and REA_ROOT is an environment variable. Without this
 * check a run against a DIFFERENT ReaPrime checkout re-verified 46 of 50 rows against the
 * wrong commit and printed the four route strings that happened to differ; a drift in a
 * response SHAPE — the drift A2 says is a certainty — would have printed "OK". So the tree
 * is resolved with `git rev-parse` and required to equal the pin BEFORE any row is read,
 * and a tree that is not the pin re-verifies nothing: a row "confirmed" against the wrong
 * commit is worse than a row nobody checked, because it carries a stamp saying otherwise.
 *
 * SCAN BY CONSTRUCTION, NOT BY ALLOWLIST — the Gate C rule, applied here. Coverage walks
 * every authored module under `src/`, finds route-shaped string literals and route ids in
 * CODE (comments stripped, so a module header may discuss a dead route in prose without
 * earning an exemption), and requires each to resolve to a row. The one thing a literal
 * scan cannot see is a path assembled from fragments, so there is a third scan for those:
 * any template literal that interpolates into a path is a violation UNLESS its file is
 * declared in the table's `constructedRouteBuilders`, naming the rows it builds. That list
 * is three entries, each checked to exist, and the canary proves an undeclared builder
 * fails. It is the one place this gate trusts a declaration over an enumeration, and it
 * says so rather than hiding it.
 *
 * EVERY GUARD SHIPS WITH A CANARY: `test/fixtures/gate-d/` violates each rule on purpose
 * and `test/gate-d.test.mjs` asserts each rule fails on it. All three of this project's
 * previous guard failures were guards that silently stopped covering their target.
 *
 * Usage:
 *   node scripts/gate-d.js              # human output, exit 1 on any violation
 *   node scripts/gate-d.js --json       # machine-readable, for the wave GATE agent
 *   node scripts/gate-d.js --no-source  # skip the ReaPrime worktree half (see below)
 *
 * The SOURCE half needs the pinned worktree. It is REQUIRED by default and its absence is
 * a failure rather than a silent skip — a check that quietly stops running is the exact
 * decay this gate exists to prevent. `--no-source` is for a machine that genuinely has no
 * ReaPrime checkout, and it prints what it did not do.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from './lib/source-scan.js';
import { PINNED_COMMIT, REA_ROOT, resolveReaCommit } from './lib/rea-source.js';

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Where the contract table lives. Part 3 §7 says "in the new repo"; it lives beside the
 *  client it gates, in the ReaPrime address layer. See src/data/CONTRACTS.md. */
export const TABLE_PATH = 'src/data/CONTRACTS.json';

/** Scan roots for the client. `test/` is excluded because its canaries break every rule on
 *  purpose; `vendor/` because it is not authored here. */
export const SCAN_ROOTS = ['src'];

/**
 * Files inside a scan root that are not the client.
 *
 * `rea-routes.generated.js` is the DOCUMENTED SURFACE — every path ReaPrime's own specs
 * carry, 143 of them. It is a table, not a caller. Requiring a contract row for all 143
 * would turn the contract table into a second copy of the generated one and destroy the
 * distinction the tables exist to keep: the generated table says what ReaPrime documents,
 * the contract table says what we checked and consume.
 */
export const SCAN_EXCLUDE = [
    'src/data/rea-routes.generated.js',
    'src/data/CONTRACTS.json',
];

const BASE_PREFIXES = new Set(['/api/v1', '/ws/v1', '/', '/api', '/ws']);

/* ------------------------------------------------------------------ the table */

export function loadTable(root = REPO_ROOT) {
    const path = join(root, TABLE_PATH);
    if (!existsSync(path)) {
        throw new Error(`Gate D: no contract table at ${TABLE_PATH}. Part 3 §7 requires one.`);
    }
    return JSON.parse(readFileSync(path, 'utf8'));
}

const isParamSegment = (s) => (s.startsWith('<') && s.endsWith('>')) || (s.startsWith('{') && s.endsWith('}'));

/** Match a concrete or templated path against a row's template. */
export function pathMatches(template, candidate) {
    const t = template.split('/');
    const c = candidate.split('?')[0].split('/');
    if (t.length !== c.length) return false;
    return t.every((seg, i) => (isParamSegment(seg) ? c[i].length > 0 : (isParamSegment(c[i]) ? true : seg === c[i])));
}

/** An index over the table: what a route string is allowed to be. */
export function buildIndex(table) {
    const rest = table.rest.map((r) => ({ ...r, templates: [r.route, r.path] }));
    const sockets = table.sockets.map((s) => ({ ...s }));
    const ids = new Set(rest.map((r) => r.id));
    return {
        rest,
        sockets,
        ids,
        /** The rows a bare path string could be. A bare literal carries no verb, so any
         *  verb on that path satisfies coverage — the claim is "this address is tabled". */
        matchPath(value) {
            if (value.startsWith('/ws/v1')) {
                return sockets.filter((s) => pathMatches(s.path, value));
            }
            const bare = value.startsWith('/api/v1') ? value.slice('/api/v1'.length) : value;
            return rest.filter((r) => pathMatches(r.route, bare) || pathMatches(r.path, value));
        },
    };
}

/* ------------------------------------------------------------- source scanning */

/**
 * Every string literal in a chunk of JavaScript, with a flag for template interpolation.
 *
 * `stripComments` runs first, so a route named in prose is invisible here. That is the
 * rule the whole scan family shares: a name USED is not a name DISCUSSED.
 */
export function extractStringLiterals(source) {
    const code = stripComments(source);
    const out = [];
    let i = 0;
    while (i < code.length) {
        const c = code[i];
        if (c !== "'" && c !== '"' && c !== '`') { i += 1; continue; }
        const quote = c;
        let value = '';
        let interpolated = false;
        let j = i + 1;
        let depth = 0;
        for (; j < code.length; j += 1) {
            const ch = code[j];
            if (ch === '\\') { value += code[j + 1] ?? ''; j += 1; continue; }
            if (quote === '`' && ch === '$' && code[j + 1] === '{') { interpolated = true; depth += 1; j += 1; continue; }
            if (depth > 0) { if (ch === '}') depth -= 1; continue; }
            if (ch === quote) break;
            if (quote !== '`' && ch === '\n') break;
            value += ch;
        }
        out.push({ value, quote, interpolated, index: i });
        i = j + 1;
    }
    return out;
}

const looksLikeRoute = (v) => /^\/[A-Za-z0-9<{]/.test(v) && !/\s/.test(v) && v.length > 1;

/** Route-shaped literals a module addresses, excluding the bare base prefixes. */
export function collectRouteStrings(source) {
    return extractStringLiterals(source)
        .filter((s) => !s.interpolated && looksLikeRoute(s.value) && !BASE_PREFIXES.has(s.value))
        .map((s) => s.value);
}

const ID_PATTERNS = [
    /\bcallRoute\s*\(\s*[^,()]+,\s*['"]([A-Za-z0-9_]+)['"]/g,
    /\bcall\s*\(\s*['"]([A-Za-z0-9_]+)['"]/g,
    /\brouteById\s*\(\s*['"]([A-Za-z0-9_]+)['"]/g,
    /\brouteId\s*:\s*['"]([A-Za-z0-9_]+)['"]/g,
];

/** Generated-table route ids the module addresses. Addressing by id never spells a path,
 *  so a path-only scan would see none of it. */
export function collectRouteIds(source) {
    const code = stripComments(source);
    const ids = new Set();
    for (const rx of ID_PATTERNS) {
        rx.lastIndex = 0;
        let m = rx.exec(code);
        while (m) { ids.add(m[1]); m = rx.exec(code); }
    }
    return [...ids];
}

/**
 * Template literals that interpolate into something path-shaped.
 *
 * The shape test is deliberately structural rather than a keyword list: a path has no
 * newline, no `;` and no `{`, which is exactly what separates it from the `css` tagged
 * template every component carries (those interpolate token names into CSS containing all
 * three). Narrowing by "does it mention a known route word" would be the allowlist mistake
 * one level down — it would pass a constructed route the table has never heard of, which
 * is the only kind this scan exists to catch.
 */
export function collectConstructedPaths(source) {
    const pathShaped = (v) => v.includes('/') && !/[\n;{]/.test(v) && v.length < 200;
    return extractStringLiterals(source)
        .filter((s) => s.quote === '`' && s.interpolated && pathShaped(s.value))
        .map((s) => s.value);
}

export function collectFiles(root = REPO_ROOT, { roots = SCAN_ROOTS, exclude = SCAN_EXCLUDE } = {}) {
    const excluded = new Set(exclude.map((p) => resolve(root, p)));
    const files = [];
    const walk = (dir) => {
        for (const entry of readdirSync(dir).sort()) {
            const full = join(dir, entry);
            if (excluded.has(full)) continue;
            if (statSync(full).isDirectory()) { walk(full); continue; }
            if (!full.endsWith('.js')) continue;
            files.push({ path: relative(root, full), source: readFileSync(full, 'utf8') });
        }
    };
    for (const r of roots) {
        const full = resolve(root, r);
        if (!existsSync(full)) continue;
        if (statSync(full).isDirectory()) walk(full); else files.push({ path: r, source: readFileSync(full, 'utf8') });
    }
    return files;
}

/* ------------------------------------------------------------------ the checks */

const violation = (rule, file, detail, fix) => ({ rule, file, detail, fix });

/** COVERAGE — a route string, or a route id, in the client with no table entry. */
export function checkCoverage(files, table) {
    const index = buildIndex(table);
    const builders = new Map((table.constructedRouteBuilders || []).map((b) => [b.file, b]));
    const out = [];
    for (const { path, source } of files) {
        for (const value of collectRouteStrings(source)) {
            if (index.matchPath(value).length === 0) {
                out.push(violation('coverage-route-string', path,
                    `route string "${value}" has no entry in ${TABLE_PATH}`,
                    'check the path and verb against the ReaPrime handler AS WRITTEN, then add the row with handlerSymbol, handlerFile and checkedCommit.'));
            }
        }
        for (const id of collectRouteIds(source)) {
            if (!index.ids.has(id)) {
                out.push(violation('coverage-route-id', path,
                    `route id "${id}" is addressed here and has no entry in ${TABLE_PATH}`,
                    'a generated-table id is an address like any other; table it before calling it.'));
            }
        }
        const constructed = collectConstructedPaths(source);
        if (constructed.length && !builders.has(path)) {
            out.push(violation('coverage-constructed-path', path,
                `${constructed.length} path(s) assembled from fragments (e.g. \`${constructed[0].slice(0, 60)}\`) in a file that is not a declared route builder`,
                `spell the route through the generated table (callRoute), or declare this file in constructedRouteBuilders naming the rows it builds and why it cannot.`));
        }
    }
    return out;
}

/** STALENESS — an entry checked at a commit that is not the pin. */
export function checkStaleness(table, pin = PINNED_COMMIT) {
    const out = [];
    if (table.pinnedCommit !== pin) {
        out.push(violation('staleness-table-pin', TABLE_PATH,
            `table pinnedCommit ${table.pinnedCommit} != scripts/lib/rea-source.js PINNED_COMMIT ${pin}`,
            're-pin deliberately, and re-check every row against the new commit before stamping it.'));
    }
    for (const row of [...table.rest, ...table.sockets]) {
        if (row.checkedCommit !== pin) {
            out.push(violation('staleness-row', TABLE_PATH,
                `${row.id}: checkedCommit ${row.checkedCommit} != pinned ${pin}`,
                'open the handler at the new commit, re-check path/verb/body/response, then stamp it.'));
        }
    }
    return out;
}

const symbolOf = (handlerSymbol) => {
    const tail = handlerSymbol.split('.').pop();
    const m = /_?[A-Za-z][A-Za-z0-9_]*/.exec(tail);
    return m ? m[0] : null;
};

const dartTemplate = (path) => path.replace(/\{([^}]+)\}/g, '<$1>');

/**
 * The one registration shape a literal search cannot see: a handler that registers ONE
 * parameterised route and switches on the last segment.
 *
 *     app.put('/api/v1/scale/<command>', (request, command) async {
 *       switch (command) { case 'tare': ... }
 *
 * The OpenAPI table enumerates the concrete commands — `/api/v1/scale/tare` — because
 * that is what a client calls, so the row carries the concrete path and the source half
 * would otherwise report it as unregistered. The KV-store rows do not hit this because
 * their generated routes are parameterised too, and both halves agree.
 *
 * DELIBERATELY NARROW, AND IT ASKS FOR MORE THAN THE PATH. Exactly one trailing segment
 * may be swapped for a parameter, and the handler must ALSO name the command in a
 * `case` — so a route that merely shares a prefix with a parameterised one is still a
 * violation, and a command the handler does not implement is still a violation. That is
 * the property the check is for: the table may not claim a route the source does not
 * serve.
 */
function registeredByCommandSwitch(text, template) {
    const at = template.lastIndexOf('/');
    if (at <= 0) return false;
    const parent = template.slice(0, at);
    const command = template.slice(at + 1);
    if (!command || command.startsWith('<')) return false;
    const registered = new RegExp(`'${parent.replace(/[.*+?^$()|[\]\\]/g, '\\$&')}/<[^>]+>'`);
    if (!registered.test(text)) return false;
    return new RegExp(`case\\s+'${command.replace(/[.*+?^$()|[\]\\]/g, '\\$&')}'`).test(text);
}

/**
 * THE SECOND REGISTRATION SHAPE A LITERAL SEARCH CANNOT SEE: a handler that registers ONE
 * CATCH-ALL and a spec that documents a concrete path underneath it.
 *
 *     app.get('/api/v1/account/proxy/<rest|.*>', _handleGet);
 *
 * against a row whose path is `/api/v1/account/proxy/support/api/{endpoint}`. The spec
 * documents the narrower form ON PURPOSE and says so in its own prose: "the runtime route
 * is a catch-all under `/api/v1/account/proxy/`, but OpenAPI documents this single-segment
 * `support/api` form so generated clients do not encode slash-containing path parameters
 * incorrectly". A generated client that emitted the catch-all would percent-encode the
 * slashes in `support/api/email` into one path segment, and the proxy — which splits the
 * decoded path on `/` and matches it against an allowlist prefix — would answer 403.
 *
 * So the table carries the documented path, the handler carries the catch-all, and both
 * are right. This is the same class of accommodation as `registeredByCommandSwitch` above,
 * one axis over: there the table is NARROWER at the tail than the registration and the
 * handler proves the tail with a `case`; here the table is DEEPER than the registration and
 * the catch-all's own regex marker proves it swallows the rest.
 *
 * DELIBERATELY NARROW, ON THE SAME PRINCIPLE. It accepts only a registration whose LAST
 * segment is an explicit regex catch-all — a parameter carrying a `|`, which is Dart
 * shelf_router's syntax for "match this pattern" and is how `<rest|.*>` differs from an
 * ordinary `<id>`. A plain `<id>` segment matches ONE segment and cannot stand for a deeper
 * path, so it is not accepted here and a row claiming depth under one is still a violation.
 * And the row's path must lie strictly UNDER the catch-all's prefix: sharing a prefix is not
 * enough, `/api/v1/account/proxyother/x` does not match `/api/v1/account/proxy/<rest|.*>`.
 *
 * WHAT THIS DOES NOT CHECK, said plainly rather than left to be discovered. A catch-all
 * accepts every path beneath it, so this check cannot tell a row that names a real upstream
 * endpoint from one that names an imaginary one — the server would route both to the same
 * handler. That judgement is the desk check's, and for this route it is written out in the
 * row's own `notes`: `support/api/email` is corroborated inside ReaPrime, `support/api/emails`
 * is corroborated only by Slate, and the row says which is which.
 */
function registeredByCatchAll(text, template) {
    for (const match of text.matchAll(/'((?:\/(?:api|ws)\/v1)[^']*)\/<[^>|]+\|[^>]*>'/g)) {
        const prefix = match[1];
        if (template.startsWith(`${prefix}/`)) return true;
    }
    return false;
}

/**
 * The tree the SOURCE half reads, and whether it is the pin.
 *
 * Returns `{ head, violation }`. `head` is the resolved commit, or null when it could not be
 * resolved at all — which is a violation and never a skip. `resolveReaCommit` is called with
 * `require: false` so the mismatch arrives as a violation like every other finding, rather
 * than a throw that would take the coverage and retirement halves down with it.
 */
export function resolveReaWorktree({ reaRoot = REA_ROOT, pin = PINNED_COMMIT } = {}) {
    if (!existsSync(reaRoot)) {
        return {
            head: null,
            violation: violation('source-worktree-missing', reaRoot,
                'the pinned ReaPrime worktree is not present, so no table entry can be re-verified',
                'set REA_ROOT to a checkout at the pinned commit, or pass --no-source and say so in the record.'),
        };
    }
    let head;
    try {
        head = resolveReaCommit({ reaRoot, require: false });
    } catch (e) {
        return {
            head: null,
            violation: violation('source-worktree-commit', reaRoot,
                `cannot resolve the ReaPrime worktree's HEAD (${e.message}), so no table entry can be re-verified against the pin`,
                'point REA_ROOT at a git checkout of ReaPrime at the pinned commit.'),
        };
    }
    if (head !== pin) {
        return {
            head,
            violation: violation('source-worktree-commit', reaRoot,
                `worktree HEAD ${head} is not the pinned ${pin}: every row would be re-verified against the wrong commit, so none was`,
                'check out the pinned commit, or re-pin deliberately and re-check every row against the new commit before stamping it.'),
        };
    }
    return { head, violation: null };
}

/** SOURCE — the table is still true of the server at the pin. */
export function checkSource(table, reaRoot = REA_ROOT, pin = PINNED_COMMIT, worktree = null) {
    const out = [];
    const tree = worktree || resolveReaWorktree({ reaRoot, pin });
    if (tree.violation) return [tree.violation];
    const cache = new Map();
    const read = (rel) => {
        if (!cache.has(rel)) {
            const full = join(reaRoot, rel);
            cache.set(rel, existsSync(full) ? readFileSync(full, 'utf8') : null);
        }
        return cache.get(rel);
    };
    for (const row of [...table.rest, ...table.sockets]) {
        const text = read(row.handlerFile);
        if (text === null) {
            out.push(violation('source-handler-file', TABLE_PATH,
                `${row.id}: handlerFile ${row.handlerFile} does not exist at the pin`, 're-anchor the row by symbol.'));
            continue;
        }
        const template = dartTemplate(row.path);
        if (!text.includes(`'${template}'`)
            && !registeredByCommandSwitch(text, template)
            && !registeredByCatchAll(text, template)) {
            out.push(violation('source-route-registration', TABLE_PATH,
                `${row.id}: ${row.handlerFile} does not register '${template}'`,
                'the route moved handlers, or the path is wrong. Find it before changing the row.'));
        }
        const symbol = symbolOf(row.handlerSymbol);
        if (symbol && !text.includes(symbol)) {
            out.push(violation('source-handler-symbol', TABLE_PATH,
                `${row.id}: symbol "${symbol}" not found in ${row.handlerFile}`,
                're-anchor by symbol — line numbers and names both move.'));
        }
    }
    return out;
}

/** RETIREMENT — the spelling of a retired contract bug, back in the client. */
export function checkRetirement(files, table) {
    const rules = (table.forbiddenSpellings || []).filter((f) => !f.invert);
    const out = [];
    for (const { path, source } of files) {
        const code = stripComments(source);
        for (const rule of rules) {
            const rx = new RegExp(rule.pattern);
            if (rx.test(code)) {
                out.push(violation('retirement-spelling', path,
                    `${rule.bug}: /${rule.pattern}/ appears in code — ${rule.why}`,
                    `the checked contract is table row "${rule.truth}".`));
            }
        }
    }
    return out;
}

/** INTEGRITY — the table itself is well formed and self-consistent. */
export function checkTableIntegrity(table, root = REPO_ROOT) {
    const out = [];
    const required = ['id', 'path', 'verb', 'requestFields', 'responseShape', 'handlerSymbol', 'handlerFile', 'checkedCommit', 'status'];
    const statuses = new Set(Object.keys(table.statusMeanings || {}));
    const ids = new Set();
    for (const row of table.rest) {
        for (const key of required) {
            if (row[key] === undefined) out.push(violation('table-shape', TABLE_PATH, `${row.id || '(no id)'}: missing column "${key}"`, 'every row carries all nine columns.'));
        }
        if (!statuses.has(row.status)) out.push(violation('table-shape', TABLE_PATH, `${row.id}: status "${row.status}" is not one of ${[...statuses].join(', ')}`, ''));
        if (row.status === 'consumed' && (!row.consumedBy || row.consumedBy.length === 0)) {
            out.push(violation('table-shape', TABLE_PATH, `${row.id}: status "consumed" with no consumedBy`, 'name the caller, or the row is "recorded".'));
        }
        if (ids.has(`${row.verb} ${row.route}`)) out.push(violation('table-shape', TABLE_PATH, `${row.verb} ${row.route}: duplicate row`, ''));
        ids.add(`${row.verb} ${row.route}`);
    }
    for (const row of table.sockets) {
        for (const key of ['id', 'path', 'handlerSymbol', 'handlerFile', 'checkedCommit', 'status']) {
            if (row[key] === undefined) out.push(violation('table-shape', TABLE_PATH, `socket ${row.id || '(no id)'}: missing "${key}"`, ''));
        }
    }
    const restIds = new Set(table.rest.map((r) => r.id));
    const rowIds = new Set([...restIds, ...table.sockets.map((s) => s.id)]);
    for (const b of table.constructedRouteBuilders || []) {
        if (!existsSync(join(root, b.file))) {
            out.push(violation('table-shape', TABLE_PATH, `constructedRouteBuilders names ${b.file}, which does not exist`,
                'a declaration pointing at a file nobody has, while covering one everybody has, is the old colour guard\'s exact failure.'));
        }
        for (const id of b.builds) {
            if (!rowIds.has(id)) out.push(violation('table-shape', TABLE_PATH, `${b.file} declares it builds "${id}", which is not a row`, ''));
        }
    }
    for (const f of table.forbiddenSpellings || []) {
        if (!restIds.has(f.truth)) out.push(violation('table-shape', TABLE_PATH, `forbiddenSpellings ${f.bug} names truth row "${f.truth}", which does not exist`, ''));
    }
    return out;
}

/**
 * AGREEMENT — every table id that also exists in the generated table has the same method
 * and path there. Two tables about the same server MUST agree, and the check is cheap.
 */
export async function checkGeneratedAgreement(table, root = REPO_ROOT) {
    const generated = await import(new URL('file://' + join(root, 'src/data/rea-routes.generated.js')).href);
    const byId = generated.REST_ROUTE_BY_ID;
    const byRoute = generated.SOCKET_CHANNEL_BY_ROUTE;
    const out = [];
    for (const row of table.rest) {
        const g = byId[row.id];
        if (!g) {
            out.push(violation('generated-agreement', TABLE_PATH,
                `${row.id} is not an id in the generated table — ReaPrime does not document it at the pin`,
                'either the id is misspelled, or the route is undocumented and the row must say so explicitly.'));
            continue;
        }
        if (g.method !== row.verb || g.route !== row.route) {
            out.push(violation('generated-agreement', TABLE_PATH,
                `${row.id}: table says ${row.verb} ${row.route}, generated table says ${g.method} ${g.route}`, 'the handler decides; fix whichever is wrong.'));
        }
    }
    for (const row of table.sockets) {
        if (!byRoute[row.path]) {
            out.push(violation('generated-agreement', TABLE_PATH, `socket ${row.path} is not in the generated channel table`, ''));
        }
    }
    return out;
}

/* ------------------------------------------------------------------- the gate */

export async function runGateD({ root = REPO_ROOT, table = null, files = null, reaRoot = REA_ROOT, source = true, pin = PINNED_COMMIT } = {}) {
    const t = table || loadTable(root);
    const f = files || collectFiles(root);
    // Resolved once, so the head the run REPORTS is the head the check was made against.
    const worktree = source ? resolveReaWorktree({ reaRoot, pin }) : null;
    const violations = [
        ...checkTableIntegrity(t, root),
        ...checkCoverage(f, t),
        ...checkStaleness(t, pin),
        ...checkRetirement(f, t),
        ...(source ? checkSource(t, reaRoot, pin, worktree) : []),
        ...(await checkGeneratedAgreement(t, root)),
    ];
    return {
        ok: violations.length === 0,
        counts: {
            restRows: t.rest.length,
            socketRows: t.sockets.length,
            consumed: t.rest.filter((r) => r.status === 'consumed').length,
            declared: t.rest.filter((r) => r.status === 'declared').length,
            recorded: t.rest.filter((r) => r.status === 'recorded').length,
            gates: t.rest.reduce((n, r) => n + (r.gates ? r.gates.length : 0), 0),
            filesScanned: f.length,
            sourceChecked: source,
            pin,
            reaRoot: source ? reaRoot : null,
            reaHead: worktree ? worktree.head : null,
        },
        violations,
    };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) {
    const json = process.argv.includes('--json');
    const source = !process.argv.includes('--no-source');
    const report = await runGateD({ source });
    if (json) {
        console.log(JSON.stringify(report, null, 2));
    } else {
        const c = report.counts;
        console.log(`Gate D — contract table (${TABLE_PATH})`);
        console.log(`  ${c.restRows} REST rows (${c.consumed} consumed / ${c.declared} declared / ${c.recorded} recorded), ${c.socketRows} socket rows, ${c.gates} handler-body gates`);
        console.log(`  pin ${c.pin}`);
        // What tree the handlers were read from, and what commit it is actually at — the
        // pin above is three strings in this repo agreeing with each other.
        console.log(source
            ? `  worktree ${c.reaRoot} at ${c.reaHead || 'UNRESOLVED'}`
            : '  worktree NOT READ (--no-source)');
        console.log(`  ${c.filesScanned} client files scanned${source ? '' : '  — SOURCE CHECK SKIPPED (--no-source): no entry was re-verified against a handler this run'}`);
        if (report.ok) {
            console.log(source
                ? '  OK — coverage, staleness, retirement, and source re-verified against a worktree at the pin'
                : '  OK — coverage, staleness and retirement clean; source NOT checked');
        } else {
            console.log(`  ${report.violations.length} VIOLATION(S)`);
            for (const v of report.violations) console.log(`    [${v.rule}] ${v.file}: ${v.detail}${v.fix ? `\n        -> ${v.fix}` : ''}`);
        }
    }
    process.exit(report.ok ? 0 : 1);
}
