/**
 * What happens to an edit made while a save is in flight.
 *
 * The later edit wins and the editor stays open holding it: the answer becomes the new
 * baseline when the draft is no longer the one that was sent. The band says a save is
 * running, and a second press while one is running sends nothing.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';
import { EDITOR, mountEditor, editingProfile, selectPanel } from '../harness/editor.js';

const GEOMETRY = GATE_A_GEOMETRIES[0];
const WEIGHT = 'editor-screen >>> #field-target-weight';
const WEIGHT_UP = `${WEIGHT} >>> #increment`;
const WEIGHT_DOWN = `${WEIGHT} >>> #decrement`;
const SAVING = 'editor-screen >>> #saving';

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

const seatHeldSave = (page, seated) => page.evalFn(async (payload) => {
    const [storeMod, adapters] = await Promise.all([
        import('/src/stores/profile-editor-store.js'),
        import('/src/data/adapters-r.js'),
    ]);

    const calls = [];
    window.__calls = calls;
    let answer = null;
    let waiting = null;
    window.__release = (given) => {
        answer = given;
        if (waiting) { waiting(given); waiting = null; }
        return true;
    };

    const transport = {
        async request(path, options = {}) {
            const call = { path, method: options.method ?? 'GET', body: options.body ?? null };
            calls.push(call);
            if (call.method === 'POST' && call.path === '/profiles') {
                const given = answer ?? await new Promise((resolve) => { waiting = resolve; });
                if (given.thrown) throw new Error(given.thrown);
                if (!given.ok) return given;
                return {
                    ok: true,
                    status: 201,
                    data: {
                        ...payload.seated,
                        id: 'profile:saved',
                        parentId: payload.seated.id,
                        profile: call.body.profile,
                        metadata: call.body.metadata ?? null,
                        metadataHash: 'meta-1',
                    },
                };
            }
            return { ok: true, status: 200, data: { ...payload.seated, visibility: 'hidden' } };
        },
    };

    const editor = storeMod.createProfileEditorStore({ transport });
    const screen = window.__h.need('editor-screen');
    window.__editorStore = editor;
    window.__left = 0;
    if (window.__onLeave) screen.removeEventListener('navigate', window.__onLeave);
    window.__onLeave = () => { window.__left += 1; };
    screen.addEventListener('navigate', window.__onLeave);
    screen.boot = {
        profileEditor: editor,
        capabilities: { machineLimits: () => adapters.r2MachineLimits(payload.capabilities) },
        logger: null,
    };
    editor.open(payload.seated);
    await screen.updateComplete;
}, {
    seated,
    capabilities: [{ id: 'machine' }],
});

const record = (profile) => ({
    id: 'profile:seed',
    profile,
    parentId: null,
    metadata: null,
    visibility: 'visible',
    isDefault: false,
    metadataHash: 'meta-0',
    compoundHash: 'compound-0',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
});

async function open(page) {
    await mountEditor(page, { matrix: null, fields: 0 });
    await page.evalFn(() => { window.__seed = null; });
    await seatHeldSave(page, record(editingProfile()));
    await page.settle(6);
    assert.equal(await selectPanel(page, 'settings'), 'settings');
    assert.equal(await page.exists(WEIGHT), true, 'the drink-weight row is on the panel');
}

const weight = (page) => page.evalFn((s) => window.__h.need(s).value, WEIGHT);
const draftWeight = (page) => page.evalFn(
    (s) => window.__h.need(s)._draft.target_weight, EDITOR.screen,
);
const saveLabel = (page) => page.evalFn(
    (s) => (window.__h.q(s)?.textContent ?? '').trim(), EDITOR.save,
);
const posts = (page) => page.evalFn(
    () => window.__calls.filter((c) => c.method === 'POST' && c.path === '/profiles').length,
);
const left = (page) => page.evalFn(() => window.__left);
const release = (page, answer) => page.evalFn((a) => window.__release(a), answer);
const saveStatus = (page) => page.evalFn(() => window.__editorStore.get().save);
const noticeText = (page) => page.evalFn(
    (s) => (window.__h.q(s)?.textContent ?? '').trim(), EDITOR.notice,
);

const remount = (page) => page.evalFn(async () => {
    const old = window.__h.need('editor-screen');
    const boot = old.boot;
    document.getElementById('stage').innerHTML = '<editor-screen></editor-screen>';
    const fresh = window.__h.need('editor-screen');
    fresh.addEventListener('navigate', window.__onLeave);
    fresh.boot = boot;
    await window.__h.settle(6);
    return fresh !== old;
});

describe('an edit made while Save is pending', () => {

    test('survives the response, and the editor stays open holding it',
        () => browser.withPage({ geometry: GEOMETRY }, async (page) => {
            await open(page);

            await page.click(WEIGHT_UP);
            await page.settle(4);
            const submitted = await draftWeight(page);
            assert.equal(await saveLabel(page), 'Save (1)', 'one change, counted');

            await page.click(EDITOR.save);
            await page.settle(4);
            assert.equal(await posts(page), 1, 'one create is on the wire');
            const sent = await page.evalFn(
                () => window.__calls.find((c) => c.method === 'POST').body.profile.target_weight,
            );
            assert.equal(sent, submitted, 'what was sent is what was on screen when it was pressed');

            await page.click(WEIGHT_UP);
            await page.settle(4);
            const later = await draftWeight(page);
            assert.ok(later > submitted, `the later edit landed (${submitted} -> ${later})`);

            await release(page, { ok: true });
            await page.settle(8);

            assert.equal(await draftWeight(page), later,
                'THE LATER EDIT SURVIVED — the served profile did not overwrite a draft '
                + 'that had moved on since it was sent');
            assert.equal(await weight(page), later, 'and the control on screen shows it');
            assert.equal(await left(page), 0,
                'the editor did not close over an unsaved edit');
            assert.equal(await saveLabel(page), 'Save (1)',
                'the save became the baseline, so the newer edit counts as the one unsaved change');
        }));

    test('a save that FAILS leaves the later edit exactly where it is',
        () => browser.withPage({ geometry: GEOMETRY }, async (page) => {
            await open(page);
            await page.click(WEIGHT_UP);
            await page.settle(4);
            await page.click(EDITOR.save);
            await page.settle(4);
            await page.click(WEIGHT_UP);
            await page.settle(4);
            const later = await draftWeight(page);

            await release(page, {
                ok: false, kind: 'http', status: 500, message: 'Internal server error', problem: null,
            });
            await page.settle(8);

            assert.equal(await draftWeight(page), later, 'the draft is untouched by a failure');
            assert.equal(await left(page), 0, 'and the editor stays, so the work can be retried');
            const notice = await page.evalFn(
                (s) => (window.__h.q(s)?.textContent ?? '').trim(), EDITOR.notice,
            );
            assert.match(notice, /failed/i, 'the failure is said out loud');
        }));

    test('with no later edit the answer is adopted and the editor closes, as before',
        () => browser.withPage({ geometry: GEOMETRY }, async (page) => {
            await open(page);
            await page.click(WEIGHT_UP);
            await page.settle(4);
            const submitted = await draftWeight(page);

            await page.click(EDITOR.save);
            await page.settle(4);
            await release(page, { ok: true });
            await page.settle(8);

            assert.equal(await left(page), 1,
                'an untouched draft is the case the close was built for — one press of '
                + 'Save writes and leaves');
            assert.equal(await draftWeight(page), submitted,
                'the draft is the server\'s answer — the same number, from the record');
            assert.equal(await page.evalFn(() => window.__editorStore.get().record.id),
                'profile:saved', 'and the screen is seated on the saved record');
        }));

    test('an edit that is put back before the answer lands is not a later edit',
        () => browser.withPage({ geometry: GEOMETRY }, async (page) => {
            await open(page);
            await page.click(WEIGHT_UP);
            await page.settle(4);
            const submitted = await draftWeight(page);

            await page.click(EDITOR.save);
            await page.settle(4);

            await page.click(WEIGHT_UP);
            await page.settle(4);
            await page.click(WEIGHT_DOWN);
            await page.settle(4);
            assert.equal(await draftWeight(page), submitted,
                'the draft holds exactly the number that was sent');

            await release(page, { ok: true });
            await page.settle(8);

            assert.equal(await left(page), 1,
                'the draft is the one that was sent, so the save closes as any other does');
            assert.doesNotMatch(await noticeText(page), /still unsaved/i,
                'and nothing claims there is unsaved work, because there is none');
        }));
});

describe('while a save is running the screen says so, and takes no second one', () => {

    test('the Saving state is on screen for the length of the request, and only then',
        () => browser.withPage({ geometry: GEOMETRY }, async (page) => {
            await open(page);
            assert.equal(await page.exists(SAVING), false, 'nothing is running yet');
            const quiet = await page.box(EDITOR.identity);

            await page.click(WEIGHT_UP);
            await page.settle(4);
            await page.click(EDITOR.save);
            await page.settle(4);
            assert.equal(await page.exists(SAVING), true, 'the save is announced while it runs');

            const running = await page.box(EDITOR.identity);
            assert.equal(Math.round(running.height), Math.round(quiet.height));

            await release(page, { ok: true });
            await page.settle(8);
            assert.equal(await page.exists(SAVING), false, 'and goes when the answer lands');
            assert.equal(await page.exists(EDITOR.totals), true, 'the ceilings come back');
        }));

    test('a second press while one is in flight sends nothing',
        () => browser.withPage({ geometry: GEOMETRY }, async (page) => {
            await open(page);
            await page.click(WEIGHT_UP);
            await page.settle(4);

            await page.click(EDITOR.save);
            await page.settle(4);
            await page.click(EDITOR.save);
            await page.settle(4);

            assert.equal(await posts(page), 1,
                'one save is one record — a second create would mint a second version of '
                + 'the same edit');
            assert.equal(await left(page), 0, 'and the second press did not leave either');

            await release(page, { ok: true });
            await page.settle(8);
            assert.equal(await posts(page), 1);
        }));

    test('a second press after the editor is rebuilt sends nothing either',
        () => browser.withPage({ geometry: GEOMETRY }, async (page) => {
            await open(page);
            await page.click(WEIGHT_UP);
            await page.settle(4);
            await page.click(EDITOR.save);
            await page.settle(4);
            assert.equal(await posts(page), 1, 'one create is on the wire');

            assert.equal(await remount(page), true, 'the screen is a new element');
            assert.equal(await selectPanel(page, 'settings'), 'settings');
            await page.click(WEIGHT_UP);
            await page.settle(4);

            await page.click(EDITOR.save);
            await page.settle(4);
            assert.equal(await posts(page), 1,
                'one save is one record whichever element is on screen — the write is the '
                + 'store\'s, and a rebuilt screen must not be able to mint a second version');

            await release(page, { ok: true });
            await page.settle(8);
            assert.equal(await posts(page), 1);
        }));

    test('a request that throws instead of answering leaves Save workable',
        () => browser.withPage({ geometry: GEOMETRY }, async (page) => {
            await open(page);
            await page.click(WEIGHT_UP);
            await page.settle(4);
            await page.click(EDITOR.save);
            await page.settle(4);
            assert.equal(await posts(page), 1);

            await release(page, { thrown: 'the transport fell over' });
            await page.settle(8);

            assert.equal(await saveStatus(page), 'idle',
                'the save surface is back to rest — nothing is on the wire');
            assert.equal(await page.exists(SAVING), false, 'and the band no longer says one is');

            await page.click(EDITOR.save);
            await page.settle(4);
            assert.equal(await posts(page), 2,
                'the retry reached the wire — a request that never answered must not leave '
                + 'Save refusing every press for as long as the editor is open');
        }));
});
