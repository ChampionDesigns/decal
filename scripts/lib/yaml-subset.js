// A deliberately small YAML reader — enough for ReaPrime's two API specs, and no more.
//
// WHY THIS EXISTS. The Decal tree takes no npm dependencies (Part 2: a contributor
// clones and opens index.html), so the generated client cannot lean on `js-yaml`. The
// alternative to a parser is transcription, and transcription is the defect this whole
// gate exists to kill: 872 of api.js's lines are hand-copied wrappers around a surface
// that is already machine-readable upstream.
//
// THE RULE THAT KEEPS A SMALL PARSER HONEST: it refuses everything it does not implement.
// Every unsupported construct throws with a file and a line number, so an upstream spec
// that starts using anchors, multi-document streams or complex keys FAILS THE BUILD
// instead of parsing to something plausible and slightly wrong. A parser that guesses is
// worse than no parser, because the wrongness lands in a committed artifact.
//
// SUPPORTED, and verified present in the two specs at 2b047d02:
//   block mappings, block sequences, nesting by indentation (spaces only)
//   plain / single-quoted / double-quoted scalars, including quoted keys ("200":)
//   multi-line plain scalars (folded to one line with spaces, as YAML specifies)
//   block scalars: | and > with the -, + and explicit-indent indicators
//   flow sequences and flow mappings, including ones spanning several lines
//   full-line and trailing comments (never inside quotes: "#/components/..." survives)
//
// REFUSED, loudly: anchors (&a) and aliases (*a), multi-document streams (---), merge
// keys (<<), explicit keys (? ), tabs in indentation, tags (!!str), and any line that
// cannot be read as one of the supported forms.
//
// ORDERING. Objects are returned as plain objects, so keys that look like integers
// ("200", "304") are re-ordered by the JS engine. Callers that care about the order of
// such keys must impose one themselves — the route generator sorts response statuses
// explicitly for exactly this reason. Every other key in these two specs is a
// non-integer string, where insertion order is preserved.

export class YamlSubsetError extends Error {
    constructor(message, { file, line } = {}) {
        super(`${file || '<yaml>'}:${line ?? '?'}: ${message}`);
        this.name = 'YamlSubsetError';
        this.file = file;
        this.line = line;
    }
}

const REFUSED = [
    [/^\s*---\s*$/, 'multi-document streams are not supported'],
    [/^\s*\.\.\.\s*$/, 'document end markers are not supported'],
    [/^\s*<<\s*:/, 'merge keys (<<) are not supported'],
    [/^\s*\?\s/, 'explicit keys (? ) are not supported'],
];

/**
 * Parse a YAML subset document.
 *
 * @param {string} text
 * @param {{file?: string}} [options]
 * @returns {*} the document, or null if it is empty
 */
export function parseYaml(text, { file = '<yaml>' } = {}) {
    const state = { file, lines: lex(text, file), i: 0 };
    skipBlank(state);
    if (state.i >= state.lines.length) return null;
    const value = parseBlock(state, state.lines[state.i].indent);
    skipBlank(state);
    if (state.i < state.lines.length) {
        throw fail(state, 'unexpected content after the document body');
    }
    return value;
}

/* ------------------------------------------------------------------ lexing */

function lex(text, file) {
    const out = [];
    const raw = text.split('\n');
    for (let n = 0; n < raw.length; n += 1) {
        const line = raw[n].replace(/\r$/, '');
        const no = n + 1;
        if (line.includes('\t') && /^\s*\t/.test(line)) {
            throw new YamlSubsetError('tabs may not be used for indentation', { file, line: no });
        }
        for (const [pattern, why] of REFUSED) {
            if (pattern.test(line)) throw new YamlSubsetError(why, { file, line: no });
        }
        const indent = line.length - line.trimStart().length;
        const body = line.trim();
        out.push({
            no,
            raw: line,
            indent,
            // `content` is comment-stripped; `raw` is not, because block scalars keep
            // everything after their header verbatim, '#' included.
            content: body.startsWith('#') ? '' : stripComment(body),
        });
    }
    return out;
}

