/**
 * ui-chart-card-scrub.render.test.mjs — the SCRUB, at the component's own level.
 * Audit F-034 (a cursor for a chart whose x is not time), F-032 as the editor preview
 * shows it, and F-016 row 1 (the preview's plot well had no accessible name).
 *
 * A SIBLING OF `ui-chart-card.render.test.mjs`, not an extension of it: that suite owns
 * the index cursor, the coordinate re-verify and the mount, and it is a long file already.
 * What lives here is the machinery the audit found missing — the point cursor, the name on
 * the well, and the one screen that mounts a bare preview card.
 *
 * WHAT FAILED BEFORE. `cursorPoints` did not exist, so a card fed only through `setBands`
 * — the P–Q trajectory, the one chart in the skin whose x is flow — returned from
 * `#readCursor` before it did anything, and its whole shadow markup was byte-identical
 * across a full press-move-release. The well had `role` and `aria-label` on it only when
 * `activate` was set, so every scrub surface in the skin mapped to `generic`, a role that
 * takes no accessible name at all. And `<editor-preview>` mounted a card with a `slot=
 * "empty"` span and nothing else, so its foot slot had nothing to fill.
 *
 * A8: nothing here opens a file.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, BENCH } from '../harness/index.js';
import { accessibleNames } from '../harness/editor.js';

const CARD_MODULE = ['/src/components/ui-chart-card.js'];
const PREVIEW_MODULE = ['/src/screens/editor-preview.js'];

const cardStage = `
<div id="stage" style="inline-size: 760px; block-size: 340px; margin: 24px">
  <ui-chart-card id="c" label="Trajectory" scrub-label="Trajectory scrub"
    channels="pressure" x-min="0" x-max="10"
    style="display: block; block-size: 340px"></ui-chart-card>
</div>`;

/**
 * A HAND-MADE LOOP, and it has to be hand-made: the claim is that "nearest" is decided by
 * xy distance rather than by x alone, and only a path that visits ONE x at two very
 * different heights can tell the two rules apart. A real trajectory does exactly that —
 * that is what makes it a loop rather than a line — but a fixture's loop is wherever the
 * shot happened to put it, which is not a geometry a test can point at.
 *
 * Four points: two at flow 5 (pressure 1 and pressure 9) and two at the ends.
 */
const POINTS = [
    { x: 1, y: 1, t: 0 },
    { x: 5, y: 1, t: 1 },
    { x: 5, y: 9, t: 2 },
    { x: 9, y: 9, t: 3 },
];

const FEED_POINTS = `(async () => {
  const el = document.getElementById('c');
  await el.ready;
  el.yRange = [0, 10];
  await el.updateComplete;
  el.setBands([{ points: ${JSON.stringify(POINTS)}, colorAt: () => 'red', width: 2 }]);
  el.cursorPoints = ${JSON.stringify(POINTS)};
  el.empty = false;
  await el.updateComplete;
  el.drawNow();
  await new Promise((r) => requestAnimationFrame(r));
  return { hasPlot: Boolean(el.plotHandle), points: el.cursorPoints.length };
})()`;

/** The card's whole answer to "where is the cursor and what does it look like". */
const READ_CARD = `(() => {
  const el = document.getElementById('c');
  const line = el.renderRoot.querySelector('.cursor');
  return {
    cursor: { ...el.cursor, values: { ...el.cursor.values } },
    hidden: line.hidden,
    shape: line.dataset.shape ?? null,
    x: line.style.getPropertyValue('--_ui-chart-cursor-x'),
    top: line.style.getPropertyValue('--_ui-chart-cursor-top'),
    box: (() => { const b = line.getBoundingClientRect(); return { w: +b.width.toFixed(1), h: +b.height.toFixed(1) }; })(),
  };
})()`;

/** Where a data point sits, in viewport px, so a mouse can be put beside it. */
const AT = (x, y) => `(() => {
  const el = document.getElementById('c');
  const over = el.plotHandle.raw.over;
  const rect = over.getBoundingClientRect();
  return {
    x: rect.left + el.plotHandle.raw.valToPos(${x}, 'x'),
    y: rect.top + el.plotHandle.raw.valToPos(${y}, 'y'),
  };
})()`;

