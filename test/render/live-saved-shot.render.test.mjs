/**
 * Which shot the Live screen is talking about after a pull, in a real engine: the band's
 * identity, the rating, the note, and the title the expanded chart carries.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, BENCH } from '../harness/index.js';

const MODULES = ['/test/fixtures/live-saved-shot-fixture.js'];
const STAGE = '<div id="stage" style="inline-size: 100%; block-size: 100dvh"></div>';

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

/** Mount the stage on a fresh page, with the archive the test asked for. */
const staged = (fn, { empty = false, instantRetry = false } = {}) => browser.withPage({ geometry: BENCH }, async (page) => {
    await page.mount(STAGE, MODULES);
    await page.settle(6);
    const mounted = await page.evalFn(async (options) => {
        const api = window.__savedShot;
        api.reset();
        if (options.empty) api.emptyHistory();
        return api.mount({ instantRetry: options.instantRetry });
    }, { empty, instantRetry });
    assert.deepEqual(page.pageErrors, [], 'the screen must mount without throwing');
    await fn(page, mounted);
    assert.deepEqual(page.pageErrors, [], 'and must run without throwing');
});

describe('Live after a shot @ bench', () => {

    test('a completed shot becomes the record the band names', async () => {
        await staged(async (page, mounted) => {
            assert.equal(mounted.shotId, 'shot-old', 'the boot opened on the newest STORED shot');

            const after = await page.evalFn(async () => {
                await window.__savedShot.pullShot({ id: 'shot-new', title: 'Extractamundo Dos!' });
                return { band: window.__savedShot.band(), held: window.__savedShot.heldIds() };
            });

            assert.equal(after.band.shotId, 'shot-new',
                'the band is about the shot that was just pulled, not the one before it');
            assert.equal(after.band.saving, false, 'and it is no longer waiting for it');
            assert.deepEqual(after.held.slice(0, 2), ['shot-new', 'shot-old'],
                'the list was re-read and carries the new shot at its head');
        });
    });

    test('the rating lands on the new shot and never on the previous one', async () => {
        await staged(async (page) => {
            const written = await page.evalFn(async () => {
                await window.__savedShot.pullShot({ id: 'shot-new' });
                const before = window.__savedShot.band();
                const writes = await window.__savedShot.rate(100);
                return { before, writes, band: window.__savedShot.band() };
            });

            assert.equal(written.before.shotId, 'shot-new');
            assert.equal(written.writes.length, 1, 'one press, one write');
            assert.equal(written.writes[0].id, 'shot-new',
                'the enjoyment was written onto the shot that was just pulled');
            assert.equal(written.writes[0].enjoyment, 100);
            assert.equal(written.band.rating, 100, 'and the band reads it back off the list row');
        });
    });

    test('a note lands on the new shot and never on the previous one', async () => {
        await staged(async (page) => {
            const written = await page.evalFn(async () => {
                await window.__savedShot.pullShot({ id: 'shot-new', title: 'Gentle and sweet' });
                return window.__savedShot.note('grassy — grind finer');
            });

            assert.equal(written.identity, 'Gentle and sweet',
                'the sheet says it is about the shot that was just pulled');
            assert.equal(written.writes.length, 1, 'one save, one write');
            assert.equal(written.writes[0].id, 'shot-new',
                'and the note was written onto that shot');
            assert.equal(written.writes[0].notes, 'grassy — grind finer');
        });
    });

    test('the first shot on a machine with no history at all is a record too', async () => {
        await staged(async (page, mounted) => {
            assert.equal(mounted.rows, 0, 'nothing has ever been pulled on this machine');
            assert.equal(mounted.shotId, '', 'so the band names no shot');

            const after = await page.evalFn(async () => {
                await window.__savedShot.pullShot({ id: 'shot-first' });
                const writes = await window.__savedShot.rate(60);
                return { band: window.__savedShot.band(), writes, held: window.__savedShot.heldIds() };
            });

            assert.equal(after.band.shotId, 'shot-first');
            assert.deepEqual(after.held, ['shot-first']);
            assert.deepEqual(after.writes, [{ id: 'shot-first', enjoyment: 60 }],
                'the very first shot on a machine can be rated');
        }, { empty: true });
    });

    test('while the record is still being written there is nothing to rate, and the screen says so', async () => {
        await staged(async (page) => {
            const waiting = await page.evalFn(async () => {
                await window.__savedShot.pullShot({ id: 'shot-slow', landAfter: 99 });
                return {
                    band: window.__savedShot.band(),
                    saved: window.__savedShot.saved(),
                    held: window.__savedShot.heldIds(),
                    reach: window.__savedShot.reach(),
                };
            });

            assert.equal(waiting.band.hasRatingControl, false,
                'no rating control while there is no record for it to write onto');
            assert.equal(waiting.band.saving, true);
            assert.equal(waiting.band.waitingLine, 'Saving this shot…',
                'the corner says what the app is doing rather than offering a press');
            assert.equal(waiting.band.shotId, '', 'and nothing else is standing in for the shot');
            assert.equal(waiting.band.when, null, 'the previous shot is not named beside the new chart');
            assert.equal(waiting.saved.shotId, 'shot-slow',
                'the shell still knows which shot it is waiting for');
            assert.equal(waiting.held[0], 'shot-old', 'the previous shot is still just the previous shot');
            assert.equal(waiting.reach.newer, false, 'there is nothing newer than a shot being saved');
            assert.equal(waiting.reach.older, true, 'and the stored shots are one press away');
        });
    });

    test('when the record lands the band picks it up and can be rated', async () => {
        await staged(async (page) => {
            const landed = await page.evalFn(async () => {
                await window.__savedShot.pullShot({ id: 'shot-late', landAfter: 4 });
                const waiting = window.__savedShot.band();
                await window.__savedShot.letItLand();
                const writes = await window.__savedShot.rate(80);
                return { waiting, band: window.__savedShot.band(), writes };
            });

            assert.equal(landed.waiting.hasRatingControl, false, 'nothing to rate while it was in flight');
            assert.equal(landed.band.shotId, 'shot-late');
            assert.deepEqual(landed.writes, [{ id: 'shot-late', enjoyment: 80 }]);
        });
    });

    test('a record that never arrives is still not the shot before it', async () => {
        await staged(async (page) => {
            const gone = await page.evalFn(async () => {
                await window.__savedShot.pullShot({ id: 'shot-lost', landAfter: 99 });
                return {
                    band: window.__savedShot.band(),
                    saved: window.__savedShot.saved(),
                    reach: window.__savedShot.reach(),
                    held: window.__savedShot.heldIds(),
                };
            });

            assert.equal(gone.saved.status, 'unavailable', 'the shell stopped looking');
            assert.equal(gone.band.saving, false, 'so the screen stops saying it is saving');
            assert.equal(gone.band.waitingLine, null, 'and the waiting line goes with it');
            assert.equal(gone.band.hasRatingControl, false,
                'there is still no record for a rating to be written onto');
            assert.equal(gone.band.shotId, '', 'and nothing stands in for the shot');
            assert.equal(gone.band.when, null,
                'the previous shot is not named beside the one that was lost');
            assert.equal(gone.reach.older, true, 'the stored shots are one press away');
            assert.equal(gone.reach.newer, false, 'and there is nothing newer to reach');
            assert.equal(gone.held[0], 'shot-old', 'the list is what it always was');
        }, { instantRetry: true });
    });

    test('stepping older from a shot being saved lands on the newest stored shot', async () => {
        await staged(async (page) => {
            const stepped = await page.evalFn(async () => {
                await window.__savedShot.pullShot({ id: 'shot-slow', landAfter: 99 });
                const band = await window.__savedShot.stepOlder();
                return { band, expanded: await window.__savedShot.expand() };
            });
            assert.equal(stepped.band.shotId, 'shot-old');
            assert.equal(stepped.band.saving, false);
            assert.equal(stepped.band.hasRatingControl, true, 'a stored shot can still be rated');
            assert.equal(stepped.expanded.shotId, 'shot-old');
        });
    });

    test('nothing is said about a lost record while the app is still looking', async () => {
        await staged(async (page) => {
            const waiting = await page.evalFn(async () => {
                await window.__savedShot.pullShot({ id: 'shot-slow', landAfter: 99 });
                return { band: window.__savedShot.band(), saved: window.__savedShot.saved() };
            });

            assert.equal(waiting.saved.status, 'waiting', 'the shell had already given up');
            assert.equal(waiting.band.waitingLine, 'Saving this shot…');
            assert.equal(waiting.band.unsavedLine, null,
                'the corner called the shot lost while the record was still being looked for');
        });
    });

    test('when the looking is over the corner says the shot was not saved', async () => {
        await staged(async (page) => {
            const gone = await page.evalFn(async () => {
                await window.__savedShot.pullShot({ id: 'shot-lost', landAfter: 99 });
                return { band: window.__savedShot.band(), saved: window.__savedShot.saved() };
            });

            assert.equal(gone.saved.status, 'unavailable', 'the shell was still looking');
            assert.equal(gone.band.unsavedLine, 'This shot was not saved.',
                'the corner said nothing at all about a shot that was never written down');
            assert.equal(gone.band.waitingLine, null, 'and it is not still claiming to be saving');
            assert.equal(gone.band.hasRatingControl, false,
                'a rating control came back with the sentence');
            assert.equal(gone.band.shotId, '', 'and something is standing in for the shot again');
        }, { instantRetry: true });
    });

    test('a shot whose record lands is never called unsaved', async () => {
        await staged(async (page) => {
            const landed = await page.evalFn(async () => {
                await window.__savedShot.pullShot({ id: 'shot-late', landAfter: 4 });
                const waiting = window.__savedShot.band();
                await window.__savedShot.letItLand();
                return { waiting, band: window.__savedShot.band() };
            });

            assert.equal(landed.waiting.unsavedLine, null, 'said not saved while it was still in flight');
            assert.equal(landed.band.shotId, 'shot-late', 'the record never landed');
            assert.equal(landed.band.unsavedLine, null, 'said not saved about a shot that WAS saved');
            assert.equal(landed.band.hasRatingControl, true, 'and the stored shot can be rated');
        });
    });

    test('stepping onto a stored shot leaves the sentence behind', async () => {
        await staged(async (page) => {
            const stepped = await page.evalFn(async () => {
                await window.__savedShot.pullShot({ id: 'shot-lost', landAfter: 99 });
                const lost = window.__savedShot.band();
                const band = await window.__savedShot.stepOlder();
                return { lost, band };
            });

            assert.equal(stepped.lost.unsavedLine, 'This shot was not saved.');
            assert.equal(stepped.band.shotId, 'shot-old', 'the arrow did not reach the stored shot');
            assert.equal(stepped.band.unsavedLine, null,
                'the sentence followed the arrows onto a shot it is not about');
            assert.equal(stepped.band.hasRatingControl, true, 'and that shot can be rated');
        }, { instantRetry: true });
    });

    test('a retained chart keeps its own profile while a different one is armed', async () => {
        await staged(async (page) => {
            const seen = await page.evalFn(async () => {
                await window.__savedShot.pullShot({ id: 'shot-a', title: 'Extractamundo Dos!' });
                const armed = await window.__savedShot.armProfile('Gentle and sweet');
                const expanded = await window.__savedShot.expand();
                return { armed, expanded, band: window.__savedShot.band() };
            });

            assert.equal(seen.armed, 'Gentle and sweet', 'the machine really is on the other profile');
            assert.equal(seen.band.armed, 'Gentle and sweet', 'and the header above the chart says so');
            assert.equal(seen.expanded.open, true);
            assert.equal(seen.expanded.shotId, 'shot-a', 'the overlay is drawing the shot that was pulled');
            assert.ok(seen.expanded.samples > 0, 'with its samples');
            assert.equal(seen.expanded.identity, 'Extractamundo Dos!',
                'and it is titled with THAT shot\'s profile, not with what is armed now');
        });
    });

    test('a shot pouring now is titled with the profile it is being pulled on', async () => {
        await staged(async (page) => {
            const seen = await page.evalFn(async () => {
                await window.__savedShot.pullShot({ id: 'shot-a', title: 'Extractamundo Dos!' });
                await window.__savedShot.armProfile('Gentle and sweet');
                await window.__savedShot.startShot({ id: 'shot-b' });
                const expanded = await window.__savedShot.expand();
                return { expanded };
            });

            assert.equal(seen.expanded.shotId, 'shot-b', 'the live shot has taken the chart');
            assert.equal(seen.expanded.identity, 'Gentle and sweet',
                'and the title is the profile THIS shot is being pulled on');
        });
    });

    test('an older shot chosen with the arrows is titled with its own profile', async () => {
        await staged(async (page) => {
            const seen = await page.evalFn(async () => {
                await window.__savedShot.armProfile('Gentle and sweet');
                await window.__savedShot.stepOlder();
                const expanded = await window.__savedShot.expand();
                return { band: window.__savedShot.band(), expanded };
            });

            assert.equal(seen.band.shotId, 'shot-older');
            assert.equal(seen.expanded.shotId, 'shot-older');
            assert.equal(seen.expanded.identity, 'Lever Classic demo',
                'the stored shot names itself off its own workflow, not off what is armed');
        });
    });

    test('a retained chart keeps its title across leaving the page and coming back', async () => {
        await staged(async (page) => {
            const seen = await page.evalFn(async () => {
                await window.__savedShot.pullShot({ id: 'shot-a', title: 'Extractamundo Dos!' });
                const before = await window.__savedShot.expand();
                await window.__savedShot.collapse();
                await window.__savedShot.remount();
                const after = await window.__savedShot.expand();
                return { before, after };
            });

            assert.equal(seen.before.identity, 'Extractamundo Dos!');
            assert.equal(seen.after.shotId, 'shot-a',
                'the chart came back holding the same shot');
            assert.equal(seen.after.identity, 'Extractamundo Dos!',
                'and it is still titled with the shot it is drawing');
        });
    });
});
