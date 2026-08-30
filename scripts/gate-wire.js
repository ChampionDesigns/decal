#!/usr/bin/env node
/**
 * gate-wire.js — the dead-wire gate (Wave 0, `_audit/CONTROL_AUDIT_PLAN_2026-08-29.md` §5;
 * built to `_audit/wave-0-plan.md` §2).
 *
 * WHAT IT IS FOR. Every control fault this project has found was found by Ben pressing a
 * button, and the cheapest of those faults is kind 1: the control emits an event and
 * NOBODY LISTENS. A component suite cannot see it — driven alone, an unheard event IS the
 * correct outcome — because the wire is missing one layer up and no test looks at the wire.
 * This gate looks at the wire, statically, across the whole of `src/`.
 *
 * WHAT IT REPORTS — EVENT NAMES, NOT OUTCOMES (plan §5). Two verdicts and one refusal:
 *
 *   DEAD WIRE / unheard emit      a name dispatched somewhere in src/ and heard nowhere.
 *   DEAD WIRE / orphan listener   a name listened for somewhere in src/ and emitted nowhere.
 *   UNRESOLVED                    an event-name POSITION whose value this gate will not guess.
 *
 * MATCHING IS BY NAME ACROSS THE WHOLE OF `src/`, one flat namespace, no target-graph
 * analysis. That is deliberately generous: an emit anywhere heard anywhere passes. So a
 * green name is WEAK evidence — whether the listener is on a target the event can reach is
 * Wave 3's question — but a red name is STRONG: nothing in the skin can hear it.
 *
 * UNRESOLVED IS A FIRST-CLASS FAILING CATEGORY, and that is the design decision that keeps
 * the gate honest. The indirection is the whole difficulty here (plan §5): a naive scan
 * calls a table-driven registration unheard and cries wolf, and a scan that ignores
 * indirection misses the real ones. So this gate resolves the four simple shapes below and
 * REFUSES THE REST OUT LOUD, with file:line and the offending expression. A refusal is never
 * silently dropped into pass or into fail.
 *
 * ── WHAT IS IN SCOPE ────────────────────────────────────────────────────────────────────
 *
 * All `.js` under `src/`. Not `vendor/`, not `tools/`, not `test/`, not `index.html`.
 * DOM event plumbing only:
 *
 *   emit side    `new CustomEvent(NAME, …)` and `new Event(NAME, …)` on any target —
 *                `this`, an element, `window`/`globalThis`, `document` — including through
 *                `#emit`-style wrappers (see WRAPPERS). Every construction counts, not only
 *                one inside a `dispatchEvent(…)`: the two are the same act one line apart,
 *                and `dispatchEvent?.(new CustomEvent(FIT_EVENT, …))` (`src/lib/app-fit.js`)
 *                is already written the second way.
 *   heard side   `addEventListener(NAME, …)` and `addEventListener?.(NAME, …)` on any
 *                target, lit template bindings `@name=${…}`, and table/array-driven
 *                registration loops.
 *
 * OUT OF SCOPE, BY DESIGN: store subscriptions, the WS `fanout` signal bus, `postMessage`,
 * `on<event>` handler properties (builtin-only anyway), and `removeEventListener` — A REMOVE
 * IS NOT A HEARING, so only `addEventListener` and bindings put a name in the heard set.
 *
 * ── WHAT IT RESOLVES, AND THE POSITION RULE ─────────────────────────────────────────────
 *
 * Per file, over `stripComments(source)` — comments out, STRINGS KEPT, because event names
 * live in strings and `@fires` prose, module headers and commented-out code must not count:
 *
 *   1. top-level string constants   `const NAME = 'lit'` / `export const NAME = 'lit'`
 *   2. simple tables                `Object.freeze({K: 'lit', …})`, `Object.freeze(['a','b'])`
 *                                   and the unfrozen equivalents. EVERY value must be a
 *                                   string literal; one that is not makes the table opaque.
 *   3. imports                      `import { A, B as C } from 'spec'`, `spec` resolved
 *                                   relatively or through the import map's `src/` → `./src/`
 *                                   prefix (`index.html`). A BARE specifier is vendor code:
 *                                   the name is external and any position using it is
 *                                   UNRESOLVED, never guessed.
 *   4. member access                `TABLE.KEY` and `Object.values(TABLE)` against (2).
 *
 * THE POSITION RULE. A string becomes an event name ONLY by appearing in an event-name
 * POSITION: the first argument of `CustomEvent` / `Event` / `addEventListener` — directly,
 * through a resolved constant, through a resolved wrapper, or through a resolved loop
 * variable — or a lit `@`-binding. A table is NEVER classified as an event-name table by its
 * shape or by its name. That one rule is what keeps `STEP_ACTIONS` (`src/lib/editor-draft.js`
 * — action ids that ride in `detail`, not event names) out of the name universe without a
 * special case for it, and it is plan §5's "resolve simple frozen tables, refuse the rest"
 * in mechanical form.
 *
 * ── WRAPPERS, AND THE DECOY ─────────────────────────────────────────────────────────────
 *
 * A method is an emit wrapper IFF its body constructs `new CustomEvent(P, …)` (or
 * `new Event(P, …)`) where P is THAT METHOD'S FIRST PARAMETER. Then every call site
 * `this.#name(ARG, …)` in the same file puts ARG in event-name position. One level only: a
 * wrapper that forwards into another wrapper resolves to nothing and is UNRESOLVED.
 *
 * THE CHECK IS ON THE TYPE ARGUMENT, NOT ON THE SHAPE, BECAUSE ONE OF THEM IS A DECOY.
 * `src/components/ui-compare-bar.js` `#emit(reason)` looks exactly like the other six
 * wrappers and is not one: it dispatches the FIXED literal `'offset-change'` and puts
 * `reason` in `detail`. Its call-site arguments — `'slot-change'`, `'slide'`, `'reset'` —
 * are not event names, and a wrapper detector that matched on shape would inject three
 * imaginary events into the universe and then report them dead. `test/gate-wire.test.mjs`
 * carries that exact shape as a required canary.
 *
 * ── WHAT IT DELIBERATELY CANNOT SEE ─────────────────────────────────────────────────────
 *
 * BUILTIN NAMES ARE EXCLUDED FROM BOTH SETS. `BUILTIN_EVENTS` below is fixed and visible.
 * `cancel`, `close` and `open` are ALSO used here as custom names (the `ui-dialog` idiom) —
 * that is fine, because excluding a name from both sets means it can never be flagged and
 * can never mask a non-builtin name. SAID PLAINLY: a CustomEvent deliberately named like a
 * builtin is INVISIBLE to this gate. THE LIST IS FIXED AT SHIP TIME. Growing it later to
 * silence a finding is a rule change and is Ben's call, not a worker's.
 *
 * NAME MATCHING IS NOT DELIVERY. A listener on an element the event never reaches, a
 * `composed: false` event crossing a shadow boundary, a listener added after the emit —
 * all of those are green here and all of them are Wave 3's.
 *
 * LINE NUMBERS ARE LOCATED, NOT COMPUTED. The scan runs on comment-stripped text, whose
 * offsets do not line up with the file's (`stripComments` drops the newlines inside a block
 * comment). So each site is located by searching the ORIGINAL source for the exact text the
 * scanner matched, with a per-pattern cursor that only moves forward. Exact in every normal
 * case; if a file contains COMMENTED-OUT code byte-identical to a real site above it, the
 * line reported can be the commented one. The NAME and the FILE are unaffected — only the
 * line — and `exact: false` is carried in the JSON so a reader can tell.
 *
 * ── FALSE POSITIVES GET A LEDGER, NOT A LOOSENED RULE ───────────────────────────────────
 *
 * `tools/wire-ledger.json` (absent = empty) vouches ONE reported wire as deliberate — an
 * event consumed outside `src/`, or an indirection verified by hand — with a reason a reader
 * can check. A TRUE dead wire never gets an entry; it gets a `FINDINGS.md` entry and the
 * gate stays red, because the audit RECORDS, it does not repair (plan §9). A vouched entry
 * that matches no current violation is STALE and FAILS: an exemption must never outlive its
 * excuse. Same idiom as `mock-contract`'s vouching, and for the same reason — a rule relaxed
 * to stay green stops meaning anything.
 *
 * EVERY GUARD SHIPS WITH A CANARY. `test/fixtures/gate-wire/` breaks each rule on purpose
 * and `test/gate-wire.test.mjs` asserts each rule fires on it, plus the controls that prove
 * it does not over-fire. All three of this project's previous guard failures were guards
 * that silently stopped covering their target.
 *
 * Usage:
 *   node scripts/gate-wire.js          # human output; exit 1 on a dead wire, an unresolved
 *                                      # position, or a stale ledger entry
 *   node scripts/gate-wire.js --json   # machine-readable, for the wave's verifying worker
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from './lib/source-scan.js';

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** The scan root. `src/` only — plan §2.1. */
export const SCAN_ROOTS = ['src'];

