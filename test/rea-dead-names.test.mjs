// The dead-name scan: an executing check that no module in Decal READS a name ReaPrime
// deleted — the rule the whole address layer exists to enforce (A7).
//
// It ships with a canary and a clean control, because every guard failure recorded in this
// project was a guard that had quietly stopped covering its target. `reads-dead-name.js`
// must fail the scan; `clean-control.js` — which names every dead key in PROSE — must
// pass it, since a comment-blind scanner produces a false positive, a false positive earns
// an exemption, and an exemption is how coverage dies.
//
// THE ONE DECLARED HOME is src/data/rea-names.js. The rule is not "rea-names.js is exempt"
// but "exactly one file may contain these, and it must be that one, and it must contain
// them all" — so the check cannot go vacuous by the table being emptied.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { DEAD_NAMES_GLOBAL } from '../src/data/rea-names.js';

const REPO = fileURLToPath(new URL('../', import.meta.url));
const DECLARED_HOME = 'src/data/rea-names.js';

/**
 * A per-character mask of "this character is inside a comment", tracking JavaScript
 * lexical state: line comments, block comments, the three string forms, and escapes.
 * Nested template interpolations are treated as code, which is what they are.
 */
function commentMask(source) {
    const mask = new Uint8Array(source.length);
    let state = 'code';
    for (let i = 0; i < source.length; i += 1) {
        const c = source[i];
        const next = source[i + 1];
        if (state === 'code') {
            if (c === '/' && next === '/') { state = 'line'; mask[i] = 1; }
            else if (c === '/' && next === '*') { state = 'block'; mask[i] = 1; }
            else if (c === "'" || c === '"' || c === '`') state = c;
        } else if (state === 'line') {
            mask[i] = 1;
            if (c === '\n') state = 'code';
        } else if (state === 'block') {
            mask[i] = 1;
            if (c === '*' && next === '/') { mask[i + 1] = 1; i += 1; state = 'code'; }
        } else {
            if (c === '\\') i += 1;
            else if (c === state) state = 'code';
        }
    }
    return mask;
}

/** Dead names appearing OUTSIDE a comment, with their line numbers. */
export function deadNameHits(source, names = DEAD_NAMES_GLOBAL) {
    const mask = commentMask(source);
    const hits = [];
    for (const name of names) {
        const re = new RegExp(`\\b${name}\\b`, 'g');
        for (const match of source.matchAll(re)) {
            if (mask[match.index]) continue;
            hits.push({ name, line: source.slice(0, match.index).split('\n').length });
        }
    }
    return hits;
}

const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return walk(path);
    return entry.isFile() && path.endsWith('.js') ? [path] : [];
});

describe('the scanner bites, and only where it should', () => {
    const fixture = (name) => readFileSync(`${REPO}test/fixtures/dead-names/${name}`, 'utf8');

    test('the canary fails: a dead name read behind a fallback', () => {
        const hits = deadNameHits(fixture('reads-dead-name.js'));
        const names = new Set(hits.map((h) => h.name));
        assert.ok(names.has('puckResistance'), 'the property read');
        assert.ok(names.has('fusedR2'), 'the property read');
        assert.ok(names.has('estFlags'), "the bracketed string read — data['estFlags']");
        assert.ok(names.has('detEventCount'));
        assert.ok(hits.length >= 5, `expected several hits, got ${hits.length}`);
    });

    test('the clean control passes, despite naming every dead key in prose', () => {
        assert.deepEqual(deadNameHits(fixture('clean-control.js')), []);
    });

    test('the mask is not simply blanking everything', () => {
        // Otherwise the control would "pass" for the wrong reason.
        assert.deepEqual(deadNameHits("const x = 'fusedR1'; // fusedR2"), [{ name: 'fusedR1', line: 1 }]);
        assert.deepEqual(deadNameHits('/* fusedR1 */ const y = 1;'), []);
        assert.deepEqual(deadNameHits('const z = `${data.fusedC}`;'), [{ name: 'fusedC', line: 1 }]);
    });
});

describe('the tree', () => {
    const files = walk(`${REPO}src`).map((p) => p.slice(REPO.length));

    test('there are modules to scan', () => {
        assert.ok(files.length >= 5, `only ${files.length} files found under src/`);
        assert.ok(files.includes(DECLARED_HOME));
    });

    test('no module outside the declared home reads a dead name', () => {
        const offenders = files
            .filter((f) => f !== DECLARED_HOME)
            .map((f) => ({ file: f, hits: deadNameHits(readFileSync(REPO + f, 'utf8')) }))
            .filter((r) => r.hits.length > 0)
            .map((r) => `${r.file}: ${r.hits.map((h) => `${h.name}@${h.line}`).join(', ')}`);
        assert.deepEqual(offenders, []);
    });

    test('the declared home still declares them all — so this check cannot go vacuous', () => {
        const source = readFileSync(REPO + DECLARED_HOME, 'utf8');
        const found = new Set(deadNameHits(source).map((h) => h.name));
        assert.deepEqual([...DEAD_NAMES_GLOBAL].filter((n) => !found.has(n)), []);
        assert.ok(DEAD_NAMES_GLOBAL.length >= 14, `${DEAD_NAMES_GLOBAL.length} dead names tabled`);
    });
});
