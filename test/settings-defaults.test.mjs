/**
 * settings-defaults.test.mjs — the decisions table, and the drift it is meant to prevent.
 *
 * WHY A SUITE OF ITS OWN. `settings-defaults.js` holds Ben's answers, given through the
 * defaults picker built for O3 on 26 August 2026: "the current option should always be
 * shown as selected, read from the machine. Where its not a machine setting then we need to
 * decide what default value is." A table of decisions is only worth what it is checked
 * against, and two of the defects the 26 August audit found were failures OF THIS TABLE
 * rather than of any control:
 *
 *   - `clockFormat` was decided '12h' here and spelled H24 in `wall-clock.js`, so the Time
 *     page said 12-hour and both clocks drew 21:40. Pinned in `wall-clock.test.mjs`.
 *   - The two experimental Advanced flags were described BY A COMMENT as reading ON, in a
 *     file that had no entry for either. A comment asserting a default that does not exist
 *     is worse than either state on its own, because the next reader trusts it.
 *
 * The second one is what the last test here closes for good: a key this skin stores, with
 * no control to set it, either has a decided default or is NAMED BELOW with the reason it
 * has none. There is no third state, and "somebody meant to add one" stops being invisible.
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
        /* A TYPO HERE IS SILENT: `defaultFor` answers undefined for an unknown key and the
         * control renders empty, which looks exactly like "nobody decided". The routing
         * table is the register of what a key IS, so the two are checked against it.
         *
         * THE FOUR EXCEPTIONS ARE REAL AND ARE NAMED, not tolerated by a loose assertion.
         * Ben answered the defaults picker for the Visualizer and Feedback pages before
         * either was built, so this table holds decisions for keys `storage-routes.js` has
         * no row for — `settings.value()` THROWS on an unrouted key, so these four answers
         * cannot be read by anything today, and nothing in src/ asks. They are kept because
         * discarding a decision is worse than holding one early. What they are not is
         * reachable, and this list is where that is said. */
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

    test("the two experimental flags read ON, which is the second half of Ben's sentence", () => {
        /* Ben, 26 August 2026: "Remove the fused channels and collapse detection but keep
         * these settings on and hidden." The rows were deleted the same day; these two
         * entries are the "on" half, and they were missing for as long as the comment in
         * settings-leaves.js claimed they were here. */
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
        /* THE BUG THIS PINS was live until 26 August 2026: the model looks a fallback up
         * with `machineFallbackFor(row.field)` and a row's `field` is ReaPrime's spelling,
         * so `steamTemp` and `hotWaterTemp` in this table matched nothing at all. It was
         * invisible on the bench because a fallback only shows while the machine has not
         * answered, which is exactly when nobody is watching. */
        const fields = new Set(SETTINGS_ROWS.filter((row) => row.field).map((row) => row.field));
        for (const field of Object.keys(MACHINE_FALLBACKS)) {
            assert.ok(fields.has(field),
                `MACHINE_FALLBACKS.${field} matches no row's \`field\` — check the spelling against settings-leaves.js`);
        }
        assert.equal(machineFallbackFor('steamTargetTemperature'), 160);
        assert.equal(machineFallbackFor('steamTemp'), undefined, 'the limit key is not a field name');
    });

    test('every exported constant in this file has an importer somewhere in src/', async () => {
        /* THE FORK'S OWN DEFECT CLASS, caught in the file most likely to grow one: a
         * finished half with no other half. `HOT_WATER_STOP` was exported on 26 August with
         * Ben's whole rule written above it — "Weight for Bengle, Weight for the DE1 [if a]
         * scale is connected, weight grayed out if no scale is connected and volume
         * selected" — and NOTHING imported it, three lines below the defaults that do work.
         * The consequence was concrete: on a tablet with no scale the Hot Water page
         * defaulted to Weight, offered Weight ungreyed, and a pour started that way had no
         * stop at all. */
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
        for (const name of ['STORED_DEFAULTS', 'MACHINE_FALLBACKS', 'HOT_WATER_STOP',
            'defaultFor', 'machineFallbackFor', 'hasDefault']) {
            assert.ok(new RegExp(`\\b${name}\\b`).test(corpus),
                `${name} is exported and nothing in src/ reads it — a finished half with no other half`);
        }
        assert.equal(HOT_WATER_STOP.withoutScale, 'volume');
    });
});

/**
 * A stored key with no control, and the reason it has no decided default.
 *
 * EVERY ENTRY IS A COLLECTION OR A REMEMBERED READING, not a preference somebody forgot to
 * decide, and that is the distinction the list exists to hold: a default for a LIST is the
 * empty list, which is what an unread key already is, and a default for a value the skin
 * WROTE DOWN ITSELF is a contradiction — it is remembered precisely because nobody chose it
 * in advance.
 *
 * Adding a key here is a decision to be made out loud. Adding one to STORED_DEFAULTS is
 * Ben's answer. Doing neither now fails the test below.
 */
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
        /* THE DRIFT THIS REPLACES was a stale comment: settings-leaves.js said
         * "settings-defaults.js is what decides they read as ON" about two keys this table
         * had never heard of. A comment cannot fail. This can. */
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
        /* AN EXEMPTION THAT POINTS AT NOTHING has stopped protecting what it was written
         * for and may be shadowing a rename, which is the same rule `scripts/guards.js`
         * applies to its own exemptions. */
        const known = new Set(settingsKeys());
        const drawn = new Set(SETTINGS_ROWS.filter((row) => row.key).map((row) => row.key));
        for (const key of Object.keys(NO_DEFAULT_AND_WHY)) {
            assert.ok(known.has(key), `NO_DEFAULT_AND_WHY names ${key}, which is not a settings key`);
            assert.equal(drawn.has(key), false, `${key} has a control row now — it can be decided`);
            assert.equal(hasDefault(key), false, `${key} has a decided default now — drop the exemption`);
        }
    });
});
