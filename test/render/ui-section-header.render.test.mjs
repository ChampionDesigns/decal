/**
 * ui-section-header.render.test.mjs — Gate A for component #27 (wave 2, item #27).
 *
 * Runs at BOTH standard geometries — 1281×801 @ dsf 1.5 (the bench truth) and the
 * 1000×600 floor — asserting only on computed style, box geometry and behaviour,
 * never on source text (Part 8 §2).
 *
 * THE STANDING CLASSES, and where each lives below:
 *   1. token drill — ten tokens, each retargeted on :root with the rendered value
 *      asserted to move, to land on the token, and to move back. This is also bug
 *      L12's class: a component holding a private copy of the public palette would
 *      paint identically and NOT move.
 *   2. THE WAVE-2 LAW, inverted. This component has no selection state, so the dial
 *      drill is run as a NEGATIVE: all four dials are retargeted and every rendered
 *      value must stay put, and every selection spelling — [selected], .is-selected
 *      (set INSIDE the shadow root, which is the only place it could hide),
 *      aria-pressed / -selected / -checked / -current — must paint nothing. Wave 2 is
 *      where a seventh selection treatment becomes inexpressible (spec §3.9, Part 10
 *      §12); a caption participates by being provably inert.
 *   3. focus geometry from --ui-focus-*, unclipped, in both offsets (bug L24's class).
 *      The band takes no focus itself — the focusable is whatever the consumer slots
 *      into `trail`, which is exactly the ::slotted hole review finding cross-3
 *      measured.
 *   4. container behaviour at both geometries: the band is one line at every width,
 *      the caption ellipsises rather than escaping, the count never gives up a pixel,
 *      and the band cannot be compressed below --ui-section-head-h.
 *   5. THE STICK, which is the whole point of the component: it stays at the top of
 *      its scrollport while its group scrolls under it, it is opaque, and it wins the
 *      stack against the rows (elementFromPoint, not a screenshot).
 *   6. bugs asserted dead. ROW #27 CITES NONE, and that is a checked fact: grepping
 *      LAYOUT_SPEC_DRAFT.md §7 for "section header" / "sticky" returns the
 *      --ui-z-sticky token row (:425), two component lists (:614, :627) and the §5.2
 *      inventory row (:898) — no bug. Four defect CLASSES are still pinned, because
 *      this component is shaped exactly like their victims:
 *        · CONVENTIONS §13 — "a divider is a gap, not a border"; Slate ships the
 *          anti-pattern 55 times and the oracle records one of them on this very
 *          element ([i=31] border-top-width 1px). This component must never grow #56.
 *        · the sticky-transparency class — a caption with a see-through ground is
 *          unreadable one row into a scroll. Slate's own fix is quoted in the source.
 *        · P8's class — a sheet from OUTSIDE reaching in and flattening the paint.
 *        · L12's class — a private palette shadowing the public one (the drills).
 *   7. aria. Row #27 cites no Appendix 15 rule and that is correct — Appendix 15 is
 *      the aria-*-driven STATE selector contract and this component has no state a
 *      user can change. What is asserted is the contract it does define: a real
 *      heading, a movable level, the count as a SIBLING of the heading so the
 *      accessible name is the caption alone, and text-transform as paint.
 *   8. hit-area floor: NOT cited by the row and deliberately not consumed. The band
 *      clears --ui-hit-min anyway at 60px, and it accepts no press — asserted, with
 *      the reason.
 *
 * ORACLE VALUES ARE ASSERTED LITERALLY where the serialisation is stable, because
 * "measured from the oracle" should be checkable rather than claimed. Every literal
 * carries its CITE line. The six DEPARTURES are asserted AS departures, with both
 * numbers named, so a silent drift back to Slate's value is a red test too.
 *
 * ONE CLASS THIS SUITE HAD TO BE TAUGHT (fix-phase finding c2-1): every value here was
 * read one element at a time, so sixty green tests said nothing about whether the two
 * elements were on the same line. They were not — the <h2> caption carried the UA
 * margin-block that `.ui-microcap` deliberately does not zero (TYPE_ROLES.md rule 5),
 * and sat 12.44px above the count in a band whose own quoted reason is that the labels
 * are bottom-anchored. The two DEPARTURE 6 tests below assert the RELATIONSHIP, against
 * the oracle's own rects, and are the shape to copy the next time a component's reason
 * is about two boxes rather than one.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';
import {
    assertTokenDrill,
    assertFocusUnclipped,
    assertScrollFloor,
    DRILL_COLOUR,
} from '../harness/assertions.js';

const MODULE = ['/src/components/ui-section-header.js'];

/** Twelve 64px rows, six per group — enough that a 240px port scrolls hard. */
const rows = (prefix, n) => Array.from({ length: n }, (_, i) =>
    `<div class="row" id="${prefix}-${i}" style="block-size: 64px; padding: 0 24px;`
    + ` display: flex; align-items: center">Profile ${prefix}${i}</div>`).join('');

