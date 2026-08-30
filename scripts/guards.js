#!/usr/bin/env node
/**
 * guards.js — Gate C. Static rules that fail the build, and the registry that runs them.
 *
 *     node scripts/guards.js            # all guards, exit 1 on any error
 *     node scripts/guards.js --json     # machine-readable, for the wave GATE agent
 *     node scripts/guards.js --only colour-literal
 *
 * WHY THESE EXIST AT ALL. The audit's one-line verdict on the old library is that
 * *discipline without enforcement decays*: it was well designed, well documented,
 * and still ended up with five focus treatments, thirteen selection looks and 364
 * `!important` declarations. Gate C is the half of the answer a code review cannot
 * do twice a night.
 *
 * THE TWO REQUIRED RULES (SCOPE Part 8 §2, Gate C):
 *   - a raw colour literal in authored component CSS fails the build (A8);
 *   - `@font-face` is forbidden in component styles (Part 8 §3 Rule 2, static half).
 *
 * TWO MORE ride along, because their canaries were handed forward from item #2 and
 * the scanner that finds one finds all four: zero `!important` in component styles
 * (spec §2.1 Rule 3) and no re-declaring a public `--ui-*` token inside a component
 * (bug L12, where the Live screen re-declares the public palette three times under
 * private names). Their severity is a field in the table below — the whole reversal
 * is changing `error` to `warn` on one line (recorded in DEFERRED_QUESTIONS.md).
 *
 * TWO CONSTRUCTION RULES THE GUARDS INHERIT, both from the recorded failures:
 *
 *   1. SCAN BY CONSTRUCTION, NOT BY ALLOWLIST. `scripts/lib/authored-css.js` parses
 *      the `css` tagged templates inside component files as well as `.css` files,
 *      because in a Lit tree that is where the CSS is. A `**\/*.css` glob would read
 *      three files today and miss every component ever written.
 *
 *   2. EVERY GUARD SHIPS WITH A CANARY. `test/fixtures/canaries/` holds a fixture
 *      that violates each rule on purpose, and `test/guards.test.mjs` asserts the
 *      guard FAILS on it. "All three old-guard failures were guards that silently
 *      stopped covering their target; a canary converts that decay from invisible to
 *      a red build."
 *
 * EXEMPTIONS ARE THE DANGEROUS PART, so each one is (a) an exact path, never a
 * pattern, (b) justified in the table, and (c) checked to still exist ON DISK — an
 * exemption pointing at a file nobody has, silently covering a file everybody has, is
 * the failure mode of the old markup-only colour guard. A missing exempt path is
 * reported as a violation of the guard itself.
 *
 * "On disk" is load-bearing and was once not true: the check used to test whether the
 * exempt path appeared in THIS run's scanned file list, which is a different fact. A
 * run over narrowed roots then reported five files as non-existent while they sat in
 * `styles/` — and the obvious remedy for five false errors is `checkExemptions: false`,
 * which is the check turning itself off. It now stats the file.
 */

import fsp from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { collectAuthoredCss, listAuthoredFiles, DEFAULT_SCAN_ROOTS, REPO_ROOT } from './lib/authored-css.js';
import { findColourLiterals } from './lib/colour-literals.js';

/* ===========================================================================
 * The guards
 * =========================================================================== */

/** The palette's one legitimate home. Nothing else in the tree may hold a literal. */
const TOKEN_SHEETS = ['styles/tokens.css', 'styles/chart-channels.css'];

export const colourLiteralGuard = {
    id: 'colour-literal',
    severity: 'error',
    title: 'no raw colour literal in authored component CSS',
    why: 'SCOPE Part 8 §2 Gate C (A8). A fork retargets the template by editing the '
        + 'token files and rewriting no rule; a literal in a component is a colour the '
        + 'token file does not control.',
    exempt: TOKEN_SHEETS,
    exemptWhy: 'the token sheets ARE the palette — literals are what they are for',
    check(blocks) {
        const out = [];
        for (const block of blocks) {
            for (const decl of block.declarations) {
                for (const hit of findColourLiterals(decl.property, decl.value)) {
                    out.push({
                        file: block.file,
                        line: decl.line,
                        message: `${hit.kind} colour literal ${hit.text} in \`${decl.property}\``,
                        detail: `${decl.property}: ${clip(decl.value)}`,
                        fix: 'use a --ui-* token from styles/tokens.css, or add the colour there first',
                    });
                }
            }
        }
        return out;
    },
};

