/**
 * source-scan.js — telling JavaScript code from JavaScript prose.
 *
 * Separated from the checks that use it for the same reason `colour-literals.js` is:
 * the vocabulary is unit-testable on strings, and it has exactly one implementation.
 * Three checks depend on it — the dead-name scan (Gate 2), the excluded-surface scan
 * (Gate 3) and the cache register — and a second copy of a lexer is a second thing to
 * drift.
 *
 * THE RULE IT SERVES. Every one of these scans has to distinguish a name USED from a
 * name DISCUSSED. `src/data/EXCLUDED.md` and half the module headers in `src/data/` name
 * dead symbols deliberately, in prose, because the record IS the deliverable. A
 * comment-blind scanner produces a false positive on those, a false positive earns an
 * exemption, and an exemption is how coverage dies — which is how all three of the
 * project's previous guard failures happened.
 *
 * `dropStrings` handles the second case: a provenance string such as
 * `trace: 'delete reatsettingscache'` (`src/lib/storage-routes.js`) is a record too, and
 * an identifier scan must not see it, while a ROUTE scan must — routes live in strings.
 * So symbol checks pass `dropStrings: true` and path checks do not.
 *
 * TEMPLATE INTERPOLATIONS ARE TRACKED, and the version that did not track them had a
 * real failure mode rather than a conservative one.
 *
 * The old note here said "nested template interpolations are treated as string content,
 * which is conservative: it can hide an identifier, never invent one." The second half was
 * wrong. The scanner looked for the next backtick and nothing else, so a NESTED template —
 * `html` inside a `${...}` inside another `html`, which is how a list of rows is written —
 * closed the OUTER template at the inner one's opening backtick. From there the scanner
 * believed it was reading code, and the first apostrophe in ordinary HTML text ("Ben's")
 * opened a string state that ran until the next apostrophe, hundreds of lines away.
 *
 * MEASURED, 26 August 2026: a `<!-- ... -->` comment containing one apostrophe, inside a
 * `skins.map(... => html`...`)`, made `stripComments` return real JS comments EIGHTY LINES
 * FURTHER DOWN as code — and a guard that forbids naming a retired route failed on a
 * comment that names it in prose, which is exactly the false positive this module exists
 * to prevent.
 *
 * SO THE STATE IS A STACK. A template pushes; `${` pushes an interpolation and returns to
 * code; the `}` that closes it pops back into the template. Brace depth is counted inside
 * an interpolation so an object literal or an arrow body does not end it early.
 */

/**
 * @param {string} source
 * @param {{dropStrings?: boolean}} [options]
 * @returns {string} the source with comments removed, and string bodies removed when
 *          `dropStrings` is set. Length is not preserved; line breaks outside strings are.
 */
export function stripComments(source, { dropStrings = false } = {}) {
    let out = '';
    let state = 'code';
    /* THE STACK. Each entry is a template this scanner is inside; `braces` counts the
     * unclosed `{` of the interpolation currently being read, so the `}` that ends the
     * interpolation is the one at depth zero and an object literal inside it does not
     * end the interpolation early. */
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
