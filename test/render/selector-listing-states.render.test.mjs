/**
 * selector-listing-states.render.test.mjs — what the list pane says while it reads,
 * when it has nothing, and when the read failed.
 *
 * Also the Restore and Import-a-share-code dialogs: a heading that fits, and a
 * dismissal a person can see. Driven against the real store, transport and mock,
 * with the failures scripted at the fetch.
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
const LISTING_ROUTE = '/api/v1/profiles';

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

/** What the list region is saying, by the three ids only one of which may be present. */
const listRegion = (page) => page.evalFn((sel) => {
    const root = document.querySelector(sel).shadowRoot;
    const read = (id) => {
        const el = root.getElementById(id);
        return el ? (el.textContent ?? '').trim() : null;
    };
    return {
        failed: read('list-failed'),
        loading: read('list-loading'),
        empty: read('list-empty'),
        retry: root.getElementById('list-retry') !== null,
        rows: root.querySelectorAll('#rows [role="treeitem"]').length,
    };
}, S);

/** Every line the screen's toast is currently holding. */
const notices = (page) => page.evalFn((sel) => {
    const toast = document.querySelector(sel).shadowRoot.getElementById('notice');
    return toast ? toast.notices.map((n) => (n.textContent ?? '').trim()) : [];
}, S);

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

describe('profile selector — a listing that fails is not a library that is empty', () => {
    let mock;
    let page;

    before(async () => {
        mock = await startMock();
        page = await browser.newPage({ geometry });
        await page.mount(STAGE, MODULES);
        await page.evalFn((route) => window.__sel.answer(
            'GET', route, 503, { error: 'Service Unavailable' },
        ), LISTING_ROUTE);
        await page.evalFn((port) => window.__sel.mount({ port }), mock.port);
        await page.settle(4);
        assert.deepEqual(page.pageErrors, [], 'the screen must mount without throwing');
    });

    after(async () => {
        await page?.close?.();
        mock?.stop();
    });

    test('a 503 listing reports a FAILURE with a retry, and never claims the library is empty',
        async () => {
            const state = await page.evalFn(() => window.__sel.state());
            assert.equal(state.status, 'failed',
                'the store did not reach its failure branch — the 503 was not scripted at the fetch');

            const region = await listRegion(page);
            assert.equal(region.rows, 0, 'a failed first listing has no rows to show');
            assert.equal(region.empty, null,
                'a failed listing rendered the EMPTY sentence: "no profiles" and "the profiles '
                + 'could not be read" are different facts about the machine');
            assert.ok(region.failed && region.failed.length > 0,
                'a failed listing said nothing at all');
            assert.equal(region.retry, true,
                'the one state with something to do about it has no control to do it with');
        });

    test('Retry re-reads the listing, and the rows come back',
        async () => {
            assert.equal((await listRegion(page)).retry, true, 'this test follows the failure');
            await page.evalFn((route) => window.__sel.forget('GET', route), LISTING_ROUTE);
            await page.click(`${S} >>> #list-retry`);
            await page.evalFn(() => window.__sel.settled());
            await page.settle(4);

            const state = await page.evalFn(() => window.__sel.state());
            assert.equal(state.status, 'ready', 'Retry did not re-read the listing');
            const region = await listRegion(page);
            assert.ok(region.rows > 0, 'the rows did not come back after a successful retry');
            assert.equal(region.failed, null, 'the failure survived a successful read');
            assert.equal(region.retry, false,
                'the retry control outlived the failure it belonged to');
        });
});

