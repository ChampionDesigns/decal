

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';
import { DIM_KEEPS_INPUT } from '../../src/lib/live-dimming.js';

const MODULES = ['/test/fixtures/live-selector-carry-fixture.js'];
const STAGE = '<div id="stage" style="inline-size: 100%; block-size: 100dvh"></div>';

const BANK_ROWS = DIM_KEEPS_INPUT;

const PROBE = (railKey, index) => `(() => {
  const screen = document.querySelector('live-screen');
  const bank = screen.shadowRoot.querySelector('ui-preset-bank[data-key="${railKey}"]');
  if (!bank) return { found: false };
  const cell = bank.shadowRoot.querySelector('ui-bank').shadowRoot.querySelectorAll('.item')[${index}];

  /* BRING IT INTO THE VIEWPORT FIRST, AND THAT IS THE HARNESS'S PROBLEM, NOT THE APP'S.
     A hit test is a question about a POINT ON THE GLASS, so a control scrolled past the
     fold answers the scroll container and the walk stops there — which is a true statement
     about a point nobody can press, and not the statement this file is making. The rail
     scrolls here because a page mounted straight into an 801px stage skips app-fit, which
     is what gives the real app a 1200-unit design height; on the tablet the rail does not
     scroll and every cell is on the glass. Wave 3 measured the fitted app. */
  cell.scrollIntoView({ block: 'center' });
  const box = cell.getBoundingClientRect();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;

  /* THE WALK. Push what we are standing on, step into its shadow root, and resolve a
     slot before deciding we have arrived — see the header for why that last part is the
     difference between this and Wave 1's driver. */
  const path = [];
  let node = document.elementFromPoint(x, y);
  let guard = 0;
  while (node && guard < 32) {
    guard += 1;
    path.push(node.tagName.toLowerCase() + (node.id ? '#' + node.id : ''));
    const root = node.shadowRoot;
    if (!root) break;
    let next = root.elementFromPoint(x, y);
    /* A SLOT WITH NOTHING ASSIGNED IS RENDERING ITS OWN FALLBACK, so it IS the answer and
       must not be resolved away — ui-bank paints its cells' contents through exactly such
       a slot, and treating an empty assignment as "nothing here" is how a walk stops two
       levels above a control it was standing on. */
    if (next && next.tagName === 'SLOT') {
      const assigned = next.assignedElements();
      if (assigned.length) next = assigned[0];
    }
    if (!next || next === node) break;
    node = next;
  }
  return {
    found: true,
    x: +x.toFixed(2), y: +y.toFixed(2),
    box: { w: +box.width.toFixed(2), h: +box.height.toFixed(2) },
    path,
    /* Did the walk end INSIDE this cell? Asked of the node the browser answered with,
       not of the path strings, so a tag name that happens to repeat cannot fake it. */
    insideCell: cell.contains(node) || cell === node,
    pointerEvents: getComputedStyle(bank).pointerEvents,
    opacity: getComputedStyle(bank).opacity,
    dim: screen.getAttribute('dim'),
  };
})()`;

