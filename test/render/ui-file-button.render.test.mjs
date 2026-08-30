/**
 * ui-file-button.render.test.mjs — audit F-016 rows #7, #12 and #13.
 *
 * WHY THIS FILE EXISTS, AND WHY IT PINS A NEGATIVE.
 *
 * Wave 1 listed sixteen controls whose accessible name resolved to the empty string.
 * Three of them are the same element in three mounts: the hidden `input#picker` inside
 * `<ui-file-button>` — `selector-screen`'s Upload, and the screen-saver leaf's two.
 *
 * IT IS NOT A DEFECT, and the FIXPLAN's proposed remedy for it — "mirror the button's
 * label" onto the input — would have been the move this campaign rejected by name
 * elsewhere: turning a finding green while changing nothing a person is told. The input
 * carries `aria-hidden="true"` and `tabindex="-1"` DELIBERATELY, and the component's own
 * header says why in the sentence Wave 1's probe could not read: "the BUTTON is the
 * control, and announcing both would announce the same thing twice."
 *
 * MEASURED through `Accessibility.getFullAXTree`, which is the instrument that settles
 * it: the picker is not in the tree at all — Chrome reports it `ignored`, role `none` —
 * and the two buttons beside it are named. There is no unnamed control here; there is an
 * element with an interactive TAG that a tag-based inventory rowed.
 *
 * So the finding closes as a false positive, in the same shape as F-016 row #2 (the
 * editor's versions button, verified by cluster E on the same night), and this file is
 * the guard that keeps it true: an aria-label added to the picker, or `aria-hidden`
 * removed from it, fails here rather than passing quietly and announcing every Upload
 * button twice.
 *
 * Gate A, both standard geometries. No source text is read (a8).
 */

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
                /* THE WHOLE VERDICT. If this element were exposed it would need a name;
                 * it is not exposed, so it does not, and giving it one would put a second
                 * announcement of the same control next to the first. */
                const nodes = await axTree(page);
                const exposed = nodes
                    .filter((n) => !n.ignored)
                    .filter((n) => {
                        const role = n.role?.value ?? '';
                        return role === 'textbox' || role === 'ComboBox' || role.includes('File');
                    });
                assert.deepEqual(exposed, [],
                    `no file input may be exposed — saw ${JSON.stringify(exposed)}`);

                /* AND THE MECHANISM IS STILL THE ONE THE HEADER DESCRIBES, so a future
                 * reader who deletes either attribute finds out here. `display: none`
                 * is checked too: it is the wrong tool (some engines refuse to open a
                 * picker for a display-none input) and the clip is what replaces it. */
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
                /* The reason the input is clipped rather than removed. If this ever
                 * stops working, the "fix" of un-hiding it is what a reader will reach
                 * for, and the two tests above would then be wrong for the right
                 * reason. This one keeps them honest. */
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
