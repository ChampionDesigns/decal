/**
 * ui-chart-legend-gallery-entry.test.mjs — the wave-3 #10 gallery entry, checked against
 * the contract `tools/gallery/entries.js` and `tools/gallery/README.md` document.
 *
 * WHY THE ENTRY IS ITS OWN FILE. `tools/gallery/entries.js` is a single shared array and
 * the run's rule is whole-file writes; N builders appending to it in parallel is N−1
 * entries lost. Each builder writes `tools/gallery/entries/<tag>.entry.js` and the wave's
 * reviewer wires them in serially. This file is what makes that hand-off safe: it asserts
 * the shape the gallery needs BEFORE the wiring, so a malformed entry is a red test here
 * rather than a battery photographing an empty stage.
 *
 * The other half is `test/render/ui-chart-legend.render.test.mjs`, which mounts the
 * component in a real browser at both Gate A geometries. What is checked HERE is only
 * what can be checked without one: shape, uniqueness, the module paths existing on disk,
 * and that every state's markup is honest about what it claims to show — a state
 * promising "one series turned off" and handing over five identical chips would
 * photograph as a state that exists, which is the failure this file is for.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

import { entry } from '../tools/gallery/entries/ui-chart-legend.entry.js';

const repo = (path) => new URL(`../${path}`, import.meta.url);

test('the entry has the documented shape', () => {
    assert.equal(entry.id, 'ui-chart-legend', 'the entry id is the tag name and the capture prefix');
    assert.equal(typeof entry.title, 'string');
    assert.ok(entry.title.length > 0);
    assert.equal(typeof entry.module, 'string');
    assert.ok(Array.isArray(entry.states) && entry.states.length > 0);

    for (const state of entry.states) {
        assert.match(state.id, /^[a-z0-9-]+$/, `state id ${state.id} is a capture filename, not a label`);
        assert.equal(typeof state.title, 'string');
        assert.match(state.html, /<ui-chart-legend[\s>]/, `state ${state.id} mounts no legend`);
        if (state.hostStyle !== undefined) assert.equal(typeof state.hostStyle, 'object');
    }
});

test('state ids are unique, because they are capture filenames', () => {
    const ids = entry.states.map((s) => `${entry.id}--${s.id}`);
    assert.equal(new Set(ids).size, ids.length, ids.join(', '));
});

test('the module the gallery imports exists, and so does what it imports', async () => {
    /* `module` is relative to tools/gallery/ — gallery.js does the import(), so the
     * specifier resolves against gallery.js wherever the entry was authored. */
    const module = new URL(`../tools/gallery/${entry.module}`, import.meta.url);
    assert.ok((await stat(module)).isFile(), `${entry.module} does not exist`);

    const source = await readFile(module, 'utf8');
    /* The demo defines nothing: it exists because gallery.js does exactly one import per
     * entry and one state mounts a chart card as well. If it ever grows a subclass, the
     * gallery stops photographing the shipping component. */
    assert.ok(!/customElements\.define|class\s+\w+\s+extends/.test(source),
        'the gallery must photograph the SHIPPING component, not a demo subclass');
    for (const imported of ['ui-chart-legend.js', 'ui-chart-card.js']) {
        assert.ok(source.includes(imported), `the demo must import ${imported}`);
        assert.ok((await stat(repo(`src/components/${imported}`))).isFile());
    }
});

test('every state states its items, and every item carries a key and words', () => {
    /* The component authors no word, so a state with no labels photographs as a row of
     * swatches with nothing beside them. */
    for (const state of entry.states) {
        const match = state.html.match(/items='([^']*)'/);
        assert.ok(match, `state ${state.id} hands the legend no items`);
        const items = JSON.parse(match[1].replace(/&#39;/g, "'"));
        assert.ok(items.length > 0);
        for (const item of items) {
            assert.equal(typeof item.key, 'string');
            assert.ok(item.key.length > 0, `an item in ${state.id} has no key`);
            assert.equal(typeof item.label, 'string');
            assert.ok(item.label.length > 0, `item ${item.key} in ${state.id} has no words`);
        }
    }
});

test('the swatch states really do show both weights and a dash', () => {
    /* §6.2's defect is a swatch that draws the same 3px mark whatever it stands for.
     * A gallery that only ever photographed major solid channels could not show the fix. */
    const live = JSON.parse(entry.states.find((s) => s.id === 'live-set').html
        .match(/items='([^']*)'/)[1]);
    assert.ok(live.some((i) => !i.minor && !i.dash), 'a major solid channel');
    assert.ok(live.some((i) => i.minor === true), 'a minor one, at --ui-chart-stroke-minor');
    assert.ok(live.some((i) => i.dash === 'dash'), 'and a dashed target');
    assert.ok(live.some((i) => i.dash === 'dashdot'),
        'plus a pattern CSS `dashed` cannot express — the point of reading DASH_PATTERNS');
});

test('the off and isolated states are actually off and isolated', () => {
    const off = JSON.parse(entry.states.find((s) => s.id === 'one-off').html
        .match(/items='([^']*)'/)[1]);
    assert.equal(off.filter((i) => i.off).length, 1, 'exactly one chip is off');

    const isolated = JSON.parse(entry.states.find((s) => s.id === 'isolated').html
        .match(/items='([^']*)'/)[1]);
    assert.equal(isolated.filter((i) => !i.off).length, 1, 'exactly one chip is left on');
    assert.ok(isolated.length > 2, 'and there is a crowd for it to be isolated from');
});

test('the readout state hands over already-formatted strings', () => {
    const state = entry.states.find((s) => s.id === 'with-readout');
    const values = JSON.parse(state.html.match(/values='([^']*)'/)[1]);
    const keys = JSON.parse(state.html.match(/items='([^']*)'/)[1]).map((i) => i.key);
    assert.deepEqual(Object.keys(values), keys, 'a readout per series, keyed the same way');
    for (const value of Object.values(values)) {
        assert.equal(typeof value, 'string',
            'strings, formatted by the consumer: this component owns no units and no locale');
    }
});

test('the container state changes the HOST, not the viewport', () => {
    const narrow = entry.states.find((s) => s.id === 'narrow-container');
    assert.ok(narrow, 'the entry must show the legend at a narrower container');
    assert.deepEqual(narrow.hostStyle, { 'inline-size': '380px' },
        'hostStyle is applied to the stage wrapper: same viewport, narrower host '
        + '(spec §2.1 Rule 1 — a component reads its own container)');
    const items = JSON.parse(narrow.html.match(/items='([^']*)'/)[1]);
    assert.ok(items.length >= 10, 'with enough chips that it genuinely has to wrap');
});

test('the layout-contract state gives the card a block size and an empty slot', () => {
    const inCard = entry.states.find((s) => s.id === 'in-the-cards-row');
    assert.ok(inCard, 'chart-C10 is the row this component is on the hook for');
    assert.match(inCard.html, /<ui-chart-card[\s>]/);
    assert.match(inCard.html, /slot="legend"/, 'the legend goes in the card\'s reserved row');
    assert.match(inCard.html, /block-size:\s*\d+px/,
        'a card in an auto-height stage builds its plot at zero and photographs empty');
    assert.match(inCard.html, /slot="empty"/,
        'and the card with no derivation says so in the consumer\'s own words');
});
