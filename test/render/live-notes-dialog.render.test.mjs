/**
 * The shot-notes sheet: its dismissal policy, what a write that did not land leaves
 * behind, and a route change asking the same question. The only double is the write —
 * `notes-change` is answered by a listener of this test's own.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, BENCH } from '../harness/index.js';

const MODULE = ['/src/screens/live-screen.js'];
const STAGE = '<div id="stage" style="inline-size: 100%; block-size: 100dvh"><live-screen></live-screen></div>';

const SHEET = 'live-screen >>> #notes-sheet >>> dialog';
const EDITOR = 'live-screen >>> #notes-editor';
const REFUSAL = 'live-screen >>> #notes-refusal';

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

/**
 * Mount the screen, open the notes sheet on a shot, and install the write double.
 * `answer` decides what the write does, or is null for a screen with no wiring above it.
 */
const staged = (fn) => browser.withPage({ geometry: BENCH }, async (page) => {
    await page.mount(STAGE, MODULE);
    await page.evalFn(() => {
        const screen = window.__h.q('live-screen');
        const api = {
            screen,
            sent: [],
            answer: null,
            /** The stored record the sheet names, in the shape the band reads. */
            shot: (id) => ({
                id,
                timestamp: '2026-09-09T08:00:00.000',
                annotations: { espressoNotes: '' },
                workflow: { profile: { title: 'Notes fixture' } },
            }),
            async open(id) {
                screen.storedShot = api.shot(id);
                screen._notes = true;
                await screen.updateComplete;
                const editor = screen.renderRoot.getElementById('notes-editor');
                await editor.ready;
                await screen.updateComplete;
                return true;
            },
            /** Move the band to another shot, as the socket does while the sheet is open. */
            async band(id) {
                screen.storedShot = api.shot(id);
                await screen.updateComplete;
                return true;
            },
            async type(text) {
                const editor = screen.renderRoot.getElementById('notes-editor');
                editor.editor.codemirror.focus();
                editor.editor.codemirror.replaceSelection(text);
                await screen.updateComplete;
                return true;
            },
            /** What the person can see and act on, in one object. */
            state() {
                const editor = screen.renderRoot.getElementById('notes-editor');
                const save = screen.renderRoot.getElementById('notes-save');
                const refusal = screen.renderRoot.getElementById('notes-refusal');
                const guard = editor ? editor.renderRoot.getElementById('refusal') : null;
                return {
                    open: !!screen.renderRoot.getElementById('notes-sheet'),
                    text: editor ? editor.text : null,
                    dirty: editor ? editor.dirty : null,
                    saveDisabled: save ? save.disabled : null,
                    refusal: refusal ? refusal.textContent.trim() : '',
                    guardSaid: guard ? guard.textContent.trim() : '',
                };
            },
        };
        screen.addEventListener('notes-change', (event) => {
            const detail = event.detail;
            api.sent.push({ shotId: detail.shotId, text: detail.text });
            if (api.answer) detail.respond(api.answer(detail));
        });
        window.__notes = api;
        return true;
    });
    assert.deepEqual(page.pageErrors, [], 'the screen must mount without throwing');
    await fn(page);
    assert.deepEqual(page.pageErrors, [], 'and must run without throwing');
});

/** Press a control in the screen's own shadow root and let the frame settle. */
const press = async (page, id) => {
    await page.evalFn((which) => {
        window.__notes.screen.renderRoot.getElementById(which).click();
        return true;
    }, id);
    await page.settle(2);
};

