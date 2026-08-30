/**
 * ui-pick-disc.render.test.mjs — Wave 2 item #45's rendering suite.
 *
 * Gate A: headless Chrome over CDP, computed styles and box geometry only, never
 * source text, at BOTH standard geometries — 1281×801 @ dsf 1.5 and the 1000×600
 * floor (CONVENTIONS §10).
 *
 * WHAT THIS SUITE IS REALLY FOR. #45's row carries no bug id. Its defect is the
 * architectural one SCOPE's founding-defect callout names (SCOPE.md:1576-1578):
 * the pick disc is one of six components that "may not own a private 'selected'
 * look". A component that hard-codes --ui-steel into a selected rule renders
 * pixel-identically to one that reads the dials, so a screenshot gate cannot tell
 * them apart and neither can a reviewer reading a diff. Only a drill can. So the
 * centre of this file is three assertions no screenshot can make:
 *
 *   1. the FOUR DIALS, each retargeted on :root, each moving the rendered disc
 *      (assertOneSelectionTreatment does face/LED/glow; the ink drill is spelled
 *      out here so all four are visibly exercised);
 *   2. THE DIFFERENCE IS EXACTLY THE DIALS — a selected disc and a resting disc
 *      are compared property by property, and everything that is not face or ink
 *      must be identical. This is what makes a seventh treatment inexpressible
 *      rather than merely absent: any private selected paint added later lands in
 *      that diff;
 *   3. BOTH FORMS TAKE THE SAME SELECTED PAINT. Slate reaches --slate-steel twice,
 *      through two hand-written rules in one screen sheet
 *      (`.slate-hv-pick-tag[data-slot="a"]` and `.hv-pick-btn[aria-pressed="true"]`).
 *      Two rules is how six treatments started. Here it is one fragment, asserted.
 *
 * EVERY STARTING VALUE IS THE ORACLE'S, quoted in ui-pick-disc.js's header:
 * `prov_query.py find --cls slate-hv-pick-tag` → 6 elements in 2 states, 62 x 62 x6;
 * `prov_query.py find --cls hv-pick-btn` → 42 elements in 1 state, 62 x 62 x42.
 * Colours are asserted against the resolved token, never against a hex, so the suite
 * is true in both themes.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES, BENCH, FLOOR } from '../harness/index.js';
import { entry as galleryEntry } from '../../tools/gallery/entries/ui-pick-disc.entry.js';
import {
    assertTokenDrill,
    assertOneSelectionTreatment,
    assertFocusUnclipped,
    assertHitFloor,
    DRILL_COLOUR,
} from '../harness/assertions.js';

const MODULE = ['/src/components/ui-pick-disc.js'];

/* The header's two slot tags, then a shot-list row's two discs, then the two
 * edge cases. Slate's own arrangement: A is the shot on the charts, B the one it
 * is measured against. */
const TAG_A = '<ui-pick-disc id="tag-a" selected label="Slot A">A</ui-pick-disc>';
const TAG_B = '<ui-pick-disc id="tag-b" label="Slot B">B</ui-pick-disc>';
/* THE SHOT-LIST ROW'S DISCS NOW NAME THEIR FORM, and the attribute is not decoration
 * added to keep a test passing: parity surface 6 separated "is this pressable" from
 * "which of Slate's two discs is this", because the History band wanted the
 * combination Slate never had -- a slot-NAMING tag that is also pressable -- and got
 * the shot list's hollow paint by inheritance. These two fixtures are the shot list's
 * discs, so they say so; the band's are `BAND_TAG` below, and the assertion that an
 * interactive disc with no form rests on the TAG's paint is what pins the change. */
const PICK_A = '<ui-pick-disc id="pick-a" interactive form="pick" selected label="Compare slot A">A</ui-pick-disc>';
const PICK_B = '<ui-pick-disc id="pick-b" interactive form="pick" label="Compare slot B">B</ui-pick-disc>';
const PLAIN = '<ui-pick-disc id="plain" interactive form="pick">A</ui-pick-disc>';
const DISABLED = '<ui-pick-disc id="dis" interactive form="pick" disabled label="Compare slot B">B</ui-pick-disc>';
/** The History band's disc: pressable AND a tag, which is the combination Slate has no
 *  element for and which this component now expresses in two attributes. */
const BAND_TAG = '<ui-pick-disc id="band-b" interactive label="Shot B">B</ui-pick-disc>';
const MARKUP = `${TAG_A}${TAG_B}${PICK_A}${PICK_B}${PLAIN}${DISABLED}${BAND_TAG}`;

/** A shot-list row's pick cell, squeezed below one disc's width. */
const CRAMPED = `<div id="row" style="display:flex; inline-size:60px">${PICK_A}${PICK_B}</div>`;

/** The painted element inside a host — an id, because ids are for tests to query by. */
const disc = (host) => `#${host} >>> #disc`;

/** Rendered lengths at dsf 1.5 are not string-comparable; whole CSS px are. */
const near = (got, want, what, tol = 0.51) => assert.ok(
    Math.abs(got - want) <= tol,
    `${what}: expected ${want}, got ${got}`,
);

