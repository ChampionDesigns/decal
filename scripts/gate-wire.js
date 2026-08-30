#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from './lib/source-scan.js';

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const SCAN_ROOTS = ['src'];

/** Vouched exceptions. Absent is an empty ledger, never an error. */
export const LEDGER_PATH = 'tools/wire-ledger.json';

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

const LOOP_BODY_WINDOW = 600;

const CONST_VALUE_WINDOW = 600;

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

export function classifyValue(tail) {
    let m = STRING_VALUE.exec(tail);
    if (m) return { kind: 'string', value: m[2] };
    m = /^Object\.freeze\(\s*\{([^{}[\]]*)\}\s*\)/.exec(tail) || /^\{([^{}[\]]*)\}\s*[;,\n]/.exec(tail);
    if (m) return tableFromObjectBody(m[1]);
    m = /^Object\.freeze\(\s*\[([^{}[\]]*)\]\s*\)/.exec(tail) || /^\[([^{}[\]]*)\]\s*[;,\n]/.exec(tail);
    if (m) return tableFromArrayBody(m[1]);
    return { kind: 'opaque' };
}

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

export function resolveModule(fromPath, spec) {
    if (spec.startsWith('./') || spec.startsWith('../')) return join(dirname(fromPath), spec);
    if (spec.startsWith('src/')) return spec;
    return null;
}

const METHOD_DEF = /(?:^|\n)[ \t]*(?:static[ \t]+)?(?:async[ \t]+)?(?:get[ \t]+|set[ \t]+)?(#?[A-Za-z_$][\w$]*)[ \t]*\(([^)]*)\)[ \t]*\{/g;
const NOT_METHODS = new Set(['if', 'for', 'while', 'switch', 'catch', 'function', 'return', 'do', 'else', 'try', 'with']);

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

    const site = (channel, text, extra) => {
        const { line, exact } = locate(channel, text);
        return { file: path, line, exact, ...extra };
    };
    const sitesFor = (channel, text, names, extra) => {
        const { line, exact } = locate(channel, text);
        return names.map((event) => ({ file: path, line, exact, event, ...extra }));
    };

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
