/**
 * base-fixture.render.test.mjs — the end-to-end proof of the Gate A rig, and the
 * pattern every Wave 1+ rendering suite copies.
 *
 * It runs the whole path: a static server on an ephemeral port serving the real
 * repo root, headless Chrome on an ephemeral debug port with a fresh profile, the
 * base-element conventions fixture mounted through index.html's own importmap, at
 * BOTH standard geometries — 1281×801 @ dsf 1.5 and the 1000×600 floor — asserting
 * only on computed style, box geometry and behaviour.
 *
 * Every assertion here is one of Gate A's four standing ones (Part 8 §2) pointed at
 * the fixture item #2 built for exactly this purpose. Nothing in this file reads a
 * source file, and nothing in it names a value that is not either a token or a
 * physical constant.
 *
 * WHY BOTH GEOMETRIES ON EVERY TEST. The bench truth is 1281×801 at dpr 1.5; the
 * floor is where a component has to prove it reads its own container. Running the
 * same assertions at both is what makes "the geometry is emulated" a fact rather
 * than a flag that was set once and never checked.
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

        /* -- standing assertion 1: tokens are consumed, not copied --------- */

        test('drill: --ui-control-h moves the control\'s rendered height', () => mounted(async (page) => {
            // A real --ui- token from styles/tokens.css (64px, the Slate stepper's
            // measured min-height), read through a geometry property rather than a
            // colour — a component that hard-codes 64px passes every colour drill.
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
                // The ring only exists while the element is keyboard-focused, and a
                // token change does not survive a re-focus for free — so re-establish
                // it before every read.
                prepare: (p) => p.focusVisible(sel),
            });
        }));

        test('drill: --ui-text moves inherited ink across the shadow boundary', () => mounted(async (page) => {
            // Custom properties are the ONLY styling that crosses a shadow boundary
            // (Part 2 §4; A6). This is that mechanism, asserted rather than assumed.
            await assertTokenDrill(page, {
                token: '--ui-text',
                value: DRILL_COLOUR,
                selector: 'base-fixture >>> #plain',
                property: 'color',
            });
        }));

        /* -- standing assertion 2: one selection treatment ------------------ */

        test('the selected control is painted by the four dials and nothing else', () => mounted(async (page) => {
            const result = await assertOneSelectionTreatment(page, {
                selected: 'base-fixture >>> #tab',
                unselected: 'base-fixture >>> #tab-off',
            });
            // Slate's own dials, carried unchanged (slate-tokens.css:188-191, spec §3.9):
            // the face IS --ui-steel, so the two resolve to the same colour.
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
            // box-shadow is a WHOLE-VALUE property: selectionSurface's declaration
            // replaces the element's entire shadow list. The seam between two items in
            // a one-piece bank is an inset shadow (--ui-seam-ink, oracle record
            // editor-review[9] .slate-bank-item), so ui-bank — component #2 — would
            // lose its seam the moment an item turned selected. The fragment prepends
            // --_ui-rest-shadow instead, and this is that, rendered.
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
            // The default path must paint exactly what it painted before the slot
            // existed: a transparent no-op plus the (0px) LED.
            const on = await page.prop('base-fixture >>> #tab', 'box-shadow');
            assert.ok(/rgba\(\s*0,\s*0,\s*0,\s*0\s*\)/.test(on), `expected a transparent no-op segment: ${on}`);
        }));

        /* -- standing assertion 3: scroll floors and stated overflow -------- */

        test('a squeezed region stops at its floor and shows a scrollbar', () => mounted(async (page) => {
            const m = await assertScrollFloor(page, {
                selector: '#mount',
                // Ask for 120px against a 200px floor: the floor must win, and the
                // overflow must become a scrollbar rather than a silent clip.
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

        /* -- standing assertion 4: focus geometry, unclipped (bug L24) ------ */

        test('the focus ring is the token ring, unclipped, outset', () => mounted(async (page) => {
            const g = await assertFocusUnclipped(page, 'base-fixture >>> #plain');
            assert.equal(g.outlineOffset, '2px', '--ui-focus-offset');
            assert.deepEqual(g.clippers, [], 'nothing clips a control in an open row');
        }));

        test('the third place a focusable can be: SLOTTED IN, and it gets the same ring',
            () => browser.withPage({ geometry }, async (page) => {
                /* Review finding cross-3. The base's focusable list is scoped to the
                 * shadow tree and a slotted node is light DOM, so before
                 * `::slotted(:focus-visible)` existed a bare slotted button fell back
                 * to the UA's own ring - MEASURED at BENCH inside <ui-card>:
                 * outline-style `auto`, outline-color rgb(16, 16, 16), outline-width
                 * 1px. A sixth treatment, in the layer that exists to end the five
                 * (§3.6). Twelve of wave 1's fourteen elements expose a slot.
                 *
                 * Mounted here rather than in the shared MARKUP so no other assertion's
                 * geometry moves. */
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
            // Bug L24's exact shape: a control inside `overflow: hidden`. The fixture
            // re-declares --_ui-focus-offset for that subtree, so the ring is drawn
            // inside the element and the clipper cannot reach it.
            const g = await assertFocusUnclipped(page, 'base-fixture >>> #clipped');
            assert.equal(g.outlineOffset, '-3px', '--ui-focus-offset-inset');
            assert.ok(g.clippers.length >= 1, 'the fixture must actually have a clipping ancestor, or this is vacuous');
            assert.equal(g.clippers[0].overflowY, 'hidden');
        }));

        /* -- the hit-area utility, ink separate from floor (spec §2.3) ------ */

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

        /* -- a component reads its own container, never the viewport -------- */

        test('the container query follows the host, not the viewport', () => mounted(async (page) => {
            // The inversion is the proof: at a 1281-wide viewport a 380px host reports
            // the narrow layout, and at a 1000-wide viewport a 900px host reports the
            // wide one. A component keyed on @media would get both backwards.
            await page.setStyle('base-fixture', { 'inline-size': '380px' });
            assert.equal(await page.prop('base-fixture >>> #container-probe', 'block-size'), '10px');

            await page.setStyle('base-fixture', { 'inline-size': '900px' });
            assert.equal(await page.prop('base-fixture >>> #container-probe', 'block-size'), '40px');
        }));

        /* -- zero !important, proved by the override winning ---------------- */

        test('a component rule beats the base rules with no !important anywhere', () => mounted(async (page) => {
            const box = await page.computed('base-fixture >>> #override', ['box-sizing', 'width']);
            assert.equal(box['box-sizing'], 'content-box', 'the base :where() rule is zero-specificity');
            assert.equal(box.width, '100px', 'content-box: the 10px padding sits outside the 100px');
        }));

        /* -- base styles come FIRST, however the subclass spelled its array ---- */

        test('the :host opt-out works even when the subclass ALSO spreads the base styles', () => {
            // The other leg of zero-!important. :host rules cannot be wrapped in
            // :where() — they carry a real (0,1,0) — so the opt-out only works because
            // the base comes first. Lit's own dedupe keeps the LAST copy of a repeated
            // sheet, which would put the base last for the belt-and-braces spelling and
            // silently un-do the opt-out. Both elements must report `normal`.
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
            // `:where([disabled])` is a shadow-tree selector and cannot match the host.
            // The ordinary Lit spelling reflects `disabled` onto the host, so without
            // its own :host() rule "every disabled control dims" is false for the most
            // common shape in the library.
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

/* ---------------------------------------------------------------------------
 * Cross-geometry: the two standard geometries genuinely differ
 * ------------------------------------------------------------------------- */

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