/**
 * Everything a disc paints EXCEPT the two colour dials.
 *
 * The founding-defect assertion compares this list between a selected disc and a
 * resting one of the same form. Every entry must be identical, which is the
 * machine-checkable form of "it may not own a private selected look": the moment
 * someone adds `border-color: var(--ui-steel)` to a selected rule — which is
 * exactly what Slate does at slate-live.css:2263 and :2514 — this list stops
 * matching and the test names the property.
 */
const NON_DIAL_PAINT = [
    'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
    'border-top-width', 'border-bottom-width',
    'border-top-left-radius', 'border-bottom-right-radius',
    'border-top-style',
    'width', 'height',
    'padding-top', 'padding-left',
    'font-size', 'font-weight', 'font-family',
    'opacity',
    'outline-style',
];

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`ui-pick-disc @ ${geometry.name} (${geometry.width}×${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

        const mounted = (fn, markup = MARKUP) => browser.withPage({ geometry }, async (page) => {
            await page.mount(markup, MODULE);
            assert.deepEqual(page.pageErrors, [], 'the component must mount without throwing');
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

        /* ================================================================
         * 1. THE ORACLE'S GEOMETRY, REPRODUCED
         *    find --cls slate-hv-pick-tag → 62 x 62 x6
         *    find --cls hv-pick-btn       → 62 x 62 x42
         *    48 elements, one distinct geometry, and it is --ui-control-inner.
         * ============================================================== */

        test('every disc is the oracle\'s 62 x 62, from --ui-control-inner', () => mounted(async (page) => {
            const inner = parseFloat(await page.resolveValue('var(--ui-control-inner)', 'width'));
            near(inner, 62, '--ui-control-inner is calc(--ui-control-h - 2 * --ui-hairline)');

            for (const host of ['tag-a', 'tag-b', 'pick-a', 'pick-b']) {
                const box = await page.box(`#${host}`);
                near(box.width, inner, `#${host} inline size is --ui-control-inner`);
                near(box.height, inner, `#${host} block size is --ui-control-inner`);
                near(box.width, 62, `ORACLE #${host} width=62px on all 48 measured elements`);
                near(box.height, 62, `ORACLE #${host} height=62px on all 48 measured elements`);

                // The painted disc fills its host exactly, so the ring, the fill and
                // the hit box are one circle rather than three boxes.
                const inkBox = await page.box(disc(host));
                near(inkBox.width, box.width, `${disc(host)} fills its host horizontally`);
                near(inkBox.height, box.height, `${disc(host)} fills its host vertically`);
            }
        }));

        test('the disc is round, and the host is round with it', () => mounted(async (page) => {
            // ORACLE border-top-left-radius = 50% on all 48 elements. Decal writes the
            // token instead, and --ui-radius-pill is 9999px: getComputedStyle reports the
            // SPECIFIED 9999px because the clamp to half the box is a used-value step
            // (CSS Backgrounds §5.5), so the check is "at least half" plus "it is the
            // token", not "equals 31px". Same painted circle, on a box that is square by
            // construction — both axes are --ui-control-inner.
            const pill = await page.resolveValue('var(--ui-radius-pill)', 'border-top-left-radius');
            for (const host of ['tag-a', 'pick-a']) {
                const box = await page.box(`#${host}`);
                for (const sel of [disc(host), `#${host}`]) {
                    const r = await page.prop(sel, 'border-top-left-radius');
                    assert.equal(r, pill, `${sel} radius is --ui-radius-pill, not a literal`);
                    assert.ok(parseFloat(r) >= box.width / 2 - 0.5,
                        `${sel} radius ${r} does not reach half of ${box.width}px, so it is not a circle`);
                }
            }
            // The HOST carrying it is not decoration: selectionSurface paints
            // :host([selected]) too, and a square face behind a round disc shows as a
            // filled square with a circle on top.
            await assertTokenDrill(page, {
                token: '--ui-radius-pill',
                value: '7px',
                selector: `#tag-a`,
                property: 'border-top-left-radius',
                expected: '7px',
            });
        }));

        /* ================================================================
         * 2. THE ORACLE'S RESTING PAINT, REPRODUCED — against resolved TOKENS,
         *    so the suite holds in both themes.
         * ============================================================== */

        test('the TAG rests on --ui-key inside a --ui-line-strong hairline', () => mounted(async (page) => {
            const got = await page.computed(disc('tag-b'), [
                'background-color', 'border-top-color', 'color', 'border-top-width',
            ]);
            assert.equal(got['background-color'], await page.resolveToken('--ui-key', 'background-color'),
                'CITE history-viewer .slate-hv-pick-tag [i=166] background-color: dark rgb(26, 33, 39) '
                + '/ light rgb(248, 249, 249) <- slate-live.css `.slate-hv-pick-tag`');
            assert.equal(got['border-top-color'], await page.resolveToken('--ui-line-strong', 'border-top-color'),
                'CITE history-viewer .slate-hv-pick-tag [i=166] border-top-color: dark rgb(82, 97, 107) '
                + '/ light rgb(170, 178, 183) <- slate-live.css `.slate-hv-pick-tag` — and Slate\'s own '
                + 'comment: "The hairline is load-bearing, not trim"');
            assert.equal(got.color, await page.resolveToken('--ui-text', 'color'),
                'ORACLE same element color: dark rgb(244, 247, 248) / light rgb(23, 26, 28) → --ui-text');
            // Resolved through `width`: a probe element with no border-style computes
            // every border width to 0px, so the obvious spelling compares 1 against 0.
            near(parseFloat(got['border-top-width']),
                parseFloat(await page.resolveValue('var(--ui-border-w)', 'width')),
                'ORACLE border-top-width = 1px → --ui-border-w');
        }));

        test('the PICK rests transparent inside a --ui-line hairline, ink --ui-muted', () => mounted(async (page) => {
            const got = await page.computed(disc('pick-b'), [
                'background-color', 'border-top-color', 'color',
            ]);
            assert.equal(got['background-color'], 'rgba(0, 0, 0, 0)',
                'CITE history-shotdata .hv-pick-btn [i=260] background-color = rgba(0, 0, 0, 0) '
                + '<- slate-live.css `.hv-pick-btn` authored `transparent` !important=no (FROZEN/hardcoded)');
            assert.equal(got['border-top-color'], await page.resolveToken('--ui-line', 'border-top-color'),
                'ORACLE .hv-pick-btn [i=260] border-top-color: dark rgb(58, 72, 82) '
                + '/ light rgb(203, 208, 211) → --ui-line');
            assert.equal(got.color, await page.resolveToken('--ui-muted', 'color'),
                'ORACLE .hv-pick-btn [i=260] color: dark rgb(148, 161, 169) '
                + '/ light rgb(90, 101, 108) → --ui-muted');
        }));

        /* PARITY SURFACE 6 — THE FORM IS THE PAINT, AND interactive IS NOT.
         *
         * The History band's discs NAME the two slots and are also pressable. Bound to
         * `interactive`, the resting paint came out the shot list's hollow one, and the
         * oracle says the header's disc is filled — which is the very failure this
         * component's own header quotes from Slate: "the circle vanished and left a
         * faint letter floating in the header, so B read as disabled".
         *
         * All three properties, against the same tokens the TAG test uses, on a disc
         * that IS interactive: so the assertion cannot pass by the two forms happening
         * to agree, and it fails the moment the paint goes back on `interactive`. */
        test('parity 6 — an interactive disc with no form rests on the TAG\'s paint', () => mounted(async (page) => {
            const band = await page.computed(disc('band-b'), [
                'background-color', 'border-top-color', 'color',
            ]);
            assert.equal(band['background-color'], await page.resolveToken('--ui-key', 'background-color'),
                'CITE history-viewer .slate-hv-pick-tag [i=166] background-color: dark '
                + 'rgb(26, 33, 39) — the History band\'s B disc is a TAG that is pressable, '
                + 'and a tag is filled');
            assert.equal(band['border-top-color'],
                await page.resolveToken('--ui-line-strong', 'border-top-color'),
                'CITE history-viewer .slate-hv-pick-tag [i=166] border-top-color: dark rgb(82, 97, 107)');
            assert.equal(band.color, await page.resolveToken('--ui-text', 'color'),
                'ORACLE same element color: dark rgb(244, 247, 248) → --ui-text, not --ui-muted');
            /* AND IT IS STILL THE PRESSABLE ELEMENT — the half the attribute keeps.
             * Read off the DOM: page.prop() answers a COMPUTED STYLE, so asking it for
             * tagName reads back "" and the assertion would pass for a span. */
            const tag = await page.evalFn(() => document.getElementById('band-b')
                .shadowRoot.getElementById('disc').tagName);
            assert.equal(tag, 'BUTTON',
                'interactive still renders the button; only the resting paint moved off it');
            /* AND THE HOLLOW LOOK IS STILL EXPRESSIBLE, which is DQ-610's rule: the
             * capability is kept behind an attribute rather than deleted. Read from the
             * form="pick" fixture in the same document, so the two are compared live. */
            const row = await page.computed(disc('pick-b'), ['background-color', 'color']);
            assert.equal(row['background-color'], 'rgba(0, 0, 0, 0)',
                'form="pick" still rests transparent — the shot list\'s paint, kept');
            assert.notEqual(row.color, band.color,
                'the two forms must differ, or this suite proves nothing about either');
        }));

        test('the letter is 14px at the three-weight scale\'s bold', () => mounted(async (page) => {
            for (const host of ['tag-b', 'pick-b']) {
                const got = await page.computed(disc(host), ['font-size', 'font-weight', 'font-family']);
                assert.equal(got['font-size'], await page.resolveValue('var(--ui-text-2xs)', 'font-size'),
                    'ORACLE font-size = 14px on all 48. Slate\'s --slate-text-sm IS 14px '
                    + '(slate-tokens.css:129); the rewrite\'s scale calls that step --ui-text-2xs');
                assert.equal(got['font-weight'], await page.resolveValue('var(--ui-weight-semibold)', 'font-weight'),
                    'ORACLE font-weight = 600, and --ui-weight-semibold IS 600 since parity '
                    + 'surface 1 restored the two weights slate-tokens.css:148-153 declares. '
                    + 'Written through --_ui-rest-weight so the fifth dial cannot thin it.');
                assert.equal(got['font-family'], await page.prop('body', 'font-family'),
                    'the UA sheet gives <button> its own family; `inherit` puts the document\'s back '
                    + 'without a component naming a face (CONVENTIONS §11, §7)');
            }
        }));

        /* ================================================================
         * 3. THE SELECTION DIALS — the whole point of this component.
         *
         *    SCOPE.md:1576-1578: "#32 (tab bar), #36 (favourites bank),
         *    #37 (preset bank), #45 (pick disc), the wizard chips in #39 and the
         *    selected states of #24/#25/#52 are all expressed through it or
         *    through its dials — none of them may own a private 'selected' look."
         * ============================================================== */

        test('the selected TAG is painted by the dials and nothing else', () => mounted(async (page) => {
            /* weightDial: false — this disc is the library's ONE user of
             * --_ui-rest-weight (base.js). Slate's own disc is semibold SELECTED AND
             * RESTING (ORACLE history-shotdata .hv-pick-btn font-weight = 600 on all 42
             * records, two of them painted --slate-selected-face; .slate-hv-pick-tag the
             * same 600 on all 6), so the weight here is resting paint rather than part
             * of the selected treatment, and the fifth dial must not reach it. The test
             * immediately below is the pin. */
            const r = await assertOneSelectionTreatment(page, {
                selected: disc('tag-a'),
                unselected: disc('tag-b'),
                weightDial: false,
            });
            // ORACLE history-viewer .slate-hv-pick-tag [i=163] (the A tag):
            // background-color dark rgb(176, 196, 206) / light rgb(49, 92, 112) =
            // --ui-steel = --ui-selected-face; color dark rgb(18, 24, 28) /
            // light rgb(248, 252, 253) = --ui-on-steel = --ui-selected-ink.
            assert.equal(r.face, await page.resolveToken('--ui-steel', 'background-color'),
                'the face dial still resolves to --ui-steel, which is what the oracle measured');
            assert.equal(r.ink, await page.resolveToken('--ui-on-steel', 'color'),
                'the ink dial still resolves to --ui-on-steel, which is what the oracle measured');
        }));

        test('the selected PICK is painted by the same dials', () => mounted(async (page) => {
            await assertOneSelectionTreatment(page, {
                selected: disc('pick-a'),
                unselected: disc('pick-b'),
                weightDial: false,
            });
        }));

        test('SELECTION DOES NOT THIN THE DISC: 600 selected and resting, as Slate renders it',
            () => mounted(async (page) => {
                /* Parity surface 2's pin, and the reason --_ui-rest-weight exists at all.
                 * The fifth dial (--ui-selected-weight, --ui-weight-medium = 500) is
                 * written into the shared `selectionSurface` fragment, which is (0,1,0)
                 * and goes LAST — so a plain `font-weight: var(--ui-weight-semibold)` on
                 * .disc would LOSE to it and the selected disc would come out LIGHTER
                 * than its resting siblings. That is backwards on any reading, and it is
                 * not what Slate does:
                 *   ORACLE history-shotdata .hv-pick-btn font-weight = 600 on all 42
                 *          records — 40 hollow, 2 painted --slate-selected-face
                 *   ORACLE history-viewer .slate-hv-pick-tag font-weight = 600 on all 6
                 * .disc declares --_ui-rest-weight and paints from it, so the fragment's
                 * fallback never fires here. Moving the dial must move NOTHING. */
                const semibold = await page.resolveValue('var(--ui-weight-semibold)', 'font-weight');
                for (const [selected, resting] of [['tag-a', 'tag-b'], ['pick-a', 'pick-b']]) {
                    assert.equal(await page.prop(disc(selected), 'font-weight'), semibold,
                        `${selected}: the SELECTED disc keeps Slate's 600`);
                    assert.equal(await page.prop(disc(resting), 'font-weight'), semibold,
                        `${resting}: the resting disc is the same 600`);
                }
                const before = await page.prop(disc('tag-a'), 'font-weight');
                await page.setToken('--ui-selected-weight', '800');
                const during = await page.prop(disc('tag-a'), 'font-weight');
                await page.setToken('--ui-selected-weight', null);
                assert.equal(during, before,
                    'the fifth dial reached a disc whose weight is its own resting paint — '
                    + '--_ui-rest-weight is not being read');
            }));

        test('--ui-selected-ink is a dial too: retarget it and the letter moves', () => mounted(async (page) => {
            // assertOneSelectionTreatment proves face, LED and glow by moving them and
            // checks ink by equality. This drills the fourth, so all four are exercised
            // as dials rather than three dials and a constant.
            for (const host of ['tag-a', 'pick-a']) {
                await assertTokenDrill(page, {
                    token: '--ui-selected-ink',
                    value: DRILL_COLOUR,
                    selector: disc(host),
                    property: 'color',
                });
            }
        }));

        test('THE DIFFERENCE IS EXACTLY THE DIALS — nothing else moves on selection', () => mounted(async (page) => {
            for (const [on, off] of [['tag-a', 'tag-b'], ['pick-a', 'pick-b']]) {
                const selected = await page.computed(disc(on), NON_DIAL_PAINT);
                const resting = await page.computed(disc(off), NON_DIAL_PAINT);
                const moved = NON_DIAL_PAINT.filter((p) => selected[p] !== resting[p]);
                assert.deepEqual(
                    moved, [],
                    `${on} vs ${off}: selection changed ${moved.join(', ')}, which the four dials do not paint.\n`
                    + `  selected ${JSON.stringify(Object.fromEntries(moved.map((p) => [p, selected[p]])))}\n`
                    + `  resting  ${JSON.stringify(Object.fromEntries(moved.map((p) => [p, resting[p]])))}\n`
                    + '  SCOPE.md:1576-1578 — #45 "may not own a private selected look". Slate changes the\n'
                    + '  border colour here (slate-live.css:2263, :2514) and that is the fifth painted\n'
                    + '  property this assertion exists to keep out.',
                );
                // …and the two the dials DO paint must have moved, or the assertion above
                // is satisfied by a component with no selected state at all.
                const dials = await page.computed(disc(on), ['background-color', 'color']);
                const dialsOff = await page.computed(disc(off), ['background-color', 'color']);
                assert.notEqual(dials['background-color'], dialsOff['background-color'],
                    'the face dial must actually change something');
                assert.notEqual(dials.color, dialsOff.color, 'the ink dial must actually change something');
            }
        }));

        test('moving --ui-selected-face does not move the hairline (it is not a fifth dial)', () => mounted(async (page) => {
            const before = await page.prop(disc('pick-a'), 'border-top-color');
            await page.setToken('--ui-selected-face', DRILL_COLOUR);
            const during = await page.prop(disc('pick-a'), 'border-top-color');
            await page.setToken('--ui-selected-face', null);
            assert.equal(during, before,
                'the selected disc\'s border followed the face dial, so the border IS part of the '
                + 'selection treatment — which is the private look this wave bans.');
        }));

        test('the hairline survives selection and still reads its own token', () => mounted(async (page) => {
            // DEPARTURE 1, asserted from the other side: Slate dissolves the selected
            // disc's edge into its fill; here the ring is resting paint and stays.
            await assertTokenDrill(page, {
                token: '--ui-line',
                value: DRILL_COLOUR,
                selector: disc('pick-a'),          // the SELECTED one
                property: 'border-top-color',
            });
            await assertTokenDrill(page, {
                token: '--ui-line-strong',
                value: DRILL_COLOUR,
                selector: disc('tag-a'),           // the SELECTED one
                property: 'border-top-color',
            });
        }));

        test('both forms take the SAME selected paint — one treatment, two forms', () => mounted(async (page) => {
            const tag = await page.computed(disc('tag-a'), ['background-color', 'color']);
            const pick = await page.computed(disc('pick-a'), ['background-color', 'color']);
            assert.deepEqual(
                tag, pick,
                'Slate reaches --slate-steel twice, through `.slate-hv-pick-tag[data-slot="a"]` and '
                + '`.hv-pick-btn[aria-pressed="true"]` — two hand-written rules in one screen sheet, '
                + 'which is how six treatments across thirteen implementations started. One fragment here.',
            );
        }));

        /* ================================================================
         * 4. TOKENS ARE CONSUMED, NOT COPIED (Gate A standing assertion 1)
         * ============================================================== */

        test('the resting paint is drilled token by token', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-key', selector: disc('tag-b'), property: 'background-color',
            });
            await assertTokenDrill(page, {
                token: '--ui-line-strong', selector: disc('tag-b'), property: 'border-top-color',
            });
            await assertTokenDrill(page, {
                token: '--ui-text', selector: disc('tag-b'), property: 'color',
            });
            await assertTokenDrill(page, {
                token: '--ui-line', selector: disc('pick-b'), property: 'border-top-color',
            });
            await assertTokenDrill(page, {
                token: '--ui-muted', selector: disc('pick-b'), property: 'color',
            });
        }));

        test('the size is derived from --ui-control-h, not written as 62', () => mounted(async (page) => {
            // --ui-control-inner is calc(--ui-control-h - 2 * --ui-hairline), so moving
            // the SPINE token must move the disc. A file with 62px baked in passes every
            // screenshot and fails this.
            const before = (await page.box('#pick-b')).width;
            await page.setToken('--ui-control-h', '100px');
            const after = (await page.box('#pick-b')).width;
            await page.setToken('--ui-control-h', null);
            const restored = (await page.box('#pick-b')).width;

            near(before, 62, 'the shipped derivation is the oracle\'s 62');
            near(after, 98, '100 - 2 * --ui-hairline');
            near(restored, before, 'and it comes back, so the value was READ not coincidental');
        }));

        /* ================================================================
         * 5. FOCUS — one ring, unclipped (Gate A standing assertion 4, bug L24's class)
         * ============================================================== */

        test('the pressable disc takes the one focus ring, unclipped', () => mounted(async (page) => {
            const g = await assertFocusUnclipped(page, disc('pick-b'));
            // SOURCE slate-live.css:2518-2520 — `.hv-pick-btn:focus-visible { outline:
            // 3px solid var(--slate-steel); outline-offset: 2px; }`. This is the one
            // place in the old skin where the shipped ring IS the one ring, so matching
            // it costs nothing and the base already paints it (CONVENTIONS §3).
            assert.equal(g.outlineOffset, await page.resolveValue('var(--ui-focus-offset)', 'outline-offset'),
                'the outset offset, as slate-live.css:2520 writes it');
        }));

        test('the static tag is not focusable at all', () => mounted(async (page) => {
            const focusable = await page.evalFn((sel) => {
                const el = window.__h.need(sel);
                return el.tagName.toLowerCase() === 'button' || el.hasAttribute('tabindex');
            }, disc('tag-a'));
            assert.equal(focusable, false,
                'the header tag names a slot; it does not assign one, so it is a span and stays '
                + 'out of the tab order');
        }));

        /* ================================================================
         * 6. HIT FLOOR (Appendix 5) — measured, not asserted in a comment.
         *    Bug P4's shape is a floor "the comment claims and the box does not have".
         * ============================================================== */

        test('the ink already clears --ui-hit-min on both axes, with no overlay', () => mounted(async (page) => {
            const r = await assertHitFloor(page, disc('pick-b'), { mode: 'box' });
            assert.ok(r.inline >= r.floor && r.block >= r.floor);
            // And the host, which is what the finger actually meets.
            await assertHitFloor(page, '#pick-b', { mode: 'box' });
            // No .hit-overlay is used, so the utility's ::before must not exist here —
            // an overlay above a control that does not need one is the copy CONVENTIONS
            // §5 exists to prevent.
            const overlay = await page.prop(disc('pick-b'), 'content', { pseudo: '::before' });
            assert.ok(overlay === 'none' || overlay === 'normal',
                `the disc draws no hit overlay (::before content is ${overlay})`);
        }));

        /* ================================================================
         * 7. ARIA — accessibility state and visual state are the same state
         *    (spec Appendix 15; slate-components.css:389-392)
         * ============================================================== */

        test('the pressable disc always carries aria-pressed, true or false', () => mounted(async (page) => {
            const read = (sel, attr) => page.evalFn(
                (s, a) => window.__h.need(s).getAttribute(a), sel, attr,
            );
            assert.equal(await read(disc('pick-a'), 'aria-pressed'), 'true',
                'ORACLE winning rule for the selected pick is `.hv-pick-btn[aria-pressed="true"]`');
            assert.equal(await read(disc('pick-b'), 'aria-pressed'), 'false',
                'a toggle button with no aria-pressed announces as a plain button');
        }));

        test('the static tag says aria-current when it is the picked slot, and nothing when not', () => mounted(async (page) => {
            const read = (sel) => page.evalFn((s) => window.__h.need(s).getAttribute('aria-current'), sel);
            assert.equal(await read(disc('tag-a')), 'true',
                'slate-live.css:2256-2258 — "A is the shot on the charts, B the one it is measured '
                + 'against", which is what aria-current means');
            assert.equal(await read(disc('tag-b')), null, 'and B is simply not current');
        }));

        test('a label becomes the accessible name and the letter goes aria-hidden', () => mounted(async (page) => {
            const named = await page.evalFn((sel) => {
                const el = window.__h.need(sel);
                const root = el.getRootNode();
                return {
                    a11y: root.getElementById('a11y')?.textContent ?? null,
                    hidden: root.getElementById('glyph')?.getAttribute('aria-hidden') ?? null,
                };
            }, disc('pick-a'));
            assert.deepEqual(named, { a11y: 'Compare slot A', hidden: 'true' },
                'a screen reader in a 21-row list must hear "Compare slot A", not "A"');

            const bare = await page.evalFn((sel) => {
                const root = window.__h.need(sel).getRootNode();
                return {
                    a11y: root.getElementById('a11y'),
                    hidden: root.getElementById('glyph')?.getAttribute('aria-hidden') ?? null,
                };
            }, disc('plain'));
            assert.deepEqual(bare, { a11y: null, hidden: null },
                'with no label the letter IS the name, and nothing hides it');
        }));

        test('the visually-hidden label is the ONE treatment, still in the tree', () => mounted(async (page) => {
            const got = await page.computed(`#pick-a >>> #a11y`, ['position', 'clip-path', 'display', 'visibility']);
            assert.equal(got.display !== 'none' && got.visibility !== 'hidden', true,
                'CONVENTIONS §5a: never display:none / visibility:hidden / width:0 — all three take '
                + 'the text out of the accessibility tree, which is the one thing it must not do');
            assert.match(got['clip-path'], /inset\(50%\)/, 'the shared visuallyHidden fragment, not a fourth copy');
        }));

        /* ================================================================
         * 8. EVENTS — and the state this component deliberately does not own
         * ============================================================== */

        test('a press asks to be picked and changes nothing by itself', () => mounted(async (page) => {
            await page.recordEvents('#pick-b', ['pick']);
            await page.click(disc('pick-b'));
            await page.settle(2);

            const events = await page.recordedEvents();
            assert.equal(events.length, 1, 'exactly one pick per press');

            const state = await page.evalFn(() => {
                const el = document.getElementById('pick-b');
                return { selected: el.selected, aria: el.renderRoot.getElementById('disc').getAttribute('aria-pressed') };
            });
            assert.deepEqual(state, { selected: false, aria: 'false' },
                'the disc does NOT self-toggle. slate-live.css:2498-2499 — "Pressed means this row '
                + 'is that slot" — and assigning slot A to row 5 must clear it from row 3, which a '
                + 'lone disc cannot know. A self-toggling disc renders two rows as slot A.');
        }));

        test('the pick event carries the state being asked for, not the state held', () => mounted(async (page) => {
            const detail = await page.evalFn(() => new Promise((resolve) => {
                const el = document.getElementById('pick-a');   // already selected
                el.addEventListener('pick', (e) => resolve(JSON.stringify(e.detail)), { once: true });
                el.renderRoot.getElementById('disc').click();
            }));
            assert.deepEqual(JSON.parse(detail), { selected: false, label: 'Compare slot A' },
                'pressing a picked disc asks to clear the slot — Slate\'s "tapping a pressed one '
                + 'clears the slot"');
        }));

        test('a static tag is inert and a disabled disc refuses the press', () => mounted(async (page) => {
            await page.recordEvents('#tag-a', ['pick']);
            await page.click(disc('tag-a'));
            await page.settle(2);
            assert.deepEqual(await page.recordedEvents(), [], 'the header tag is a label, not a control');

            await page.recordEvents('#dis', ['pick']);
            await page.click(disc('dis'));
            await page.settle(2);
            assert.deepEqual(await page.recordedEvents(), [], 'disabled refuses input, not just paint');
        }));

        test('disabled takes the one dial on the host and says so', () => mounted(async (page) => {
            assert.equal(await page.prop('#dis', 'opacity'),
                await page.resolveToken('--ui-opacity-disabled', 'opacity'),
                'the base\'s single disabled dial, .38 (spec §3.7)');
            assert.equal(
                await page.evalFn(() => document.getElementById('dis').getAttribute('aria-disabled')),
                'true',
                'both spellings, so the base reaches it whichever way a consumer wrote it',
            );
            assert.equal(
                await page.evalFn(() => document.getElementById('dis').renderRoot.getElementById('disc').disabled),
                true,
                'the native attribute is what actually refuses the input; the host attribute dims',
            );
        }));

        /* ================================================================
         * 9. CONTAINER FLOOR — the component reads its own box, never the viewport,
         *    and ergonomics is physical (CONVENTIONS §2, §11)
         * ============================================================== */

        test('a container narrower than the pair does not shrink either disc', () => mounted(async (page) => {
            // A shot-list row's pick cell, squeezed to less than one disc. The default
            // flex-shrink is 1, which is bug T9's shape ("it is a flex item with default
            // shrink. Measured 214 in one leaf and 250 two rows below, inside a single
            // screen"); flex: none on the host is the one-declaration answer.
            const floor = parseFloat(await page.resolveValue('var(--ui-hit-min)', 'width'));
            for (const host of ['pick-a', 'pick-b']) {
                const box = await page.box(`#${host}`);
                near(box.width, 62,
                    '--ui-hit-min is physical — "a wet fingertip is about 9 mm; at this panel\'s '
                    + 'density that is ~48px" — so the disc overflows a cramped row rather than '
                    + 'shrinking under the thumb');
                assert.ok(box.width >= floor && box.height >= floor,
                    `#${host} fell through the hit floor when its container was squeezed`);
            }
            // The row really is too small for them, or the assertion is vacuous.
            const row = await page.box('#row');
            assert.ok(row.width < 124, `the squeeze must bite: the row is ${row.width}px for two 62px discs`);
        }, CRAMPED));

        test('the disc reads no container query and declares no width media query', () => mounted(async (page) => {
            const bad = await page.evalFn(() => {
                const sheets = document.getElementById('pick-b').shadowRoot.adoptedStyleSheets || [];
                const hits = [];
                const walk = (rules) => {
                    for (const rule of rules) {
                        if (rule.media && /width|height|device/.test(rule.conditionText ?? '')) {
                            hits.push('@media ' + rule.conditionText);
                        }
                        if (rule.cssRules) walk(rule.cssRules);
                    }
                };
                for (const sheet of sheets) walk(sheet.cssRules);
                return hits;
            });
            assert.deepEqual(bad, [], 'no component writes @media (width…) — spec §2.1 Rule 1');
            assert.equal(await page.prop('#pick-b', 'container-type'), 'normal',
                'CONVENTIONS §2\'s one-line opt-out: a fixed-size leaf pays for no containment');
        }));

        /* ================================================================
         * 10. ZERO !IMPORTANT (spec §2.1 Rule 3)
         * ============================================================== */

        test('the component paints with no !important anywhere in its own sheet', () => mounted(async (page) => {
            const bad = await page.evalFn(() => {
                const sheets = document.getElementById('pick-a').shadowRoot.adoptedStyleSheets || [];
                const hits = [];
                const walk = (rules) => {
                    for (const rule of rules) {
                        if (rule.cssRules) { walk(rule.cssRules); continue; }
                        const s = rule.style;
                        if (!s) continue;
                        for (let i = 0; i < s.length; i++) {
                            if (s.getPropertyPriority(s[i]) === 'important') hits.push(rule.selectorText + ' { ' + s[i] + ' }');
                        }
                    }
                };
                for (const sheet of sheets) walk(sheet.cssRules);
                return hits;
            });
            assert.deepEqual(bad, [], 'zero !important, base rules included (spec §2.1 Rule 3)');
        }));
    });
}