const MARKUP = `
<div id="list" style="inline-size: 420px; block-size: 240px; overflow: auto">
    <ui-section-header id="hdr-a" count="6" count-label="6 profiles">Your Profiles</ui-section-header>
    ${rows('a', 6)}
    <ui-section-header id="hdr-b" count="72">Built-In Profiles</ui-section-header>
    ${rows('b', 6)}
</div>

<div id="plain" style="inline-size: 420px">
    <ui-section-header id="hdr-plain" count="6">Your Profiles<button id="trail-btn" slot="trail">Edit</button></ui-section-header>
</div>

<div id="narrow" style="inline-size: 260px">
    <ui-section-header id="hdr-narrow" count="128">A section caption far too long to fit in this band</ui-section-header>
</div>

<div id="clip" style="inline-size: 420px; overflow: hidden">
    <ui-section-header id="hdr-inset" focus-ring="inset">Clipped<button id="inset-btn" slot="trail">Edit</button></ui-section-header>
</div>

<div id="squeeze" style="inline-size: 420px; block-size: 40px; display: flex; flex-direction: column">
    <ui-section-header id="hdr-squeezed">Squeezed</ui-section-header>
</div>

<div id="variants" style="inline-size: 420px">
    <ui-section-header id="hdr-l3" level="3">Level three</ui-section-header>
    <ui-section-header id="hdr-bogus" level="9">Bogus level</ui-section-header>
    <ui-section-header id="hdr-zero" count="0">Zero is a count</ui-section-header>
    <ui-section-header id="hdr-nocount">No count at all</ui-section-header>
</div>
`;

/* The oracle's own numbers, named once so the code that asserts them is readable.
 *   CITE profile-selector .slate-section-header [i=14] background-color: dark
 *        rgb(14, 19, 23) / light rgb(242, 243, 243)  <-  slate-shell.css
 *        `#subpage-host #profile-list [data-profile-section]`  authored
 *        `(NOT CAPTURED — set via a CSS shorthand)`  !important=no  (token-driven)
 *   CITE profile-selector .slate-section-header [i=14] height = 60px, min-height = 60px
 *   CITE profile-selector .slate-section-header [i=14] padding-left = 24px, gap = 12px
 *   CITE profile-selector .slate-section-header [i=14] border-top-width = 0px,
 *        box-shadow = none, opacity = 1
 *   CITE profile-selector .slate-section-header [i=31] border-top-width = 1px,
 *        border-top-color: dark rgb(58, 72, 82) / light rgb(203, 208, 211)
 *   CITE profile-selector .slate-microcap [i=16] color: dark rgb(148, 161, 169)
 *        / light rgb(90, 101, 108)  <-  slate-components.css `.slate-microcap`
 *        authored `var(--slate-muted)`  !important=yes  (token-driven)
 *   CITE profile-selector .slate-microcap [i=16] font-size = 15px, font-weight = 600,
 *        letter-spacing = 1.8px, text-transform = uppercase, height = 18px
 */
const ORACLE = {
    dark: { ground: 'rgb(14, 19, 23)', ink: 'rgb(148, 161, 169)' },
    light: { ground: 'rgb(242, 243, 243)', ink: 'rgb(90, 101, 108)' },
    /* Theme-independent, from the same two records. */
    bandHeight: 60,
    padInline: '24px',
    padBottom: '8px',
    gap: '12px',
    fontSize: '15px',
    transform: 'uppercase',
    edge: '0px',
    shadow: 'none',
    opacity: '1',
    /* The values this build deliberately does NOT reproduce — see DEPARTURES. */
    slateSemibold: '600',
    slateTracking: '1.8px',
    slateZIndex: '2',
    slateSecondHeaderEdge: '1px',
};

