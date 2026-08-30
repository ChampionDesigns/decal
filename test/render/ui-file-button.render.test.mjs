

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';

const MODULE = ['/src/components/ui-file-button.js'];

/* The two shapes the skin actually ships: a slotted word (the screen-saver leaf's two
 * pickers) and a `label` over a glyph (the selector's Upload). */
const MARKUP = `
    <ui-file-button id="images" accept="image/*" multiple>Choose images</ui-file-button>
    <ui-file-button id="upload" label="Upload a profile">⇪</ui-file-button>
`;

async function axTree(page) {
    await page.send('Accessibility.enable');
    const { nodes } = await page.send('Accessibility.getFullAXTree', { depth: -1 });
    return nodes;
}

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`ui-file-button @ ${geometry.name}`, () => {

        const mounted = (fn) => browser.withPage({ geometry }, async (page) => {
            await page.mount(MARKUP, MODULE);
            assert.deepEqual(page.pageErrors, [], 'ui-file-button must mount without throwing');
            await page.settle(2);
            return fn(page);
        });

        test('F-016 #7/#12/#13 — the control is the BUTTON, and it is named',
            () => mounted(async (page) => {
                const named = (await axTree(page))
                    .filter((n) => !n.ignored)
                    .map((n) => ({ role: n.role?.value ?? '', name: n.name?.value ?? '' }))
                    .filter((n) => n.role === 'button');

                assert.deepEqual(named, [
                    { role: 'button', name: 'Choose images' },
                    { role: 'button', name: 'Upload a profile' },
                ], 'both shapes are named — the slotted word, and `label` over a glyph');
            }));

        test('F-016 #7/#12/#13 — and the hidden picker is not in the tree at all',
            () => mounted(async (page) => {
                const nodes = await axTree(page);
                const exposed = nodes
                    .filter((n) => !n.ignored)
                    .filter((n) => {
                        const role = n.role?.value ?? '';
                        return role === 'textbox' || role === 'ComboBox' || role.includes('File');
                    });
                assert.deepEqual(exposed, [],
                    `no file input may be exposed — saw ${JSON.stringify(exposed)}`);

                const shape = await page.evalFn(() => ['images', 'upload'].map((id) => {
                    const input = document.getElementById(id).shadowRoot.getElementById('picker');
                    const cs = getComputedStyle(input);
                    return {
                        hidden: input.getAttribute('aria-hidden'),
                        tabindex: input.getAttribute('tabindex'),
                        label: input.getAttribute('aria-label'),
                        display: cs.display,
                    };
                }));
                for (const one of shape) {
                    assert.deepEqual(one, {
                        hidden: 'true',
                        tabindex: '-1',
                        label: null,
                        display: 'block',
                    }, `the picker stays clipped and unannounced — saw ${JSON.stringify(one)}`);
                }
            }));

        test('the button still opens the picker — hidden is not disabled',
            () => mounted(async (page) => {
                const opened = await page.evalFn(() => {
                    const host = document.getElementById('images');
                    const input = host.shadowRoot.getElementById('picker');
                    let clicks = 0;
                    input.addEventListener('click', (e) => { clicks += 1; e.preventDefault(); });
                    host.shadowRoot.getElementById('button').click();
                    return clicks;
                });
                assert.equal(opened, 1, 'pressing the button reaches the hidden input');
            }));
    });
}
