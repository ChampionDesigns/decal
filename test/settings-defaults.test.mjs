/**
 * The decisions table, and the drift it is meant to prevent.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
    STORED_DEFAULTS, MACHINE_FALLBACKS, HOT_WATER_STOP, defaultFor, hasDefault, machineFallbackFor,
} from '../src/lib/settings-defaults.js';
import { STORAGE_ROUTES, settingsKeys } from '../src/lib/storage-routes.js';
import { SETTINGS_ROWS } from '../src/lib/settings-leaves.js';

describe('the decisions table answers for the keys it claims to answer for', () => {
    test('every decided default names a real settings key, or is named as not yet one', () => {
        const awaitingARoutingRow = Object.freeze({
            visualizerAutoUpload: 'the visualizer.reaplugin plugin owns it — storage-routes.js has it as layer:none, retired',
            visualizerThreshold: 'no routing row yet; arrives with the Visualizer leaf',
            feedbackIncludeLogs: 'no routing row yet; arrives with the Talk to Decent leaf',
            feedbackIncludeSystemInfo: 'as feedbackIncludeLogs',
        });
        const known = new Set(settingsKeys());
        for (const key of Object.keys(STORED_DEFAULTS)) {
            if (Object.hasOwn(awaitingARoutingRow, key)) {
                assert.equal(known.has(key), false,
                    `${key} has a routing row now — drop it from awaitingARoutingRow`);
                continue;
            }
            assert.ok(known.has(key),
                `STORED_DEFAULTS.${key} is not a settings key — it needs a row in storage-routes.js, `
                + 'or a line in awaitingARoutingRow saying why it has none');
        }
    });

    test("the two experimental flags read ON, which is the second half of the decision", () => {
        assert.equal(defaultFor('experimentalFusedChannels'), true);
        assert.equal(defaultFor('experimentalCollapseDetection'), true);
    });

    test('a key with no decision answers undefined, and says so through hasDefault', () => {
        /* UNDEFINED IS THE ANSWER, never a fallback of its own — a caller that could not
         * tell "no default" from "the default is false" would turn every undecided switch
         * off by accident. */
        assert.equal(defaultFor('screensaverImages'), undefined);
        assert.equal(hasDefault('screensaverImages'), false);
        assert.equal(hasDefault('clockFormat'), true);
    });

    test('a machine fallback is keyed by the MACHINE field name, not by the limit key', () => {
        const fields = new Set(SETTINGS_ROWS.filter((row) => row.field).map((row) => row.field));
        for (const field of Object.keys(MACHINE_FALLBACKS)) {
            assert.ok(fields.has(field),
                `MACHINE_FALLBACKS.${field} matches no row's \`field\` — check the spelling against settings-leaves.js`);
        }
        assert.equal(machineFallbackFor('steamTargetTemperature'), 160);
        assert.equal(machineFallbackFor('steamTemp'), undefined, 'the limit key is not a field name');
    });

    test('every exported constant in this file has an importer somewhere in src/', async () => {
        const { readFileSync, readdirSync, statSync } = await import('node:fs');
        const { fileURLToPath } = await import('node:url');
        const path = await import('node:path');
        const root = path.resolve(fileURLToPath(new URL('../src', import.meta.url)));
        const files = [];
        (function walk(dir) {
            for (const entry of readdirSync(dir)) {
                const full = path.join(dir, entry);
                if (statSync(full).isDirectory()) walk(full);
                else if (entry.endsWith('.js') && !full.endsWith('settings-defaults.js')) files.push(full);
            }
        })(root);
        const corpus = files.map((f) => readFileSync(f, 'utf8')).join('\n');
        for (const name of ['HOT_WATER_STOP',
            'defaultFor', 'machineFallbackFor', 'hasDefault']) {
            assert.ok(new RegExp(`\\b${name}\\b`).test(corpus),
                `${name} is exported and nothing in src/ reads it — a finished half with no other half`);
        }
        assert.equal(HOT_WATER_STOP.withoutScale, 'volume');
    });
});

const NO_DEFAULT_AND_WHY = Object.freeze({
    flushPresets: 'a LIST of remembered values; the empty list is what an unread key already is',
    hotWaterTempPresets: 'as flushPresets',
    hotWaterVolPresets: 'as flushPresets',
    screensaverImages: 'a LIST of images the user added; nothing to decide in advance',
    keyboardBindings: 'a MAP, and the shipped bindings live in key-bindings.js where they are used',
    theme: 'decided by theme.js DEFAULT_THEME, behind prefers-color-scheme, and stamped before paint',
});

describe('a stored key with no control either has a decision or names why it has none', () => {
    test('the two lists together cover every settings key that no row draws', () => {
        const drawn = new Set(SETTINGS_ROWS.filter((row) => row.key).map((row) => row.key));
        const unaccounted = [];
        for (const key of settingsKeys()) {
            if (drawn.has(key)) continue;
            if (hasDefault(key)) continue;
            if (Object.hasOwn(NO_DEFAULT_AND_WHY, key)) continue;
            unaccounted.push(`${key} (${STORAGE_ROUTES[key].layer}, ${STORAGE_ROUTES[key].status})`);
        }
        assert.deepEqual(unaccounted, [],
            'each of these stores a value nothing sets: give it a decided default in '
            + 'settings-defaults.js, or name it in NO_DEFAULT_AND_WHY with the reason');
    });

    test('the exemption list has not rotted — every name in it is still a key with no row', () => {
        const known = new Set(settingsKeys());
        const drawn = new Set(SETTINGS_ROWS.filter((row) => row.key).map((row) => row.key));
        for (const key of Object.keys(NO_DEFAULT_AND_WHY)) {
            assert.ok(known.has(key), `NO_DEFAULT_AND_WHY names ${key}, which is not a settings key`);
            assert.equal(drawn.has(key), false, `${key} has a control row now — it can be decided`);
            assert.equal(hasDefault(key), false, `${key} has a decided default now — drop the exemption`);
        }
    });
});
