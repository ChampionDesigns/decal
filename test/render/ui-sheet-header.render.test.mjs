/**
 * Gate A for.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';
import {
    assertTokenDrill,
    assertFocusUnclipped,
    assertOneSelectionTreatment,
    assertHitFloor,
    DRILL_COLOUR,
    DRILL_LENGTH,
} from '../harness/assertions.js';

const MODULE = [
    '/src/components/ui-sheet-header.js',
    '/src/components/ui-button.js',
    '/test/fixtures/base-fixture.js',
];

const HOSTILE_CSS = `
<style>
    .slate-sheet-actions, .trail, ui-sheet-header .trail, ui-sheet-header > * {
        justify-content: flex-end !important;
        margin-top: 40px !important;
        gap: 18px !important;
    }
    .slate-sheet-header, .head, ui-sheet-header .head {
        padding: 0 !important;
        height: 118px !important;
    }
    .slate-sheet-title, .title, ui-sheet-header .title, ui-sheet-header h2 {
        font-size: 20px !important;
        font-weight: 800 !important;
        letter-spacing: 0.01em !important;
        text-transform: none !important;
    }
</style>`;

const RING_CSS = `
<style>
    .child:focus-visible {
        outline: var(--ui-focus-w) solid var(--ui-steel);
        outline-offset: var(--_ui-focus-offset, var(--ui-focus-offset));
    }
    .resets { --_ui-focus-offset: var(--ui-focus-offset); }
    button.child { margin: 0; padding: 0 12px; border: 0; background: none; font: inherit; min-block-size: 64px; }

    /* #shrink's header is a bare flex item and therefore intrinsically sized: every
     * UiElement host carries container-type: inline-size, so it contributes zero and
     * resolves to 0 wide. That collapse is asserted deliberately on #shrink; every
     * OTHER header in this fixture is in a block container with a stated inline size,
     * so it has something to fill. */
</style>`;

const MARKUP = `${RING_CSS}
<div id="wide" style="inline-size: 680px; padding: 24px">
    <ui-sheet-header id="pair" heading="Drink out">
        <button class="child" slot="trail" id="cancel" type="button">Cancel</button>
        <button class="child" slot="trail" id="confirm" type="button">Confirm</button>
    </ui-sheet-header>
</div>
<div id="wide-2" style="inline-size: 680px; padding: 24px">
    <ui-sheet-header id="bare" heading="Add schedule"></ui-sheet-header>
</div>
<div id="wide-3" style="inline-size: 680px; padding: 24px">
    <ui-sheet-header id="levels" heading="Set time" level="4"></ui-sheet-header>
</div>
<div id="wide-4" style="inline-size: 680px; padding: 24px">
    <ui-sheet-header id="bogus" heading="Notes" level="9"></ui-sheet-header>
</div>
<div id="wide-5" style="inline-size: 680px; padding: 24px">
    <ui-sheet-header id="composed" heading="Confirm">
        <ui-button slot="trail" id="ui-cancel">Cancel</ui-button>
        <ui-button slot="trail" id="ui-ok" variant="primary">Confirm</ui-button>
    </ui-sheet-header>
</div>
<div id="wide-6" style="inline-size: 680px; padding: 24px">
    <ui-sheet-header id="inset" heading="Inset ring" focus-ring="inset">
        <button class="child" slot="trail" id="inset-kid" type="button">Close</button>
    </ui-sheet-header>
</div>
<div id="wide-7" style="inline-size: 680px; padding: 24px">
    <ui-sheet-header id="dropped" heading="Dropped content">
        <span id="no-slot">a title of my own</span>
        <button id="footer-slot" slot="actions" type="button">OK</button>
    </ui-sheet-header>
</div>
<div id="wide-8" style="inline-size: 680px; padding: 24px">
    <ui-sheet-header id="selectable" heading="Dials through the slot">
        <base-fixture id="fx" slot="trail" style="padding: 0"></base-fixture>
    </ui-sheet-header>
</div>
<div id="narrow" style="inline-size: 320px; padding: 24px">
    <ui-sheet-header id="squeezed" heading="Sleep and wake schedules for this machine">
        <button class="child" slot="trail" id="squeezed-out" type="button">Save</button>
    </ui-sheet-header>
</div>
<div id="narrow-2" style="inline-size: 320px; padding: 24px">
    <ui-sheet-header id="bare-narrow" heading="Sleep and wake schedules for this machine"></ui-sheet-header>