describe('the shot notes sheet @ bench', () => {

    test('Close keeps a note that has unsaved text, and says why', () => staged(async (page) => {
        await page.evalFn(async () => {
            await window.__notes.open('shot-a');
            await window.__notes.type('a draft the Close button must not throw away');
            return true;
        });
        await page.settle(2);

        await press(page, 'notes-close');

        const after = await page.evalFn(() => window.__notes.state());
        assert.equal(after.open, true, 'Close must not remove a sheet holding unsaved text');
        assert.equal(after.text, 'a draft the Close button must not throw away',
            'and the draft is exactly as it was typed');
        assert.ok(after.guardSaid.length > 0,
            `the refusal must be on the glass — saw ${JSON.stringify(after.guardSaid)}`);
    }));

    test('Escape keeps the same note, and Close now agrees with it', () => staged(async (page) => {
        await page.evalFn(async () => {
            await window.__notes.open('shot-a');
            await window.__notes.type('unsaved');
            return true;
        });
        await page.settle(2);

        const escaped = await page.evalFn(async () => {
            window.__notes.screen.renderRoot.getElementById('notes-sheet').requestClose('escape');
            await window.__notes.screen.updateComplete;
            return window.__notes.state();
        });
        assert.equal(escaped.open, true, 'Escape keeps the sheet');
        assert.ok(escaped.guardSaid.length > 0, 'and says why');

        await press(page, 'notes-close');
        const closed = await page.evalFn(() => window.__notes.state());
        assert.equal(closed.open, true, 'Close keeps it too, on the same text');
        assert.equal(closed.text, 'unsaved');
    }));

    test('Close closes a note nobody has typed into', () => staged(async (page) => {
        await page.evalFn(() => window.__notes.open('shot-a'));
        await page.settle(2);

        await press(page, 'notes-close');

        const after = await page.evalFn(() => window.__notes.state());
        assert.equal(after.open, false, 'a guard that refuses a clean note is a wall, not a guard');
    }));

    test('a refused save keeps the sheet, the exact text, and offers the retry', () => staged(async (page) => {
        const seen = await page.evalFn(async () => {
            await window.__notes.open('shot-a');
            await window.__notes.type('review draft must survive a refused save');
            window.__notes.answer = () => Promise.resolve({ ok: false, id: 'shot-a' });
            window.__notes.screen.renderRoot.getElementById('notes-save').click();
            await new Promise((r) => setTimeout(r, 0));
            await window.__notes.screen.updateComplete;
            return { state: window.__notes.state(), sent: window.__notes.sent };
        });
        await page.settle(2);
        const after = await page.evalFn(() => window.__notes.state());

        assert.deepEqual(seen.sent, [{ shotId: 'shot-a', text: 'review draft must survive a refused save' }],
            'the write was attempted, once');
        assert.equal(after.open, true, 'a rejected write must not take the sheet down');
        assert.equal(after.text, 'review draft must survive a refused save',
            'and the draft is preserved byte for byte');
        assert.ok(after.refusal.length > 0,
            `a refused write must say so beside the note — saw ${JSON.stringify(after.refusal)}`);
        assert.equal(after.saveDisabled, false, 'and the same button is the retry');
    }));

    test('a save that never answers is refused the same way', () => staged(async (page) => {
        await page.evalFn(async () => {
            await window.__notes.open('shot-a');
            await window.__notes.type('a draft that outlives a timeout');
            window.__notes.answer = () => Promise.reject(new Error('timed out'));
            window.__notes.screen.renderRoot.getElementById('notes-save').click();
            await new Promise((r) => setTimeout(r, 0));
            await window.__notes.screen.updateComplete;
            return true;
        });
        await page.settle(2);

        const after = await page.evalFn(() => window.__notes.state());
        assert.equal(after.open, true);
        assert.equal(after.text, 'a draft that outlives a timeout');
        assert.ok(after.refusal.length > 0);
        assert.equal(after.saveDisabled, false);
    }));

    test('the retry after a refusal succeeds once and closes', () => staged(async (page) => {
        const result = await page.evalFn(async () => {
            await window.__notes.open('shot-a');
            await window.__notes.type('the second press is the one that lands');
            window.__notes.answer = () => Promise.resolve({ ok: false });
            window.__notes.screen.renderRoot.getElementById('notes-save').click();
            await new Promise((r) => setTimeout(r, 0));
            await window.__notes.screen.updateComplete;

            window.__notes.answer = (detail) => Promise.resolve({ ok: true, notes: detail.text });
            window.__notes.screen.renderRoot.getElementById('notes-save').click();
            await new Promise((r) => setTimeout(r, 0));
            await window.__notes.screen.updateComplete;
            return { state: window.__notes.state(), sent: window.__notes.sent };
        });
        await page.settle(2);

        assert.equal(result.sent.length, 2, 'two presses, two writes — not one and not three');
        assert.equal(result.sent[1].text, 'the second press is the one that lands');
        assert.equal(result.state.open, false, 'an accepted write closes the sheet');
    }));

    test('a reply for one shot cannot close another shot\'s notes', () => staged(async (page) => {
        /* The write is a REST round trip and the band moves on its own, so a reply can
         * arrive after the sheet has become about a different shot. */
        const result = await page.evalFn(async () => {
            await window.__notes.open('shot-a');
            await window.__notes.type('shot A note');

            let land;
            window.__notes.answer = () => new Promise((resolve) => { land = resolve; });
            window.__notes.screen.renderRoot.getElementById('notes-save').click();
            await new Promise((r) => setTimeout(r, 0));

            /* The band moves while the write is out, and the sheet is now about B. */
            await window.__notes.band('shot-b');

            land({ ok: true });
            await new Promise((r) => setTimeout(r, 0));
            await window.__notes.screen.updateComplete;
            return window.__notes.state();
        });
        await page.settle(2);
        const after = await page.evalFn(() => window.__notes.state());

        assert.equal(result.open, true, 'the late reply must not dismiss the sheet it found');
        assert.equal(after.open, true);
        assert.equal(after.text, 'shot A note',
            'and the text in front of the person is untouched');
        assert.equal(after.dirty, true, 'nothing was marked saved on the shot it is not about');
    }));

    test('text typed while a save is out is not marked saved by it', () => staged(async (page) => {
        /* The baseline a save moves is the text it sent, not the live text. */
        const result = await page.evalFn(async () => {
            await window.__notes.open('shot-a');
            await window.__notes.type('sent');

            let land;
            window.__notes.answer = () => new Promise((resolve) => { land = resolve; });
            window.__notes.screen.renderRoot.getElementById('notes-save').click();
            await new Promise((r) => setTimeout(r, 0));

            const editor = window.__notes.screen.renderRoot.getElementById('notes-editor');
            editor.editor.codemirror.focus();
            editor.editor.codemirror.replaceSelection(' and typed after');
            await window.__notes.screen.updateComplete;

            land({ ok: true });
            await new Promise((r) => setTimeout(r, 0));
            await window.__notes.screen.updateComplete;
            return window.__notes.state();
        });
        await page.settle(2);

        assert.equal(result.open, true, 'the sheet stays open over text that was never sent');
        assert.equal(result.text, 'sent and typed after');
        assert.equal(result.dirty, true, 'the newer keystrokes are still unsaved, and say so');
        assert.equal(result.saveDisabled, false, 'so they can be saved');
    }));

    test('a screen with nothing listening still closes on Save', () => staged(async (page) => {
        const result = await page.evalFn(async () => {
            await window.__notes.open('shot-a');
            await window.__notes.type('unheard');
            window.__notes.answer = null;
            window.__notes.screen.renderRoot.getElementById('notes-save').click();
            await new Promise((r) => setTimeout(r, 0));
            await window.__notes.screen.updateComplete;
            return window.__notes.state();
        });
        await page.settle(2);
        assert.equal(result.open, false);
    }));

    test('leaving the route is refused while the note is dirty and allowed when it is not',
        () => staged(async (page) => {
            const answers = await page.evalFn(async () => {
                const screen = window.__notes.screen;
                const clean = screen.canLeaveRoute({ from: 'live', to: 'settings', kind: 'history' });

                await window.__notes.open('shot-a');
                await window.__notes.type('unsaved when Back is pressed');
                const dirty = screen.canLeaveRoute({ from: 'live', to: 'settings', kind: 'history' });
                const stillOpen = window.__notes.state();

                window.__notes.answer = (detail) => ({ ok: true, notes: detail.text });
                screen.renderRoot.getElementById('notes-save').click();
                await new Promise((r) => setTimeout(r, 0));
                await screen.updateComplete;
                const saved = screen.canLeaveRoute({ from: 'live', to: 'settings', kind: 'history' });

                return { clean, dirty, stillOpen, saved };
            });
            await page.settle(2);

            assert.equal(answers.clean, true, 'a screen with no sheet open never objects');
            assert.equal(answers.dirty.allow, false, 'Back must not take an unsaved note with it');
            assert.ok(typeof answers.dirty.reason === 'string' && answers.dirty.reason.length > 0,
                'and the refusal must carry words, not a silent false');
            assert.equal(answers.stillOpen.open, true, 'the sheet is still there to save from');
            assert.equal(answers.saved, true, 'and once it is saved the same press goes through');
        }));

    test('the sheet, the editor and the refusal line are all drawn', () => staged(async (page) => {
        /* A guard nobody can see is indistinguishable from a control that is broken. */
        await page.evalFn(async () => {
            await window.__notes.open('shot-a');
            await window.__notes.type('drawn');
            window.__notes.answer = () => Promise.resolve({ ok: false });
            window.__notes.screen.renderRoot.getElementById('notes-save').click();
            await new Promise((r) => setTimeout(r, 0));
            await window.__notes.screen.updateComplete;
            return true;
        });
        await page.settle(2);

        const sheet = await page.box(SHEET);
        const editor = await page.box(EDITOR);
        const refusal = await page.box(REFUSAL);
        assert.ok(sheet.width > 0 && sheet.height > 0, 'the sheet is on screen');
        assert.ok(editor.width > 0 && editor.height > 0, 'with the editor in it');
        assert.ok(refusal.width > 0 && refusal.height > 0,
            `and the refusal is drawn — saw ${JSON.stringify(refusal)}`);
    }));
});
