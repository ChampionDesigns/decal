/**
 * Telling JavaScript code from JavaScript prose.
 */

export function stripComments(source, { dropStrings = false } = {}) {
    let out = '';
    let state = 'code';
    const templates = [];

    for (let i = 0; i < source.length; i += 1) {
        const c = source[i];
        const next = source[i + 1];

        if (state === 'code') {
            if (c === '/' && next === '/') { state = 'line'; i += 1; continue; }
            if (c === '/' && next === '*') { state = 'block'; i += 1; continue; }
            if (c === '`') { templates.push({ braces: 0 }); state = '`'; out += c; continue; }
            if (c === "'" || c === '"') { state = c; out += c; continue; }
            if (templates.length > 0) {
                const top = templates[templates.length - 1];
                if (c === '{') top.braces += 1;
                else if (c === '}') {
                    if (top.braces === 0) { state = '`'; out += c; continue; }
                    top.braces -= 1;
                }
            }
            out += c;
        } else if (state === 'line') {
            if (c === '\n') { state = 'code'; out += c; }
        } else if (state === 'block') {
            if (c === '*' && next === '/') { state = 'code'; i += 1; }
        } else if (state === '`') {
            if (c === '\\') { if (!dropStrings) out += c + (next ?? ''); i += 1; continue; }
            /* AN INTERPOLATION IS CODE AGAIN, which is the whole repair: without this the
             * nested template one line in re-opened as a close. */
            if (c === '$' && next === '{') {
                state = 'code';
                if (!dropStrings) out += '${';
                i += 1;
                continue;
            }
            if (c === '`') { templates.pop(); state = 'code'; out += c; continue; }
            if (!dropStrings) out += c;
        } else {
            if (c === '\\') { if (!dropStrings) out += c + (next ?? ''); i += 1; continue; }
            if (c === state) { state = 'code'; out += c; } else if (!dropStrings) out += c;
        }
    }
    return out;
}