export const fontFaceGuard = {
    id: 'font-face',
    severity: 'error',
    title: 'no @font-face in component styles',
    why: 'SCOPE Part 8 §3 Rule 2, measured not assumed: a face declared only in a shadow '
        + "root never registers — measureText('0123456789.') at 20px gives 105.00 (the "
        + 'unknown-family fallback) against 118.50 for the same face declared in the '
        + 'document, with document.fonts.size === 0. Canvas resolves ctx.font against the '
        + "DOCUMENT's registry, so this silently mis-measures every chart axis.",
    exempt: ['styles/document.css'],
    exemptWhy: 'the ONE place a face may be declared (SCOPE Part 2 §2, §7)',
    check(blocks) {
        const out = [];
        for (const block of blocks) {
            for (const at of block.atRules) {
                if (at.name !== 'font-face') continue;
                out.push({
                    file: block.file,
                    line: at.line,
                    message: '@font-face declared outside styles/document.css',
                    detail: clip(at.prelude),
                    fix: 'move the @font-face to styles/document.css and reference the family by --ui-font-family',
                });
            }
        }
        return out;
    },
};

export const importantGuard = {
    id: 'important',
    severity: 'error',
    title: 'zero !important in component styles',
    why: 'LAYOUT_SPEC_DRAFT.md §2.1 Rule 3. slate-shell.css carries 268 and '
        + 'slate-components.css 96, every one of them because some other sheet could reach '
        + 'the same element. Nothing can reach into a shadow root, so an !important here '
        + "can only be beating the component's own base rules — which is what :where() in "
        + 'base.js removes the need for.',
    exempt: [],
    exemptWhy: null,
    check(blocks) {
        const out = [];
        for (const block of blocks) {
            for (const decl of block.declarations) {
                if (!decl.important) continue;
                out.push({
                    file: block.file,
                    line: decl.line,
                    message: `!important on \`${decl.property}\``,
                    detail: `${decl.property}: ${clip(decl.value)}`,
                    fix: 'the base rules are wrapped in :where() and carry zero specificity — a plain class selector already wins',
                });
            }
        }
        return out;
    },
};

export const privatePaletteGuard = {
    id: 'private-palette',
    severity: 'error',
    title: 'no re-declaring a public --ui-* token inside a component',
    why: 'bug L12 — the Live screen re-declares the public palette three times under '
        + 'private names. The names stay public and the values go local, so every consumer '
        + 'downstream reads a colour the token file does not control and a fork retargeting '
        + 'the template changes nothing here. Component-private properties use the --_ui- '
        + 'prefix, which this guard deliberately allows.',
    exempt: TOKEN_SHEETS,
    exemptWhy: 'the token sheets are where --ui-* is defined',
    check(blocks) {
        const out = [];
        for (const block of blocks) {
            for (const decl of block.declarations) {
                if (!decl.property.startsWith('--ui-')) continue;
                if (WIRES_ONE_TOKEN_TO_ANOTHER.test(decl.value.trim())) continue;
                out.push({
                    file: block.file,
                    line: decl.line,
                    message: `component re-declares the public token ${decl.property}`,
                    detail: `${decl.property}: ${clip(decl.value)}`,
                    fix: 'rename to --_ui-* for a component-private value, aim it at another public '
                        + 'token with var(--ui-*), or change the token in styles/tokens.css',
                });
            }
        }
        return out;
    },
};

/**
 * THE ONE SHAPE THAT IS NOT L12: a public token aimed at another public token.
 *
 *     :host { --ui-selected-face: var(--ui-preset-selected-face); }
 *
 * L12 is "the values go local, so every consumer downstream reads a colour the token
 * file does not control". A wiring like the above keeps the value in the token file —
 * it says only WHICH public name this subtree's dial reads, which is composition, not
 * a private palette. A fork retargets `--ui-preset-selected-face` in styles/tokens.css
 * and the row moves with everything else.
 *
 * It has to be allowed somewhere, because the obvious alternative does not work: a
 * DOCUMENT stylesheet cannot match an element inside a shadow root, so a
 * `ui-preset-bank { ... }` block in tokens.css reaches that component's light-DOM test
 * fixture and nothing in the app. The wiring can only be written by the component.
 *
 * DELIBERATELY NARROW. A literal is still a violation, a raw colour is still a
 * violation, and so is `var(--ui-x, #123456)` — the fallback must be a public token
 * too, or the local value is back with one more step in front of it.
 */
