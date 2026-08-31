/**
 *.2, items numpad-container-query and numpad-port-checklist.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';
import { limitsFor } from '../../src/lib/machine-limits.js';
import {
    assertTokenDrill, assertFocusUnclipped, assertHitFloor, assertScrollFloor,
    DRILL_LENGTH,
} from '../harness/assertions.js';

const BENGLE = limitsFor('bengle');

const MODULE = [
    '/src/components/ui-numeric-keypad.js',
    '/src/components/ui-button.js',
    '/src/components/ui-dialog.js',
];

const MARKUP = `
<div id="page" style="padding: 40px">
  <ui-button id="invoker">18 g</ui-button>
  <ui-numeric-keypad id="np" heading="Dose in" limit-key="dose" unit="g" value="18"></ui-numeric-keypad>
</div>`;

const SHELL = '#np >>> #dialog';
const NATIVE = '#np >>> #dialog >>> #dialog';
const CELL_BODY = '#np >>> #dialog >>> #body';
const HEAD = '#np >>> #dialog >>> #head';
const ACTIONS = '#np >>> #dialog >>> #actions';
const TITLE = '#np >>> #dialog >>> ui-sheet-header >>> #title';
const BODY = '#np >>> #body';
const LAYOUT = '#np >>> #layout';
const ENTRY = '#np >>> #entry';
const PAD_COL = '#np >>> #pad-col';
const KEY_1 = '#np >>> #key-1';
/* The face lives in #15's shadow root, and #15 is a CHILD of the button — so the
 * middle hop is a light-DOM descendant selector, not a second `>>>`. */
const KEY_1_FACE = '#np >>> #key-1 ui-keycap >>> #cap';
const KEY_BACKSPACE = '#np >>> #key-backspace';
const DISPLAY = '#np >>> #display';

const QUERY_MAX = 584;
const PAD_WIDE = 24;      /* --ui-space-5, above the shell's own 720px query */
const PAD_NARROW = 18;    /* --ui-space-4, below it */
const cardFor = (container) => `${container + 2 * PAD_NARROW}px`;

const tracks = (value) => value.trim().split(/\s+/).length;

