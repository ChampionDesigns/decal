/**
 * The History screen's two wire dispositions.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, BENCH } from '../harness/index.js';

const SHOT_A = '5fc3f631-6b18-471b-9800-00d552dbbecb';
const SHOT_B = 'd5139a1f-c4ee-47e2-bb80-0cbf3e39b6a3';

const MODULES = [
    '/src/screens/history-screen.js',
    '/src/screens/history-flow-page.js',
    '/src/screens/history-data-page.js',
];

/** The screen, mounted the way the route mounts it: no children, one boot. */
const stage = `
<div id="stage" style="inline-size: 100%; block-size: 100dvh">
  <history-screen></history-screen>
</div>`;

const ARM = `(async () => {
  const screen = document.querySelector('history-screen');
  const key = (route) => (route === '/shots'
    ? 'api__v1__shots~limit=20~offset=0~order=desc.json'
    : 'api__v1__shots__' + route.slice('/shots/'.length) + '.json');
  screen.boot = {
    transport: {
      request: async (route) => {
        const res = await fetch('/tools/rea-fixtures/' + key(route), { cache: 'no-store' });
        if (!res.ok) return { ok: false, status: 404, message: 'no recording', data: null };
        return { ok: true, status: 200, data: await res.json(), notModified: false };
      },
    },
  };
  await screen.updateComplete;
  for (let i = 0; i < 40; i += 1) {
    await new Promise((r) => setTimeout(r, 10));
    if (screen.renderRoot.getElementById('select-a')?.options?.length) break;
  }
  await screen.updateComplete;
  return { options: screen.renderRoot.getElementById('select-a').options.length };
})()`;

/** Pick both shots and open the comparison, which is what puts the bar on screen. */
const PICK_PAIR = `(async () => {
  const screen = document.querySelector('history-screen');
  const pick = async (id, value) => {
    const select = screen.renderRoot.getElementById(id);
    select.value = value;
    select.dispatchEvent(new CustomEvent('change', { bubbles: true, composed: true, detail: { value } }));
    await screen.updateComplete;
  };
  await pick('select-a', '${SHOT_A}');
  screen.comparing = true;
  await screen.updateComplete;
  await pick('select-b', '${SHOT_B}');
  for (let i = 0; i < 60; i += 1) {
    await new Promise((r) => setTimeout(r, 10));
    const flow = screen.renderRoot.querySelector('history-flow-page');
    if (flow && flow.derivationA && flow.derivationB) break;
  }
  await screen.updateComplete;
  return { bar: Boolean(screen.renderRoot.getElementById('compare')) };
})()`;

let browser;
before(async () => { browser = await launch({ geometry: BENCH }); });
after(async () => { await browser?.close(); });

const armed = (fn) => browser.withPage({ geometry: BENCH }, async (page) => {
    await page.mount(stage, MODULES);
    const ok = await page.eval(ARM);
    assert.ok(ok.options > 0, 'the fixture list must arrive, or nothing below is about a screen');
    const pair = await page.eval(PICK_PAIR);
    assert.equal(pair.bar, true, 'the compare bar must be on screen for the reset gesture');
    await fn(page);
});

