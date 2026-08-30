/**
 *.5 (the bench truth) and the 1000×600 floor.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES, BENCH, FLOOR } from '../harness/index.js';
import {
    assertTokenDrill,
    assertFocusUnclipped,
    DRILL_COLOUR,
    DRILL_LENGTH,
} from '../harness/assertions.js';

const MODULE = ['/src/components/ui-empty-state.js'];

const MARKUP = `
    <ui-empty-state id="plain" heading="No settings match your search"
        >Try a shorter search, or clear it to see every category.</ui-empty-state>

    <ui-empty-state id="boxed" boxed heading="No Decent account linked">
        <svg slot="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.5 8.5 0 1 1 16.1-3.8z"/>
        </svg>
        Messages to support are sent from your Decent account.
        <button slot="actions" type="button">Clear search</button>
    </ui-empty-state>

    <ui-empty-state id="bare" boxed heading="No sub-categories"></ui-empty-state>

    <ui-empty-state id="prosed" heading="No settings match your search"
        body="Try a shorter search, or clear it to see every category."></ui-empty-state>

    <ui-empty-state id="slotted" boxed heading="No Decent account linked">
        <p class="slate-caption">Messages to support are sent from your Decent account.</p>
    </ui-empty-state>

    <ui-empty-state id="focusable" tabindex="0" heading="Focusable"></ui-empty-state>
    <ui-empty-state id="clipped" tabindex="0" focus-ring="inset" heading="Inset"></ui-empty-state>
`;

const T11_PRESSURE = `
    /* slate-shell.css:1326-1328 — [class*="text-center"] { text-align: left !important } */
    ui-empty-state, ui-empty-state * { text-align: left !important; }
    /* slate-shell.css:1304-1306 — .flex.flex-col.items-center { align-items: stretch !important } */
    ui-empty-state, ui-empty-state * { align-items: flex-start !important; justify-items: start !important; }
    /* slate-shell.css:1244-1250 — #settings-content-area > * { padding-inline: 0 !important } */
    ui-empty-state, ui-empty-state * { padding-left: 0 !important; padding-right: 0 !important; }
    /* slate-components.css:109-118 — .slate-caption { text-align: left !important } */
    ui-empty-state p, ui-empty-state div { text-align: left !important; }
`;

const T11_FLEX_HOST = `
    ui-empty-state {
        display: flex;
        justify-content: flex-start;
        align-items: flex-start;
        text-align: left;
    }
`;

/** The same reach-in through a content-sized grid track — the stated limit. */
const T11_GRID_TRACK = `
    ui-empty-state { display: grid; justify-content: start; }