/* ---------------------------------------------------------------------------
 * The gallery entry, exercised here rather than at the gate.
 *
 * tools/gallery/entries.js is a SHARED single-array file and twelve parallel
 * builders doing whole-file writes on it would clobber each other, so this entry
 * lives in its own file and the gate wires it in. That hand-off is the moment a
 * malformed entry would first be noticed — unless it is checked here, where the
 * builder can still fix it.
 * ------------------------------------------------------------------------- */

test('the gallery entry is the documented shape', () => {
    assert.equal(galleryEntry.id, 'ui-pick-disc', 'the entry id is the tag name and the capture prefix');
    assert.equal(galleryEntry.module, '../../src/components/ui-pick-disc.js', 'module is relative to tools/gallery/');
    assert.ok(galleryEntry.title && galleryEntry.notes);
    assert.ok(galleryEntry.states.length >= 1);
    const ids = galleryEntry.states.map((s) => s.id);
    assert.equal(new Set(ids).size, ids.length, 'state ids are capture filenames, so they must be unique');
    for (const s of galleryEntry.states) {
        assert.match(s.id, /^[a-z0-9-]+$/, `state id ${s.id} must be a kebab-case identifier, not a label`);
        assert.ok(s.title && s.html, `state ${s.id} needs a title and markup`);
    }
});

