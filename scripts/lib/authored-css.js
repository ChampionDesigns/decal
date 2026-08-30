/**
 * Find every line of authored CSS in the tree, and parse it.
 */

import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));

export const DEFAULT_SCAN_ROOTS = Object.freeze(['src', 'styles', 'tools', 'index.html']);

const CODE_EXTENSIONS = new Set(['.js', '.mjs']);
const SHEET_EXTENSIONS = new Set(['.css']);
const MARKUP_EXTENSIONS = new Set(['.html', '.htm']);

export async function listAuthoredFiles(roots = DEFAULT_SCAN_ROOTS, { root = REPO_ROOT } = {}) {
    const found = [];
    for (const rel of roots) {
        const abs = path.resolve(root, rel);
        let stat;
        try {
            stat = await fsp.stat(abs);
        } catch (err) {
            if (err.code === 'ENOENT') continue; // a root that does not exist yet is not a failure
            throw err;
        }
        if (stat.isDirectory()) await walk(abs, found);
        else if (stat.isFile()) found.push(abs);
    }
    return [...new Set(found)]
        .filter((f) => isAuthored(f))
        .map((f) => path.relative(root, f))
        .sort();
}

function isAuthored(file) {
    const ext = path.extname(file);
    return CODE_EXTENSIONS.has(ext) || SHEET_EXTENSIONS.has(ext) || MARKUP_EXTENSIONS.has(ext);
}

async function walk(dir, out) {
    let entries;
    try {
        entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch (err) {
        if (err.code === 'ENOENT') return; // a root that does not exist yet is not a failure
        throw err;
    }
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) await walk(full, out);
        else if (entry.isFile()) out.push(full);
    }
}

const IDENT = /[A-Za-z0-9_$]/;

/** Keywords after which a `/` starts a regex literal rather than a division. */
const REGEX_KEYWORDS = new Set([
    'return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void',
    'case', 'do', 'else', 'yield', 'await', 'throw',
]);

export function extractCssTemplates(source) {
    const blocks = [];
    const lineIndex = buildLineIndex(source);
    let i = 0;
    let lastIdent = '';
    let lastSignificant = '';

    const n = source.length;

    while (i < n) {
        const c = source[i];

        // Comments
        if (c === '/' && source[i + 1] === '/') {
            const nl = source.indexOf('\n', i);
            i = nl === -1 ? n : nl;
            continue;
        }
        if (c === '/' && source[i + 1] === '*') {
            const end = source.indexOf('*/', i + 2);
            i = end === -1 ? n : end + 2;
            continue;
        }

        // Strings
        if (c === '"' || c === "'") {
            i = skipQuoted(source, i, c);
            lastSignificant = c;
            lastIdent = '';
            continue;
        }

        if (c === '/' && regexAllowed(lastSignificant, lastIdent)) {
            i = skipRegex(source, i);
            lastSignificant = '/';
            lastIdent = '';
            continue;
        }

        // Template literal
        if (c === '`') {
            const tagged = lastIdent === 'css';
            const { end, text, interpolations } = readTemplate(source, i, blocks, lineIndex);
            if (tagged) {
                blocks.push({
                    kind: 'template',
                    start: i + 1,
                    line: lineOf(lineIndex, i + 1),
                    text,
                    interpolations,
                });
            }
            i = end;
            lastSignificant = '`';
            lastIdent = '';
            continue;
        }

        if (IDENT.test(c)) {
            let j = i;
            while (j < n && IDENT.test(source[j])) j++;
            lastIdent = source.slice(i, j);
            lastSignificant = source[j - 1];
            i = j;
            continue;
        }

        if (!/\s/.test(c)) {
            lastSignificant = c;
            lastIdent = '';
        }
        i++;
    }

    return blocks.sort((a, b) => a.start - b.start);
}