/** Vouched exceptions. Absent is an empty ledger, never an error. */
export const LEDGER_PATH = 'tools/wire-ledger.json';

/**
 * The standard DOM/UI names, excluded from BOTH the emitted and the heard set.
 *
 * FIXED AT SHIP TIME. This list is the gate's one allowlist and it is written out in full so
 * that adding to it is a visible diff. Growing it to make a finding go away is a rule change
 * (plan §6) and is Ben's call.
 */
export const BUILTIN_EVENTS = new Set([
    'abort', 'animationend', 'animationiteration', 'animationstart',
    'beforeinput', 'beforetoggle', 'beforeunload', 'blur',
    'cancel', 'change', 'click', 'close', 'contextmenu', 'copy', 'cut',
    'dblclick', 'drag', 'dragend', 'dragenter', 'dragleave', 'dragover', 'dragstart', 'drop',
    'error', 'focus', 'focusin', 'focusout', 'fullscreenchange',
    'gotpointercapture', 'hashchange', 'input', 'invalid',
    'keydown', 'keypress', 'keyup', 'load', 'loadeddata', 'loadedmetadata',
    'lostpointercapture', 'message', 'mousedown', 'mouseenter', 'mouseleave', 'mousemove',
    'mouseout', 'mouseover', 'mouseup', 'offline', 'online', 'open', 'paste',
    'pointercancel', 'pointerdown', 'pointerenter', 'pointerleave', 'pointermove',
    'pointerout', 'pointerover', 'pointerup', 'popstate', 'progress',
    'reset', 'resize', 'scroll', 'scrollend', 'securitypolicyviolation', 'select',
    'slotchange', 'storage', 'submit', 'toggle',
    'touchcancel', 'touchend', 'touchmove', 'touchstart',
    'transitioncancel', 'transitionend', 'transitionrun', 'transitionstart',
    'unload', 'visibilitychange', 'wheel',
]);

