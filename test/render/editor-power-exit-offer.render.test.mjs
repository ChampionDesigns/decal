/**
 * One capability, both mounts.
 *
 * The editor states the machine's advanced-mode capability to every surface that offers
 * exit types. This drives the screen's own matrix and overlay mounts, and reads the list
 * the exit dialog is drawing on a step whose exit is something else.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';
import { EDITOR_MODULE, editingProfile, editorStage, matrixStep } from '../harness/editor.js';

const geometry = GATE_A_GEOMETRIES[0];

const OWN = Object.freeze({
    matrix: 'editor-screen >>> #matrix',
    overlays: 'editor-screen >>> #overlays',
    exitDialog: 'editor-screen >>> #overlays >>> #exit',
});

const FLOW_STEP = Object.freeze(matrixStep({
    pump: 'flow',
    exit: { type: 'pressure', condition: 'over', value: 4 },
}));

async function seatWithModes(page, { powerExit, steps = [FLOW_STEP] }) {
    await page.evalFn(async (payload) => {
        const [storeMod, adapters, caps] = await Promise.all([
            import('/src/stores/profile-editor-store.js'),
            import('/src/data/adapters-r.js'),
            import('/src/stores/capabilities-store.js'),
        ]);
        const transport = { async request() { return { ok: true, status: 200, data: null }; } };
        const editor = storeMod.createProfileEditorStore({ transport });
        const screen = window.__h.need('editor-screen');
        screen.boot = {
            profileEditor: editor,
            capabilities: {
                machineLimits: () => adapters.r2MachineLimits([{ id: 'machine' }]),
                profileModes: () => ({
                    capability: caps.CAPABILITY.PRESENT,
                    value: {
                        offers: {
                            power: true, lever: true, hold: true, powerExit: payload.powerExit,
                        },
                    },
                }),
            },
            logger: null,
        };
        editor.open({
            id: 'profile:seated',
            profile: { ...payload.profile, steps: payload.steps },
            metadataHash: 'meta-0',
            compoundHash: 'compound-0',
            parentId: null,
            visibility: 'visible',
            isDefault: false,
            metadata: null,
        });
        await screen.updateComplete;
    }, { powerExit, steps, profile: editingProfile() });
    await page.settle(6);
}

async function openCondition(page, index = 0) {
    await page.evalFn((sel) => {
        window.__h.need(sel).dispatchEvent(new CustomEvent('exit-edit', {
            bubbles: true, composed: true, detail: { slot: 'condition', index: 0 },
        }));
        return true;
    }, OWN.matrix);
    await page.settle(4);
}

const offeredTypes = (page) => page.evalFn((sel) => {
    const bank = window.__h.need(sel).renderRoot.querySelector('#type');
    return (bank?.items ?? []).map((item) => item.value);
}, OWN.exitDialog);

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

describe('the exit capability reaches the overlay region, not only the matrix', () => {
    const staged = (powerExit, fn) => browser.withPage({ geometry }, async (page) => {
        await page.mount(editorStage({ matrix: null, fields: 0 }), EDITOR_MODULE);
        await page.settle(6);
        assert.deepEqual(page.pageErrors, [], 'the editor must mount without throwing');
        await seatWithModes(page, { powerExit });
        return fn(page);
    });

    test('a machine that offers Power exits offers them in the existing-condition dialog',
        () => staged(true, async (page) => {
            const matrixOffers = await page.evalFn(
                (sel) => window.__h.need(sel).powerExitOffered, OWN.matrix);
            assert.equal(matrixOffers, true, 'the matrix half was never the broken one');

            await openCondition(page);
            const opened = await page.evalFn((sel) => window.__h.need(sel).open, OWN.exitDialog);
            assert.equal(opened, true, 'the condition slot opens the exit dialog');
            assert.deepEqual(await offeredTypes(page), ['pressure', 'power'],
                'a flow step exits on pressure or power, and the dialog must offer both');
            assert.deepEqual(page.pageErrors, []);
        }));

    test('the two surfaces agree — the overlay is told exactly what the matrix is told',
        () => staged(true, async (page) => {
            const both = await page.evalFn((sels) => ({
                matrix: window.__h.need(sels.matrix).powerExitOffered,
                overlays: window.__h.need(sels.overlays).powerExitOffered,
            }), { matrix: OWN.matrix, overlays: OWN.overlays });
            assert.deepEqual(both, { matrix: true, overlays: true },
                'one capability, both mounts — a menu that offers what a dialog refuses is '
                + 'the disagreement this wiring exists to prevent');
        }));

    test('a machine that does not offer them is not talked into it', () => staged(false,
        async (page) => {
            const both = await page.evalFn((sels) => ({
                matrix: window.__h.need(sels.matrix).powerExitOffered,
                overlays: window.__h.need(sels.overlays).powerExitOffered,
            }), { matrix: OWN.matrix, overlays: OWN.overlays });
            assert.deepEqual(both, { matrix: false, overlays: false });

            await openCondition(page);
            assert.deepEqual(await offeredTypes(page), ['pressure'],
                'the capability is the machine\'s statement and the editor may not widen it');
        }));
});