`;

/** Put a sheet in the document and let layout settle. */
const pressure = async (page, css) => {
    await page.evalFn((text) => {
        const el = document.createElement('style');
        el.textContent = text;
        document.head.append(el);
        return true;
    }, css);
    await page.settle(2);
};

/** Centre-to-centre, in CSS px, between an inner box and its host box. */
const centreOffset = (host, inner) =>
    Math.abs((inner.left + inner.width / 2) - (host.left + host.width / 2));

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`ui-empty-state @ ${geometry.name} (${geometry.width}×${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

        const mounted = (fn) => browser.withPage({ geometry }, async (page) => {
            await page.mount(MARKUP, MODULE);
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

        test('T11: the block is centred at rest, on both axes', () => mounted(async (page) => {
            const s = await page.computed('#plain >>> #empty', ['text-align', 'justify-items', 'align-content']);
            assert.equal(s['text-align'], 'center', 'declared, not inherited — that is the whole fix');
            assert.equal(s['justify-items'], 'center');
            assert.equal(s['align-content'], 'center');

            const host = await page.box('#plain');
            const heading = await page.box('#plain >>> #heading');
            assert.ok(
                centreOffset(host, heading) < 0.5,
                `the heading is off-centre by ${centreOffset(host, heading)}px`,
            );
        }));

        test('T11: the three shell rules cannot left-align it', () => mounted(async (page) => {
            await page.evalFn((css) => {
                const el = document.createElement('style');
                el.textContent = css;
                document.head.append(el);
                return true;
            }, T11_PRESSURE);
            await page.settle(2);

            assert.equal(
                await page.prop('#boxed', 'text-align'), 'left',
                'the pressure did not apply — this assertion would be vacuous',
            );

            const s = await page.computed('#boxed >>> #empty', ['text-align', 'justify-items']);
            assert.equal(s['text-align'], 'center', 'T11 reproduced: the shell rule reached inside');
            assert.equal(s['justify-items'], 'center', 'T11 reproduced: the cross axis moved');

            const host = await page.box('#boxed');
            const empty = await page.box('#boxed >>> #empty');
            assert.equal(empty.width, host.width, 'the block was shrink-wrapped by the host\'s alignment');

            for (const id of ['#heading', '#body', '#icon']) {
                const inner = await page.box(`#boxed >>> ${id}`);
                assert.ok(
                    centreOffset(host, inner) < 0.5,
                    `${id} is off-centre by ${centreOffset(host, inner)}px under the T11 rules`,
                );
            }
        }));

        test('T11: a flex-layout host cannot shrink-wrap or left-align the block', () =>
            mounted(async (page) => {
                await pressure(page, T11_FLEX_HOST);
                assert.equal(
                    await page.prop('#boxed', 'display'), 'flex',
                    'the pressure did not apply — this assertion would be vacuous',
                );

                const host = await page.box('#boxed');
                const empty = await page.box('#boxed >>> #empty');
                assert.equal(empty.width, host.width, 'the flex host shrink-wrapped the block');

                for (const id of ['#heading', '#body', '#icon']) {
                    const inner = await page.box(`#boxed >>> ${id}`);
                    assert.ok(
                        centreOffset(host, inner) < 0.5,
                        `${id} is off-centre by ${centreOffset(host, inner)}px under a flex host`,
                    );
                }

                // border-box, so filling the host cannot make the document scroll.
                const overflow = await page.evalFn(() =>
                    document.documentElement.scrollWidth - document.documentElement.clientWidth);
                assert.equal(overflow, 0, 'the block escaped its host');
            }));

        test('T11: the stated limit — a content-sized track is the HOST\'s box, not ours', () =>
            mounted(async (page) => {
                await pressure(page, T11_GRID_TRACK);
                const host = await page.box('#boxed');
                const empty = await page.box('#boxed >>> #empty');
                assert.ok(empty.width < host.width, 'the documented limit no longer reproduces');

                assert.equal(await page.prop('#boxed >>> #empty', 'text-align'), 'center');
                const heading = await page.box('#boxed >>> #heading');
                assert.ok(
                    centreOffset(empty, heading) < 0.5,
                    'the block is narrower, but its own contents stay centred in it',
                );
            }));

        test('T11: the prose is centred too — the fourth mechanism is dropped', () => mounted(async (page) => {
            assert.equal(await page.prop('#boxed >>> #body', 'text-align'), 'center');
        }));

        test('T11: prose passed as `body` is out of reach; slotted prose is the stated limit', () =>
            mounted(async (page) => {
                await pressure(page, T11_PRESSURE);
                assert.equal(
                    await page.prop('#slotted p', 'text-align'), 'left',
                    'the pressure did not reach the light tree — this would be vacuous',
                );

                assert.equal(await page.prop('#prosed >>> #prose', 'text-align'), 'center',
                    'the `body` property renders inside the root: nothing can name it');
                assert.equal(await page.prop('#prosed >>> #prose', 'color'),
                    await page.resolveToken('--ui-muted', 'color'),
                    'and it inherits the caption treatment, same as slotted prose');

                const reach = await page.evalFn(() => document.querySelectorAll(
                    'ui-empty-state #prose, ui-empty-state .prose').length);
                assert.equal(reach, 0, 'no selector outside the root reaches the rendered prose');
            }));

        test('slotted prose loses its UA margin, so the oracle\'s inner gap is the rendered gap', () =>
            mounted(async (page) => {
                const m = await page.computed('#slotted p', ['margin-top', 'margin-bottom']);
                assert.deepEqual(m, { 'margin-top': '0px', 'margin-bottom': '0px' });

                const heading = await page.box('#slotted >>> #heading');
                const prose = await page.box('#slotted p');
                const gap = prose.top - (heading.top + heading.height);
                assert.ok(Math.abs(gap - 8) < 0.5, `heading→prose gap is ${gap}px, not --ui-space-2`);
            }));

        test('the `body` property and the slot are two ways in, and both render', () =>
            mounted(async (page) => {
                const parts = await page.evalFn(() => {
                    const el = document.getElementById('prosed');
                    return {
                        prose: el.shadowRoot.getElementById('prose')?.textContent ?? null,
                        bodyShown: getComputedStyle(el.shadowRoot.getElementById('body')).display,
                        slotEmpty: el.shadowRoot.querySelector('slot:not([name])')
                            .assignedNodes({ flatten: true }).length,
                        bareBody: document.getElementById('bare').shadowRoot
                            .getElementById('body').className,
                    };
                });
                assert.equal(parts.prose, 'Try a shorter search, or clear it to see every category.');
                assert.notEqual(parts.bodyShown, 'none', 'a property-only body must not collapse');
                assert.equal(parts.slotEmpty, 0, 'and it needs nothing slotted');
                assert.match(parts.bareBody, /is-empty/, 'neither one still collapses');
            }));

        test('T11: nothing outside the root can name the block that carries the alignment', () =>
            mounted(async (page) => {
                const reach = await page.evalFn(() => ({
                    deep: document.querySelectorAll('ui-empty-state #empty, ui-empty-state .empty').length,
                    lightChildren: document.querySelector('#plain').children.length,
                }));
                assert.equal(reach.deep, 0, 'a screen sheet has no selector that reaches .empty');
                assert.equal(reach.lightChildren, 0, '#plain slots text only');
            }));

        test('T11 is fixed with zero !important', () => mounted(async (page) => {
            const important = await page.evalFn(() => {
                const root = document.querySelector('#plain').shadowRoot;
                return [...root.adoptedStyleSheets]
                    .flatMap((sheet) => [...sheet.cssRules])
                    .map((r) => r.cssText)
                    .filter((t) => /!important/.test(t));
            });
            assert.deepEqual(important, [], 'zero !important in the component\'s own rules');
        }));

        test('drill: --ui-space-7 moves the well\'s inset', () => mounted(async (page) => {
            const drill = await assertTokenDrill(page, {
                token: '--ui-space-7',
                value: DRILL_LENGTH,
                selector: '#boxed >>> #empty',
                property: 'padding-left',
            });
            assert.equal(drill.before, '40px', '--ui-space-7, the snapped inset');
        }));

        test('drill: --ui-space-6 moves the plain block\'s inset', () => mounted(async (page) => {
            const drill = await assertTokenDrill(page, {
                token: '--ui-space-6',
                value: DRILL_LENGTH,
                selector: '#plain >>> #empty',
                property: 'padding-left',
            });
            assert.equal(drill.before, '28px', '--ui-space-6');
        }));

        test('drill: --ui-key moves the well\'s ground', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-key',
                value: DRILL_COLOUR,
                selector: '#boxed >>> #empty',
                property: 'background-color',
            });
            const key = await page.resolveToken('--ui-key', 'background-color');
            assert.equal(await page.prop('#boxed >>> #empty', 'background-color'), key);
        }));

        test('drill: --ui-line moves the well\'s dashed edge', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-line',
                value: DRILL_COLOUR,
                selector: '#boxed >>> #empty',
                property: 'border-top-color',
            });
            const s = await page.computed('#boxed >>> #empty', ['border-top-width', 'border-top-style']);
            assert.equal(s['border-top-width'], '2px');
            assert.equal(s['border-top-style'], 'dashed');
        }));

        test('drill: --ui-control-h moves the glyph disc, --ui-key-on its ground', () =>
            mounted(async (page) => {
                const box = await page.box('#boxed >>> #icon');
                assert.deepEqual([box.width, box.height], [64, 64], 'the measured disc');

                await assertTokenDrill(page, {
                    token: '--ui-control-h',
                    value: DRILL_LENGTH,
                    selector: '#boxed >>> #icon',
                    property: 'inline-size',
                });
                await assertTokenDrill(page, {
                    token: '--ui-key-on',
                    value: DRILL_COLOUR,
                    selector: '#boxed >>> #icon',
                    property: 'background-color',
                });
            }));

        test('drill: --ui-text-md and --ui-weight-medium move the heading', () => mounted(async (page) => {
            const drill = await assertTokenDrill(page, {
                token: '--ui-text-md',
                value: DRILL_LENGTH,
                selector: '#plain >>> #heading',
                property: 'font-size',
            });
            assert.equal(drill.before, '18px', 'the oracle\'s measured heading size');
            assert.equal(await page.prop('#plain >>> #heading', 'font-weight'), '500');
        }));

        test('drill: --ui-muted moves the prose and the glyph ink together', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-muted',
                value: DRILL_COLOUR,
                selector: '#boxed >>> #body',
                property: 'color',
            });
            const muted = await page.resolveToken('--ui-muted', 'color');
            assert.equal(await page.prop('#boxed >>> #icon', 'color'), muted);
            assert.equal(await page.prop('#boxed >>> #body', 'font-size'), '16px', '--ui-text-note');
        }));

        test('drill: --ui-text moves the heading ink across the shadow boundary', () =>
            mounted(async (page) => {
                await assertTokenDrill(page, {
                    token: '--ui-text',
                    value: DRILL_COLOUR,
                    selector: '#plain >>> #heading',
                    property: 'color',
                });
            }));

        test('drill: --ui-space-4 moves the gap the oracle measured', () => mounted(async (page) => {
            const drill = await assertTokenDrill(page, {
                token: '--ui-space-4',
                value: DRILL_LENGTH,
                selector: '#boxed >>> #empty',
                property: 'row-gap',
            });
            assert.equal(drill.before, '18px');
            assert.equal(await page.prop('#boxed >>> #text', 'row-gap'), '8px');
        }));

        test('the radius is a step in the vocabulary, not Slate\'s off-scale 20px', () =>
            mounted(async (page) => {
                const lg = await page.resolveToken('--ui-radius-lg', 'border-top-left-radius');
                assert.equal(await page.prop('#boxed >>> #empty', 'border-top-left-radius'), lg);
                const disc = await page.box('#boxed >>> #icon');
                const r = parseFloat(await page.prop('#boxed >>> #icon', 'border-top-left-radius'));
                assert.ok(r >= disc.width / 2, `${r}px does not round a ${disc.width}px disc`);
            }));

        test('P21: with no glyph the disc is not drawn at all', () => mounted(async (page) => {
            assert.equal(await page.prop('#bare >>> #icon', 'display'), 'none');
            const box = await page.box('#bare >>> #icon');
            assert.deepEqual([box.width, box.height], [0, 0]);

            // And it costs no gap either: the well is heading-only.
            const empty = await page.box('#bare >>> #empty');
            const heading = await page.box('#bare >>> #heading');
            const pad = parseFloat(await page.prop('#bare >>> #empty', 'padding-top'));
            const border = parseFloat(await page.prop('#bare >>> #empty', 'border-top-width'));
            assert.ok(
                Math.abs((heading.top - empty.top) - (pad + border)) < 0.5,
                'a hidden part must not contribute a gap row',
            );
        }));

        test('an absent action row and an absent body contribute nothing', () => mounted(async (page) => {
            for (const id of ['#body', '#actions']) {
                assert.equal(await page.prop(`#bare >>> ${id}`, 'display'), 'none', id);
            }
            // …and the filled one is present, so the flag is real and not always false.
            assert.equal(await page.prop('#boxed >>> #actions', 'display'), 'flex');
            assert.equal(await page.prop('#boxed >>> #icon', 'display'), 'grid');
        }));

        test('an empty state is not interactive and takes no focus of its own', () =>
            mounted(async (page) => {
                const probe = await page.evalFn(() => {
                    const el = document.querySelector('#plain');
                    el.focus();
                    return {
                        tabindex: el.getAttribute('tabindex'),
                        focused: document.activeElement === el,
                        interactive: el.shadowRoot.querySelectorAll(
                            'a[href], button, input, select, textarea, summary, [tabindex]',
                        ).length,
                    };
                });
                assert.deepEqual(probe, { tabindex: null, focused: false, interactive: 0 });
            }));

        test('when a consumer makes it focusable it gets the one ring, unclipped', () =>
            mounted(async (page) => {
                const g = await assertFocusUnclipped(page, '#focusable');
                assert.equal(g.outlineOffset, '2px', '--ui-focus-offset');
                assert.deepEqual(g.clippers, [], 'nothing clips it in an open pane');

                await assertTokenDrill(page, {
                    token: '--ui-steel',
                    value: DRILL_COLOUR,
                    selector: '#focusable',
                    property: 'outline-color',
                    prepare: (p) => p.focusVisible('#focusable'),
                });
            }));

        test('focus-ring="inset" is the same treatment at the second offset', () =>
            mounted(async (page) => {
                const g = await assertFocusUnclipped(page, '#clipped');
                assert.equal(g.outlineOffset, '-3px', '--ui-focus-offset-inset');
                assert.equal(
                    await page.prop('#clipped', 'outline-width'),
                    await page.prop('#focusable', 'outline-width'),
                    'one width, two offsets',
                );
            }));

        test('the block follows its container, not the viewport', () => mounted(async (page) => {
            await page.setStyle('#plain', { 'inline-size': '380px' });
            const narrow = await page.box('#plain >>> #empty');
            const narrowText = await page.box('#plain >>> #text');

            await page.setStyle('#plain', { 'inline-size': '900px' });
            const wide = await page.box('#plain >>> #empty');
            const wideText = await page.box('#plain >>> #text');

            assert.equal(narrow.width, 380, 'the block fills its host');
            assert.equal(wide.width, 900);
            assert.ok(wideText.width > narrowText.width, 'the prose column follows the container');

            // Physical tokens do not shrink with the box: the inset is the same at both.
            assert.equal(
                await page.prop('#plain >>> #empty', 'padding-left'), '28px',
                'the inset is a token, not a fraction of the container',
            );
        }));

        test('the prose is measure-capped, so a wide pane does not run a 150-character line', () =>
            mounted(async (page) => {
                await page.setStyle('#plain', { 'inline-size': '1200px' });
                const measure = parseFloat(await page.prop('#plain >>> #text', 'max-inline-size'));
                const text = await page.box('#plain >>> #text');
                assert.ok(measure > 0, '--ui-measure resolves to a length');
                assert.ok(
                    text.width <= measure + 0.5,
                    `the prose column ran to ${text.width}px against a ${measure}px measure`,
                );
                // …and it is still centred in the wide pane, which is the whole point.
                const host = await page.box('#plain');
                assert.ok(centreOffset(host, text) < 0.5);
            }));

        test('it centres inside a pane taller than its content, and does not clip a taller one', () =>
            mounted(async (page) => {
                await page.setStyle('#plain', { 'block-size': '420px' });
                const host = await page.box('#plain');
                const empty = await page.box('#plain >>> #empty');
                const text = await page.box('#plain >>> #text');
                assert.equal(empty.height, 420, 'min-block-size: 100% is Slate\'s h-full');
                const vertical = Math.abs(
                    (text.top + text.height / 2) - (host.top + host.height / 2),
                );
                assert.ok(vertical < 0.5, `the block is ${vertical}px off the vertical centre`);

                await page.setStyle('#plain', { 'block-size': '20px', 'inline-size': '240px' });
                const squeezed = await page.box('#plain >>> #empty');
                assert.ok(squeezed.height > 20, `min-block-size clipped at ${squeezed.height}px`);
            }));

        test('no viewport query anywhere in the component\'s own rules', () => mounted(async (page) => {
            const media = await page.evalFn(() => {
                const root = document.querySelector('#plain').shadowRoot;
                return [...root.adoptedStyleSheets]
                    .flatMap((sheet) => [...sheet.cssRules])
                    .filter((r) => r.constructor.name === 'CSSMediaRule')
                    .map((r) => r.conditionText);
            });
            assert.deepEqual(media, [], 'container queries only');
        }));

        test('the glyph is decorative and the words are the accessible content', () =>
            mounted(async (page) => {
                assert.equal(
                    await page.evalFn(() =>
                        document.querySelector('#boxed').shadowRoot
                            .getElementById('icon').getAttribute('aria-hidden')),
                    'true',
                );
                // No invented roles: an empty state is prose in the reading order.
                const roles = await page.evalFn(() =>
                    [...document.querySelector('#boxed').shadowRoot.querySelectorAll('[role]')]
                        .map((el) => el.getAttribute('role')));
                assert.deepEqual(roles, []);
                assert.equal(
                    await page.evalFn(() =>
                        document.querySelector('#plain').shadowRoot
                            .getElementById('heading').textContent.trim()),
                    'No settings match your search',
                );
            }));

        test('the component declares no --ui-* of its own', () => mounted(async (page) => {
            const declared = await page.evalFn(() => {
                const root = document.querySelector('#plain').shadowRoot;
                return [...root.adoptedStyleSheets]
                    .flatMap((sheet) => [...sheet.cssRules])
                    .flatMap((rule) => (rule.style ? [...rule.style] : []))
                    .filter((prop) => prop.startsWith('--') && !prop.startsWith('--_ui-'));
            });
            assert.deepEqual([...new Set(declared)], []);
        }));
    });
}

