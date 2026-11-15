import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';

const MODULES = ['/src/screens/history-data-page.js'];

const STAGE = `
<div id="stage" style="inline-size: 100%; block-size: 100dvh; display: grid;
     grid-template-rows: minmax(0,1fr); grid-template-columns: minmax(0,1fr)">
  <history-data-page id="page-under-test"></history-data-page>
</div>`;

const FEED = `(async () => {
  const { shotRows } = await import('/src/lib/shot-summary.js');
  const page = document.querySelector('history-data-page');
  page.rows = shotRows([
    { id: 'rated-half', timestamp: '2026-08-28T10:15:00.000Z', annotations: { enjoyment: 7.5 } },
    { id: 'rated-whole', timestamp: '2026-08-27T10:15:00.000Z', annotations: { enjoyment: 10 } },
    { id: 'unrated', timestamp: '2026-08-26T10:15:00.000Z', annotations: {} },
  ]);
  await page.updateComplete;
  const grid = page.renderRoot.getElementById('shot-list');
  await grid.updateComplete;
  await new Promise((r) => requestAnimationFrame(r));
  return true;
})()`;

const READ = `(() => {
  const grid = document.querySelector('history-data-page').renderRoot.getElementById('shot-list');
  const root = grid.renderRoot;
  const cell = (id) => {
    const node = root.getElementById(id);
    return node ? { text: node.textContent.trim(), clipped: node.scrollWidth > node.clientWidth + 0.5 } : null;
  };
  return {
    label: root.getElementById('col-enjoyment').querySelector('.col-label').textContent.trim(),
    half: cell('cell-rated-half-enjoyment'),
    whole: cell('cell-rated-whole-enjoyment'),
    unrated: cell('cell-unrated-enjoyment'),
  };
})()`;

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`history rating column @ ${geometry.name}`, () => {
        let browser;
        let page;

        before(async () => {
            browser = await launch({ geometry });
            page = await browser.newPage({ geometry });
        });
        after(async () => { await browser?.close(); });

        test('the Rating column is out of 10 and shows the served value', async () => {
            await page.mount(STAGE, MODULES);
            await page.settle(4);
            assert.equal(await page.eval(FEED), true);
            await page.settle(4);
            const got = await page.eval(READ);
            assert.equal(got.label, 'Rating');
            assert.deepEqual(got.half, { text: '7.5/10', clipped: false });
            assert.deepEqual(got.whole, { text: '10.0/10', clipped: false },
                'the widest rating fits its column');
            assert.deepEqual(got.unrated, { text: '—', clipped: false });
        });
    });
}
