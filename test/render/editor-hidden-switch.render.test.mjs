/**
 * editor-hidden-switch.render.test.mjs — "HIDDEN FROM THE LIBRARY" IS A REAL SWITCH (D20).
 *
 * Ben, 30 August 2026, on round 1's partial F-031 — six of the eight Settings controls
 * were built and the two switches were left dead:
 *
 *   "build the two record-level switches properly … Each needs: a store writer …, its own
 *    request on commit …, change tracked and shown (they are NOT profile-draft changes —
 *    decide the honest UI …), and tests."
 *
 * ONE OF THE TWO IS BUILT. "Machine default" is PARKED on the pin's own evidence — at
 * `2b047d02` no route writes `isDefault`, and the flag does not mean what the label says
 * (it marks a BUNDLED profile and acts as a guard against editing, purging and deleting).
 * That half is in the fix log, not in this file; a test cannot be written for a route that
 * does not exist.
 *
 * WHAT IS ASSERTED IS THE WHOLE CHAIN, because every link of it was missing:
 *   1. the switch composes, is NAMED, and reads the record it was opened on;
 *   2. a press sends ITS OWN request — `PUT /profiles/<id>/visibility` with the bare
 *      `{visibility}` field, exactly the shape the pinned handler requires;
 *   3. the switch asserts only what the SERVER answered, never the press;
 *   4. a refusal leaves the glass telling the truth, in the server's own words;
 *   5. it is NOT a draft change — the change count and the save body are untouched;
 *   6. an unseated draft gets an unavailable control and a reason, not a dead one.
 *
 * A8: nothing here reads a source file. Every assertion is a recorded request, a live
 * property, or a name computed by Chrome's own accessibility tree.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';
import {
    EDITOR, mountEditor, seatProfile, editingProfile, editorCalls, selectPanel,
} from '../harness/editor.js';

const geometry = GATE_A_GEOMETRIES[0];

const SWITCH = 'editor-screen >>> #field-hidden';

/**
 * The path `callRoute` spells for the seated record. The colon in a ProfileRecord id
 * (`profile:<hex>`) is percent-encoded into the segment, which is what the pinned
 * handler's own `Uri.decodeComponent(id)` undoes.
 */
const VISIBILITY_PATH = `/profiles/${encodeURIComponent('profile:seated')}/visibility`;
const VISIBILITY_KEY = `PUT ${VISIBILITY_PATH}`;

/** The switch's live face — what a person sees, read off the element rather than the markup. */
const face = (page) => page.evalFn((sel) => {
    const screen = window.__h.need(sel);
    const control = screen.renderRoot.querySelector('#field-hidden');
    if (!control) return null;
    const row = control.closest('.field');
    return {
        checked: control.checked === true,
        disabled: control.disabled === true,
        ariaChecked: control.getAttribute('aria-checked'),
        state: control.dataset.face ?? null,
        caption: (row?.querySelector('[role="status"]')?.textContent ?? '').trim(),
        label: (row?.querySelector('#field-hidden-label')?.textContent ?? '').trim(),
    };
}, EDITOR.screen);

/** The switch's accessible NAME, from Chrome's tree — the only place a name is real. */
async function switchName(page) {
    await page.send('Accessibility.enable');
    const found = await page.evalFn((sel) => {
        const screen = window.__h.need(sel);
        window.__switchNode = screen.renderRoot.querySelector('#field-hidden');
        return Boolean(window.__switchNode);
    }, EDITOR.screen);
    assert.equal(found, true, 'the switch must be composed to be named');
    const { result } = await page.send('Runtime.evaluate', {
        expression: 'window.__switchNode', returnByValue: false,
    });
    const { nodes } = await page.send('Accessibility.getPartialAXTree', {
        objectId: result.objectId, fetchRelatives: false,
    });
    const node = nodes.find((n) => n.role?.value === 'switch') ?? nodes[0];
    return { name: node?.name?.value ?? '', role: node?.role?.value ?? '' };
}

/** The draft's change count and named fields — the fact a save is built from. */
const change = (page) => page.evalFn((sel) => {
    const screen = window.__h.need(sel);
    const answer = window.__editorStore.changeCount(screen._draft);
    return { count: answer.count, fields: answer.fields };
}, EDITOR.screen);