const previewStage = `
<div id="stage" style="inline-size: 760px; block-size: 340px; margin: 24px">
  <editor-preview id="p" style="display: block; block-size: 340px"></editor-preview>
</div>`;

/** A two-step profile, which is all the preview's own producer needs. */
const FEED_PREVIEW = `(async () => {
  const el = document.getElementById('p');
  el.profile = {
    title: 'Test', steps: [
      { name: 'Preinfusion', pump: 'flow', flow: 4, seconds: 10 },
      { name: 'Hold', pump: 'pressure', pressure: 9, seconds: 20 },
    ],
  };
  await el.updateComplete;
  const card = el.card;
  await card.ready;
  await el.updateComplete;
  card.drawNow();
  await new Promise((r) => requestAnimationFrame(r));
  return { ok: el.derivation.ok, deferred: el.deferred, hasPlot: Boolean(card.plotHandle) };
})()`;

const READ_PREVIEW = `(() => {
  const el = document.getElementById('p');
  const foot = el.card.querySelector('[slot="foot"]');
  return {
    foot: foot ? foot.textContent.trim() : null,
    footBox: foot ? +foot.getBoundingClientRect().height.toFixed(2) : null,
    cursor: { ...el.card.cursor, values: { ...el.card.cursor.values } },
  };
})()`;

let browser;
before(async () => { browser = await launch({ geometry: BENCH }); });
after(async () => { await browser?.close(); });

const onCard = (fn) => browser.withPage({ geometry: BENCH }, async (page) => {
    await page.mount(cardStage, CARD_MODULE);
    const fed = await page.eval(FEED_POINTS);
    assert.equal(fed.hasPlot, true, 'the card must have a plot, or there is nothing to scrub');
    await fn(page);
    assert.deepEqual(page.pageErrors, []);
});

const onPreview = (fn) => browser.withPage({ geometry: BENCH }, async (page) => {
    await page.mount(previewStage, PREVIEW_MODULE);
    const fed = await page.eval(FEED_PREVIEW);
    assert.equal(fed.ok, true, 'the preview must derive its two steps');
    assert.equal(fed.hasPlot, true);
    await fn(page);
    assert.deepEqual(page.pageErrors, []);
});