/** Rendered lengths at dsf 1.5 are not string-comparable; whole CSS px are. */
const near = (got, want, what, tol = 0.51) => assert.ok(
    Math.abs(got - want) <= tol,
    `${what}: expected ${want}, got ${got}`,
);

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`numpad container query @ ${geometry.name} (${geometry.width}×${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

        const mounted = (fn) => browser.withPage({ geometry }, async (page) => {
            await page.mount(MARKUP, MODULE);
            await page.evalFn((table) => {
                const np = document.getElementById('np');
                np.limits = table;
                np.open = true;
                return true;
            }, BENGLE);
            await page.settle(4);
            assert.deepEqual(page.pageErrors, [], 'the keypad must mount without throwing');

            assert.equal(
                await page.eval("(() => !!document.getElementById('np').shadowRoot.getElementById('unavailable'))()"),
                false,
                'the keypad must be ARMED — an unavailable panel means the contract is being measured on an empty box',
            );
            return fn(page);
        });

        /** Re-point the CARD, which is the only input the query has. */
        const setCard = async (page, value) => {
            await page.setStyle('#np', { '--_ui-numpad-inline': value });
            await page.settle(3);
        };

        const stacked = async (page) => {
            const entry = await page.box(ENTRY);
            const pad = await page.box(PAD_COL);
            return pad.y > entry.y + entry.height - 1;
        };

        const reveal = async (page, selector) => {
            await page.evalFn((s) => {
                window.__h.need(s).scrollIntoView({ block: 'center', behavior: 'instant' });
                return true;
            }, selector);
            await page.settle(3);
        };

        test('the container is the dialog\'s own box: its inline size IS the card\'s inner width',
            () => mounted(async (page) => {
                assert.equal(await page.prop(BODY, 'container-type'), 'inline-size',
                    '§4.6: "Carry that as a container query on the dialog\'s own box"');
                assert.equal(await page.prop('#np', 'container-type'), 'normal',
                    'the host has no box, so it cannot be the container (ui-numeric-keypad.js:328-335)');

                const card = await page.box(NATIVE);
                const cell = await page.box(CELL_BODY);
                const container = await page.box(BODY);

                near(cell.width, card.width, 'the body cell spans the card');
                near(container.width, card.width - 2 * PAD_WIDE,
                    'the container is the card minus the cell\'s two --_ui-dialog-pad insets');

                assert.equal(await page.prop(CELL_BODY, 'padding-left'), `${PAD_WIDE}px`,
                    'above the shell\'s 720px query the inset is --ui-space-5');
                await page.setStyle('#np', { '--_ui-numpad-inline': '700px' });
                await page.settle(3);
                assert.equal(await page.prop(CELL_BODY, 'padding-left'), `${PAD_NARROW}px`,
                    'ui-dialog.js:612-616 — " padding 24px -> 18px", as a container query');
                near((await page.box(BODY)).width, 700 - 2 * PAD_NARROW,
                    'and the container narrows by the same 12px');
                await page.setStyle('#np', { '--_ui-numpad-inline': null });
            }));

        test('the threshold is the CONTAINER\'s width, swept across it, and it flips exactly once',
            () => mounted(async (page) => {
                const seen = [];
                for (let card = 700; card >= 556; card -= 8) {
                    await setCard(page, `${card}px`);
                    seen.push({
                        card,
                        container: (await page.box(BODY)).width,
                        one: tracks(await page.prop(LAYOUT, 'grid-template-columns')) === 1,
                        stacked: await stacked(page),
                    });
                }
                await setCard(page, null);

                for (const s of seen) {
                    assert.equal(s.one, s.container <= QUERY_MAX + 0.5,
                        `@container (max-width: ${QUERY_MAX}px) is the whole rule: at a ${s.card}px card the `
                        + `container was ${s.container} and the layout was ${s.one ? 'one track' : 'two tracks'}`);
                    assert.equal(s.stacked, s.one, 'one track means the columns are stacked, not overlapping');
                }

                assert.ok(seen.some((s) => s.one), 'the sweep must reach the narrow branch');
                assert.ok(seen.some((s) => !s.one), 'and must start above it');
                const flips = seen.filter((s, i) => i > 0 && s.one !== seen[i - 1].one).length;
                assert.equal(flips, 1, 'one breakpoint, crossed once — §4.6\'s "one real breakpoint"');
            }));

        test('the SHELL\'s own knob moves it too — the box asked is #18\'s, not a private of #53',
            () => mounted(async (page) => {
                assert.equal(await stacked(page), false, 'two columns at the default 820px card');
                await page.setStyle(SHELL, { '--_ui-dialog-inline': cardFor(QUERY_MAX - 40) });
                await page.settle(3);
                assert.equal(await stacked(page), true,
                    'narrowing the DIALOG stacks the body — the container is the dialog\'s box');
                await page.setStyle(SHELL, { '--_ui-dialog-inline': null });
            }));

        test('not one media rule in this component asks about width or height',
            () => mounted(async (page) => {
                const found = JSON.parse(await page.eval(`(() => {
                    const media = [];
                    const containers = [];
                    const walk = (rules) => {
                        for (const rule of rules) {
                            if (rule.media) media.push(rule.conditionText ?? rule.media.mediaText);
                            if (rule.containerQuery !== undefined) containers.push(rule.containerQuery);
                            if (rule.cssRules) walk(rule.cssRules);
                        }
                    };
                    for (const sheet of document.getElementById('np').shadowRoot.adoptedStyleSheets) {
                        walk(sheet.cssRules);
                    }
                    return JSON.stringify({ media, containers });
                })()`));

                const sized = found.media.filter((c) => /width|height/i.test(c));
                assert.deepEqual(sized, [],
                    'ui-numeric-keypad.js:239 — "No @media (width…); the one carried breakpoint is a '
                    + 'container query on this component\'s own body box"');
                assert.ok(found.containers.length >= 1,
                    'and the breakpoint that DID survive is a container query');
                for (const q of found.containers) {
                    assert.match(q, /width/i, `a container query on the block axis is not expressible here: ${q}`);
                    assert.doesNotMatch(q, /height/i,
                        'section 4: the block-axis branch needs container-type: size, which collapses the card');
                }
            }));

        test('a window inside Slate\'s ≤720px branch does NOT stack the card by itself',
            () => mounted(async (page) => {
                const probe = { name: 'slate-720-probe', width: 700, height: geometry.height, deviceScaleFactor: 1, mobile: false };
                try {
                    await page.setGeometry(probe);
                    await page.settle(4);
                    const space6 = parseFloat(await page.resolveValue('var(--ui-space-6)', 'width'));
                    const card = await page.box(NATIVE);
                    near(card.width, probe.width - 2 * space6,
                        'the card is clamped by the shell, which is the window\'s only route in');
                    const container = await page.box(BODY);
                    assert.ok(container.width > QUERY_MAX,
                        `the container is ${container.width}, still above ${QUERY_MAX}`);
                    assert.equal(await stacked(page), false,
                        'Slate stacked here on the window alone; the container query does not');
                } finally {
                    await page.setGeometry(geometry);
                    await page.settle(3);
                }
            }));

        test('WIDE branch: two tracks, the seam is a column gap and there is no row gap',
            () => mounted(async (page) => {
                const seam = await page.resolveValue('var(--ui-seam)', 'column-gap');
                assert.equal(tracks(await page.prop(LAYOUT, 'grid-template-columns')), 2);
                assert.equal(await page.prop(LAYOUT, 'column-gap'), seam, 'the rule between the columns');
                assert.equal(await page.prop(LAYOUT, 'row-gap'), '0px', 'a column rule only');

                const entry = await page.box(ENTRY);
                const pad = await page.box(PAD_COL);
                assert.ok(pad.x > entry.x + entry.width - 1, 'side by side');
                near(pad.x, entry.right + parseFloat(seam), 'and the gap between them is one seam');
            }));

        test('NARROW branch: one track, the seam becomes a row gap and the insets swap axis',
            () => mounted(async (page) => {
                await setCard(page, cardFor(QUERY_MAX - 100));
                const seam = await page.resolveValue('var(--ui-seam)', 'row-gap');
                const space5 = await page.resolveValue('var(--ui-space-5)', 'padding-top');

                assert.equal(tracks(await page.prop(LAYOUT, 'grid-template-columns')), 1);
                assert.equal(await page.prop(LAYOUT, 'row-gap'), seam,
                    'ui-numeric-keypad.js:410-412 — .layout.seam-cols is (0,2,0), so the row gap is re-stated');
                assert.equal(await page.prop(ENTRY, 'padding-inline-end'), '0px',
                    'the entry column gives up its inline inset');
                assert.equal(await page.prop(ENTRY, 'padding-block-end'), space5, 'and takes a block one');
                assert.equal(await page.prop(PAD_COL, 'padding-inline-start'), '0px');
                assert.equal(await page.prop(PAD_COL, 'padding-block-start'), space5);

                const entry = await page.box(ENTRY);
                const pad = await page.box(PAD_COL);
                near(pad.y, entry.bottom + parseFloat(seam), 'stacked, one seam apart');
                await setCard(page, null);
            }));

        test('NARROW branch loses nothing: twelve keys, 3 × 4, the hit floor and an unclipped ring',
            () => mounted(async (page) => {
                await setCard(page, cardFor(QUERY_MAX - 100));

                const boxes = await page.evalFn(() => [...document.getElementById('np')
                    .shadowRoot.querySelectorAll('.key')]
                    .map((el) => {
                        const r = el.getBoundingClientRect();
                        return { id: el.id, x: Math.round(r.x), y: Math.round(r.y) };
                    }));
                assert.equal(boxes.length, 12, 'every key survives the compaction');
                assert.equal(new Set(boxes.map((b) => b.x)).size, 3, 'three columns');
                assert.equal(new Set(boxes.map((b) => b.y)).size, 4, 'four rows');

                await reveal(page, KEY_1);
                await assertHitFloor(page, KEY_1_FACE);
                await assertFocusUnclipped(page, KEY_1);
                await setCard(page, null);
            }));

        test('the card never reaches its block cap at either Gate A geometry — the short branch has nothing to do',
            () => mounted(async (page) => {
                const space5 = parseFloat(await page.resolveValue('var(--ui-space-5)', 'width'));
                const card = await page.box(NATIVE);
                const cap = geometry.height - 2 * space5;

                assert.ok(card.height < cap - 1,
                    `the card is ${card.height} against a cap of ${cap} — it is not the short case`);
                assert.ok(card.height < 545,
                    `the compaction Slate's short branch bought is already spent: ${card.height} < 545`);

                const m = await page.metrics(CELL_BODY);
                assert.ok(m.scrollHeight <= m.clientHeight + 0.5,
                    'and nothing is scrolling, so nothing is hidden by the card fitting');
            }));

        test('a genuinely short box is answered by the body scrolling, not by a second query',
            () => mounted(async (page) => {
                const head = await page.box(HEAD);
                const acts = await page.box(ACTIONS);
                const seam = parseFloat(await page.resolveValue('var(--ui-seam)', 'width'));
                const cap = `${Math.round(head.height + acts.height + 2 * seam + 96)}px`;

                await assertScrollFloor(page, {
                    selector: CELL_BODY,
                    squeezeSelector: NATIVE,
                    squeeze: { 'max-block-size': cap },
                });

                await page.setStyle(NATIVE, { 'max-block-size': cap });
                await page.settle(3);
                assert.equal(tracks(await page.prop(LAYOUT, 'grid-template-columns')), 2,
                    'the inline branch is not fired by a short box — the two questions stay separate');
                near((await page.box(HEAD)).height, head.height, 'the header does not surrender');
                near((await page.box(ACTIONS)).height, acts.height, 'nor does the footer');
                await page.setStyle(NATIVE, { 'max-block-size': null });
            }));

        test('O9: the backspace keeps its accessible name in both branches',
            () => mounted(async (page) => {
                const nameOf = () => page.evalFn(
                    (s) => window.__h.need(s).getAttribute('aria-label'), KEY_BACKSPACE,
                );
                const glyphHidden = () => page.evalFn(
                    (s) => window.__h.need(s).getAttribute('aria-hidden'),
                    '#np >>> #key-backspace ui-keycap >>> #glyph',
                );

                const wide = await nameOf();
                assert.ok(wide && wide.trim().length > 0,
                    'O9: "an unlabelled <svg>, not even aria-hidden" — the pressable must have a name');
                assert.equal(await glyphHidden(), 'true');

                await setCard(page, cardFor(QUERY_MAX - 100));
                assert.equal(await stacked(page), true, 'the fixture must actually be in the narrow branch');
                assert.equal(await nameOf(), wide, 'and the name is the same one after the compaction');
                assert.equal(await glyphHidden(), 'true');
                await setCard(page, null);
            }));

        test('O9: the readout stays a live region across the branch, and still announces',
            () => mounted(async (page) => {
                await setCard(page, cardFor(QUERY_MAX - 100));
                assert.equal(await stacked(page), true);

                const shape = await page.evalFn((s) => {
                    const el = window.__h.need(s);
                    return {
                        role: el.getAttribute('role'),
                        live: el.getAttribute('aria-live'),
                        atomic: el.getAttribute('aria-atomic'),
                        children: el.children.length,
                    };
                }, DISPLAY);
                assert.deepEqual(shape, { role: 'status', live: 'polite', atomic: 'true', children: 0 },
                    'O9: "the display is updated by innerHTML with no aria-live"');

                const before = await page.evalFn((s) => window.__h.need(s).textContent, DISPLAY);
                await reveal(page, KEY_BACKSPACE);
                await page.click(KEY_BACKSPACE);
                await page.settle(3);
                const after = await page.evalFn((s) => window.__h.need(s).textContent, DISPLAY);
                assert.notEqual(after, before, 'a press in the compacted layout still reaches the readout');
                await setCard(page, null);
            }));

        test('O10: the heading is token-sized in both branches, and the drill proves it',
            () => mounted(async (page) => {
                const wide = await page.prop(TITLE, 'font-size');

                await setCard(page, cardFor(QUERY_MAX - 100));
                assert.equal(await stacked(page), true);
                assert.equal(await page.prop(TITLE, 'font-size'), wide,
                    'O10: "writes an inline 28px unconditionally ... and shrinks to a 16px floor" — '
                    + 'the compaction must not re-open the fit loop');
                await assertTokenDrill(page, {
                    token: '--ui-text-xl',
                    value: DRILL_LENGTH,
                    selector: TITLE,
                    property: 'font-size',
                });
                assert.equal(
                    await page.evalFn((s) => window.__h.need(s).getAttribute('style'), TITLE),
                    null,
                    'O10: "writes an inline 28px" — the heading carries no inline style in either branch',
                );
                await setCard(page, null);
            }));
    });
}