const WIRES_ONE_TOKEN_TO_ANOTHER =
    /^var\(\s*--ui-[\w-]+\s*(?:,\s*var\(\s*--ui-[\w-]+\s*\)\s*)?\)$/;

/**
 * The units this guard rejects. `dvh`/`svh`/`lvh` and their width partners all name the
 * same wrong thing — the LAYOUT viewport — and `vmin`/`vmax` pick one of them.
 */
const VIEWPORT_UNIT = /(?<![\w.])(\d+(?:\.\d+)?)(dvh|dvw|svh|svw|lvh|lvw|vh|vw|vmin|vmax)(?![\w-])/;

export const viewportUnitGuard = {
    id: 'viewport-unit',
    severity: 'error',
    title: 'nothing sizes itself from the viewport',
    why: 'src/lib/app-fit.js draws the app at a 1200-unit reference height and scales it, '
        + 'so the viewport and the app container stopped being the same number: on the bench '
        + 'tablet a viewport unit resolves against 801 layout units where the design is '
        + 'written in 1200. `--ui-live-foot-share: 18dvh` was 144 units where the design says '
        + '216, which is a phase row, silently, on the one screen that matters. A share of the '
        + 'app comes from --ui-app-h / --ui-app-w or from a container query; a component reads '
        + 'its own container and never the viewport (LAYOUT_SPEC_DRAFT §2.1 Rule 1) — the fit '
        + 'is that rule reaching the last two declarations that broke it.',
    exempt: ['tools/gallery/index.html', 'tools/screens/index.html'],
    exemptWhy: 'the two instrument host pages, whose stage IS the viewport — they are what '
        + 'app-root is mounted INTO for a capture, so a viewport unit there is the ground '
        + 'being stated rather than the app reading it',
    check(blocks) {
        const out = [];
        for (const block of blocks) {
            for (const decl of block.declarations) {
                const hit = VIEWPORT_UNIT.exec(decl.value);
                if (!hit) continue;
                /* THE ONE EXCEPTION, and it is the pre-fit fallback rather than a use:
                 * `var(--ui-app-h, 100dvh)` is what a WebView with the inline script
                 * blocked falls back to, and it is the reason such a WebView still gets
                 * a page instead of a blank one. Only inside a var() fallback, and only
                 * the full-viewport value — `var(--x, 18dvh)` is a real use in hiding. */
                if (new RegExp(`var\\([^)]*,\\s*100(dvh|dvw|vh|vw)\\s*\\)`).test(decl.value)
                    && hit[1] === '100') continue;
                out.push({
                    file: block.file,
                    line: decl.line,
                    message: `\`${decl.property}\` sizes from the viewport (${hit[0]})`,
                    detail: `${decl.property}: ${clip(decl.value)}`,
                    fix: 'take the share from var(--ui-app-h) / var(--ui-app-w), or from a container query',
                });
            }
        }
        return out;
    },
};

/**
 * A BACKTICK INSIDE A `css` TEMPLATE CLOSES IT, AND EVERY GUARD THEN GOES BLIND.
 *
 * This is not hypothetical. It happened three times in one session on 23 Aug 2026, and
 * the third time it produced a GREEN Gate C over a component whose rules had silently
 * stopped applying. The file still parses as valid JavaScript, so `node --check` is
 * happy; the scanner recovers the TRUNCATED head of the template; and every rule after
 * the backtick is simply not there to violate anything. `ui-preset-bank.js` and
 * `live-header.js` both carry a written warning about it, and a warning is what this
 * tree calls "discipline without enforcement".
 *
 * THE SIGNATURE IS A TRUNCATED TEMPLATE, NOT A MISSING ONE. A first draft looked for
 * components that yielded NO block at all and its own canary refused to trip it: a
 * template cut in half still hands back its first half. What a cut leaves behind is
 * text that is not well-formed CSS, in one of two ways, and healthy CSS is never either:
 *
 *   1. AN UNTERMINATED COMMENT. Both real cases put the backtick inside a comment, so
 *      the recovered text ends with a `/*` that never closes.
 *   2. UNBALANCED BRACES. A cut anywhere else ends inside a rule, so the block carries
 *      more `{` than `}`.
 *
 * Neither can happen in a template that closed where its author meant it to.
 */
