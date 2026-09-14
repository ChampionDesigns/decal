import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { launch, BENCH } from '../harness/index.js';
let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });
const evidence = process.env.DECAL_REVIEW_OUT;
async function capture(page, name) {
    if (!evidence) return;
    await fs.mkdir(evidence, { recursive: true });
    await fs.writeFile(path.join(evidence, name + '.png'), await page.screenshot());
}
async function settingsPage(page) {
    await page.eval("customElements.define('app-root', class extends HTMLElement {})");
    await page.mount('<app-root><div id="stage" style="block-size:100%;display:grid"></div></app-root>', ['/test/fixtures/settings-shell-fixture.js']);
    await page.eval(`(async()=>{(await import('/src/lib/app-fit.js')).installFit(window);await __settings.mount();await __settings.capabilities((await import('/src/stores/capabilities-store.js')).SERVED_CAPABILITIES);await __settings.displayFrame({brightness:80,requestedBrightness:80,wakeLockOverride:true});return true})()`);
    await page.settle();
}
async function search(page, query) {
    await page.click('settings-screen >>> #search >>> #field >>> input');
    await page.press('a', { modifiers: 2 });
    await page.press('Backspace');
    if (query) await page.send('Input.insertText', { text: query });
    await page.settle();
}

test('a search result navigates to and highlights the exact row without staging changes', () => browser.withPage({ geometry: BENCH, theme: 'light' }, async (page) => {
    await settingsPage(page);
    await search(page, 'brightness');
    await page.click('settings-screen >>> #nav [data-id="display-screen-brightness"]');
    await page.settle();
    const result = await page.eval(`(()=>{const s=__settings.screen(),r=s.shadowRoot.getElementById('leaf').shadowRoot.querySelector('[data-row="display-screen-brightness"]');const p=s.shadowRoot.getElementById('leaf-pane').getBoundingClientRect(),b=r.getBoundingClientRect();return {leaf:s.leafId,part:r.part.contains('search-match'),outline:getComputedStyle(r).outlineStyle,visible:b.top>=p.top&&b.bottom<=p.bottom,dirty:s.changeCount,context:s.shadowRoot.querySelector('[data-id="display-screen-brightness"]').textContent}})()`);
    assert.equal(result.leaf, 'display-screen');
    assert.equal(result.part, true);
    assert.equal(result.outline, 'solid');
    assert.equal(result.visible, true);
    assert.equal(result.dirty, 0);
    assert.match(result.context, /Display.*Screen/s);
    await capture(page, 'settings-search-brightness');
    await search(page, 'morning time');
    await page.click('settings-screen >>> #nav [data-target="night-morning"]');
    await page.settle(8);
    assert.equal(await page.eval("__settings.bespokeEl().shadowRoot.getElementById('night-morning').part.contains('search-match')"), true);
    await capture(page, 'settings-search-night');
    await search(page, '');
    assert.equal(await page.eval("__settings.bespokeEl().shadowRoot.getElementById('night-morning').part.contains('search-match')"), false);
    await page.eval("__settings.change('accessories-usb-charger-night',false)");
    await search(page, 'morning time');
    assert.equal(await page.eval("Boolean(__settings.screen().shadowRoot.querySelector('#nav [data-target=\"night-morning\"]'))"), false);
    assert.ok(await page.exists('settings-screen >>> #nav [data-id="accessories-usb-charger-night"]'));
}));

test('known absent features disappear and selection moves to an available page on capability change', () => browser.withPage({ geometry: BENCH, theme: 'light' }, async (page) => {
    await settingsPage(page);
    await page.click('settings-screen >>> #nav [data-id="accessories"]');
    await page.click('settings-screen >>> #subnav [data-id="accessories-lighting"]');
    await page.eval('__settings.capabilities([])');
    await page.settle();
    const state = await page.eval(`(()=>{const s=__settings.screen();return {leaf:s.leafId,leaves:[...s.shadowRoot.querySelectorAll('#subnav ui-subnav-row')].map(r=>r.dataset.id),text:s.shadowRoot.getElementById('leaf').heading}})()`);
    assert.deepEqual(state.leaves, ['accessories-usb-charger']);
    assert.equal(state.leaf, 'accessories-usb-charger');
    assert.equal(state.text, 'USB Charger');
    await capture(page, 'settings-de1-accessories');
    await search(page, 'lighting');
    assert.equal(await page.eval("__settings.screen().shadowRoot.querySelectorAll('#nav ui-nav-row').length"), 0);
    await page.eval('__settings.capabilities(null)');
    await search(page, '');
    assert.ok(await page.eval("Boolean(__settings.screen().shadowRoot.querySelector('#subnav [data-id=\"accessories-lighting\"]'))"));
}));

async function failedShell(page, hosted) {
    await page.mount('', ['/test/fixtures/app-shell-fixture.js']);
    await page.evalFn((hosted) => {
        if (hosted) { window.__DECENT_HOST__ = true; window.__dashboardExits = 0; window.decentApp = { exitToDashboard: () => window.__dashboardExits++ }; }
        window.__copied = [];
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text) => { window.__copied.push(text); } } });
        return __shell.mount({ screens: 'failing' });
    }, hosted);
    await page.settle(8);
}

test('startup recovery exposes usable details, copy outcomes and only the valid host exit', () => browser.withPage({ geometry: BENCH, theme: 'light' }, async (page) => {
    await failedShell(page, true);
    await page.click('app-root >>> #recovery-details summary');
    await page.click('app-root >>> #recovery-copy');
    assert.match(await page.eval('__copied[0]'), /screens\/live-screen\.js/);
    assert.match(await page.eval("document.querySelector('app-root').shadowRoot.querySelector('.recovery-status').textContent"), /Copied/);
    await capture(page, 'startup-recovery');
    await page.eval("navigator.clipboard.writeText=async()=>{throw new Error('denied')};true");
    await page.click('app-root >>> #recovery-copy');
    assert.match(await page.eval("document.querySelector('app-root').shadowRoot.querySelector('.recovery-status').textContent"), /Could not copy/);
    await page.click('app-root >>> #recovery-dashboard');
    assert.equal(await page.eval('__dashboardExits'), 1);
}));

test('standalone recovery has no dashboard action and Reload performs a real page reload', () => browser.withPage({ geometry: BENCH, theme: 'light' }, async (page) => {
    await failedShell(page, false);
    assert.equal(await page.eval("Boolean(document.querySelector('app-root').shadowRoot.getElementById('recovery-dashboard'))"), false);
    await page.click('app-root >>> #recovery-reload');
    for (let i = 0; i < 40; i++) {
        if (await page.eval("document.readyState==='complete' && !document.querySelector('app-root')")) return;
        await new Promise((resolve) => setTimeout(resolve, 25));
    }
    assert.fail('the harness page did not reload');
}));