/** Filled in by each geometry block, compared once at the end. */
const acrossGeometries = {};

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`ui-section-header @ ${geometry.name} (${geometry.width}×${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

        const mounted = (fn) => browser.withPage({ geometry }, async (page) => {
            await page.mount(MARKUP, MODULE);
            assert.deepEqual(page.pageErrors, [], 'ui-section-header must mount without throwing');
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

        /* -- 1. tokens are consumed, not copied ----------------------------- */

        test('drill: --ui-section-head-h is the band height, on the HOST', () => mounted(async (page) => {
            // The host is the sticky box, so the height has to be the host's or the
            // stuck band would be a different size from the one in flow.
            await assertTokenDrill(page, {
                token: '--ui-section-head-h',
                value: '37px',
                selector: '#hdr-plain',
                property: 'height',
            });
            // …and the band inside it follows, because it is block-size: 100%.
            await assertTokenDrill(page, {
                token: '--ui-section-head-h',
                value: '37px',
                selector: '#hdr-plain >>> #band',
                property: 'height',
            });
        }));

        test('drill: --ui-fascia is the ground (L12\'s class)', () => mounted(async (page) => {
            // A component carrying its own copy of the palette would paint the same
            // colour and NOT move — which is bug L12 exactly (Live re-declares the
            // public palette three times under private names).
            await assertTokenDrill(page, {
                token: '--ui-fascia',
                value: DRILL_COLOUR,
                selector: '#hdr-plain >>> #band',
                property: 'background-color',
            });
        }));

        test('drill: --ui-space-5 / --ui-space-2 / --ui-space-3 are the band inset and gap', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-space-5',
                value: '37px',
                selector: '#hdr-plain >>> #band',
                property: 'padding-left',
            });
            await assertTokenDrill(page, {
                token: '--ui-space-2',
                value: '37px',
                selector: '#hdr-plain >>> #band',
                property: 'padding-bottom',
            });
            await assertTokenDrill(page, {
                token: '--ui-space-3',
                value: '37px',
                selector: '#hdr-plain >>> #band',
                property: 'column-gap',
            });
        }));

        test('drill: --ui-z-sticky is the layer', () => mounted(async (page) => {
            // DEPARTURE 2's mechanism. z-index is outside the corpus's 18-property
            // surface, so the spec settles it (LAYOUT_SPEC_DRAFT.md:425) and the value
            // is read from the token rather than written as Slate's literal 2.
            await assertTokenDrill(page, {
                token: '--ui-z-sticky',
                value: '37',
                selector: '#hdr-plain',
                property: 'z-index',
                expected: '37',
            });
        }));

        test('drill: the type is the SHARED role — --ui-muted, --ui-text-sm, --ui-weight-semibold, --ui-tracking-cap', () => mounted(async (page) => {
            // Four tokens, drilled on BOTH the caption and the count, because a
            // per-element literal would pass one and fail the other. This is what
            // "the count has no second ink to drift" means as a rendered fact:
            // Slate declared .slate-section-count { color: var(--slate-muted) } a
            // second time; here the role carries it once.
            for (const part of ['#caption', '#count']) {
                await assertTokenDrill(page, {
                    token: '--ui-muted',
                    value: DRILL_COLOUR,
                    selector: `#hdr-plain >>> ${part}`,
                    property: 'color',
                });
                await assertTokenDrill(page, {
                    token: '--ui-text-sm',
                    value: '31px',
                    selector: `#hdr-plain >>> ${part}`,
                    property: 'font-size',
                });
                await assertTokenDrill(page, {
                    token: '--ui-weight-semibold',
                    value: '300',
                    selector: `#hdr-plain >>> ${part}`,
                    property: 'font-weight',
                });
                await assertTokenDrill(page, {
                    token: '--ui-tracking-cap',
                    value: '5px',
                    selector: `#hdr-plain >>> ${part}`,
                    property: 'letter-spacing',
                });
            }
        }));

        /* -- the measured starting values, both themes ---------------------- */

        test('the resting paint is the oracle\'s measured values, in both themes', () => mounted(async (page) => {
            for (const theme of ['dark', 'light']) {
                await page.setTheme(theme);
                const want = ORACLE[theme];

                const band = await page.computed('#hdr-plain >>> #band',
                    ['background-color', 'opacity', 'border-top-width', 'box-shadow']);
                assert.equal(band['background-color'], want.ground,
                    `${theme}: --ui-fascia — CITE .slate-section-header [i=14] background-color`);
                assert.equal(band.opacity, ORACLE.opacity, `${theme}: opacity = 1`);
                assert.equal(band['box-shadow'], ORACLE.shadow, `${theme}: box-shadow = none`);
                assert.equal(band['border-top-width'], ORACLE.edge,
                    `${theme}: DEPARTURE 3 — no border, ever (CONVENTIONS §13)`);

                for (const part of ['#caption', '#count']) {
                    const type = await page.computed(`#hdr-plain >>> ${part}`,
                        ['color', 'font-size', 'text-transform']);
                    assert.equal(type.color, want.ink,
                        `${theme}: --ui-muted — CITE .slate-microcap [i=16] color`);
                    assert.equal(type['font-size'], ORACLE.fontSize,
                        `${theme}: CITE .slate-microcap [i=16] font-size = 15px`);
                    assert.equal(type['text-transform'], ORACLE.transform,
                        `${theme}: CITE .slate-microcap [i=16] text-transform = uppercase`);
                }
            }
            await page.setTheme('dark');
        }));

        test('the theme-independent half of the record is carried exactly', () => mounted(async (page) => {
            const host = await page.computed('#hdr-plain', ['height', 'min-height', 'position']);
            assert.equal(host.height, `${ORACLE.bandHeight}px`,
                'CITE .slate-section-header [i=14] height = 60px  (= --ui-section-head-h)');
            assert.equal(host['min-height'], `${ORACLE.bandHeight}px`,
                'CITE .slate-section-header [i=14] min-height = 60px — restated as Slate restated it');
            assert.equal(host.position, 'sticky',
                'slate-shell.css:2044-2049, read read-only: position never entered the corpus');

            const band = await page.computed('#hdr-plain >>> #band',
                ['padding-left', 'padding-right', 'padding-bottom', 'padding-top', 'column-gap', 'align-items']);
            assert.equal(band['padding-left'], ORACLE.padInline,
                'CITE .slate-section-header [i=14] padding-left = 24px  (= --ui-space-5)');
            assert.equal(band['padding-right'], ORACLE.padInline, 'the inset is symmetric');
            assert.equal(band['padding-bottom'], ORACLE.padBottom,
                'slate-shell.css:2083 padding: 0 24px var(--slate-space-2)');
            assert.equal(band['padding-top'], '0px',
                'O11: "the only real defect was 12px of extra top padding on the first header"');
            assert.equal(band['column-gap'], ORACLE.gap,
                'CITE .slate-section-header [i=14] gap = 12px  (= --ui-space-3)');
            assert.equal(band['align-items'], 'flex-end',
                'O11: "the labels are deliberately bottom-anchored above their divider, '
                + 'so they are NOT centred"');
        }));

        test('DEPARTURE 1 IS CLOSED: the microcap weight and tracking are both Slate\'s', () => mounted(async (page) => {
            const type = await page.computed('#hdr-plain >>> #caption', ['font-weight', 'letter-spacing']);

            /* THE WEIGHT HALF WENT AT PARITY SURFACE 1, for the same reason the tracking
             * half went at surface 0: LAYOUT_SPEC_DRAFT §3.5's three-weight line cites
             * slate-tokens.css:148-153, and those lines declare four weights including
             * --slate-weight-semibold: 600. The corpus renders 600 on 496 elements. */
            assert.equal(type['font-weight'], ORACLE.slateSemibold,
                'Slate measured 600 and the microcap role now renders it');
            assert.equal(type['font-weight'], await page.resolveToken('--ui-weight-semibold', 'font-weight'),
                'so a microcap here is --ui-weight-semibold (600)');

            /* THE TRACKING HALF OF THIS DEPARTURE IS GONE — parity surface 0. It rested
             * on LAYOUT_SPEC_DRAFT §3.5, which writes ".04em" while citing the
             * slate-tokens.css lines that declare .12em, so its own citation refutes it.
             * Slate's measured 1.8px stands and the token now carries it. */
            assert.equal(type['letter-spacing'], ORACLE.slateTracking,
                'Slate measured 1.8px (.12em at 15px) and --ui-tracking-cap is now .12em');
            assert.equal(Math.round(parseFloat(type['letter-spacing']) * 100) / 100, 1.8,
                '.12em at 15px is 1.8px — restored on ~43 elements');
        }));

        test('DEPARTURE 2: the layer is --ui-z-sticky, not Slate\'s literal 2', () => mounted(async (page) => {
            const z = await page.prop('#hdr-plain', 'z-index');
            assert.notEqual(z, ORACLE.slateZIndex, 'slate-shell.css:2046 wrote z-index: 2');
            assert.equal(z, await page.tokenValue('--ui-z-sticky'),
                'LAYOUT_SPEC_DRAFT.md:425 declares the layer; :435 states the rule it serves');
            assert.equal(z, '10');
        }));

        test('DEPARTURE 3: no border on ANY header, first or later (CONVENTIONS §13)', () => mounted(async (page) => {
            // The oracle records 0px on the FIRST header and 1px --ui-line on the
            // SECOND, because the declaration is the LIST's `> * + *` rule
            // (slate-shell.css:270-273) and not the header's. A component that painted
            // its own top border would be the 56th copy of the anti-pattern AND wrong
            // on the first header of every list.
            for (const id of ['hdr-a', 'hdr-b']) {
                const edges = await page.computed(`#${id} >>> #band`,
                    ['border-top-width', 'border-bottom-width', 'border-left-width', 'border-right-width']);
                assert.deepEqual(edges, {
                    'border-top-width': '0px',
                    'border-bottom-width': '0px',
                    'border-left-width': '0px',
                    'border-right-width': '0px',
                }, `${id} draws an edge — a divider is a gap, not a border`);
                assert.equal(await page.prop(`#${id}`, 'border-top-width'), '0px',
                    'and not on the host either, where a list could not reach past it');
            }
            assert.notEqual(ORACLE.slateSecondHeaderEdge, '0px',
                'for the record: Slate\'s second header DID carry 1px — the divider changed '
                + 'owner, it did not disappear (the list is .seam-grid .seam-rows .seam-line)');
        }));

        test('DEPARTURE 6: the caption is a heading, and the box a heading brings is zeroed', () => mounted(async (page) => {
            // Slate's caption is a SPAN (profile_selector.js:743-753 builds the band as
            // exactly two microcap spans). This one is an <h2> — TYPE_ROLES.md rule 2,
            // "a heading is structure, and a screen reader reads <h2>, not .ui-heading".
            // A UA <h2> is a block with margin-block: 0.83em, and .ui-microcap is an
            // inline modifier that touches no box property BY DECISION (TYPE_ROLES.md
            // rule 5: "`.ui-numeric` and `.ui-microcap` are inline modifiers and touch
            // no box property"), so the role does NOT clean up after the swap — the
            // component does. Measured before the reset existed: 12.45px top and bottom.
            for (const id of ['hdr-a', 'hdr-plain', 'hdr-narrow', 'hdr-nocount']) {
                const m = await page.computed(`#${id} >>> #caption`, ['margin-top', 'margin-bottom']);
                assert.deepEqual(m, { 'margin-top': '0px', 'margin-bottom': '0px' },
                    `${id}: the <h2> kept its UA margin — the swap from Slate's span imports `
                    + '12.45px at the role\'s 15px, and align-items: flex-end aligns the MARGIN box');
            }
            // The role is still innocent: the same class on a SPAN carries no box, which
            // is why the reset belongs here and not in type-roles.js.
            assert.equal(await page.prop('#hdr-a >>> #count', 'margin-top'), '0px',
                'the count is a span and never had a margin to zero');
        }));

        test('DEPARTURE 6: caption and count share ONE line — the band is bottom-anchored, all of it', () => mounted(async (page) => {
            // slate-shell.css:2072-2074, quoted by the component: "the labels are
            // deliberately bottom-anchored above their divider, so they are NOT centred."
            // The oracle is unambiguous that this means BOTH labels:
            //   CITE profile-selector .slate-microcap [i=16] rect x=24 y=351 w=140 h=18
            //        (caption) and rect x=604 y=351 w=11 h=18 (count "6")
            //   CITE profile-selector .slate-microcap [i=33] rect x=24 y=667 w=168 h=18
            //        and rect x=594 y=667 w=21 h=18 (second band, count "72")
            // One y and one height per band, both times. Sixty passing tests never
            // compared the two boxes to each other, and the delta was 12.44px.
            for (const id of ['hdr-a', 'hdr-b', 'hdr-plain', 'hdr-narrow']) {
                const caption = await page.box(`#${id} >>> #caption`);
                const count = await page.box(`#${id} >>> #count`);
                const band = await page.box(`#${id} >>> #band`);
                assert.ok(Math.abs(caption.bottom - count.bottom) < 0.51,
                    `${id}: caption bottom ${caption.bottom} against count bottom ${count.bottom} `
                    + '— the oracle records the two sharing one y and one height');
                assert.ok(Math.abs(caption.top - count.top) < 0.51,
                    `${id}: the two microcaps have the same height, so one baseline means one top `
                    + `(${caption.top} vs ${count.top})`);
                // …and the line they share is the one the padding puts them on: the
                // band's content bottom, --ui-space-2 up from the band's edge.
                const pad = parseFloat(await page.prop(`#${id} >>> #band`, 'padding-bottom'));
                assert.ok(Math.abs(count.bottom - (band.bottom - pad)) < 0.51,
                    `${id}: bottom-anchored means the padding edge, not a coincidence `
                    + `(${count.bottom} vs ${band.bottom - pad})`);
            }
        }));

        /* -- 2. THE WAVE-2 LAW, inverted ------------------------------------ */

        const SELECTION_READS = ['background-color', 'color', 'box-shadow', 'text-shadow', 'font-weight'];
        const SELECTION_PARTS = ['#band', '#caption', '#count'];

        const readSelectionSurface = async (page) => {
            const out = {};
            for (const part of SELECTION_PARTS) {
                out[part] = await page.computed(`#hdr-plain >>> ${part}`, SELECTION_READS);
            }
            out.host = await page.computed('#hdr-plain', SELECTION_READS);
            return out;
        };

        test('the four dials reach NOTHING here — there is no selection surface to move', () => mounted(async (page) => {
            // The wave's founding law (Part 10 §12, spec §3.9): one selection
            // treatment, through the four dials, enforced by the shadow boundary. A
            // component with no selection state proves its half by being inert: if any
            // dial moved anything here, this element would be quietly participating in
            // a treatment it has no business having.
            const before = await readSelectionSurface(page);
            for (const dial of ['--ui-selected-face', '--ui-selected-ink',
                '--ui-selected-led', '--ui-selected-glow']) {
                const value = dial === '--ui-selected-led' ? '37px'
                    : dial === '--ui-selected-glow' ? '60%' : DRILL_COLOUR;
                await page.setToken(dial, value);
                const during = await readSelectionSurface(page);
                await page.setToken(dial, null);
                assert.deepEqual(during, before,
                    `${dial} moved something on a component that has no selected state.\n`
                    + '  A caption is not selectable; the dials must not reach it.');
            }
        }));

        test('every selection spelling paints nothing — including one set INSIDE the shadow root', () => mounted(async (page) => {
            const before = await readSelectionSurface(page);

            for (const [name, value] of [
                ['selected', ''],
                ['aria-selected', 'true'],
                ['aria-pressed', 'true'],
                ['aria-checked', 'true'],
                ['aria-current', 'true'],
            ]) {
                await page.evalFn((n, v) => {
                    document.getElementById('hdr-plain').setAttribute(n, v);
                    return true;
                }, name, value);
                const during = await readSelectionSurface(page);
                await page.evalFn((n) => {
                    document.getElementById('hdr-plain').removeAttribute(n);
                    return true;
                }, name);
                assert.deepEqual(during, before,
                    `[${name}] on the host painted a selected look. There is exactly ONE `
                    + 'selection treatment in Decal and this component is not it.');
            }

            // The sharpest form: .is-selected set on the elements INSIDE the root, which
            // is where a private treatment would hide. `selectionSurface` matches that
            // class; a sheet that imported it would light up here.
            const inside = await page.evalFn(() => {
                const root = document.getElementById('hdr-plain').shadowRoot;
                for (const id of ['band', 'caption', 'count']) {
                    root.getElementById(id).classList.add('is-selected');
                    root.getElementById(id).setAttribute('aria-current', 'true');
                }
                return true;
            });
            assert.ok(inside);
            const withInside = await readSelectionSurface(page);
            assert.deepEqual(withInside, before,
                '.is-selected / aria-current inside the shadow root painted something — '
                + 'selectionSurface must not be in this component\'s styles at all');
        }));

        /* -- 3. focus geometry, unclipped (bug L24's class) ------------------ */

        test('a control slotted into `trail` gets the ONE ring, unclipped', () => mounted(async (page) => {
            // Review finding cross-3: a bare <button> slotted into a wave-1 element took
            // Chrome's own outline: auto — a SIXTH treatment inside the layer that exists
            // to end the five. The base's ::slotted rule is what closes it; this asserts
            // the hole stays closed for the one slot this component exposes.
            const g = await assertFocusUnclipped(page, '#trail-btn');
            assert.equal(g.outlineStyle, 'solid');

            await assertTokenDrill(page, {
                token: '--ui-focus-w',
                value: '7px',
                selector: '#trail-btn',
                property: 'outline-width',
                prepare: (p) => p.focusVisible('#trail-btn'),
            });
        }));

        test('inside a clipping list the inset offset keeps the ring whole', () => mounted(async (page) => {
            // The real deployment: the band lives in a list with an overflow rule, so
            // the outset ring on a slotted control would be cut. focus-ring="inset" on
            // the host sets --_ui-focus-offset, and a custom property inherits through
            // the FLATTENED tree, so a light-DOM child of the host takes it too.
            const g = await assertFocusUnclipped(page, '#inset-btn');
            const inset = await page.resolveValue('var(--ui-focus-offset-inset)', 'outline-offset');
            assert.equal(g.outlineOffset, inset,
                'the inset offset must reach a slotted control, not only the shadow tree');
        }));

        /* -- 4. container behaviour, at both geometries ---------------------- */

        test('the band is ONE line at every width; the caption gives, the count never does', () => mounted(async (page) => {
            // DEPARTURE 4. The oracle is DISQUALIFIED for responsive behaviour (Part 10
            // §4) — Slate's band is 639px wide, frozen, and never meets a narrow
            // container. LAYOUT_SPEC_DRAFT.md governs.
            const wide = await page.box('#hdr-plain >>> #band');
            const narrow = await page.box('#hdr-narrow >>> #band');
            assert.equal(narrow.height, ORACLE.bandHeight,
                'a wrapped caption would be clipped by the fixed band, so it must not wrap');
            assert.equal(wide.height, narrow.height, 'and the band is the same height either way');

            const caption = await page.metrics('#hdr-narrow >>> #caption');
            assert.ok(caption.scrollWidth > caption.clientWidth + 0.5,
                `the narrow caption does not overflow (${caption.scrollWidth} vs ${caption.clientWidth}) — `
                + 'the assertion below would pass vacuously');
            assert.equal(await page.prop('#hdr-narrow >>> #caption', 'text-overflow'), 'ellipsis');
            assert.equal(await page.prop('#hdr-narrow >>> #caption', 'white-space'), 'nowrap');

            // The count keeps its whole box and stays inside the band's inset.
            const count = await page.box('#hdr-narrow >>> #count');
            const band = await page.box('#hdr-narrow >>> #band');
            const pad = parseFloat(ORACLE.padInline);
            assert.ok(count.width > 0, 'the count was squeezed out of existence');
            assert.ok(count.right <= band.right - pad + 0.5,
                `the count escaped the band inset (${count.right} vs ${band.right - pad})`);
            assert.ok(count.left >= band.left, 'and it never crosses to the caption side');
        }));

        test('the band cannot be compressed below --ui-section-head-h', () => mounted(async (page) => {
            // A flex item shrinks below its content by default; min-block-size is what
            // stops a 40px track from eating the band. This is the "container floor"
            // half of spec §2.4 for a fixed band: it does not scroll, it does not
            // shrink, it holds.
            const squeezed = await page.box('#hdr-squeezed');
            assert.equal(squeezed.height, ORACLE.bandHeight,
                `a 40px flex column compressed the band to ${squeezed.height}px`);
            const floor = await page.resolveToken('--ui-section-head-h', 'min-height');
            assert.equal(await page.prop('#hdr-squeezed', 'min-height'), floor);
        }));

        test('the list it lives in scrolls rather than clipping, and shows it', () => mounted(async (page) => {
            // The component is not itself a scroll region — the LIST is, and spec §2.4
            // governs it: an explicit floor, a stated overflow, and no hidden
            // scrollbar. Asserted here because the stick is only meaningful inside one.
            await assertScrollFloor(page, {
                selector: '#list',
                squeeze: { 'block-size': '160px' },
                minBlockSize: 120,
            });
        }));

        /* -- 5. THE STICK --------------------------------------------------- */

        test('the caption stays at the top of its scrollport while its group scrolls under it', () => mounted(async (page) => {
            // Slate's own reason, slate-shell.css:2042-2043: "the section captions stay
            // put while their section scrolls, so the list never loses which half of the
            // library you are looking at."
            const listTop = (await page.box('#list')).top;
            const restingTop = (await page.box('#hdr-a')).top;
            assert.ok(Math.abs(restingTop - listTop) < 0.5, 'it starts at the top of the port');

            await page.evalFn(() => { document.getElementById('list').scrollTop = 200; return true; });
            await page.settle(2);

            const stuck = await page.box('#hdr-a');
            assert.ok(Math.abs(stuck.top - listTop) < 0.5,
                `the header scrolled away with its group (top ${stuck.top} vs port ${listTop}) — `
                + 'position: sticky is not in force');

            // A row that WOULD be at the port top if nothing stuck: proof the port moved.
            const row = await page.box('#a-3');
            assert.ok(row.top < listTop + 200, 'the list did not actually scroll — vacuous test');

            await page.evalFn(() => { document.getElementById('list').scrollTop = 0; return true; });
        }));

        test('the stuck caption is OPAQUE and wins the stack against the rows', () => mounted(async (page) => {
            // The defect class this pins: a sticky caption with a see-through ground is
            // unreadable one row into a scroll, and one with the wrong layer is painted
            // over by the row it is supposed to cover. Both are hit-tested, not
            // eyeballed — elementFromPoint is the same question a screenshot asks.
            const ground = await page.prop('#hdr-a >>> #band', 'background-color');
            assert.notEqual(ground, 'rgba(0, 0, 0, 0)', 'the band has no ground at all');
            assert.ok(!/rgba\([^)]*,\s*0(\.\d+)?\)/.test(ground) || /,\s*1\)/.test(ground),
                `the ground is not opaque: ${ground}`);
            assert.equal(ground, await page.resolveToken('--ui-fascia', 'background-color'));

            await page.evalFn(() => { document.getElementById('list').scrollTop = 200; return true; });
            await page.settle(2);

            const hit = await page.evalFn(() => {
                const list = document.getElementById('list');
                const r = list.getBoundingClientRect();
                const el = document.elementFromPoint(r.left + 40, r.top + 30);
                return el ? (el.id || el.tagName.toLowerCase()) : null;
            });
            assert.equal(hit, 'hdr-a',
                `the row under the stuck caption is on top of it (hit ${hit}) — --ui-z-sticky `
                + 'is not reaching the host, or the host is not positioned');

            await page.evalFn(() => { document.getElementById('list').scrollTop = 0; return true; });
        }));

        /* -- 6. P8's class --------------------------------------------------- */

        test('a sheet from OUTSIDE cannot flatten the ground (P8\'s class)', () => mounted(async (page) => {
            // The paint is on a class inside the root, never on :host — so a document
            // rule naming the tag paints behind an opaque band and changes nothing the
            // user sees. That is the shadow boundary doing the job it is here for.
            const before = await page.prop('#hdr-plain >>> #band', 'background-color');
            const after = await page.evalFn(() => {
                const s = document.createElement('style');
                s.textContent = 'ui-section-header { background-color: rgb(1, 2, 3); color: rgb(1, 2, 3); }';
                document.head.appendChild(s);
                const el = document.getElementById('hdr-plain');
                return getComputedStyle(el.shadowRoot.getElementById('band')).backgroundColor;
            });
            assert.equal(after, before, 'an outside rule reached the band\'s ground');
            const ink = await page.prop('#hdr-plain >>> #caption', 'color');
            assert.equal(ink, await page.resolveToken('--ui-muted', 'color'),
                'and the role\'s ink is not inherited from outside either');
        }));

        test('zero !important reaches the rendered result', () => mounted(async (page) => {
            // Spec §2.1 Rule 3 as a RENDERED fact rather than a source grep (Gate C owns
            // the grep): every declaration this component makes is beatable by an
            // ordinary rule inside its own root.
            const beaten = await page.evalFn(() => {
                const root = document.getElementById('hdr-plain').shadowRoot;
                const s = document.createElement('style');
                s.textContent = 'div.band { background-color: rgb(1, 2, 3); } h2.caption { color: rgb(4, 5, 6); }';
                root.appendChild(s);
                return [
                    getComputedStyle(root.getElementById('band')).backgroundColor,
                    getComputedStyle(root.getElementById('caption')).color,
                ].join(' / ');
            });
            assert.equal(beaten, 'rgb(1, 2, 3) / rgb(4, 5, 6)',
                'a plain rule in the same root must win — no !important anywhere, and the '
                + 'typeRoles fragment is (0,0,0) by construction');
        }));

        /* -- 7. aria and the accessible name --------------------------------- */

        test('the caption is a real heading, and `level` moves only the level', () => mounted(async (page) => {
            // TYPE_ROLES.md rule 2: "A role is paint. A heading is structure, and a
            // screen reader reads <h2>, not .ui-heading."
            const shape = await page.evalFn(() => {
                const read = (id) => {
                    const h = document.getElementById(id).shadowRoot.getElementById('caption');
                    return { tag: h.tagName, level: h.getAttribute('aria-level') };
                };
                return JSON.stringify({ a: read('hdr-a'), l3: read('hdr-l3'), bogus: read('hdr-bogus') });
            });
            const got = JSON.parse(shape);
            assert.equal(got.a.tag, 'H2');
            assert.equal(got.a.level, '2');
            assert.equal(got.l3.tag, 'H2');
            assert.equal(got.l3.level, '3', 'level moves aria-level, not the element');
            assert.equal(got.bogus.level, '2', 'an out-of-range level falls back rather than '
                + 'emitting an invalid aria-level on a real heading');
            assert.equal(
                await page.evalFn(() => document.getElementById('hdr-bogus').getAttribute('level')),
                '2', 'and it normalises, so the DOM says what it renders');

            // The paint does not move with the level — a level is semantics, not size.
            const l2 = await page.computed('#hdr-a >>> #caption', ['font-size', 'font-weight', 'color']);
            const l3 = await page.computed('#hdr-l3 >>> #caption', ['font-size', 'font-weight', 'color']);
            assert.deepEqual(l3, l2);
        }));

        test('the count is a SIBLING of the heading, so the accessible name is the caption alone', () => mounted(async (page) => {
            const nested = await page.evalFn(() => {
                const root = document.getElementById('hdr-a').shadowRoot;
                return root.getElementById('caption').contains(root.getElementById('count'));
            });
            assert.equal(nested, false, 'the count inside the heading would make the name "Your Profiles 6"');
        }));

        test('`count-label` names the number; without it the glyph speaks for itself', () => mounted(async (page) => {
            const named = await page.computed('#hdr-a >>> #count', ['color']);
            assert.ok(named, 'the named count renders');
            assert.equal(
                await page.evalFn(() => document.getElementById('hdr-a').shadowRoot
                    .getElementById('count').getAttribute('aria-hidden')),
                'true', 'the bare glyph is hidden once a label exists');

            const box = await page.box('#hdr-a >>> #a11y');
            assert.ok(box.width <= 1.5 && box.height <= 1.5,
                `the alt text is visible: ${box.width}×${box.height}`);
            assert.equal(await page.prop('#hdr-a >>> #a11y', 'position'), 'absolute',
                'and it is out of flow, so naming the count does not move the band');

            // Unlabelled: no aria-hidden, no second node — "72" reads as "72".
            assert.equal(
                await page.evalFn(() => document.getElementById('hdr-b').shadowRoot
                    .getElementById('count').getAttribute('aria-hidden')),
                null);
            assert.equal(await page.exists('#hdr-b >>> #a11y'), false);
        }));

        test('text-transform is PAINT: the accessible name keeps the case the author wrote', () => mounted(async (page) => {
            assert.equal(await page.prop('#hdr-a >>> #caption', 'text-transform'), 'uppercase');
            assert.equal(
                await page.evalFn(() => document.getElementById('hdr-a').textContent.trim()),
                'Your Profiles',
                'uppercasing the SOURCE would have a screen reader spell it out');
        }));

        test('`0` is a count; nothing is not', () => mounted(async (page) => {
            assert.equal(await page.exists('#hdr-zero >>> #count'), true,
                'count="0" must render — a String property is what keeps 0 from being falsy');
            assert.equal(
                await page.evalFn(() => document.getElementById('hdr-zero').shadowRoot
                    .getElementById('count').textContent),
                '0');
            assert.equal(await page.exists('#hdr-nocount >>> #count'), false,
                'and a header with no count draws no empty box to gap against');

            // …and it leaves no stray attribute behind either. A reflected String whose
            // default is '' stamps count="" on every element, which would make a
            // consumer's [count] selector match the ones that have none.
            assert.equal(
                await page.evalFn(() => document.getElementById('hdr-nocount').hasAttribute('count')),
                false, 'count is deliberately not reflected; level is');
            assert.equal(
                await page.evalFn(() => document.getElementById('hdr-nocount').getAttribute('level')),
                '2', 'level IS reflected, so a normalised value is visible in the DOM');
        }));

        /* -- 8. the hit floor, deliberately not consumed ---------------------- */

        test('the band clears --ui-hit-min without consuming the utility, and accepts no press', () => mounted(async (page) => {
            // spec §2.3 / Appendix 5 govern touch TARGETS; CONVENTIONS §5 names the
            // utility's three consumers (#15, #23, #35) and this is not one. Row #27
            // cites neither. The band is 60px, so it clears the floor as a matter of
            // fact — and it must not GROW one, because a caption with a hit box has
            // nothing behind it.
            const floor = parseFloat(await page.resolveValue('var(--ui-hit-min)', 'width'));
            assert.equal(floor, 48, '--ui-hit-min: a wet fingertip is about 9mm (spec §2.3)');
            assert.ok((await page.box('#hdr-plain >>> #band')).height >= floor);
            assert.equal(await page.prop('#hdr-plain >>> #band', 'position'), 'static',
                '.hit-overlay is not used here — the band grows no overlay');
            assert.equal(await page.prop('#hdr-plain >>> #caption', 'position'), 'static');
        }));

        /* -- the cross-geometry record --------------------------------------- */

        test('record the measured boxes for the cross-geometry comparison', () => mounted(async (page) => {
            const round = (b) => ({
                w: Math.round(b.width * 100) / 100,
                h: Math.round(b.height * 100) / 100,
            });
            acrossGeometries[geometry.name] = {
                host: round(await page.box('#hdr-plain')),
                band: round(await page.box('#hdr-plain >>> #band')),
                caption: round(await page.box('#hdr-plain >>> #caption')),
                count: round(await page.box('#hdr-plain >>> #count')),
                narrowBand: round(await page.box('#hdr-narrow >>> #band')),
                narrowCount: round(await page.box('#hdr-narrow >>> #count')),
            };
        }));
    });
}