function regexAllowed(lastSignificant, lastIdent) {
    if (lastIdent && REGEX_KEYWORDS.has(lastIdent)) return true;
    if (lastIdent) return false;
    if (!lastSignificant) return true;
    return '([{,;:=!&|?+-*%<>~^'.includes(lastSignificant);
}

function skipQuoted(src, i, quote) {
    let j = i + 1;
    while (j < src.length) {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === quote) return j + 1;
        if (src[j] === '\n' && quote !== '`') return j; // unterminated; bail rather than run away
        j++;
    }
    return src.length;
}

function skipRegex(src, i) {
    let j = i + 1;
    let inClass = false;
    while (j < src.length) {
        const c = src[j];
        if (c === '\\') { j += 2; continue; }
        if (c === '[') inClass = true;
        else if (c === ']') inClass = false;
        else if (c === '/' && !inClass) {
            j++;
            while (j < src.length && /[a-z]/i.test(src[j])) j++; // flags
            return j;
        } else if (c === '\n') return j; // not a regex after all
        j++;
    }
    return src.length;
}

function readTemplate(src, i, blocks, lineIndex) {
    let j = i + 1;
    let text = '';
    let interpolations = 0;

    while (j < src.length) {
        const c = src[j];
        if (c === '\\') { text += src.slice(j, j + 2); j += 2; continue; }
        if (c === '`') return { end: j + 1, text, interpolations };
        if (c === '$' && src[j + 1] === '{') {
            interpolations++;
            const close = skipInterpolation(src, j + 2, blocks, lineIndex);
            // Keep the newlines so every later line number stays right.
            text += src.slice(j, close).replace(/[^\n]/g, ' ');
            j = close;
            continue;
        }
        text += c;
        j++;
    }
    return { end: src.length, text, interpolations };
}

/** Walk to the `}` that closes a `${`, honouring nesting. */
function skipInterpolation(src, i, blocks, lineIndex) {
    let depth = 1;
    let j = i;
    let lastIdent = '';
    let lastSignificant = '';

    while (j < src.length) {
        const c = src[j];
        if (c === '/' && src[j + 1] === '/') { const nl = src.indexOf('\n', j); j = nl === -1 ? src.length : nl; continue; }
        if (c === '/' && src[j + 1] === '*') { const e = src.indexOf('*/', j + 2); j = e === -1 ? src.length : e + 2; continue; }
        if (c === '"' || c === "'") { j = skipQuoted(src, j, c); lastSignificant = c; lastIdent = ''; continue; }
        if (c === '/' && regexAllowed(lastSignificant, lastIdent)) { j = skipRegex(src, j); lastIdent = ''; continue; }
        if (c === '`') {
            const tagged = lastIdent === 'css';
            const inner = readTemplate(src, j, blocks, lineIndex);
            if (tagged) {
                blocks.push({
                    kind: 'template',
                    start: j + 1,
                    line: lineOf(lineIndex, j + 1),
                    text: inner.text,
                    interpolations: inner.interpolations,
                });
            }
            j = inner.end;
            lastIdent = '';
            lastSignificant = '`';
            continue;
        }
        if (c === '{') depth++;
        else if (c === '}') { depth--; if (depth === 0) return j + 1; }
        if (IDENT.test(c)) {
            let k = j;
            while (k < src.length && IDENT.test(src[k])) k++;
            lastIdent = src.slice(j, k);
            lastSignificant = src[k - 1];
            j = k;
            continue;
        }
        if (!/\s/.test(c)) { lastSignificant = c; lastIdent = ''; }
        j++;
    }
    return src.length;
}

export function blankHtmlComments(source) {
    let out = '';
    let i = 0;
    while (i < source.length) {
        const start = source.indexOf('<!--', i);
        if (start === -1) { out += source.slice(i); break; }
        out += source.slice(i, start);
        const end = source.indexOf('-->', start + 4);
        const stop = end === -1 ? source.length : end + 3;
        out += source.slice(start, stop).replace(/[^\n]/g, ' ');
        i = stop;
    }
    return out;
}

