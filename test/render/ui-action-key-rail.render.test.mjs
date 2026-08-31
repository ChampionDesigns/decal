/**
 *.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';
import { entry as galleryEntry } from '../../tools/gallery/entries/ui-action-key-rail.entry.js';
import {
    assertTokenDrill,
    assertFocusUnclipped,
    assertHitFloor,
    DRILL_COLOUR,
    DRILL_LENGTH,
} from '../harness/assertions.js';

const MODULE = ['/src/components/ui-action-key-rail.js'];

const ACTIONS = ['move-left', 'delete', 'insert-after', 'duplicate', 'move-right'];

const NAMES = {
    'move-left': 'Move step left',
    delete: 'Delete step',
    'insert-after': 'Insert step after',
    duplicate: 'Duplicate step',
    'move-right': 'Move step right',
};

/* A four-step profile sitting on step 2 (0-based 1): every key live, which is the
 * state most assertions want. The edge cases get their own mounts. */
const MID = '<ui-action-key-rail id="rail" index="1" count="4"></ui-action-key-rail>';
const FIRST = '<ui-action-key-rail id="rail" index="0" count="4"></ui-action-key-rail>';
const LAST = '<ui-action-key-rail id="rail" index="3" count="4"></ui-action-key-rail>';
const ONLY = '<ui-action-key-rail id="rail" index="0" count="1"></ui-action-key-rail>';
const OFF = '<ui-action-key-rail id="rail" index="1" count="4" disabled></ui-action-key-rail>';

const key = (action) => `#rail >>> #key-${action}`;
const control = (action) => `${key(action)} >>> .btn`;
const glyph = (action) => `#rail >>> #key-${action} .glyph`;
const cell = (action) => `#rail >>> #key-${action}`;

/** Rendered lengths at dsf 1.5 are not string-comparable; whole CSS px are. */
const near = (got, want, what, tol = 0.51) => assert.ok(
    Math.abs(got - want) <= tol,
    `${what}: expected ${want}, got ${got}`,
);

