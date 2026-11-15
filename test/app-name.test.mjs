import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { SETTINGS_ROWS } from '../src/lib/settings-leaves.js';
import { SETTINGS_TREE } from '../src/lib/settings-nav.js';
import { BESPOKE_SEARCH_FIELDS, searchSettingControls } from '../src/lib/settings-search.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const OLD_NAME = /reaprime/i;
const SHOWN_FIELDS = Object.freeze(['heading', 'caption', 'offOnlyNote', 'label', 'title', 'control']);
const ITEM_FIELDS = Object.freeze(['label', 'note']);
const VID_NAME = /decaid/i;
const TRACKER_TEXTS = Object.freeze([
    'Feedback is filed as an issue on Decaid’s public issue tracker. Nobody replies here; for an answer, write to help@decentespresso.com.',
    'Thank you. It was filed against the Decaid project.',
    'Thank you. Filed as issue #{number} on the Decaid issue tracker.',
]);

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

test('no label or note of a settings row choice names the app by its old name', () => {
    const items = SETTINGS_ROWS.flatMap((row) => (row.items ?? []).map((item) => ({ row, item })));
    assert.ok(items.length > 0);
    const named = items.flatMap(({ row, item }) => ITEM_FIELDS
        .filter((field) => typeof item[field] === 'string' && OLD_NAME.test(item[field]))
        .map((field) => `${row.id ?? row.field}: ${item.value} ${field}`));
    assert.deepEqual(named, []);
});

test('the feedback texts name the issue tracker that reports go to as Decaid', () => {
    const { strings } = readJson('i18n/en.json');
    const filing = [
        'Feedback is filed as an issue on Decaid’s public issue tracker. Nobody replies here; for an answer, write to help@decentespresso.com.',
        'Thank you. It was filed against the Decaid project.',
        'Thank you. Filed as issue #{number} on the Decaid issue tracker.',
    ];
    for (const key of filing) {
        assert.equal(strings[key], key);
    }
    const trackerTexts = Object.keys(strings).filter((key) => /issue tracker|filed against|filed as an issue/i.test(key));
    assert.deepEqual(trackerTexts.filter((key) => /\bDecide\b/.test(key)), []);
    assert.deepEqual([...trackerTexts].sort(), [...filing].sort());
});

test('only the three issue tracker texts say Decaid, and every other text names the app as Decide', () => {
    const { strings } = readJson('i18n/en.json');
    const inCatalog = Object.entries(strings)
        .filter(([key, value]) => VID_NAME.test(key) || VID_NAME.test(value))
        .map(([key]) => key);
    assert.deepEqual([...inCatalog].sort(), [...TRACKER_TEXTS].sort());
    for (const key of [
        'Decide',
        'If this keeps happening, reopen the skin from Decide or reinstall its app files.',
        'Reload failed. Open the skin again from Decide.',
    ]) {
        assert.equal(strings[key], key);
    }

    const navNames = SETTINGS_TREE.flatMap((category) => [category, ...category.leaves])
        .filter((node) => VID_NAME.test(node.name))
        .map((node) => node.id);
    assert.deepEqual(navNames, []);
    const appLeaf = SETTINGS_TREE.flatMap((category) => category.leaves)
        .find((leaf) => leaf.id === 'extensions-decent-app-settings');
    assert.equal(appLeaf.name, 'Decide');

    const rowTexts = SETTINGS_ROWS.flatMap((row) => [
        ...SHOWN_FIELDS.map((field) => [`${row.id ?? row.field}: ${field}`, row[field]]),
        ...(row.items ?? []).flatMap((item) => ITEM_FIELDS.map((field) => [`${row.id ?? row.field}: ${item.value} ${field}`, item[field]])),
    ]);
    const fieldTexts = BESPOKE_SEARCH_FIELDS.map((field) => [field.id, field.heading]);
    const named = [...rowTexts, ...fieldTexts]
        .filter(([, value]) => typeof value === 'string' && VID_NAME.test(value))
        .map(([where]) => where);
    assert.deepEqual(named, []);
});

test('a search for either name of the app finds the app update check', () => {
    for (const query of ['decide', 'Decaid']) {
        const targets = searchSettingControls(query).map((hit) => hit.target ?? hit.node.id);
        assert.ok(targets.includes('app-check'), `${query}: ${targets.join(', ')}`);
    }
    const leaves = searchSettingControls('decide').map((hit) => hit.node.id);
    assert.ok(leaves.includes('extensions-decent-app-settings'), leaves.join(', '));
});