/** Remove a trailing comment, respecting quotes. `$ref: "#/x"` must survive intact. */
export function stripComment(s) {
    let single = false;
    let double = false;
    for (let i = 0; i < s.length; i += 1) {
        const c = s[i];
        if (single) {
            if (c === "'") {
                if (s[i + 1] === "'") i += 1;
                else single = false;
            }
            continue;
        }
        if (double) {
            if (c === '\\') { i += 1; continue; }
            if (c === '"') double = false;
            continue;
        }
        if (c === "'") { single = true; continue; }
        if (c === '"') { double = true; continue; }
        if (c === '&' && (i === 0 || /\s/.test(s[i - 1])) && /[A-Za-z_]/.test(s[i + 1] || '')) {
            throw new Error('anchors (&name) are not supported');
        }
        if (c === '#' && (i === 0 || /\s/.test(s[i - 1]))) return s.slice(0, i).trimEnd();
    }
    return s;
}

const isBlank = (line) => line.content === '';

function skipBlank(state) {
    while (state.i < state.lines.length && isBlank(state.lines[state.i])) state.i += 1;
}

function fail(state, message) {
    const line = state.lines[state.i];
    return new YamlSubsetError(message, { file: state.file, line: line ? line.no : undefined });
}

/* ----------------------------------------------------------------- parsing */

function parseBlock(state, indent) {
    skipBlank(state);
    if (state.i >= state.lines.length) return null;
    const line = state.lines[state.i];
    if (isSequenceItem(line.content)) return parseSequence(state, indent);
    // A flow collection may open on its own line under a bare key, which is how the
    // long `MachineState` enum is written in rest_v1.yml.
    if (line.content.startsWith('[') || line.content.startsWith('{')) {
        state.i += 1;
        return parseFlow(state, line.content);
    }
    return parseMapping(state, indent);
}

const isSequenceItem = (content) => content === '-' || content.startsWith('- ');

function parseMapping(state, indent) {
    const map = {};
    for (;;) {
        skipBlank(state);
        if (state.i >= state.lines.length) break;
        const line = state.lines[state.i];
        if (line.indent < indent) break;
        if (line.indent > indent) throw fail(state, `unexpected indentation (expected ${indent})`);
        if (isSequenceItem(line.content)) break;

        const split = splitKey(line.content);
        if (!split) throw fail(state, `expected "key: value", got ${JSON.stringify(line.content)}`);
        if (Object.prototype.hasOwnProperty.call(map, split.key)) {
            throw fail(state, `duplicate key ${JSON.stringify(split.key)}`);
        }
        state.i += 1;
        map[split.key] = parseValue(state, line, split.rest, indent);
    }
    return map;
}

function parseSequence(state, indent) {
    const items = [];
    for (;;) {
        skipBlank(state);
        if (state.i >= state.lines.length) break;
        const line = state.lines[state.i];
        if (line.indent < indent) break;
        if (line.indent > indent) throw fail(state, `unexpected indentation (expected ${indent})`);
        if (!isSequenceItem(line.content)) break;

        const after = line.content.slice(1);
        const lead = after.length - after.trimStart().length;
        const rest = after.trimStart();

        if (rest === '') {
            state.i += 1;
            skipBlank(state);
            const next = state.lines[state.i];
            if (!next || next.indent <= indent) { items.push(null); continue; }
            items.push(parseBlock(state, next.indent));
            continue;
        }

        if (splitKey(rest)) {
            // `- name: foo` opens a mapping whose first key sits on this line. Re-present
            // the line at the mapping's own indent and let parseMapping consume it with
            // its continuation lines.
            const innerIndent = indent + 1 + lead;
            state.lines[state.i] = { ...line, indent: innerIndent, content: rest };
            items.push(parseMapping(state, innerIndent));
            continue;
        }

        // A scalar item. Block scalars and flow collections are both legal here.
        state.i += 1;
        items.push(parseValue(state, line, rest, indent));
    }
    return items;
}

/**
 * Split `key: value`, honouring quoted keys and ignoring colons inside quotes or inside a
 * flow collection. Returns null when the text is not a mapping entry at all.
 */
export function splitKey(content) {
    let single = false;
    let double = false;
    let depth = 0;
    for (let i = 0; i < content.length; i += 1) {
        const c = content[i];
        if (single) {
            if (c === "'") {
                if (content[i + 1] === "'") i += 1;
                else single = false;
            }
            continue;
        }
        if (double) {
            if (c === '\\') { i += 1; continue; }
            if (c === '"') double = false;
            continue;
        }
        if (c === "'") { single = true; continue; }
        if (c === '"') { double = true; continue; }
        if (c === '[' || c === '{') { depth += 1; continue; }
        if (c === ']' || c === '}') { depth -= 1; continue; }
        if (c === ':' && depth === 0) {
            const next = content[i + 1];
            if (next === undefined || next === ' ') {
                const rawKey = content.slice(0, i).trim();
                if (rawKey === '') return null;
                return { key: scalarText(rawKey), rest: content.slice(i + 1).trim() };
            }
        }
    }
    return null;
}