/** The cell that paints a key's face is the key's parent — the .seam-cell wrapper. */
async function faceColour(page, action) {
    return page.evalFn((a) => {
        const el = document.getElementById('rail').shadowRoot.getElementById(`key-${a}`);
        return getComputedStyle(el.parentElement).backgroundColor;
    }, action);
}

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`ui-action-key-rail @ ${geometry.name} (${geometry.width}x${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

        const mounted = (fn, markup = MID, opts = {}) => browser.withPage(
            { geometry, ...opts },
            async (page) => {
                await page.mount(markup, MODULE);
                assert.deepEqual(page.pageErrors, [], 'the component must mount without throwing');
                return fn(page);
            },
        );

        test('the emulated geometry is the one the suite asked for', () => mounted(async (page) => {
            const env = JSON.parse(await page.eval(
                'JSON.stringify({dpr: devicePixelRatio, w: innerWidth, h: innerHeight})',
            ));
            assert.deepEqual(env, {
                dpr: geometry.deviceScaleFactor,
                w: geometry.width,
                h: geometry.height,
            });
        }));

        test('C7: five keys, in Slate\'s footer order, and every one is a #1 ui-button',
            () => mounted(async (page) => {
                const found = await page.evalFn(() => {
                    const root = document.getElementById('rail').shadowRoot;
                    const keys = [...root.querySelectorAll('.rail > .cell > *')];
                    return {
                        count: keys.length,
                        tags: keys.map((k) => k.tagName.toLowerCase()),
                        actions: keys.map((k) => k.dataset.action),
                        variants: keys.map((k) => k.getAttribute('variant')),
                        /* Every key's real control is #1's own <button>, in #1's
                         * shadow root — not a <button> this component authored. */
                        controls: keys.map((k) => k.shadowRoot?.querySelector('button')?.tagName ?? null),
                        railOwnsNoButton: root.querySelector('button') === null,
                    };
                });
                assert.equal(found.count, 5, 'C7: the five footer buttons ');
                assert.deepEqual(found.tags, Array(5).fill('ui-button'),
                    'the press control is #1, composed, never re-implemented');
                assert.deepEqual(found.actions, ACTIONS);
                assert.deepEqual(found.variants, Array(5).fill('ghost'),
                    'ghost is the variant whose border and face are transparent, so the '
                    + 'key contributes no second border inside a seam grid (L9\'s shape)');
                assert.deepEqual(found.controls, Array(5).fill('BUTTON'));
                assert.equal(found.railOwnsNoButton, true,
                    'a bare <button> in this shadow root would be a second press control');
            }));

        test('C7: no drag affordance of any kind (OQ-9 says do not add one)',
            () => mounted(async (page) => {
                const drag = await page.evalFn(() => {
                    const root = document.getElementById('rail').shadowRoot;
                    const all = [...root.querySelectorAll('*')];
                    return {
                        draggable: all.filter((el) => el.getAttribute?.('draggable') === 'true').length,
                        handles: all.filter((el) => /handle|drag|grip/i.test(el.className?.baseVal
                            ?? (typeof el.className === 'string' ? el.className : ''))).length,
                        cursors: [...new Set(all.map((el) => getComputedStyle(el).cursor))],
                    };
                });
                assert.equal(drag.draggable, 0);
                assert.equal(drag.handles, 0);
                for (const c of drag.cursors) {
                    assert.ok(!['grab', 'grabbing', 'move', 'all-scroll'].includes(c),
                        `a drag cursor (${c}) on a control that cannot be dragged is P10's `
                        + 'dead affordance, one screen over');
                }
            }));

        test('every key\'s control fills its key, on all five', () => mounted(async (page) => {
            for (const action of ACTIONS) {
                const k = await page.box(key(action));
                const c = await page.box(control(action));
                near(c.width, k.width, `${action}: control width vs key width`);
                near(c.height, k.height, `${action}: control height vs key height`);
                near(c.left, k.left, `${action}: control left vs key left`);
            }
        }));

        test('a STRETCHED key stretches its control — the dead-strip trap, measured',
            () => mounted(async (page) => {
                await page.setStyle('#rail >>> .rail', {
                    'inline-size': '900px',
                    'grid-auto-columns': 'minmax(var(--ui-control-h), 1fr)',
                });
                try {
                    for (const action of ACTIONS) {
                        const k = await page.box(key(action));
                        const c = await page.box(control(action));
                        assert.ok(k.width > 120, `${action}: the key really was stretched (${k.width})`);
                        near(c.width, k.width, `${action}: the control follows the key`);
                    }
                } finally {
                    await page.setStyle('#rail >>> .rail', {
                        'inline-size': null, 'grid-auto-columns': null,
                    });
                }
            }));

        test('the five keys are one rank — identical boxes, one seam apart',
            () => mounted(async (page) => {
                const seam = parseFloat(await page.resolveValue('var(--ui-seam)', 'width'));
                const boxes = [];
                for (const action of ACTIONS) boxes.push(await page.box(key(action)));

                for (const b of boxes) {
                    near(b.width, boxes[0].width, 'key width is uniform across the rank');
                    near(b.height, boxes[0].height, 'key height is uniform across the rank');
                    near(b.top, boxes[0].top, 'the rank is one row');
                }
                for (let i = 1; i < boxes.length; i += 1) {
                    near(boxes[i].left - boxes[i - 1].right, seam,
                        `the gap between key ${i - 1} and key ${i} is exactly one --ui-seam`);
                }
            }));

        test('the rail is its five keys plus four seams plus two border edges',
            () => mounted(async (page) => {
                const seam = parseFloat(await page.resolveValue('var(--ui-seam)', 'width'));
                const border = parseFloat(await page.prop('#rail >>> .rail', 'border-top-width'));
                const rail = await page.box('#rail >>> .rail');
                const keyBox = await page.box(key('delete'));
                near(rail.width, 5 * keyBox.width + 4 * seam + 2 * border, 'rail inline size');
                near(rail.height, keyBox.height + 2 * border, 'rail block size');
            }));

        test('the key clears --ui-hit-min on both axes with paint alone', () => mounted(async (page) => {
            for (const action of ACTIONS) {
                await assertHitFloor(page, control(action), { mode: 'paint' });
            }
        }));

        test('the rank TAKES the width it is given, and its keys divide it',
            () => mounted(async (page) => {
                const key = () => page.evalFn(() => {
                    const rail = document.getElementById('rail').shadowRoot.querySelector('.rail');
                    const cells = [...rail.children].map((c) => c.getBoundingClientRect().width);
                    return { rail: rail.getBoundingClientRect().width, cells };
                });

                for (const width of [350, 600, 1600]) {
                    await page.setStyle('#rail', { 'inline-size': `${width}px` });
                    await page.settle(2);
                    const got = await key();
                    near(got.rail, width, `the rank is its container at ${width}px`);
                    for (const cell of got.cells) {
                        near(cell, got.cells[0], 'and the keys are equal shares of it', 1);
                    }
                    const m = await page.metrics('#rail >>> .rail');
                    near(m.scrollWidth, m.clientWidth, `nothing cut inside the slab at ${width}px`, 1);
                }
                await page.setStyle('#rail', { 'inline-size': null });
            }));

        test('token drill: the seam ground is --ui-line (the oracle\'s .pe-action-cell)',
            () => mounted(async (page) => {
                await assertTokenDrill(page, {
                    token: '--ui-line',
                    value: DRILL_COLOUR,
                    selector: '#rail >>> .rail',
                    property: 'background-color',
                });
            }));

        test('token drill: the enclosure is --ui-line too — one ink, two jobs',
            () => mounted(async (page) => {
                await assertTokenDrill(page, {
                    token: '--ui-line',
                    value: DRILL_COLOUR,
                    selector: '#rail >>> .rail',
                    property: 'border-top-color',
                });
            }));

        test('token drill: the enclosure width is --ui-border-w', () => mounted(async (page) => {
            const drilled = await assertTokenDrill(page, {
                token: '--ui-border-w',
                value: DRILL_LENGTH,
                selector: '#rail >>> .rail',
                property: 'border-top-width',
                expectLanding: false,
            });
            near(parseFloat(drilled.after), parseFloat(DRILL_LENGTH),
                'the enclosure width lands on the drilled token');
        }));

        test('token drill: the seam width is --ui-seam', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-seam',
                value: DRILL_LENGTH,
                selector: '#rail >>> .rail',
                property: 'column-gap',
            });
        }));

        test('token drill: the slab corner is --ui-radius (oracle 6px)', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-radius',
                value: DRILL_LENGTH,
                selector: '#rail >>> .rail',
                property: 'border-top-left-radius',
            });
        }));

        test('token drill: the key face is --ui-fascia (the oracle\'s .pe-action-btn)',
            () => mounted(async (page) => {
                await assertTokenDrill(page, {
                    token: '--ui-fascia',
                    value: DRILL_COLOUR,
                    selector: '#rail >>> .cell',
                    property: 'background-color',
                });
            }));

        test('token drill: the neutral glyph is --ui-muted — E13\'s literal cannot express',
            () => mounted(async (page) => {
                await assertTokenDrill(page, {
                    token: '--ui-muted',
                    value: DRILL_COLOUR,
                    selector: glyph('duplicate'),
                    property: 'color',
                });
            }));

        test('token drill: the add key is --ui-steel', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-steel',
                value: DRILL_COLOUR,
                selector: glyph('insert-after'),
                property: 'color',
            });
        }));

        test('token drill: the delete key is --ui-status-danger, 72% of it', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-status-danger',
                value: DRILL_COLOUR,
                selector: glyph('delete'),
                property: 'color',
                expectLanding: false,
            });
        }));

        test('the delete key is Slate\'s arithmetic, not Slate\'s computed value',
            () => mounted(async (page) => {
                const want = await page.resolveValue(
                    'color-mix(in srgb, var(--ui-status-danger) 72%, var(--ui-muted))', 'color');
                assert.equal(await page.prop(glyph('delete'), 'color'), want);
                /* And it is genuinely a MIX, not one end of it. */
                assert.notEqual(want, await page.resolveValue('var(--ui-status-danger)', 'color'));
                assert.notEqual(want, await page.resolveValue('var(--ui-muted)', 'color'));
            }));

        test('token drill: the glyph box is --ui-icon (Slate\'s bare 23px is gone)',
            () => mounted(async (page) => {
                await assertTokenDrill(page, {
                    token: '--ui-icon',
                    value: DRILL_LENGTH,
                    selector: glyph('move-left'),
                    property: 'width',
                });
                assert.notEqual(await page.prop(glyph('move-left'), 'width'), '23px',
                    'E11\'s family: .pe-action-btn svg { width: 23px } was a bare literal');
            }));

        test('token drill: the rank\'s floor is --ui-control-h', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-control-h',
                value: DRILL_LENGTH,
                selector: '#rail >>> .rail',
                property: 'min-inline-size',
                expectLanding: false,
            });
        }));

        test('the edge keys are the two C7 disables, and only those', () => mounted(async (page) => {
            const state = await page.evalFn(() => {
                const root = document.getElementById('rail').shadowRoot;
                return [...root.querySelectorAll('ui-button')].map((b) => ({
                    action: b.dataset.action,
                    host: b.hasAttribute('disabled'),
                    native: !!b.shadowRoot.querySelector('button')?.disabled,
                }));
            });
            assert.deepEqual(state.map((s) => s.host), [false, false, false, false, false],
                'index 1 of 4: neither end, so nothing is disabled');
            assert.deepEqual(state.map((s) => s.native), [false, false, false, false, false]);
        }));

        test('first step: move-left is disabled, the other four are not', () => mounted(async (page) => {
            const state = await page.evalFn(() => {
                const root = document.getElementById('rail').shadowRoot;
                return Object.fromEntries([...root.querySelectorAll('ui-button')]
                    .map((b) => [b.dataset.action, !!b.shadowRoot.querySelector('button')?.disabled]));
            });
            assert.deepEqual(state, {
                'move-left': true,
                delete: false,
                'insert-after': false,
                duplicate: false,
                'move-right': false,
            });
        }, FIRST));

        test('last step: move-right is disabled, the other four are not', () => mounted(async (page) => {
            const state = await page.evalFn(() => {
                const root = document.getElementById('rail').shadowRoot;
                return Object.fromEntries([...root.querySelectorAll('ui-button')]
                    .map((b) => [b.dataset.action, !!b.shadowRoot.querySelector('button')?.disabled]));
            });
            assert.deepEqual(state, {
                'move-left': false,
                delete: false,
                'insert-after': false,
                duplicate: false,
                'move-right': true,
            });
        }, LAST));

        test('a one-step profile disables both arrows AND delete', () => mounted(async (page) => {
            const state = await page.evalFn(() => {
                const root = document.getElementById('rail').shadowRoot;
                return Object.fromEntries([...root.querySelectorAll('ui-button')]
                    .map((b) => [b.dataset.action, !!b.shadowRoot.querySelector('button')?.disabled]));
            });
            assert.deepEqual(state, {
                'move-left': true,
                delete: true,
                'insert-after': false,
                duplicate: false,
                'move-right': true,
            }, 'the only two live keys are the two that GROW the list');
        }, ONLY));

        test('at two steps, delete is live again on both of them', () => mounted(async (page) => {
            const state = await page.evalFn(() => {
                const rail = document.getElementById('rail');
                const read = () => Object.fromEntries(
                    [...rail.shadowRoot.querySelectorAll('ui-button')]
                        .map((b) => [b.dataset.action, !!b.shadowRoot.querySelector('button')?.disabled]),
                );
                rail.count = 2;
                rail.index = 0;
                return rail.updateComplete.then(() => {
                    const first = read();
                    rail.index = 1;
                    return rail.updateComplete.then(() => ({ first, second: read() }));
                });
            });
            assert.equal(state.first.delete, false, 'step 1 of 2');
            assert.equal(state.second.delete, false, 'step 2 of 2');
            assert.equal(state.first['move-left'], true, 'and the edge rule is untouched');
            assert.equal(state.second['move-right'], true);
        }, ONLY));

        test('DEPARTURE 4: a dimmed glyph on the SAME ground as its live siblings',
            () => mounted(async (page) => {
                const dimmedFace = await faceColour(page, 'move-left');
                const liveFace = await faceColour(page, 'delete');
                assert.equal(dimmedFace, liveFace,
                    'the face is painted by the seam cell UNDER the button, so the dial '
                    + 'cannot reach it — a faded face is what made Slate\'s two inert '
                    + 'arrows read as the skin\'s SELECTED treatment');
                assert.equal(dimmedFace, await page.resolveValue('var(--ui-fascia)', 'color'));
            }, FIRST));

        test('DEPARTURE 4: the dim is exactly --ui-opacity-disabled, applied once',
            () => mounted(async (page) => {
                const dial = await page.resolveValue('var(--ui-opacity-disabled)', 'opacity');
                assert.equal(await page.prop(key('move-left'), 'opacity'), dial);
                assert.equal(await page.prop(key('delete'), 'opacity'), '1');
                /* Applied ONCE: #1 neutralises the inner control so .38 x .38 = .14
                 * cannot happen (ui-button.js). Measured on the rendered control. */
                assert.equal(await page.prop(control('move-left'), 'opacity'), '1');
            }, FIRST));

        test('token drill: the dim is the dial, not a fourth value', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-opacity-disabled',
                value: '0.5',
                selector: key('move-left'),
                property: 'opacity',
                expected: '0.5',
            });
        }, FIRST));

        test('DEPARTURE 5: a disabled key refuses the press and leaves the tab order',
            () => mounted(async (page) => {
                await page.recordEvents('#rail', ['step-action']);
                await page.click(control('move-left'));
                await page.settle();
                assert.deepEqual(await page.recordedEvents(), [],
                    'the native disabled attribute refuses it — no pointer-events: none needed');
                const focusable = await page.evalFn(() => {
                    const root = document.getElementById('rail').shadowRoot;
                    return [...root.querySelectorAll('ui-button')]
                        .filter((b) => !b.shadowRoot.querySelector('button').disabled)
                        .map((b) => b.dataset.action);
                });
                assert.deepEqual(focusable, ['delete', 'insert-after', 'duplicate', 'move-right']);
            }, FIRST));

        test('the whole rail can be disabled, and then all five are', () => mounted(async (page) => {
            const dial = await page.resolveValue('var(--ui-opacity-disabled)', 'opacity');
            for (const action of ACTIONS) {
                assert.equal(await page.prop(key(action), 'opacity'), dial, action);
                assert.equal(await faceColour(page, action),
                    await page.resolveValue('var(--ui-fascia)', 'color'),
                    `${action}: still on the ground`);
            }
        }, OFF));

        test('selection cannot express: every spelling, on the host and on a key, moves nothing',
            () => mounted(async (page) => {
                const props = ['background-color', 'color', 'box-shadow', 'text-shadow',
                    'border-top-color', 'opacity'];
                const readAll = async () => ({
                    rail: await page.computed('#rail >>> .rail', props),
                    cell: await page.computed('#rail >>> .cell', props),
                    control: await page.computed(control('delete'), props),
                    glyph: await page.computed(glyph('delete'), props),
                });
                const before = await readAll();

                await page.evalFn(() => {
                    const rail = document.getElementById('rail');
                    const target = rail.shadowRoot.getElementById('key-delete');
                    for (const el of [rail, target]) {
                        el.setAttribute('aria-pressed', 'true');
                        el.setAttribute('aria-selected', 'true');
                        el.setAttribute('aria-checked', 'true');
                        el.setAttribute('aria-current', 'true');
                        el.classList.add('is-selected');
                    }
                });
                await page.settle();
                assert.deepEqual(await readAll(), before,
                    'CONVENTIONS §4: the four dials mean something only because there is '
                    + 'ONE selection component (#3). A key is pressed, not selected — and '
                    + 'Slate hit this from the other side, its inert arrows "looked filled, '
                    + 'which is the skin\'s selected treatment"');

                /* And the dials themselves are untouched by anything in this file. */
                for (const dial of ['--ui-selected-face', '--ui-selected-ink',
                    '--ui-selected-led', '--ui-selected-glow']) {
                    const root = await page.tokenValue(dial);
                    const here = await page.evalFn((d) => getComputedStyle(
                        document.getElementById('rail').shadowRoot.querySelector('.rail'),
                    ).getPropertyValue(d).trim(), dial);
                    assert.equal(here, String(root).trim(), `${dial} is inherited, not re-pointed`);
                }
            }));

        test('E1 cannot express: the slab clips for its radius and nothing overflows it',
            () => mounted(async (page) => {
                const m = await page.metrics('#rail >>> .rail');
                assert.equal(m.overflowX, 'hidden', 'the clip is deliberate — square keys, round slab');
                near(m.scrollWidth, m.clientWidth, 'nothing is cut horizontally');
                near(m.scrollHeight, m.clientHeight, 'nothing is cut vertically');
                /* The fifth key is inside the clip, not behind it — the rule's actual symptom
                 * was a row you could not see. */
                const rail = await page.box('#rail >>> .rail');
                const lastKey = await page.box(key('move-right'));
                assert.ok(lastKey.right <= rail.right + 0.5,
                    `the last key ends at ${lastKey.right}, the slab at ${rail.right}`);
            }));

        test('container floor: squeezed to 120px the rank holds and still does not clip',
            () => mounted(async (page) => {
                const floorValue = await page.prop('#rail >>> .rail', 'min-inline-size');
                const floor = parseFloat(floorValue);
                await page.setStyle('#rail', { 'inline-size': '120px' });
                try {
                    const rail = await page.box('#rail >>> .rail');
                    assert.ok(rail.width >= floor - 0.5,
                        `the rank shrank past its stated floor — ${rail.width} against ${floor}. `
                        + 'T9: a control holds its stated size and a row that runs out of '
                        + 'space gives up where a reader can see');
                    const m = await page.metrics('#rail >>> .rail');
                    near(m.scrollWidth, m.clientWidth, 'still nothing cut inside the slab');
                    for (const action of ACTIONS) {
                        await assertHitFloor(page, control(action), { mode: 'paint' });
                    }
                } finally {
                    await page.setStyle('#rail', { 'inline-size': null });
                }
            }));

        test('focus-unclipped: every key\'s ring survives the slab\'s overflow: hidden',
            () => mounted(async (page) => {
                for (const action of ACTIONS) {
                    await assertFocusUnclipped(page, control(action));
                }
            }));

        test('the ring is the INSET offset, which is why it survives', () => mounted(async (page) => {
            const inset = await page.resolveValue('var(--ui-focus-offset-inset)', 'outline-offset');
            await page.focusVisible(control('delete'));
            const g = await page.focusGeometry(control('delete'));
            assert.equal(g.outlineOffset, inset,
                'focus-ring="inset" on the host, because base.js declares '
                + '--_ui-focus-offset on :host and a value inherited from the rail '
                + 'would be overridden at each ui-button (base.js:436)');
        }));

        test('exactly one focus treatment: no second outline is authored anywhere',
            () => mounted(async (page) => {
                const width = await page.resolveValue('var(--ui-focus-w)', 'outline-width');
                const ink = await page.resolveValue('var(--ui-steel)', 'outline-color');
                for (const action of ACTIONS) {
                    await page.focusVisible(control(action));
                    const g = await page.focusGeometry(control(action));
                    assert.equal(g.outlineWidth, width, action);
                    assert.equal(g.outlineColor, ink, action);
                }
            }));

        test('a press fires step-action with the action, the index and the count',
            () => mounted(async (page) => {
                await page.recordEvents('#rail', ['step-action']);
                for (const action of ACTIONS) {
                    await page.click(control(action));
                    await page.settle();
                }
                const events = await page.recordedEvents();
                assert.deepEqual(
                    events.map((e) => e.detail),
                    ACTIONS.map((action) => ({ action, index: 1, count: 4 })),
                    'one event per press, in press order, carrying the step it came from',
                );
            }));

        test('step-action is composed, bubbling and cancelable', () => mounted(async (page) => {
            const shape = await page.evalFn(async () => {
                const rail = document.getElementById('rail');
                let seen = null;
                document.addEventListener('step-action', (e) => { seen = e; }, { once: true });
                rail.shadowRoot.getElementById('key-duplicate')
                    .shadowRoot.querySelector('button').click();
                await new Promise((r) => setTimeout(r, 0));
                return seen && {
                    composed: seen.composed,
                    bubbles: seen.bubbles,
                    cancelable: seen.cancelable,
                    /* Retargeted to the host: a screen never sees the inner button. */
                    target: seen.target.tagName.toLowerCase(),
                };
            });
            assert.deepEqual(shape, {
                composed: true, bubbles: true, cancelable: true, target: 'ui-action-key-rail',
            }, 'cancelable so a screen can put #19 in front of delete, the shape #18 uses');
        }));

        test('the rail is a named group and every key carries a name on the real control',
            () => mounted(async (page) => {
                const aria = await page.evalFn(() => {
                    const root = document.getElementById('rail').shadowRoot;
                    const rail = root.getElementById('rail');
                    return {
                        role: rail.getAttribute('role'),
                        name: rail.getAttribute('aria-label'),
                        keys: [...root.querySelectorAll('ui-button')].map((b) => ({
                            action: b.dataset.action,
                            /* #1 puts `label` on the inner <button>, where ARIA allows a
                             * name; the host stays an unnamed generic. */
                            onControl: b.shadowRoot.querySelector('button').getAttribute('aria-label'),
                            onHost: b.getAttribute('aria-label'),
                        })),
                        glyphsHidden: [...root.querySelectorAll('svg')]
                            .every((s) => s.getAttribute('aria-hidden') === 'true'),
                    };
                });
                assert.equal(aria.role, 'group');
                assert.equal(aria.name, 'Step actions');
                assert.deepEqual(aria.keys.map((k) => k.onControl), ACTIONS.map((a) => NAMES[a]),
                    'Slate names these already — carried, and '
                    + 'the counterexample two rows over is E14, "32 grid +/- buttons share '
                    + 'two aria-labels, both UNTRANSLATED"');
                assert.deepEqual(aria.keys.map((k) => k.onHost), Array(5).fill(null));
                assert.equal(aria.glyphsHidden, true, 'the artwork is not the name');
            }));

        test('the group name is overridable, for "Step 3 actions"', () => mounted(async (page) => {
            const name = await page.evalFn(() => document.getElementById('rail')
                .shadowRoot.getElementById('rail').getAttribute('aria-label'));
            assert.equal(name, 'Step 3 actions');
        }, '<ui-action-key-rail id="rail" index="2" count="6" label="Step 3 actions"></ui-action-key-rail>'));

        for (const theme of ['dark', 'light']) {
            test(`E13 cannot express: the neutral key is --ui-muted in ${theme}`, () => mounted(
                async (page) => {
                    const muted = await page.resolveValue('var(--ui-muted)', 'color');
                    for (const action of ['move-left', 'duplicate', 'move-right']) {
                        assert.equal(await page.prop(glyph(action), 'color'), muted, action);
                    }
                    for (const action of ACTIONS) {
                        assert.notEqual(await page.prop(glyph(action), 'color'), 'rgb(149, 149, 149)');
                    }
                },
                MID,
                { theme },
            ));

            test(`the measured Slate pairs reproduce in ${theme}`, () => mounted(
                async (page) => {
                    assert.equal(await page.prop('#rail >>> .rail', 'background-color'),
                        await page.resolveValue('var(--ui-line)', 'color'),
                        '.pe-action-cell [i=210] background-color dark rgb(58, 72, 82) '
                        + '/ light rgb(203, 208, 211)');
                    assert.equal(await faceColour(page, 'delete'),
                        await page.resolveValue('var(--ui-fascia)', 'color'),
                        '.pe-action-btn [i=213] background-color dark rgb(14, 19, 23) '
                        + '/ light rgb(242, 243, 243)');
                    assert.equal(await page.prop(glyph('insert-after'), 'color'),
                        await page.resolveValue('var(--ui-steel)', 'color'),
                        '.pe-action-btn [i=213] color <- `.pe-act-add` authored '
                        + 'var(--slate-steel)');
                },
                MID,
                { theme },
            ));
        }

        test('every gallery state mounts, upgrades and renders five keys', () => mounted(async (page) => {
            for (const state of galleryEntry.states) {
                await page.mount(state.html, MODULE);
                assert.deepEqual(page.pageErrors, [], `${state.id} must mount without throwing`);
                const rails = await page.evalFn(() => [...document.querySelectorAll('ui-action-key-rail')]
                    .map((r) => r.shadowRoot.querySelectorAll('ui-button').length));
                assert.ok(rails.length >= 1, `${state.id} renders at least one rail`);
                for (const n of rails) assert.equal(n, 5, `${state.id}: C7's five keys`);
            }
        }));
    });
}

/* One geometry-independent block: the entry's own shape. The render half above proves
 * the states work; this proves the hand-off to the gallery's single cross-cutting
 * writer is well formed. */
describe('ui-action-key-rail gallery entry', () => {
    test('the entry has the documented shape', () => {
        assert.equal(galleryEntry.id, 'ui-action-key-rail', 'the id is the tag and the capture prefix');
        assert.equal(galleryEntry.module, '../../src/components/ui-action-key-rail.js',
            'module is relative to tools/gallery/');
        assert.ok(galleryEntry.title && galleryEntry.notes);
        const ids = galleryEntry.states.map((s) => s.id);
        assert.equal(new Set(ids).size, ids.length, 'state ids are capture filenames and must be unique');
        for (const id of ids) assert.match(id, /^[a-z0-9-]+$/);
    });
});
