import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';
import { accessibleNames, namesFor } from '../harness/editor.js';

const MODULES = ['/test/fixtures/de1-emulation-name-fixture.js'];
const STAGE = '<div id="stage" style="inline-size: 100%; block-size: 100dvh"></div>';
const geometry = GATE_A_GEOMETRIES[0];

const ALPHA = 'profile:name0000';
const BETA = 'profile:name0001';
const GAMMA = 'profile:name0002';
const LONG = 'profile:name0003';

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

const home = ({ shape = geometry, theme = null, ...opts }, fn) => browser.withPage({ geometry: shape }, async (page) => {
    await page.mount(STAGE, MODULES);
    if (theme) await page.setTheme(theme);
    await page.evalFn((o) => window.__names.mount(o), opts);
    await page.evalFn(() => window.__names.show('live'));
    await page.settle(6);
    assert.deepEqual(page.pageErrors, [], 'the boot must start without throwing');
    const cells = await page.evalFn(() => window.__names.favourites());
    const byValue = Object.fromEntries(cells.map((cell) => [cell.value, cell]));
    return fn(byValue, page, cells);
});

const channels = (colour) => {
    const m = /rgba?\(([^)]+)\)/.exec(colour) ?? /color\(srgb ([^)]+)\)/.exec(colour);
    assert.ok(m, `not a colour: ${colour}`);
    const parts = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    const scale = colour.startsWith('color(') ? 1 : 255;
    return parts.slice(0, 3).map((v) => v / scale);
};

const luminance = (colour) => {
    const [r, g, b] = channels(colour).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a, b) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
};

const overlaps = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

const inside = (inner, outer) => inner.left >= outer.left - 0.5 && inner.right <= outer.right + 0.5
    && inner.top >= outer.top - 0.5 && inner.bottom <= outer.bottom + 0.5;

describe('the favourites bar marks a favourite that runs as a DE1', () => {
    test('the DE1 favourite has the pill; the power and the plain favourites do not',
        () => home({ supported: true }, async (cells) => {
            assert.equal(cells[ALPHA].badge, 'DE1');
            assert.equal(cells[BETA].badge, '');
            assert.equal(cells[GAMMA].badge, '');
        }));

    test('the name text is the plain short name',
        () => home({ supported: true }, async (cells) => {
            assert.equal(cells[ALPHA].name, 'Alpha bloom');
            assert.equal(cells[BETA].name, 'Beta power');
            assert.equal(cells[GAMMA].name, 'Gamma classic');
        }));

    test('the pill is hidden from a screen reader and the button says DE1 emulation',
        () => home({ supported: true }, async (cells, page) => {
            assert.equal(cells[ALPHA].badgeHidden, 'true');
            assert.equal(cells[ALPHA].a11y, 'Alpha bloom, DE1 emulation');
            assert.equal(cells[GAMMA].a11y, 'Gamma classic');
            const buttons = namesFor(await accessibleNames(page, ['button']), 'button');
            assert.ok(buttons.includes('Alpha bloom, DE1 emulation'), JSON.stringify(buttons));
            assert.ok(buttons.includes('Beta power'), JSON.stringify(buttons));
            assert.ok(buttons.includes('Gamma classic'), JSON.stringify(buttons));
            assert.equal(buttons.some((name) => name === 'DE1' || name.startsWith('DE1')), false);
        }));

    test('without machine support no favourite has the pill',
        () => home({ supported: false }, async (cells, _page, all) => {
            assert.equal(all.some((cell) => cell.badge !== ''), false, JSON.stringify(all));
            assert.equal(cells[ALPHA].a11y, 'Alpha bloom');
        }));

    test('with no support answer no favourite has the pill',
        () => home({ supported: null }, async (_cells, _page, all) => {
            assert.equal(all.some((cell) => cell.badge !== ''), false, JSON.stringify(all));
        }));
});

for (const shape of GATE_A_GEOMETRIES) {
    describe(`the pill sits in the top-left corner and leaves the name alone (${shape.name})`, () => {
        test('the pill is inside the button, at its top-left corner, clear of the name',
            () => home({ supported: true, long: true, shape }, async (cells) => {
                for (const id of [ALPHA, LONG]) {
                    const cell = cells[id];
                    assert.ok(cell.badgeBox && cell.badgeBox.width > 0, `${id} has no pill`);
                    assert.ok(inside(cell.badgeBox, cell.buttonBox), `${id}: ${JSON.stringify(cell)}`);
                    assert.ok(cell.badgeBox.left - cell.buttonBox.left <= 8, `${id}: ${JSON.stringify(cell)}`);
                    assert.ok(cell.badgeBox.top - cell.buttonBox.top <= 8, `${id}: ${JSON.stringify(cell)}`);
                    assert.equal(overlaps(cell.badgeBox, cell.nameBox), false, `${id}: ${JSON.stringify(cell)}`);
                }
            }));

        test('every name keeps its size and stays inside its button', async () => {
            const marked = await home({ supported: true, long: true, shape }, async (cells) => cells);
            const plain = await home({ supported: false, long: true, shape }, async (cells) => cells);
            assert.equal(marked[LONG].name, 'Extract Blooming Espresso');
            for (const id of [ALPHA, BETA, GAMMA, LONG]) {
                assert.equal(marked[id].name, plain[id].name, id);
                assert.equal(marked[id].nameBox.width, plain[id].nameBox.width, id);
                assert.equal(marked[id].nameBox.height, plain[id].nameBox.height, id);
                assert.equal(marked[id].nameWidth, plain[id].nameWidth, id);
                assert.equal(marked[id].nameClipped, plain[id].nameClipped, id);
                assert.ok(inside(marked[id].nameBox, marked[id].buttonBox), `${id}: ${JSON.stringify(marked[id])}`);
            }
        });

        test('all names in the bar share one line, with or without a pill',
            () => home({ supported: true, long: true, shape }, async (cells) => {
                const tops = new Set([ALPHA, BETA, GAMMA, LONG].map((id) => cells[id].nameBox.top));
                assert.equal(tops.size, 1, JSON.stringify([...tops]));
            }));
    });
}

for (const theme of ['dark', 'light']) {
    describe(`the pill keeps contrast (${theme})`, () => {
        test('the pill text keeps contrast on the selected and the unselected button',
            () => home({ supported: true, long: true, theme }, async (cells) => {
                assert.equal(cells[ALPHA].pressed, 'true');
                assert.equal(cells[LONG].pressed, 'false');
                assert.notEqual(cells[ALPHA].face, cells[LONG].face);
                for (const id of [ALPHA, LONG]) {
                    const ratio = contrast(cells[id].pillInk, cells[id].pillFace);
                    assert.ok(ratio >= 4.5, `${id}: ink on pill ${ratio.toFixed(2)}`);
                }
                const onSelected = contrast(cells[ALPHA].pillFace, cells[ALPHA].face);
                assert.ok(onSelected >= 3, `pill on the selected face ${onSelected.toFixed(2)}`);
            }));
    });
}