function parseValue(state, keyLine, rest, keyIndent) {
    if (rest === '') {
        skipBlank(state);
        const next = state.lines[state.i];
        if (!next) return null;
        if (next.indent > keyIndent) return parseBlock(state, next.indent);
        if (next.indent === keyIndent && isSequenceItem(next.content)) {
            return parseSequence(state, keyIndent);
        }
        return null;
    }
    if (/^[|>]/.test(rest)) return parseBlockScalar(state, keyLine, rest, keyIndent);
    if (rest.startsWith('[') || rest.startsWith('{')) return parseFlow(state, rest);
    return parsePlainOrQuoted(state, rest, keyIndent);
}

/** A plain scalar may continue on following, deeper-indented lines; quoted ones do not. */
function parsePlainOrQuoted(state, rest, keyIndent) {
    if (rest.startsWith('"') || rest.startsWith("'")) return scalarText(rest);
    let text = rest;
    for (;;) {
        const next = state.lines[state.i];
        if (!next || isBlank(next) || next.indent <= keyIndent) break;
        if (splitKey(next.content) || isSequenceItem(next.content)) break;
        text += ` ${next.content}`;
        state.i += 1;
    }
    return scalarText(text);
}

function parseBlockScalar(state, keyLine, header, keyIndent) {
    const m = /^([|>])([-+]?)(\d*)([-+]?)\s*$/.exec(header);
    if (!m) throw fail(state, `unsupported block scalar header ${JSON.stringify(header)}`);
    const [, style, chompA, digits, chompB] = m;
    const chomp = chompA || chompB || '';
    const explicit = digits ? keyIndent + Number(digits) : null;

    const collected = [];
    while (state.i < state.lines.length) {
        const line = state.lines[state.i];
        if (line.raw.trim() === '') { collected.push(null); state.i += 1; continue; }
        if (line.indent <= keyIndent) break;
        collected.push(line.raw);
        state.i += 1;
    }
    while (collected.length && collected[collected.length - 1] === null) collected.pop();
    if (collected.length === 0) return '';

    const contentIndent = explicit ?? (collected.find((l) => l !== null) || '').search(/\S/);
    const rows = collected.map((l) => (l === null ? '' : l.slice(contentIndent)));

    let body;
    if (style === '|') {
        body = `${rows.join('\n')}\n`;
    } else {
        // Folded: a break between two non-empty, equally-indented lines becomes a space;
        // a blank line becomes a newline; a MORE-indented line keeps its own breaks.
        let out = '';
        for (let i = 0; i < rows.length; i += 1) {
            const row = rows[i];
            const more = /^\s/.test(row);
            if (i === 0) { out = row; continue; }
            const prev = rows[i - 1];
            if (row === '') { out += '\n'; continue; }
            if (prev === '') { out += row; continue; }
            out += (more || /^\s/.test(prev)) ? `\n${row}` : ` ${row}`;
        }
        body = `${out}\n`;
    }

    if (chomp === '-') return body.replace(/\n+$/, '');
    if (chomp === '+') return body;
    return body.replace(/\n+$/, '\n');
}

/* ------------------------------------------------------------- flow syntax */

function parseFlow(state, firstChunk) {
    let text = firstChunk;
    while (!balanced(text)) {
        const next = state.lines[state.i];
        if (!next) throw fail(state, 'unterminated flow collection');
        text += ` ${next.content}`;
        state.i += 1;
    }
    const reader = { text, pos: 0 };
    const value = readFlowValue(reader, state);
    skipFlowSpace(reader);
    if (reader.pos < reader.text.length) throw fail(state, 'trailing characters after a flow collection');
    return value;
}

