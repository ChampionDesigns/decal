/**
 * The end-to-end proof of the render harness rig, and the pattern every.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES, BENCH, FLOOR } from '../harness/index.js';
import {
    assertTokenDrill,
    assertOneSelectionTreatment,
    assertScrollFloor,
    assertFocusUnclipped,
    assertHitFloor,
    DRILL_COLOUR,
} from '../harness/assertions.js';

const FIXTURE = ['/test/fixtures/base-fixture.js'];
const MARKUP = '<base-fixture></base-fixture>';

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`base fixture @ ${geometry.name} (${geometry.width}×${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

        const mounted = (fn) => browser.withPage({ geometry }, async (page) => {
            await page.mount(MARKUP, FIXTURE);
            assert.deepEqual(page.pageErrors, [], 'the fixture must mount without throwing');
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

        test('drill: --ui-control-h moves the control\'s rendered height', () => mounted(async (page) => {
            const drill = await assertTokenDrill(page, {
                token: '--ui-control-h',
                value: '91px',
                selector: 'base-fixture >>> #plain',
                property: 'min-block-size',
            });
            assert.equal(drill.after, '91px');

            const box = await page.box('base-fixture >>> #plain');
            assert.equal(box.height, 64, 'the resting height is --ui-control-h\'s own value');
        }));

        test('drill: --ui-steel moves the focus ring', () => mounted(async (page) => {
            const sel = 'base-fixture >>> #plain';
            await assertTokenDrill(page, {
                token: '--ui-steel',
                value: DRILL_COLOUR,
                selector: sel,
                property: 'outline-color',
                prepare: (p) => p.focusVisible(sel),
            });
        }));

        test('drill: --ui-text moves inherited ink across the shadow boundary', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-text',
                value: DRILL_COLOUR,
                selector: 'base-fixture >>> #plain',
                property: 'color',
            });
        }));

        test('the selected control is painted by the four dials and nothing else', () => mounted(async (page) => {
            const result = await assertOneSelectionTreatment(page, {
                selected: 'base-fixture >>> #tab',
                unselected: 'base-fixture >>> #tab-off',
            });
            assert.equal(result.face, await page.resolveToken('--ui-steel', 'background-color'));
        }));

        test('the disabled control reads --ui-opacity-disabled', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-opacity-disabled',
                value: '0.17',
                selector: 'base-fixture >>> #disabled',
                property: 'opacity',
            });
        }));

        test('a selected element keeps a resting shadow declared in the composition slot', () => mounted(async (page) => {
            const seamInk = await page.resolveToken('--ui-seam-ink', 'background-color');
            const off = await page.prop('base-fixture >>> #seam-off', 'box-shadow');
            const on = await page.prop('base-fixture >>> #seam-on', 'box-shadow');

            assert.ok(off.includes(seamInk), `resting seam missing: ${off}`);
            assert.ok(on.includes(seamInk), `the seam did not survive selection: ${on}`);
            // And selection still contributes its own LED segment on top of it.
            assert.ok(
                on.split(',').length > off.split(',').length,
                `selection should ADD a shadow segment, not replace the list: ${on}`,
            );
        }));

        test('an unselected element with no slot set is unchanged by the composition', () => mounted(async (page) => {
            const on = await page.prop('base-fixture >>> #tab', 'box-shadow');
            assert.ok(/rgba\(\s*0,\s*0,\s*0,\s*0\s*\)/.test(on), `expected a transparent no-op segment: ${on}`);
        }));

        test('a squeezed region stops at its floor and shows a scrollbar', () => mounted(async (page) => {
            const m = await assertScrollFloor(page, {
                selector: '#mount',
                squeeze: {
                    'overflow-y': 'auto',
                    'min-block-size': '200px',
                    'block-size': '120px',
                },
                minBlockSize: '200px',
            });
            assert.equal(m.rect.height, 200, 'min-block-size, not block-size, decides');
            assert.ok(m.scrollbarInline >= 1, `expected a scrollbar gutter, got ${m.scrollbarInline}px`);
        }));

        test('the focus ring is the token ring, unclipped, outset', () => mounted(async (page) => {
            const g = await assertFocusUnclipped(page, 'base-fixture >>> #plain');
            assert.equal(g.outlineOffset, '2px', '--ui-focus-offset');
            assert.deepEqual(g.clippers, [], 'nothing clips a control in an open row');
        }));

        test('the third place a focusable can be: SLOTTED IN, and it gets the same ring',
            () => browser.withPage({ geometry }, async (page) => {
                await page.mount(
                    '<base-fixture><button id="loose" type="button">Slotted</button></base-fixture>',
                    FIXTURE,
                );
                assert.deepEqual(page.pageErrors, []);

                /* The same shared helper the shadow-tree case uses, so width, ink and
                 * unclipped-ness are asserted against the tokens by one code path. */
                const inShadow = await assertFocusUnclipped(page, 'base-fixture >>> #plain');
                const slotted = await assertFocusUnclipped(page, '#loose');

                assert.equal(slotted.outlineStyle, 'solid',
                    'the UA ring is `auto`; the one Decal ring is solid');
                assert.equal(slotted.outlineOffset, '2px', '--ui-focus-offset');

                /* And it is the SAME ring, not a lookalike: the identical declarations
                 * the shadow-tree rule produces, on an element the shadow tree does not
                 * own. */
                const ring = (g) => [g.outlineStyle, g.outlineWidth, g.outlineColor, g.outlineOffset];
                assert.deepEqual(ring(slotted), ring(inShadow),
                    'one ring, in all three places a focusable can be');
            }));

        test('the same ring survives a clipping parent by going inset', () => mounted(async (page) => {
            const g = await assertFocusUnclipped(page, 'base-fixture >>> #clipped');
            assert.equal(g.outlineOffset, '-3px', '--ui-focus-offset-inset');
            assert.ok(g.clippers.length >= 1, 'the fixture must actually have a clipping ancestor, or this is vacuous');
            assert.equal(g.clippers[0].overflowY, 'hidden');
        }));

        test('a 20px keycap has a 48px hit box on both axes', () => mounted(async (page) => {
            const hit = await assertHitFloor(page, 'base-fixture >>> #keycap');
            assert.deepEqual([hit.inline, hit.block], [48, 48]);

            const ink = await page.box('base-fixture >>> #keycap');
            assert.deepEqual([ink.width, ink.height], [20, 20], 'not one pixel of paint moved');
        }));

        test('the per-axis escape hatch grows only the block axis', () => mounted(async (page) => {
            const hit = await assertHitFloor(page, 'base-fixture >>> #preset', { axes: ['block'] });
            assert.equal(hit.block, 48);
            assert.equal(hit.inline, 20, '--_ui-hit-inline: 100% keeps a tight row tight');
        }));

        test('the slider box is the floor and its ink stays 8px', () => mounted(async (page) => {
            const s = await page.computed('base-fixture >>> #slider', [
                'block-size', 'padding-block-start', 'padding-block-end', 'background-clip',
            ]);
            assert.equal(s['block-size'], '48px', 'the box IS the hit floor');
            assert.equal(s['padding-block-start'], '20px', '(48 - 8) / 2');
            assert.equal(s['padding-block-end'], '20px');
            assert.equal(
                s['background-clip'], 'content-box',
                'the longhand rule — a `background:` shorthand would reset this and swell the track',
            );
        }));

        test('the container query follows the host, not the viewport', () => mounted(async (page) => {
            await page.setStyle('base-fixture', { 'inline-size': '380px' });
            assert.equal(await page.prop('base-fixture >>> #container-probe', 'block-size'), '10px');

            await page.setStyle('base-fixture', { 'inline-size': '900px' });
            assert.equal(await page.prop('base-fixture >>> #container-probe', 'block-size'), '40px');
        }));

        test('a component rule beats the base rules with no !important anywhere', () => mounted(async (page) => {
            const box = await page.computed('base-fixture >>> #override', ['box-sizing', 'width']);
            assert.equal(box['box-sizing'], 'content-box', 'the base :where() rule is zero-specificity');
            assert.equal(box.width, '100px', 'content-box: the 10px padding sits outside the 100px');
        }));

        /* -- base styles come FIRST, however the subclass spelled its array ---- */

        test('the :host opt-out works even when the subclass ALSO spreads the base styles', () => {
            return browser.withPage({ geometry }, async (page) => {
                await page.mount(
                    '<base-fixture-intrinsic id="plainOptOut">E</base-fixture-intrinsic>'
                    + '<base-fixture-spread id="spreadOptOut">E</base-fixture-spread>',
                    FIXTURE,
                );
                assert.deepEqual(page.pageErrors, []);
                for (const sel of ['#plainOptOut', '#spreadOptOut']) {
                    const host = await page.computed(sel, ['container-type', 'display']);
                    assert.equal(host['container-type'], 'normal', `${sel}: the opt-out did not take`);
                    assert.equal(host.display, 'inline-grid', `${sel}: the opt-out did not take`);
                }
            });
        });

        test('the disabled dial reaches the HOST, not only the shadow tree', () => {
            return browser.withPage({ geometry }, async (page) => {
                await page.mount(
                    '<base-fixture-spread id="hostOff">E</base-fixture-spread>'
                    + '<base-fixture-spread id="hostDisabled" disabled>E</base-fixture-spread>'
                    + '<base-fixture-spread id="hostAria" aria-disabled="true">E</base-fixture-spread>',
                    FIXTURE,
                );
                assert.deepEqual(page.pageErrors, []);
                const dial = parseFloat(await page.resolveToken('--ui-opacity-disabled', 'opacity'));
                assert.ok(dial > 0 && dial < 1, `--ui-opacity-disabled should dim, got ${dial}`);
                assert.equal(parseFloat(await page.prop('#hostOff', 'opacity')), 1);
                assert.equal(parseFloat(await page.prop('#hostDisabled', 'opacity')), dial);
                assert.equal(parseFloat(await page.prop('#hostAria', 'opacity')), dial);
            });
        });
    });
}

test('the bench and the floor are different renderings of the same fixture', async () => {
    const read = (geometry) => browser.withPage({ geometry }, async (page) => {
        await page.mount(MARKUP, FIXTURE);
        return {
            dpr: await page.eval('devicePixelRatio'),
            hostWidth: (await page.box('base-fixture')).width,
            controlHeight: (await page.box('base-fixture >>> #plain')).height,
        };
    });

    const bench = await read(BENCH);
    const floor = await read(FLOOR);

    assert.equal(bench.dpr, 1.5);
    assert.equal(floor.dpr, 1);
    assert.ok(bench.hostWidth > floor.hostWidth, 'the host fills its container at both sizes');
    assert.equal(
        bench.controlHeight, floor.controlHeight,
        'a control\'s height is a token, not a fraction of the viewport — 64px at both',
    );
});
