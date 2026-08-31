/**
 * the render harness for.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES, BENCH, FLOOR } from '../harness/index.js';
import { assertTokenDrill, assertHitFloor, DRILL_COLOUR, DRILL_LENGTH } from '../harness/assertions.js';

const MODULES = ['/src/components/ui-text-field.js'];
const FIELD = 'ui-text-field >>> #field';
const INPUT = 'ui-text-field >>> #control';
const LABEL = 'ui-text-field >>> #label';

const PLAIN = '<ui-text-field placeholder="Search profiles"></ui-text-field>';
const LABELLED = '<ui-text-field label="Scale host" value="192.0.2.42"></ui-text-field>';

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

async function assertRing(page, { ring, focus, offsetToken }) {
    await page.focusVisible(focus);

    const inner = await page.focusGeometry(focus);
    assert.ok(inner.focusVisible, `${focus} does not match :focus-visible after a keyboard focus`);
    assert.equal(
        inner.outlineStyle, 'none',
        'the input must paint NO ring of its own — one treatment, drawn once (spec §3.6)',
    );

    const g = await page.focusGeometry(ring);
    const width = await page.resolveValue('var(--ui-focus-w)', 'outline-width');
    const colour = await page.resolveValue('var(--ui-steel)', 'outline-color');
    const offset = await page.resolveValue(`var(${offsetToken})`, 'outline-offset');

    assert.notEqual(g.outlineStyle, 'none', `${ring} paints no focus ring at all`);
    assert.equal(g.outlineWidth, width, `${ring}'s ring is not --ui-focus-w`);
    assert.equal(g.outlineColor, colour, `${ring}'s ring is not --ui-steel`);
    assert.equal(g.outlineOffset, offset, `${ring}'s offset is not ${offsetToken}`);

    const clipped = g.clippers
        .map((c) => {
            const sides = [];
            if (g.ringRect.top < c.top - 0.5) sides.push('top');
            if (g.ringRect.left < c.left - 0.5) sides.push('left');
            if (g.ringRect.bottom > c.bottom + 0.5) sides.push('bottom');
            if (g.ringRect.right > c.right + 0.5) sides.push('right');
            return { anchor: c.anchor, sides };
        })
        .filter((c) => c.sides.length);

    assert.deepEqual(clipped, [], `bug L24's class: ${ring}'s ring is clipped — ${JSON.stringify(clipped)}`);
    return g;
}

async function lineBoxFit(page, selector) {
    return page.evalFn((sel) => {
        const input = window.__h.need(sel);
        const cs = getComputedStyle(input);
        const probe = document.createElement('div');
        probe.textContent = input.value;
        probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;padding:0;border:0;'
            + 'font-family:' + cs.fontFamily + ';font-size:' + cs.fontSize
            + ';font-weight:' + cs.fontWeight + ';font-style:' + cs.fontStyle
            + ';line-height:' + cs.lineHeight + ';letter-spacing:' + cs.letterSpacing;
        input.parentNode.appendChild(probe);
        const lineBox = probe.getBoundingClientRect().height;
        probe.remove();
        return {
            lineBox,
            content: input.clientHeight
                - parseFloat(cs.paddingTop || '0') - parseFloat(cs.paddingBottom || '0'),
            clientHeight: input.clientHeight,
            scrollHeight: input.scrollHeight,
            lineHeight: cs.lineHeight,
            fontSize: cs.fontSize,
        };
    }, selector);
}

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`ui-text-field @ ${geometry.name} (${geometry.width}×${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

        const mounted = (markup, fn) => browser.withPage({ geometry }, async (page) => {
            await page.mount(markup, MODULES);
            assert.deepEqual(page.pageErrors, [], 'the component must mount without throwing');
            return fn(page);
        });

        test('the emulated geometry is the one the suite asked for', () => mounted(PLAIN, async (page) => {
            const env = JSON.parse(await page.eval(
                'JSON.stringify({dpr: devicePixelRatio, w: innerWidth, h: innerHeight})',
            ));
            assert.deepEqual(env, {
                dpr: geometry.deviceScaleFactor,
                w: geometry.width,
                h: geometry.height,
            });
        }));

        test('the resting box carries the oracle\'s measured field', () => mounted(PLAIN, async (page) => {
            const box = await page.box(FIELD);
            assert.equal(box.height, 64, '--ui-control-h, and it is 64px at BOTH geometries (spec §2.2)');

            const field = await page.computed(FIELD, [
                'padding-left', 'padding-right', 'border-top-left-radius', 'border-top-style', 'box-sizing',
            ]);
            assert.equal(field['padding-left'], await page.resolveValue('var(--ui-space-4)', 'padding-left'));
            assert.equal(field['padding-right'], field['padding-left'], 'the inset is symmetric');
            assert.equal(
                field['border-top-left-radius'],
                await page.resolveValue('var(--ui-radius)', 'border-top-left-radius'),
            );
            assert.equal(field['border-top-style'], 'solid');
            assert.equal(field['box-sizing'], 'border-box', '64px is the OUTER box, as Slate measures it');

            const bw = parseFloat(await page.prop(FIELD, 'border-top-width'));
            assert.ok(bw > 0 && bw <= 1.5, `hairline border, got ${bw}px`);

            const input = await page.computed(INPUT, ['font-size', 'font-weight', 'font-family', 'text-align']);
            assert.equal(input['font-size'], await page.resolveValue('var(--ui-text-base)', 'font-size'));
            assert.equal(input['font-weight'], await page.resolveValue('var(--ui-weight-regular)', 'font-weight'));
            assert.equal(input['font-family'], await page.resolveValue('var(--ui-font-family)', 'font-family'));
            assert.equal(input['text-align'], 'start');
        }));

        test('zero !important anywhere in the component\'s own cascade', () => mounted(PLAIN, async (page) => {
            const count = await page.evalFn(() => {
                const root = document.querySelector('ui-text-field').shadowRoot;
                let hits = 0;
                for (const sheet of root.adoptedStyleSheets) {
                    for (const rule of sheet.cssRules) {
                        if (rule.style) {
                            for (const prop of rule.style) {
                                if (rule.style.getPropertyPriority(prop) === 'important') hits += 1;
                            }
                        }
                    }
                }
                return hits;
            });
            assert.equal(count, 0);
        }));

        test('drill: --ui-control-h moves the field\'s height', () => mounted(PLAIN, async (page) => {
            const drill = await assertTokenDrill(page, {
                token: '--ui-control-h',
                value: '91px',
                selector: FIELD,
                property: 'block-size',
            });
            assert.equal(drill.before, '64px', 'the resting height is --ui-control-h\'s own value');
        }));

        test('drill: --ui-space-4 moves the text inset', () => mounted(PLAIN, async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-space-4', value: DRILL_LENGTH, selector: FIELD, property: 'padding-left',
            });
        }));

        test('drill: --ui-radius moves the corner', () => mounted(PLAIN, async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-radius', value: DRILL_LENGTH, selector: FIELD, property: 'border-top-left-radius',
            });
        }));

        test('drill: --ui-key moves the control face', () => mounted(PLAIN, async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-key', value: DRILL_COLOUR, selector: FIELD, property: 'background-color',
            });
        }));

        test('drill: --ui-line moves the edge around the control', () => mounted(PLAIN, async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-line', value: DRILL_COLOUR, selector: FIELD, property: 'border-top-color',
            });
        }));

        test('drill: --ui-hairline moves the edge\'s WIDTH through --ui-border-w', () => mounted(PLAIN, async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-hairline',
                value: DRILL_LENGTH,
                selector: FIELD,
                property: 'border-top-width',
                expected: DRILL_LENGTH,
            });
        }));

        test('drill: --ui-text moves the entry ink across the shadow boundary', () => mounted(PLAIN, async (page) => {
            await page.setStyle('html', { color: 'rgb(3, 4, 5)' });
            const held = await page.prop(FIELD, 'color');
            await page.setStyle('html', { color: null });
            assert.equal(
                held, await page.resolveToken('--ui-text', 'color'),
                'the field inherited an ancestor colour instead of declaring --ui-text — '
                + 'the token consumption this drill is supposed to prove does not exist',
            );

            // Then the drill itself, on the declaring element.
            await assertTokenDrill(page, {
                token: '--ui-text', value: DRILL_COLOUR, selector: FIELD, property: 'color',
            });

            assert.equal(await page.prop(INPUT, 'color'), await page.prop(FIELD, 'color'));
        }));

        test('drill: --ui-text-base moves the entry type', () => mounted(PLAIN, async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-text-base', value: DRILL_LENGTH, selector: INPUT, property: 'font-size',
            });
        }));

        test('drill: --ui-weight-regular moves the entry weight', () => mounted(PLAIN, async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-weight-regular', value: '800', selector: INPUT, property: 'font-weight',
            });
        }));

        test('drill: --ui-font-family moves the entry face', () => mounted(PLAIN, async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-font-family', value: 'Georgia, serif', selector: INPUT, property: 'font-family',
            });
        }));

        test('drill: --ui-muted moves the placeholder', () => mounted(PLAIN, async (page) => {
            const drill = await assertTokenDrill(page, {
                token: '--ui-muted', value: DRILL_COLOUR, selector: INPUT, property: 'color', pseudo: '::placeholder',
            });
            assert.equal(drill.after, DRILL_COLOUR);
            assert.equal(
                await page.prop(INPUT, 'opacity', { pseudo: '::placeholder' }), '1',
                'a UA opacity default would make the token a lie',
            );
        }));

        test('drill: --ui-text-note and --ui-text-2 move the label', () => mounted(LABELLED, async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-text-note', value: DRILL_LENGTH, selector: LABEL, property: 'font-size',
            });
            await assertTokenDrill(page, {
                token: '--ui-text-2', value: DRILL_COLOUR, selector: LABEL, property: 'color',
            });
        }));

        test('drill: --ui-space-2 moves the gap under the label', () => mounted(LABELLED, async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-space-2', value: DRILL_LENGTH, selector: LABEL, property: 'margin-block-end',
            });
        }));

        test('drill: --ui-space-3 moves BOTH adornment gaps', () => mounted(
            '<ui-text-field placeholder="Search">'
            + '<span slot="lead" style="inline-size: 24px; block-size: 24px; display: inline-block"></span>'
            + '<span slot="trail" style="inline-size: 24px; block-size: 24px; display: inline-block"></span>'
            + '</ui-text-field>',
            async (page) => {
                await assertTokenDrill(page, {
                    token: '--ui-space-3',
                    value: DRILL_LENGTH,
                    selector: 'ui-text-field span[slot="lead"]',
                    property: 'margin-inline-end',
                });
                await assertTokenDrill(page, {
                    token: '--ui-space-3',
                    value: DRILL_LENGTH,
                    selector: 'ui-text-field span[slot="trail"]',
                    property: 'margin-inline-start',
                });
            },
        ));

        test('drill: --ui-opacity-disabled dims the whole control', () => mounted(
            '<ui-text-field disabled label="Scale host" value="192.0.2.42"></ui-text-field>',
            async (page) => {
                await assertTokenDrill(page, {
                    token: '--ui-opacity-disabled', value: '0.17', selector: 'ui-text-field', property: 'opacity',
                });
                assert.equal(
                    await page.evalFn(() => document.querySelector('ui-text-field').shadowRoot
                        .getElementById('control').disabled),
                    true,
                    'the dial is PAINT — the entry must also really be disabled (CONVENTIONS §4)',
                );
            },
        ));

        test('drill: --ui-status-danger paints the invalid edge', () => mounted(
            '<ui-text-field invalid label="Scale host" value="nope"></ui-text-field>',
            async (page) => {
                await assertTokenDrill(page, {
                    token: '--ui-status-danger', value: DRILL_COLOUR, selector: FIELD, property: 'border-top-color',
                });
                assert.equal(
                    await page.evalFn(() => document.querySelector('ui-text-field').shadowRoot
                        .getElementById('control').getAttribute('aria-invalid')),
                    'true',
                    'the visual state and the accessibility state are the same state',
                );
            },
        ));

        test('the ring is the token ring on the field box, outset and unclipped', () => mounted(PLAIN, async (page) => {
            const g = await assertRing(page, { ring: FIELD, focus: INPUT, offsetToken: '--ui-focus-offset' });
            assert.deepEqual(g.clippers, [], 'nothing clips a field in an open row');
        }));

        test('drill: --ui-steel moves the ring', () => mounted(PLAIN, async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-steel',
                value: DRILL_COLOUR,
                selector: FIELD,
                property: 'outline-color',
                // A token change does not survive a re-focus for free.
                prepare: (p) => p.focusVisible(INPUT),
            });
        }));

        test('BUG L24 DEAD: inside overflow:hidden the ring goes inset, not clipped', () => mounted(
            '<div id="clipper" style="overflow: hidden; inline-size: 320px">'
            + '<ui-text-field focus-ring="inset" placeholder="Search"></ui-text-field></div>',
            async (page) => {
                const g = await assertRing(page, {
                    ring: FIELD, focus: INPUT, offsetToken: '--ui-focus-offset-inset',
                });
                assert.ok(g.clippers.length >= 1, 'the clipping ancestor must be real, or this is vacuous');
                assert.equal(g.clippers[0].overflowY, 'hidden');
            },
        ));

        test('there is exactly ONE ring, not two', () => mounted(PLAIN, async (page) => {
            await page.focusVisible(INPUT);
            const rings = await page.evalFn(() => {
                const host = document.querySelector('ui-text-field');
                const painted = [];
                if (getComputedStyle(host).outlineStyle !== 'none') painted.push('host');
                for (const el of host.shadowRoot.querySelectorAll('*')) {
                    if (getComputedStyle(el).outlineStyle !== 'none') painted.push(el.id || el.localName);
                }
                return painted;
            });
            assert.deepEqual(rings, ['field'], 'five focus treatments is what this file exists to prevent');
        }));

        test('the field follows its own CONTAINER, never the viewport', () => mounted(PLAIN, async (page) => {
            await page.setStyle('ui-text-field', { 'inline-size': '240px' });
            let box = await page.box(FIELD);
            assert.equal(box.width, 240);
            assert.equal(box.height, 64, 'the height is a fixed token, not a fraction (spec §2.2)');

            await page.setStyle('ui-text-field', { 'inline-size': '820px' });
            box = await page.box(FIELD);
            assert.equal(box.width, 820);
            assert.equal(box.height, 64);
        }));

        test('a squeezed container shrinks the entry rather than overflowing it', () => mounted(PLAIN, async (page) => {
            await page.setStyle('ui-text-field', { 'inline-size': '160px' });
            const m = await page.metrics(FIELD);
            assert.ok(
                m.scrollWidth <= m.clientWidth + 0.5,
                `the entry overflows its field: scrollWidth ${m.scrollWidth} vs clientWidth ${m.clientWidth}. `
                + 'min-inline-size: 0 on the flex item is what stops this.',
            );
            const input = await page.box(INPUT);
            const field = await page.box(FIELD);
            assert.ok(input.width > 0, 'the entry must not collapse to nothing');
            assert.ok(input.right <= field.right + 0.5 && input.left >= field.left - 0.5);
        }));

        test('no @media (width…) anywhere in the component', () => mounted(PLAIN, async (page) => {
            const media = await page.evalFn(() => {
                const root = document.querySelector('ui-text-field').shadowRoot;
                const out = [];
                for (const sheet of root.adoptedStyleSheets) {
                    for (const rule of sheet.cssRules) {
                        if (rule.media) out.push(rule.conditionText || String(rule.media.mediaText));
                    }
                }
                return out;
            });
            assert.deepEqual(media, []);
        }));

        test('the field reaches --ui-hit-min on the block axis without a utility', () => mounted(PLAIN, async (page) => {
            const hit = await assertHitFloor(page, FIELD, { mode: 'box', axes: ['block'] });
            assert.ok(hit.block >= hit.floor, `${hit.block}px against a ${hit.floor}px floor`);

            // And the press lands on the entry, not just near it.
            await page.setStyle('ui-text-field', { 'inline-size': '320px' });
            const field = await page.box(FIELD);
            await page.click(FIELD, { offset: { x: 6, y: field.height / 2 } });
            const focused = await page.evalFn(() => {
                const root = document.querySelector('ui-text-field').shadowRoot;
                return root.activeElement ? root.activeElement.id : null;
            });
            assert.equal(focused, 'control', 'a press in the field\'s inset must reach the entry');
        }));

        test('BUG E14 DEAD: the label and the entry are paired by construction', () => mounted(LABELLED, async (page) => {
            const a11y = await page.evalFn(() => {
                const root = document.querySelector('ui-text-field').shadowRoot;
                const input = root.getElementById('control');
                const label = root.getElementById('label');
                return {
                    htmlFor: label.htmlFor,
                    inputId: input.id,
                    labels: input.labels.length,
                    text: label.textContent.trim(),
                    ariaLabel: input.getAttribute('aria-label'),
                };
            });
            assert.equal(a11y.htmlFor, a11y.inputId);
            assert.equal(a11y.labels, 1, 'the entry has exactly one label element');
            assert.equal(a11y.text, 'Scale host');
            assert.equal(a11y.ariaLabel, null, 'a visible label is the name; no duplicate aria-label');

            // Clicking the label focuses the entry — the pairing, rendered.
            await page.click(LABEL);
            const focused = await page.evalFn(() => document.querySelector('ui-text-field')
                .shadowRoot.activeElement?.id ?? null);
            assert.equal(focused, 'control');
        }));

        test('hide-label keeps the accessible name and drops only the ink', () => mounted(
            '<ui-text-field hide-label label="Scale host" value="192.0.2.42"></ui-text-field>',
            async (page) => {
                const a11y = await page.evalFn(() => {
                    const root = document.querySelector('ui-text-field').shadowRoot;
                    return {
                        label: root.getElementById('label'),
                        ariaLabel: root.getElementById('control').getAttribute('aria-label'),
                    };
                });
                assert.equal(a11y.label, null, 'no visible label element');
                assert.equal(a11y.ariaLabel, 'Scale host', 'the name survives — an unnamed field is bug T15\'s shape');
            },
        ));

        test('required and readonly reach the entry, not just the host', () => mounted(
            '<ui-text-field required readonly label="Scale host"></ui-text-field>',
            async (page) => {
                const state = await page.evalFn(() => {
                    const i = document.querySelector('ui-text-field').shadowRoot.getElementById('control');
                    return { required: i.required, readOnly: i.readOnly };
                });
                assert.deepEqual(state, { required: true, readOnly: true });
            },
        ));

        test('BUG E7 DEAD: the entry cannot clip its own line box', () => mounted(
            '<ui-text-field value="pgjqy Jgq"></ui-text-field>',
            async (page) => {
                const fit = await lineBoxFit(page, INPUT);
                assert.ok(
                    fit.content + 0.5 >= fit.lineBox,
                    `the entry clips its own line box: ${fit.lineBox}px of line box in a `
                    + `${fit.content}px content box (font-size ${fit.fontSize}, line-height ${fit.lineHeight})`,
                );

                await page.evalFn(() => {
                    const holder = document.createElement('div');
                    holder.innerHTML = '<input id="e7" value="pgjqy Jgq" style="box-sizing:border-box;'
                        + 'height:28px;font-size:24px;line-height:1.2;padding:0;border:0">';
                    document.getElementById('mount').appendChild(holder);
                    return true;
                });
                const bug = await lineBoxFit(page, '#e7');
                assert.ok(
                    bug.lineBox > bug.content + 0.5,
                    'the line-box measurement does not catch E7 itself, so the assertion above is '
                    + `vacuous: ${bug.lineBox}px of line box in a ${bug.content}px content box`,
                );
                assert.equal(
                    bug.scrollHeight, bug.clientHeight,
                    'E7\'s own shape reports no scroll overflow — which is exactly why '
                    + 'scrollHeight <= clientHeight cannot carry this claim',
                );
            },
        ));

        test('the value submits with the form under the host\'s name', () => mounted(
            '<form id="f"><ui-text-field name="host" value="192.0.2.42"></ui-text-field></form>',
            async (page) => {
                const got = await page.eval(
                    'new FormData(document.getElementById("f")).get("host")',
                );
                assert.equal(got, '192.0.2.42', 'static formAssociated + setFormValue, or the field is invisible to the form');
            },
        ));

        test('the value submits under a name set as a PROPERTY, not only as an attribute', () => mounted(
            '<form id="f"><ui-text-field value="192.0.2.42"></ui-text-field></form>',
            async (page) => {
                const got = await page.evalFn(() => {
                    const el = document.querySelector('ui-text-field');
                    el.name = 'host';
                    return el.updateComplete.then(() => ({
                        attr: el.getAttribute('name'),
                        prop: el.name,
                        entries: [...new FormData(document.getElementById('f')).entries()],
                    }));
                });
                assert.equal(got.attr, 'host', 'name must reflect, or the form cannot see the field');
                assert.equal(got.prop, 'host');
                assert.deepEqual(got.entries, [['host', '192.0.2.42']]);

                const cleared = await page.evalFn(() => {
                    const el = document.querySelector('ui-text-field');
                    el.name = '';
                    return el.updateComplete.then(() => ({
                        hasAttr: el.hasAttribute('name'),
                        entries: [...new FormData(document.getElementById('f')).entries()],
                    }));
                });
                assert.deepEqual(cleared, { hasAttr: false, entries: [] });
            },
        ));

        test('a bare field writes no name attribute at all', () => mounted(PLAIN, async (page) => {
            assert.equal(
                await page.evalFn(() => document.querySelector('ui-text-field').hasAttribute('name')),
                false,
                'a reflected default would put name="" on every instance in the gallery',
            );
        }));

        test('a focusable ADORNMENT gets the Decal ring, not the UA\'s', () => mounted(
            '<ui-text-field placeholder="Search"><button slot="trail" id="clr">c</button></ui-text-field>',
            async (page) => {
                const BUTTON = 'ui-text-field button[slot="trail"]';
                await page.focusVisible(BUTTON);
                const g = await page.focusGeometry(BUTTON);

                assert.ok(g.focusVisible, 'the adornment did not take a keyboard focus');
                assert.equal(g.outlineStyle, 'solid', 'the UA ring is `auto`; the Decal ring is solid');
                assert.equal(g.outlineWidth, await page.resolveValue('var(--ui-focus-w)', 'outline-width'));
                assert.equal(g.outlineColor, await page.resolveValue('var(--ui-steel)', 'outline-color'));
                assert.equal(g.outlineOffset, await page.resolveValue('var(--ui-focus-offset)', 'outline-offset'));

                assert.equal(await page.prop(FIELD, 'outline-style'), 'none');
                assert.equal(await page.prop('ui-text-field', 'outline-style'), 'none');
            },
        ));

        test('the adornment\'s ring follows the host\'s offset variant', () => mounted(
            '<div id="clipper" style="overflow: hidden; inline-size: 320px">'
            + '<ui-text-field focus-ring="inset" placeholder="Search">'
            + '<button slot="trail" id="clr">c</button></ui-text-field></div>',
            async (page) => {
                const BUTTON = 'ui-text-field button[slot="trail"]';
                await page.focusVisible(BUTTON);
                assert.equal(
                    await page.prop(BUTTON, 'outline-offset'),
                    await page.resolveValue('var(--ui-focus-offset-inset)', 'outline-offset'),
                );
            },
        ));

        test('typing moves the value, the form value and the events', () => mounted(
            '<form id="f"><ui-text-field name="host" value=""></ui-text-field></form>',
            async (page) => {
                await page.evalFn(() => {
                    window.__seen = [];
                    const el = document.querySelector('ui-text-field');
                    for (const type of ['input', 'change']) {
                        el.addEventListener(type, (e) => window.__seen.push(
                            `${type}:${e.target === el ? 'host' : 'leaked'}`,
                        ));
                    }
                    return true;
                });
                await page.click(INPUT);
                await page.press('r');
                await page.press('e');
                await page.press('a');

                assert.equal(await page.evalFn(() => document.querySelector('ui-text-field').value), 'rea');
                assert.equal(await page.eval('new FormData(document.getElementById("f")).get("host")'), 'rea');

                const seen = await page.evalFn(() => window.__seen.slice());
                assert.deepEqual(seen, ['input:host', 'input:host', 'input:host']);

                await page.evalFn(() => {
                    document.querySelector('ui-text-field').shadowRoot.getElementById('control')
                        .dispatchEvent(new Event('change', { bubbles: true }));
                    return true;
                });
                const after = await page.evalFn(() => window.__seen.slice());
                assert.equal(after.at(-1), 'change:host', 'change must be re-dispatched across the boundary');
            },
        ));

        test('form reset restores the authored value', () => mounted(
            '<form id="f"><ui-text-field name="host" value="192.0.2.42"></ui-text-field></form>',
            async (page) => {
                await page.evalFn(() => { document.querySelector('ui-text-field').value = 'typed over'; return true; });
                await page.evalFn(() => { document.getElementById('f').reset(); return true; });
                await page.settle();
                assert.equal(await page.evalFn(() => document.querySelector('ui-text-field').value), '192.0.2.42');
                assert.equal(await page.eval('new FormData(document.getElementById("f")).get("host")'), '192.0.2.42');
            },
        ));

        test('validity is mirrored from the entry, anchored on the entry', () => mounted(
            '<form id="f"><ui-text-field name="host" required value=""></ui-text-field></form>',
            async (page) => {
                const empty = await page.evalFn(() => {
                    const el = document.querySelector('ui-text-field');
                    return { valid: el.checkValidity(), missing: el.validity.valueMissing, willValidate: el.willValidate };
                });
                assert.deepEqual(empty, { valid: false, missing: true, willValidate: true });

                await page.evalFn(() => { document.querySelector('ui-text-field').value = 'set'; return true; });
                await page.settle();
                const filled = await page.evalFn(() => {
                    const el = document.querySelector('ui-text-field');
                    return { valid: el.checkValidity(), missing: el.validity.valueMissing, form: el.form?.id ?? null };
                });
                assert.deepEqual(filled, { valid: true, missing: false, form: 'f' });
            },
        ));

        test('an unrecognised type falls back to text rather than smuggling a control in', () => mounted(
            '<ui-text-field type="checkbox"></ui-text-field>',
            async (page) => {
                const type = await page.evalFn(() => document.querySelector('ui-text-field')
                    .shadowRoot.getElementById('control').type);
                assert.equal(type, 'text', 'number belongs to the stepper (#4); checkbox is the switch (#5)');
                const ok = await page.evalFn(() => document.querySelector('ui-text-field')
                    .shadowRoot.getElementById('control').type === 'text');
                assert.equal(ok, true);
            },
        ));

        test('align is a reflected variant, not a class a screen reaches in with', () => mounted(
            '<ui-text-field align="center" value="30"></ui-text-field>',
            async (page) => {
                assert.equal(await page.prop(INPUT, 'text-align'), 'center');
                await page.evalFn(() => { document.querySelector('ui-text-field').align = 'end'; return true; });
                await page.settle();
                assert.equal(await page.prop(INPUT, 'text-align'), 'end');
                assert.equal(
                    await page.evalFn(() => document.querySelector('ui-text-field').getAttribute('align')),
                    'end',
                    'align reflects, so the cascade sees what the property says',
                );
            },
        ));

        test('a lead adornment insets the entry without moving the field\'s own padding', () => mounted(
            '<ui-text-field placeholder="Search"><span slot="lead" style="inline-size: 24px; '
            + 'block-size: 24px; display: inline-block"></span></ui-text-field>',
            async (page) => {
                const field = await page.box(FIELD);
                const lead = await page.box('ui-text-field span[slot="lead"]');
                const input = await page.box(INPUT);
                const inset = parseFloat(await page.prop(FIELD, 'padding-left'));

                assert.ok(
                    Math.abs(lead.left - (field.left + inset)) < 1.5,
                    'the glyph sits at the oracle\'s 18px inset, not at 18 + a flex gap',
                );
                assert.ok(input.left > lead.right, 'the entry follows the glyph');

                await page.mount(PLAIN, MODULES);
                const bare = await page.box(INPUT);
                const bareField = await page.box(FIELD);
                assert.ok(
                    Math.abs(bare.left - (bareField.left + inset)) < 1.5,
                    `empty slots must contribute nothing: entry at ${bare.left - bareField.left}px, inset ${inset}px`,
                );
            },
        ));
    });
}

test('the bench and the floor render the same field', async () => {
    const read = (geometry) => browser.withPage({ geometry }, async (page) => {
        await page.mount(PLAIN, MODULES);
        await page.setStyle('ui-text-field', { 'inline-size': '420px' });
        return {
            dpr: await page.eval('devicePixelRatio'),
            viewport: await page.eval('innerWidth'),
            field: await page.box(FIELD),
            fontSize: await page.prop(INPUT, 'font-size'),
        };
    });

    const bench = await read(BENCH);
    const floor = await read(FLOOR);

    assert.equal(bench.dpr, 1.5);
    assert.equal(floor.dpr, 1);
    assert.notEqual(bench.viewport, floor.viewport, 'the viewports must actually differ');
    assert.equal(bench.field.height, 64, 'spec §2.2 — control heights are a fixed token, never fluid');
    assert.equal(floor.field.height, 64);
    assert.equal(bench.field.width, 420, 'the container decides the width, at both viewports');
    assert.equal(floor.field.width, 420);
    assert.equal(bench.fontSize, floor.fontSize, 'UI type is fixed steps, never fluid (spec §2.2)');
});