describe('the History screen\'s wires', () => {
    test('Reset reaches viewer.resetOffset() by the wire that actually fires (F-015)',
        () => armed(async (page) => {
            const got = await page.eval(`(async () => {
              const { HistoryViewer } = await import('/src/lib/history-viewer.js');
              const screen = document.querySelector('history-screen');
              const bar = screen.renderRoot.getElementById('compare');

              /* A PROTOTYPE SPY, not a stub: both methods still do their real work, and
               * the count is which one the gesture reached. */
              const calls = [];
              const realReset = HistoryViewer.prototype.resetOffset;
              const realSet = HistoryViewer.prototype.setOffset;
              HistoryViewer.prototype.resetOffset = function spy(...a) {
                calls.push('resetOffset'); return realReset.apply(this, a);
              };
              HistoryViewer.prototype.setOffset = function spy(...a) {
                calls.push('setOffset:' + a[0]); return realSet.apply(this, a);
              };
              try {
                const slider = bar.renderRoot.getElementById('slider');
                const input = slider.renderRoot.querySelector('input[type=range]');
                input.value = '3.7';
                input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
                await screen.updateComplete;
                const slid = calls.splice(0);

                const button = bar.renderRoot.getElementById('reset');
                button.renderRoot.querySelector('button').click();
                await screen.updateComplete;
                return { slid, reset: calls.slice(), offset: screen.offset, bar: bar.offset };
              } finally {
                HistoryViewer.prototype.resetOffset = realReset;
                HistoryViewer.prototype.setOffset = realSet;
              }
            })()`);

            assert.deepEqual(got.slid, ['setOffset:3.7'],
                'a SLIDE is not a reset and must still go straight to setOffset');
            assert.deepEqual(got.reset, ['resetOffset', 'setOffset:0'],
                'the Reset press must reach resetOffset() — and resetOffset is "only ever '
                + 'an undo", so setOffset(0) underneath it is that method doing its job');
            assert.equal(got.offset, 0, 'and the screen records what was applied');
            assert.equal(got.bar, 0);
        }));

    test('the dead @reset binding is gone, and no `reset` event exists to feed it (F-015)',
        () => armed(async (page) => {
            const got = await page.eval(`(async () => {
              const screen = document.querySelector('history-screen');
              const bar = screen.renderRoot.getElementById('compare');
              /* A reset event dispatched at the bar must reach NOBODY on this screen:
               * the binding that used to sit there could never have been fed, because
               * ui-compare-bar dispatches the fixed literal 'offset-change' and puts
               * 'reset' in detail.reason. Firing one by hand is the cleanest proof that
               * nothing is listening for the name any more. */
              const before = screen.offset;
              bar.dispatchEvent(new Event('reset', { bubbles: true, composed: true }));
              await screen.updateComplete;
              const afterFake = screen.offset;

              /* And the real gesture, whose detail carries the reason, still lands. */
              const slider = bar.renderRoot.getElementById('slider');
              const input = slider.renderRoot.querySelector('input[type=range]');
              input.value = '2.5';
              input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
              await screen.updateComplete;
              const slid = screen.offset;
              bar.dispatchEvent(new CustomEvent('offset-change', {
                bubbles: true, composed: true, detail: { offset: 0, reason: 'reset' },
              }));
              await screen.updateComplete;
              return { before, afterFake, slid, afterReal: screen.offset };
            })()`);
            assert.equal(got.afterFake, got.before,
                'a bare `reset` event must change nothing — nothing listens for that name');
            assert.equal(got.slid, 2.5);
            assert.equal(got.afterReal, 0,
                'the reason on the wire that DOES fire is what performs the reset');
        }));

    test('picking a disc still switches the slot, and announces nothing (F-012)',
        () => armed(async (page) => {
            const got = await page.eval(`(async () => {
              const { HistoryViewer } = await import('/src/lib/history-viewer.js');
              const screen = document.querySelector('history-screen');
              screen.comparing = true;
              await screen.updateComplete;
              /* The one thing the method is FOR: telling the viewer which slot is in
               * force. Spied on the prototype so the real work still happens. */
              const seenSlots = [];
              const realSetActive = HistoryViewer.prototype.setActiveSlot;
              HistoryViewer.prototype.setActiveSlot = function spy(...a) {
                seenSlots.push(a[0]); return realSetActive.apply(this, a);
              };
              const heard = [];
              for (const name of ['slot-change', 'shot-change', 'navigate']) {
                document.addEventListener(name, (e) => heard.push({ name, detail: e.detail }));
              }
              const before = screen.activeSlot;
              const disc = screen.renderRoot.getElementById('disc-b');
              disc.renderRoot.querySelector('button').click();
              await screen.updateComplete;
              const after = screen.activeSlot;
              const marked = {
                a: screen.renderRoot.getElementById('disc-a').selected,
                b: screen.renderRoot.getElementById('disc-b').selected,
              };
              /* Pressing the SAME disc twice is a no-op by the method's own guard. */
              disc.renderRoot.querySelector('button').click();
              await screen.updateComplete;
              HistoryViewer.prototype.setActiveSlot = realSetActive;
              return { before, after, marked, heard, viewerCalls: seenSlots.length, seenSlots };
            })()`);

            assert.notEqual(got.after, got.before, 'the press must move the slot in force');
            assert.equal(got.after, 'b');
            assert.equal(got.viewerCalls, 1,
                'the viewer is told once, which is the whole job the method has');
            assert.deepEqual(got.marked, { a: false, b: true },
                'the disc pressed is the one the band wears as marked');
            assert.deepEqual(got.heard, [],
                'and the screen announces nothing: the courtesy `slot-change` emit had no '
                + 'listener anywhere and marking a disc changes no shot');
        }));
});
