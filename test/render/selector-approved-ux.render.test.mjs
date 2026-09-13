/**
 * selector-approved-ux.render.test.mjs — the Profiles screen in the full app.
 *
 * Drives the shipping shell through the manage confirmations, the named favourite
 * replacement, file import and its retry, the generator handoff, and the return from
 * the editor — which has to restore the filter, the folders, the scroll and the focus.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { launch } from '../harness/index.js';
import { mountSelectorApp } from '../harness/selector-ux.js';

const geometry = { name: 'bench', width: 1281, height: 801, deviceScaleFactor: 1.5, mobile: false };
const S = 'app-root >>> selector-screen';
const E = 'app-root >>> editor-screen';
const output = process.env.DECAL_UX_EVIDENCE;
const until = (page, predicate) => page.evalFn(async source => {
    for (let i = 0; i < 250; i++) {
        if (Function(`return (${source})`)()) { await __ux.settle(); return true; }
        await new Promise(r => setTimeout(r, 20));
    }
    return false;
}, predicate);
async function capture(page, name) {
    if (!output) return;
    await mkdir(output, { recursive: true });
    await page.evalFn(async () => {
        __ux.screen()?.shadowRoot.getElementById('notice')?.clear?.();
        await __ux.settle(); await document.fonts.ready;
    });
    await page.settle(5);
    await writeFile(`${output}/${name}.png`, await page.screenshot());
}
const read = (page, id) => page.evalFn(id => __ux.screen().shadowRoot.getElementById(id)?.textContent.trim(), id);
async function chooseOther(page) {
    await page.evalFn(async () => {
        const s = __ux.screen(), input = s.shadowRoot.getElementById('filter');
        input.value = __ux.selected.profile.title;
        input.dispatchEvent(new CustomEvent('search', { detail: { value: input.value }, bubbles: true, composed: true }));
        await __ux.settle();
    });
    const id = await page.evalFn(() => __ux.selected.id);
    await page.click(`${S} >>> ui-list-row[data-id="${id}"]`);
    await page.evalFn(() => __ux.settle());
}

test('approved selector, file and modal UX through the full app', async t => {
    const browser = await launch();
    const page = await browser.newPage({ geometry });
    try {
        const mounted = await mountSelectorApp(page);
        assert.equal(mounted.phase, 'ready');
        assert.equal(mounted.route, 'selector');

        await t.test('loaded identity is visible and the loaded row is revealed', async () => {
            assert.equal(await read(page, 'confirm'), 'Use profile');
            const actual = await page.evalFn(() => {
                const s = __ux.screen(), r = s.shadowRoot;
                const option = r.getElementById('opt-' + __ux.loaded.id);
                const row = option.getBoundingClientRect();
                const list = r.getElementById('list-pane').shadowRoot.getElementById('list').getBoundingClientRect();
                return { pill: option.getAttribute('provenance'), card: !!r.getElementById('loaded-profile'),
                    title: __ux.loaded.profile.title, revealed: row.top >= list.top - 1 && row.bottom <= list.bottom + 1,
                    hide: !!r.getElementById('act-hide'), remove: !!r.getElementById('act-delete') };
            });

            assert.equal(actual.card, false);
            assert.equal(actual.pill, 'Loaded');
            assert.equal(await read(page, 'selection-context'), 'Loaded profile');
            assert.equal(actual.revealed, true);
            assert.equal(actual.hide, false); assert.equal(actual.remove, false);
            await chooseOther(page);
            assert.equal(await read(page, 'selection-context'), 'Preview selection');
            await capture(page, '07-selector-preview');
        });

        await t.test('Manage retains destructive confirmation and cancellation', async () => {
            await page.click(`${S} >>> #manage-open`);
            const index = await page.evalFn(() => __ux.screen().shadowRoot.getElementById('manage').items.findIndex(i => i.id === 'hide'));
            await page.click(`${S} >>> #manage >>> button[data-index="${index}"]`);
            assert.equal(await page.evalFn(() => __ux.screen().shadowRoot.getElementById('confirm-hide').open), true);
            await page.click(`${S} >>> #confirm-hide >>> #cancel`);
            assert.equal(await page.evalFn(() => __ux.calls.filter(c => c.method === 'DELETE').length), 0);
        });

        await t.test('named favourite replacement is cancellable and waits for persistence', async () => {
            const before = await page.evalFn(() => __ux.calls.filter(c => c.method === 'POST' && c.path.endsWith('/favouriteProfiles')).length);
            await page.click(`${S} >>> .assign-row ui-favourite-slot[data-slot="1"]`);
            assert.equal(await page.evalFn(() => __ux.screen().shadowRoot.getElementById('replace-favourite').open), true);
            const named = await read(page, 'replace-favourite');
            const titles = await page.evalFn(() => [__ux.loaded.profile.title, __ux.selected.profile.title]);
            for (const title of titles) assert.ok(named.includes(title));
            await capture(page, '07-favourite-replacement');
            await page.click(`${S} >>> #replacement-cancel`);
            assert.equal(await page.evalFn(() => __ux.calls.filter(c => c.method === 'POST' && c.path.endsWith('/favouriteProfiles')).length), before);
            await page.click(`${S} >>> .assign-row ui-favourite-slot[data-slot="1"]`);
            await page.evalFn(() => { __ux.control.failFavourite = true; __ux.control.holdFavourite = true; });
            await page.click(`${S} >>> #replacement-confirm`);
            assert.equal(await page.evalFn(() => __ux.screen().shadowRoot.getElementById('replacement-confirm').disabled), true);
            await page.press('Escape');
            assert.equal(await page.evalFn(() => __ux.screen().shadowRoot.getElementById('replace-favourite').open), true);
            await page.evalFn(() => { __ux.control.holdFavourite = false; __ux.control.release(); });
            assert.equal(await until(page, 'Boolean(__ux.screen().shadowRoot.getElementById("replacement-error"))'), true);
            assert.equal(await page.evalFn(() => __ux.boot.library.get().favourites.assignments[0]), mounted.loaded);
            assert.equal(await page.evalFn(() => __ux.calls.filter(c => c.method === 'POST' && c.path.endsWith('/machine/profile')).length), 0);
            await capture(page, '07-favourite-save-failed');
            await page.evalFn(() => { __ux.control.failFavourite = false; });
            await page.click(`${S} >>> #replacement-confirm`);
            assert.equal(await until(page, '!__ux.screen().shadowRoot.getElementById("replace-favourite").open'), true);
            assert.equal(await page.evalFn(() => __ux.boot.library.get().favourites.assignments[0]), mounted.selected);
            assert.equal(await page.evalFn(() => __ux.calls.filter(c => c.method === 'POST' && c.path.endsWith('/machine/profile')).length), 1);
        });

        await t.test('file validation names the file and missing fields in its own dialog', async () => {
            await page.evalFn(() => {
                const profile = structuredClone(__ux.selected.profile); delete profile.steps; delete profile.target_weight;
                __ux.screen().shadowRoot.getElementById('upload').dispatchEvent(new CustomEvent('file-pick', {
                    detail: { file: new File([JSON.stringify(profile)], 'ethiopia-washed.json', { type: 'application/json' }) },
                    bubbles: true, composed: true,
                }));
            });
            assert.equal(await until(page, '__ux.boot.library.get().add.status === "refused"'), true);
            const message = await read(page, 'file-import');
            assert.match(message, /ethiopia-washed\.json/); assert.match(message, /steps/); assert.match(message, /target_weight/);
            assert.equal(await page.evalFn(() => __ux.screen().shadowRoot.getElementById('share-code').open), false);
            await capture(page, '12-file-validation');
            await page.click(`${S} >>> #file-cancel`);
        });

        await t.test('a failed file import can retry the selected file and cannot dismiss while pending', async () => {
            await page.evalFn(() => {
                __ux.control.failProfile = true;
                __ux.screen().shadowRoot.getElementById('upload').dispatchEvent(new CustomEvent('file-pick', {
                    detail: { file: new File([JSON.stringify(__ux.selected.profile)], 'classic-espresso.json') }, bubbles: true, composed: true,
                }));
            });
            assert.equal(await until(page, '__ux.boot.library.get().add.status === "failed"'), true);
            assert.match(await read(page, 'file-message'), /Profile service unavailable/);
            await page.evalFn(() => { __ux.control.failProfile = false; __ux.control.holdProfile = true; });
            await page.click(`${S} >>> #file-retry`);
            await page.press('Escape');
            assert.equal(await page.evalFn(() => __ux.screen().shadowRoot.getElementById('file-import').open), true);
            assert.equal(await page.evalFn(() => __ux.screen().shadowRoot.getElementById('file-choose').disabled), true);
            await capture(page, '12-file-import-pending');
            await page.evalFn(() => { __ux.control.holdProfile = false; __ux.control.release(); });
            assert.equal(await until(page, '!__ux.screen().shadowRoot.getElementById("file-import").open'), true);
            assert.ok(await page.evalFn(() => __ux.boot.library.recordFor('profile:imported')));
        });

        await t.test('generator explains browser and native return paths and reports a blocked new tab', async () => {
            await page.click(`${S} >>> #generate`);
            assert.match(await read(page, 'generator-handoff'), /new browser tab/);
            await capture(page, '12-generator-browser');
            await page.evalFn(() => { window.__openOriginal = window.open; window.open = () => null; });
            await page.click(`${S} >>> #generator-open`);
            assert.match(await read(page, 'generator-error'), /Allow new tabs/);
            await page.evalFn(() => { window.open = window.__openOriginal; });
            await page.click(`${S} >>> #generator-cancel`);
            await page.evalFn(() => {
                window.__DECENT_HOST__ = { app: 'decent.app', platform: 'android' };
                __ux.screen()._generatorUrl = 'http://localhost:8080/api/v1/plugins/decent-profile.reaplugin/ui';
            });
            await page.click(`${S} >>> #generate`);
            assert.match(await read(page, 'generator-handoff'), /system Back button.*Dashboard/);
            await capture(page, '12-generator-native');
            await page.click(`${S} >>> #generator-cancel`);
            await page.evalFn(() => { delete window.__DECENT_HOST__; });
        });

        await t.test('editor cancel restores selector selection and edit-button focus', async () => {
            await page.click(`${S} >>> #act-edit`);
            assert.equal(await until(page, '__ux.root.route === "editor"'), true);
            await page.click(`${E} >>> #band >>> #cancel`);
            assert.equal(await until(page, '__ux.root.route === "selector"'), true);
            assert.equal(await page.evalFn(() => __ux.boot.library.get().selectedId), mounted.selected);
            assert.equal(await page.evalFn(() => __ux.screen().shadowRoot.activeElement?.id), 'act-edit');
        });

        await t.test('editor cancel restores the exact filter, folders and scroll position', async () => {
            const before = await page.evalFn(async () => {
                const s = __ux.screen(), r = s.shadowRoot, filter = r.getElementById('filter');
                const query = async value => {
                    filter.value = value;
                    filter.dispatchEvent(new CustomEvent('search', { detail: { value }, bubbles: true, composed: true }));
                    await __ux.settle();
                };
                await query('');
                const folder = r.querySelector('.family-row[aria-expanded="false"]');
                if (folder) { folder.click(); await __ux.settle(); }
                const openFolders = [...r.querySelectorAll('.family-row[aria-expanded="true"]')]
                    .map(row => row.dataset.folder).sort();
                await query('e');
                const list = r.getElementById('list-pane').shadowRoot.getElementById('list');
                list.scrollTop = (list.scrollHeight - list.clientHeight) * 0.65;
                return { query: filter.value, scrollTop: list.scrollTop, scrollLeft: list.scrollLeft,
                    openFolders, selectedId: __ux.boot.library.get().selectedId };
            });
            assert.ok(before.scrollTop > 0, 'the trip starts partway down a filtered list');
            assert.ok(before.openFolders.length > 0, 'the trip has an explicit expanded folder to restore');
            await page.click(`${S} >>> #act-edit`);
            assert.equal(await until(page, '__ux.root.route === "editor"'), true);
            await page.click(`${E} >>> #band >>> #cancel`);
            assert.equal(await until(page, '__ux.root.route === "selector"'), true);
            const after = await page.evalFn(() => {
                const r = __ux.screen().shadowRoot, list = r.getElementById('list-pane').shadowRoot.getElementById('list');
                return { query: r.getElementById('filter').value, scrollTop: list.scrollTop,
                    scrollLeft: list.scrollLeft, selectedId: __ux.boot.library.get().selectedId,
                    focus: r.activeElement?.id };
            });
            assert.equal(after.query, before.query);
            assert.ok(Math.abs(after.scrollTop - before.scrollTop) <= 0.5,
                `scroll returns to ${before.scrollTop}, not the selected row (${after.scrollTop})`);
            assert.equal(after.scrollLeft, before.scrollLeft);
            assert.equal(after.selectedId, before.selectedId);
            assert.equal(after.focus, 'act-edit');
            const restoredFolders = await page.evalFn(async () => {
                const r = __ux.screen().shadowRoot, filter = r.getElementById('filter');
                filter.value = '';
                filter.dispatchEvent(new CustomEvent('search', { detail: { value: '' }, bubbles: true, composed: true }));
                await __ux.settle();
                return [...r.querySelectorAll('.family-row[aria-expanded="true"]')]
                    .map(row => row.dataset.folder).sort();
            });
            assert.deepEqual(restoredFolders, before.openFolders);
            await chooseOther(page);
        });

        await t.test('editing from Hidden returns to that explicit list and its selected profile', async () => {
            await page.click(`${S} >>> #hidden-toggle`);
            const id = await page.evalFn(async () => {
                const hidden = __ux.boot.library.get().hidden[0];
                const filter = __ux.screen().shadowRoot.getElementById('filter');
                filter.value = hidden.profile.title;
                filter.dispatchEvent(new CustomEvent('search', {
                    detail: { value: filter.value }, bubbles: true, composed: true,
                }));
                await __ux.settle();
                return hidden.id;
            });
            await page.click(`${S} >>> ui-list-row[data-id="${id}"]`);
            await page.click(`${S} >>> #act-edit`);
            assert.equal(await until(page, '__ux.root.route === "editor"'), true);
            await page.click(`${E} >>> #band >>> #cancel`);
            assert.equal(await until(page, '__ux.root.route === "selector"'), true);
            assert.equal(await page.evalFn(() => __ux.screen().shadowRoot.getElementById('hidden-toggle')
                .getAttribute('aria-pressed')), 'true');
            assert.equal(await page.evalFn(() => __ux.boot.library.get().selectedId), id);
            assert.equal(await page.evalFn(() => __ux.screen().shadowRoot.getElementById('filter').value),
                await page.evalFn(id => __ux.boot.library.recordFor(id).profile.title, id));
            assert.equal(await page.evalFn(() => __ux.screen().shadowRoot.activeElement?.id), 'act-edit');
            await page.click(`${S} >>> #hidden-toggle`);
            await chooseOther(page);
        });

        await t.test('an unrelated library visit does not restore an abandoned editor view', async () => {
            assert.equal(await page.evalFn(() => __ux.screen().shadowRoot.getElementById('filter').value),
                await page.evalFn(() => __ux.selected.profile.title));
            await page.click(`${S} >>> #act-edit`);
            assert.equal(await until(page, '__ux.root.route === "editor"'), true);
            await page.evalFn(() => __ux.root.goto('live'));
            assert.equal(await until(page, '__ux.root.route === "live"'), true);
            await page.evalFn(() => __ux.root.goto('selector', { invoker: 'profile-picker' }));
            assert.equal(await until(page, '__ux.root.route === "selector"'), true);
            assert.equal(await page.evalFn(() => __ux.screen().shadowRoot.getElementById('filter').value), '');
            await chooseOther(page);
        });

        await t.test('Rename and Discard use separated standard footer actions and retain their behaviors', async () => {
            await page.click(`${S} >>> #act-edit`);
            assert.equal(await until(page, '__ux.root.route === "editor"'), true);
            await page.click(`${E} >>> #title-pencil`);
            await page.evalFn(() => { __ux.screen().shadowRoot.getElementById('rename-field').value = ''; });
            await page.click(`${E} >>> #rename-save`);
            assert.match(await read(page, 'rename-refusal'), /needs a name/);
            const gap = await page.evalFn(() => {
                const r = __ux.screen().shadowRoot, a = r.getElementById('rename-cancel').getBoundingClientRect();
                const b = r.getElementById('rename-save').getBoundingClientRect();
                return { gap: b.left - a.right, width: b.width, scale: parseFloat(document.documentElement.style.getPropertyValue('--ui-app-scale')) };
            });
            assert.ok(gap.gap >= 18 * gap.scale - 1); assert.ok(gap.width >= 128 * gap.scale - 1);
            await capture(page, '13-rename-validation');
            await page.click(`${E} >>> #rename-cancel`);
            await page.evalFn(() => { const e = __ux.screen(); e._draft = { ...e._draft, notes: 'A changed note for the discard check.' }; });
            await page.click(`${E} >>> #band >>> #cancel`);
            assert.equal(await page.evalFn(() => __ux.screen().shadowRoot.getElementById('discard-dialog').open), true);
            assert.equal(await page.evalFn(() => __ux.screen().shadowRoot.getElementById('discard-confirm').variant), 'danger');
            assert.equal(await read(page, 'discard-confirm'), 'Discard changes');
            await capture(page, '13-discard');
            await page.click(`${E} >>> #discard-cancel`);
            assert.match(await page.evalFn(() => __ux.screen()._draft.notes), /changed note/);
            await page.click(`${E} >>> #band >>> #cancel`);
            await page.click(`${E} >>> #discard-confirm`);
            assert.equal(await until(page, '__ux.root.route === "selector"'), true);
        });
        assert.deepEqual(page.pageErrors, []);
    } finally { await browser.close(); }
});

test('profile UI and modal actions fit both screens, themes and text sizes', async () => {
    const browser = await launch();
    const page = await browser.newPage({ geometry });
    try {
        await mountSelectorApp(page);
        await page.evalFn(async () => {
            const visible = __ux.boot.library.get().listable;
            const longest = visible.reduce((a, b) => a.profile.title.length >= b.profile.title.length ? a : b);
            __ux.boot.library.select(longest.id);
            __ux.longest = longest;
            await __ux.settle();
        });
        for (const size of [geometry, { ...geometry, name: 'floor', width: 1000, height: 600 }]) {
            await page.setGeometry(size);
            for (const theme of ['light', 'dark']) {
                await page.setTheme(theme);
                for (const density of ['fit-screen', 'largest']) {
                    await page.evalFn(async value => {
                        const { applyDensity } = await import('/src/lib/density.js');
                        applyDensity(document.documentElement, value);
                        await __ux.settle();
                    }, density);
                    const fit = await page.evalFn(() => {
                        const r = __ux.screen().shadowRoot;
                        const list = r.getElementById('list-pane').shadowRoot.getElementById('list').getBoundingClientRect();
                        const bank = r.getElementById('favourites').getBoundingClientRect();
                        const header = r.querySelector('ui-page-header').getBoundingClientRect();
                        const use = r.getElementById('confirm').getBoundingClientRect();
                        return { listBottom: list.bottom, bankTop: bank.top, bankBottom: bank.bottom,
                            headerBottom: header.bottom, useBottom: use.bottom,
                            width: document.documentElement.scrollWidth, viewportWidth: innerWidth, viewportHeight: innerHeight };
                    });
                    assert.ok(fit.listBottom <= fit.bankTop + 1, 'the fitted list must not cover the named favourites');
                    assert.ok(fit.bankBottom <= fit.viewportHeight + 1, 'all five favourite controls remain on screen');
                    assert.ok(fit.useBottom <= fit.headerBottom + 1, 'Use profile stays inside the header');
                    assert.ok(fit.width <= fit.viewportWidth + 1, 'the app must not overflow horizontally');
                    await capture(page, `07-${size.name}-${theme}-${density}`);
                }
            }
        }
        await page.setTheme('light');
        await page.click(`${S} >>> .assign-row ui-favourite-slot[data-slot="1"]`);
        await capture(page, '07-long-name-replacement-floor-largest');
        const modal = await page.box(`${S} >>> #replace-favourite >>> #dialog`);
        assert.ok(modal.top >= 0 && modal.bottom <= 600);
        await page.click(`${S} >>> #replacement-cancel`);

        await page.evalFn(() => __ux.screen().shadowRoot.getElementById('upload').dispatchEvent(new CustomEvent('file-pick', {
            detail: { file: new File(['{broken'], `espresso-${'washed-ethiopia-'.repeat(10)}.json`) }, bubbles: true, composed: true,
        })));
        assert.equal(await until(page, '__ux.boot.library.get().add.status === "refused"'), true);
        await capture(page, '12-long-filename-floor-largest');
        const file = await page.box(`${S} >>> #file-import >>> #dialog`);
        assert.ok(file.left >= 0 && file.right <= 1000 && file.bottom <= 600);
        await page.click(`${S} >>> #file-cancel`);

        await page.click(`${S} >>> #act-edit`);
        assert.equal(await until(page, '__ux.root.route === "editor"'), true);
        await page.click(`${E} >>> #title-pencil`);
        await page.evalFn(() => {
            const r = __ux.screen().shadowRoot;
            r.getElementById('rename-dialog').style.setProperty('--_ui-dialog-inline', '360px');
            r.getElementById('rename-cancel').textContent = 'Continue editing this profile without renaming it';
            r.getElementById('rename-save').textContent = 'Save this new profile name';
        });
        await page.settle(4);
        const footer = await page.evalFn(() => {
            const r = __ux.screen().shadowRoot;
            const cancel = r.getElementById('rename-cancel').getBoundingClientRect();
            const save = r.getElementById('rename-save').getBoundingClientRect();
            const dialog = r.getElementById('rename-dialog').shadowRoot.getElementById('dialog').getBoundingClientRect();
            const button = r.getElementById('rename-save').shadowRoot.querySelector('button');
            return { cancel: { top: cancel.top, bottom: cancel.bottom, left: cancel.left, right: cancel.right },
                save: { top: save.top, bottom: save.bottom, left: save.left, right: save.right },
                dialog: { left: dialog.left, right: dialog.right, bottom: dialog.bottom },
                textFits: button.scrollWidth <= button.clientWidth + 1 };
        });
        assert.ok(footer.save.top >= footer.cancel.bottom, 'long labels wrap into separate action rows');
        assert.ok(footer.save.right <= footer.dialog.right && footer.cancel.left >= footer.dialog.left);
        assert.equal(footer.textFits, true);
        await capture(page, '13-long-footer-labels-floor-largest');
        assert.deepEqual(page.pageErrors, []);
    } finally { await browser.close(); }
});
