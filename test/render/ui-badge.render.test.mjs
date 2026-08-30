/**
 * Gate A for.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';
import {
    assertTokenDrill,
    assertFocusUnclipped,
    DRILL_COLOUR,
} from '../harness/assertions.js';

const MODULE = ['/src/components/ui-badge.js'];

const MARKUP = `
<div id="row" style="padding: 24px; display: flex; gap: 16px; align-items: center; flex-wrap: wrap">
    <ui-badge id="count">2</ui-badge>
    <ui-badge id="count2">12</ui-badge>
    <ui-badge id="active" variant="active">Active</ui-badge>
    <ui-badge id="attn" variant="attention">Update available</ui-badge>
    <ui-badge id="named" label="2 profiles">2</ui-badge>
    <ui-badge id="bogus" variant="Nope">2</ui-badge>
    <ui-badge id="gone" hidden>2</ui-badge>
    <ui-badge id="focusable" tabindex="0">2</ui-badge>
</div>
<div id="list-row" style="display: flex; align-items: center; justify-content: space-between;
     gap: 16px; min-block-size: 64px; padding: 0 24px">
    <span id="list-title">Londinium Espresso</span>
    <ui-badge id="on-row" variant="active">Active</ui-badge>
</div>
<div id="narrow" style="inline-size: 900px; padding: 24px">
    <ui-badge id="clamped" variant="attention">Update available</ui-badge>
</div>
<div id="band" style="overflow: hidden; inline-size: 300px; display: flex">
    <ui-badge id="clipped" tabindex="0" focus-ring="inset">Inset</ui-badge>
</div>
`;

const ORACLE = {
    dark: {
        face: 'rgb(40, 49, 57)',
        ink: 'rgb(186, 196, 202)',
        activeFace: 'rgb(23, 59, 77)',
        activeInk: 'rgb(246, 251, 253)',
        attentionFace: 'color(srgb 0.898039 0.647059 0.054902 / 0.18)',
        attentionInk: 'rgb(229, 165, 14)',
    },
    light: {
        face: 'rgb(227, 231, 233)',
        ink: 'rgb(63, 71, 76)',
        activeFace: 'rgb(35, 79, 99)',
        activeInk: 'rgb(248, 252, 253)',
        attentionFace: 'color(srgb 0.588235 0.329412 0 / 0.18)',
        attentionInk: 'rgb(150, 84, 0)',
    },
    /* Theme-independent, from the same three records. */
    radius: '6px',
    padding: '8px',
    fontSize: '14px',
    weightDefault: '500',
    edge: '0px',
    shadow: 'none',
    height: 21,
    minHeight: 'auto',
    countWidth: 24.8281,
    count2Width: 30,
    /* The two values this build deliberately does NOT reproduce — see DEPARTURES. */
    slateSemibold: '600',
    slateTracking: '1.68px',
};

