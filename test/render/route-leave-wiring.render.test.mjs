/**
 * The router asks the mounted screen before it swaps it, and a refusal does not turn
 * the Back button into a loop.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, BENCH, GATE_A_GEOMETRIES } from '../harness/index.js';
import {
    EDITOR, mountEditor, seatProfile, editingProfile,
} from '../harness/editor.js';

const SHELL_MODULES = ['/test/fixtures/app-shell-fixture.js', '/test/fixtures/probe-screen.js'];

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

const shell = (fn) => browser.withPage({ geometry: BENCH }, async (page) => {
    await page.mount('', SHELL_MODULES);
    await page.evalFn(async () => {
        await window.__shell.mount({});
        const started = performance.now();
        while (window.__shell.screenTag() !== 'live-screen' && performance.now() - started < 15000) {
            await new Promise((resolve) => { setTimeout(resolve, 10); });
        }
        return window.__shell.screenTag();
    });
    assert.deepEqual(page.pageErrors, [], 'the shell boots without throwing');
    await page.settle(2);
    await fn(page);
});

const armScreen = (page, tag, allow) => page.evalFn((selector, allowLeave) => {
    const mounted = window.__h.q(`app-root >>> ${selector}`);
    if (!mounted) return { armed: false, ships: null };
    const ships = typeof mounted.canLeaveRoute === 'function';
    window.__asked = { count: 0, kinds: [] };
    mounted.canLeaveRoute = (details) => {
        window.__asked.count += 1;
        window.__asked.kinds.push(details && details.kind);
        return allowLeave ? true : { allow: false, reason: 'the test refuses' };
    };
    return { armed: true, ships };
}, tag, Boolean(allow));

const asked = (page) => page.evalFn(() => (window.__asked
    ? { count: window.__asked.count, kinds: window.__asked.kinds.slice() }
    : { count: -1, kinds: [] }));

const address = (page, id) => page.evalFn(async (route) => {
    location.hash = `#/${route}`;
    const started = performance.now();
    while (window.__shell.screenTag() === null && performance.now() - started < 500) {
        await new Promise((resolve) => { setTimeout(resolve, 10); });
    }
    await new Promise((resolve) => { setTimeout(resolve, 250); });
    return { route: window.__shell.state().route, tag: window.__shell.screenTag(), hash: location.hash };
}, id);

const where = (page) => page.evalFn(() => ({
    route: window.__shell.state().route,
    tag: window.__shell.screenTag(),
    hash: location.hash,
    entries: history.length,
}));

describe('the route leave contract, over the shell that ships @ bench', () => {
    test('the screen the app boots into ships an answer, and the router asks it',
        () => shell(async (page) => {
            const armed = await armScreen(page, 'live-screen', false);
            assert.equal(armed.armed, true, 'a screen is mounted to arm');
            assert.equal(armed.ships, true,
                'and it ships `canLeaveRoute` — the shell is not asking a method only a test adds');

            const before = await where(page);
            await address(page, 'settings');
            const after = await where(page);
            const questions = await asked(page);

            assert.ok(questions.count > 0, 'the router asked the mounted screen');
            assert.equal(after.route, before.route, 'and honoured its refusal');
            assert.equal(after.tag, 'live-screen', 'the screen was not replaced');
            assert.deepEqual(page.pageErrors, []);
        }));

    test('a screen that consents is replaced, so the question is a question',
        () => shell(async (page) => {
            await armScreen(page, 'live-screen', true);
            const moved = await address(page, 'probe');
            const questions = await asked(page);

            assert.ok(questions.count > 0, 'the same screen was asked');
            assert.equal(moved.route, 'probe', 'and the route moved');
            assert.equal(moved.tag, 'probe-screen', 'onto the screen the address names');
            assert.deepEqual(page.pageErrors, []);
        }));

    test('a refused Back is answered ONCE and pushes no history entry',
        () => shell(async (page) => {
            await address(page, 'probe');
            const armed = await armScreen(page, 'probe-screen', false);
            assert.equal(armed.armed, true, 'the second screen is mounted and armed');

            const before = await where(page);
            await page.evalFn(async () => {
                history.back();
                await new Promise((resolve) => { setTimeout(resolve, 400); });
                return true;
            });
            const after = await where(page);
            const questions = await asked(page);

            assert.equal(questions.count, 1,
                'ONE press, ONE question — a correction that asked again would be the loop');
            assert.deepEqual(questions.kinds, ['history'],
                'and the router said how it was asked, so the screen could answer differently');
            assert.equal(after.route, 'probe', 'the route did not move');
            assert.equal(after.tag, 'probe-screen', 'the screen was not replaced');
            assert.equal(after.hash, '#/probe', 'and the address was put back');
            assert.equal(after.entries, before.entries,
                'with no new session-history entry — the correction replaced, it did not push');
            assert.deepEqual(page.pageErrors, []);
        }));

    test('a refusal grants nothing to the press after it', () => shell(async (page) => {
        await address(page, 'probe');
        await armScreen(page, 'probe-screen', false);
        await page.evalFn(async () => {
            history.back();
            await new Promise((resolve) => { setTimeout(resolve, 400); });
            return true;
        });
        const refused = await asked(page);
        assert.equal(refused.count, 1, 'the first press was refused');

        await armScreen(page, 'probe-screen', true);
        const left = await address(page, 'live');
        assert.equal(left.route, 'live', 'consent let the route move');

        const armedLive = await armScreen(page, 'live-screen', false);
        assert.equal(armedLive.armed, true, 'Live is mounted again');
        const back = await address(page, 'probe');
        const questions = await asked(page);

        assert.ok(questions.count > 0,
            'the route the earlier refusal armed is not a standing permission to leave');
        assert.equal(back.route, 'live', 'so this refusal was honoured too');
        assert.deepEqual(page.pageErrors, []);
    }));
});

const geometry = GATE_A_GEOMETRIES[0];
const DISCARD = 'editor-screen >>> #discard-dialog';

/** Dirty the draft the way the matrix does — a composed `step-change` at the host. */
async function editSomething(page) {
    await page.evalFn((sel) => {
        window.__h.need(sel).dispatchEvent(new CustomEvent('step-change', {
            detail: { index: 0, row: 'temperature', field: 'temperature', value: 88 },
            bubbles: true,
            composed: true,
        }));
        return true;
    }, EDITOR.screen);
    await page.settle(4);
}

