import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchSettingControls, BESPOKE_SEARCH_FIELDS } from '../src/lib/settings-search.js';
import { SETTINGS_TREE, LEAF_CAPABILITIES, leavesFor, categoriesFor, searchSettings, leafFor } from '../src/lib/settings-nav.js';
const available = { machineClass: 'bengle', capability: () => 'present' };
const ids = (query, options = available) => searchSettingControls(query, options).map((hit) => hit.node.id);

test('search finds setting headings, synonyms, units and bespoke controls with exact targets', () => {
    for (const [query, id] of [
        ['brightness', 'display-screen-brightness'], ['milk', 'machine-steam-milk-target'],
        ['night', 'accessories-usb-charger-night'], ['temperature', 'machine-steam-temp'],
        ['scale', 'connection-scale-required'], ['font size', 'display-display-size-density'],
        ['°F', 'units-language-temperature-unit'], ['milliliters', 'machine-hot-water-volume'],
        ['mL/s', 'machine-steam-flow'], ['mm', 'machine-water-tank-unit'],
    ]) assert.ok(ids(query).includes(id), query);
    assert.equal(ids('brightness')[0], 'display-screen-brightness');
    const result = searchSettingControls('morning time', available).find((hit) => hit.target === 'night-morning');
    assert.equal(result.leaf.id, 'accessories-usb-charger');
    assert.equal(result.primitive, false);
    assert.ok(!ids('mm').includes('machine-water-tank-preheat'));
    const update = searchSettingControls('update all skins', available).find((hit) => hit.target === 'skins-update');
    assert.equal(update.heading, 'Update all skins');
    assert.ok(!searchSettingControls('check for updates', available).some((hit) => hit.target === 'skins-update'));
});

test('compound and translated search results retain category, page and control identity', () => {
    const matches = searchSettingControls('steam temperature', available);
    assert.ok(matches.some((hit) => hit.target === 'machine-steam-temp'));
    assert.ok(!matches.some((hit) => hit.target === 'machine-hot-water-temp'));
    const translated = searchSettingControls('luminosité', { ...available, translate: (word) => word === 'Screen brightness' ? 'Luminosité' : word });
    assert.equal(translated[0].node.id, 'display-screen-brightness');
    assert.equal(translated[0].category.id, 'display');
    assert.equal(translated[0].leaf.id, 'display-screen');
});

test('known unsupported leaves disappear from browsing and every search path while unknown stays distinct', () => {
    for (const [leafId, required] of Object.entries(LEAF_CAPABILITIES)) {
        const category = SETTINGS_TREE.find((entry) => entry.leaves.some((leaf) => leaf.id === leafId));
        const capability = (name) => name === required ? 'absent' : 'present';
        assert.ok(!leavesFor(category, 'de1', capability).some((leaf) => leaf.id === leafId));
        assert.ok(!searchSettings(leafFor(leafId).name, SETTINGS_TREE, 'de1', capability).some((hit) => hit.node.id === leafId));
        assert.ok(!searchSettingControls(leafFor(leafId).name, { machineClass: 'de1', capability }).some((hit) => hit.leaf?.id === leafId));
        assert.ok(leavesFor(category, null, () => 'unknown').some((leaf) => leaf.id === leafId));
    }
    const onlyLighting = [{ id: 'accessories', name: 'Accessories', leaves: [leafFor('accessories-lighting')] }];
    assert.deepEqual(categoriesFor(onlyLighting, 'de1', () => 'absent'), []);
});

test('machine-specific hidden rows and view-hidden controls are never returned', () => {
    assert.ok(!ids('flow calibration').includes('calibration-flow-multiplier-factor'));
    assert.ok(ids('flow calibration', { machineClass: 'de1', capability: () => 'absent' }).includes('calibration-flow-multiplier-factor'));
    assert.deepEqual(searchSettingControls('brightness', { ...available, views: () => [], fields: [] }), []);
    assert.ok(BESPOKE_SEARCH_FIELDS.every((field) => leafFor(field.leaf) && field.target));
});
