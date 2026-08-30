// The dead-surface exclusion list, made executable.
//
// src/data/EXCLUDED.md is the record of what was deliberately NOT built and why. A record
// that only a person can enforce is a record a later wave walks past — and the specific
// failure this guards against is the helpful one: a builder who needs a presence pane
// finds `signalHeartbeat` in the old module, sees a real route behind it, and ports it
// without noticing that the reason it is missing is that IT WAS NEVER CALLED.
//
// So the scan is deliberately narrow. It covers symbols and paths where re-introduction
// is unambiguously wrong: routes ReaPrime does not serve, a parameter no handler reads,
// duplicate implementations, and the wrappers whose defect IS their absence of a caller.
// It does NOT cover the beans and grinders routes, which are real and which a future
// screen will legitimately call through the generated client — what is excluded there is
// fifteen hand-written wrappers with no callers, and a name scan cannot tell those apart
// from honest use. That distinction is in EXCLUDED.md, in words, where it belongs.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '../scripts/lib/source-scan.js';

const SRC = fileURLToPath(new URL('../src/', import.meta.url));
const FIXTURES = fileURLToPath(new URL('./fixtures/excluded-surface/', import.meta.url));
const EXCLUDED_MD = fileURLToPath(new URL('../src/data/EXCLUDED.md', import.meta.url));

/**
 * Old-skin identifiers that must not reappear as code. Each has a row in EXCLUDED.md, and
 * a test below asserts that correspondence, so the list and the reasons cannot drift.
 */
export const EXCLUDED_SYMBOLS = Object.freeze([
    'signalHeartbeat',
    'previewLedStrip',
    'clearLedStripPreview',
    'getValueFromStore',
    'setValueInStore',
    'resyncIfDrifted',
    'connectProfileGeneratedWebSocket',
    'reatsettingscache',
    'currentShotSettings',
    'updateShotSettingsCache',
    'sendShotSettings',
    'uploadMachineProfile',
    'getDisplayState',
    'isValidProfile',
    'buildCalibrateBody',
    'setCupWarmerPrewarm',
    'orderBy',
]);

/** Route text that addresses something ReaPrime does not serve. */
export const EXCLUDED_PATHS = Object.freeze([
    'ledStrip/preview',
    'machine/scale/calibrate',
]);

/** Files under `root`, recursively, ending in .js. */
function jsFiles(root, rel = '') {
    const out = [];
    for (const entry of readdirSync(join(root, rel), { withFileTypes: true })) {
        const next = rel ? `${rel}/${entry.name}` : entry.name;
        if (entry.isDirectory()) out.push(...jsFiles(root, next));
        else if (entry.name.endsWith('.js')) out.push(next);
    }
    return out.sort();
}

/** Hits in one source: excluded symbols outside comments and strings, paths outside comments. */
export function excludedHits(source) {
    const code = stripComments(source, { dropStrings: true });
    const withStrings = stripComments(source);
    const hits = [];
    for (const symbol of EXCLUDED_SYMBOLS) {
        if (new RegExp(`\\b${symbol}\\b`).test(code)) hits.push(symbol);
    }
    for (const path of EXCLUDED_PATHS) {
        if (withStrings.includes(path)) hits.push(path);
    }
    return hits;
}

describe('the canary pair', () => {
    test('a file that ports dead surface is rejected', () => {
        const hits = excludedHits(readFileSync(join(FIXTURES, 'ports-excluded.js'), 'utf8'));
        assert.deepEqual(hits.sort(), ['ledStrip/preview', 'orderBy', 'previewLedStrip', 'signalHeartbeat'].sort());
    });

    test('a file that names every excluded symbol in prose passes', () => {
        assert.deepEqual(excludedHits(readFileSync(join(FIXTURES, 'clean-control.js'), 'utf8')), []);
    });
});

describe('the tree is clean', () => {
    const files = jsFiles(SRC);

    test('there are source files to scan', () => {
        assert.ok(files.length >= 15, `expected a populated src/, found ${files.length}`);
    });

    for (const file of files) {
        test(`src/${file}`, () => {
            const hits = excludedHits(readFileSync(join(SRC, file), 'utf8'));
            assert.deepEqual(hits, [], `src/${file} re-introduces excluded surface: ${hits.join(', ')} — see src/data/EXCLUDED.md`);
        });
    }
});

describe('EXCLUDED.md and the scan say the same thing', () => {
    const doc = readFileSync(EXCLUDED_MD, 'utf8');

    for (const symbol of EXCLUDED_SYMBOLS) {
        test(`${symbol} has a row`, () => {
            assert.ok(doc.includes(symbol), `${symbol} is guarded but not explained in EXCLUDED.md`);
        });
    }

    for (const path of EXCLUDED_PATHS) {
        test(`${path} has a row`, () => {
            assert.ok(doc.includes(path), `${path} is guarded but not explained in EXCLUDED.md`);
        });
    }

    test('the doc cites the pinned commit', () => {
        assert.ok(doc.includes('2b047d02e42e29bf2d96a2aa964ef94e4a4daba3'));
    });

    test('the doc records how a row may be removed', () => {
        assert.match(doc, /How to remove a row/);
    });
});
