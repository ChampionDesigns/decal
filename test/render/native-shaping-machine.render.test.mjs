import { test } from 'node:test';
import assert from 'node:assert/strict';

import { launch } from '../harness/index.js';
import { TABLET } from '../harness/geometry.js';
import { chartShotData, mountChartApp } from '../harness/chart-ux.js';

const E = 'app-root >>> editor-screen';
const SAVE = `${E} >>> #band >>> #save`;

const BLOCK = Object.freeze({
    version: 2,
    pump_curve: [
        { pressure: 1, flow: 20 }, { pressure: 3, flow: 12 }, { pressure: 6, flow: 6 },
        { pressure: 9, flow: 5 }, { pressure: 12, flow: 4 },
    ],
    flow_tau: 0.5,
    flow_mode: 'both',
    pressure_tau: 0,
    pressure_mode: 'both',
    pressure_filter_tau: 0,
    pressure_ramp_tau: 1,
    flow_ramp_tau: 0,
});

async function withApp(machineClass, fn) {
    const browser = await launch();
    const page = await browser.newPage({ geometry: TABLET });
    try {
        const mounted = await mountChartApp(page, chartShotData(), { machineClass });
        assert.equal(mounted.route, 'editor');
        await fn(page);
        assert.deepEqual(page.pageErrors, []);
    } finally {
        await browser.close();
    }
}

const controls = (page) => page.evalFn(async () => {
    __ux.screen().tab = 'chart';
    await __ux.settle();
    const screen = __ux.screen().shadowRoot;
    return {
        machine: __ux.boot.capabilities.machineClass(),
        row: Boolean(screen.querySelector('[data-row="native-shaping"]')),
        edit: Boolean(screen.getElementById('shaping-edit-settings')),
        entry: Boolean(__ux.chart().shadowRoot.getElementById('shaping-entry')),
        emulation: Boolean(screen.querySelector('[data-row="de1-emulation"]')),
    };
});

for (const [why, machineClass, shown] of [
    ['a Bengle shows', 'bengle', true],
    ['a DE1 hides', 'de1', false],
    ['a machine that is not known yet hides', null, false],
]) {
    test(`${why} the native shaping row and the Chart button, the same as the DE1 emulation row`, async () => {
        await withApp(machineClass, async (page) => {
            const seen = await controls(page);
            assert.deepEqual(seen, {
                machine: machineClass, row: shown, edit: shown, entry: shown, emulation: shown,
            });
        });
    });
}

test('the controls follow a machine answer that arrives after the editor is drawn', async () => {
    await withApp(null, async (page) => {
        assert.equal((await controls(page)).entry, false);
        await page.evalFn(async () => {
            const before = window.__uxRoutes;
            window.__uxRoutes = (u, method) => (u.pathname === '/api/v1/machine/capabilities' && method === 'GET'
                ? { body: { capabilities: ['cupWarmer'] } }
                : before(u, method));
            await __ux.boot.capabilities.load();
            await __ux.settle();
        });
        const seen = await controls(page);
        assert.deepEqual([seen.machine, seen.row, seen.entry], ['bengle', true, true]);
    });
});

test('on a DE1 a profile with a block saves another edit with the block unchanged', async () => {
    await withApp('de1', async (page) => {
        await page.evalFn(async (block) => {
            const record = structuredClone(__ux.loaded);
            record.profile = { ...record.profile, native_shaping: block };
            __ux.boot.profileEditor.open(record);
            await __ux.settle();
            const s = __ux.screen();
            s._draft = { ...s._draft, target_weight: (s._draft.target_weight ?? 36) + 2 };
            await __ux.settle();
            __ux.calls.length = 0;
        }, BLOCK);
        assert.equal((await controls(page)).row, false);
        const fields = await page.evalFn(() => __ux.boot.profileEditor.changeCount(__ux.screen()._draft).fields);
        assert.deepEqual(fields, ['target_weight']);
        await page.click(SAVE);
        assert.equal(await page.evalFn(async () => {
            for (let i = 0; i < 250; i++) {
                if (__ux.calls.some((c) => c.method === 'PUT' && c.path === '/api/v1/workflow')) return true;
                await new Promise((r) => setTimeout(r, 20));
            }
            return false;
        }), true, 'the save armed the workflow');
        const sent = await page.evalFn(() => structuredClone(__ux.calls.filter((c) => c.method !== 'GET')));
        const post = sent.find((c) => c.method === 'POST' && c.path === '/api/v1/profiles');
        assert.ok(post, sent.map((c) => `${c.method} ${c.path}`).join(','));
        assert.deepEqual(post.body.profile.native_shaping, BLOCK);
        const armed = sent.find((c) => c.method === 'PUT' && c.path === '/api/v1/workflow');
        assert.deepEqual(armed.body.profile.native_shaping, BLOCK);
    });
});
