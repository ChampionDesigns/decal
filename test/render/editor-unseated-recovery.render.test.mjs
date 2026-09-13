/**
 * The editor opened with nothing to edit.
 *
 * An editor with nothing seated offers no Save and says so, in a block with the one
 * action there is. A caller that mounted one of the four regions is showing something,
 * so the recovery block is not drawn over it and the band keeps its commit cluster.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';
import {
    EDITOR, EDITOR_MODULE, editorStage, mountEditor, seatProfile, editingProfile, textOf,
} from '../harness/editor.js';

const RECOVERY = 'editor-screen >>> #recovery';
const RECOVERY_STATE = 'editor-screen >>> #recovery-state';
const RECOVERY_OPEN = 'editor-screen >>> #recovery-open';

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`the unseated editor @ ${geometry.name}`, () => {

        const bare = (fn) => browser.withPage({ geometry }, async (page) => {
            await mountEditor(page, { matrix: null, fields: 0 });
            return fn(page);
        });

        test('no record seated: the band offers no Save and no Cancel',
            () => bare(async (page) => {
                assert.equal(await page.exists(EDITOR.save), false,
                    'a Save here could only write nothing, so it is not offered');
                assert.equal(await page.exists(EDITOR.cancel), false,
                    'and Cancel goes with it — the commit cluster is one control');
                assert.deepEqual(page.pageErrors, []);
            }));

        test('it says what happened, and offers the one move there is',
            () => bare(async (page) => {
                assert.equal(await page.exists(RECOVERY_STATE), true,
                    'the blank working area is replaced by a stated empty state');
                const heading = await textOf(page, `${RECOVERY_STATE} >>> #heading`);
                assert.ok(heading.length > 0, 'the empty state names the state it is in');
                assert.equal(await page.exists(RECOVERY_OPEN), true,
                    'and carries an action — an empty state with no way on is a dead end');
                const label = await textOf(page, RECOVERY_OPEN);
                assert.ok(label.length > 0, 'the action is named');
            }));

        test('the block fills row 2, where the body would have been',
            () => bare(async (page) => {
                const screen = await page.box(EDITOR.screen);
                const band = await page.box(EDITOR.band);
                const block = await page.box(RECOVERY);
                assert.ok(block.width > 0 && block.height > 0,
                    `the recovery block has a box (${block.width}x${block.height})`);
                assert.ok(Math.abs(block.width - screen.width) <= 1,
                    `it spans the screen (${block.width} against ${screen.width})`);
                assert.ok(block.y >= band.y + band.height - 1,
                    'and it starts below the band rather than over it');
            }));

        test('the action asks the shell to open the library, and nothing else',
            () => bare(async (page) => {
                await page.recordEvents(EDITOR.screen, ['library-open', 'navigate']);
                await page.click(RECOVERY_OPEN);
                await page.settle(6);
                const seen = await page.recordedEvents();
                assert.deepEqual(seen.map((e) => e.type), ['library-open'],
                    'one intent, on the name app-intents.js already maps to the selector');
                assert.deepEqual(page.pageErrors, []);
            }));

        test('seating a record puts the editor back and takes the block away',
            () => bare(async (page) => {
                await seatProfile(page, { profile: editingProfile() });
                assert.equal(await page.exists(RECOVERY_STATE), false,
                    'there is something to edit, so there is nothing to recover from');
                assert.equal(await page.exists(EDITOR.save), true,
                    'and Save is back, because a press would now write the draft');
                assert.deepEqual(page.pageErrors, []);
            }));

        test('a caller that mounted its own region keeps the band it always had',
            () => browser.withPage({ geometry }, async (page) => {
                await page.mount(editorStage(), EDITOR_MODULE);
                await page.settle(6);
                assert.equal(await page.exists(RECOVERY_STATE), false,
                    'a caller showing its own content is not an editor with nothing in it');
                assert.equal(await page.exists(EDITOR.save), true,
                    'so the commit cluster is exactly what it was');
                assert.deepEqual(page.pageErrors, []);
            }));
    });
}