/** Index just past the `>` that closes the tag starting at `i`, honouring quoted attributes. */
function findTagEnd(src, i) {
    let j = i;
    let quote = null;
    while (j < src.length) {
        const c = src[j];
        if (quote) {
            if (c === quote) quote = null;
        } else if (c === '"' || c === "'") {
            quote = c;
        } else if (c === '>') {
            return j + 1;
        }
        j++;
    }
    return src.length;
}

export function extractHtmlBlocks(source) {
    const src = blankHtmlComments(source);
    const lower = src.toLowerCase();
    const lineIndex = buildLineIndex(src);
    const styles = [];
    const scripts = [];

    let i = 0;
    while (i < src.length) {
        const lt = src.indexOf('<', i);
        if (lt === -1) break;
        const m = /^<(style|script)(?=[\s/>])/.exec(lower.slice(lt, lt + 8));
        if (!m) { i = lt + 1; continue; }

        const tag = m[1];
        const bodyStart = findTagEnd(src, lt);
        const closeIdx = lower.indexOf(`</${tag}`, bodyStart);
        const bodyEnd = closeIdx === -1 ? src.length : closeIdx;
        const entry = {
            start: bodyStart,
            end: bodyEnd,
            line: lineOf(lineIndex, bodyStart),
            text: src.slice(bodyStart, bodyEnd),
        };
        (tag === 'style' ? styles : scripts).push(entry);
        i = bodyEnd;
    }

    return { styles, scripts };
}

/**
 * Blank everything outside the given spans, keeping newlines, so a scanner run over
 * the result reports absolute line numbers in the original file for free.
 */
function blankOutside(src, spans) {
    let out = '';
    let i = 0;
    for (const { start, end } of spans) {
        out += src.slice(i, start).replace(/[^\n]/g, ' ');
        out += src.slice(start, end);
        i = end;
    }
    out += src.slice(i).replace(/[^\n]/g, ' ');
    return out;
}

export function collectHtmlCss(source) {
    const src = blankHtmlComments(source);
    const { styles, scripts } = extractHtmlBlocks(source);
    const blocks = [];

    for (const s of styles) {
        blocks.push({
            kind: 'style-element',
            line: s.line,
            text: s.text,
            ...parseCssBlock(s.text, { startLine: s.line }),
        });
    }

    if (scripts.length) {
        const masked = blankOutside(src, scripts);
        for (const t of extractCssTemplates(masked)) {
            blocks.push({
                kind: 'template',
                line: t.line,
                text: t.text,
                interpolations: t.interpolations,
                ...parseCssBlock(t.text, { startLine: t.line }),
            });
        }
    }

    return blocks.sort((a, b) => a.line - b.line);
}

export function stripCssComments(text) {
    let out = '';
    let i = 0;
    while (i < text.length) {
        if (text[i] === '/' && text[i + 1] === '*') {
            const end = text.indexOf('*/', i + 2);
            const stop = end === -1 ? text.length : end + 2;
            out += text.slice(i, stop).replace(/[^\n]/g, ' ');
            i = stop;
            continue;
        }
        if (text[i] === '"' || text[i] === "'") {
            const end = skipQuoted(text, i, text[i]);
            out += text.slice(i, end);
            i = end;
            continue;
        }
        out += text[i];
        i++;
    }
    return out;
}

