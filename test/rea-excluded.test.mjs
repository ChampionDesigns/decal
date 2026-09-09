
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

/* The pin is READ, never restated — the doc has to cite the CURRENT pin. */
import { PINNED_COMMIT } from '../scripts/lib/rea-source.js';
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
        assert.deepEqual(hits.sort(), ['orderBy', 'signalHeartbeat'].sort());
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
        assert.ok(doc.includes(PINNED_COMMIT));
    });

    test('the doc records how a row may be removed', () => {
        assert.match(doc, /How to remove a row/);
    });
});
