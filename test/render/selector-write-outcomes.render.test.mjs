/**
 * selector-write-outcomes.render.test.mjs — the screen acts on how a write ended.
 *
 * `profile-library-store` answers a typed outcome from every write this screen makes:
 * `ASSIGN_RESULT` from `setFavourite`, `MANAGE_RESULT` from `hide` and `purge`. Driven
 * through the shipping shell, the real transport, store and mock, with the failures
 * scripted at the fetch so every layer reaches its own failure branch.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';

const REPO = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const MODULES = ['/test/fixtures/selector-loop-fixture.js'];
const STAGE = '<div id="stage" style="inline-size: 100%; block-size: 100dvh"></div>';
const geometry = GATE_A_GEOMETRIES[0];

const S = 'selector-screen';
const ARM_ROUTE = '/api/v1/machine/profile';

function freePort() {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.on('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const { port } = server.address();
            server.close(() => resolve(port));
        });
    });
}

async function startMock() {
    const port = await freePort();
    const child = spawn('python3', ['tools/mock_rea.py', '--port', String(port)],
        { cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (b) => { stderr += b; });
    child.stdout.resume();
    const deadline = Date.now() + 20000;
    for (;;) {
        if (child.exitCode !== null) throw new Error(`mock exited ${child.exitCode}: ${stderr}`);
        try {
            const res = await fetch(`http://127.0.0.1:${port}/api/v1/info`);
            if (res.ok) { await res.arrayBuffer(); break; }
        } catch { /* not up yet */ }
        if (Date.now() > deadline) throw new Error(`mock never came up: ${stderr}`);
        await new Promise((r) => setTimeout(r, 60));
    }
    return { port, stop: () => child.kill('SIGKILL') };
}

/** Visible write feedback: a replacement keeps its error beside the named profiles. */
const notices = (page) => page.evalFn((sel) => {
    const root = document.querySelector(sel).shadowRoot;
    const toast = root.getElementById('notice');
    const lines = toast ? toast.notices.map((n) => (n.textContent ?? '').trim()) : [];
    const replacement = root.getElementById('replacement-error');
    if (replacement) lines.push((replacement.textContent ?? '').trim());
    return lines;
}, S);

/** The lines that appeared since a snapshot — a toast holds more than one at a time. */
const added = (before_, after_) => after_.filter((line) => !before_.includes(line));

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

describe('profile selector — a favourite that did not persist is not announced as saved', () => {
    let mock;
    let page;
    let paths;
    let seated;
    let other;

    before(async () => {
        mock = await startMock();
        page = await browser.newPage({ geometry });
        await page.mount(STAGE, MODULES);
        paths = await page.evalFn(() => window.__sel.favouritePaths());

        await page.evalFn((p) => window.__sel.answer('GET', p.seeded, 200, true), paths);
        await page.evalFn((port) => window.__sel.mount({ port, kv: 'rea' }), mock.port);
        await page.evalFn(() => window.__sel.settled());
        await page.settle(4);
        assert.deepEqual(page.pageErrors, [], 'the screen must mount without throwing');
    });

    after(async () => {
        await page?.close?.();
        mock?.stop();
    });

    test('the rail takes an assignment while the write goes through', async () => {
        const listable = await page.evalFn(() => window.__sel.rawListable());
        assert.ok(listable.length > 1, 'this suite needs two profiles to tell apart');
        [seated, other] = listable;

        await page.evalFn((id) => window.__sel.select(id), seated.id);
        const rail = await page.evalFn(() => window.__sel.pickFavourite(0));
        assert.equal(rail[0], seated.id, 'the control case must work, or nothing below means anything');
    });

    test('a 503 on the write leaves the old favourite, says so, and does not arm',
        async () => {
            assert.ok(seated && other, 'this test follows the one above');
            const armedBefore = await page.evalFn((r) => window.__sel.countCalls('POST', r), ARM_ROUTE);
            const linesBefore = await notices(page);

            await page.evalFn((p) => window.__sel.answer(
                'POST', p.assignments, 503, { error: 'Service Unavailable' },
            ), paths);
            await page.evalFn((id) => window.__sel.select(id), other.id);
            const rail = await page.evalFn(() => window.__sel.pickFavourite(0));
            await page.settle(4);

            assert.equal(rail[0], seated.id,
                'a rail write that failed changed the slot anyway — the old favourite is gone');

            const lines = added(linesBefore, await notices(page));
            assert.ok(lines.length > 0,
                'a favourite that did not persist said nothing at all');
            assert.ok(!lines.some((line) => other.title && line.includes(other.title)),
                'the screen announced the assignment it had just been told did not happen');

            const armedAfter = await page.evalFn((r) => window.__sel.countCalls('POST', r), ARM_ROUTE);
            assert.equal(armedAfter, armedBefore,
                'the machine was armed on an assignment that was never persisted');
        });
});

