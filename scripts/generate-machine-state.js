#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = fileURLToPath(new URL('../', import.meta.url));

/** The pinned ReaPrime reference worktree. Override for a differently-placed checkout. */
export const REA_ROOT = process.env.REA_ROOT || '../reaprime';

export const SOURCE_REL = 'lib/src/models/device/machine.dart';

/* READ, NEVER RESTATED. A second copy of the pin here is a second authority, and it
 * is what let this generator sit a pin behind the contract table. */
import { PINNED_COMMIT } from './lib/rea-source.js';

export { PINNED_COMMIT };

export const OUT_FILE = join(REPO_ROOT, 'src', 'data', 'machine-state.generated.js');

export const ENUMS = Object.freeze([
    { dart: 'MachineState', list: 'MACHINE_STATES', map: 'MACHINE_STATE' },
    { dart: 'MachineSubstate', list: 'MACHINE_SUBSTATES', map: 'MACHINE_SUBSTATE' },
]);

class GenerateError extends Error {
    constructor(message) {
        super(message);
        this.name = 'GenerateError';
    }
}

/** `schedIdle` -> `SCHED_IDLE`, `errorTSensor` -> `ERROR_T_SENSOR`, `errorOOM` -> `ERROR_OOM`. */
export function screamingCase(name) {
    return name
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
        .toUpperCase();
}

export function readSource({ reaRoot = REA_ROOT } = {}) {
    const path = join(reaRoot, SOURCE_REL);
    if (!existsSync(path)) {
        throw new GenerateError(
            `machine-state generator: ReaPrime source not found at ${path}.\n` +
            'This artifact is generated from the pinned reference worktree; set REA_ROOT ' +
            'to a checkout of ReaPrime at ' + PINNED_COMMIT + '.',
        );
    }
    return { path, source: readFileSync(path, 'utf8') };
}

export function resolveCommit({ reaRoot = REA_ROOT, require = true } = {}) {
    let head;
    try {
        head = execFileSync('git', ['-C', reaRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    } catch (e) {
        throw new GenerateError(
            `machine-state generator: cannot resolve HEAD of ${reaRoot} (${e.message}). ` +
            'The generated file stamps the commit it was generated from, so an unverifiable ' +
            'source is a hard failure, not a guess.',
        );
    }
    if (require && head !== PINNED_COMMIT) {
        throw new GenerateError(
            `machine-state generator: ${reaRoot} is at ${head}, not the pinned ${PINNED_COMMIT}.\n` +
            'Wave 0b stamps every contract entry with the pinned commit. Re-pin the worktree, ' +
            'or update PINNED_COMMIT deliberately and re-run every contract check with it.',
        );
    }
    return head;
}

export function parseEnum(source, name) {
    const start = source.search(new RegExp(`\\benum\\s+${name}\\s*\\{`));
    if (start < 0) throw new GenerateError(`machine-state generator: enum ${name} not found`);
    const open = source.indexOf('{', start);
    const close = source.indexOf('}', open);
    if (close < 0) throw new GenerateError(`machine-state generator: enum ${name} is unterminated`);
    const body = source.slice(open + 1, close)
        .replace(/\/\/[^\n]*/g, '')
        .replace(/\/\*[\s\S]*?\*\//g, '');
    if (/[;(]/.test(body)) {
        throw new GenerateError(
            `machine-state generator: enum ${name} is no longer a plain enum (found a member ` +
            'body). The parser is deliberately narrow — widen it deliberately.',
        );
    }
    const members = body.split(',').map((m) => m.trim()).filter(Boolean);
    if (members.length === 0) throw new GenerateError(`machine-state generator: enum ${name} is empty`);
    for (const member of members) {
        if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(member)) {
            throw new GenerateError(`machine-state generator: enum ${name} member "${member}" is not an identifier`);
        }
    }
    const seen = new Set();
    for (const member of members) {
        const key = screamingCase(member);
        if (seen.has(key)) throw new GenerateError(`machine-state generator: ${name} members collide as ${key}`);
        seen.add(key);
    }
    return members;
}

const quoted = (values, indent = '    ') => values.map((v) => `${indent}'${v}',`).join('\n');
const mapEntries = (values, indent = '    ') =>
    values.map((v) => `${indent}${screamingCase(v)}: '${v}',`).join('\n');

export function render({ reaRoot = REA_ROOT, requireCommit = true } = {}) {
    const { source } = readSource({ reaRoot });
    const commit = resolveCommit({ reaRoot, require: requireCommit });
    const digest = createHash('sha256').update(source).digest('hex');
    const parsed = ENUMS.map((e) => ({ ...e, members: parseEnum(source, e.dart) }));

    const blocks = parsed.map((e) => `
/** ReaPrime \`enum ${e.dart}\` — every member, in declaration order. */
export const ${e.list} = Object.freeze([
${quoted(e.members)}
]);

/** The same members by symbolic name. Generated, so it cannot drift from the enum. */
export const ${e.map} = Object.freeze({
${mapEntries(e.members)}
});
`.trimEnd()).join('\n');

    return `// GENERATED FILE — DO NOT EDIT.
//
//   generator: scripts/generate-machine-state.js
//   source:    ${SOURCE_REL} (ReaPrime)
//   commit:    ${commit}
//   sha256:    ${digest}
//
// Regenerate with \`node scripts/generate-machine-state.js\`; \`--check\` fails on a stale
// artifact and test/machine-state-freshness.test.mjs runs that check.
//
// Hand-editing this file reintroduces exactly the defect it exists to prevent: the old
// skin's hand copy invented \`READY: 'ready'\` (not a state in either direction) and lost
// \`schedIdle\` (which is one), and both shipped as live contract bugs.
${blocks}

/** Provenance, asserted by the freshness test rather than trusted. */
export const MACHINE_STATE_SOURCE = Object.freeze({
    file: '${SOURCE_REL}',
    commit: '${commit}',
    sha256: '${digest}',
});
`;
}

/** @returns {{ok: boolean, stale: boolean, expected: string, actual: string|null}} */
export function check(options = {}) {
    const expected = render(options);
    const actual = existsSync(OUT_FILE) ? readFileSync(OUT_FILE, 'utf8') : null;
    const stale = actual !== expected;
    return { ok: !stale, stale, expected, actual };
}

/** Write the artifact. @returns {{written: boolean, path: string}} */
export function generate(options = {}) {
    const { ok, expected } = check(options);
    if (!ok) writeFileSync(OUT_FILE, expected, 'utf8');
    return { written: !ok, path: OUT_FILE };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
    try {
        if (process.argv.includes('--check')) {
            const result = check();
            if (result.stale) {
                process.stderr.write(
                    'src/data/machine-state.generated.js is STALE — run: node scripts/generate-machine-state.js\n',
                );
                process.exit(1);
            }
            process.stdout.write('machine-state.generated.js is fresh\n');
        } else {
            const { written, path } = generate();
            process.stdout.write(`${written ? 'wrote' : 'unchanged'} ${path}\n`);
        }
    } catch (e) {
        process.stderr.write(`${e.message}\n`);
        process.exit(1);
    }
}