describe('the chart card\'s point cursor (F-034)', () => {
    test('NEAREST IS BY xy DISTANCE: one x, two heights, two different points', () => onCard(async (page) => {
        /* The pointer is placed just BELOW the low point of the pair and just ABOVE the
         * high one, at the same x. An x-only search answers the same index for both. */
        const low = await page.eval(AT(5, 1.6));
        await page.mouse('mouseMoved', low.x, low.y);
        const atLow = await page.eval(READ_CARD);

        const high = await page.eval(AT(5, 8.4));
        await page.mouse('mouseMoved', high.x, high.y);
        const atHigh = await page.eval(READ_CARD);

        assert.equal(atLow.cursor.active, true, 'the press must be answered at all');
        assert.equal(atHigh.cursor.active, true);
        assert.equal(atLow.cursor.idx, 1, `expected the pressure-1 point, got ${atLow.cursor.idx}`);
        assert.equal(atHigh.cursor.idx, 2, `expected the pressure-9 point, got ${atHigh.cursor.idx}`);
        assert.deepEqual(atLow.cursor.point, POINTS[1]);
        assert.deepEqual(atHigh.cursor.point, POINTS[2]);
        assert.equal(atLow.cursor.t, 1, 'and the point carries the second it belongs to');
    }));

    test('the mark is a DOT at the point, not a rule at its x', () => onCard(async (page) => {
        const resting = await page.eval(READ_CARD);
        assert.equal(resting.hidden, true, 'no pointer, no mark');

        const at = await page.eval(AT(9, 9));
        await page.mouse('mouseMoved', at.x, at.y);
        const marked = await page.eval(READ_CARD);
        assert.equal(marked.hidden, false);
        assert.equal(marked.shape, 'point');
        assert.ok(marked.top.includes('calc('),
            `the mark is placed on BOTH axes: ${JSON.stringify(marked.top)}`);
        /* A square, not a hairline the height of the plot: the vertical rule answers
         * "which instant" and this chart has no instant on its x. */
        assert.equal(marked.box.w, marked.box.h,
            `a dot is as wide as it is tall: ${JSON.stringify(marked.box)}`);
        assert.ok(marked.box.h > 0 && marked.box.h < 40,
            `and it is a mark rather than a rule: ${marked.box.h}px`);
    }));

    test('the wire carries the point, and only when the point changes', () => onCard(async (page) => {
        await page.recordEvents('#c', ['cursor-change']);
        const a = await page.eval(AT(1, 1));
        await page.mouse('mouseMoved', a.x, a.y);
        await page.mouse('mouseMoved', a.x + 1, a.y + 1);      // same nearest point
        const b = await page.eval(AT(9, 9));
        await page.mouse('mouseMoved', b.x, b.y);
        const events = await page.recordedEvents();
        assert.equal(events.length, 2,
            `one event per point, not per pixel: ${JSON.stringify(events.map((e) => e.detail.idx))}`);
        assert.deepEqual(events[0].detail.point, POINTS[0]);
        assert.deepEqual(events[1].detail.point, POINTS[3]);
        assert.deepEqual(events[1].detail.values, {},
            'a trajectory reading is not a column of channel values');
    }));

    test('leaving the well clears the mark and its shape', () => onCard(async (page) => {
        const at = await page.eval(AT(5, 9));
        await page.mouse('mouseMoved', at.x, at.y);
        assert.equal((await page.eval(READ_CARD)).hidden, false);
        const box = await page.box('#c >>> .well');
        await page.mouse('mouseMoved', box.left - 30, box.top - 30);
        const gone = await page.eval(READ_CARD);
        assert.equal(gone.cursor.active, false);
        assert.equal(gone.hidden, true);
        assert.equal(gone.shape, null, 'and the card goes back to being a rule card');
    }));

    test('a card with no points and no derivation is unchanged — the index cursor still rules',
        () => browser.withPage({ geometry: BENCH }, async (page) => {
            await page.mount(cardStage, CARD_MODULE);
            const before = await page.eval(READ_CARD);
            const box = await page.box('#c >>> .well');
            await page.mouse('mouseMoved',
                box.left + box.width / 2, box.top + box.height / 2);
            const after = await page.eval(READ_CARD);
            assert.deepEqual(after.cursor, before.cursor,
                'with nothing to point at there is still no cursor');
            assert.equal(after.hidden, true);
        }));
});

describe('the plot well is a named control (F-016 row 1)', () => {
    test('the well takes role=group and the scrub label, and the name reaches the AX tree',
        () => onCard(async (page) => {
            const attrs = await page.evalFn((s) => {
                const el = window.__h.need(s);
                return { role: el.getAttribute('role'), name: el.getAttribute('aria-label') };
            }, '#c >>> .well');
            /* D16, BEN, 30 AUGUST 2026: "{chart name} — chart scrub" became "{chart
             * name} scrub". The three lines here read 'Trajectory — chart scrub' and the
             * stage above supplied it; the CARD authors no word either way (its NO STRINGS
             * law), so this is a fixture following the four call sites rather than a claim
             * about the component changing. */
            assert.deepEqual(attrs, { role: 'group', name: 'Trajectory scrub' });
            const names = await accessibleNames(page);
            assert.ok(names.some((n) => n.role === 'group' && n.name === 'Trajectory scrub'),
                `the name never reached the tree: ${JSON.stringify(names)}`);
        }));

    test('with no scrub-label it falls back to the card\'s own label, exactly as activate-label does',
        () => browser.withPage({ geometry: BENCH }, async (page) => {
            await page.mount(`
                <div id="stage" style="inline-size: 760px; block-size: 340px">
                  <ui-chart-card id="c" label="Shot chart"
                    style="display: block; block-size: 340px"></ui-chart-card>
                </div>`, CARD_MODULE);
            const attrs = await page.evalFn((s) => {
                const el = window.__h.need(s);
                return { role: el.getAttribute('role'), name: el.getAttribute('aria-label') };
            }, '#c >>> .well');
            assert.deepEqual(attrs, { role: 'group', name: 'Shot chart' });
        }));

    test('a card you can OPEN is still a button, and still takes the activate label',
        () => browser.withPage({ geometry: BENCH }, async (page) => {
            await page.mount(`
                <div id="stage" style="inline-size: 760px; block-size: 340px">
                  <ui-chart-card id="c" label="Shot chart" activate activate-label="Open the chart"
                    scrub-label="never read"
                    style="display: block; block-size: 340px"></ui-chart-card>
                </div>`, CARD_MODULE);
            const attrs = await page.evalFn((s) => {
                const el = window.__h.need(s);
                return {
                    role: el.getAttribute('role'),
                    name: el.getAttribute('aria-label'),
                    tabindex: el.getAttribute('tabindex'),
                };
            }, '#c >>> .well');
            assert.deepEqual(attrs, { role: 'button', name: 'Open the chart', tabindex: '0' },
                'a card you can open is not a card you scrub (#bindPointer says so too)');
        }));
});

