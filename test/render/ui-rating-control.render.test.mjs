/**
 *.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';
import { entry as galleryEntry } from '../../tools/gallery/entries/ui-rating-control.entry.js';
import {
    assertTokenDrill,
    assertFocusUnclipped,
    assertHitFloor,
    DRILL_COLOUR,
    DRILL_LENGTH,
} from '../harness/assertions.js';

const MODULE = ['/src/components/ui-rating-control.js'];

const STAGE = 260;

const MARKUP = `
    <style>
      #stage { display: grid; gap: 24px; inline-size: ${STAGE}px; justify-items: stretch; }
    </style>
    <div id="stage">
      <ui-rating-control id="rating" shot-id="shot-1" score="73" handoff></ui-rating-control>
      <ui-rating-control id="plain" shot-id="shot-1" score="73"></ui-rating-control>
      <ui-rating-control id="unrated" shot-id="shot-1"></ui-rating-control>
      <ui-rating-control id="nothing" handoff></ui-rating-control>
    </div>`;

const RATING = '#rating';
/** The score, at rest: this component's own two spans, not a stat tile. */
const RATE = '#rating >>> #rate';
const RATE_BTN = '#rating >>> #rate >>> #btn';
const RATE_CAP = '#rating >>> #rate .cap';
const RATE_NUM = '#rating >>> #rate .num';
const NOTES = '#rating >>> #notes';
const NOTES_BTN = '#rating >>> #notes >>> #btn';
/** The sheet, and what is inside it. Present only while `open`. */
const SHEET = '#rating >>> #sheet';
const SHEET_SCORE = '#rating >>> #sheet-score';
const SHEET_A11Y = '#rating >>> #sheet-score >>> #a11y';
const SLIDER = '#rating >>> #slider';
const TRACK = '#rating >>> #slider >>> #track';
const HANDOFF = '#rating >>> #handoff';
const HANDOFF_BTN = '#rating >>> #handoff >>> #btn';

/** The three rows the column paints at rest, in order. */
const COLUMN = ['rate', 'notes', 'handoff'];

/** Rendered lengths at dsf 1.5 are not string-comparable; whole CSS px are. */
const near = (got, want, what, tol = 0.51) => assert.ok(
    Math.abs(got - want) <= tol,
    `${what}: expected ${want}, got ${got}`,
);

/**
 * Every box this component owns, in one round trip — the host and its rows.
 * `rows` is in DOM order, which is the order the column paints.
 */
const zone = (page, host = '#rating') => page.evalFn((sel) => {
    const el = window.__h.need(sel);
    const cs = getComputedStyle(el);
    const rects = [...el.shadowRoot.children]
        .filter((n) => n.nodeType === 1)
        .map((n) => {
            const r = n.getBoundingClientRect();
            return { id: n.id, top: r.top, bottom: r.bottom, height: r.height, width: r.width };
        });
    const r = el.getBoundingClientRect();
    return {
        host: { top: r.top, bottom: r.bottom, height: r.height, width: r.width },
        rows: rects,
        gap: parseFloat(cs.rowGap || '0'),
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
        overflowY: cs.overflowY,
        minBlockSize: cs.minHeight,
        blockSize: cs.height,
    };
}, host);

const openSheet = async (page, host = '#rating') => {
    await page.click(`${host} >>> #rate >>> #btn`);
    await page.settle(3);
    assert.equal(await page.exists(`${host} >>> #slider`), true,
        'the score button must open the sheet the slider lives in');
};

const closeSheet = async (page, host = '#rating') => {
    await page.click(`${host} >>> #sheet-done >>> #btn`);
    await page.settle(3);
    assert.equal(await page.exists(`${host} >>> #slider`), false, 'Done must shut the sheet');
};

/** The text a node shows, trimmed. */
const textOf = (page, selector) => page.evalFn(
    (s) => window.__h.need(s).textContent.trim(), selector,
);