describe('the same box at both geometries', () => {
    test('every measured width and height is geometry-independent', () => {
        const names = Object.keys(acrossGeometries);
        assert.equal(names.length, GATE_A_GEOMETRIES.length,
            'both geometry blocks must have run before this comparison means anything');
        const [first, ...rest] = names;
        for (const name of rest) {
            assert.deepEqual(acrossGeometries[name], acrossGeometries[first],
                `ui-section-header renders differently at ${name} than at ${first} — `
                + 'something read the viewport (spec §2.1 Rule 1)');
        }
    });
});

describe('the gallery entry this component ships', () => {
    // The entry lives in its own file (tools/gallery/entries/ui-section-header.entry.js)
    // because twelve wave-2 builders cannot all append to one array under a whole-file
    // write rule; the wave's cross-cutting writer wires it into tools/gallery/entries.js.
    // That wiring is a one-line import — but the ENTRY's own correctness is this
    // builder's problem, so every state's markup is mounted here before it is handed on.

    test('every declared state mounts, settles and paints', async () => {
        const { entry } = await import('../../tools/gallery/entries/ui-section-header.entry.js');

        assert.equal(entry.id, 'ui-section-header', 'the entry id is the tag name is the file name');
        assert.equal(entry.module, '../../src/components/ui-section-header.js',
            'module is relative to tools/gallery/, which is where gallery.js imports it from');
        assert.ok(entry.states.length >= 3);
        assert.equal(new Set(entry.states.map((s) => s.id)).size, entry.states.length,
            'state ids are capture filenames, so they must be unique');

        await browser.withPage({ geometry: GATE_A_GEOMETRIES[0] }, async (page) => {
            for (const state of entry.states) {
                const wrapper = state.hostStyle
                    ? `<div id="stage" style="${Object.entries(state.hostStyle)
                        .map(([k, v]) => `${k}:${v}`).join(';')}">${state.html}</div>`
                    : `<div id="stage">${state.html}</div>`;
                await page.mount(wrapper, MODULE);
                assert.deepEqual(page.pageErrors, [], `${entry.id}--${state.id} threw`);

                const painted = await page.evalFn(() => {
                    const el = document.querySelector('ui-section-header');
                    if (!el) return null;
                    const band = el.shadowRoot && el.shadowRoot.getElementById('band');
                    if (!band) return null;
                    const r = band.getBoundingClientRect();
                    return { w: r.width, h: r.height, bg: getComputedStyle(band).backgroundColor };
                });
                assert.ok(painted, `${entry.id}--${state.id} rendered no band at all`);
                assert.ok(painted.w > 0 && painted.h > 0,
                    `${entry.id}--${state.id} rendered a ${painted.w}×${painted.h} box`);
                assert.notEqual(painted.bg, 'rgba(0, 0, 0, 0)',
                    `${entry.id}--${state.id} has no ground — a sticky caption must be opaque`);
            }
        });
    });
});