/* How far past a wrapper's `{` the type argument may sit before the body is considered
 * over. The wrappers in this tree dispatch in their first or second statement. */
const WRAPPER_BODY_LIMIT = 2000;

/* How far past a `for (const X of …)` header a registration may sit and still be read as
 * that loop's body. Scope is approximated by proximity — this gate does no scope analysis —
 * and the failure is LOUD: a registration further away than this resolves to nothing and is
 * reported UNRESOLVED rather than quietly counted as heard. */
const LOOP_BODY_WINDOW = 600;

/* How much of a `const NAME = …` right-hand side is examined. Every event-name table in
 * this tree is a flat handful of short literals; a declaration whose value does not finish
 * inside this window is OPAQUE, which costs a refusal, never a wrong name. */
const CONST_VALUE_WINDOW = 600;

/* ------------------------------------------------------------------ file collection */

export function collectFiles(root = REPO_ROOT, { roots = SCAN_ROOTS } = {}) {
    const files = [];
    const walk = (dir) => {
        for (const entry of readdirSync(dir).sort()) {
            const full = join(dir, entry);
            if (statSync(full).isDirectory()) { walk(full); continue; }
            if (!full.endsWith('.js')) continue;
            files.push({ path: relative(root, full), source: readFileSync(full, 'utf8') });
        }
    };
    for (const r of roots) {
        const full = resolve(root, r);
        if (!existsSync(full)) continue;
        if (statSync(full).isDirectory()) walk(full);
        else files.push({ path: r, source: readFileSync(full, 'utf8') });
    }
    return files;
}

/* --------------------------------------------------------------------- small helpers */

/**
 * The index of the `)` / `]` / `}` closing the bracket at `open`.
 *
 * Quote-aware, because the scan runs on comment-stripped text with the STRINGS KEPT. This is
 * bracket matching, not lexing — `stripComments` (`scripts/lib/source-scan.js`) is this
 * project's one lexer and it has already run. Returns -1 if the bracket never closes.
 */
export function matchBracket(code, open) {
    const pairs = { '(': ')', '[': ']', '{': '}' };
    const close = pairs[code[open]];
    if (!close) return -1;
    let depth = 0;
    let quote = null;
    for (let i = open; i < code.length; i += 1) {
        const c = code[i];
        if (quote) {
            if (c === '\\') { i += 1; continue; }
            if (c === quote) quote = null;
            continue;
        }
        if (c === "'" || c === '"' || c === '`') { quote = c; continue; }
        if (c === '(' || c === '[' || c === '{') depth += 1;
        else if (c === ')' || c === ']' || c === '}') {
            depth -= 1;
            if (depth === 0) return c === close ? i : -1;
        }
    }
    return -1;
}

/**
 * Where a site is in the ORIGINAL file.
 *
 * See the header note on line numbers. One cursor per pattern channel, moving forward only,
 * so the n-th match of a pattern in the stripped text is looked for at or after the (n-1)-th
 * match's position in the source.
 */
export function lineLocator(source) {
    const starts = [0];
    for (let i = 0; i < source.length; i += 1) if (source[i] === '\n') starts.push(i + 1);
    const lineOf = (idx) => {
        let lo = 0;
        let hi = starts.length - 1;
        while (lo < hi) {
            const mid = (lo + hi + 1) >> 1;
            if (starts[mid] <= idx) lo = mid; else hi = mid - 1;
        }
        return lo + 1;
    };
    const cursors = new Map();
    return function locate(channel, text) {
        const from = cursors.get(channel) || 0;
        const at = text ? source.indexOf(text, from) : -1;
        if (at < 0) return { line: lineOf(from), exact: false };
        cursors.set(channel, at + 1);
        return { line: lineOf(at), exact: true };
    };
}

/* ------------------------------------------------------------------- declarations */

