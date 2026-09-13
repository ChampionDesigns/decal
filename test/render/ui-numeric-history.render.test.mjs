import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { launch, BENCH, FLOOR } from '../harness/index.js';
import { mountEditing, matrixCell, EDITOR } from '../harness/editor.js';

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

async function withPad(fn, geometry = BENCH) {
    await browser.withPage({ geometry, theme: 'light' }, async page => {
        await page.mount('<ui-numeric-keypad id="pad"></ui-numeric-keypad>', ['/src/components/ui-numeric-keypad.js']);
        await page.eval(`(() => {
            window.confirmed = [];
            window.leakedKeys = [];
            document.addEventListener('keydown', event => leakedKeys.push(event.key));
            const pad = document.querySelector('#pad');
            pad.addEventListener('confirm', event => confirmed.push(event.detail));
            window.openPad = async (key = 'target', unit = 'bar', value = '8', max = 12) => {
                pad.hide();
                await pad.updateComplete;
                pad.limits = { [key]: { min: 0, max, step: 0.1, unit } };
                pad.limitKey = key;
                pad.unit = unit;
                pad.heading = unit === 'bar' ? 'Pressure target' : 'Temperature';
                pad.value = value;
                pad.open = true;
                await pad.updateComplete;
            };
            return true;
        })()`);
        await page.eval('openPad().then(() => true)');
        await page.settle();
        await fn(page);
        assert.deepEqual(page.pageErrors, []);
    });
}

test('out-of-range entry remains visible with an error and cannot confirm through API or a recent shortcut', async () => {
    await withPad(async page => {
        await page.eval('(() => { const p=document.querySelector("#pad"); p.press("2"); p.press("0"); return p.confirm(); })()');
        await page.settle();
        assert.equal(await page.eval('document.querySelector("#pad").outOfBand'), true);
        assert.equal(await page.eval('document.querySelector("#pad").renderRoot.querySelector("#confirm").disabled'), true);
        assert.match(await page.eval('document.querySelector("#pad").renderRoot.querySelector("#validation").textContent'), /0.*12/);
        assert.equal(await page.eval('document.querySelector("#pad")._buffer'), '20');
        await page.eval('document.querySelector("#pad").useprevious("99")');
        assert.deepEqual(await page.eval('confirmed'), []);
        assert.equal(await page.eval('document.querySelector("#pad").open'), true);
        await page.eval('document.querySelector("#pad").press("5")');
        await page.eval('(() => {const p=document.querySelector("#pad");p._buffer="5";p.confirm();return true})()');
        assert.equal((await page.eval('confirmed'))[0].value, 5);
    });
});

test('pressure target recents follow the next step and do not appear in temperature or flow inputs', async () => {
    await withPad(async page => {
        await page.eval('(() => {const p=document.querySelector("#pad");p.press("5");p.confirm();return true})()');
        await page.eval('openPad("target","bar","9").then(() => true)');
        await page.settle();
        assert.deepEqual(await page.eval('document.querySelector("#pad").shownPrevious'), ['5']);
        await page.eval('openPad("temperature","°C","93",100).then(() => true)');
        await page.settle();
        assert.deepEqual(await page.eval('document.querySelector("#pad").shownPrevious'), []);
        await page.eval('openPad("target","mL/s","2").then(() => true)');
        await page.settle();
        assert.deepEqual(await page.eval('document.querySelector("#pad").shownPrevious'), []);
        await page.eval('openPad("target","bar","9",4).then(() => true)');
        await page.settle();
        assert.deepEqual(await page.eval('document.querySelector("#pad").shownPrevious'), []);
    });
});

test('cancelled, untouched and vetoed entries do not become recent values', async () => {
    await withPad(async page => {
        await page.eval('(() => {const p=document.querySelector("#pad");p.press("6");p.cancel();return true})()');
        await page.eval('openPad().then(() => true)');
        await page.eval('document.querySelector("#pad").confirm()');
        await page.eval('openPad().then(() => true)');
        await page.eval('(() => {const p=document.querySelector("#pad");p.addEventListener("confirm",e=>e.preventDefault(),{once:true});p.press("7");p.confirm();return true})()');
        assert.deepEqual(await page.eval('document.querySelector("#pad").shownPrevious'), []);
    });
});

test('physical numeric keys enter a value without reaching page commands, while Enter confirms the value', async () => {
    await withPad(async page => {
        await page.press('5');
        await page.press('.');
        await page.press('5');
        assert.equal(await page.eval('document.querySelector("#pad")._buffer'), '5.5');
        await page.press('Enter');
        assert.equal((await page.eval('confirmed'))[0].value, 5.5);
        assert.deepEqual(await page.eval('leakedKeys'), []);
    });
});

for (const geometry of [BENCH, FLOOR]) {
    test(`four recent values and validation fit the keypad at ${geometry.width}×${geometry.height}`, async () => {
        await withPad(async page => {
            await page.eval(`(async()=>{const {numericHistory}=await import('/src/lib/numeric-input-history.js');for(const value of [3,5,7,9])numericHistory.remember('target','bar',value);const pad=document.querySelector('#pad');pad.press('2');pad.press('0');return true})()`);
            await page.settle();
            assert.equal(await page.count('#pad >>> #previous-grid ui-button'), 4);
            const metrics = await page.metrics('#pad >>> #body');
            assert(metrics.scrollWidth <= metrics.clientWidth + 1);
            await page.eval(`window.__h.need('#pad >>> #previous-0').scrollIntoView({block:'nearest'});true`);
            await page.settle();
            await page.click('#pad >>> #previous-0 >>> #btn');
            assert.equal((await page.eval('confirmed'))[0].value, 9);
        }, geometry);
    });
}

test('entering pressure on profile step one offers that value on profile step three', async () => {
    await browser.withPage({ geometry: BENCH, theme: 'light' }, async page => {
        const steps = Array.from({ length: 3 }, (_, index) => ({
            name: `Step ${index + 1}`, pump: 'pressure', transition: 'fast', pressure: 8,
            temperature: 93, sensor: 'coffee', seconds: 10, volume: 0, weight: 0,
            limiter: { value: 0, range: 0.6 }, exit: null,
        }));
        await mountEditing(page, { steps });
        const target = index => `${matrixCell('target', index)} > ui-stepper >>> #value`;
        await page.click(target(0));
        await page.press('5');
        await page.press('Enter');
        const committed = () => page.eval('window.__editor.events.filter(event => event.event === "value-commit").map(({index,field,value})=>({index,field,value}))');
        assert.deepEqual(await committed(), [{ index: 0, field: 'pressure', value: 5 }]);
        await page.evalFn(selector => { window.__h.need(selector).scrollIntoView({ block: 'nearest', inline: 'nearest' }); return true; }, target(2));
        await page.settle();
        await page.click(target(2));
        await page.settle();
        assert.equal(await page.evalFn(selector => window.__h.need(selector).open, EDITOR.numpad), true);
        assert.deepEqual(await page.evalFn(selector => window.__h.need(selector).shownPrevious, EDITOR.numpad), ['5']);
        await page.click(`${EDITOR.numpad} >>> #previous-0 >>> #btn`);
        assert.deepEqual(await committed(), [{ index: 0, field: 'pressure', value: 5 }, { index: 2, field: 'pressure', value: 5 }]);
        assert.deepEqual(page.pageErrors, []);
    });
});
