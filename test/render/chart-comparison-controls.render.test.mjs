import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { launch, BENCH } from '../harness/index.js';
let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

test('typed B offset commits valid numbers, rejects invalid text, and resets through real controls',
    () => browser.withPage({ geometry: BENCH }, async page => {
        await page.mount('<ui-compare-bar id="compare" has-comparison></ui-compare-bar>', ['/src/components/ui-compare-bar.js']);
        const input = '#compare >>> #offset-input >>> input';
        await page.focusVisible(input);
        await page.evalFn(() => document.getElementById('compare').shadowRoot.getElementById('offset-input').shadowRoot.querySelector('input').select());
        await page.send('Input.insertText', { text: '-0.7' });
        await page.press('Enter');
        assert.equal(await page.evalFn(() => document.getElementById('compare').offset), -.7);
        await page.evalFn(() => document.getElementById('compare').shadowRoot.getElementById('offset-input').shadowRoot.querySelector('input').select());
        await page.send('Input.insertText', { text: '5.1' });
        await page.press('Enter');
        assert.equal(await page.evalFn(() => document.getElementById('compare').offset), -.7);
        assert.equal(await page.evalFn(() => document.getElementById('compare').shadowRoot.getElementById('offset-input').invalid), true);
        await page.click('#compare >>> #reset');
        assert.equal(await page.evalFn(() => document.getElementById('compare').offset), 0);
    }));

test('a dynamic right axis expands without rebuilding and Steam targets are physically dashed',
    () => browser.withPage(async page => {
        await page.mount('<ui-chart-card id="card" style="display:block;width:900px;height:450px"></ui-chart-card>', ['/src/components/ui-chart-card.js']);
        const result = await page.evalFn(async () => {
            const { steamChannelSpecs } = await import('/src/lib/steam-chart.js');
            const { default: UPlot } = await import('uplot');
            const card = document.getElementById('card');
            let bounds = [0, 195];
            card.channelKeys = steamChannelSpecs({ milk: true }); card.y2 = { range: () => bounds };
            card.derivation = { ok: true, axis: { t: [0, 1] }, stepMarks: [], series: Object.fromEntries([
                ['pressure', [0, 1.6]], ['flow', [0, 1.8]], ['targetFlow', [1.8, 1.8]],
                ['steamTemperature', [145, 150]], ['milkTemperature', [30, 40]],
            ].map(([key, y]) => [key, { x: [0, 1], y }])) };
            await card.updateComplete; await card.ready; card.drawNow();
            const before = card.buildCount;
            bounds = [0, 205]; card.drawNow();
            const index = card.channels.findIndex(c => c.key === 'targetFlow') + 1;
            return { builds: card.buildCount - before, max: card.plotHandle.raw.scales.y2.max,
                dash: card.plotHandle.raw.series[index].dash.map(length => length / UPlot.pxRatio) };
        });
        assert.equal(result.builds, 0); assert.equal(result.max, 205); assert.deepEqual(result.dash, [9, 9]);
    }));