/** Filled in by each geometry block, compared once at the end. */
const acrossGeometries = {};

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`ui-badge @ ${geometry.name} (${geometry.width}×${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

        const mounted = (fn) => browser.withPage({ geometry }, async (page) => {
            await page.mount(MARKUP, MODULE);
            assert.deepEqual(page.pageErrors, [], 'ui-badge must mount without throwing');
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

        test('drill: --ui-key-on is the neutral face and --ui-text-2 the ink', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-key-on',
                value: DRILL_COLOUR,
                selector: '#count >>> #badge',
                property: 'background-color',
            });
            await assertTokenDrill(page, {
                token: '--ui-text-2',
                value: DRILL_COLOUR,
                selector: '#count >>> #badge',
                property: 'color',
            });
        }));

        test('drill: --ui-primary and --ui-on-primary are the ACTIVE pair', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-primary',
                value: DRILL_COLOUR,
                selector: '#active >>> #badge',
                property: 'background-color',
            });
            await assertTokenDrill(page, {
                token: '--ui-on-primary',
                value: DRILL_COLOUR,
                selector: '#active >>> #badge',
                property: 'color',
            });
        }));

        test('drill: --ui-tint-power is the ATTENTION ink and the wash it is mixed from', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-tint-power',
                value: DRILL_COLOUR,
                selector: '#attn >>> #badge',
                property: 'color',
            });
            await assertTokenDrill(page, {
                token: '--ui-tint-power',
                value: DRILL_COLOUR,
                selector: '#attn >>> #badge',
                property: 'background-color',
                expectLanding: false,
            });
        }));

        test('drill: --ui-radius, --ui-space-2, --ui-text-2xs, --ui-weight-medium', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-radius',
                value: '30px',
                selector: '#count >>> #badge',
                property: 'border-top-left-radius',
            });
            await assertTokenDrill(page, {
                token: '--ui-space-2',
                value: '36px',
                selector: '#count >>> #badge',
                property: 'padding-left',
            });
            await assertTokenDrill(page, {
                token: '--ui-text-2xs',
                value: '31px',
                selector: '#count >>> #badge',
                property: 'font-size',
            });
            await assertTokenDrill(page, {
                token: '--ui-weight-medium',
                value: '800',
                selector: '#count >>> #badge',
                property: 'font-weight',
            });
        }));

        test('drill: --ui-weight-semibold and --ui-tracking-cap carry both STATES', () => mounted(async (page) => {
            for (const id of ['active', 'attn']) {
                await assertTokenDrill(page, {
                    token: '--ui-weight-semibold',
                    value: '300',
                    selector: `#${id} >>> #badge`,
                    property: 'font-weight',
                });
            }
            await assertTokenDrill(page, {
                token: '--ui-tracking-cap',
                value: '5px',
                selector: '#active >>> #badge',
                property: 'letter-spacing',
            });
        }));

        test('the resting paint is the oracle\'s measured values, in both themes', () => mounted(async (page) => {
            for (const theme of ['dark', 'light']) {
                await page.setTheme(theme);
                const want = ORACLE[theme];

                const plain = await page.computed('#count >>> #badge', ['background-color', 'color']);
                assert.equal(plain['background-color'], want.face, `${theme}: --ui-key-on`);
                assert.equal(plain.color, want.ink, `${theme}: --ui-text-2`);

                const active = await page.computed('#active >>> #badge', ['background-color', 'color']);
                assert.equal(active['background-color'], want.activeFace, `${theme}: --ui-primary`);
                assert.equal(active.color, want.activeInk, `${theme}: --ui-on-primary`);

                const attn = await page.computed('#attn >>> #badge', ['background-color', 'color']);
                assert.equal(attn['background-color'], want.attentionFace,
                    `${theme}: the 18% --ui-tint-power wash`);
                assert.equal(attn.color, want.attentionInk, `${theme}: --ui-tint-power`);
            }
        }));

        test('the theme-independent half of the record is carried exactly', () => mounted(async (page) => {
            const c = await page.computed('#count >>> #badge', [
                'border-top-left-radius', 'padding-left', 'font-size', 'font-weight',
                'border-top-width', 'box-shadow', 'letter-spacing', 'text-transform',
            ]);
            assert.equal(c['border-top-left-radius'], ORACLE.radius, 'CITE [i=20] 6px');
            assert.equal(c['padding-left'], ORACLE.padding, 'CITE [i=20] 8px');
            assert.equal(c['font-size'], ORACLE.fontSize, 'CITE [i=20] 14px');
            assert.equal(c['font-weight'], ORACLE.weightDefault, 'CITE [i=20] 500');
            assert.equal(c['border-top-width'], ORACLE.edge, 'CITE [i=20] 0px — a badge has no edge');
            assert.equal(c['box-shadow'], ORACLE.shadow, 'CITE [i=20] none');
            assert.equal(c['letter-spacing'], 'normal', 'CITE [i=20] normal — tracking is the ACTIVE state only');
            assert.equal(c['text-transform'], 'none', 'CITE [i=20] none');
        }));

        test('the attention wash is Slate\'s own colour arithmetic', () => mounted(async (page) => {
            const mix = await page.resolveValue(
                'color-mix(in srgb, var(--ui-tint-power) 18%, transparent)', 'background-color');
            const face = await page.prop('#attn >>> #badge', 'background-color');
            assert.equal(face, mix);
            assert.equal(face, ORACLE.dark.attentionFace, 'and the mix IS the oracle\'s reading');
            assert.notEqual(face, 'rgba(0, 0, 0, 0)', 'the wash must actually be a wash');
            assert.notEqual(face, await page.prop('#attn >>> #badge', 'color'),
                'ink and wash are the same hue at different alphas, not the same value');
        }));

        test('the one-digit count is Slate\'s own box, to a hundredth of a pixel', () => mounted(async (page) => {
            const one = await page.box('#count >>> #badge');
            const two = await page.box('#count2 >>> #badge');
            assert.ok(Math.abs(one.width - ORACLE.countWidth) < 0.05,
                `one-digit count is ${one.width}px against the oracle's ${ORACLE.countWidth}px`);
            assert.ok(Math.abs(two.width - ORACLE.count2Width) < 0.5,
                `two-digit count is ${two.width}px against the oracle's rect w=${ORACLE.count2Width}`);
            assert.ok(two.width > one.width, 'the marker is sized by its text, not by a track');

            for (const [id, box] of [['count', one], ['count2', two]]) {
                assert.ok(Math.abs(box.height - ORACLE.height) < 0.05,
                    `#${id} is ${box.height}px tall against the oracle's ${ORACLE.height}px — ` +
                    'the line box moved, which means the leading did');
            }
            assert.equal(await page.prop('#count >>> #badge', 'min-block-size'), ORACLE.minHeight,
                'and nothing floors it: the marker is exactly its line box');
            for (const id of ['active', 'attn', 'named', 'bogus']) {
                assert.ok(Math.abs((await page.box(`#${id} >>> #badge`)).height - ORACLE.height) < 0.05,
                    `#${id} left the 21px line box`);
            }
        }));

        test('the states carry --ui-weight-semibold, which IS Slate\'s 600', () => mounted(async (page) => {
            const bold = await page.resolveToken('--ui-weight-semibold', 'font-weight');
            for (const id of ['active', 'attn']) {
                const got = await page.prop(`#${id} >>> #badge`, 'font-weight');
                assert.equal(got, bold, `#${id} reads the semibold step`);
                assert.equal(got, ORACLE.slateSemibold,
                    'the badge renders the oracle\'s own 600');
            }
            assert.equal(await page.prop('#count >>> #badge', 'font-weight'), ORACLE.weightDefault,
                'and the neutral marker is unchanged at --ui-weight-medium');
        }));

        test('the active tracking is Slate\'s .12em', () => mounted(async (page) => {
            const got = await page.prop('#active >>> #badge', 'letter-spacing');
            assert.equal(got, ORACLE.slateTracking, '.12em at 14px is Slate\'s 1.68px');
            assert.equal(await page.prop('#active >>> #badge', 'text-transform'), 'uppercase',
                'and the uppercase half of the microcap is carried with it');
        }));

        test('DEPARTURE 4: the marker clamps to its container instead of spilling', () => mounted(async (page) => {
            const roomy = await page.box('#clamped >>> #badge');
            const oneLine = roomy.height;

            await page.setStyle('#narrow', { 'inline-size': '96px' });
            const tight = await page.box('#narrow');
            const inTight = await page.box('#clamped >>> #badge');

            assert.ok(
                inTight.right <= tight.right - 24 + 0.5 && inTight.left >= tight.left + 24 - 0.5,
                `the marker escaped its container: [${inTight.left}, ${inTight.right}] ` +
                `outside the 24px-padded [${tight.left + 24}, ${tight.right - 24}]`,
            );
            assert.ok(inTight.width < roomy.width, 'it narrowed with the container');
            assert.equal(inTight.height, oneLine,
                'it never wraps to two lines — a status marker is one line by construction');

            const clip = await page.evalFn(() => {
                const t = document.getElementById('clamped').shadowRoot.getElementById('text');
                return { scroll: t.scrollWidth, client: t.clientWidth };
            });
            assert.ok(clip.scroll > clip.client,
                'the text must really be overflowing, or the ellipsis proves nothing');
            assert.equal(await page.prop('#clamped >>> #text', 'text-overflow'), 'ellipsis');

            await page.setStyle('#narrow', { 'inline-size': '900px' });
            assert.equal((await page.box('#clamped >>> #badge')).width, roomy.width,
                'and it comes back — the size was read from the container, not remembered');
        }));

        test('[hidden] beats display, with zero !important (slate-components.css:230-239)', () => mounted(async (page) => {
            assert.equal(await page.prop('#gone', 'display'), 'none');
            assert.equal((await page.box('#gone')).width, 0, 'hidden means no box, not a sized one');
            assert.equal(await page.prop('#clamped', 'display'), 'inline-grid',
                'and a visible one keeps its container opt-out');
            assert.equal(await page.prop('#count', 'display'), 'grid',
                'blockified as a flex item — still the opt-out, still not none');

            // The other half: hiding by script, which is how the defect was found.
            await page.evalFn(() => { document.getElementById('count').hidden = true; return true; });
            await page.settle(1);
            assert.equal(await page.prop('#count', 'display'), 'none',
                'setting .hidden from script must hide it');
        }));

        test('P8\'s class: no rule from OUTSIDE can repaint the marker', () => mounted(async (page) => {
            const before = await page.computed('#active >>> #badge',
                ['background-color', 'color', 'font-weight', 'border-top-left-radius']);

            await page.evalFn(() => {
                const s = document.createElement('style');
                s.id = 'p8-shell-rule';
                s.textContent = [
                    '#row ui-badge, #row ui-badge *, #mount *, #mount span {',
                    '  background: transparent !important;',
                    '  background-color: transparent !important;',
                    '  color: inherit !important;',
                    '  font-weight: 400 !important;',
                    '  border-radius: 0 !important;',
                    '}',
                ].join('\n');
                document.head.appendChild(s);
                return true;
            });
            await page.settle(2);

            const after = await page.computed('#active >>> #badge',
                ['background-color', 'color', 'font-weight', 'border-top-left-radius']);
            assert.deepEqual(after, before,
                'a screen sheet reached into the component and repainted it');
        }));

        test('this is NOT a selection surface, and cannot become one by accident', () => mounted(async (page) => {
            const before = await page.computed('#count >>> #badge', ['background-color', 'color', 'box-shadow']);

            await page.evalFn(() => {
                const el = document.getElementById('count');
                el.setAttribute('aria-selected', 'true');
                el.setAttribute('aria-pressed', 'true');
                el.setAttribute('aria-checked', 'true');
                el.setAttribute('aria-current', 'true');
                el.classList.add('is-selected');
                el.shadowRoot.getElementById('badge').classList.add('is-selected');
                return true;
            });
            await page.settle(2);

            assert.deepEqual(
                await page.computed('#count >>> #badge', ['background-color', 'color', 'box-shadow']),
                before,
                'a second selection treatment has started — that is the decay the rewrite exists to stop',
            );
            // And the dials themselves must be inert on it, drilled the same way.
            await page.setToken('--ui-selected-face', DRILL_COLOUR);
            assert.equal(await page.prop('#count >>> #badge', 'background-color'), before['background-color'],
                'the selection dial must not reach a badge');
            await page.setToken('--ui-selected-face', null);
        }));

        test('a badge is not interactive, and takes no focus of its own', () => mounted(async (page) => {
            const shape = await page.evalFn(() => {
                const el = document.getElementById('count');
                el.focus();
                return {
                    tabIndex: el.tabIndex,
                    hasTabindexAttr: el.hasAttribute('tabindex'),
                    role: el.getAttribute('role'),
                    innerTag: el.shadowRoot.getElementById('badge').tagName,
                    focused: document.activeElement === el,
                };
            });
            assert.deepEqual(shape, {
                tabIndex: -1, hasTabindexAttr: false, role: null,
                innerTag: 'SPAN', focused: false,
            }, 'a status marker is a span with no role and no tab stop');
        }));

        test('when a consumer DOES make it focusable, it gets the one ring, unclipped', () => mounted(async (page) => {
            const g = await assertFocusUnclipped(page, '#focusable');
            assert.equal(g.outlineOffset, '2px', '--ui-focus-offset');
            assert.deepEqual(g.clippers, [], 'nothing clips a badge in an open row');
        }));

        test('drill: --ui-steel moves the ring', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-steel',
                value: DRILL_COLOUR,
                selector: '#focusable',
                property: 'outline-color',
                prepare: (p) => p.focusVisible('#focusable'),
            });
        }));

        test('the same ring survives a clipping band by going inset (L24)', () => mounted(async (page) => {
            const g = await assertFocusUnclipped(page, '#clipped');
            assert.equal(g.outlineOffset, '-3px', '--ui-focus-offset-inset');
            assert.ok(g.clippers.length >= 1, 'the band must really clip, or this is vacuous');
            assert.equal(g.clippers[0].overflowX, 'hidden');

            await page.evalFn(() => {
                document.getElementById('clipped').removeAttribute('focus-ring');
                return true;
            });
            await page.focusVisible('#clipped');
            const outset = await page.focusGeometry('#clipped');
            assert.equal(outset.outlineOffset, '2px', '--ui-focus-offset');
            const clip = outset.clippers[0];
            const escapes = ['top', 'left', 'bottom'].filter((side) => (
                side === 'bottom'
                    ? outset.ringRect.bottom > clip.bottom + 0.5
                    : outset.ringRect[side] < clip[side] - 0.5
            ));
            assert.deepEqual(escapes, ['top', 'left', 'bottom'],
                'the band does not actually clip an outset ring, so the inset pass proves nothing');
        }));

        test('the marker is sized by its own text, not by its container', () => mounted(async (page) => {
            const wide = await page.box('#clamped >>> #badge');
            await page.setStyle('#narrow', { 'inline-size': '300px' });
            const narrower = await page.box('#clamped >>> #badge');
            assert.deepEqual(
                [narrower.width, narrower.height], [wide.width, wide.height],
                'the marker resized with a container it is nowhere near filling',
            );
            assert.equal(await page.prop('#clamped', 'container-type'), 'normal',
                'the opt-out is the mechanism; a badge under inline-size containment is a 0-wide box');
        }));

        test('no viewport query decides anything here', () => mounted(async (page) => {
            await page.setStyle('#narrow', { 'inline-size': '400px' });
            const a = await page.box('#clamped >>> #badge');
            await page.setStyle('#row', { 'inline-size': '520px' });
            const b = await page.box('#clamped >>> #badge');
            assert.deepEqual(
                [a.width, a.height], [b.width, b.height],
                'resizing an unrelated sibling container moved this badge',
            );

            acrossGeometries[geometry.name] = {
                count: (await page.box('#count >>> #badge')).width,
                countHeight: (await page.box('#count >>> #badge')).height,
                active: (await page.box('#active >>> #badge')).width,
                attention: (await page.box('#attn >>> #badge')).width,
            };
        }));

        test('the accessible name: the slot by default, `label` when the glyph is a number', () => mounted(async (page) => {
            const shape = await page.evalFn(() => {
                const read = (id) => {
                    const root = document.getElementById(id).shadowRoot;
                    const text = root.getElementById('text');
                    const a11y = root.getElementById('a11y');
                    return {
                        hidden: text.getAttribute('aria-hidden'),
                        alt: a11y ? a11y.textContent : null,
                        hostLabel: document.getElementById(id).getAttribute('aria-label'),
                    };
                };
                return { plain: read('count'), named: read('named') };
            });
            assert.deepEqual(shape.plain, { hidden: null, alt: null, hostLabel: null },
                'an unnamed badge exposes its slot text and nothing else');
            assert.deepEqual(shape.named, { hidden: 'true', alt: '2 profiles', hostLabel: null },
                'a named badge hides the glyph and exposes the name as real text — '
                + 'aria-label is ignored on the generic role a bare span carries');

            // The hidden text must be hidden to the EYE, not merely small.
            const box = await page.box('#named >>> #a11y');
            assert.ok(box.width <= 1.5 && box.height <= 1.5, `the alt text is visible: ${box.width}×${box.height}`);
            assert.equal((await page.box('#named >>> #badge')).width, (await page.box('#count >>> #badge')).width,
                'and naming it does not change the box');
        }));

        test('the marker is BELOW the 48px floor on purpose, and the row is still the target', () => mounted(async (page) => {
            const floor = parseFloat(await page.resolveValue('var(--ui-hit-min)', 'width'));
            assert.equal(floor, 48, '--ui-hit-min: a wet fingertip is about 9mm (spec §2.3)');

            const marker = await page.box('#on-row >>> #badge');
            assert.ok(marker.height < floor, `the marker is ${marker.height}px — ink, not a target`);
            assert.equal(await page.prop('#on-row >>> #badge', 'position'), 'static',
                'and it grows no overlay: .hit-overlay is not used here');

            // The load-bearing half: a press on the marker still reaches the row.
            await page.recordEvents('#list-row', ['click']);
            await page.click('#on-row >>> #badge');
            assert.equal((await page.recordedEvents()).length, 1,
                'a press on the marker must compose out to the row that owns the action');
            const rowBox = await page.box('#list-row');
            assert.ok(rowBox.height >= floor, `and the ROW clears the floor at ${rowBox.height}px`);
        }));

        test('an unrecognised variant falls back rather than blanking the marker', () => mounted(async (page) => {
            const bogus = await page.computed('#bogus >>> #badge', ['background-color', 'color', 'font-weight']);
            const plain = await page.computed('#count >>> #badge', ['background-color', 'color', 'font-weight']);
            assert.deepEqual(bogus, plain);
            assert.equal(
                await page.evalFn(() => document.getElementById('bogus').getAttribute('variant')),
                'default',
                'and it normalises, so the DOM says what it paints',
            );
        }));

        test('zero !important reaches the rendered result', () => mounted(async (page) => {
            const beaten = await page.evalFn(() => {
                const root = document.getElementById('count').shadowRoot;
                const s = document.createElement('style');
                s.textContent = 'span.badge { background-color: rgb(1, 2, 3); }';
                root.appendChild(s);
                return getComputedStyle(root.getElementById('badge')).backgroundColor;
            });
            assert.equal(beaten, 'rgb(1, 2, 3)',
                'a plain rule in the same root must win — no !important anywhere in the component');
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
                `ui-badge renders differently at ${name} than at ${first} — `
                + 'something read the viewport (spec §2.1 Rule 1)');
        }
    });
});

describe('the gallery entry this component ships', () => {
    test('every declared state mounts, settles and paints', async () => {
        const { entry } = await import('../../tools/gallery/entries/ui-badge.entry.js');

        assert.equal(entry.id, 'ui-badge', 'the entry id is the tag name is the file name');
        assert.equal(entry.module, '../../src/components/ui-badge.js',
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
                    const el = document.querySelector('ui-badge');
                    if (!el) return null;
                    const badge = el.shadowRoot && el.shadowRoot.getElementById('badge');
                    if (!badge) return null;
                    const r = badge.getBoundingClientRect();
                    return { w: r.width, h: r.height, bg: getComputedStyle(badge).backgroundColor };
                });
                assert.ok(painted, `${entry.id}--${state.id} rendered no badge at all`);
                assert.ok(painted.w > 0 && painted.h > 0,
                    `${entry.id}--${state.id} rendered a ${painted.w}×${painted.h} box`);
                assert.notEqual(painted.bg, 'rgba(0, 0, 0, 0)',
                    `${entry.id}--${state.id} has no face — a badge is its face`);
            }
        });
    });
});