</div>
<div id="shrink-row" style="display: flex; align-items: flex-start; padding: 24px">
    <ui-sheet-header id="shrink" heading="Nothing to fill"></ui-sheet-header>
</div>
<!--
  NO HEADING AT ALL (c3-7). Both spellings of the empty string, because heading has an
  empty-string default: the attribute absent, and the attribute present and empty.
  Neither may put an empty h1-h6 in the accessibility tree.
-->
<div id="wide-9" style="inline-size: 680px; padding: 24px">
    <ui-sheet-header id="untitled">
        <button class="child" slot="trail" id="untitled-out" type="button">Close</button>
    </ui-sheet-header>
</div>
<div id="wide-10" style="inline-size: 680px; padding: 24px">
    <ui-sheet-header id="empty-title" heading="">
        <button class="child" slot="trail" id="empty-out" type="button">Close</button>
    </ui-sheet-header>
</div>
`;

const ORACLE = {
    titleSize: 28,
    titleWeight: '500',
    titleTransform: 'uppercase',
    titleTracking: 3.36,
    ink: { dark: 'rgb(244, 247, 248)', light: 'rgb(23, 26, 28)' },
    rowFloor: 64,
    rowInset: 18,
    titleGap: 24,
    clusterGap: 12,
};

const near = (got, want, what, tol = 0.4) => assert.ok(
    Math.abs(parseFloat(got) - want) <= tol,
    `${what}: expected ~${want}px, rendered ${got}`,
);

/** Filled in by each geometry block, compared once at the end. */
const acrossGeometries = {};

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`ui-sheet-header @ ${geometry.name} (${geometry.width}×${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

        const mounted = (fn) => browser.withPage({ geometry }, async (page) => {
            await page.mount(MARKUP, MODULE);
            assert.deepEqual(page.pageErrors, [], 'ui-sheet-header must mount without throwing');
            return fn(page);
        });

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

        test('every measured header has a container to fill', () => mounted(async (page) => {
            for (const id of ['pair', 'bare', 'levels', 'bogus', 'composed', 'dropped']) {
                const host = await page.box(`#${id}`);
                assert.ok(host.width > 400, `#${id} is in a collapsed slot: ${host.width}px`);
            }
        }));

        test('drill: --ui-text-xl is the title size', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-text-xl',
                value: DRILL_LENGTH,
                selector: '#pair >>> #title',
                property: 'font-size',
            });
        }));

        test('drill: --ui-weight-medium is the title weight', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-weight-medium',
                value: '900',
                selector: '#pair >>> #title',
                property: 'font-weight',
            });
        }));

        test('drill: --ui-tracking-cap is the title tracking', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-tracking-cap',
                value: DRILL_LENGTH,
                selector: '#pair >>> #title',
                property: 'letter-spacing',
            });
        }));

        test('drill: --ui-text is the title ink', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-text',
                value: DRILL_COLOUR,
                selector: '#pair >>> #title',
                property: 'color',
            });
        }));

        test('drill: --ui-control-h is the row floor', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-control-h',
                value: DRILL_LENGTH,
                selector: '#pair >>> #head',
                property: 'min-height',
            });
        }));

        test('drill: --ui-space-4 is the bottom inset', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-space-4',
                value: DRILL_LENGTH,
                selector: '#pair >>> #head',
                property: 'padding-bottom',
            });
        }));

        test('drill: --ui-space-5 is the gap to the cluster', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-space-5',
                value: DRILL_LENGTH,
                selector: '#pair >>> #head',
                property: 'column-gap',
            });
        }));

        test('drill: --ui-space-3 is the gap inside the cluster', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-space-3',
                value: DRILL_LENGTH,
                selector: '#pair >>> #trail',
                property: 'column-gap',
            });
        }));

        test('the oracle values render, in both themes', () => mounted(async (page) => {
            const type = await page.computed('#pair >>> #title',
                ['font-size', 'font-weight', 'text-transform', 'letter-spacing']);
            near(type['font-size'], ORACLE.titleSize, 'title font-size');
            assert.equal(type['font-weight'], ORACLE.titleWeight);
            assert.equal(type['text-transform'], ORACLE.titleTransform);
            near(type['letter-spacing'], ORACLE.titleTracking, 'title letter-spacing', 0.02);

            const geom = await page.computed('#pair >>> #head',
                ['min-height', 'padding-bottom', 'column-gap']);
            near(geom['min-height'], ORACLE.rowFloor, 'row floor');
            near(geom['padding-bottom'], ORACLE.rowInset, 'bottom inset');
            near(geom['column-gap'], ORACLE.titleGap, 'gap to the cluster');
            near(await page.prop('#pair >>> #trail', 'column-gap'),
                ORACLE.clusterGap, 'gap inside the cluster');

            for (const theme of ['dark', 'light']) {
                await page.setTheme(theme);
                assert.equal(
                    await page.prop('#pair >>> #title', 'color'), ORACLE.ink[theme],
                    `title ink in ${theme}`,
                );
            }
        }));

        test('wave law: no dial reaches anything this component paints', () => mounted(async (page) => {
            const parts = ['#pair >>> #head', '#pair >>> #title', '#pair >>> #trail'];
            const props = ['background-color', 'color', 'box-shadow', 'text-shadow'];
            const before = {};
            for (const p of parts) before[p] = await page.computed(p, props);

            await page.setToken('--ui-selected-face', DRILL_COLOUR);
            await page.setToken('--ui-selected-ink', DRILL_COLOUR);
            await page.setToken('--ui-selected-led', DRILL_LENGTH);
            await page.setToken('--ui-selected-glow', '60%');
            try {
                for (const p of parts) {
                    assert.deepEqual(
                        await page.computed(p, props), before[p],
                        `${p} moved when the selection dials moved — this component owns ` +
                        'no selected state, so nothing in it may read a dial ' +
                        '(wave 2 law, CONVENTIONS §4).',
                    );
                }
            } finally {
                for (const t of ['--ui-selected-face', '--ui-selected-ink',
                    '--ui-selected-led', '--ui-selected-glow']) await page.setToken(t, null);
            }
        }));

        test('a selectable control in the trail slot is still painted by the four dials',
            () => mounted(async (page) => {
                await assertOneSelectionTreatment(page, {
                    selected: '#fx >>> #tab',
                    unselected: '#fx >>> #tab-off',
                });
            }));

        test('a slotted control keeps the one ring, unclipped', () => mounted(async (page) => {
            await assertFocusUnclipped(page, '#cancel');
            await assertFocusUnclipped(page, '#confirm');
        }));

        test('a composed ui-button keeps its own ring through the slot', () => mounted(async (page) => {
            await assertFocusUnclipped(page, '#ui-ok >>> button');
        }));

        test('the header does not squeeze a slotted control below the hit floor',
            () => mounted(async (page) => {
                await assertHitFloor(page, '#ui-ok >>> button', { mode: 'box' });
                await assertHitFloor(page, '#ui-cancel >>> button', { mode: 'box' });
            }));

        test('focus-ring="inset" on the host reaches a slotted child', () => mounted(async (page) => {
            const inset = await page.resolveValue('var(--ui-focus-offset-inset)', 'outline-offset');
            const outset = await page.resolveValue('var(--ui-focus-offset)', 'outline-offset');
            assert.notEqual(inset, outset, 'the two offsets must differ for this to prove anything');

            await page.focusVisible('#inset-kid');
            assert.equal(await page.prop('#inset-kid', 'outline-offset'), inset);

            await page.focusVisible('#cancel');
            assert.equal(await page.prop('#cancel', 'outline-offset'), outset);
        }));

        test('the header fills its container and reads no viewport', () => mounted(async (page) => {
            const host = await page.box('#pair');
            const holder = await page.box('#wide');
            near(host.width, holder.width - 48, 'the header fills its 680px container');
            acrossGeometries[geometry.name] = {
                host: Math.round(host.width * 10) / 10,
                row: Math.round((await page.box('#pair >>> #head')).height * 10) / 10,
                narrowTrail: Math.round((await page.box('#squeezed-out')).width * 10) / 10,
            };
        }));

        test('the row floor holds, and only when nothing taller is in it', () => mounted(async (page) => {
            const bare = await page.box('#bare >>> #head');
            near(bare.height, ORACLE.rowFloor, 'a title-only row sits on the floor');

            const pair = await page.box('#pair >>> #head');
            assert.ok(
                pair.height >= ORACLE.rowFloor + ORACLE.rowInset - 0.5,
                `a row holding 64px controls is ${pair.height}px; expected at least ` +
                `${ORACLE.rowFloor + ORACLE.rowInset}px (control + inset)`,
            );
        }));

        test('an empty cluster takes no space at all (departure 4)', () => mounted(async (page) => {
            assert.equal(await page.prop('#bare-narrow >>> #trail', 'display'), 'none');

            const host = await page.box('#bare-narrow');
            const withoutIt = await page.box('#bare-narrow >>> #title');
            near(withoutIt.width, host.width, 'the title has the whole row', 1);

            await page.setStyle('#bare-narrow >>> #trail', { display: 'flex' });
            const withIt = await page.box('#bare-narrow >>> #title');
            await page.setStyle('#bare-narrow >>> #trail', { display: null });

            near(withoutIt.width - withIt.width, ORACLE.titleGap,
                'an empty cluster in the layout costs the title exactly the flex gap', 1);
        }));

        test('in a narrow container the title gives way and the way out does not',
            () => mounted(async (page) => {
                const title = await page.metrics('#squeezed >>> #title');
                assert.ok(
                    title.scrollWidth > title.clientWidth + 0.5,
                    `the long title is not actually overflowing (${title.scrollWidth} vs ` +
                    `${title.clientWidth}) — the assertion would pass vacuously`,
                );
                const style = await page.computed('#squeezed >>> #title',
                    ['text-overflow', 'white-space', 'overflow-x']);
                assert.equal(style['text-overflow'], 'ellipsis');
                assert.equal(style['white-space'], 'nowrap');

                // The cluster is whole and inside the header's own box.
                const host = await page.box('#squeezed');
                const trail = await page.box('#squeezed-out');
                assert.ok(
                    trail.right <= host.right + 0.5 && trail.left >= host.left - 0.5,
                    `the cluster is outside the header box: cluster ${trail.left}→${trail.right}, ` +
                    `header ${host.left}→${host.right}`,
                );
                assert.ok(trail.width > 40, `the cluster was squeezed to ${trail.width}px`);
            }));

        test('an INTRINSIC-SIZING slot leaves the header nothing to fill', () => mounted(async (page) => {
            const host = await page.box('#shrink');
            assert.ok(host.width < 1, `expected a collapsed host, measured ${host.width}px`);

            await page.setStyle('#shrink', { flex: '1 1 0' });
            const fixed = await page.box('#shrink');
            assert.ok(fixed.width > 400,
                `one declaration at the call site should fix it; measured ${fixed.width}px`);
            await page.setStyle('#shrink', { flex: null });
        }));

        test('O13: the cluster has one name and it is not "actions"', () => mounted(async (page) => {
            const trailBox = await page.box('#cancel');
            assert.ok(trailBox.width > 0 && trailBox.height > 0,
                'a child in the trail slot must render');

            const footer = await page.box('#footer-slot');
            assert.ok(
                footer.width === 0 && footer.height === 0,
                `slot="actions" rendered a ${footer.width}x${footer.height} box — this ` +
                'component must not answer to the dialog footer\'s name (O13).',
            );

            const slots = await page.evalFn(() => [...document.getElementById('pair')
                .shadowRoot.querySelectorAll('slot')].map((s) => s.name));
            assert.deepEqual(slots, ['trail'],
                'exactly one named slot, so there is no second cluster to confuse with a footer');
        }));

        test('O13: the shell\'s footer rule cannot reach the header cluster',
            () => mounted(async (page) => {
                const clean = await page.computed('#pair >>> #trail',
                    ['justify-content', 'margin-top', 'column-gap']);
                await page.evalFn((css) => {
                    document.body.insertAdjacentHTML('beforeend', css);
                }, HOSTILE_CSS);
                await page.settle(2);

                assert.deepEqual(
                    await page.computed('#pair >>> #trail',
                        ['justify-content', 'margin-top', 'column-gap']),
                    clean,
                    'slate-shell.css:2227-2232 reached the header cluster — O13 is alive',
                );
                near(clean['column-gap'], ORACLE.clusterGap, 'the cluster gap is the library\'s');
                assert.equal(clean['margin-top'], '0px');
            }));

        test('O1: an outside `padding: 0` cannot reach the inset', () => mounted(async (page) => {
            await page.evalFn((css) => {
                document.body.insertAdjacentHTML('beforeend', css);
            }, HOSTILE_CSS);
            await page.settle(2);

            near(await page.prop('#pair >>> #head', 'padding-bottom'),
                ORACLE.rowInset, 'the shared inset survived the shell rule');
            near(await page.prop('#pair >>> #head', 'min-height'),
                ORACLE.rowFloor, 'the row floor survived the shell rule');
        }));

        test('A10: the title type cannot be re-declared from outside', () => mounted(async (page) => {
            await page.evalFn((css) => {
                document.body.insertAdjacentHTML('beforeend', css);
            }, HOSTILE_CSS);
            await page.settle(2);

            const type = await page.computed('#pair >>> #title',
                ['font-size', 'font-weight', 'letter-spacing', 'text-transform']);
            near(type['font-size'], ORACLE.titleSize, 'the time picker\'s 20px reached the title');
            assert.equal(type['font-weight'], ORACLE.titleWeight,
                'the time picker\'s 800 reached the title');
            near(type['letter-spacing'], ORACLE.titleTracking,
                'the notes editor\'s .01em reached the title', 0.02);
            assert.equal(type['text-transform'], ORACLE.titleTransform);
        }));

        test('A10: there is no slot to hang a second title treatment on', () => mounted(async (page) => {
            const smuggled = await page.box('#no-slot');
            assert.ok(
                smuggled.width === 0 && smuggled.height === 0,
                `unslotted light content rendered a ${smuggled.width}x${smuggled.height} box; ` +
                'the title must be the component\'s and only the component\'s',
            );
            const named = await page.evalFn(() => [...document.getElementById('dropped')
                .shadowRoot.querySelectorAll('slot')].filter((s) => !s.name).length);
            assert.equal(named, 0, 'a default slot would re-open A10');
        }));

        test('the title is a real heading at the level asked for', () => mounted(async (page) => {
            const tags = await page.evalFn(() => ['pair', 'levels', 'bogus'].map(
                (id) => document.getElementById(id).shadowRoot.querySelector('#title').tagName,
            ));
            assert.deepEqual(tags, ['H2', 'H4', 'H2'],
                'default 2, the level asked for, and a documented fallback for level="9"');
            assert.equal(await page.evalFn(() => document.getElementById('bogus').level), 2,
                'an out-of-range level normalises to the default rather than rendering a non-heading');
        }));

        test('an EMPTY heading renders no heading element at all', () => mounted(async (page) => {
            const headings = await page.evalFn(() => ['untitled', 'empty-title'].map(
                (id) => document.getElementById(id).shadowRoot
                    .querySelectorAll('h1, h2, h3, h4, h5, h6').length,
            ));
            assert.deepEqual(headings, [0, 0],
                'an empty heading must not put an empty h1…h6 in the accessibility tree');

            assert.equal(await page.prop('#untitled >>> #trail', 'display'), 'flex');
            const row = await page.box('#untitled >>> #head');
            assert.ok(row.height >= ORACLE.rowFloor - 0.5,
                `the row floor is gone without a title: ${row.height}px`);

            const trail = await page.box('#untitled >>> #trail');
            near(trail.x + trail.width, row.x + row.width,
                'the way out must sit at the trailing edge of a title-less row', 1);

            /* THE CONVERSE, so the guard cannot go vacuous: give it a title and the
             * heading appears, at the level asked for. */
            const after = await page.evalFn(async () => {
                const el = document.getElementById('untitled');
                el.heading = 'Later';
                await el.updateComplete;
                const h = el.shadowRoot.querySelector('#title');
                return [h.tagName, h.textContent];
            });
            assert.deepEqual(after, ['H2', 'Later']);
        }));

        test('the accessible name keeps the case the author wrote', () => mounted(async (page) => {
            const text = await page.evalFn(() => document.getElementById('pair')
                .shadowRoot.querySelector('#title').textContent);
            assert.equal(text, 'Drink out');
            assert.equal(await page.prop('#pair >>> #title', 'text-transform'), 'uppercase');
        }));

        test('the cluster appears and disappears with its content', () => mounted(async (page) => {
            assert.equal(await page.prop('#bare >>> #trail', 'display'), 'none');
            await page.evalFn(() => {
                const b = document.createElement('button');
                b.id = 'late';
                b.setAttribute('slot', 'trail');
                b.textContent = 'Later';
                document.getElementById('bare').append(b);
            });
            await page.settle(2);
            assert.equal(await page.prop('#bare >>> #trail', 'display'), 'flex');

            await page.evalFn(() => document.getElementById('late').remove());
            await page.settle(2);
            assert.equal(await page.prop('#bare >>> #trail', 'display'), 'none');
        }));
    });
}

describe('ui-sheet-header across geometries', () => {
    test('the same container renders the same header at both geometries', () => {
        const names = Object.keys(acrossGeometries);
        assert.equal(names.length, GATE_A_GEOMETRIES.length,
            'both geometry blocks must have recorded their measurements');
        const [a, b] = names.map((n) => acrossGeometries[n]);
        assert.deepEqual(a, b,
            'the header changed with the VIEWPORT rather than with its container ' +
            '(spec §2.1 Rule 1) — there is no @media in this component and there must ' +
            `not be: ${JSON.stringify(acrossGeometries)}`);
    });
});
