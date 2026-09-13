/**
 * "Edit profile" opens the recipe the machine is running, or nothing at all.
 *
 * Covers the join between screen, shell and store: an intent dispatched from inside a
 * shadow root, the shell deciding what to seat, and the editor store holding it after the
 * route swap. One geometry — nothing here measures a box.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, BENCH } from '../harness/index.js';

const MODULES = ['/test/fixtures/edit-active-recipe-fixture.js'];

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

describe(`Edit profile @ ${BENCH.name}`, () => {
    const mounted = (fn) => browser.withPage({ geometry: BENCH }, async (page) => {
        await page.mount('', MODULES);
        const state = await page.evalFn(() => window.__editIntent.mount());
        assert.deepEqual(page.pageErrors, [], 'the shell must boot without throwing');
        return fn(page, state);
    });

    test('a library profile that only shares the title is not the loaded profile', () => mounted(
        async (page, state) => {
            assert.equal(state.records, 1, 'one record in the library, and it is a six-step "Default"');
            assert.equal(state.loadedTitle, 'Default');
            assert.equal(state.loadedId, null,
                'the machine is running a one-step "Default" — the six-step row is a different recipe');
            assert.equal(state.loadedReason, 'contentMismatch');
        },
    ));

    test('Edit opens the exact steps the machine is running, unlinked', () => mounted(
        async (page) => {
            const pressed = await page.evalFn(() => window.__editIntent.pressEdit());

            assert.equal(pressed.route, 'editor', 'the press still reaches the editor route');
            assert.equal(pressed.hash, '#/editor', 'and the address moved with it');
            assert.ok(pressed.seated, 'the editor takes what it is given, so something must be given');
            assert.deepEqual(pressed.seated.steps, [{ name: 'Free flow', seconds: 120 }],
                'the recipe on the machine, step for step');
            assert.equal(pressed.seated.id, null,
                'and with no id, so the first Save stores a new profile');
            assert.equal(pressed.seated.parentId, null,
                'no parent either — it is not a version of the profile that shares its name');
        },
    ));
});