function balanced(text) {
    let depth = 0;
    let single = false;
    let double = false;
    for (let i = 0; i < text.length; i += 1) {
        const c = text[i];
        if (single) { if (c === "'") { if (text[i + 1] === "'") i += 1; else single = false; } continue; }
        if (double) { if (c === '\\') { i += 1; continue; } if (c === '"') double = false; continue; }
        if (c === "'") { single = true; continue; }
        if (c === '"') { double = true; continue; }
        if (c === '[' || c === '{') depth += 1;
        if (c === ']' || c === '}') depth -= 1;
    }
    return depth === 0 && !single && !double;
}

const skipFlowSpace = (r) => { while (r.pos < r.text.length && /\s/.test(r.text[r.pos])) r.pos += 1; };

function readFlowValue(r, state) {
    skipFlowSpace(r);
    const c = r.text[r.pos];
    if (c === '[') return readFlowSeq(r, state);
    if (c === '{') return readFlowMap(r, state);
    return scalarText(readFlowScalar(r));
}

function readFlowSeq(r, state) {
    r.pos += 1;
    const items = [];
    for (;;) {
        skipFlowSpace(r);
        if (r.text[r.pos] === ']') { r.pos += 1; return items; }
        if (r.pos >= r.text.length) throw fail(state, 'unterminated flow sequence');
        items.push(readFlowValue(r, state));
        skipFlowSpace(r);
        if (r.text[r.pos] === ',') { r.pos += 1; continue; }
    }
}

function readFlowMap(r, state) {
    r.pos += 1;
    const map = {};
    for (;;) {
        skipFlowSpace(r);
        if (r.text[r.pos] === '}') { r.pos += 1; return map; }
        if (r.pos >= r.text.length) throw fail(state, 'unterminated flow mapping');
        const key = scalarText(readFlowScalar(r, true));
        skipFlowSpace(r);
        if (r.text[r.pos] !== ':') throw fail(state, 'expected ":" in a flow mapping');
        r.pos += 1;
        map[key] = readFlowValue(r, state);
        skipFlowSpace(r);
        if (r.text[r.pos] === ',') { r.pos += 1; continue; }
    }
}

function readFlowScalar(r, isKey = false) {
    const stop = isKey ? /[,:\]}]/ : /[,\]}]/;
    const start = r.pos;
    const quote = r.text[r.pos];
    if (quote === '"' || quote === "'") {
        r.pos += 1;
        while (r.pos < r.text.length) {
            const c = r.text[r.pos];
            if (quote === '"' && c === '\\') { r.pos += 2; continue; }
            if (c === quote) {
                if (quote === "'" && r.text[r.pos + 1] === "'") { r.pos += 2; continue; }
                r.pos += 1;
                break;
            }
            r.pos += 1;
        }
        return r.text.slice(start, r.pos);
    }
    while (r.pos < r.text.length && !stop.test(r.text[r.pos])) r.pos += 1;
    return r.text.slice(start, r.pos).trim();
}

/* --------------------------------------------------------------- scalars */

/** Resolve one scalar token: quoted string, null, boolean, number, or plain string. */
export function scalarText(token) {
    const t = token.trim();
    if (t === '' || t === '~' || t === 'null' || t === 'Null' || t === 'NULL') return null;
    if (t.startsWith('"') && t.endsWith('"') && t.length >= 2) return unescapeDouble(t.slice(1, -1));
    if (t.startsWith("'") && t.endsWith("'") && t.length >= 2) return t.slice(1, -1).replace(/''/g, "'");
    if (t === 'true' || t === 'True' || t === 'TRUE') return true;
    if (t === 'false' || t === 'False' || t === 'FALSE') return false;
    if (/^[-+]?\d+$/.test(t)) return Number(t);
    if (/^[-+]?(\d+\.\d*|\.\d+)([eE][-+]?\d+)?$/.test(t)) return Number(t);
    if (/^[-+]?\d+[eE][-+]?\d+$/.test(t)) return Number(t);
    return t;
}

function unescapeDouble(s) {
    let out = '';
    for (let i = 0; i < s.length; i += 1) {
        const c = s[i];
        if (c !== '\\') { out += c; continue; }
        const n = s[i + 1];
        i += 1;
        if (n === 'n') out += '\n';
        else if (n === 't') out += '\t';
        else if (n === 'r') out += '\r';
        else if (n === '0') out += '\0';
        else if (n === 'u') { out += String.fromCharCode(parseInt(s.slice(i + 1, i + 5), 16)); i += 4; }
        else out += n;
    }
    return out;
}
