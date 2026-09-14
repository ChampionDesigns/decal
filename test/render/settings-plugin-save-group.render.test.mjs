/**
 * A plugin form is a pending write group like any other.
 *
 * Drives the plugin settings dialog and the header buttons, and reads the draft, the
 * refusal and what reaches the wire.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, BENCH } from '../harness/index.js';

const MODULES = ['/test/fixtures/settings-shell-fixture.js'];
const STAGE = '<div id="stage" style="inline-size: 100%; block-size: 100dvh"></div>';

const VISUALIZER = 'visualizer.reaplugin';

const STAGED_ROW = 'machine-flush-duration';

const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

describe('the plugin form is a pending write group', () => {
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

    const type = async (key, value) => {
        const done = await page.evalFn((field, text) => {
            const bespoke = document.querySelector('settings-screen')
                .shadowRoot.getElementById('bespoke');
            const row = bespoke.shadowRoot.querySelector(`[data-field="${field}"]`);
            const control = row?.querySelector('ui-text-field');
            if (!control) return false;
            control.value = text;
            control.dispatchEvent(new CustomEvent('change', { bubbles: true, composed: true }));
            return true;
        }, key, value);
        assert.equal(done, true, `the ${key} field must be on the Visualizer page`);
        await page.settle();
    };

    const stageMachineField = async (value) => {
        await show('machine', 'machine-flush');
        const done = await page.evalFn(
            (row, v) => window.__settings.change(row, v).then((ok) => ok),
            STAGED_ROW, value,
        );
        assert.equal(done, true, 'the staging control must exist');
        await page.settle();
    };

    const press = async (which) => {
        const said = await page.evalFn(async (button) => {
            const screen = document.querySelector('settings-screen');
            const left = [];
            const listener = (event) => left.push(event.detail?.route ?? null);
            document.addEventListener('navigate', listener);
            screen.shadowRoot.getElementById('band').shadowRoot.getElementById(button).click();
            await new Promise((r) => { setTimeout(r, 120); });
            document.removeEventListener('navigate', listener);
            await screen.updateComplete;
            return {
                left,
                refusal: screen.shadowRoot.getElementById('commit-refusal')?.textContent.trim() ?? null,
                count: screen.changeCount,
            };
        }, which);
        await sleep(60);
        await page.settle();
        return said;
    };

    const headerCount = () => page.evalFn(() => {
        const band = document.querySelector('settings-screen').shadowRoot.getElementById('band');
        return Number(band.getAttribute('change-count'));
    });

    const server = () => page.evalFn(() => window.__settings.server());

    const reset = async () => {
        await page.evalFn(async () => {
            window.__settings.failRoute('POST /plugins/visualizer.reaplugin/settings', false);
            window.__settings.refuseWrites(false);
            window.__settings.model().discard();
            window.__settings.stores().plugins.discardDrafts();
            return true;
        });
        await show('extensions', 'extensions-visualizer');
    };

    test('typing in a plugin form puts a change on the header', async () => {
        await reset();
        const before_ = await headerCount();

        await type('Username', 'someone');

        assert.equal(await headerCount(), before_ + 1,
            'an unsaved plugin field is a pending change and the header says so');
    });

    test('the header Save writes the plugin draft before it leaves', async () => {
        await reset();
        await type('Username', 'a-real-name');

        const said = await press('save');

        assert.deepEqual(said.left, ['live'], 'the write was accepted, so the gesture leaves');
        assert.equal(said.refusal, null, 'nothing refused, so nothing is reported');
        const settings = (await server()).pluginSettings[VISUALIZER];
        assert.equal(settings.Username, 'a-real-name',
            'the typed name reached the plugin, rather than being reported saved and dropped');
        assert.equal(await headerCount(), 0, 'and nothing is pending afterwards');
    });

    test('the header Save writes the plugin draft staged from another leaf', async () => {
        await reset();
        await type('Username', 'from-elsewhere');
        await stageMachineField(9);

        const said = await press('save');

        assert.deepEqual(said.left, ['live'], 'both groups were accepted');
        const state = await server();
        assert.equal(state.pluginSettings[VISUALIZER].Username, 'from-elsewhere',
            'a draft is a fact about the document, not about which page is showing');
        assert.equal(await headerCount(), 0, 'and the machine field went with it');
    });

    test('Cancel throws the plugin draft away and leaves', async () => {
        await reset();
        const before_ = (await server()).pluginSettings[VISUALIZER].Username;
        await type('Username', 'never-sent');

        const said = await press('cancel');

        assert.deepEqual(said.left, ['live'], 'Cancel leaves, as it does everywhere');
        assert.equal((await server()).pluginSettings[VISUALIZER].Username, before_,
            'and writes nothing on the way out');
        assert.equal(await headerCount(), 0, 'so there is nothing left pending');
        assert.equal(
            await page.evalFn(() => window.__settings.stores().plugins.get().dirty),
            false,
            'the draft was discarded rather than left to be committed by the next Save',
        );
    });

    test('a refused plugin write keeps the draft, names its group and retries clean', async () => {
        await reset();
        await stageMachineField(7);
        await show('extensions', 'extensions-visualizer');
        await type('Username', 'after-the-refusal');
        await page.evalFn(() => {
            window.__settings.failRoute('POST /plugins/visualizer.reaplugin/settings', true);
            return true;
        });

        const refused = await press('save');

        assert.deepEqual(refused.left, [], 'a group that did not land carries nobody off the page');
        assert.match(String(refused.refusal), /Plugin settings/,
            'the line says WHICH group refused, or a partial save is unreadable');
        assert.ok(await headerCount() > 0, 'and the draft is still the person\'s to save');

        await page.evalFn(() => {
            window.__settings.failRoute('POST /plugins/visualizer.reaplugin/settings', false);
            return true;
        });
        const retried = await press('save');

        assert.deepEqual(retried.left, ['live'], 'with the plugin taking writes, the gesture completes');
        assert.equal((await server()).pluginSettings[VISUALIZER].Username, 'after-the-refusal',
            'and the kept draft is what was written');
        assert.equal(await headerCount(), 0, 'nothing is left pending');
    });

    test('the form\'s own Save writes only the plugin it belongs to', async () => {
        await reset();
        await type('Username', 'form-button');
        await stageMachineField(6);
        await show('extensions', 'extensions-visualizer');

        await page.evalFn(() => {
            document.querySelector('settings-screen').shadowRoot.getElementById('bespoke')
                .shadowRoot.getElementById('plugin-save').click();
            return true;
        });
        await sleep(120);
        await page.settle();

        assert.equal((await server()).pluginSettings[VISUALIZER].Username, 'form-button',
            'the form\'s button writes the form');
        assert.equal(await headerCount(), 1,
            'and the staged machine field is still staged, still counted');
    });

    test('the BackSync copy describes a download, not an upload', async () => {
        await reset();
        const copy = await page.evalFn(() => {
            const bespoke = document.querySelector('settings-screen')
                .shadowRoot.getElementById('bespoke');
            const read = (key) => {
                const row = bespoke.shadowRoot.querySelector(`[data-field="${key}"]`);
                const label = row?.querySelector('.sw-label');
                return {
                    heading: label?.querySelector('.ui-heading')?.textContent.trim() ?? null,
                    caption: label?.querySelector('.ui-caption')?.textContent.trim() ?? null,
                };
            };
            return { sync: read('BackSync'), every: read('BackSyncIntervalSeconds') };
        });
        assert.equal(copy.sync.heading, 'Sync edits from Visualizer');
        assert.match(copy.sync.caption, /from Visualizer|edited on Visualizer/i,
            'the caption must say where the edits come FROM');
        assert.doesNotMatch(`${copy.sync.heading} ${copy.sync.caption}`, /\bupload|\bsend\b/i,
            'an upload word here says the wrong thing: the switch downloads');
        assert.equal(copy.every.heading, 'Check for edits every');
        assert.match(copy.every.caption, /seconds/i,
            'the unit stays in the caption, where Minimum shot duration already puts it');
    });

    test('the plugin modal has a footer with Close and Save; the leaf is unchanged',
        async () => {
            await reset();
            const leaf = await page.evalFn(() => {
                const root = document.querySelector('settings-screen')
                    .shadowRoot.getElementById('bespoke').shadowRoot;
                return {

                    heading: root.querySelector('#plugin-settings > h3.ui-heading')?.textContent.trim(),
                    saveInBody: Boolean(root.querySelector('#plugin-settings #plugin-save')),
                };
            });
            assert.equal(leaf.heading, 'Settings', 'the leaf keeps the section heading');
            assert.equal(leaf.saveInBody, true, 'and its Save, which has no footer to go to');

            await show('extensions', 'extensions-plugins');
            const modal = await page.evalFn(async () => {
                const bespoke = document.querySelector('settings-screen')
                    .shadowRoot.getElementById('bespoke');
                const gear = bespoke.shadowRoot
                    .querySelector('[data-plugin-settings="visualizer.reaplugin"]');
                if (!gear) return { gear: false };
                gear.shadowRoot.querySelector('button').click();
                await bespoke.updateComplete;
                const dialog = bespoke.shadowRoot.getElementById('plugin-settings-dialog');
                await dialog.updateComplete;
                return {
                    gear: true,
                    open: dialog.open === true,
                    actions: [...dialog.children].filter((c) => c.slot === 'actions')
                        .map((c) => ({ id: c.id, text: c.textContent.trim() })),

                    subheading: Boolean(dialog.querySelector('#plugin-settings > h3.ui-heading')),
                    saveInBody: Boolean(dialog.querySelector('#plugin-settings #plugin-save')),
                    fields: dialog.querySelectorAll('[data-field]').length,
                };
            });
            assert.equal(modal.gear, true, 'the gear must be on the Plugins page');
            assert.equal(modal.open, true);
            assert.deepEqual(modal.actions.map((a) => a.text), ['Close', 'Save'],
                'the way out and the affirmative, in the dialog footer');
            assert.equal(modal.actions[0].id, 'plugin-settings-close');
            assert.equal(modal.actions[1].id, 'plugin-save',
                'the SAME button, moved — one id, one handler, one disabled rule');
            assert.equal(modal.subheading, false, 'no "Settings" heading inside a settings dialog');
            assert.equal(modal.saveInBody, false, 'and no second Save left in the body');
            assert.ok(modal.fields > 0, 'the form itself is unchanged');

            const shut = await page.evalFn(async () => {
                const bespoke = document.querySelector('settings-screen')
                    .shadowRoot.getElementById('bespoke');
                const dialog = bespoke.shadowRoot.getElementById('plugin-settings-dialog');
                dialog.querySelector('#plugin-settings-close')
                    .shadowRoot.querySelector('button').click();

                const closed = dialog.open === false;
                await bespoke.updateComplete;
                await new Promise((r) => requestAnimationFrame(r));
                await bespoke.updateComplete;
                return { closed, gone: !bespoke.shadowRoot.getElementById('plugin-settings-dialog') };
            });
            assert.equal(shut.closed, true, 'the press closes the dialog');
            assert.equal(shut.gone, true, 'and the leaf forgets which plugin it was showing');
        });
});
