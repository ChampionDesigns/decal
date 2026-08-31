/**
 * the render harness for.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';
import { assertTokenDrill, DRILL_COLOUR, DRILL_LENGTH } from '../harness/assertions.js';

const FIXTURE = ['/test/fixtures/type-roles-fixture.js'];
const MARKUP = '<div id="frame"><type-roles-fixture></type-roles-fixture></div>';

const S = (id) => `type-roles-fixture >>> #${id}`;

/** parseFloat on a computed length, so 33.6px and "33.6px" compare as numbers. */
const px = (value) => Number.parseFloat(value);

const near = (got, want, tol, what) =>
    assert.ok(
        Math.abs(px(got) - want) <= tol,
        `${what}: expected ${want} +/- ${tol}, got ${got}`,
    );

let browser;

before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`type roles @ ${geometry.name} (${geometry.width}x${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

        test('title: 28px / 500 / --ui-text ink, on an h1 whose UA margin is zeroed', async () => {
            await browser.withPage({ geometry }, async (page) => {
                await page.mount(MARKUP, FIXTURE);

                const got = await page.computed(S('title'), [
                    'font-size', 'font-weight', 'color', 'line-height', 'text-align',
                    'margin-top', 'margin-bottom', 'font-family',
                ]);

                assert.equal(got['font-size'], '28px');
                assert.equal(got['font-weight'], '500');
                assert.equal(got.color, await page.resolveToken('--ui-text', 'color'));
                near(got['line-height'], 28 * 1.2, 0.5, 'title line-height is 1.2');
                assert.equal(got['text-align'], 'start');

                /* The UA gives an h1 0.67em of block margin. The role zeroes it: spacing
                 * is the layout's job, from --ui-space-*. */
                assert.equal(got['margin-top'], '0px');
                assert.equal(got['margin-bottom'], '0px');

                assert.match(got['font-family'], /Geist/);
            });
        });

        test('the same role reads identically on a div and on an h1', async () => {
            await browser.withPage({ geometry }, async (page) => {
                await page.mount(MARKUP, FIXTURE);

                const props = ['font-size', 'font-weight', 'color', 'line-height',
                    'margin-top', 'margin-bottom', 'text-align'];
                const semantic = await page.computed(S('title'), props);
                const generic = await page.computed(S('title-div'), props);

                assert.deepEqual(generic, semantic,
                    'a role that renders differently on <h1> than on <div> is a trap - '
                    + 'the whole reason the block roles zero the UA margin');
            });
        });

        test('heading: 20px / 500 / --ui-text ink, line-height 1.3', async () => {
            await browser.withPage({ geometry }, async (page) => {
                await page.mount(MARKUP, FIXTURE);

                const got = await page.computed(S('heading'),
                    ['font-size', 'font-weight', 'color', 'line-height', 'margin-top']);

                assert.equal(got['font-size'], '20px');
                assert.equal(got['font-weight'], '500');
                assert.equal(got.color, await page.resolveToken('--ui-text', 'color'));
                near(got['line-height'], 20 * 1.3, 0.5, 'heading line-height is 1.3');
                assert.equal(got['margin-top'], '0px');
            });
        });

        test('caption: 16px / 400 / --ui-muted, capped at --ui-measure and well short of its container', async () => {
            await browser.withPage({ geometry }, async (page) => {
                await page.mount(MARKUP, FIXTURE);

                const got = await page.computed(S('caption'), [
                    'font-size', 'font-weight', 'color', 'line-height', 'display',
                    'max-inline-size', 'margin-top', 'text-align',
                ]);

                assert.equal(got['font-size'], '16px');
                assert.equal(got['font-weight'], '400');
                assert.equal(got.color, await page.resolveToken('--ui-muted', 'color'));
                near(got['line-height'], 16 * 1.5, 0.5, 'caption line-height is 1.5');
                assert.equal(got.display, 'block');
                assert.equal(got['margin-top'], '0px');
                assert.equal(got['text-align'], 'start');

                /* 70ch, resolved by the engine against the caption's own font. The
                 * assertion that matters is the SHAPE: the copy stops at the cap and
                 * does not run the width of a wall panel. */
                const cap = px(got['max-inline-size']);
                const box = await page.box(S('caption'));
                const frame = await page.box('#frame');

                assert.ok(cap > 0 && Number.isFinite(cap), `70ch resolved to ${got['max-inline-size']}`);
                near(box.width, cap, 1, 'the caption fills its measure');
                assert.ok(box.width < frame.width - 40,
                    `the caption (${box.width}) must stop short of its container (${frame.width})`);
            });
        });

        test('body: 17px / 400, and no ink of its own', async () => {
            await browser.withPage({ geometry }, async (page) => {
                await page.mount(MARKUP, FIXTURE);

                const got = await page.computed(S('body'),
                    ['font-size', 'font-weight', 'color', 'line-height']);

                assert.equal(got['font-size'], '17px');
                assert.equal(got['font-weight'], '400');
                near(got['line-height'], 17 * 1.5, 0.5, 'body line-height is 1.5');
                assert.equal(got.color, await page.resolveToken('--ui-text', 'color'),
                    'inherited from styles/document.css, not declared by the role');
            });
        });

        test('microcap: 15px / 700 / --ui-muted / uppercase / --ui-tracking-cap', async () => {
            await browser.withPage({ geometry }, async (page) => {
                await page.mount(MARKUP, FIXTURE);

                const got = await page.computed(S('microcap'),
                    ['font-size', 'font-weight', 'color', 'text-transform',
                        'letter-spacing', 'line-height']);

                assert.equal(got['font-size'], '15px');
                assert.equal(got['text-transform'], 'uppercase');
                assert.equal(got.color, await page.resolveToken('--ui-muted', 'color'));
                near(got['line-height'], 15 * 1.2, 0.5, 'microcap line-height is 1.2');
            });
        });

        test('numeric is a modifier: tabular figures, and nothing else', async () => {
            await browser.withPage({ geometry }, async (page) => {
                await page.mount(MARKUP, FIXTURE);

                const inside = await page.computed(S('numeric-inline'),
                    ['font-variant-numeric', 'font-size', 'font-weight', 'color']);
                const host = await page.computed(S('body'),
                    ['font-size', 'font-weight', 'color']);

                assert.deepEqual(
                    inside['font-variant-numeric'].split(/\s+/).sort(),
                    ['lining-nums', 'tabular-nums'],
                );
                assert.equal(inside['font-size'], host['font-size']);
                assert.equal(inside['font-weight'], host['font-weight']);
                assert.equal(inside.color, host.color);
            });
        });

        test('tabular figures are real: two equal-length digit strings occupy the same width', async () => {
            await browser.withPage({ geometry }, async (page) => {
                await page.mount(MARKUP, FIXTURE);

                const a = await page.box(S('numeric-a'));
                const b = await page.box(S('numeric-b'));

                near(`${a.width}px`, b.width, 0.5,
                    'tabular-nums: a changing readout must not jitter');
            });
        });

        test('the drill: every role value moves with its token and lands on it', async () => {
            await browser.withPage({ geometry }, async (page) => {
                await page.mount(MARKUP, FIXTURE);

                await assertTokenDrill(page, {
                    token: '--ui-text-xl', value: DRILL_LENGTH,
                    selector: S('title'), property: 'font-size',
                });
                await assertTokenDrill(page, {
                    token: '--ui-text-lg', value: DRILL_LENGTH,
                    selector: S('heading'), property: 'font-size',
                });
                await assertTokenDrill(page, {
                    token: '--ui-text-note', value: DRILL_LENGTH,
                    selector: S('caption'), property: 'font-size',
                });
                await assertTokenDrill(page, {
                    token: '--ui-text-base', value: DRILL_LENGTH,
                    selector: S('body'), property: 'font-size',
                });
                await assertTokenDrill(page, {
                    token: '--ui-text-sm', value: DRILL_LENGTH,
                    selector: S('microcap'), property: 'font-size',
                });
                await assertTokenDrill(page, {
                    token: '--ui-muted', value: DRILL_COLOUR,
                    selector: S('caption'), property: 'color',
                });
                await assertTokenDrill(page, {
                    token: '--ui-text', value: DRILL_COLOUR,
                    selector: S('title'), property: 'color',
                });
                await assertTokenDrill(page, {
                    token: '--ui-weight-medium', value: '800',
                    selector: S('heading'), property: 'font-weight',
                });
                await assertTokenDrill(page, {
                    token: '--ui-weight-semibold', value: '200',
                    selector: S('microcap'), property: 'font-weight',
                });
                await assertTokenDrill(page, {
                    token: '--ui-tracking-cap', value: DRILL_LENGTH,
                    selector: S('microcap'), property: 'letter-spacing',
                });
                await assertTokenDrill(page, {
                    token: '--ui-measure', value: DRILL_LENGTH,
                    selector: S('caption'), property: 'max-inline-size',
                });
                await assertTokenDrill(page, {
                    token: '--ui-display-md', value: DRILL_LENGTH,
                    selector: S('readout'), property: 'font-size',
                });
            });
        });

        test('the microcap is Slate\'s own 600, and the departure is closed', async () => {
            await browser.withPage({ geometry }, async (page) => {
                await page.mount(MARKUP, FIXTURE);

                const weight = await page.prop(S('microcap'), 'font-weight');
                assert.equal(weight, '600', 'the microcap role is Slate\'s semibold');
                assert.equal(weight, await page.tokenValue('--ui-weight-semibold'));
            });
        });

        test('the microcap tracks Slate\'s 1.8px', async () => {
            await browser.withPage({ geometry }, async (page) => {
                await page.mount(MARKUP, FIXTURE);

                const tracking = await page.prop(S('microcap'), 'letter-spacing');
                near(tracking, 1.8, 0.05, 'microcap tracking is .12em at 15px');
                assert.ok(Math.abs(px(tracking) - 0.6) > 1, `the .04em departure is gone, got ${tracking}`);
            });
        });

        test('departure: the numeric role does not restate the font family', async () => {
            await browser.withPage({ geometry }, async (page) => {
                await page.mount(MARKUP, FIXTURE);

                const before = await page.prop(S('numeric-inline'), 'font-family');
                assert.match(before, /Geist/);

                await page.setStyle('#frame', { 'font-family': 'monospace' });
                const after = await page.prop(S('numeric-inline'), 'font-family');
                assert.equal(after, 'monospace',
                    'a restated family token would have pinned this back to Geist');
            });
        });

        test('a component\'s bare element selector beats a role, with no !important', async () => {
            await browser.withPage({ geometry }, async (page) => {
                await page.mount(MARKUP, FIXTURE);

                const overridden = await page.prop(S('override'), 'font-size');
                const heading = await page.prop(S('heading'), 'font-size');

                assert.equal(overridden, '16px', 'the component rule wins');
                assert.equal(heading, '20px', 'and only for the element it names');
                assert.notEqual(overridden, heading);
            });
        });

        test('T11 does not recur: a component that wants centred copy gets it', async () => {
            await browser.withPage({ geometry }, async (page) => {
                await page.mount(MARKUP, FIXTURE);

                assert.equal(await page.prop(S('caption'), 'text-align'), 'start');
                assert.equal(await page.prop(S('caption-centred'), 'text-align'), 'center');
            });
        });

        test('T11, the half specificity cannot reach: centring an ANCESTOR reaches the type', async () => {
            await browser.withPage({ geometry }, async (page) => {
                await page.mount(MARKUP, FIXTURE);

                const roles = ['title', 'title-div', 'heading', 'caption', 'body'];

                await page.setStyle('#frame', { 'text-align': 'center' });
                for (const id of roles) {
                    assert.equal(await page.prop(S(id), 'text-align'), 'center',
                        `#${id} did not follow the ancestor's centring - that is bug T11`);
                }

                /* And back: nothing is latched, and the initial value returns. */
                await page.setStyle('#frame', { 'text-align': 'start' });
                for (const id of roles) {
                    assert.equal(await page.prop(S(id), 'text-align'), 'start', `#${id}`);
                }
            });
        });

        test('the module does nothing until a class asks for it', async () => {
            await browser.withPage({ geometry }, async (page) => {
                await page.mount(MARKUP, FIXTURE);

                const unroled = await page.computed(S('unroled'),
                    ['font-size', 'font-weight', 'text-transform', 'font-variant-numeric']);

                assert.equal(unroled['text-transform'], 'none');
                assert.equal(unroled['font-variant-numeric'], 'normal');
                assert.equal(unroled['font-weight'], '400');
                assert.notEqual(unroled['font-size'], '28px');
            });
        });

        test('a role in the LIGHT DOM is inert until adoptTypeRoles asks for it', async () => {
            await browser.withPage({ geometry }, async (page) => {
                await page.mount(MARKUP, FIXTURE);

                /* Built the way a driver outside the component layer builds one
                 * createElement plus a class name, which is verbatim what
                 * test/fixtures/editor-shell-fixture.js does. */
                await page.evalFn(() => {
                    const span = document.createElement('span');
                    span.id = 'light-caption';
                    span.className = 'ui-caption';
                    span.textContent = 'Explanatory copy under a label.';
                    document.body.append(span);
                    return true;
                });
                await page.settle();

                const muted = await page.resolveToken('--ui-muted', 'color');
                const inert = await page.computed('#light-caption',
                    ['color', 'max-inline-size', 'display']);

                assert.notEqual(inert.color, muted,
                    'THE TRAP: the class alone reaches no rule, so the ink is inherited');
                assert.equal(inert['max-inline-size'], 'none', 'and there is no measure cap');
                assert.equal(inert.display, 'inline', 'and a span is still an inline span');

                /* THE DOOR. Imported in the page, so what is exercised is the export
                 * a fixture would call and not a copy of its two lines. */
                await page.eval("import('/src/components/type-roles.js')"
                    + '.then(function (m) { m.adoptTypeRoles(document); return true; })');
                await page.settle();

                const live = await page.computed('#light-caption',
                    ['color', 'max-inline-size', 'display', 'font-size', 'font-weight']);

                assert.equal(live.color, muted, 'the caption ink is --ui-muted');
                assert.equal(live.display, 'block');
                assert.equal(live['font-size'], '16px');
                assert.equal(live['font-weight'], '400');
                near(live['max-inline-size'],
                    px(await page.prop(S('caption'), 'max-inline-size')), 1,
                    'the same --ui-measure the shadow-root caption is capped at');
            });
        });

        test('neither scale moves when the container narrows', async () => {
            await browser.withPage({ geometry }, async (page) => {
                await page.mount(MARKUP, FIXTURE);

                const wide = await page.computed(S('readout'), ['font-size']);
                const wideTitle = await page.prop(S('title'), 'font-size');

                await page.setStyle('#frame', { 'inline-size': '600px' });

                const narrow = await page.computed(S('readout'), ['font-size']);
                const narrowTitle = await page.prop(S('title'), 'font-size');

                assert.equal(narrow['font-size'], wide['font-size'],
                    `display type holds its size: ${wide['font-size']} -> ${narrow['font-size']}`);
                assert.equal(narrow['font-size'], '42px', 'and it is Slate\'s --slate-display-md');
                assert.equal(narrowTitle, wideTitle,
                    'the UI scale is fixed px, never fluid (spec §2.2): legibility is a floor');
                assert.equal(narrowTitle, '28px');
            });
        });

        test('text-transform is paint: the accessible name keeps the authored case', async () => {
            await browser.withPage({ geometry }, async (page) => {
                await page.mount(MARKUP, FIXTURE);

                const rendered = await page.prop(S('microcap'), 'text-transform');
                const name = await page.evalFn(
                    (s) => window.__h.need(s).textContent.trim(),
                    S('microcap'),
                );

                assert.equal(rendered, 'uppercase');
                assert.equal(name, 'Pressure',
                    'a screen reader announces the authored case; only the paint shouts');
            });
        });
    });
}