describe('the editor preview names what it draws (F-032)', () => {
    test('a scrub names the planned values and the second, and release clears it',
        () => onPreview(async (page) => {
            const resting = await page.eval(READ_PREVIEW);
            assert.equal(resting.foot, '', 'before the drag the card names none');
            assert.ok(resting.footBox > 0,
                'and the strip reserves its height, so text appearing on pointerdown does '
                + 'not take it out of the plot under the finger');

            const box = await page.box('#p >>> #card >>> .well');
            const seen = [];
            for (let i = 1; i <= 4; i += 1) {
                await page.mouse('mouseMoved',
                    box.left + (box.width * i) / 5, box.top + box.height / 2);
                seen.push(await page.eval(READ_PREVIEW));
            }

            assert.ok(seen.every((s) => s.cursor.active), 'the cursor must be live throughout');
            for (const s of seen) {
                const parts = s.foot.split('·').map((x) => x.trim());
                /* A STEP COMMANDS ONE QUANTITY, so a preview names one plus the time.
                 * `stepTargetOverlay` draws targetFlow over a flow step and
                 * targetPressure over a pressure one; naming a channel the profile does
                 * not command there would be inventing a plan it does not carry. */
                assert.equal(parts.length, 2,
                    `the commanded value and the second — got ${JSON.stringify(s.foot)}`);
                assert.match(parts[0], /^(Pressure \d+(\.\d+)? bar|Flow \d+(\.\d+)? mL\/s)$/);
                assert.match(parts[1], /^\d+(\.\d+)? s$/);
            }
            const words = seen.map((s) => s.foot.split(' ')[0]);
            assert.deepEqual([...new Set(words)].sort(), ['Flow', 'Pressure'],
                `the flow step and the pressure step must read differently: ${words.join(', ')}`);
            assert.ok(new Set(seen.map((s) => s.foot)).size > 1,
                `the reading must move with the pointer: ${seen.map((s) => s.foot).join(' | ')}`);

            await page.mouse('mouseMoved', box.left - 40, box.top - 40);
            const after = await page.eval(READ_PREVIEW);
            assert.equal(after.cursor.active, false);
            assert.equal(after.foot, '', 'lifting the pointer clears it');
        }));

    test('the preview\'s well is named too', () => onPreview(async (page) => {
        const attrs = await page.evalFn((s) => {
            const el = window.__h.need(s);
            return { role: el.getAttribute('role'), name: el.getAttribute('aria-label') };
        }, '#p >>> #card >>> .well');
        assert.equal(attrs.role, 'group');
        /* D16: this read 'Profile preview — chart scrub'. Unlike the two above it is not a
         * fixture — it is what `editor-preview.js` composes — so it is the assertion that
         * fails before the call site is shortened and passes after. */
        assert.equal(attrs.name, 'Profile preview scrub');
    }));
});