test('every gallery state mounts and renders a disc at the token size', async () => {
    await browser.withPage({ geometry: BENCH }, async (page) => {
        for (const state of galleryEntry.states) {
            await page.mount(state.html, MODULE);
            assert.deepEqual(page.pageErrors, [], `gallery state ui-pick-disc--${state.id} threw`);
            assert.ok(await page.count('ui-pick-disc') >= 1,
                `gallery state ui-pick-disc--${state.id} mounted nothing`);
            const box = await page.box('ui-pick-disc');
            near(box.width, 62, `ui-pick-disc--${state.id} is off-geometry`);
            near(box.height, 62, `ui-pick-disc--${state.id} is off-geometry`);
        }
    });
});

test('the dials-radian gallery state really moves the LED and the glow', async () => {
    // The state that IS the claim: four values, zero rule changes. Asserted rather
    // than photographed, because a screenshot of a 0px LED and a 4px LED taken on
    // different days is not evidence of anything.
    await browser.withPage({ geometry: BENCH }, async (page) => {
        await page.mount(PICK_A, MODULE);
        const off = await page.computed(disc('pick-a'), ['box-shadow', 'text-shadow']);
        await page.setToken('--ui-selected-led', '4px');
        await page.setToken('--ui-selected-glow', '55%');
        const on = await page.computed(disc('pick-a'), ['box-shadow', 'text-shadow']);
        await page.setToken('--ui-selected-led', null);
        await page.setToken('--ui-selected-glow', null);

        assert.notEqual(on['box-shadow'], off['box-shadow'], 'the LED dial moved nothing');
        assert.match(on['box-shadow'], /-4px/, 'the LED strip carries the dial\'s length');
        assert.notEqual(on['text-shadow'], off['text-shadow'], 'the glow dial moved nothing');
    });
});