const askEditor = (page) => page.evalFn((sel) => {
    const answer = window.__h.need(sel).canLeaveRoute({ from: 'editor', to: 'live', kind: 'history' });
    return answer === true ? { allow: true, reason: null } : { allow: false, reason: answer.reason };
}, EDITOR.screen);

const dialogOpen = (page) => page.evalFn((sel) => window.__h.need(sel).open === true, DISCARD);

describe('the editor answers the router with its own unsaved work @ bench', () => {
    const staged = (fn) => browser.withPage({ geometry }, async (page) => {
        await mountEditor(page, { matrix: null, fields: 0 });
        await seatProfile(page, { profile: editingProfile() });
        await page.evalFn(() => {
            window.__wires = [];
            document.addEventListener('navigate', (event) => window.__wires.push(
                event.detail ? JSON.parse(JSON.stringify(event.detail)) : null,
            ));
            return true;
        });
        return fn(page);
    });

    const navigations = (page) => page.evalFn(() => window.__wires.slice());

    test('a clean draft leaves without a question', () => staged(async (page) => {
        assert.deepEqual(await askEditor(page), { allow: true, reason: null });
        assert.equal(await dialogOpen(page), false, 'and nothing was asked of the person');
        assert.deepEqual(page.pageErrors, []);
    }));

    test('an unsaved draft refuses, says why, and offers the way out', () => staged(async (page) => {
        await editSomething(page);
        const answer = await askEditor(page);
        await page.settle(4);

        assert.equal(answer.allow, false, 'Back does not take the draft');
        assert.ok(answer.reason && answer.reason.length > 0,
            'and the router is handed a sentence rather than a silent refusal');
        assert.equal(await dialogOpen(page), true,
            'the same dialog Cancel raises — a refusal the person cannot see is a dead button');
        assert.deepEqual(await navigations(page), [], 'and nothing left');
        assert.deepEqual(page.pageErrors, []);
    }));

    test('Cancel and the router reach the ONE decision', () => staged(async (page) => {
        await editSomething(page);
        await page.click(EDITOR.cancel);
        await page.settle(6);

        assert.equal(await dialogOpen(page), true, 'Cancel asks the same question');
        assert.equal((await askEditor(page)).allow, false, 'and so does the router');

        await page.click('editor-screen >>> #discard-confirm');
        await page.settle(6);

        const left = await navigations(page);
        assert.equal(left.length, 1, 'answering it leaves');
        assert.equal(left[0].back, true);
        /* The leave a confirmed discard raises comes back as the router's own question,
         * and it must not be answered on the draft the person just discarded. */
        assert.deepEqual(await askEditor(page), { allow: true, reason: null },
            'the discard the person agreed to is not re-asked on the way out');
        assert.deepEqual(page.pageErrors, []);
    }));

    test('Keep editing leaves the refusal standing', () => staged(async (page) => {
        await editSomething(page);
        await page.click(EDITOR.cancel);
        await page.settle(6);
        await page.click('editor-screen >>> #discard-cancel');
        await page.settle(6);

        assert.equal(await dialogOpen(page), false, 'the dialog closed');
        assert.deepEqual(await navigations(page), [], 'and nothing left');
        assert.equal((await askEditor(page)).allow, false,
            'the draft is still unsaved, so the router is still told no');
        assert.deepEqual(page.pageErrors, []);
    }));
});