/** The same walk at an arbitrary point — used for the STOP target and the modal case. */
const HIT_AT = (x, y) => `(() => {
  const path = [];
  let node = document.elementFromPoint(${x}, ${y});
  let guard = 0;
  while (node && guard < 32) {
    guard += 1;
    path.push(node.tagName.toLowerCase() + (node.id ? '#' + node.id : ''));
    const root = node.shadowRoot;
    if (!root) break;
    let next = root.elementFromPoint(${x}, ${y});
    if (next && next.tagName === 'SLOT') {
      const assigned = next.assignedElements();
      if (assigned.length) next = assigned[0];
    }
    if (!next || next === node) break;
    node = next;
  }
  return path;
})()`;

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`live preset cells mid-shot @ ${geometry.name} (${geometry.width}x${geometry.height})`, () => {

        const mounted = (fn) => browser.withPage({ geometry }, async (page) => {
            await page.mount(STAGE, MODULES);
            await page.settle(6);
            await page.evalFn(() => window.__carry.mount());
            assert.deepEqual(page.pageErrors, [], 'the rail must mount without throwing');
            await fn(page);
            assert.deepEqual(page.pageErrors, [], 'the rail must run without throwing');
        });

        /** Put the machine into a live espresso shot, through the feed the owner reads. */
        const streaming = async (page) => {
            const dim = await page.evalFn(() => window.__carry.pushMachineState('espresso'));
            assert.equal(dim, 'all',
                'the one dimming owner did not publish `all` — the state under test never arrived');
            await page.settle(4);
        };

        test('F-038 — a deep hit at a preset cell\'s centre lands INSIDE the cell mid-shot',
            () => mounted(async (page) => {
                const before = await page.eval(PROBE('steamFlow', 1));
                assert.equal(before.found, true, 'the flow bank is on the rail at rest');
                assert.equal(before.insideCell, true, 'and it is hittable at rest — the control');

                await streaming(page);

                const during = await page.eval(PROBE('steamFlow', 1));
                assert.equal(during.dim, 'all', 'the rail is receded, which is unchanged');
                assert.ok(during.box.w > 0 && during.box.h > 0,
                    'the cell still has a box — this was never a layout fault');

                assert.equal(during.insideCell, true,
                    `the hit resolved to ${during.path.join(' >>> ')} instead of the cell`);
                assert.ok(!during.path.includes('live-rail'),
                    `the rail answered for the cell again: ${during.path.join(' >>> ')}`);
            }));

        test('F-038 — all EIGHT cells, both banks, exactly as Wave 3 swept them',
            () => mounted(async (page) => {
                await streaming(page);
                const keys = { 'drink-weight-presets': 'drinkWeight', 'steam-flow-presets': 'steamFlow' };
                const unreachable = [];
                for (const row of BANK_ROWS) {
                    for (let i = 0; i < 4; i += 1) {
                        const read = await page.eval(PROBE(keys[row], i));
                        assert.equal(read.found, true, `${row} is not on the rail`);
                        if (!read.insideCell) unreachable.push(`${row}[${i}] → ${read.path.join(' >>> ')}`);
                    }
                }
                assert.deepEqual(unreachable, [],
                    'Wave 3 measured 8 of these 8 resolving to live-rail; none may now');
            }));

        test('F-038 — the bank still RECEDES: the paint is untouched, only the input is back',
            () => mounted(async (page) => {
                const rest = await page.eval(PROBE('steamFlow', 1));
                await streaming(page);
                const during = await page.eval(PROBE('steamFlow', 1));

                assert.equal(during.pointerEvents, 'auto', 'the bank takes a press again');
                assert.ok(Number(during.opacity) < Number(rest.opacity),
                    `the bank still recedes (${rest.opacity} → ${during.opacity})`);
                assert.ok(Number(during.opacity) > 0, 'and it recedes rather than disappearing');
            }));

        test('F-038 — and the tap APPLIES: a real press mid-shot fires the F-022 write',
            () => mounted(async (page) => {
                await streaming(page);
                await page.evalFn(() => window.__carry.clearRequests());

                const at = await page.eval(PROBE('steamFlow', 2));
                await page.mouse('mousePressed', at.x, at.y, { button: 'left', clickCount: 1 });
                await page.mouse('mouseReleased', at.x, at.y, { button: 'left', clickCount: 1 });
                await page.settle(6);

                /* A REAL PRESS, NOT `cell.click()`. The whole point of the finding is that
                 * a synthetic dispatch could not tell the difference; so could a synthetic
                 * proof. */
                const kv = await page.evalFn(() => window.__carry
                    .requests('/store/decal/steamFlowPresetIndex'));
                assert.equal(kv.length, 1,
                    'the F-022 write did not fire — the press never reached the cell');
                assert.equal(kv[0].method, 'POST');
                assert.equal(kv[0].body, 2, 'and it names the cell that was pressed');

                const workflow = await page.evalFn(() => window.__carry.requests('/api/v1/workflow')
                    .filter((r) => r.method === 'PUT'));
                assert.equal(workflow.length, 1, 'and the machine write rides beside it, as ever');
            }));

        test('the rail\'s own exempt control is untouched: STOP still answers mid-shot',
            () => mounted(async (page) => {
                await streaming(page);
                const stop = await page.evalFn(() => {
                    const el = document.querySelector('live-screen').shadowRoot
                        .querySelector('ui-stop-button');
                    if (!el) return null;
                    const b = el.getBoundingClientRect();
                    return { x: +(b.x + b.width / 2).toFixed(2), y: +(b.y + b.height / 2).toFixed(2) };
                });
                assert.ok(stop, 'a running machine draws the abort target');
                const path = await page.eval(HIT_AT(stop.x, stop.y));
                assert.ok(path.includes('ui-stop-button'),
                    `the abort target is the one control that must never be shadowed: ${path.join(' >>> ')}`);
            }));

        test('the STEPPERS are deliberately NOT changed — recorded, not guessed',
            () => mounted(async (page) => {
                await streaming(page);
                const steppers = await page.evalFn(() => [...document.querySelector('live-screen')
                    .shadowRoot.querySelectorAll('ui-stepper[data-dim-group]')]
                    .map((el) => ({
                        row: el.getAttribute('data-row'),
                        keepsInput: el.hasAttribute('data-dim-keeps-input'),
                        pointerEvents: getComputedStyle(el).pointerEvents,
                    })));
                assert.ok(steppers.length > 0, 'the rail has dimmable steppers to speak about');
                for (const row of steppers) {
                    assert.equal(row.keepsInput, false,
                        `${row.row} was given the exemption without a decision`);
                    assert.equal(row.pointerEvents, 'none',
                        `${row.row}'s behaviour changed, and no finding asked for that`);
                }
            }));

        test('a MODAL still blocks the cells — that case is separate and stays blocking',
            () => mounted(async (page) => {
                await streaming(page);
                const reachable = await page.eval(PROBE('drinkWeight', 0));
                assert.equal(reachable.insideCell, true, 'staged with the cell reachable');

                await page.evalFn(() => window.__carry.holdPreset('drinkWeight', 0));
                await page.evalFn(() => window.__carry.pressMenuItem('enter'));
                await page.settle(6);
                const pad = await page.evalFn(() => window.__carry.keypad());
                assert.ok(pad && pad.open, 'the numpad did not open — nothing modal to test');

                const blocked = await page.eval(PROBE('drinkWeight', 0));
                assert.equal(blocked.insideCell, false,
                    `a cell behind an open modal must not answer: ${blocked.path.join(' >>> ')}`);
            }));
    });
}
