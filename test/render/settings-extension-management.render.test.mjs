import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, BENCH } from '../harness/index.js';

const MODULES = ['/test/fixtures/settings-shell-fixture.js'];
const STAGE = '<div id="stage" style="inline-size: 100%; block-size: 100dvh"></div>';
const ELSEWHERE = 'Manage skins and plugins in Decide. This skin cannot change them.';
const UPDATE_NOTE = 'Turn this on in Decide. This skin can only turn it off.';

const WRITE_ROUTES = [
    /^PUT \/webui\/skins\/default$/,
    /^POST \/webui\/server\/(start|stop)$/,
    /^POST \/webui\/skins\/update$/,
    /^DELETE \/webui\/skins\//,
    /^POST \/plugins\/[^/]+\/(enable|disable|settings)$/,
    /^DELETE \/plugins\//,
];

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

describe('skin and plugin management is shown as not available', () => {
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

    const managementWrites = async () => {
        const wire = await page.evalFn(() => window.__settings.wire());
        return wire.filter((key) => WRITE_ROUTES.some((route) => route.test(key)));
    };

    const text = (id) => page.evalFn((which) => window.__settings.bespokeEl()
        .shadowRoot.getElementById(which)?.textContent.trim() ?? null, id);

    test('Display › Skin offers no switch and says where to manage skins', async () => {
        await show('display', 'display-skin');
        const before = await page.evalFn(() => window.__settings.server().skinDefault);
        const drawn = await page.evalFn(async () => {
            const root = window.__settings.bespokeEl().shadowRoot;
            const cards = [...root.querySelectorAll('.skin-card')];
            const presses = root.querySelectorAll('.skin-press').length;
            cards.find((card) => !card.hasAttribute('data-active'))?.click();
            await new Promise((r) => setTimeout(r, 80));
            return { cards: cards.length, presses, switched: !!root.getElementById('skin-switched') };
        });
        await page.settle();
        assert.equal(drawn.cards, 3, 'every installed skin is still listed');
        assert.equal(drawn.presses, 0, 'no card is a button');
        assert.equal(drawn.switched, false);
        assert.equal(await text('skins-manage-elsewhere'), ELSEWHERE);
        assert.equal(await page.evalFn(() => window.__settings.server().skinDefault), before);
        assert.deepEqual(await managementWrites(), []);
    });

    test('Updates › Skin / App offers no update and no remove', async () => {
        await show('updates', 'updates-skin-app');
        const drawn = await page.evalFn(async () => {
            const root = window.__settings.bespokeEl().shadowRoot;
            const update = root.getElementById('skins-update');
            const disabled = update?.hasAttribute('disabled') ?? null;
            update?.click();
            await new Promise((r) => setTimeout(r, 80));
            return {
                disabled,
                removes: root.querySelectorAll('.skin-remove').length,
                rows: root.querySelectorAll('.update-row').length,
                ran: !!root.getElementById('updates-outcome'),
                failed: !!root.getElementById('updates-failed'),
            };
        });
        await page.settle();
        assert.equal(drawn.disabled, true);
        assert.equal(drawn.removes, 0);
        assert.equal(drawn.rows, 3, 'the installed skins are still read and listed');
        assert.equal(drawn.ran, false);
        assert.equal(drawn.failed, false);
        assert.equal(await text('updates-manage-elsewhere'), ELSEWHERE);
        assert.equal(await page.evalFn(() => window.__settings.server().skinUpdates), 0);
        assert.deepEqual(await managementWrites(), []);
    });

    test('the plugin list draws every switch disabled and says where to manage plugins', async () => {
        await show('extensions', 'extensions-plugins');
        const before = await page.evalFn(() => window.__settings.server().plugins);
        const drawn = await page.evalFn(async () => {
            const root = window.__settings.bespokeEl().shadowRoot;
            const switches = [...root.querySelectorAll('.plugin ui-switch')];
            const disabled = switches.map((control) => control.hasAttribute('disabled'));
            switches[0]?.click();
            await new Promise((r) => setTimeout(r, 80));
            return { count: switches.length, disabled, refused: !!root.getElementById('plugins-refusal') };
        });
        await page.settle();
        assert.ok(drawn.count > 0, 'the plugins are still read and listed');
        assert.ok(drawn.disabled.every(Boolean), `every switch is disabled: ${drawn.disabled}`);
        assert.equal(drawn.refused, false, 'nothing was tried, so nothing is reported as refused');
        assert.equal(await text('plugins-manage-elsewhere'), ELSEWHERE);
        assert.deepEqual(await page.evalFn(() => window.__settings.server().plugins), before);
        assert.deepEqual(await managementWrites(), []);
    });

    test('a plugin settings dialog reads the settings, with no Save and no field to edit', async () => {
        await show('extensions', 'extensions-plugins');
        const drawn = await page.evalFn(async () => {
            const el = window.__settings.bespokeEl();
            el.shadowRoot
                .querySelector('.plugin[data-plugin="visualizer.reaplugin"] .plugin-settings')
                .click();
            await new Promise((r) => setTimeout(r, 120));
            const root = el.shadowRoot;
            const dialog = root.getElementById('plugin-settings-dialog');
            const fields = [...root.querySelectorAll('#plugin-settings .form-row ui-text-field, #plugin-settings .form-row ui-switch')];
            const out = {
                open: !!dialog,
                save: !!root.getElementById('plugin-save'),
                fields: fields.length,
                editable: fields.filter((field) => !field.hasAttribute('disabled')).length,
                line: root.getElementById('plugin-manage-elsewhere')?.textContent.trim() ?? null,
            };
            dialog?.dispatchEvent(new CustomEvent('open-change', { detail: { open: false } }));
            await new Promise((r) => setTimeout(r, 60));
            return out;
        });
        assert.equal(drawn.open, true);
        assert.equal(drawn.save, false);
        assert.ok(drawn.fields > 0, 'the settings are still read and drawn');
        assert.equal(drawn.editable, 0);
        assert.equal(drawn.line, ELSEWHERE);
        assert.deepEqual(await managementWrites(), []);
    });

    test('the Visualizer page draws its switch disabled and offers no Save', async () => {
        await show('extensions', 'extensions-visualizer');
        const drawn = await page.evalFn(() => {
            const root = window.__settings.bespokeEl().shadowRoot;
            return {
                enabled: root.getElementById('plugin-enabled')?.hasAttribute('disabled') ?? null,
                save: !!root.getElementById('plugin-save'),
                line: root.getElementById('plugin-manage-elsewhere')?.textContent.trim() ?? null,
            };
        });
        assert.equal(drawn.enabled, true);
        assert.equal(drawn.save, false);
        assert.equal(drawn.line, ELSEWHERE);
    });

    test('automatic update checks, while off, cannot be turned on here and say where to', async () => {
        await show('extensions', 'extensions-decent-app-settings');
        const drawn = await page.evalFn(async () => {
            const leaf = window.__settings.leafEl().shadowRoot;
            const row = leaf.querySelector('ui-settings-row[data-row="extensions-decent-app-updates"]');
            const control = row?.control?.[0] ?? null;
            const out = {
                checked: control?.checked ?? null,
                disabled: control?.hasAttribute('disabled') ?? null,
                note: row?.shadowRoot.getElementById('note')?.textContent.trim() ?? null,
            };
            control?.click();
            await new Promise((r) => setTimeout(r, 80));
            out.changes = window.__settings.model().changeCount;
            return out;
        });
        assert.equal(drawn.checked, false);
        assert.equal(drawn.disabled, true);
        assert.equal(drawn.note, UPDATE_NOTE);
        assert.equal(drawn.changes, 0);
    });
});