export const lostStylesheetGuard = {
    id: 'lost-stylesheet',
    severity: 'error',
    title: 'no css template truncated by a stray backtick',
    why: 'a backtick inside a css tagged template CLOSES it. The file still parses as '
        + 'JavaScript, so node --check passes, the rules after the backtick stop applying, '
        + 'and every Gate C rule inside the lost tail has nothing left to violate — a green '
        + 'gate over a component that is no longer painting. Measured three times in one '
        + 'session; the third produced a passing build and a broken screen.',
    exempt: [],
    exemptWhy: null,
    /* A THIRD SIGNATURE WAS TRIED AND WITHDRAWN, and it is recorded because the gap it
     * aimed at is real. On 23 Aug 2026 a backtick inside a comment cut ui-slider.js's
     * template in half AND the recovered head balanced its braces and closed its
     * comments — so both checks below passed while the component had stopped painting.
     * The attempt looked for CSS left OUTSIDE every recovered template, which is what a
     * truncation leaves behind. It fired on three healthy files: the scanner's recovered
     * text is not byte-identical to the source it came from, so "everything the scanner
     * did not recover" is not a subtraction that can be done with a string replace.
     *
     * WHAT ACTUALLY CAUGHT IT was test/ui-slider-thumb-parity.test.mjs, which parses the
     * same file for a different reason and reported "unbalanced braces in the component
     * CSS". A guard that fires on healthy files is worse than a gap a suite already
     * covers, so this one keeps the two signatures it can prove. */
    check(blocks) {
        const out = [];
        for (const block of blocks) {
            if (block.kind !== 'template') continue;
            const text = block.text || '';

            const opens = (text.match(/\/\*/g) || []).length;
            const closes = (text.match(/\*\//g) || []).length;
            if (opens > closes) {
                out.push({
                    file: block.file,
                    line: block.line,
                    message: 'a css template ends inside a comment — it was cut short',
                    detail: `${opens} comment openers against ${closes} closers`,
                    fix: 'a backtick inside the comment closed the template early; remove it. '
                        + 'Every rule after that point has stopped applying.',
                });
                continue;
            }

            /* Braces, counted outside comments and strings — a brace in prose is common
             * in this tree's long notes and is not a defect. */
            const bare = text.replace(/\/\*[\s\S]*?\*\//g, '');
            const depth = (bare.match(/\{/g) || []).length - (bare.match(/\}/g) || []).length;
            if (depth !== 0) {
                out.push({
                    file: block.file,
                    line: block.line,
                    message: `a css template's braces do not balance (${depth > 0 ? '+' : ''}${depth})`,
                    detail: 'an unclosed rule is what a template cut short leaves behind',
                    fix: 'look for a stray backtick inside the template — one closes it, and the '
                        + 'rules after it stop applying while the file still parses',
                });
            }
        }
        return out;
    },
};

/**
 * EVERY AUTHORED FILE STILL PARSES.
 *
 * THE GAP THIS CLOSES, AND IT WAS FOUND THE HARD WAY. `lost-stylesheet` above catches a
 * stray backtick inside a `css` tagged template — the failure that has cost this project
 * three sessions. It cannot catch the same mistake inside an `html` template, and the
 * reason is one line: the scanner these guards run on extracts a template only when its
 * tag is `css` (scripts/lib/authored-css.js:188, `lastIdent === 'css'`). An `html`
 * template is never handed to a guard at all, so every signature above has nothing to
 * look at.
 *
 * That is not hypothetical. On 27 August 2026 an agent hit the trap in an `html`
 * template, ran `npm run guards`, was told Gate C was OK, and lost a debugging cycle to
 * a green gate over a file that no longer parsed.
 *
 * WHY A PARSE CHECK IS THE RIGHT ANSWER HERE and is not what `lost-stylesheet` does.
 * The two failures are different shapes. In a `css` template the file usually still
 * PARSES — the tail is valid JavaScript — which is exactly why that guard has to reason
 * about comment openers and braces instead. In an `html` template the tail is markup, so
 * the file almost always stops parsing, and a parser is then both the cheapest and the
 * most complete detector: it catches the backtick, and it catches every other syntax
 * error a hand edit can introduce, in one pass.
 *
 * Measured: 578 authored files, spawned eight at a time, about two seconds.
 *
 * NEITHER GUARD REPLACES THE OTHER. Keep both — one covers the silent case, one covers
 * the loud case, and the loud case was the one nothing was watching.
 */
export const parsesGuard = {
    id: 'parses',
    severity: 'error',
    kind: 'files',
    title: 'every authored file still parses',
    why: 'a backtick inside an html tagged template closes it, and the markup after it is '
        + 'not JavaScript. lost-stylesheet cannot see it — the scanner only extracts css '
        + 'templates — so nothing was watching this. A file that does not parse is a screen '
        + 'that does not render, behind a green gate.',
    exempt: [],
    exemptWhy: null,
    async checkFiles(files, { root = REPO_ROOT } = {}) {
        const run = promisify(execFile);
        const source = files.filter((f) => /\.(?:js|mjs)$/.test(f));
        const out = [];
        /* Bounded concurrency: one node per file is the honest way to ask "does node
         * parse this", and eight at a time keeps the whole sweep near two seconds. */
        const LIMIT = 8;
        let next = 0;
        const worker = async () => {
            for (;;) {
                const i = next; next += 1;
                if (i >= source.length) return;
                const rel = source[i];
                try {
                    await run(process.execPath, ['--check', path.resolve(root, rel)]);
                } catch (error) {
                    const text = String(error?.stderr || error?.message || '');
                    const line = /:(\d+)\n/.exec(text);
                    const why = /(SyntaxError:.*)/.exec(text);
                    out.push({
                        file: rel,
                        line: line ? Number(line[1]) : 0,
                        message: 'this file does not parse',
                        detail: why ? why[1] : text.split('\n')[0],
                        fix: 'if it holds an html or css tagged template, look for a backtick '
                            + 'inside a comment in it — one closes the template, and what '
                            + 'follows is markup rather than JavaScript.',
                    });
                }
            }
        };
        await Promise.all(Array.from({ length: LIMIT }, worker));
        out.sort((a, b) => a.file.localeCompare(b.file));
        return out;
    },
};

export const GUARDS = [colourLiteralGuard, fontFaceGuard, importantGuard, privatePaletteGuard,
    viewportUnitGuard, lostStylesheetGuard, parsesGuard];

/* ===========================================================================
 * The runner
 * =========================================================================== */

/**
 * Run the guards over a tree.
 *
 * @param opts.root    repo root (the canary tests point this at a fixture directory)
 * @param opts.roots   scan roots inside it (default src/ + styles/ + tools/ + index.html)
 * @param opts.only    guard ids to run
 * @param opts.checkExemptions  default true; set false only when `root` itself is a
 *                     fixture tree that legitimately has no styles/ directory.
 *                     Narrowing `roots` is NOT a reason to disable it — the check
 *                     resolves each exempt path against `root` on disk, not against
 *                     the files this run happened to walk.
 */
export async function runGuards({
    root = REPO_ROOT,
    roots = DEFAULT_SCAN_ROOTS,
    only = null,
    checkExemptions = true,
} = {}) {
    const selected = only ? GUARDS.filter((g) => only.includes(g.id)) : GUARDS;
    if (only && selected.length !== only.length) {
        const known = GUARDS.map((g) => g.id).join(', ');
        throw new Error(`unknown guard id in ${JSON.stringify(only)}; known: ${known}`);
    }

    const { blocks, files } = await collectAuthoredCss({ root, roots, exempt: [] });
    /* A FILE-KIND GUARD ASKS A QUESTION ABOUT FILES, NOT ABOUT CSS BLOCKS. `parses` is the
     * first: the block scanner only extracts css templates, so a guard that needs to see
     * every authored file cannot be written against `blocks` at all — which is precisely
     * the gap it exists to close. Listed lazily so a `--only` run that names no file guard
     * does not pay for the walk. */
    let authored = null;
    const authoredFiles = async () => {
        if (authored === null) authored = await listAuthoredFiles(roots, { root });
        return authored;
    };

    const results = [];
    for (const guard of selected) {
        const exempt = new Set(guard.exempt.map((p) => path.normalize(p)));
        const scanned = guard.kind === 'files'
            ? (await authoredFiles()).filter((f) => !exempt.has(path.normalize(f)))
            : blocks.filter((b) => !exempt.has(path.normalize(b.file)));
        const found = guard.kind === 'files'
            ? await guard.checkFiles(scanned, { root })
            : guard.check(scanned);
        const violations = found.map((v) => ({ ...v, guard: guard.id, severity: guard.severity }));

        // Exemption rot: an exemption that points at nothing is an exemption that has
        // stopped protecting what it was written for, and may be shadowing a rename.
        // The question is whether the FILE is there, so ask the filesystem.
        if (checkExemptions) {
            for (const rel of guard.exempt) {
                if (!(await fileExists(path.resolve(root, rel)))) {
                    violations.push({
                        guard: guard.id,
                        severity: 'error',
                        file: rel,
                        line: 0,
                        message: `exempt path does not exist: ${rel}`,
                        detail: 'an exemption for a missing file cannot be doing what it says',
                        fix: `remove it from ${guard.id}'s exempt list, or restore the file`,
                    });
                }
            }
        }

        results.push({
            guard: guard.id,
            severity: guard.severity,
            title: guard.title,
            /* A FILE GUARD COUNTS FILES AND HAS NO BLOCKS. Reported as zero rather than
             * as a coincidence: `scanned.length` would print the file count in the block
             * column and a set of characters in the file column, which reads like a
             * measurement and is not one. */
            blocksScanned: guard.kind === 'files' ? 0 : scanned.length,
            filesScanned: guard.kind === 'files'
                ? scanned.length
                : new Set(scanned.map((b) => b.file)).size,
            exempt: guard.exempt,
            violations,
        });
    }

    const violations = results.flatMap((r) => r.violations);
    return {
        root,
        roots,
        files,
        blocks: blocks.length,
        declarations: blocks.reduce((n, b) => n + b.declarations.length, 0),
        results,
        violations,
        errors: violations.filter((v) => v.severity === 'error'),
        warnings: violations.filter((v) => v.severity !== 'error'),
        ok: violations.every((v) => v.severity !== 'error'),
    };
}

async function fileExists(abs) {
    try {
        const stat = await fsp.stat(abs);
        return stat.isFile();
    } catch {
        return false;
    }
}

function clip(text, n = 90) {
    const one = String(text).replace(/\s+/g, ' ').trim();
    return one.length > n ? one.slice(0, n - 1) + '…' : one;
}

export function formatReport(report) {
    const lines = [];
    lines.push(`Gate C — ${report.files.length} authored files, ${report.blocks} CSS blocks, ${report.declarations} declarations`);
    for (const r of report.results) {
        const bad = r.violations.length;
        const mark = bad === 0 ? 'PASS' : (r.severity === 'error' ? 'FAIL' : 'WARN');
        const scope = r.blocksScanned === 0
            ? `${r.filesScanned} files`
            : `${r.filesScanned} files, ${r.blocksScanned} blocks`;
        lines.push(`  [${mark}] ${r.guard} — ${r.title} (${scope}${r.exempt.length ? `, exempt: ${r.exempt.join(', ')}` : ''})`);
        for (const v of r.violations) {
            lines.push(`         ${v.file}:${v.line}  ${v.message}`);
            if (v.detail) lines.push(`             ${v.detail}`);
            if (v.fix) lines.push(`             fix: ${v.fix}`);
        }
    }
    lines.push(report.ok
        ? 'Gate C: OK'
        : `Gate C: FAILED — ${report.errors.length} violation${report.errors.length === 1 ? '' : 's'}`);
    return lines.join('\n');
}

/* ===========================================================================
 * CLI
 * =========================================================================== */

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);

if (isMain) {
    const argv = process.argv.slice(2);
    const json = argv.includes('--json');
    const onlyIdx = argv.indexOf('--only');
    const only = onlyIdx === -1 ? null : argv[onlyIdx + 1].split(',');

    const report = await runGuards({ only });
    if (json) console.log(JSON.stringify(report, null, 2));
    else console.log(formatReport(report));
    process.exit(report.ok ? 0 : 1);
}
