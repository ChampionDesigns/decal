/**
 * Gate A for.
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

        test('drill: --ui-section-head-h is the band height, on the HOST', () => mounted(async (page) => {
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
            await assertTokenDrill(page, {
                token: '--ui-z-sticky',
                value: '37',
                selector: '#hdr-plain',
                property: 'z-index',
                expected: '37',
            });
        }));

        test('drill: the type is the SHARED role — --ui-muted, --ui-text-sm, --ui-weight-semibold, --ui-tracking-cap', () => mounted(async (page) => {
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

            assert.equal(type['font-weight'], ORACLE.slateSemibold,
                'Slate measured 600 and the microcap role now renders it');
            assert.equal(type['font-weight'], await page.resolveToken('--ui-weight-semibold', 'font-weight'),
                'so a microcap here is --ui-weight-semibold (600)');

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
            for (const id of ['hdr-a', 'hdr-plain', 'hdr-narrow', 'hdr-nocount']) {
                const m = await page.computed(`#${id} >>> #caption`, ['margin-top', 'margin-bottom']);
                assert.deepEqual(m, { 'margin-top': '0px', 'margin-bottom': '0px' },
                    `${id}: the <h2> kept its UA margin — the swap from Slate's span imports `
                    + '12.45px at the role\'s 15px, and align-items: flex-end aligns the MARGIN box');
            }
            assert.equal(await page.prop('#hdr-a >>> #count', 'margin-top'), '0px',
                'the count is a span and never had a margin to zero');
        }));

        test('DEPARTURE 6: caption and count share ONE line — the band is bottom-anchored, all of it', () => mounted(async (page) => {
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
                const pad = parseFloat(await page.prop(`#${id} >>> #band`, 'padding-bottom'));
                assert.ok(Math.abs(count.bottom - (band.bottom - pad)) < 0.51,
                    `${id}: bottom-anchored means the padding edge, not a coincidence `
                    + `(${count.bottom} vs ${band.bottom - pad})`);
            }
        }));

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

        test('a control slotted into `trail` gets the ONE ring, unclipped', () => mounted(async (page) => {
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
            const g = await assertFocusUnclipped(page, '#inset-btn');
            const inset = await page.resolveValue('var(--ui-focus-offset-inset)', 'outline-offset');
            assert.equal(g.outlineOffset, inset,
                'the inset offset must reach a slotted control, not only the shadow tree');
        }));

        test('the band is ONE line at every width; the caption gives, the count never does', () => mounted(async (page) => {
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
            const squeezed = await page.box('#hdr-squeezed');
            assert.equal(squeezed.height, ORACLE.bandHeight,
                `a 40px flex column compressed the band to ${squeezed.height}px`);
            const floor = await page.resolveToken('--ui-section-head-h', 'min-height');
            assert.equal(await page.prop('#hdr-squeezed', 'min-height'), floor);
        }));

        test('the list it lives in scrolls rather than clipping, and shows it', () => mounted(async (page) => {
            await assertScrollFloor(page, {
                selector: '#list',
                squeeze: { 'block-size': '160px' },
                minBlockSize: 120,
            });
        }));

        test('the caption stays at the top of its scrollport while its group scrolls under it', () => mounted(async (page) => {
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

        test('a sheet from OUTSIDE cannot flatten the ground (P8\'s class)', () => mounted(async (page) => {
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

        test('the caption is a real heading, and `level` moves only the level', () => mounted(async (page) => {
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

            assert.equal(
                await page.evalFn(() => document.getElementById('hdr-nocount').hasAttribute('count')),
                false, 'count is deliberately not reflected; level is');
            assert.equal(
                await page.evalFn(() => document.getElementById('hdr-nocount').getAttribute('level')),
                '2', 'level IS reflected, so a normalised value is visible in the DOM');
        }));

        test('the band clears --ui-hit-min without consuming the utility, and accepts no press', () => mounted(async (page) => {
            const floor = parseFloat(await page.resolveValue('var(--ui-hit-min)', 'width'));
            assert.equal(floor, 48, '--ui-hit-min: a wet fingertip is about 9mm (spec §2.3)');
            assert.ok((await page.box('#hdr-plain >>> #band')).height >= floor);
            assert.equal(await page.prop('#hdr-plain >>> #band', 'position'), 'static',
                '.hit-overlay is not used here — the band grows no overlay');
            assert.equal(await page.prop('#hdr-plain >>> #caption', 'position'), 'static');
        }));

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
