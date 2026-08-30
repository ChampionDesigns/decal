/**
 * Gate A for.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';
import {
    assertTokenDrill,
    assertFocusUnclipped,
    assertOneSelectionTreatment,
    DRILL_COLOUR,
    DRILL_LENGTH,
} from '../harness/assertions.js';

const MODULE = [
    '/src/components/ui-sheet.js',
    '/src/components/ui-button.js',
    '/test/fixtures/base-fixture.js',
];

const DIALOG_MODULE = [
    '/src/components/ui-sheet.js',
    '/src/components/ui-dialog.js',
    '/src/components/ui-button.js',
];

const FIELDS = JSON.stringify([
    { name: 'time', label: 'Wake Time' },
    { name: 'days', label: 'Days of Week' },
    {
        name: 'awake',
        label: 'Keep Awake For',
        layout: 'inline',
        caption: 'Duration to keep machine awake after schedule starts.',
    },
]).replace(/"/g, '&quot;');

/* A second sheet whose first field has NO label — the "control only" row — and whose
 * tail slot has content, so both edges of the render are measured. */
const PLAIN_FIELDS = JSON.stringify([
    { name: 'bare' },
    { name: 'named', label: 'Named' },
]).replace(/"/g, '&quot;');

const HOSTILE_CSS = `
<style>
    .slate-sheet-actions, .slate-sheet-body, .slate-sheet-row, .slate-sheet-duration,
    .stack, .field, .control, .control-inline, .label, .caption,
    ui-sheet .stack, ui-sheet .field, ui-sheet > * {
        justify-content: flex-end !important;
        margin-top: 40px !important;
        gap: 40px !important;
        overflow: hidden !important;
        padding: 40px !important;
    }
    .slate-microcap, .label, ui-sheet .label, ui-sheet span {
        font-size: 20px !important;
        font-weight: 800 !important;
        letter-spacing: 0.12em !important;
        text-transform: none !important;
    }
</style>`;

const RING_CSS = `
<style>
    .child:focus-visible {
        outline: var(--ui-focus-w) solid var(--ui-steel);
        outline-offset: var(--_ui-focus-offset, var(--ui-focus-offset));
    }
    button.child, input.child {
        margin: 0; padding: 0 12px; border: 0; background: none; font: inherit;
        min-block-size: 64px; box-sizing: border-box;
    }
    input.child { inline-size: 120px; }
    .unit { font-size: 17px; }
</style>`;

const MARKUP = `${RING_CSS}
<div id="wide" style="inline-size: 644px">
    <ui-sheet id="solo" fields="${FIELDS}">
        <input class="child" slot="time" id="time-in" type="text" value="05:30">
        <base-fixture id="fx" slot="days" style="padding: 0"></base-fixture>
        <input class="child" slot="awake" id="hours-in" type="text" value="1">
        <span class="unit" slot="awake" id="hours-unit">hr</span>
        <input class="child" slot="awake" id="mins-in" type="text" value="0">
        <span class="unit" slot="awake" id="mins-unit">min</span>
    </ui-sheet>
</div>
<div id="wide-2" style="inline-size: 644px">
    <ui-sheet id="composed" fields="${FIELDS}">
        <ui-button id="ui-pick" slot="time">05:30</ui-button>
    </ui-sheet>
</div>
<div id="wide-3" style="inline-size: 644px">
    <ui-sheet id="plain" fields="${PLAIN_FIELDS}">
        <button class="child" slot="bare" id="bare-ctl" type="button">No label</button>
        <button class="child" slot="named" id="named-ctl" type="button">Named</button>
        <p id="tail" style="margin: 0">The tail, after the last field.</p>
        <button id="stray-footer" slot="actions" type="button">Save</button>
    </ui-sheet>
</div>
<div id="narrow" style="inline-size: 320px">
    <ui-sheet id="squeezed" fields="${FIELDS}">
        <input class="child" slot="time" id="sq-time" type="text" value="05:30">
        <input class="child" slot="awake" id="sq-hours" type="text" value="1">
        <span class="unit" slot="awake">hr</span>
        <input class="child" slot="awake" id="sq-mins" type="text" value="0">
        <span class="unit" slot="awake">min</span>
    </ui-sheet>
</div>
<div id="wide-4" style="inline-size: 644px">
    <ui-sheet id="empty"></ui-sheet>
</div>
${HOSTILE_CSS}
`;

const DIALOG_FIELDS = JSON.stringify([
    { name: 'time', label: 'Wake Time' },
    { name: 'awake', label: 'Keep Awake For', layout: 'inline' },
]).replace(/"/g, '&quot;');

/* The dialog composition gets its own mount: an open modal marks every sibling inert
 * (ui-dialog's focus trap), so it cannot share a page with the focus and geometry
 * fixtures above. */
const DIALOG_MARKUP = `${RING_CSS}
<ui-dialog id="d" open heading="Add schedule" style="--_ui-dialog-inline: 680px">
    <ui-sheet id="sheet" slot="body" fields="${DIALOG_FIELDS}">
        <input class="child" slot="time" id="d-time" type="text" value="05:30">
        <input class="child" slot="awake" id="d-hours" type="text" value="1">
        <span class="unit" slot="awake">hr</span>
    </ui-sheet>
    <ui-button id="cancel" slot="actions">Cancel</ui-button>
    <ui-button id="save" slot="actions" variant="primary">Save</ui-button>
</ui-dialog>
`;

const ORACLE = {
    labelSize: 15,
    labelTransform: 'uppercase',
    labelWeight: '600',
    labelTracking: 1.8,
    muted: { dark: 'rgb(148, 161, 169)', light: 'rgb(90, 101, 108)' },
    stackGap: 28,
    fieldGap: 12,
    clusterGap: 12,
    captionSize: 16,          // type-roles .ui-caption, --ui-text-note
};

const near = (got, want, what, tol = 0.4) => assert.ok(
    Math.abs(parseFloat(got) - want) <= tol,
    `${what}: expected ~${want}px, rendered ${got}`,
);

/** Filled in by each geometry block, compared once at the end. */
const acrossGeometries = {};

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`ui-sheet @ ${geometry.name} (${geometry.width}x${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

        const mounted = (fn) => browser.withPage({ geometry }, async (page) => {
            await page.mount(MARKUP, MODULE);
            assert.deepEqual(page.pageErrors, [], 'ui-sheet must mount without throwing');
            return fn(page);
        });

        const inDialog = (fn) => browser.withPage({ geometry }, async (page) => {
            await page.mount(DIALOG_MARKUP, DIALOG_MODULE);
            assert.deepEqual(page.pageErrors, [], 'ui-sheet in a dialog must mount without throwing');
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

        test('every measured sheet has a container to fill', () => mounted(async (page) => {
            for (const id of ['solo', 'composed', 'plain']) {
                const host = await page.box(`#${id}`);
                assert.ok(host.width > 600, `#${id} is in a collapsed container: ${host.width}px`);
            }
            const squeezed = await page.box('#squeezed');
            near(squeezed.width, 320, '#squeezed fills the narrow container', 1);
        }));

        test('drill: --ui-space-6 is the stack rhythm', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-space-6',
                value: DRILL_LENGTH,
                selector: '#solo >>> #stack',
                property: 'row-gap',
            });
        }));

        test('drill: --ui-space-3 is the rhythm inside a field', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-space-3',
                value: DRILL_LENGTH,
                selector: '#solo >>> #field-0',
                property: 'row-gap',
            });
        }));

        test('drill: --ui-space-3 is the inline cluster gap', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-space-3',
                value: DRILL_LENGTH,
                selector: '#solo >>> #control-2',
                property: 'column-gap',
            });
        }));

        test('drill: --ui-text-sm is the label size', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-text-sm',
                value: DRILL_LENGTH,
                selector: '#solo >>> #lbl-0',
                property: 'font-size',
            });
        }));

        test('drill: --ui-muted is the label ink', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-muted',
                value: DRILL_COLOUR,
                selector: '#solo >>> #lbl-0',
                property: 'color',
            });
        }));

        test('drill: --ui-tracking-cap is the label tracking', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-tracking-cap',
                value: DRILL_LENGTH,
                selector: '#solo >>> #lbl-0',
                property: 'letter-spacing',
            });
        }));

        test('drill: --ui-text-note is the caption size', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-text-note',
                value: DRILL_LENGTH,
                selector: '#solo >>> #cap-2',
                property: 'font-size',
            });
        }));

        test('the label lands on the oracle literals in both themes', () => mounted(async (page) => {
            const read = async () => page.computed('#solo >>> #lbl-0', [
                'font-size', 'font-weight', 'text-transform', 'letter-spacing', 'color',
            ]);

            const dark = await read();
            near(dark['font-size'], ORACLE.labelSize, 'label font-size');
            assert.equal(dark['text-transform'], ORACLE.labelTransform);
            assert.equal(dark['font-weight'], ORACLE.labelWeight,
                'the microcap is Slate\'s own 600 (parity surface 1 reversed the 700 departure: '
                + 'LAYOUT_SPEC_DRAFT §3.5 cites slate-tokens.css:148-153, which declares four weights)');
            near(dark['letter-spacing'], ORACLE.labelTracking,
                'the microcap tracks Slate\'s .12em (parity surface 0 reversed the .04em departure)');
            assert.equal(dark.color, ORACLE.muted.dark);

            await page.setTheme('light');
            const light = await read();
            assert.equal(light.color, ORACLE.muted.light,
                'the label ink follows the theme through --ui-muted, not a literal');
            near(light['font-size'], ORACLE.labelSize, 'label font-size (light)');
        }));

        test('the rhythms land on the oracle literals', () => mounted(async (page) => {
            const stack = await page.computed('#solo >>> #stack', ['row-gap', 'display', 'flex-direction']);
            near(stack['row-gap'], ORACLE.stackGap, 'stack gap');
            assert.equal(stack.display, 'flex');
            assert.equal(stack['flex-direction'], 'column');

            const field = await page.computed('#solo >>> #field-0', ['row-gap', 'flex-direction']);
            near(field['row-gap'], ORACLE.fieldGap, 'field gap');
            assert.equal(field['flex-direction'], 'column');

            const cluster = await page.computed('#solo >>> #control-2',
                ['column-gap', 'display', 'align-items', 'flex-wrap']);
            near(cluster['column-gap'], ORACLE.clusterGap, 'inline cluster gap');
            assert.equal(cluster.display, 'flex');
            assert.equal(cluster['align-items'], 'center');
            assert.equal(cluster['flex-wrap'], 'wrap',
                'the cluster wraps rather than overflowing its dialog — the container decides');

            const caption = await page.computed('#solo >>> #cap-2', ['font-size']);
            near(caption['font-size'], ORACLE.captionSize, 'caption font-size');
        }));

        test('the sheet paints no card of its own', () => mounted(async (page) => {
            const host = await page.computed('#solo', [
                'background-color', 'border-top-width', 'border-top-left-radius',
                'padding-top', 'padding-left', 'box-shadow',
            ]);
            assert.equal(host['background-color'], 'rgba(0, 0, 0, 0)');
            assert.equal(host['border-top-width'], '0px');
            assert.equal(host['border-top-left-radius'], '0px');
            assert.equal(host['padding-top'], '0px');
            assert.equal(host['padding-left'], '0px');
            assert.equal(host['box-shadow'], 'none');

            const stack = await page.computed('#solo >>> #stack',
                ['background-color', 'padding-top', 'padding-left', 'margin-top']);
            assert.equal(stack['background-color'], 'rgba(0, 0, 0, 0)');
            assert.equal(stack['padding-top'], '0px');
            assert.equal(stack['padding-left'], '0px');
            assert.equal(stack['margin-top'], '0px',
                'slate-shell.css:2231 margin-top: var(--slate-space-7) is #18s inset now');
        }));

        test('wave law: no dial reaches anything this component paints', () => mounted(async (page) => {
            const parts = [
                '#solo >>> #stack', '#solo >>> #field-0', '#solo >>> #lbl-0',
                '#solo >>> #control-2', '#solo >>> #cap-2',
            ];
            const props = ['background-color', 'color', 'box-shadow', 'text-shadow'];
            const before = {};
            for (const p of parts) before[p] = await page.computed(p, props);

            await page.setToken('--ui-selected-face', DRILL_COLOUR);
            await page.setToken('--ui-selected-ink', DRILL_COLOUR);
            await page.setToken('--ui-selected-led', DRILL_LENGTH);
            await page.setToken('--ui-selected-glow', '60%');
            try {
                for (const p of parts) {
                    assert.deepEqual(
                        await page.computed(p, props), before[p],
                        `${p} moved when the selection dials moved — this component owns ` +
                        'no selected state, so nothing in it may read a dial (CONVENTIONS §4).',
                    );
                }
            } finally {
                for (const t of ['--ui-selected-face', '--ui-selected-ink',
                    '--ui-selected-led', '--ui-selected-glow']) await page.setToken(t, null);
            }
        }));

        test('a selectable control in a field slot is still painted by the four dials',
            () => mounted(async (page) => {
                await assertOneSelectionTreatment(page, {
                    selected: '#fx >>> #tab',
                    unselected: '#fx >>> #tab-off',
                });
            }));

        test('a slotted control in a stacked field keeps the one ring, unclipped',
            () => mounted(async (page) => {
                await assertFocusUnclipped(page, '#time-in');
            }));

        test('a slotted control in the inline cluster keeps the one ring, unclipped',
            () => mounted(async (page) => {
                await assertFocusUnclipped(page, '#hours-in');
                await assertFocusUnclipped(page, '#mins-in');
            }));

        test('a composed ui-button keeps its own ring through the slot', () => mounted(async (page) => {
            await assertFocusUnclipped(page, '#ui-pick >>> button');
        }));

        test('the tail slot content still gets the ring', () => mounted(async (page) => {
            await assertFocusUnclipped(page, '#named-ctl');
        }));

        test('the sheet opens no second scrollport', () => mounted(async (page) => {
            for (const sel of ['#solo', '#solo >>> #stack', '#solo >>> #field-0',
                '#solo >>> #control-2']) {
                const box = await page.computed(sel, ['overflow-x', 'overflow-y']);
                assert.equal(box['overflow-x'], 'visible', `${sel} declares an overflow`);
                assert.equal(box['overflow-y'], 'visible', `${sel} declares an overflow`);
            }
        }));

        test('nothing overflows a 320px container; the cluster wraps instead',
            () => mounted(async (page) => {
                const host = await page.box('#squeezed');
                for (const sel of ['#squeezed >>> #stack', '#squeezed >>> #field-0',
                    '#squeezed >>> #control-2', '#squeezed >>> #cap-2']) {
                    const box = await page.box(sel);
                    assert.ok(box.width <= host.width + 0.5,
                        `${sel} is ${box.width}px wide inside a ${host.width}px sheet`);
                }
                const cluster = await page.box('#squeezed >>> #control-2');
                assert.ok(cluster.height > 64,
                    `the inline cluster did not wrap at 320px (height ${cluster.height})`);
            }));

        test('the rhythm is the same at 320px as at 644px', () => mounted(async (page) => {
            const wide = await page.computed('#solo >>> #stack', ['row-gap']);
            const narrow = await page.computed('#squeezed >>> #stack', ['row-gap']);
            assert.equal(narrow['row-gap'], wide['row-gap']);
        }));

        test('an empty sheet renders an empty stack and takes no height', () => mounted(async (page) => {
            const box = await page.box('#empty >>> #stack');
            assert.equal(box.height, 0, 'an empty sheet must not reserve a row of space');
            assert.equal(await page.count('#empty >>> .field'), 0);
        }));

        test('the same container gives the same boxes at both geometries', () => mounted(async (page) => {
            // The record is keyed by geometry and compared after both blocks have run.
            const record = {};
            for (const sel of ['#solo >>> #stack', '#solo >>> #field-0', '#solo >>> #lbl-0',
                '#solo >>> #control-2', '#solo >>> #cap-2']) {
                const b = await page.box(sel);
                record[sel] = { width: Math.round(b.width), height: Math.round(b.height) };
            }
            acrossGeometries[geometry.name] = record;
        }));

        test('O13: the sheet has no actions slot', () => mounted(async (page) => {
            assert.equal(await page.count('#solo >>> slot[name="actions"]'), 0);
            assert.equal(await page.count('#solo >>> slot[name="trail"]'), 0);
        }));

        test('O13: nothing in the sheet is a flex-end cluster', () => mounted(async (page) => {
            const found = JSON.parse(await page.eval(`
                (function () {
                    var root = document.getElementById('solo').shadowRoot;
                    var bad = [];
                    root.querySelectorAll('*').forEach(function (el) {
                        var cs = getComputedStyle(el);
                        if (cs.justifyContent === 'flex-end') bad.push(el.id || el.className);
                        if (parseFloat(cs.marginTop) !== 0) bad.push('margin:' + (el.id || el.className));
                    });
                    return JSON.stringify(bad);
                })()`));
            assert.deepEqual(found, [],
                'a flex-end cluster or a top margin appeared in the sheet body — that is O13 arriving again');
        }));

        test('O13: a stray slot="actions" child renders nowhere', () => mounted(async (page) => {
            const box = await page.box('#stray-footer');
            assert.equal(box.width, 0, 'a slot="actions" child of the sheet was rendered');
            assert.equal(box.height, 0, 'a slot="actions" child of the sheet was rendered');
        }));

        test('O13: in the real composition the footer is the dialog\'s, below the body',
            () => inDialog(async (page) => {
                const sheet = await page.box('#sheet');
                const save = await page.box('#save');
                const cancel = await page.box('#cancel');
                assert.ok(sheet.width > 0 && save.width > 0, 'the composition did not render');
                assert.ok(save.top >= sheet.bottom - 0.5,
                    `Save (top ${save.top}) is not below the sheet body (bottom ${sheet.bottom}) — ` +
                    'the footer is the dialog\'s last grid row, not a cluster inside the body');
                assert.ok(cancel.top >= sheet.bottom - 0.5);
                // And the buttons are in the DIALOG's tree, not the sheet's.
                const owner = await page.eval(`
                    document.getElementById('save').assignedSlot
                        ? document.getElementById('save').assignedSlot.name : 'none'`);
                assert.equal(owner, 'actions');
            }));

        test('the sheet is the dialog body and inherits its inset, not a second one',
            () => inDialog(async (page) => {
                const pad = await page.resolveValue('var(--ui-space-4)', 'padding-left');
                const sheet = await page.box('#sheet');
                near(sheet.width, 680 - 2 * parseFloat(pad), 'the sheet body measure at 680px', 1);

                const cell = await page.computed('#d >>> #body', ['padding-left']);
                assert.equal(cell['padding-left'], pad,
                    'the dialog cell is not at --ui-space-4: the one container query did not fire at 680px');

                const own = await page.computed('#sheet', ['padding-left', 'padding-right']);
                assert.equal(own['padding-left'], '0px');
                assert.equal(own['padding-right'], '0px');
            }));

        test('a labelled field is a group named by its own label', () => mounted(async (page) => {
            const aria = JSON.parse(await page.eval(`
                (function () {
                    var root = document.getElementById('solo').shadowRoot;
                    var field = root.getElementById('field-0');
                    var ref = field.getAttribute('aria-labelledby');
                    return JSON.stringify({
                        role: field.getAttribute('role'),
                        ref: ref,
                        resolved: ref ? (root.getElementById(ref) || {}).textContent : null
                    });
                })()`));
            assert.equal(aria.role, 'group');
            assert.ok(aria.ref, 'the field is not labelled');
            assert.equal(aria.resolved, 'Wake Time',
                'the label element the group points at is not in the same root');
        }));

        test('a caption describes its own group', () => mounted(async (page) => {
            const aria = JSON.parse(await page.eval(`
                (function () {
                    var root = document.getElementById('solo').shadowRoot;
                    var field = root.getElementById('field-2');
                    var ref = field.getAttribute('aria-describedby');
                    return JSON.stringify({
                        ref: ref,
                        resolved: ref ? (root.getElementById(ref) || {}).textContent : null
                    });
                })()`));
            assert.equal(aria.ref, 'cap-2');
            assert.equal(aria.resolved, 'Duration to keep machine awake after schedule starts.');
        }));

        test('a field with no label is no group at all', () => mounted(async (page) => {
            const aria = JSON.parse(await page.eval(`
                (function () {
                    var f = document.getElementById('plain').shadowRoot.getElementById('field-0');
                    return JSON.stringify({
                        role: f.getAttribute('role'),
                        labelledby: f.getAttribute('aria-labelledby'),
                        describedby: f.getAttribute('aria-describedby'),
                        labels: f.querySelectorAll('.label').length
                    });
                })()`));
            assert.deepEqual(aria, { role: null, labelledby: null, describedby: null, labels: 0 });
        }));

        test('the sheet writes no aria onto slotted light DOM', () => mounted(async (page) => {
            const attrs = JSON.parse(await page.eval(`
                (function () {
                    var el = document.getElementById('time-in');
                    return JSON.stringify(Array.prototype.map.call(el.attributes, function (a) {
                        return a.name;
                    }).filter(function (n) { return n.indexOf('aria-') === 0 || n === 'role'; }));
                })()`));
            assert.deepEqual(attrs, []);
        }));

        test('the visible label keeps the case the author wrote', () => mounted(async (page) => {
            const text = await page.eval(
                'document.getElementById("solo").shadowRoot.getElementById("lbl-0").textContent');
            assert.equal(text, 'Wake Time');
        }));

        test('the tail slot renders after the last field', () => mounted(async (page) => {
            const lastField = await page.box('#plain >>> #field-1');
            const tail = await page.box('#tail');
            assert.ok(tail.width > 0, 'the tail content did not render');
            assert.ok(tail.top >= lastField.bottom - 0.5,
                `the tail (${tail.top}) is not after the last field (${lastField.bottom})`);
        }));

        test('each field slot places its own controls, in markup order', () => mounted(async (page) => {
            const hours = await page.box('#hours-in');
            const unit = await page.box('#hours-unit');
            const mins = await page.box('#mins-in');
            const cluster = await page.box('#solo >>> #control-2');
            for (const [name, box] of [['hours', hours], ['unit', unit], ['mins', mins]]) {
                assert.ok(box.left >= cluster.left - 0.5 && box.right <= cluster.right + 0.5,
                    `${name} is outside its own field's control area`);
            }
            assert.ok(unit.left >= hours.right - 0.5, 'the unit word is not after its field');
            assert.ok(mins.left >= unit.right - 0.5, 'the second field is not after the unit word');
        }));

        test('no outside sheet can reach the rhythm, the inset or the label type',
            () => mounted(async (page) => {
                const stack = await page.computed('#solo >>> #stack',
                    ['row-gap', 'padding-top', 'overflow-y', 'justify-content']);
                near(stack['row-gap'], ORACLE.stackGap, 'stack gap under hostile CSS');
                assert.equal(stack['padding-top'], '0px');
                assert.equal(stack['overflow-y'], 'visible');
                assert.notEqual(stack['justify-content'], 'flex-end');

                const label = await page.computed('#solo >>> #lbl-0',
                    ['font-size', 'font-weight', 'text-transform']);
                near(label['font-size'], ORACLE.labelSize, 'label size under hostile CSS');
                assert.equal(label['font-weight'], ORACLE.labelWeight);
                assert.equal(label['text-transform'], ORACLE.labelTransform);
            }));
    });
}

describe('ui-sheet across geometries', () => {
    test('the same container inline-size gives the same boxes at 1281 and at 1000', () => {
        const names = Object.keys(acrossGeometries);
        assert.equal(names.length, GATE_A_GEOMETRIES.length,
            `both geometry blocks must have recorded (got ${names.join(', ')})`);
        const [first, ...rest] = names;
        for (const other of rest) {
            assert.deepEqual(
                acrossGeometries[other], acrossGeometries[first],
                'the sheet read the viewport: the same 644px container produced different ' +
                'boxes at two window sizes (§2.1 Rule 1).',
            );
        }
    });
});