describe('profile selector — a hide or a delete the server refused is explained', () => {
    let mock;
    let page;

    /** Select the first listable row and answer what the suite needs to know about it. */
    const pickRow = () => page.evalFn(async () => {
        const [first] = window.__sel.rawListable();
        await window.__sel.select(first.id);
        return first;
    });

    /** Press one of the detail pane's destructive buttons and confirm the question. */
    const confirmAction = async (button, dialog) => {
        await page.click(`${S} >>> #manage-open`);
        const action = button === 'act-hide' ? 'hide' : 'remove';
        const index = await page.evalFn((action) => document.querySelector('selector-screen')
            .shadowRoot.getElementById('manage').items.findIndex((item) => item.id === action), action);
        await page.click(`${S} >>> #manage >>> button[data-index="${index}"]`);
        await page.settle(2);
        await page.click(`${S} >>> #${dialog} >>> #confirm >>> .btn`);
        await page.settle(4);

        await new Promise((r) => setTimeout(r, 250));
        await page.settle(2);
    };

    before(async () => {
        mock = await startMock();
        page = await browser.newPage({ geometry });
        await page.mount(STAGE, MODULES);
        await page.evalFn((port) => window.__sel.mount({ port }), mock.port);
        await page.evalFn(() => window.__sel.settled());
        await page.settle(4);
        assert.deepEqual(page.pageErrors, [], 'the screen must mount without throwing');
    });

    after(async () => {
        await page?.close?.();
        mock?.stop();
    });

    test('a 503 on Hide is said out loud, and the selection is still there to retry with',
        async () => {
            const row = await pickRow();
            const linesBefore = await notices(page);
            await page.evalFn((id) => window.__sel.answer(
                'DELETE', `/api/v1/profiles/${encodeURIComponent(id)}`,
                503, { error: 'Service Unavailable' },
            ), row.id);

            const before = await page.evalFn(() => window.__sel.state());
            await confirmAction('act-hide', 'confirm-hide');

            const attempts = await page.evalFn((id) => window.__sel.countCalls(
                'DELETE', `/api/v1/profiles/${encodeURIComponent(id)}`,
            ), row.id);
            assert.equal(attempts, 1, 'the confirm never reached the route — this suite proves nothing');

            const state = await page.evalFn(() => window.__sel.state());
            assert.equal(state.listable, before.listable, 'a failed hide removed the row anyway');
            assert.equal(state.reads.listing, before.reads.listing,
                'a hide that failed re-read the listing, which is the answer only a hide that WORKED has');
            assert.equal(state.selectedId, row.id,
                'the selection was dropped, so the gesture cannot be retried without finding the row again');

            const lines = added(linesBefore, await notices(page));
            assert.ok(lines.length > 0,
                'a hide the server refused must be said out loud');
        });

    test('and the same press works once the server answers again', async () => {
        const state = await page.evalFn(() => window.__sel.state());
        const id = state.selectedId;
        assert.ok(id, 'this test follows the one above and needs its selection');
        const linesBefore = await notices(page);

        await page.evalFn((rowId) => window.__sel.answer(
            'DELETE', `/api/v1/profiles/${encodeURIComponent(rowId)}`, 200, {},
        ), id);

        await confirmAction('act-hide', 'confirm-hide');
        const attempts = await page.evalFn((rowId) => window.__sel.countCalls(
            'DELETE', `/api/v1/profiles/${encodeURIComponent(rowId)}`,
        ), id);
        assert.equal(attempts, 2, 'the kept selection did not make the gesture retryable');
        const after = await page.evalFn(() => window.__sel.state());
        assert.equal(after.reads.listing, state.reads.listing + 1,
            'the retry did not reach the store\'s success path');
        assert.deepEqual(added(linesBefore, await notices(page)), [],
            'a hide that worked reported a failure anyway');
    });

    test('a 503 on Delete is said out loud, and the record is still on the list',
        async () => {
            const row = await pickRow();
            const linesBefore = await notices(page);
            await page.evalFn((id) => window.__sel.answer(
                'DELETE', `/api/v1/profiles/${encodeURIComponent(id)}/purge`,
                503, { error: 'Service Unavailable' },
            ), row.id);

            const before = await page.evalFn(() => window.__sel.state());
            await confirmAction('act-delete', 'confirm-remove');

            const attempts = await page.evalFn((id) => window.__sel.countCallsEndingIn(
                'DELETE', `/${encodeURIComponent(id)}/purge`,
            ), row.id);
            assert.equal(attempts, 1, 'the confirm never reached the route — this test proves nothing');

            const state = await page.evalFn(() => window.__sel.state());
            assert.equal(state.listable, before.listable, 'a failed delete dropped the row anyway');
            assert.equal(state.reads.listing, before.reads.listing,
                'a delete that failed re-read the listing, which only a delete that WORKED does');
            assert.equal(state.selectedId, row.id, 'the selection went with a delete that never happened');

            const lines = added(linesBefore, await notices(page));
            assert.ok(lines.length > 0,
                'the one irreversible control on the screen failed silently');
        });
});
