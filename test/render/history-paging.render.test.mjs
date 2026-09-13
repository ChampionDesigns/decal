/**
 * Render tests for the History list's pager.
 *
 * Serves a 45-record archive one page at a time and checks that every record is
 * reachable, that a chosen shot survives paging, and that a page which does not
 * arrive leaves the list standing and can be retried.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, BENCH } from '../harness/index.js';

const MODULES = [
    '/src/screens/history-screen.js',
    '/src/screens/history-flow-page.js',
    '/src/screens/history-power-page.js',
    '/src/screens/history-data-page.js',
];

const TOTAL = 45;

const SCREEN_STAGE = `
<div id="stage" style="inline-size: 100%; block-size: 100dvh">
  <history-screen></history-screen>
</div>`;

const BOOT = `(async () => {
  const listFixture = await fetch('/tools/rea-fixtures/api__v1__shots~limit=20~offset=0~order=desc.json')
    .then((r) => r.json());
  const seed = listFixture.items[0];
  const base = Date.parse(seed.timestamp + 'Z');
  const archive = [];
  for (let i = 0; i < ${TOTAL}; i += 1) {
    archive.push({ ...seed,
      id: 'shot-' + String(i).padStart(3, '0'),
      timestamp: new Date(base - i * 3600000).toISOString().replace('Z', '') });
  }
  const record = await fetch('/tools/rea-fixtures/api__v1__shots__5fc3f631-6b18-471b-9800-00d552dbbecb.json')
    .then((r) => r.json());

  window.__failNext = false;
  window.__listReads = 0;
  const screen = document.querySelector('history-screen');
  screen.boot = {
    transport: {
      request: async (route, options = {}) => {
        if (route === '/shots') {
          window.__listReads += 1;
          if (window.__failNext) {
            window.__failNext = false;
            return { ok: false, status: 503, message: 'the archive did not answer', data: null };
          }
          const q = (options && options.query) || {};
          const offset = Number(q.offset) || 0;
          const limit = Number(q.limit) || 20;
          return { ok: true, status: 200, notModified: false, data: {
            items: archive.slice(offset, offset + limit),
            total: archive.length, limit, offset } };
        }
        const id = route.slice('/shots/'.length);
        return { ok: true, status: 200, notModified: false, data: { ...record, id } };
      },
    },
  };
  await screen.updateComplete;
  for (let i = 0; i < 60; i += 1) {
    await new Promise((r) => setTimeout(r, 10));
    if (screen.renderRoot.getElementById('select-a')?.options?.length) break;
  }
  screen.page = 'data';
  await screen.updateComplete;
  await new Promise((r) => requestAnimationFrame(r));
  return { options: screen.renderRoot.getElementById('select-a').options.length };
})()`;

const READ = `(async () => {
  const screen = document.querySelector('history-screen');
  const data = screen.renderRoot.querySelector('history-data-page');
  await data.updateComplete;
  const root = data.renderRoot;
  const pager = root.getElementById('pager');
  const older = root.getElementById('page-older');
  const newer = root.getElementById('page-newer');
  const ids = (data.rows || []).map((row) => row.id);
  return {
    rows: ids.length,
    firstId: ids[0] ?? null,
    lastId: ids[ids.length - 1] ?? null,
    range: pager ? pager.querySelector('.range').textContent.trim() : null,
    older: older ? { label: older.textContent.trim(), disabled: older.hasAttribute('disabled') } : null,
    newer: newer ? { label: newer.textContent.trim(), disabled: newer.hasAttribute('disabled') } : null,
    optionsA: screen.renderRoot.getElementById('select-a').options.map((o) => o.value),
    shotA: screen.shotA,
    listReads: window.__listReads,
  };
})()`;

const TURN = (id) => `(async () => {
  const screen = document.querySelector('history-screen');
  const data = screen.renderRoot.querySelector('history-data-page');
  const button = data.renderRoot.getElementById('${id}');
  button.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, detail: 1 }));
  for (let i = 0; i < 60; i += 1) {
    await new Promise((r) => setTimeout(r, 10));
    await screen.updateComplete;
    await data.updateComplete;
    const pending = data.renderRoot.getElementById('page-older');
    if (pending && !pending.hasAttribute('disabled')) break;
    if (data.listWindow && !data.listWindow.busy) break;
  }
  await screen.updateComplete;
  await data.updateComplete;
  await new Promise((r) => requestAnimationFrame(r));
  return true;
})()`;

const PICK = (value) => `(async () => {
  const screen = document.querySelector('history-screen');
  const select = screen.renderRoot.getElementById('select-a');
  select.value = ${JSON.stringify(value)};
  select.dispatchEvent(new CustomEvent('change', {
    bubbles: true, composed: true, detail: { value: ${JSON.stringify(value)} } }));
  await screen.updateComplete;
  for (let i = 0; i < 60; i += 1) {
    await new Promise((r) => setTimeout(r, 10));
    const flow = screen.renderRoot.querySelector('history-flow-page');
    if (flow && flow.derivationA && flow.derivationA.ok) break;
  }
  await screen.updateComplete;
  const flow = screen.renderRoot.querySelector('history-flow-page');
  return { shotA: screen.shotA, drawn: Boolean(flow.derivationA && flow.derivationA.ok) };
})()`;

describe('History — every recorded shot is reachable', () => {
    let browser;
    before(async () => { browser = await launch({ geometry: BENCH }); });
    after(async () => { await browser?.close(); });

    const staged = (fn) => browser.withPage({ geometry: BENCH }, async (page) => {
        await page.mount(SCREEN_STAGE, MODULES);
        const opened = await page.eval(BOOT);
        assert.equal(opened.options, 20, 'the port still reads one page of twenty');
        await fn(page);
    });

    test('the pager reaches records 21-45 and says where it is', () => staged(async (page) => {
        const first = await page.eval(READ);
        assert.equal(first.rows, 20);
        assert.equal(first.firstId, 'shot-000');
        assert.match(first.range, /1-20 of 45/,
            `the strip must say which twenty of how many: ${first.range}`);
        assert.equal(first.newer.disabled, true, 'there is nothing newer than the newest page');
        assert.equal(first.older.disabled, false, 'and there is plainly something older');

        await page.eval(TURN('page-older'));
        const second = await page.eval(READ);
        assert.equal(second.firstId, 'shot-020', 'record 21 is on screen');
        assert.equal(second.lastId, 'shot-039');
        assert.match(second.range, /21-40 of 45/, second.range);
        assert.equal(second.newer.disabled, false, 'and the way back is live');

        await page.eval(TURN('page-older'));
        const third = await page.eval(READ);
        assert.equal(third.rows, 5, 'the last page is the short one');
        assert.equal(third.firstId, 'shot-040');
        assert.equal(third.lastId, 'shot-044', 'record 45 is reachable');
        assert.match(third.range, /41-45 of 45/, third.range);
        assert.equal(third.older.disabled, true,
            'the end of the archive is a disabled control, not a silence');

        await page.eval(TURN('page-newer'));
        const back = await page.eval(READ);
        assert.equal(back.firstId, 'shot-020', 'and the way back walks the same ladder');
    }));

    test('a shot chosen on the last page stays chosen after paging back', () => staged(
        async (page) => {
            await page.eval(TURN('page-older'));
            await page.eval(TURN('page-older'));
            const picked = await page.eval(PICK('shot-044'));
            assert.equal(picked.shotA, 'shot-044', 'the oldest record can be picked');
            assert.equal(picked.drawn, true, 'and its chart draws');

            await page.eval(TURN('page-newer'));
            await page.eval(TURN('page-newer'));
            const back = await page.eval(READ);
            assert.equal(back.firstId, 'shot-000', 'back on the first page');
            assert.equal(back.shotA, 'shot-044', 'the selection is not undone by browsing');
            assert.ok(back.optionsA.includes('shot-044'),
                'and the picker still offers the shot it is naming — a select whose value is '
                + `not among its options shows the wrong one: ${back.optionsA.slice(-3).join(', ')}`);
        },
    ));

    test('a page that does not arrive keeps the list and can be retried', () => staged(
        async (page) => {
            await page.eval('window.__failNext = true, true');
            await page.eval(TURN('page-older'));

            const failed = await page.eval(READ);
            assert.equal(failed.rows, 20, 'the rows that DID arrive are still on screen');
            assert.equal(failed.firstId, 'shot-000', 'and they are still the page we were on');
            assert.match(failed.range, /did not arrive/,
                `the strip has to say what happened: ${failed.range}`);
            assert.equal(failed.older.label, 'Try again',
                'and the same control is the retry, rather than a second one appearing');

            await page.eval(TURN('page-older'));
            const retried = await page.eval(READ);
            assert.equal(retried.firstId, 'shot-020', 'the retry lands on the page that failed');
            assert.match(retried.range, /21-40 of 45/, retried.range);
        },
    ));
});
