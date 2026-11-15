import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { SETTINGS_ROWS } from '../src/lib/settings-leaves.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const OLD_NAME = /reaprime/i;
const SHOWN_FIELDS = Object.freeze(['heading', 'caption', 'offOnlyNote', 'label', 'title', 'control']);

const readJson = (path) => JSON.parse(readFileSync(ROOT + path, 'utf8'));

test('no string in the English catalog names the app by its old name', () => {
    const { strings } = readJson('i18n/en.json');
    const named = Object.entries(strings).filter(([key, value]) => OLD_NAME.test(key) || OLD_NAME.test(value));
    assert.deepEqual(named.map(([key]) => key), []);
});

test('the catalog carries the texts that send the user to the app, under the name Decide', () => {
    const { strings } = readJson('i18n/en.json');
    for (const key of [
        'Decide address',
        'Manage skins and plugins in Decide. This skin cannot change them.',
        'Sending feedback needs a Decent account. Sign in to your Decent account in Decide, then submit again.',
        'Decide has not answered for its installed plugins.',
        'This Decide build cannot send feedback — it was compiled without a feedback token. Nothing you do here will change that.',
    ]) {
        assert.equal(strings[key], key);
    }
});

test('the skin description that the app lists names the app as Decide', () => {
    const { description } = readJson('skin-manifest.json');
    assert.doesNotMatch(description, OLD_NAME);
    assert.match(description, /\bDecide\b/);
});

test('no text shown on a settings row names the app by its old name', () => {
    const named = SETTINGS_ROWS.flatMap((row) => SHOWN_FIELDS
        .filter((field) => typeof row[field] === 'string' && OLD_NAME.test(row[field]))
        .map((field) => `${row.id ?? row.field}: ${field}`));
    assert.deepEqual(named, []);
    assert.ok(SETTINGS_ROWS.some((row) => row.heading === 'Decide address'));
});