const STRING_VALUE = /^(['"])((?:\\.|(?!\1)[^\\\n])*)\1\s*(?=[;,)\]}\n])/;

function tableFromObjectBody(body) {
    const entries = new Map();
    for (const part of body.split(',').map((s) => s.trim()).filter(Boolean)) {
        const m = /^(?:([A-Za-z_$][\w$]*)|'([^']*)'|"([^"]*)")\s*:\s*(['"])([^'"]*)\4$/.exec(part);
        if (!m) return { kind: 'opaque' };
        entries.set(m[1] ?? m[2] ?? m[3], m[5]);
    }
    if (entries.size === 0) return { kind: 'opaque' };
    return { kind: 'object', entries, values: [...entries.values()] };
}

function tableFromArrayBody(body) {
    const values = [];
    for (const part of body.split(',').map((s) => s.trim()).filter(Boolean)) {
        const m = /^(['"])([^'"]*)\1$/.exec(part);
        if (!m) return { kind: 'opaque' };
        values.push(m[2]);
    }
    if (values.length === 0) return { kind: 'opaque' };
    return { kind: 'array', values };
}

/**
 * What a `const NAME = …` is worth to this gate: a string, a flat table of strings, or
 * OPAQUE. Opaque is not an error here — it becomes UNRESOLVED only if a name position ever
 * uses it, which is the position rule doing its job.
 */
export function classifyValue(tail) {
    let m = STRING_VALUE.exec(tail);
    if (m) return { kind: 'string', value: m[2] };
    m = /^Object\.freeze\(\s*\{([^{}[\]]*)\}\s*\)/.exec(tail) || /^\{([^{}[\]]*)\}\s*[;,\n]/.exec(tail);
    if (m) return tableFromObjectBody(m[1]);
    m = /^Object\.freeze\(\s*\[([^{}[\]]*)\]\s*\)/.exec(tail) || /^\[([^{}[\]]*)\]\s*[;,\n]/.exec(tail);
    if (m) return tableFromArrayBody(m[1]);
    return { kind: 'opaque' };
}

/* Anchored on the literal `const` rather than on a start-of-statement character class, so
 * the engine can prefilter on the word: the class alternation cost 50 ms over 6 MB of src/
 * and bought nothing — `const {` and `for (const x of` both fail the identifier-then-`=`
 * shape anyway. */
const CONST_HEAD = /\bconst[ \t]+([A-Za-z_$][\w$]*)[ \t]*=[ \t\n]*/g;

/** Every `const NAME = …` this gate can value. A name declared twice, differently, is opaque. */
export function parseConstants(code) {
    const out = new Map();
    CONST_HEAD.lastIndex = 0;
    let m = CONST_HEAD.exec(code);
    while (m) {
        const name = m[1];
        const value = classifyValue(code.slice(m.index + m[0].length, m.index + m[0].length + CONST_VALUE_WINDOW));
        if (out.has(name)) {
            const seen = out.get(name);
            const same = seen.kind === value.kind && JSON.stringify(seen.values ?? seen.value) === JSON.stringify(value.values ?? value.value);
            if (!same) out.set(name, { kind: 'opaque', why: `${name} is declared more than once with different values` });
        } else {
            out.set(name, value);
        }
        m = CONST_HEAD.exec(code);
    }
    return out;
}

const IMPORT_RX = /import\s*\{([^}]*)\}\s*from\s*(['"])([^'"]+)\2/g;

/** `import { A, B as C } from 'spec'` → local name → {imported, spec}. */
export function parseImports(code) {
    const out = new Map();
    IMPORT_RX.lastIndex = 0;
    let m = IMPORT_RX.exec(code);
    while (m) {
        for (const raw of m[1].split(',')) {
            const part = raw.trim();
            if (!part) continue;
            const as = /^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$/.exec(part);
            if (as) out.set(as[2], { imported: as[1], spec: m[3] });
            else if (/^[A-Za-z_$][\w$]*$/.test(part)) out.set(part, { imported: part, spec: m[3] });
        }
        m = IMPORT_RX.exec(code);
    }
    return out;
}

/**
 * A module specifier as a repo-relative path, or null for "not a file this gate scanned".
 *
 * Relative specifiers resolve against the importing file; the import map's `src/` prefix
 * (`index.html`) resolves against the repo root. A BARE specifier is vendor code and null —
 * which makes anything imported from it external, and any name position using it UNRESOLVED.
 */
export function resolveModule(fromPath, spec) {
    if (spec.startsWith('./') || spec.startsWith('../')) return join(dirname(fromPath), spec);
    if (spec.startsWith('src/')) return spec;
    return null;
}

/* ---------------------------------------------------------------------- the wrappers */

const METHOD_DEF = /(?:^|\n)[ \t]*(?:static[ \t]+)?(?:async[ \t]+)?(?:get[ \t]+|set[ \t]+)?(#?[A-Za-z_$][\w$]*)[ \t]*\(([^)]*)\)[ \t]*\{/g;
const NOT_METHODS = new Set(['if', 'for', 'while', 'switch', 'catch', 'function', 'return', 'do', 'else', 'try', 'with']);

/**
 * The emit wrappers in one file, and the span of each one's body.
 *
 * See the header: the test is that the CustomEvent's TYPE ARGUMENT IS the method's first
 * parameter, which is what tells the six real wrappers from `ui-compare-bar`'s decoy. The
 * body is bounded by the next method definition, so a wrapper is read as far as it goes and
 * no further.
 */
export function findWrappers(code) {
    const defs = [];
    METHOD_DEF.lastIndex = 0;
    let m = METHOD_DEF.exec(code);
    while (m) {
        defs.push({ name: m[1], params: m[2], start: m.index, end: m.index + m[0].length });
        m = METHOD_DEF.exec(code);
    }
    const wrappers = new Map();
    for (let i = 0; i < defs.length; i += 1) {
        const def = defs[i];
        if (NOT_METHODS.has(def.name)) continue;
        const first = /^\s*([A-Za-z_$][\w$]*)\s*(?:,|$)/.exec(def.params);
        if (!first) continue;
        const param = first[1];
        const bodyEnd = Math.min(i + 1 < defs.length ? defs[i + 1].start : code.length, def.end + WRAPPER_BODY_LIMIT);
        const body = code.slice(def.end, bodyEnd);
        if (new RegExp(`new\\s+(?:Custom)?Event\\s*\\(\\s*${param}\\b`).test(body)) {
            wrappers.set(def.name, { param, start: def.end, end: bodyEnd });
        }
    }
    return wrappers;
}

/* -------------------------------------------------------------------------- the loops */

/**
 * Every `for (const X of ITER)` and `for (const [A, B] of ITER)` header in a file.
 *
 * `at` is the index of the header's closing `)`, so "the site is inside this loop" is
 * approximated as "the site follows this header, within `LOOP_BODY_WINDOW`".
 */
export function forOfBindings(code) {
    const out = [];
    const rx = /\bfor[ \t]*\(/g;
    let m = rx.exec(code);
    while (m) {
        const open = m.index + m[0].length - 1;
        const close = matchBracket(code, open);
        if (close > 0) {
            const head = code.slice(open + 1, close);
            const value = /^\s*const\s+([A-Za-z_$][\w$]*)\s+of\s+([\s\S]+)$/.exec(head);
            const pair = /^\s*const\s+\[\s*([A-Za-z_$][\w$]*)\s*,\s*([A-Za-z_$][\w$]*)\s*\]\s+of\s+([\s\S]+)$/.exec(head);
            if (value) out.push({ kind: 'value', name: value[1], iter: value[2].trim(), at: close });
            else if (pair) out.push({ kind: 'pair', name: pair[1], iter: pair[3].trim(), at: close });
        }
        m = rx.exec(code);
    }
    return out;
}

/**
 * The `rea-sockets.js:266` shape: `const listeners = [['open', fn], ['close', fn], …]`.
 *
 * Only the FIRST element of each pair is an event-name position; the second is a handler.
 * A pair whose head is not a string literal makes the whole array unresolved rather than
 * partly guessed.
 */
export function resolvePairArray(code, name) {
    const decl = new RegExp(`const\\s+${name}\\s*=\\s*\\[`).exec(code);
    if (!decl) return null;
    const open = decl.index + decl[0].length - 1;
    const close = matchBracket(code, open);
    if (close < 0) return null;
    const body = code.slice(open + 1, close);
    const heads = [];
    const rx = /(?:^|[,[])\s*\[\s*([\s\S]{0,40}?)\s*,/g;
    let m = rx.exec(body);
    while (m) {
        const lit = /^(['"])([^'"]*)\1$/.exec(m[1].trim());
        if (!lit) return null;
        heads.push(lit[2]);
        m = rx.exec(body);
    }
    return heads.length ? heads : null;
}

/* ------------------------------------------------------------------- the name positions */

const EMIT_RX = /\bnew\s+(Custom)?Event\s*\(/g;
const LISTEN_RX = /\baddEventListener[ \t]*(?:\?\.)?[ \t]*\(/g;
const BIND_RX = /@([A-Za-z][A-Za-z0-9:._-]*)=\$\{/g;
const DYNAMIC_BIND_RX = /@\$\{/g;

const LITERAL_ARG = /^\s*(['"])((?:\\.|(?!\1)[^\\\n])*)\1\s*(?=[,)])/;
const REF_ARG = /^\s*([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\s*(?=[,)])/;

/** The first argument at an open paren: a literal, a reference expression, or neither. */
export function firstArgument(code, open) {
    const tail = code.slice(open + 1, open + 401);
    let m = LITERAL_ARG.exec(tail);
    if (m) return { kind: 'literal', value: m[2], end: open + 1 + m[0].length };
    m = REF_ARG.exec(tail);
    if (m) return { kind: 'ref', expr: m[1], end: open + 1 + m[0].length };
    const close = matchBracket(code, open);
    let stop = close < 0 ? Math.min(code.length, open + 200) : close;
    let depth = 0;
    let quote = null;
    for (let i = open + 1; i < stop; i += 1) {
        const c = code[i];
        if (quote) { if (c === '\\') i += 1; else if (c === quote) quote = null; continue; }
        if (c === "'" || c === '"' || c === '`') { quote = c; continue; }
        if (c === '(' || c === '[' || c === '{') depth += 1;
        else if (c === ')' || c === ']' || c === '}') depth -= 1;
        else if (c === ',' && depth === 0) { stop = i; break; }
    }
    return { kind: 'opaque', expr: code.slice(open + 1, stop).replace(/\s+/g, ' ').trim().slice(0, 80), end: stop };
}

/* ----------------------------------------------------------------------- the scan */

function resolveConstant(index, path, name, seen = new Set()) {
    const key = `${path}::${name}`;
    if (seen.has(key)) return { kind: 'opaque', why: 'import cycle' };
    seen.add(key);
    const file = index.get(path);
    if (!file) return { kind: 'external', why: `${path} is not a scanned file` };
    const local = file.constants.get(name);
    if (local) return local;
    const imported = file.imports.get(name);
    if (!imported) return { kind: 'missing', why: `${name} is not declared or imported in ${path}` };
    const target = resolveModule(path, imported.spec);
    if (!target) return { kind: 'external', why: `imported from the bare specifier '${imported.spec}'` };
    return resolveConstant(index, target, imported.imported, seen);
}

/**
 * One file's event-name positions, resolved or refused.
 *
 * Returns `{ emits: [], listens: [], unresolved: [] }`, each site `{ file, line, event?,
 * expr?, position, exact }`.
 */
export function scanFile(file, index) {
    const { path, source, code } = file;
    const locate = lineLocator(source);
    const emits = [];
    const listens = [];
    const unresolved = [];
    const loops = forOfBindings(code);
    const wrappers = file.wrappers;

    /* One POSITION is located once, even when it resolves to several names: a
     * table-driven loop registers five listeners from one line, and looking that line up
     * five times would report four of them as inexact. */
    const site = (channel, text, extra) => {
        const { line, exact } = locate(channel, text);
        return { file: path, line, exact, ...extra };
    };
    const sitesFor = (channel, text, names, extra) => {
        const { line, exact } = locate(channel, text);
        return names.map((event) => ({ file: path, line, exact, event, ...extra }));
    };

    /* A name position's value, or a refusal. `allowLoop` is set only where a loop variable
     * can legitimately stand for a name — a registration loop (plan §2.5). */
    const resolveAt = (expr, at, { allowLoop }) => {
        const dotted = expr.split('.');
        if (dotted.length === 2) {
            const table = resolveConstant(index, path, dotted[0]);
            if (table.kind === 'object' && table.entries.has(dotted[1])) return { names: [table.entries.get(dotted[1])] };
            return { why: `${expr} does not resolve to a string in a simple table` };
        }
        if (dotted.length > 2) return { why: `${expr} is deeper than a simple table lookup` };
        const value = resolveConstant(index, path, expr);
        if (value.kind === 'string') return { names: [value.value] };
        if (value.kind === 'object' || value.kind === 'array') {
            return { why: `${expr} is a table, and a single name position cannot take a table` };
        }
        if (allowLoop && value.kind === 'missing') {
            const bound = loops.filter((l) => l.name === expr && l.at < at && at - l.at <= LOOP_BODY_WINDOW).pop();
            if (!bound) return { why: `${expr} is not a constant and no enclosing for-of binds it` };
            return resolveIter(bound);
        }
        return { why: value.why || `${expr} does not resolve to a string` };
    };

    const resolveIter = (bound) => {
        const { iter } = bound;
        if (bound.kind === 'pair') {
            if (!/^[A-Za-z_$][\w$]*$/.test(iter)) return { why: `for (const [type, fn] of ${iter}) — not a named local array` };
            const heads = resolvePairArray(code, iter);
            if (!heads) return { why: `${iter} is not an array of ['literal', handler] pairs` };
            return { names: heads };
        }
        const values = /^Object\.values\(\s*([A-Za-z_$][\w$]*)\s*\)$/.exec(iter);
        if (values) {
            const table = resolveConstant(index, path, values[1]);
            if (table.kind === 'object') return { names: table.values };
            return { why: `Object.values(${values[1]}) — ${values[1]} is not a simple frozen table of strings` };
        }
        if (/^[A-Za-z_$][\w$]*$/.test(iter)) {
            const table = resolveConstant(index, path, iter);
            if (table.kind === 'array') return { names: table.values };
            return { why: `${iter} is not a simple array of string literals` };
        }
        if (iter.startsWith('[')) {
            const table = classifyValue(iter);
            if (table.kind === 'array') return { names: table.values };
            return { why: `the inline array in this loop is not all string literals` };
        }
        return { why: `for (… of ${iter.slice(0, 60)}) — not a resolvable iterable` };
    };

    const record = (bucket, channel, text, position, expr, at, opts) => {
        if (expr.kind === 'literal') {
            bucket.push(site(channel, text, { event: expr.value, position }));
            return;
        }
        const raw = expr.expr;
        if (expr.kind === 'ref') {
            const got = resolveAt(expr.expr, at, opts);
            if (got.names) {
                bucket.push(...sitesFor(channel, text, got.names, { position }));
                return;
            }
            unresolved.push(site(channel, text, { expr: `${position}(${raw}, …)`, position, why: got.why }));
            return;
        }
        unresolved.push(site(channel, text, { expr: `${position}(${raw}, …)`, position, why: 'not a literal, a constant, a resolved table lookup or a resolved loop variable' }));
    };

    /* emit side ------------------------------------------------------------------ */
    EMIT_RX.lastIndex = 0;
    let m = EMIT_RX.exec(code);
    while (m) {
        const open = m.index + m[0].length - 1;
        const arg = firstArgument(code, open);
        const text = code.slice(m.index, arg.end);
        /* A wrapper's OWN dispatch is not a site: its name comes from the call sites. */
        const inWrapper = [...wrappers.values()].some((w) => m.index >= w.start && m.index < w.end
            && arg.kind === 'ref' && arg.expr === w.param);
        if (!inWrapper) record(emits, 'emit', text, m[1] ? 'CustomEvent' : 'Event', arg, m.index, { allowLoop: false });
        m = EMIT_RX.exec(code);
    }

    /* wrapper call sites ---------------------------------------------------------- */
    if (wrappers.size) {
        const rx = /this\.(#?[A-Za-z_$][\w$]*)\s*\(/g;
        let w = rx.exec(code);
        while (w) {
            if (wrappers.has(w[1])) {
                const open = w.index + w[0].length - 1;
                const arg = firstArgument(code, open);
                record(emits, 'wrapper', code.slice(w.index, arg.end), `this.${w[1]}`, arg, w.index, { allowLoop: false });
            }
            w = rx.exec(code);
        }
    }

    /* heard side ------------------------------------------------------------------ */
    LISTEN_RX.lastIndex = 0;
    m = LISTEN_RX.exec(code);
    while (m) {
        const open = m.index + m[0].length - 1;
        const arg = firstArgument(code, open);
        record(listens, 'listen', code.slice(m.index, arg.end), 'addEventListener', arg, m.index, { allowLoop: true });
        m = LISTEN_RX.exec(code);
    }

    BIND_RX.lastIndex = 0;
    m = BIND_RX.exec(code);
    while (m) {
        listens.push(site('bind', m[0], { event: m[1], position: 'binding' }));
        m = BIND_RX.exec(code);
    }

    DYNAMIC_BIND_RX.lastIndex = 0;
    m = DYNAMIC_BIND_RX.exec(code);
    while (m) {
        unresolved.push(site('dynamic-bind', m[0], { expr: '@${…}=${…}', position: 'binding', why: 'the bound event name is interpolated' }));
        m = DYNAMIC_BIND_RX.exec(code);
    }

    return { emits, listens, unresolved };
}

/* ------------------------------------------------------------------------ the ledger */

export function loadLedger(root = REPO_ROOT) {
    const path = join(root, LEDGER_PATH);
    if (!existsSync(path)) return { entries: [] };
    try {
        const parsed = JSON.parse(readFileSync(path, 'utf8'));
        return { entries: Array.isArray(parsed.entries) ? parsed.entries : [] };
    } catch (e) {
        return { entries: [], error: e.message };
    }
}

const KINDS = new Set(['unheard-emit', 'orphan-listener', 'unresolved']);

/**
 * Vouched, stale, and malformed.
 *
 * An entry matches a live violation by event+kind, or — for `unresolved` — by a `file:line`
 * in its `sites`. A matched entry takes that violation out of the failing set and into
 * VOUCHED. An unmatched entry is STALE and fails: an exemption must never outlive its
 * excuse. An entry with no reason fails too, because "one line a reader can check" IS the
 * exemption; without it there is nothing to check.
 */
export function applyLedger(ledger, violations) {
    const vouched = [];
    const stale = [];
    const errors = [];
    const alive = { deadEmits: [], orphanListeners: [], unresolved: [] };
    const claimed = new Set();

    for (const entry of ledger.entries) {
        if (!entry || typeof entry.event !== 'string' || !KINDS.has(entry.kind)) {
            errors.push({ entry, why: `an entry needs an "event" and a "kind" of ${[...KINDS].join(' | ')}` });
            continue;
        }
        if (typeof entry.reason !== 'string' || entry.reason.trim() === '') {
            errors.push({ entry, why: `${entry.event}: an entry needs a non-empty "reason" a reader can check` });
            continue;
        }
        let hit = null;
        if (entry.kind === 'unheard-emit') hit = violations.deadEmits.find((v) => v.event === entry.event);
        else if (entry.kind === 'orphan-listener') hit = violations.orphanListeners.find((v) => v.event === entry.event);
        else {
            const sites = new Set(entry.sites || []);
            hit = violations.unresolved.find((u) => sites.has(`${u.file}:${u.line}`));
        }
        if (!hit) {
            stale.push({ ...entry, why: 'vouches nothing the gate reports today — the exemption outlived its excuse' });
            continue;
        }
        claimed.add(hit);
        vouched.push({ ...entry, matched: hit });
    }

    for (const key of ['deadEmits', 'orphanListeners', 'unresolved']) {
        alive[key] = violations[key].filter((v) => !claimed.has(v));
    }
    return { vouched, stale, errors, alive };
}

/* -------------------------------------------------------------------------- the gate */

export function runGateWire({ root = REPO_ROOT, files = null, ledger = null } = {}) {
    const t0 = performance.now();
    const collected = files || collectFiles(root);
    const index = new Map();
    for (const file of collected) {
        const code = stripComments(file.source);
        const record = {
            ...file,
            code,
            constants: parseConstants(code),
            imports: parseImports(code),
            wrappers: findWrappers(code),
        };
        index.set(file.path, record);
    }

    const emitters = new Map();
    const listeners = new Map();
    const unresolved = [];
    for (const file of index.values()) {
        const found = scanFile(file, index);
        for (const s of found.emits) {
            if (BUILTIN_EVENTS.has(s.event)) continue;
            if (!emitters.has(s.event)) emitters.set(s.event, []);
            emitters.get(s.event).push(s);
        }
        for (const s of found.listens) {
            if (BUILTIN_EVENTS.has(s.event)) continue;
            if (!listeners.has(s.event)) listeners.set(s.event, []);
            listeners.get(s.event).push(s);
        }
        unresolved.push(...found.unresolved);
    }

    const deadEmits = [...emitters.keys()].filter((n) => !listeners.has(n)).sort()
        .map((event) => ({ event, sites: emitters.get(event) }));
    const orphanListeners = [...listeners.keys()].filter((n) => !emitters.has(n)).sort()
        .map((event) => ({ event, sites: listeners.get(event) }));

    const book = ledger || loadLedger(root);
    const applied = applyLedger(book, { deadEmits, orphanListeners, unresolved });
    const scanMs = performance.now() - t0;

    const failures = applied.alive.deadEmits.length + applied.alive.orphanListeners.length
        + applied.alive.unresolved.length + applied.stale.length + applied.errors.length;

    return {
        ok: failures === 0,
        files: index.size,
        scanMs,
        emitters: Object.fromEntries(emitters),
        listeners: Object.fromEntries(listeners),
        deadEmits: applied.alive.deadEmits,
        orphanListeners: applied.alive.orphanListeners,
        unresolved: applied.alive.unresolved,
        vouched: applied.vouched,
        staleLedger: applied.stale,
        ledgerErrors: applied.errors,
        ledgerReadError: book.error ?? null,
    };
}

/* -------------------------------------------------------------------------- the CLI */

const pad = (s, n) => (s.length >= n ? `${s} ` : s + ' '.repeat(n - s.length));

export function formatReport(report) {
    const lines = [`gate-wire: ${report.files} files, scan ${report.scanMs.toFixed(1)} ms`];
    if (report.ledgerReadError) lines.push(`LEDGER     ${LEDGER_PATH} could not be read: ${report.ledgerReadError}`);
    for (const v of report.deadEmits) {
        lines.push(`DEAD WIRE  ${pad('unheard emit', 16)}${pad(`'${v.event}'`, 30)}${v.sites.map((s) => `${s.file}:${s.line}`).join(', ')} — heard nowhere in src/`);
    }
    for (const v of report.orphanListeners) {
        lines.push(`DEAD WIRE  ${pad('orphan listener', 16)}${pad(`'${v.event}'`, 30)}${v.sites.map((s) => `${s.file}:${s.line}`).join(', ')} — emitted nowhere in src/`);
    }
    for (const u of report.unresolved) {
        lines.push(`UNRESOLVED ${pad('', 16)}${pad(`${u.file}:${u.line}`, 30)}${u.expr} — refusing to guess (${u.why})`);
    }
    for (const v of report.vouched) {
        lines.push(`VOUCHED    ${pad(v.kind === 'unheard-emit' ? 'unheard emit' : v.kind === 'orphan-listener' ? 'orphan listener' : 'unresolved', 16)}${pad(`'${v.event}'`, 30)}wire-ledger.json: ${v.reason}`);
    }
    for (const s of report.staleLedger) {
        lines.push(`STALE      ${pad(s.kind, 16)}${pad(`'${s.event}'`, 30)}${s.why}`);
    }
    for (const e of report.ledgerErrors) {
        lines.push(`BAD LEDGER ${pad('', 16)}${e.why}`);
    }
    const dead = report.deadEmits.length + report.orphanListeners.length;
    const tail = `${dead} dead wire${dead === 1 ? '' : 's'}, ${report.unresolved.length} unresolved `
        + `(${report.staleLedger.length} stale ledger entr${report.staleLedger.length === 1 ? 'y' : 'ies'}`
        + `${report.ledgerErrors.length ? `, ${report.ledgerErrors.length} malformed` : ''}`
        + `${report.vouched.length ? `, ${report.vouched.length} vouched` : ''})`;
    lines.push(`${report.ok ? 'OK' : 'FAIL'}: ${tail}`);
    return lines.join('\n');
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) {
    const report = runGateWire();
    if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 2));
    else console.log(formatReport(report));
    process.exit(report.ok ? 0 : 1);
}