describe('profile selector — a reset that failed says so', () => {
    let mock;
    let page;

    before(async () => {
        mock = await startMock();
        page = await browser.newPage({ geometry });
        await page.mount(STAGE, MODULES);
        await page.evalFn((port) => window.__sel.mount({ port }), mock.port);
        await page.evalFn(() => window.__sel.settled());
        assert.deepEqual(page.pageErrors, [], 'the screen must mount without throwing');
    });

    after(async () => {
        await page?.close?.();
        mock?.stop();
    });

    test('a successful listing with rows says nothing about its own state', async () => {
        const region = await listRegion(page);
        assert.ok(region.rows > 0, 'the mock serves a listing — this suite needs it');
        assert.equal(region.failed, null);
        assert.equal(region.empty, null);
    });

    test('a re-read under a drawn list says nothing', async () => {
        const seen = await page.evalFn(() => window.__sel.duringReload());
        assert.equal(seen.status, 'loading', 'the sample missed the in-flight window');
        assert.ok(seen.rows > 0, 'the rows must still be drawn during a re-read');
        assert.equal(seen.loading, false,
            'a re-read painted a state line over a list that was already answering');
        assert.equal(seen.empty, false);
        assert.equal(seen.failed, false);
    });

    test('a failed reset says so, and the profile it could not reset is still there',
        async () => {
            const before = await page.evalFn(() => window.__sel.state());
            const opened = await page.evalFn(() => window.__sel.openRestore());
            assert.equal(opened.present, true, 'the restore surface must be reachable');
            assert.ok(opened.offers > 0, 'there must be something to reset');

            const target = await page.evalFn(() => {
                const dialog = document.querySelector('selector-screen').shadowRoot
                    .getElementById('restore');
                const button = dialog.querySelector('.dialog-list ui-button');
                return { filename: button.dataset.filename };
            });
            await page.evalFn((filename) => window.__sel.answer(
                'POST', `/api/v1/profiles/restore/${encodeURIComponent(filename)}`,
                503, { error: 'Service Unavailable' },
            ), target.filename);

            const after = await page.evalFn(() => window.__sel.restoreFirst());
            await page.settle(4);

            assert.equal(after.restore.status, 'failed',
                'the store did not reach its own failure branch');
            assert.equal(after.restorable, before.restorable,
                'a failed reset must leave the record exactly where it was');

            const lines = await notices(page);
            assert.ok(lines.length > 0,
                'a failed reset must say so on the surface that failed');
            assert.ok(lines.some((line) => line.length > 0),
                'the notice is empty, which is the same silence with a box around it');
        });

    test('the Restore heading fits, and its way out is visible', async () => {
        await page.evalFn((route) => window.__sel.forget('GET', route), LISTING_ROUTE);
        await page.evalFn(() => window.__sel.reload());
        const opened = await page.evalFn(() => window.__sel.openRestore());
        assert.equal(opened.present, true, 'the restore surface must be reachable');

        const seen = await page.evalFn(() => {
            const dialog = document.querySelector('selector-screen').shadowRoot
                .getElementById('restore');
            const heading = dialog.shadowRoot.querySelector('ui-sheet-header')
                ?.shadowRoot?.querySelector('h1, h2, h3, h4, h5, h6');
            const close = dialog.querySelector('#restore-close');
            const lead = dialog.querySelector('.dialog-lead');
            return {
                text: heading?.textContent?.trim(),

                clipped: heading ? heading.scrollWidth > heading.clientWidth + 1 : null,
                trail: [...dialog.children].filter((c) => c.slot === 'header-trail').length,
                leadInBody: Boolean(lead) && lead.closest('[slot="body"]') !== null,
                closeLabel: close?.textContent?.trim() ?? null,
                closeVisible: close ? close.getClientRects().length > 0 : false,
            };
        });
        assert.equal(seen.text, 'Restore bundled profiles');
        assert.equal(seen.clipped, false,
            'the heading is truncated — the header is carrying prose again');
        assert.equal(seen.trail, 0, 'header-trail takes a cluster, never a paragraph');
        assert.equal(seen.leadInBody, true, 'the sentence belongs with the list it describes');
        assert.equal(seen.closeLabel, 'Close',
            'Close, not Cancel: a restore happens on the row press, so there is nothing to discard');
        assert.equal(seen.closeVisible, true);

        const shut = await page.evalFn(async () => {
            const dialog = document.querySelector('selector-screen').shadowRoot
                .getElementById('restore');
            dialog.querySelector('#restore-close').shadowRoot.querySelector('button').click();
            await dialog.updateComplete;
            return dialog.open;
        });
        assert.equal(shut, false, 'and pressing it closes the dialog');
    });

    test('Import a share code has a visible Cancel beside its Import', async () => {
        const seen = await page.evalFn(async () => {
            const screen = document.querySelector('selector-screen');
            const dialog = screen.shadowRoot.getElementById('share-code');
            dialog.show({ reason: 'test' });
            await dialog.updateComplete;
            await screen.updateComplete;
            const actions = [...dialog.children]
                .filter((c) => c.slot === 'actions')
                .map((c) => c.textContent.trim());
            const body = dialog.querySelector('[slot="body"]');
            return {
                actions,

                importInBody: Boolean(body?.querySelector('#share-import')),
                visible: [...dialog.children].filter((c) => c.slot === 'actions')
                    .every((c) => c.getClientRects().length > 0),
            };
        });
        assert.deepEqual(seen.actions, ['Cancel', 'Import'],
            'the dismissal and the affirmative, in the dialog footer, in that order');
        assert.equal(seen.importInBody, false);
        assert.equal(seen.visible, true);

        const shut = await page.evalFn(async () => {
            const screen = document.querySelector('selector-screen');
            const dialog = screen.shadowRoot.getElementById('share-code');
            dialog.querySelector('#share-cancel').shadowRoot.querySelector('button').click();
            await dialog.updateComplete;
            return dialog.open;
        });
        assert.equal(shut, false, 'Cancel closes it');
    });
});