test('the same container renders the same block at both standard geometries', async () => {
    const read = (geometry) => browser.withPage({ geometry }, async (page) => {
        await page.mount(MARKUP, MODULE);
        await page.setStyle('#boxed', { 'inline-size': '560px' });
        const host = await page.box('#boxed');
        const text = await page.box('#boxed >>> #text');
        return {
            dpr: await page.eval('devicePixelRatio'),
            disc: (await page.box('#boxed >>> #icon')).width,
            inset: await page.prop('#boxed >>> #empty', 'padding-left'),
            headingSize: await page.prop('#boxed >>> #heading', 'font-size'),
            centred: centreOffset(host, text) < 0.5,
        };
    });

    const bench = await read(BENCH);
    const floor = await read(FLOOR);

    assert.equal(bench.dpr, 1.5);
    assert.equal(floor.dpr, 1);
    assert.equal(bench.disc, floor.disc, 'the disc is a token, not a fraction of the viewport');
    assert.equal(bench.inset, floor.inset);
    assert.equal(bench.headingSize, floor.headingSize);
    assert.ok(bench.centred && floor.centred, 'centred at both geometries');
});

test('the well repaints from the token sheet in both themes', async () => {
    const read = (theme) => browser.withPage({ geometry: BENCH, theme }, async (page) => {
        await page.mount(MARKUP, MODULE);
        return {
            ground: await page.prop('#boxed >>> #empty', 'background-color'),
            edge: await page.prop('#boxed >>> #empty', 'border-top-color'),
            disc: await page.prop('#boxed >>> #icon', 'background-color'),
            ink: await page.prop('#boxed >>> #body', 'color'),
            expected: {
                ground: await page.resolveToken('--ui-key', 'background-color'),
                edge: await page.resolveToken('--ui-line', 'border-top-color'),
                disc: await page.resolveToken('--ui-key-on', 'background-color'),
                ink: await page.resolveToken('--ui-muted', 'color'),
            },
        };
    });

    for (const theme of ['dark', 'light']) {
        const m = await read(theme);
        assert.deepEqual(
            { ground: m.ground, edge: m.edge, disc: m.disc, ink: m.ink },
            m.expected,
            `${theme}: a painted value did not come from its token`,
        );
    }

    const dark = await read('dark');
    const light = await read('light');
    assert.notEqual(dark.ground, light.ground, 'the two themes must actually differ');
});