/* ---------------------------------------------------------------------------
 * Cross-geometry: the disc is a token, not a fraction of the viewport.
 * ------------------------------------------------------------------------- */

test('the disc renders identically at the bench and at the floor', async () => {
    const read = (geometry) => browser.withPage({ geometry }, async (page) => {
        await page.mount(MARKUP, MODULE);
        const tag = await page.box('#tag-a');
        const pick = await page.box('#pick-b');
        return {
            dpr: await page.eval('devicePixelRatio'),
            tag: [tag.width, tag.height],
            pick: [pick.width, pick.height],
            fontSize: await page.prop(disc('pick-b'), 'font-size'),
        };
    });

    const bench = await read(BENCH);
    const floor = await read(FLOOR);

    assert.equal(bench.dpr, 1.5);
    assert.equal(floor.dpr, 1);
    assert.deepEqual(
        [bench.tag, bench.pick, bench.fontSize],
        [floor.tag, floor.pick, floor.fontSize],
        'no viewport reading anywhere: 1281×801 @ 1.5 and 1000×600 @ 1 give the same disc. The '
        + '(height < 700px) band moves --ui-density, and density multiplies vertical rhythm only '
        + '— never --ui-control-h or --ui-hit-min, because ergonomics is physical (CONVENTIONS §11).',
    );
    assert.deepEqual(bench.tag, [62, 62], 'and both are the oracle\'s 62 x 62, measured on 48 elements');
});