/** Set the inner range input's value and let it out through ui-slider, like a drag. */
const drag = async (page, value) => {
    await page.evalFn((sel, v) => {
        const el = window.__h.need(sel);
        el.value = String(v);
        return true;
    }, TRACK, value);
    await page.dispatch(TRACK, 'input');
};

const commit = async (page, value) => {
    await page.evalFn((sel, v) => {
        const el = window.__h.need(sel);
        el.value = String(v);
        return true;
    }, TRACK, value);
    await page.dispatch(TRACK, 'change', { composed: false });
};

let browser;

before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`ui-rating-control @ ${geometry.name} (${geometry.width}x${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

        const mounted = (fn, markup = MARKUP) => browser.withPage({ geometry }, async (page) => {
            await page.mount(markup, MODULE);
            assert.deepEqual(page.pageErrors, [], 'the component must mount without throwing');
            return fn(page);
        });

        test('the emulated geometry is the one the suite asked for', () => mounted(async (page) => {
            const env = JSON.parse(await page.eval(
                'JSON.stringify({dpr: devicePixelRatio, w: innerWidth, h: innerHeight})',
            ));
            assert.equal(env.dpr, geometry.deviceScaleFactor);
            assert.equal(env.w, geometry.width);
        }));

        test('the compound composes #33, #23, #1 and #29, and re-implements none of them',
            () => mounted(async (page) => {
                const parts = await page.evalFn(() => {
                    const el = document.getElementById('rating');
                    return [...el.shadowRoot.children]
                        .map((n) => `${n.tagName.toLowerCase()}#${n.id}`);
                });
                assert.deepEqual(parts, ['ui-button#rate', 'ui-button#notes', 'ui-button#handoff'],
                    'the resting column is the score, the notes and the handoff, in that order');

                await openSheet(page);
                const sheet = await page.evalFn(() => {
                    const el = document.getElementById('rating');
                    const dialog = el.shadowRoot.querySelector('#sheet');
                    return {
                        tag: dialog.tagName.toLowerCase(),
                        body: [...el.shadowRoot.querySelector('#sheet-body').children]
                            .map((n) => `${n.tagName.toLowerCase()}#${n.id}`),
                    };
                });
                assert.equal(sheet.tag, 'ui-dialog', 'the sheet is #29, not a private overlay');
                assert.deepEqual(sheet.body, ['ui-stat-tile#sheet-score', 'ui-slider#slider'],
                    'the sheet is the tile and the slider — the two controls the column used to hold');

                /* No second slider, no hand-rolled thumb, no private button: the row's
                 * whole claim is that #23, #1 and #29 are what is on screen. */
                assert.equal(await page.count('#rating >>> input'), 0,
                    'a raw <input> in this shadow root is a fourth thumb spec (bug T22)');
                assert.equal(await page.count('#rating >>> button'), 0,
                    'a raw <button> here is a second button implementation');
            }));

        test('L4 §2.1: with the handoff present the box IS its contents, and nothing overflows',
            () => mounted(async (page) => {
                const z = await zone(page);
                assert.equal(z.rows.length, 3, 'the handoff must be on the stage for this test');

                const sum = z.rows.reduce((n, row) => n + row.height, 0) + 2 * z.gap;
                near(z.host.height, sum,
                    'the box must be exactly the sum of its rows and gaps (L4 is the case where it is 11px less)');

                const last = z.rows[z.rows.length - 1];
                assert.ok(last.bottom <= z.host.bottom + 0.5,
                    `the handoff escapes the bottom of its zone by ${(last.bottom - z.host.bottom).toFixed(2)}px — that IS L4`);

                assert.ok(z.scrollHeight <= z.clientHeight + 0.5,
                    `the zone clips its own content: scrollHeight ${z.scrollHeight} against clientHeight ${z.clientHeight}`);
                assert.equal(z.overflowY, 'visible',
                    'this zone hides nothing — hidden is the old app\'s default answer everywhere but the numpad');
            }));

        test('L4 §2.2: the fourth child GROWS the box, by its own height plus one gap',
            () => mounted(async (page) => {
                const withHandoff = await zone(page, '#rating');
                const without = await zone(page, '#plain');

                assert.equal(without.rows.length, 2, '#plain must be the three-child column minus the handoff');
                const button = withHandoff.rows[2];

                near(withHandoff.host.height - without.host.height, button.height + withHandoff.gap,
                    'the handoff must add its own height and one gap — a hand-derived container adds nothing and overflows instead');
            }));

        test('L4 §2.3: a screen states Slate\'s own 165px and the box is STILL its contents',
            () => mounted(async (page) => {
                const free = await zone(page);
                await page.setStyle(RATING, { 'block-size': '165px' });
                await page.settle(2);
                const stated = await zone(page);
                await page.setStyle(RATING, { 'block-size': null });

                assert.ok(free.host.height > 165,
                    `the fixture must actually exercise the case: the free column is ${free.host.height}px, not taller than Slate's 165`);
                near(stated.host.height, free.host.height,
                    'a stated 165px must not shorten the box — that is the whole of L4');

                const last = stated.rows[stated.rows.length - 1];
                assert.ok(last.bottom <= stated.host.bottom + 0.5,
                    `under a stated height the handoff escapes by ${(last.bottom - stated.host.bottom).toFixed(2)}px`);
                assert.ok(stated.scrollHeight <= stated.clientHeight + 0.5,
                    'under a stated height the zone clips its own content instead');
                assert.equal(stated.minBlockSize, 'max-content',
                    'the floor is the declaration doing the work; a px here would be the hand-derived number returning');
            }));

        test('L4 §2.4: the box is not a number — drill --ui-control-h and the host follows the handoff',
            () => mounted(async (page) => {
                const before = await zone(page);
                const control = parseFloat(await page.resolveValue('var(--ui-control-h)', 'width'));

                await page.setToken('--ui-control-h', '120px');
                await page.settle(2);
                const drilled = await zone(page);

                await page.setToken('--ui-control-h', null);
                await page.settle(2);
                const restored = await zone(page);

                for (const row of drilled.rows) {
                    near(row.height, 120, `row #${row.id} must take the drilled control height`);
                }
                near(drilled.host.height - before.host.height, drilled.rows.length * (120 - control),
                    'the host must grow by exactly what its rows grew by');
                near(restored.host.height, before.host.height,
                    'the host must come back — a value that moves and returns was READ from the token');
            }));

        test('L4 §2.5: no row surrenders — a short container floors rather than squashing',
            () => mounted(async (page) => {
                const control = parseFloat(await page.resolveValue('var(--ui-control-h)', 'width'));

                await page.setStyle(RATING, { 'block-size': '80px' });
                await page.settle(2);
                const z = await zone(page);
                await page.setStyle(RATING, { 'block-size': null });

                /* 80px is shorter than ONE row plus a gap, let alone three. Every row is
                 * a control a wet finger has to hit, so every row holds. */
                for (const row of z.rows) {
                    assert.ok(row.height >= control - 0.5,
                        `row #${row.id} squashed to ${row.height}px, below --ui-control-h ${control}px`);
                }
                assert.ok(z.rows[z.rows.length - 1].bottom <= z.host.bottom + 0.5,
                    'the floors held but the box did not follow them');
            }));

        test('the column gap is --ui-space-3, drilled', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-space-3',
                value: DRILL_LENGTH,
                selector: RATING,
                property: 'row-gap',
            });
        }));

        test('an unrated score is --ui-muted and a rated one is not — drilled', () => mounted(async (page) => {
            assert.notEqual(
                await page.prop(RATE_NUM, 'color'),
                await page.prop('#unrated >>> #rate .num', 'color'),
                'a rated score and an unrated one must not read as the same number',
            );
            assert.equal(await page.prop('#unrated >>> #rate .num', 'color'),
                await page.resolveToken('--ui-muted'));
            assert.equal(await page.prop(RATE_NUM, 'color'),
                await page.resolveToken('--ui-text'));

            /* AND THE DASH IS THE DASH, not a zero. an absence is an absence. */
            assert.equal(await textOf(page, '#unrated >>> #rate .num'), '—',
                'a shot nobody has rated shows the em dash, never 0');

            await assertTokenDrill(page, {
                token: '--ui-muted',
                value: DRILL_COLOUR,
                selector: '#unrated >>> #rate .num',
                property: 'color',
            });
        }));

        test('the disabled dim is ONE dial and does not compound', () => mounted(async (page) => {
            const dim = parseFloat(await page.resolveValue('var(--ui-opacity-disabled)', 'opacity'));
            await page.setStyle(RATING, {});
            await page.evalFn(() => { document.getElementById('rating').disabled = true; return true; });
            await page.settle(2);

            near(parseFloat(await page.prop(RATING, 'opacity')), dim,
                'the host takes the one disabled dial');
            for (const [name, sel] of [['the score', RATE], ['the notes', NOTES], ['the handoff', HANDOFF]]) {
                near(parseFloat(await page.prop(sel, 'opacity')), 1,
                    `${name} must not dim a second time inside a dimmed host`);
            }
        }));

        test('no selection treatment exists here: a rating is a value, not a selected state',
            () => mounted(async (page) => {
                const states = await page.evalFn(() => {
                    const out = [];
                    const walk = (root) => {
                        for (const el of root.querySelectorAll('*')) {
                            for (const attr of ['aria-pressed', 'aria-selected', 'aria-checked', 'aria-current']) {
                                if (el.hasAttribute(attr)) out.push(`${el.tagName.toLowerCase()}[${attr}]`);
                            }
                            if (el.classList.contains('is-selected')) out.push(`${el.tagName.toLowerCase()}.is-selected`);
                            if (el.shadowRoot) walk(el.shadowRoot);
                        }
                    };
                    walk(document.getElementById('rating').shadowRoot);
                    return out;
                });
                assert.deepEqual(states, [],
                    'a selection state appeared in a component that has no selection — it must go through #3 or its dials');

                const READ = [RATE_NUM, RATE_BTN, NOTES_BTN, HANDOFF_BTN];
                const props = ['background-color', 'color', 'box-shadow', 'text-shadow'];
                const before = {};
                for (const sel of READ) before[sel] = await page.computed(sel, props);

                for (const [name, value] of [
                    ['--ui-selected-face', DRILL_COLOUR],
                    ['--ui-selected-ink', DRILL_COLOUR],
                    ['--ui-selected-led', DRILL_LENGTH],
                    ['--ui-selected-glow', '80%'],
                ]) await page.setToken(name, value);
                await page.settle(2);

                for (const sel of READ) {
                    assert.deepEqual(await page.computed(sel, props), before[sel],
                        `${sel} moved when the selection dials moved — this component has no selected state to paint`);
                }

                for (const name of ['--ui-selected-face', '--ui-selected-ink', '--ui-selected-led', '--ui-selected-glow']) {
                    await page.setToken(name, null);
                }
            }));

        test('the focus ring is the one ring and nothing clips it (bug L24)', () => mounted(async (page) => {
            /* THE SCORE IS A BUTTON NOW, so it is the first thing a keyboard reaches in
             * this zone and it has to take the ring like any other. */
            await assertFocusUnclipped(page, RATE_BTN);
            await assertFocusUnclipped(page, NOTES_BTN);
            await openSheet(page);
            await assertFocusUnclipped(page, TRACK);
        }));

        test('the handoff takes the same one ring, unclipped', () => mounted(async (page) => {
            await assertFocusUnclipped(page, HANDOFF_BTN);
        }));

        test('every control in the zone reaches the hit floor', () => mounted(async (page) => {
            await assertHitFloor(page, RATE_BTN, { mode: 'box', axes: ['block'] });
            await assertHitFloor(page, NOTES_BTN, { mode: 'box', axes: ['block'] });
            await assertHitFloor(page, HANDOFF_BTN, { mode: 'box', axes: ['block'] });
            await openSheet(page);
            await assertHitFloor(page, TRACK, { mode: 'box', axes: ['block'] });
        }));

        test('container floor: at Slate\'s own 172px zone the ergonomics hold and the TYPE absorbs it',
            () => mounted(async (page) => {
                const wide = parseFloat(await page.prop(RATE_NUM, 'font-size'));

                await page.setStyle('#stage', { 'inline-size': '172px' });
                await page.settle(2);

                const control = parseFloat(await page.resolveValue('var(--ui-control-h)', 'width'));
                const z = await zone(page);

                near(z.host.width, 172, 'the zone must be the container\'s width, not the viewport\'s');
                for (const row of z.rows) {
                    assert.ok(row.height >= control - 0.5,
                        `row #${row.id} lost its control height at the container floor`);
                }
                assert.ok(z.scrollHeight <= z.clientHeight + 0.5, 'the zone clips at its own floor');

                const narrow = parseFloat(await page.prop(RATE_NUM, 'font-size'));
                assert.equal(narrow, wide,
                    `the digits must hold their size in the narrow container: ${narrow}px against ${wide}px`);
                near(narrow, 27, 'the score is Slate\'s --slate-display-xs 27px in a 172px zone too');

                const cap = await page.evalFn(() => {
                    const el = document.getElementById('rating').shadowRoot;
                    const node = el.querySelector('#rate .cap');
                    const box = el.querySelector('#rate').shadowRoot.querySelector('#btn');
                    const at = (size) => {
                        node.style.fontSize = `var(${size})`;
                        const w = node.scrollWidth;
                        node.style.fontSize = '';
                        return w;
                    };
                    const pad = getComputedStyle(box);
                    return {
                        xs: at('--ui-text-xs'),
                        sm: at('--ui-text-sm'),
                        content: box.clientWidth
                            - parseFloat(pad.paddingLeft) - parseFloat(pad.paddingRight),
                    };
                });
                near(cap.content, 122, 'ui-button\'s 24px-a-side padding in a 172px zone');
                assert.ok(cap.xs <= cap.content,
                    `the cap is ${cap.xs}px of ink in a ${cap.content}px box — it does not fit`);
                assert.ok(cap.sm > cap.content,
                    `the microcap step fits after all (${cap.sm}px in ${cap.content}px), so the step down is unjustified`);

                /* And the rows still fit inside their own box at the floor. */
                assert.ok(z.rows[z.rows.length - 1].bottom <= z.host.bottom + 0.5,
                    'a row escapes the zone at the container floor');
            }));

        test('the same stated container gives the same numbers whatever the viewport',
            () => mounted(async (page) => {
                const z = await zone(page);
                near(z.host.width, STAGE, 'host width from a 260px stage');
                near(z.gap, 12, 'the gap from a 260px stage');
                near(z.host.height, 216, 'the column from a 260px stage: three 64px rows and two 12px gaps');
                assert.deepEqual(z.rows.map((r) => r.id), COLUMN, 'and the same three rows');
            }));

        test('the slider is named and announces a VALUE, never a bare percentage',
            () => mounted(async (page) => {
                await openSheet(page);
                const ratedText = await page.evalFn(() => document.getElementById('rating')
                    .shadowRoot.querySelector('#slider').shadowRoot
                    .querySelector('#track').getAttribute('aria-valuetext'));
                await closeSheet(page);
                await openSheet(page, '#unrated');
                const named = await page.evalFn((rated) => {
                    const track = (id) => document.getElementById(id).shadowRoot
                        .querySelector('ui-slider').shadowRoot.querySelector('#track');
                    return {
                        ratedName: track('unrated').getAttribute('aria-label'),
                        ratedText: rated,
                        unratedText: track('unrated').getAttribute('aria-valuetext'),
                    };
                }, ratedText);
                assert.match(named.ratedName, /0/, 'the name must state the scale it is on');
                assert.match(named.ratedName, /100/);
                assert.ok(named.ratedName && named.ratedName.length > 0,
                    'a control with no visible label of its own MUST carry an accessible name');
                assert.match(named.ratedText, /73/, 'the announced value must be the score');
                assert.doesNotMatch(named.unratedText, /^0$|\b0 of\b/,
                    'an unrated control announced a zero');
                assert.ok(named.unratedText.length > 0, 'an unrated control announced nothing at all');
            }));

        test('an absent score announces a SENTENCE and hides the dash', () => mounted(async (page) => {
            /* ui-stat-tile owns this; the assertion is here because #46 is the row that
             * decides an unrated shot is an ABSENCE rather than a zero (
             * reading.js:12-15). */
            /* TWO PLACES SHOW THE ABSENCE NOW, and both have to be honest about it: the
             * dash on the resting button, and the tile inside the sheet. */
            assert.equal(await textOf(page, '#unrated >>> #rate .num'), '—',
                'the resting score shows the dash, not a zero');

            await openSheet(page, '#unrated');
            assert.equal(await page.exists('#unrated >>> #sheet-score >>> #a11y'), true,
                'the absent reading must expose a sentence beside the glyph');
            const hidden = await page.evalFn(() => document.getElementById('unrated').shadowRoot
                .querySelector('#sheet-score').shadowRoot.querySelector('#reading')
                .getAttribute('aria-hidden'));
            assert.equal(hidden, 'true', 'the em dash is a glyph standing for a sentence and must not be read out');
        }));

        test('the host takes no role and keeps no aria-label (bug L23\'s first symptom)',
            () => mounted(async (page) => {
                const host = await page.evalFn(() => {
                    const el = document.getElementById('rating');
                    return { role: el.getAttribute('role'), label: el.getAttribute('aria-label') };
                });
                assert.equal(host.role, null, 'a role-less zone must not grow one');
                assert.equal(host.label, null, 'aria-label on a role-less element is announced anonymously');
            }));

        test('an aria-label written by a screen is MOVED onto the rate button, not copied',
            () => mounted(async (page) => {
                const after = await page.evalFn(() => {
                    const el = document.getElementById('named');
                    return {
                        onHost: el.getAttribute('aria-label'),
                        onButton: el.shadowRoot.querySelector('#rate').shadowRoot
                            .querySelector('#btn').getAttribute('aria-label'),
                    };
                });
                assert.equal(after.onHost, null, 'the name must not stay on the role-less host');
                assert.equal(after.onButton, 'Rate the last shot',
                    'the name must land on the element that answers to it, while the sheet is shut');

                /* AND THE SLIDER KEEPS ITS OWN. Inside a sheet headed with the cap, the
                 * zone's name would be the heading again with the range dropped. */
                await openSheet(page, '#named');
                const slider = await page.evalFn(() => document.getElementById('named').shadowRoot
                    .querySelector('#slider').shadowRoot.querySelector('#track').getAttribute('aria-label'));
                assert.notEqual(slider, 'Rate the last shot');
                assert.match(slider, /100/, 'the slider names its own range');
            },
            `<div id="stage" style="inline-size: ${STAGE}px">
               <ui-rating-control id="named" aria-label="Rate the last shot"
                   shot-id="shot-1" score="73" handoff></ui-rating-control>
             </div>`));

        test('the handoff is a real button with its own words', () => mounted(async (page) => {
            const btn = await page.evalFn(() => {
                const el = document.getElementById('rating').shadowRoot
                    .querySelector('ui-button').shadowRoot.querySelector('#btn');
                return { tag: el.tagName.toLowerCase(), text: el.textContent.trim(), type: el.getAttribute('type') };
            });
            assert.equal(btn.tag, 'button', 'the handoff must be in the tab order and take the ring');
            assert.equal(btn.type, 'button');
            const slotted = await page.evalFn(() => document.getElementById('rating').shadowRoot
                .querySelector('ui-button').textContent.trim());
            assert.ok(slotted.length > 0, 'the handoff must be announced with words, not a bare glyph');
        }));

        test('the cap over the score is the microcap role, uppercase', () => mounted(async (page) => {
            const cap = await page.computed(RATE_CAP, ['text-transform', 'font-size', 'color', 'letter-spacing']);
            assert.equal(cap['text-transform'], 'uppercase');
            assert.equal(cap.color, await page.resolveToken('--ui-muted'));
            near(parseFloat(cap['letter-spacing']) / parseFloat(cap['font-size']), 0.12,
                'the cap tracking is the role\'s .12em, whatever size it is set at', 0.005);

            assert.equal(cap['font-size'], await page.resolveValue('var(--ui-text-xs)', 'font-size'));
        }));

        test('a drag moves the number locally and publishes NOTHING — the preview is the control\'s own',
            () => mounted(async (page) => {
                await openSheet(page);
                await page.recordEvents(RATING, ['rating-input', 'rating-change']);
                await drag(page, 40);
                await page.settle(2);

                const events = await page.recordedEvents();
                assert.equal(events.filter((e) => e.type === 'rating-change').length, 0,
                    'a drag must not publish a commit — that is what needed the 400ms debounce timer');
                assert.deepEqual(events, [],
                    'a drag must publish nothing at all: a per-pixel announcement no screen '
                    + 'hears is a wire that only looks live (F-011)');

                const shown = await page.evalFn(() => {
                    const el = document.getElementById('rating').shadowRoot;
                    return {
                        tile: el.querySelector('#sheet-score').value,
                        button: el.querySelector('#rate .num').textContent.trim(),
                    };
                });
                assert.equal(shown.tile, '40', 'the number above the thumb must follow it');
                assert.equal(shown.button, '40', 'and so must the score on the button that opened the sheet');
            }));

        test('a commit publishes rating-change ONCE, with the shot it was rated against',
            () => mounted(async (page) => {
                await openSheet(page);
                await page.recordEvents(RATING, ['rating-change']);
                await commit(page, 88);
                await page.settle(2);

                const events = await page.recordedEvents();
                assert.equal(events.length, 1,
                    'one gesture, one commit — no timer, one write in flight, latest-wins');
                assert.deepEqual(events[0].detail, { score: 88, shotId: 'shot-1' });
            }));

        test('changing the shot drops the draft — the stale-id guard, as structure',
            () => mounted(async (page) => {
                await openSheet(page);
                await drag(page, 12);
                await page.settle(2);
                assert.equal(await page.evalFn(() => document.getElementById('rating').shadowRoot
                    .querySelector('#sheet-score').value), '12');

                await page.evalFn(() => {
                    const el = document.getElementById('rating');
                    el.shotId = 'shot-2';
                    el.score = null;
                    return true;
                });
                await page.settle(3);

                const shown = await page.evalFn(() => {
                    const el = document.getElementById('rating').shadowRoot;
                    return {
                        tile: el.querySelector('#sheet-score').value,
                        button: el.querySelector('#rate .num').textContent.trim(),
                    };
                });
                assert.equal(shown.tile, null, 'the previous shot\'s draft painted on the next shot');
                assert.equal(shown.button, '—', 'and it painted on the button behind the sheet too');
            }));

        test('a served correction wins over the thumb', () => mounted(async (page) => {
            await openSheet(page);
            await drag(page, 5);
            await page.settle(2);
            await page.evalFn(() => { document.getElementById('rating').score = 61; return true; });
            await page.settle(3);
            assert.equal(await page.evalFn(() => document.getElementById('rating').shadowRoot
                .querySelector('#sheet-score').value), '61',
                'a screen that corrects a rejected write must be able to');
        }));

        test('with nothing to rate the controls refuse, and publish nothing',
            () => mounted(async (page) => {
                const state = await page.evalFn(() => {
                    const el = document.getElementById('nothing');
                    const inner = (id) => el.shadowRoot.querySelector(`#${id}`)
                        .shadowRoot.querySelector('#btn').disabled;
                    return {
                        rate: inner('rate'), notes: inner('notes'), handoff: inner('handoff'),
                    };
                });
                assert.equal(state.rate, true, 'the score button must refuse when there is no shot');
                assert.equal(state.notes, true, 'the notes button must refuse when there is no shot');
                assert.equal(state.handoff, true, 'the handoff must refuse when there is no shot');

                await page.recordEvents('#nothing',
                    ['rating-input', 'rating-change', 'dye-handoff', 'notes-open']);
                for (const id of ['rate', 'notes', 'handoff']) {
                    await page.click(`#nothing >>> #${id} >>> #btn`).catch(() => {});
                }
                await page.settle(2);

                /* AND THE SHEET DOES NOT OPEN, so there is no slider to drag either. */
                assert.equal(await page.exists('#nothing >>> #slider'), false,
                    'a press on a refusing score button must not open the sheet');
                assert.deepEqual(await page.recordedEvents(), [],
                    'a control with nothing to rate must not publish anything');
            }));

        test('the handoff publishes an intent with a shot id, and reaches for no global',
            () => mounted(async (page) => {
                const globals = await page.evalFn(() => Object.keys(window)
                    .filter((k) => /dye/i.test(k)));
                assert.deepEqual(globals, [],
                    'the component must not install or expect a window.openDye2ForShot');

                await page.recordEvents(RATING, ['dye-handoff']);
                await page.click(HANDOFF_BTN);
                await page.settle(2);
                const events = await page.recordedEvents();
                assert.equal(events.length, 1, 'a real hit-tested click must reach the handoff');
                assert.deepEqual(events[0].detail, { shotId: 'shot-1' });
            }));

        test('the handoff is absent, not hidden, on a machine without the plugin',
            () => mounted(async (page) => {
                assert.equal(await page.count('#plain >>> #handoff'), 0,
                    'a machine without the handoff must have no handoff row at all');
                assert.equal(await page.count('#rating >>> #handoff'), 1);
                /* The rest of the column is unchanged either way — the score and the
                 * notes are not a capability. */
                assert.equal(await page.count('#plain >>> ui-button'), 2);
                assert.equal(await page.count('#rating >>> ui-button'), 3);
            }));

        test('every gallery state mounts and renders the column', () => mounted(async (page) => {
            assert.equal(galleryEntry.id, 'ui-rating-control');
            for (const state of galleryEntry.states) {
                await page.mount(`<div id="stage">${state.html}</div>`, MODULE);
                assert.deepEqual(page.pageErrors, [], `gallery state ${state.id} threw on mount`);
                const shape = await page.evalFn(() => [...document.querySelectorAll('ui-rating-control')]
                    .map((el) => [...el.shadowRoot.children].map((n) => n.id)));
                assert.ok(shape.length > 0, `gallery state ${state.id} renders no control`);
                for (const rows of shape) {
                    assert.equal(rows[0], 'rate', `gallery state ${state.id}: no score button`);
                    assert.equal(rows[1], 'notes', `gallery state ${state.id}: no notes button`);
                }
            }
        }));

        test('the stated-height gallery state photographs the FIX, never the bug',
            () => mounted(async (page) => {
                const state = galleryEntry.states.find((s) => s.id === 'stated-height');
                assert.ok(state, 'the L4 capture state must exist');
                await page.mount(
                    `<style>#stage { inline-size: ${STAGE}px; }</style><div id="stage">${state.html}</div>`,
                    MODULE,
                );
                const z = await page.evalFn(() => {
                    const el = document.querySelector('ui-rating-control');
                    const r = el.getBoundingClientRect();
                    const rows = [...el.shadowRoot.children]
                        .filter((n) => n.getBoundingClientRect().height > 0)
                        .map((n) => n.getBoundingClientRect().bottom);
                    return { bottom: r.bottom, height: r.height, last: Math.max(...rows) };
                });
                assert.ok(z.height > 165,
                    `the capture must show the box growing past the stated 165px, got ${z.height}`);
                assert.ok(z.last <= z.bottom + 0.5,
                    'the capture shows the handoff clipped — L4 is back');
            }));
    });
}
