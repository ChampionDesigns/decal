/**
 * The shot-notes write over the `notes-change` listener a booted app actually has,
 * which is `LiveWiring`'s. Only what the server answers is the test's to choose.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, BENCH } from '../harness/index.js';

const MODULES = ['/test/fixtures/live-saved-shot-fixture.js'];
const STAGE = '<div id="stage" style="inline-size: 100%; block-size: 100dvh"></div>';

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

/** Boot the shell, pull a shot and let its record land, so there is a shot to annotate. */
const staged = (fn) => browser.withPage({ geometry: BENCH }, async (page) => {
    await page.mount(STAGE, MODULES);
    await page.evalFn(() => window.__savedShot.reset());
    await page.evalFn(() => window.__savedShot.mount({ instantRetry: true }));
    assert.deepEqual(page.pageErrors, [], 'the shell boots without throwing');
    await page.evalFn(async () => {
        await window.__savedShot.pullShot({ id: 'shot-noted', title: 'Noted', landAfter: 1 });
        await window.__savedShot.letItLand(2);
        return true;
    });
    await fn(page);
});

describe('the shot-notes write, over the wiring a booted app has @ bench', () => {
    test('a note the machine REFUSED keeps the sheet, the draft and a sentence',
        () => staged(async (page) => {
            const written = await page.evalFn(async () => {
                window.__savedShot.refuseWrites(true);
                return window.__savedShot.note('a note the machine is going to refuse');
            });
            await page.settle(4);
            const sheet = await page.evalFn(() => window.__savedShot.notesSheet());

            assert.equal(written.writes.length, 1, 'the wiring did attempt the write');
            assert.equal(sheet.open, true,
                'the sheet is still open — a refused write must not dismiss it');
            assert.match(sheet.text, /refuse/, 'and the draft is still in the editor');
            assert.equal(sheet.dirty, true,
                'still unsaved: the baseline must not move over text the server never took');
            assert.notEqual(sheet.refusal, '',
                'and the screen says, in words, that the write did not land');
            assert.deepEqual(page.pageErrors, [],
                'the refusal reaches the person as a sentence, not as an unhandled rejection');
        }));

    test('pressing Save again is the whole of the retry', () => staged(async (page) => {
        await page.evalFn(async () => {
            window.__savedShot.refuseWrites(true);
            return window.__savedShot.note('a note that gets through on the second press');
        });
        await page.settle(4);

        const again = await page.evalFn(async () => {
            window.__savedShot.refuseWrites(false);
            return window.__savedShot.saveNote();
        });
        await page.settle(4);
        const sheet = await page.evalFn(() => window.__savedShot.notesSheet());

        assert.equal(again.length, 2, 'the second press sent the note again');
        assert.equal(again[1].notes, 'a note that gets through on the second press',
            'carrying the text that was kept');
        assert.equal(sheet.open, false, 'and this one landed, so the sheet closed');
        assert.deepEqual(page.pageErrors, []);
    }));

    test('a note the machine TOOK closes the sheet, exactly as before', () => staged(async (page) => {
        const written = await page.evalFn(() => window.__savedShot.note('grassy — grind finer'));
        await page.settle(4);
        const sheet = await page.evalFn(() => window.__savedShot.notesSheet());

        assert.equal(written.writes.length, 1, 'the write was sent');
        assert.equal(written.writes[0].notes, 'grassy — grind finer', 'carrying the text');
        assert.equal(sheet.open, false, 'and the sheet closed on the accepted write');
        assert.deepEqual(page.pageErrors, []);
    }));
});
