/**
 * The header Save and Cancel over every pending group at once.
 *
 * Drives the real settings model, the real LED store over the fixture's server, and the
 * header's own buttons, and reads what reaches the wire.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, BENCH } from '../harness/index.js';

const MODULES = ['/test/fixtures/settings-shell-fixture.js'];
const STAGE = '<div id="stage" style="inline-size: 100%; block-size: 100dvh"></div>';

const STAGED_ROW = 'machine-flush-duration';

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

describe('one Save, every pending group', () => {
    let page;

    before(async () => {
        page = await browser.newPage({ geometry: BENCH });
        await page.mount(STAGE, MODULES);
        await page.evalFn(() => window.__settings.mount().then(() => true));
        assert.deepEqual(page.pageErrors, [], 'the screen must mount without throwing');

        await page.evalFn(() => window.__settings.capabilities(['ledStrip']).then(() => true));
        await page.settle();
    });

    after(async () => { await page?.close(); });

    const show = async (categoryId, leafId) => {
        await page.evalFn(async (c, l) => {
            await window.__settings.selectCategory(c);
            await window.__settings.selectLeaf(l);
            return true;
        }, categoryId, leafId);
        await page.settle();
    };

    const stageMachineField = async (value) => {
        await show('machine', 'machine-flush');
        const done = await page.evalFn(
            (row, v) => window.__settings.change(row, v).then((ok) => ok),
            STAGED_ROW, value,
        );
        assert.equal(done, true, 'the staging control must exist');
        await page.settle();
    };

    const previewColour = async () => {
        await show('accessories', 'accessories-lighting');
        const picked = await page.evalFn(() => window.__settings.pickSwatch(1).then((ok) => ok));
        assert.equal(picked, true, 'the preset swatch must exist on the Lighting leaf');
        await page.settle();
    };

    const press = (which) => page.evalFn(async (button) => {
        const screen = document.querySelector('settings-screen');
        const left = [];
        const listener = (event) => left.push(event.detail?.route ?? null);
        document.addEventListener('navigate', listener);
        screen.shadowRoot.getElementById('band').shadowRoot.getElementById(button).click();
        await new Promise((r) => setTimeout(r, 60));
        document.removeEventListener('navigate', listener);
        await screen.updateComplete;
        return {
            left,
            refusal: screen.shadowRoot.getElementById('commit-refusal')?.textContent.trim() ?? null,
            count: screen.changeCount,
            server: window.__settings.server(),
            ledDirty: window.__settings.stores().led.get().dirty,
            staged: window.__settings.model().changeCount,
        };
    }, which);

    const server = () => page.evalFn(() => window.__settings.server());

    const reset = async () => {
        await page.evalFn(async () => {
            window.__settings.refuseWrites(false);
            window.__settings.failRoute('PUT /machine/ledStrip', false);
            window.__settings.failRoute('POST /machine/ledStrip/preview', false);
            window.__settings.model().discard();
            await window.__settings.stores().led.reset();
            return true;
        });
        await page.settle();
    };

    test('a machine field staged on one leaf survives a Save pressed on another', async () => {
        await reset();
        const before_ = await server();
        await stageMachineField(9);
        await previewColour();

        const said = await press('save');

        assert.deepEqual(said.left, ['live'], 'both groups were accepted, so the gesture leaves');
        assert.equal(said.refusal, null, 'nothing refused, so nothing is reported');
        assert.equal(said.staged, 0, 'the staged machine field was written, not abandoned');
        assert.equal(said.ledDirty, false, 'and the palette was stored');
        assert.equal(said.server.ledWrites, before_.ledWrites + 1,
            'exactly one storing write reached the wire');
    });

    test('Cancel from another leaf resets a preview made on Lighting', async () => {
        await reset();
        await previewColour();
        assert.equal(await page.evalFn(() => window.__settings.stores().led.get().dirty), true,
            'the preview is uncommitted before the gesture');
        await show('machine', 'machine-steam');
        const before_ = await server();

        const said = await press('cancel');

        assert.deepEqual(said.left, ['live'], 'Cancel leaves, as it does everywhere');
        assert.equal(said.server.ledResets, before_.ledResets + 1,
            'the strip was reloaded from NVM although Lighting was not the page showing');
        assert.equal(said.ledDirty, false, 'so there is nothing left pending');
    });

    test('Cancel with nothing pending sends nothing to the machine', async () => {
        await reset();
        await show('machine', 'machine-steam');
        const before_ = await server();

        const said = await press('cancel');

        assert.deepEqual(said.left, ['live'], 'a clean page still leaves');
        assert.equal(said.server.ledResets, before_.ledResets,
            'a reset is a request; a page with nothing pending must not make one');
    });

    test('a refused machine write keeps its edit, names its group, and does not undo the other', async () => {
        await reset();
        await stageMachineField(8);
        await previewColour();
        await page.evalFn(() => { window.__settings.refuseWrites(true); return true; });
        const before_ = await server();

        const refused = await press('save');

        assert.deepEqual(refused.left, [], 'a group that did not land must not carry anyone off the page');
        assert.ok(refused.staged > 0, 'the machine edit is still the person\'s to save');
        assert.match(String(refused.refusal), /Machine settings/,
            'the line says WHICH group refused, or a partial save is unreadable');
        assert.match(String(refused.refusal), /refused|busy|not connected/i,
            'and why');
        assert.equal(refused.ledDirty, false, 'the group that succeeded is done');
        assert.equal(refused.server.ledWrites, before_.ledWrites + 1, 'and was written once');

        await page.evalFn(() => { window.__settings.refuseWrites(false); return true; });
        const retried = await press('save');

        assert.deepEqual(retried.left, ['live'], 'with the machine back, the gesture completes');
        assert.equal(retried.staged, 0, 'and the edit that was kept is now written');
        assert.equal(retried.server.ledWrites, before_.ledWrites + 1,
            'the palette that already landed was NOT sent a second time');
    });

    test('a refused colour write keeps the colours, names its group, and leaves the written field written', async () => {
        await reset();
        await stageMachineField(7);
        await previewColour();

        await page.evalFn(() => {
            window.__settings.failRoute('PUT /machine/ledStrip', true);
            return true;
        });
        const before_ = await server();

        const refused = await press('save');

        assert.deepEqual(refused.left, [], 'one group refused, so the screen stays');
        assert.equal(refused.ledDirty, true, 'the colours are still the person\'s to save');

        const onLeaf = await page.evalFn(() => {
            const root = document.querySelector('settings-screen').shadowRoot;
            return {
                band: root.getElementById('commit-refusal')?.textContent.trim() ?? null,
                leaf: root.getElementById('bespoke')?.shadowRoot
                    ?.getElementById('led-refusal')?.textContent.trim() ?? null,
            };
        });
        assert.equal(onLeaf.band, null, 'the same failure was printed twice on one screen');
        assert.match(String(onLeaf.leaf), /would not take|busy|not connected/i,
            'and the page the colours are on has to say what happened to them');

        await show('machine', 'machine-steam');
        const elsewhere = await page.evalFn(() => document.querySelector('settings-screen')
            .shadowRoot.getElementById('commit-refusal')?.textContent.trim() ?? null);
        assert.match(String(elsewhere), /Lighting/, 'and it names which group');

        const region = await page.evalFn(() => {
            const root = document.querySelector('settings-screen').shadowRoot;
            const el = root.getElementById('refusal-region');
            if (!el) return null;
            const style = getComputedStyle(el);
            const host = getComputedStyle(document.querySelector('settings-screen'));
            return {
                row: style.gridRowStart,
                padded: parseFloat(style.paddingInlineStart),
                ground: style.backgroundColor,
                seam: host.backgroundColor,
            };
        });
        assert.notEqual(region, null, 'the retained status has no region of its own');
        assert.notEqual(region.row, 'auto', 'and no assigned row — it is auto-placed');
        assert.ok(region.padded > 0, 'a sentence that wraps against the viewport edge');
        assert.notEqual(region.ground, region.seam,
            'the status took the seam colour as its ground, because the screen has no other');

        await show('accessories', 'accessories-lighting');
        assert.equal(refused.staged, 0,
            'the machine field went out, so the retry below has nothing of its to repeat');
        assert.equal(refused.server.ledWrites, before_.ledWrites,
            'a refused PUT must not be counted as a palette the machine took');

        await page.evalFn(() => {
            window.__settings.failRoute('PUT /machine/ledStrip', false);
            return true;
        });
        const retried = await press('save');

        assert.deepEqual(retried.left, ['live'], 'the second press completes the gesture');
        assert.equal(retried.ledDirty, false, 'and the colours are saved');
        assert.equal(retried.server.ledWrites, before_.ledWrites + 1, 'one write, not two');

        const clean = await page.evalFn(async () => {
            const screen = document.querySelector('settings-screen');
            await screen.updateComplete;
            return Boolean(screen.shadowRoot.getElementById('refusal-region'));
        });
        assert.equal(clean, false, 'the region has to be absent when there is nothing to say');
    });

    test('a drag, a Cancel and a Save each send exactly what they are supposed to', async () => {
        await reset();
        await show('accessories', 'accessories-lighting');

        const drag = await page.evalFn(async () => {
            const api = window.__settings;
            const was = api.server();
            api.clearWire();
            for (let i = 1; i <= 7; i += 1) await api.pickSwatch(i);
            await api.stores().led.previewSettled();
            return { was, wire: api.wire(), server: api.server(), counters: api.ledCounters() };
        });

        assert.ok(drag.wire.length > 0, 'a drag put nothing on the wire at all');
        assert.deepEqual([...new Set(drag.wire)], ['POST /machine/ledStrip/preview'],
            `a drag sent something other than previews: ${drag.wire.join(', ')}`);
        assert.equal(drag.server.ledWrites, drag.was.ledWrites,
            'a drag must never write the stored palette');
        assert.equal(drag.counters.previewPeak, 1, 'and never two previews at once');
        assert.equal(drag.server.ledShown.frontStrip, drag.server.ledPreviewLast.frontStrip,
            'the strip is left showing the last frame of the drag');

        const cancelled = await page.evalFn(async () => {
            window.__settings.clearWire();
            const screen = document.querySelector('settings-screen');
            screen.shadowRoot.getElementById('band').shadowRoot.getElementById('cancel').click();
            await new Promise((r) => setTimeout(r, 120));
            return { wire: window.__settings.wire(), server: window.__settings.server() };
        });

        assert.deepEqual(cancelled.wire, [
            'POST /machine/ledStrip/preview/clear',
            'POST /machine/ledStrip/reset',
        ], `Cancel sent: ${cancelled.wire.join(', ')}`);
        assert.equal(cancelled.server.ledWrites, drag.was.ledWrites,
            'Cancel stored a palette nobody kept');
        assert.equal(cancelled.server.ledShown, null,
            'the tried colour was left standing on the strip until the next sleep');

        await show('accessories', 'accessories-lighting');
        const saved = await page.evalFn(async () => {
            const api = window.__settings;
            await api.pickSwatch(3);
            await api.stores().led.previewSettled();
            api.clearWire();
            const screen = document.querySelector('settings-screen');
            screen.shadowRoot.getElementById('band').shadowRoot.getElementById('save').click();
            await new Promise((r) => setTimeout(r, 120));
            return { wire: api.wire(), server: api.server() };
        });

        assert.deepEqual(saved.wire, [
            'PUT /machine/ledStrip',
            'POST /machine/ledStrip/preview/clear',
        ], `Save sent: ${saved.wire.join(', ')}`);
        assert.ok(!saved.wire.includes('POST /machine/ledStrip/commit'),
            'a request that runs an empty method was posted, and its refusal was reportable');
        assert.equal(saved.server.ledShown, null, 'and the preview did not outlive the save');
    });

    test('a colour cannot be changed while its Save is in flight, and the page says so', async () => {
        await reset();
        await show('accessories', 'accessories-lighting');

        const held = await page.evalFn(async () => {
            const api = window.__settings;
            await api.pickSwatch(2);
            await api.stores().led.previewSettled();
            const reviewed = api.stores().led.hex('frontStrip', 'awake');

            api.holdLed();
            api.clearWire();
            const screen = document.querySelector('settings-screen');
            screen.shadowRoot.getElementById('band').shadowRoot.getElementById('save').click();
            await new Promise((r) => setTimeout(r, 40));
            await api.bespokeEl().updateComplete;

            const root = api.bespokeEl().shadowRoot;
            const frozen = {
                wheel: root.getElementById('led-wheel').hasAttribute('disabled'),
                presets: root.getElementById('led-presets').hasAttribute('disabled'),
                power: root.getElementById('led-power').hasAttribute('disabled'),
                status: root.getElementById('led-status')?.textContent.trim() ?? null,
            };

            await api.pickSwatch(6);
            const during = api.stores().led.hex('frontStrip', 'awake');

            api.freeLed();
            await new Promise((r) => setTimeout(r, 120));
            await api.bespokeEl().updateComplete;

            return {
                reviewed,
                frozen,
                during,
                after: api.stores().led.hex('frontStrip', 'awake'),
                wire: api.wire(),
                server: api.server(),
                dirty: api.stores().led.get().dirty,
            };
        });

        assert.equal(held.frozen.wheel, true, 'the wheel stayed live while its save was out');
        assert.equal(held.frozen.presets, true, 'and so did the presets');
        assert.equal(held.frozen.power, true, 'and so did Power');
        assert.match(String(held.frozen.status), /saving/i,
            'a frozen picker with nothing said about why is a page that looks broken');

        assert.equal(held.during, held.reviewed,
            'the press during the save moved the draft, which the save then discarded');
        assert.equal(held.after, held.reviewed,
            'the colour the machine was given is the one that was reviewed');
        const stored = held.server.ledLast.frontStrip.awake;
        assert.equal(
            `#${stored.slice(0, 2)}${stored.slice(4, 6)}${stored.slice(8, 10)}`.toLowerCase(),
            held.reviewed.toLowerCase(),
            'and it is the colour that reached the wire',
        );
        assert.equal(held.wire.filter((one) => one === 'PUT /machine/ledStrip').length, 1,
            'one save, one storing write');
        assert.equal(held.dirty, false, 'and nothing is left half-saved');
    });

    test('a machine change that landed is not reported as nothing saved', async () => {
        await reset();
        await page.evalFn(() => { window.__settings.refuseRemembered(false); return true; });
        await show('machine', 'machine-steam');

        const flipped = await page.evalFn(() => window.__settings.change('machine-steam-enabled', false).then((ok) => ok));
        assert.equal(flipped, true, 'the master switch must be on the page');
        await page.settle();

        await page.evalFn(() => { window.__settings.refuseRemembered(true); return true; });
        const said = await press('save');

        assert.deepEqual(said.left, [], 'half a save is not a finished one, so the screen stays');
        assert.equal(said.server.machineWorkflow.steamTargetTemperature, 0,
            'the machine half has to have landed, or this proves nothing');
        assert.doesNotMatch(String(said.refusal), /Nothing was saved/i,
            'the machine is holding the change and the screen said it was not');
        assert.doesNotMatch(String(said.refusal), /^Machine settings/,
            'the machine settings are the half that DID land — naming them as the refusal '
            + 'points at the wrong one');
        assert.match(String(said.refusal), /machine took the change/i,
            'the sentence has to say what actually happened');
        assert.match(String(said.refusal), /remember/i, 'and which half did not');

        await page.evalFn(() => { window.__settings.refuseRemembered(false); return true; });
        const afterFirst = await server();
        const retried = await press('save');

        assert.deepEqual(retried.left, ['live'], 'with the tablet writing again, the gesture completes');
        assert.equal(retried.refusal, null, 'and there is nothing left to report');
        assert.equal(retried.server.workflowWrites, afterFirst.workflowWrites,
            'the machine half was sent to a machine that already had it');
    });
});