export function parseCssBlock(text, { startLine = 1 } = {}) {
    const src = stripCssComments(text);
    const declarations = [];
    const atRules = [];

    let buf = '';
    let bufLine = startLine;
    let line = startLine;
    let depth = 0;
    let paren = 0;
    let quote = null;
    let bufStarted = false;

    const flushDeclaration = () => {
        const raw = buf.trim();
        buf = '';
        bufStarted = false;
        if (!raw) return;
        if (raw.startsWith('@')) {
            atRules.push({ name: atName(raw), prelude: raw, line: bufLine, block: false });
            return;
        }
        const colon = splitAtColon(raw);
        if (!colon) return;
        declarations.push({
            property: colon.property,
            value: colon.value,
            important: /!\s*important\b/i.test(colon.value),
            line: bufLine,
            depth,
        });
    };

    for (let i = 0; i < src.length; i++) {
        const c = src[i];
        if (c === '\n') line++;

        if (quote) {
            buf += c;
            if (c === '\\') { buf += src[i + 1] ?? ''; i++; continue; }
            if (c === quote) quote = null;
            continue;
        }
        if (c === '"' || c === "'") { quote = c; buf += c; continue; }

        if (c === '(') { paren++; buf += c; continue; }
        if (c === ')') { paren = Math.max(0, paren - 1); buf += c; continue; }

        if (paren === 0 && c === '{') {
            const raw = buf.trim();
            if (raw.startsWith('@')) {
                atRules.push({ name: atName(raw), prelude: raw, line: bufLine, block: true });
            }
            buf = '';
            bufStarted = false;
            depth++;
            continue;
        }
        if (paren === 0 && c === '}') {
            flushDeclaration();
            depth = Math.max(0, depth - 1);
            continue;
        }
        if (paren === 0 && c === ';') {
            flushDeclaration();
            continue;
        }

        if (!bufStarted && !/\s/.test(c)) { bufStarted = true; bufLine = line; }
        buf += c;
    }
    flushDeclaration();

    return { declarations, atRules };
}

function atName(raw) {
    return (/^@([a-zA-Z-]+)/.exec(raw)?.[1] ?? '').toLowerCase();
}

function splitAtColon(raw) {
    let paren = 0;
    let quote = null;
    for (let i = 0; i < raw.length; i++) {
        const c = raw[i];
        if (quote) { if (c === '\\') i++; else if (c === quote) quote = null; continue; }
        if (c === '"' || c === "'") { quote = c; continue; }
        if (c === '(') paren++;
        else if (c === ')') paren--;
        else if (c === ':' && paren === 0) {
            return { property: raw.slice(0, i).trim(), value: raw.slice(i + 1).trim() };
        }
    }
    return null;
}

function buildLineIndex(source) {
    const idx = [0];
    for (let i = 0; i < source.length; i++) if (source[i] === '\n') idx.push(i + 1);
    return idx;
}

function lineOf(lineIndex, offset) {
    let lo = 0;
    let hi = lineIndex.length - 1;
    while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (lineIndex[mid] <= offset) lo = mid;
        else hi = mid - 1;
    }
    return lo + 1;
}

export async function collectAuthoredCss({
    roots = DEFAULT_SCAN_ROOTS,
    root = REPO_ROOT,
    exempt = [],
} = {}) {
    const exemptSet = new Set(exempt.map((p) => path.normalize(p)));
    const files = await listAuthoredFiles(roots, { root });
    const blocks = [];
    const skipped = [];

    for (const rel of files) {
        if (exemptSet.has(path.normalize(rel))) { skipped.push(rel); continue; }
        const abs = path.join(root, rel);
        const source = await fsp.readFile(abs, 'utf8');
        const ext = path.extname(rel);

        if (SHEET_EXTENSIONS.has(ext)) {
            const parsed = parseCssBlock(source, { startLine: 1 });
            blocks.push({ file: rel, kind: 'sheet', line: 1, text: source, ...parsed });
            continue;
        }

        if (MARKUP_EXTENSIONS.has(ext)) {
            for (const b of collectHtmlCss(source)) blocks.push({ file: rel, ...b });
            continue;
        }

        for (const t of extractCssTemplates(source)) {
            const parsed = parseCssBlock(t.text, { startLine: t.line });
            blocks.push({
                file: rel,
                kind: 'template',
                line: t.line,
                text: t.text,
                interpolations: t.interpolations,
                ...parsed,
            });
        }
    }

    return { blocks, files, skipped, exempt: [...exemptSet] };
}
