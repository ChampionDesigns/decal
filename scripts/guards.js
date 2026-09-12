#!/usr/bin/env node
/**
 * The authored-CSS guards.
 */

import fsp from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { collectAuthoredCss, listAuthoredFiles, DEFAULT_SCAN_ROOTS, REPO_ROOT } from './lib/authored-css.js';
import { findColourLiterals } from './lib/colour-literals.js';

/** The palette's one legitimate home. Nothing else in the tree may hold a literal. */
const TOKEN_SHEETS = ['styles/tokens.css', 'styles/chart-channels.css'];

export const colourLiteralGuard = {
    id: 'colour-literal',
    severity: 'error',
    title: 'no raw colour literal in authored component CSS',
    why: 'Gate C (A8). A fork retargets the template by editing the '
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
    why: 'Measured, not assumed: a face declared only in a shadow '
        + "root never registers — measureText('0123456789.') at 20px gives 105.00 (the "
        + 'unknown-family fallback) against 118.50 for the same face declared in the '
        + 'document, with document.fonts.size === 0. Canvas resolves ctx.font against the '
        + "DOCUMENT's registry, so this silently mis-measures every chart axis.",
    exempt: ['styles/document.css'],
    exemptWhy: 'the ONE place a face may be declared',
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
    why: 'The reference skin shell sheet carries 268 and '
        + '96 in the old sheet, every one of them because some other sheet could reach '
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
        + 'its own container and never the viewport — the fit '
        + 'is that rule reaching the last two declarations that broke it.',
    exempt: ['tools/gallery/index.html'],
    exemptWhy: 'the instrument host page, whose stage IS the viewport — it is what '
        + 'app-root is mounted INTO for a capture, so a viewport unit there is the ground '
        + 'being stated rather than the app reading it',
    check(blocks) {
        const out = [];
        for (const block of blocks) {
            for (const decl of block.declarations) {
                const hit = VIEWPORT_UNIT.exec(decl.value);
                if (!hit) continue;
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