/** Only the visibility calls, so a save's own POST does not have to be filtered by hand. */
const visibilityCalls = async (page) => (await editorCalls(page))
    .filter((call) => String(call.path).endsWith('/visibility'));

/** A record with a stated visibility, otherwise the harness's own seated shape. */
const recordWith = (visibility, over = {}) => ({
    id: 'profile:seated',
    profile: editingProfile(),
    metadataHash: 'meta-0',
    compoundHash: 'compound-0',
    parentId: null,
    visibility,
    isDefault: false,
    createdAt: '2026-08-21T00:00:00.000Z',
    updatedAt: '2026-08-21T00:00:00.000Z',
    metadata: null,
    ...over,
});

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

describe('the library-visibility switch (D20)', () => {
    /**
     * The stage: the screen's OWN settings rows (fields: 0 leaves the slot empty so the
     * fallback renders), seated on a record whose visibility the case chooses, with the
     * Settings tab showing.
     */
    const staged = (opts, fn) => browser.withPage({ geometry }, async (page) => {
        await mountEditor(page, { matrix: null, fields: 0 });
        await seatProfile(page, opts);
        await selectPanel(page, 'settings');
        return fn(page);
    });

    test('it is composed, it is NAMED, and it reads the record it was opened on',
        () => staged({ record: recordWith('visible') }, async (page) => {
            const seen = await face(page);
            assert.ok(seen, 'the row is on the glass at all');
            assert.equal(seen.label, 'Hidden from the library', 'the printed word');
            assert.equal(seen.checked, false, 'a VISIBLE record is not hidden');
            assert.equal(seen.disabled, false, 'and it is pressable');
            assert.equal(seen.state, 'settled');
            assert.equal(seen.caption, 'The library lists this profile.',
                'the caption states the outcome, not the control');

            const named = await switchName(page);
            assert.equal(named.role, 'switch', 'it is a switch, not a paint');
            assert.equal(named.name, 'Hidden from the library',
                'the announced name IS the printed word — one element, pointed at');
        }));

    test('a HIDDEN record opens with the switch on', () => staged(
        { record: recordWith('hidden') }, async (page) => {
            const seen = await face(page);
            assert.equal(seen.checked, true);
            assert.equal(seen.ariaChecked, 'true', 'and it says so to a screen reader');
            assert.equal(seen.caption, 'The library is not listing this profile.');
        },
    ));

    test('a press sends ITS OWN request, with the BARE visibility field', () => staged(
        { record: recordWith('visible') }, async (page) => {
            await page.click(SWITCH);
            await page.settle(6);

            const calls = await visibilityCalls(page);
            assert.equal(calls.length, 1, 'exactly one request, and it is this one');
            assert.equal(calls[0].method, 'PUT');
            assert.equal(calls[0].path, VISIBILITY_PATH,
                'the route names the record, percent-encoded — a ProfileRecord id is '
                + '"profile:<hex>" and the colon has to survive the path segment; the '
                + 'handler runs Uri.decodeComponent on it at the other end');
            assert.deepEqual(calls[0].body, { visibility: 'hidden' },
                'the bare field — this route is NOT wrapped in a profile key, unlike the '
                + 'two save routes, and a missing key is a 400 at the pin');
        },
    ));

    test('the switch asserts what the SERVER said, and never the press', () => staged(
        {
            record: recordWith('visible'),
            /* The server stores VISIBLE despite being asked for hidden. A skin that
             * flipped on the press would now be lying; the answer states the new state,
             * so the switch reads the answer. */
            answers: {
                [VISIBILITY_KEY]: { ok: true, status: 200, data: recordWith('visible') },
            },
        },
        async (page) => {
            await page.click(SWITCH);
            await page.settle(6);
            const seen = await face(page);
            assert.equal(seen.checked, false,
                'the switch went back to what the library actually says');
            assert.equal(seen.caption, 'The library lists this profile.');
        },
    ));

    test('and it takes the answer when the answer agrees', () => staged(
        {
            record: recordWith('visible'),
            answers: {
                [VISIBILITY_KEY]: { ok: true, status: 200, data: recordWith('hidden') },
            },
        },
        async (page) => {
            await page.click(SWITCH);
            await page.settle(6);
            const seen = await face(page);
            assert.equal(seen.checked, true, 'now it is hidden, because the server said so');
            assert.equal(seen.state, 'settled');
            assert.equal(seen.caption, 'The library is not listing this profile.');
        },
    ));

    test('a REFUSAL leaves the glass true, in the server\'s own words', () => staged(
        {
            record: recordWith('visible'),
            answers: {
                /* THE FAILURE SHAPE IS THE TRANSPORT'S. `profileRefusal` reads a typed
                 * 400 off `problem`, which is where `createReaTransport` puts a JSON
                 * error body; `data` is the SUCCESS payload and a refusal has none. */
                [VISIBILITY_KEY]: {
                    ok: false,
                    status: 400,
                    problem: {
                        error: 'Invalid request',
                        message: 'Invalid argument(s): Cannot delete default profiles, only hide them',
                    },
                },
            },
        },
        async (page) => {
            await page.click(SWITCH);
            await page.settle(6);
            const seen = await face(page);
            assert.equal(seen.state, 'failed');
            assert.equal(seen.checked, false,
                'nothing changed, so the switch shows nothing changed — the press left no trace');
            assert.match(seen.caption, /Cannot delete default profiles/,
                'the server\'s sentence is printed verbatim, not paraphrased');
            assert.equal(seen.disabled, false, 'and it can be tried again');
        },
    ));

    test('it is NOT a draft change — no count, and the save body is untouched',
        () => staged({ record: recordWith('visible') }, async (page) => {
            const before = await change(page);
            assert.equal(before.count, 0, 'a freshly seated record is clean');

            await page.click(SWITCH);
            await page.settle(6);

            const after = await change(page);
            assert.deepEqual(after, before,
                'a record property is not a profile key: it moves no draft field and '
                + 'counts as no unsaved change');

            /* And the save that follows carries the profile and nothing of this. */
            await page.click(EDITOR.save);
            await page.settle(8);
            const posts = (await editorCalls(page)).filter((c) => c.method === 'POST');
            for (const post of posts) {
                assert.equal('visibility' in (post.body ?? {}), false,
                    'the save body has no visibility field — it never did and must not gain one');
            }
        }));

    /**
     * A NEW PROFILE, staged exactly as `selector-screen.js #openNewProfile` makes it: a
     * record object with a **null id** round a freshly seeded profile. There is a draft,
     * so the panel composes its rows — and there is no id, so there is nothing for a
     * visibility write to address.
     */
    test('an UNSEATED draft gets an unavailable control and a reason', () => staged(
        { record: recordWith('visible', { id: null, metadataHash: null, compoundHash: null }) },
        async (page) => {
            const seen = await face(page);
            assert.ok(seen, 'the row is still composed — a dead control is not the answer');
            assert.equal(seen.state, 'unseated');
            assert.equal(seen.disabled, true,
                'a profile the library has never seen cannot be hidden from it');
            assert.equal(seen.checked, false);
            assert.equal(seen.caption,
                'Save this profile first — the library has nothing to hide yet.',
                'unavailable AND the reason, which is the ranges door\'s own rule');

            /* And pressing it writes nothing — a disabled ui-switch does not toggle, and
             * the store refuses an id-less write in any case. */
            await page.click(SWITCH);
            await page.settle(4);
            assert.deepEqual(await visibilityCalls(page), []);
        },
    ));

    test('a visibility this build has no switch position for is UNAVAILABLE, and says which',
        () => staged({ record: recordWith('deleted') }, async (page) => {
            const seen = await face(page);
            assert.equal(seen.state, 'unknown');
            assert.equal(seen.disabled, true,
                'a deleted record is not "not hidden", and a switch that read it as off '
                + 'would be inventing a state the server never named');
            assert.equal(seen.checked, false);
            assert.match(seen.caption, /deleted/,
                'the caption names what the server actually said');
        }));

    test('the caption is a live region, so the outcome is HEARD',
        () => staged({ record: recordWith('visible') }, async (page) => {
            const role = await page.evalFn((sel) => {
                const screen = window.__h.need(sel);
                const row = screen.renderRoot.querySelector('#field-hidden').closest('.field');
                return row.querySelector('[role="status"]')?.getAttribute('role') ?? null;
            }, EDITOR.screen);
            assert.equal(role, 'status',
                'the only place the press\'s outcome is stated must reach a screen reader');
        }));
});
