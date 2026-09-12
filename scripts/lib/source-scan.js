/**
 * Telling JavaScript code from JavaScript prose.
 *
 * One pass classifies every character as code, comment, string, template chunk or
 * regex literal, because a quote, a backtick or a slash only means what it means once
 * the scanner knows where it already is. `stripComments`, `comments` and `strings` are
 * three readings of that same pass.
 */

const REGEX_KEYWORDS = /(?:^|[^A-Za-z0-9_$.])(return|typeof|instanceof|in|of|new|delete|void|case|do|else|yield|await)$/;

/** Whether a `/` at this point opens a regex literal rather than dividing. */
function regexAllowed(tail) {
    const t = tail.replace(/\s+$/, '');
    if (t === '') return true;
    if (t.endsWith('++') || t.endsWith('--')) return false;
    const last = t[t.length - 1];
    if (last === ')' || last === ']' || last === "'" || last === '"' || last === '`') return false;
    if (last === '}') return true;
    if (/[A-Za-z0-9_$]/.test(last)) return REGEX_KEYWORDS.test(t);
    return true;
}

/**
 * The one pass. Returns the source with its comments removed, every comment as
 * {line, text}, and every string and template chunk as {line, text, kind}.
 */
function scan(source, { dropStrings = false } = {}) {
    const found = [];
    const literals = [];
    let out = '';
    let state = 'code';
    let start = 0;
    let tail = '';
    let inClass = false;
    const templates = [];

    const lines = [0];
    for (let i = 0; i < source.length; i += 1) if (source[i] === '\n') lines.push(i + 1);
    const lineAt = (index) => {
        let lo = 0;
        let hi = lines.length - 1;
        while (lo < hi) {
            const mid = (lo + hi + 1) >> 1;
            if (lines[mid] <= index) lo = mid;
            else hi = mid - 1;
        }
        return lo + 1;
    };
    const keep = (c) => {
        out += c;
        tail = (tail + c).slice(-24);
    };
    const literal = (kind, end) => {
        if (end > start) literals.push({ line: lineAt(start), text: source.slice(start, end), kind });
    };

    for (let i = 0; i < source.length; i += 1) {
        const c = source[i];
        const next = source[i + 1];

        if (state === 'code') {
            if (c === '/' && next === '/') { state = 'line'; start = i; i += 1; continue; }
            if (c === '/' && next === '*') { state = 'block'; start = i; i += 1; continue; }
            if (c === '/' && regexAllowed(tail)) { state = 'regex'; inClass = false; keep(c); continue; }
            if (c === '`') { templates.push({ braces: 0 }); state = '`'; start = i + 1; keep(c); continue; }
            if (c === "'" || c === '"') { state = c; start = i + 1; keep(c); continue; }
            if (templates.length > 0) {
                const top = templates[templates.length - 1];
                if (c === '{') top.braces += 1;
                else if (c === '}') {
                    if (top.braces === 0) { state = '`'; start = i + 1; keep(c); continue; }
                    top.braces -= 1;
                }
            }
            keep(c);
        } else if (state === 'line') {
            if (c === '\n') { found.push({ line: lineAt(start), text: source.slice(start, i) }); state = 'code'; keep(c); }
        } else if (state === 'block') {
            if (c === '*' && next === '/') {
                found.push({ line: lineAt(start), text: source.slice(start, i + 2) });
                state = 'code';
                i += 1;
            }
        } else if (state === 'regex') {
            keep(c);
            if (c === '\\') { keep(next ?? ''); i += 1; continue; }
            if (c === '\n') { state = 'code'; continue; }
            if (c === '[') inClass = true;
            else if (c === ']') inClass = false;
            else if (c === '/' && !inClass) state = 'code';
        } else if (state === '`') {
            if (c === '\\') { if (!dropStrings) { out += c + (next ?? ''); } i += 1; continue; }
            /* An interpolation is code: without this a nested template reads as a close. */
            if (c === '$' && next === '{') {
                literal('template', i);
                state = 'code';
                if (!dropStrings) out += '${';
                tail = `${tail}\${`.slice(-24);
                i += 1;
                continue;
            }
            if (c === '`') { literal('template', i); templates.pop(); state = 'code'; keep(c); continue; }
            if (!dropStrings) out += c;
        } else {
            if (c === '\\') { if (!dropStrings) { out += c + (next ?? ''); } i += 1; continue; }
            if (c === state) { literal('string', i); state = 'code'; keep(c); } else if (!dropStrings) out += c;
        }
    }
    if (state === 'line') found.push({ line: lineAt(start), text: source.slice(start) });
    return { code: out, comments: found, literals };
}

export function stripComments(source, options) {
    return scan(source, options).code;
}

/**
 * The comments in a JavaScript source, as {line, text}. Strings, template literals and
 * their `${}` interpolations are code, so a backtick or a `/*` inside one is not a
 * comment.
 */
export function comments(source) {
    return scan(source).comments;
}

/**
 * Every string literal and every literal chunk of a template, as {line, text, kind}.
 * An interpolation is code and is not returned; the chunks either side of it are.
 */
export function strings(source) {
    return scan(source).literals;
}
