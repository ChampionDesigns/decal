/**
 * The screensaver picture controls, driven through the leaf.
 *
 * Adds files and folders through the hidden input, and reads what the page keeps, refuses
 * and says when a file is not a picture, is empty, is too large or does not fit.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, BENCH } from '../harness/index.js';

const MODULES = ['/test/fixtures/settings-shell-fixture.js'];
const STAGE = '<div id="stage" style="inline-size: 100%; block-size: 100dvh"></div>';

const TINY_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

describe('the screen saver\'s pictures', () => {
    let page;

    before(async () => {
        page = await browser.newPage({ geometry: BENCH });
        await page.mount(STAGE, MODULES);
        await page.evalFn(() => window.__settings.mount().then(() => true));
        assert.deepEqual(page.pageErrors, [], 'the screen must mount without throwing');
    });

    after(async () => { await page?.close(); });

    const show = async (categoryId, leafId) => {
        await page.evalFn(async (c, l) => {
            await window.__settings.selectCategory(c);
            await window.__settings.selectLeaf(l);
            return true;
        }, categoryId, leafId);
        await page.settle();
    };

    const settledImages = async () => {
        await page.eval(`(async()=>{const {settingsImagesFor}=await import('/src/screens/settings-images.js');const controller=settingsImagesFor(__settings.screen().bespoke.settings,window);await controller.settled();return true})()`);
        await page.settle();
    };
    const openSaver = async () => { await show('display', 'display-screen-saver'); await settledImages(); };

    const saver = () => page.evalFn(() => {
        const root = document.querySelector('settings-screen')
            .shadowRoot.getElementById('bespoke').shadowRoot;
        const text = (id) => root.getElementById(id)?.textContent.trim() ?? null;
        return {
            thumbs: [...root.querySelectorAll('.thumb')].map((img) => img.getAttribute('src')),
            count: text('saver-count'),
            builtIn: text('saver-default-note'),
            outcome: text('saver-outcome'),
            hasClear: Boolean(root.getElementById('saver-clear')),
            picksDisabled: root.getElementById('saver-pick-files')?.disabled ?? null,
            stored: window.__settings.settingValue('screensaverImages'),
            tiles: [...root.querySelectorAll('.saver-tile[data-saver-id]')].map((tile) => ({
                id: tile.dataset.saverId, status: tile.dataset.saverStatus,
                warning: tile.querySelector('.saver-warning')?.textContent.trim() ?? null,
                replaceDisabled: tile.querySelector('.saver-replace')?.disabled,
                removeDisabled: tile.querySelector('.saver-remove')?.disabled,
            })),
            details: text('saver-details'),
        };
    });

    const choose = async (buttonId, kinds) => {
        await page.evalFn(async (id, wanted) => {
            const bytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
            const wide = async () => {
                const canvas = document.createElement('canvas');
                canvas.width = 5000;
                canvas.height = 8;
                canvas.getContext('2d').fillRect(0, 0, 5000, 8);
                const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
                return new File([blob], 'wide.png', { type: 'image/png' });
            };
            const make = async (kind, index) => {
                const name = `pick-${index}.png`;
                if (kind === 'png') {
                    return new File([bytes(window.__TINY_PNG)], name, { type: 'image/png' });
                }
                if (kind === 'svg') return new File(['<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="green"/></svg>'], 'green.svg', { type: 'image/svg+xml' });
                if (kind === 'text') return new File(['this is not a picture'], name, { type: 'image/png' });
                if (kind === 'empty') return new File([], name, { type: 'image/png' });
                if (kind === 'huge') {
                    return new File([new Uint8Array(9 * 1024 * 1024)], name, { type: 'image/png' });
                }
                if (kind === 'wide') return wide();
                return new File(['x'], `notes-${index}.txt`, { type: 'text/plain' });
            };
            const files = [];
            for (let i = 0; i < wanted.length; i += 1) files.push(await make(wanted[i], i));
            const root = document.querySelector('settings-screen').shadowRoot.getElementById('bespoke').shadowRoot;
            const button = root.getElementById(id) ?? root.querySelector(id);
            const transfer = new DataTransfer();
            for (const file of files) transfer.items.add(file);
            button.input.files = transfer.files;
            button.input.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
        }, buttonId, kinds);

        await settledImages();
    };

    const press = async (id) => {
        await page.evalFn((buttonId) => {
            const root = document.querySelector('settings-screen').shadowRoot.getElementById('bespoke').shadowRoot;
            (root.getElementById(buttonId) ?? root.querySelector(buttonId)).click();
            return true;
        }, id);
        await settledImages();
    };

    const reset = async () => {
        await openSaver();
        await page.evalFn(() => window.__settings.change('display-screen-saver-enabled', true));
        await page.settle();
        await page.evalFn(() => window.__settings.change('display-screen-saver-type', 'image'));
        await page.settle();
        if ((await saver()).hasClear) await press('saver-clear');
    };

    before(async () => {
        await page.eval(`window.__TINY_PNG = ${JSON.stringify(TINY_PNG)}, true`);
    });

    test('pictures already on the device are on the page when it opens', async () => {

        await show('machine', 'machine-steam');
        await page.evalFn(() => window.__settings
            .seedStored('screensaverImages', ['data:image/png;base64,' + window.__TINY_PNG]).then(() => true));

        await openSaver();

        const shown = await saver();
        assert.deepEqual(shown.thumbs, ['data:image/png;base64,' + TINY_PNG],
            'the page draws what the device holds, not the built-in picture');
        assert.match(String(shown.count), /1/, 'and says how many there are');
    });

    test('a chosen picture appears in the preview without leaving the page', async () => {
        await reset();
        await choose('saver-pick-files', ['png']);

        const shown = await saver();
        assert.equal(shown.thumbs.length, 1, 'the preview shows the picture that was chosen');
        assert.match(String(shown.thumbs[0]), /^data:image\/png;base64,/,
            'and it is the picked file, not the built-in one');
        assert.equal(shown.builtIn, null, 'the built-in note is gone');
        assert.equal(shown.hasClear, true, 'and the way back to the built-in picture is offered');
        assert.equal(shown.stored?.length, 1, 'one picture is stored');
    });

    test('going back to the built-in picture empties the preview without leaving the page', async () => {
        await reset();
        await choose('saver-pick-files', ['png']);
        await press('saver-clear');

        const shown = await saver();
        assert.deepEqual(shown.stored, [], 'nothing is stored any more');
        assert.equal(shown.hasClear, false, 'so there is nothing left to clear');
        assert.notEqual(shown.builtIn, null, 'and the page says the built-in picture is in use');
    });

    test('choosing a saver with no pictures makes the picture controls inert at once', async () => {
        await reset();
        await page.evalFn(() => window.__settings.change('display-screen-saver-type', 'black'));
        await page.settle();

        assert.equal((await saver()).picksDisabled, true,
            'Black shows no picture, so choosing one is not offered');

        await page.evalFn(() => window.__settings.change('display-screen-saver-type', 'image'));
        await page.settle();

        assert.equal((await saver()).picksDisabled, false,
            'and Image offers it again, without leaving the page');
    });

    test('a file that is not a picture never replaces a working saver', async () => {
        await reset();
        await choose('saver-pick-files', ['png']);
        const before_ = await saver();

        await choose('saver-pick-files', ['text']);

        const after_ = await saver();
        assert.deepEqual(after_.stored, before_.stored,
            'the picture that works is still the picture that is stored');
        assert.notEqual(after_.outcome, null, 'and the page says the file was not used');
    });

    test('an empty file is refused and says so', async () => {
        await reset();
        await choose('saver-pick-files', ['empty']);

        const shown = await saver();
        assert.deepEqual(shown.stored, [], 'nothing was stored');
        assert.notEqual(shown.outcome, null, 'and the page says why nothing changed');
    });

    test('a file too large to keep is refused and says so', async () => {
        await reset();
        await choose('saver-pick-files', ['huge']);

        const shown = await saver();
        assert.deepEqual(shown.stored, [], 'nothing was stored');
        assert.notEqual(shown.outcome, null, 'and the page says why nothing changed');
    });

    test('a picture too big to show is refused and says so', async () => {
        await reset();
        await choose('saver-pick-files', ['wide']);

        const shown = await saver();
        assert.deepEqual(shown.stored, [], 'nothing was stored');
        assert.notEqual(shown.outcome, null, 'and the page says why nothing changed');
    });

    test('a folder of mixed files keeps the pictures and names what was left out', async () => {
        await reset();
        await choose('saver-pick-folder', ['png', 'text', 'other']);

        const shown = await saver();
        assert.equal(shown.stored?.length, 1, 'the one picture that decodes is the one kept');
        assert.equal(shown.thumbs.length, 1, 'and the preview agrees with what was stored');
        assert.notEqual(shown.outcome, null, 'the file that could not be used is reported');
    });

    test('more pictures than this display keeps are reported, not dropped in silence', async () => {
        await reset();
        await choose('saver-pick-folder', Array.from({ length: 13 }, () => 'png'));

        const shown = await saver();
        assert.equal(shown.stored?.length, 12, 'twelve is what a display holds');
        assert.notEqual(shown.outcome, null, 'and the thirteenth is accounted for');
    });

    test('a folder whose first files are not pictures still fills the display', async () => {
        await reset();
        await choose('saver-pick-folder', [
            ...Array.from({ length: 12 }, () => 'text'),
            ...Array.from({ length: 12 }, () => 'png'),
        ]);

        const shown = await saver();
        assert.equal(shown.stored?.length, 12,
            'twelve refusals must not spend the twelve slots — the cap is on what is kept');
        assert.equal(shown.thumbs.length, 12, 'and the preview agrees with what was stored');
        assert.notEqual(shown.outcome, null, 'the files that were not pictures are reported');
    });

    test('a folder of thirty pictures still keeps twelve', async () => {
        await reset();
        await choose('saver-pick-folder', Array.from({ length: 30 }, () => 'png'));

        const shown = await saver();
        assert.equal(shown.stored?.length, 12, 'twelve is still what a display holds');
        assert.notEqual(shown.outcome, null, 'and the eighteen it did not take are accounted for');
    });

    test('a folder where nothing is a picture leaves the working saver alone', async () => {
        await reset();
        await choose('saver-pick-files', ['png']);
        const before_ = await saver();

        await choose('saver-pick-folder', Array.from({ length: 30 }, () => 'text'));

        const after_ = await saver();
        assert.deepEqual(after_.stored, before_.stored,
            'a saver that works is not traded for one that does not');
        assert.notEqual(after_.outcome, null, 'and the page says why nothing changed');
    });

    test('cancelled file selection preserves active images and unresolved tiles', async () => {
        await reset();
        await choose('saver-pick-files', ['png', 'text']);
        const before = await saver();
        await choose('saver-pick-files', []);
        const after = await saver();
        assert.deepEqual(after.stored, before.stored);
        assert.deepEqual(after.tiles, before.tiles);
        assert.equal(after.outcome, before.outcome);
    });

    test('failed tiles remain visible after another add and can be removed independently', async () => {
        await reset();
        await choose('saver-pick-files', ['png', 'text']);
        const failed = (await saver()).tiles.find((tile) => tile.status === 'unreadable');
        assert.match(failed.warning, /This file could not be opened/);
        assert.match(failed.warning, /Not active/);
        await choose('saver-pick-files', ['svg']);
        const added = await saver();
        assert.equal(added.stored.length, 2);
        assert.ok(added.tiles.some((tile) => tile.id === failed.id));
        await press(`[data-saver-id="${failed.id}"] .saver-remove`);
        const removed = await saver();
        assert.deepEqual(removed.stored, added.stored);
        assert.ok(!removed.tiles.some((tile) => tile.id === failed.id));
    });

    test('twelve active images keep an extra failure tile without offering an impossible replacement', async () => {
        await reset();
        await choose('saver-pick-folder', [...Array.from({ length: 12 }, () => 'png'), 'text', 'other']);
        const shown = await saver();
        assert.equal(shown.stored.length, 12);
        assert.equal(shown.tiles.filter((tile) => tile.status === 'active').length, 12);
        const failed = shown.tiles.find((tile) => tile.status === 'unreadable');
        assert.ok(failed);
        assert.equal(failed.replaceDisabled, true);
        assert.equal(failed.removeDisabled, false);
        assert.ok(shown.tiles.filter((tile) => tile.status === 'active').every((tile) => !tile.replaceDisabled && !tile.removeDisabled));
        assert.equal(shown.picksDisabled, true);
        assert.match(shown.details, /Not an image file/);
    });

    test('replacement failure keeps the active image and successful replacement retains its stable identity', async () => {
        await reset();
        await choose('saver-pick-files', ['png', 'svg']);
        const initial = await saver();
        const id = initial.tiles.find((tile) => tile.status === 'active').id;
        await choose(`[data-saver-id="${id}"] .saver-replace`, ['text']);
        const failed = await saver();
        assert.deepEqual(failed.stored, initial.stored);
        assert.match(failed.tiles.find((tile) => tile.id === id).warning, /Current image kept/);
        await choose(`[data-saver-id="${id}"] .saver-replace`, ['svg']);
        const replaced = await saver();
        assert.equal(replaced.stored.length, 2);
        assert.match(replaced.stored[0], /^data:image\/svg\+xml/);
        assert.equal(replaced.tiles[0].id, id);
        assert.equal(replaced.tiles[0].warning, null);
    });

    test('moving another tile keeps the same native replacement input attached to its image', async () => {
        await reset();
        await choose('saver-pick-files', ['png', 'svg']);
        const initial = await saver();
        const [first, second] = initial.tiles;
        await page.evalFn((id) => { window.__pendingReplacementInput = __settings.bespokeEl().shadowRoot.querySelector(`[data-saver-id="${id}"] .saver-replace`).input; return true; }, second.id);
        await press(`[data-saver-id="${first.id}"] .saver-remove`);
        assert.equal(await page.evalFn((id) => window.__pendingReplacementInput === __settings.bespokeEl().shadowRoot.querySelector(`[data-saver-id="${id}"] .saver-replace`).input, second.id), true);
        await choose(`[data-saver-id="${second.id}"] .saver-replace`, ['png']);
        const replaced = await saver();
        assert.equal(replaced.stored.length, 1);
        assert.match(replaced.stored[0], /^data:image\/png/);
        assert.equal(replaced.tiles[0].id, second.id);
    });

    test('local storage refusal preserves the current preview and reports the unsaved candidate', async () => {
        await reset();
        await choose('saver-pick-files', ['png']);
        const before = await saver();
        await page.eval('__settings.refuseLocalWrites(true)');
        try {
            await choose('saver-pick-files', ['svg']);
            const after = await saver();
            assert.deepEqual(after.stored, before.stored);
            assert.deepEqual(after.thumbs, before.thumbs);
            assert.match(after.outcome, /could not be saved/);
            assert.ok(after.tiles.some((tile) => tile.status === 'not-saved' && /Not active/.test(tile.warning)));
        } finally { await page.eval('__settings.refuseLocalWrites(false)'); }
    });

    test('the built-in note only speaks when the saver shows a picture', async () => {
        await reset();
        assert.notEqual((await saver()).builtIn, null,
            'with Image chosen and nothing added, the built-in picture IS what shows');

        for (const type of ['black', 'clock']) {
            await page.evalFn((v) => window.__settings.change('display-screen-saver-type', v), type);
            await page.settle();
            assert.equal((await saver()).builtIn, null,
                `${type} draws no picture at all, so "Using the built-in image" is not true`);
        }

        await page.evalFn(() => window.__settings.change('display-screen-saver-type', 'image'));
        await page.settle();
        assert.notEqual((await saver()).builtIn, null, 'and it comes back with the type');
    });

    test('EVERY part of the inactive section is dimmed exactly once', async () => {
        await reset();

        await choose('saver-pick-files', ['png']);

        const walk = () => page.evalFn(() => {
            const root = document.querySelector('settings-screen')
                .shadowRoot.getElementById('bespoke').shadowRoot;
            const group = root.getElementById('saver-images');
            const out = [];
            const visit = (node, carried) => {
                for (const el of node.children) {
                    const own = parseFloat(getComputedStyle(el).opacity);
                    const effective = carried * (Number.isNaN(own) ? 1 : own);
                    out.push({
                        name: el.tagName.toLowerCase() + (el.id ? `#${el.id}` : ''),
                        disabled: el.hasAttribute('disabled')
                            || el.getAttribute('aria-disabled') === 'true',
                        effective: +effective.toFixed(4),
                    });
                    visit(el, effective);
                }
            };
            const groupOwn = parseFloat(getComputedStyle(group).opacity);
            visit(group, Number.isNaN(groupOwn) ? 1 : groupOwn);
            return { groupOwn, out };
        });

        await page.evalFn(() => window.__settings.change('display-screen-saver-type', 'black'));
        await page.settle();
        const dial = Number(await page.resolveToken('--ui-opacity-disabled', 'opacity'));
        const dimmed = await walk();

        const twice = dimmed.out.filter((el) => el.effective < dial - 0.0001);
        assert.deepEqual(twice, [],
            'these are dimmed more than once: ' + JSON.stringify(twice));

        const ink = dimmed.out.filter((el) => /^(h3|p|img|ui-file-button|ui-button|ui-icon-button)/
            .test(el.name));
        assert.ok(ink.length >= 8, `the group should be fuller than this: ${ink.length}`);
        const undimmed = ink.filter((el) => el.effective > dial + 0.0001);
        assert.deepEqual(undimmed, [],
            'these carry ink and are not dimmed at all: ' + JSON.stringify(undimmed));

        assert.ok(dimmed.out.some((el) => el.name.includes('saver-pick-files') && el.disabled),
            'the Add button must still be disabled');

        await page.evalFn(() => window.__settings.change('display-screen-saver-type', 'image'));
        await page.settle();
        const live = await walk();
        assert.deepEqual(live.out.filter((el) => el.effective !== 1 && !el.disabled), [],
            'with Image chosen nothing in the section is dimmed');
    });
});
