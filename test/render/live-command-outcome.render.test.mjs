/**
 * What Live says about a press that did not work: a machine command, a tare, and a key
 * typed while a dialog is open. Every press is on a rendered control or on the document.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, BENCH } from '../harness/index.js';

const MODULES = ['/test/fixtures/live-command-outcome-fixture.js'];
const STAGE = '<div id="stage" style="inline-size: 100%; block-size: 100dvh"></div>';

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

const staged = (fn) => browser.withPage({ geometry: BENCH }, async (page) => {
    await page.mount(STAGE, MODULES);
    await page.evalFn(() => window.__command.reset());
    const mounted = await page.evalFn(() => window.__command.mount());
    assert.deepEqual(page.pageErrors, [], 'the shell boots without throwing');
    assert.equal(mounted.ghc, true, 'the machine strip is drawn, or there is nothing to press');
    await fn(page);
});

describe('a machine command that did not work @ bench', () => {
    test('a REFUSED start is quoted on screen, with a retry', () => staged(async (page) => {
        const shown = await page.evalFn(async () => {
            window.__command.refuseCommands();
            return window.__command.pressKey('espresso');
        });

        assert.equal(shown.outcome, 'refused');
        assert.match(shown.error, /No scale detected/,
            "the machine's own sentence is what a person reads, not our paraphrase");
        assert.equal(shown.kind, 'block_no_scale', 'the typed refusal is told apart in the DOM');
        assert.ok(shown.retry, 'a refusal a person can answer must offer the press again');
    }));

    test('a 503 is visible too, and offers the retry', () => staged(async (page) => {
        const shown = await page.evalFn(async () => {
            window.__command.failCommands(503);
            return window.__command.pressKey('espresso');
        });

        assert.equal(shown.outcome, 'failed', 'a failure the machine reported must be reported on screen');
        assert.ok(shown.error, 'a failure with no sentence on screen is an inert button');
        assert.ok(shown.retry, 'and it must be retryable');
    }));

    test('a network that is not there, and a request that never answers, both speak',
        () => staged(async (page) => {
            const dropped = await page.evalFn(async () => {
                window.__command.dropNetwork();
                return window.__command.pressKey('steam');
            });
            assert.equal(dropped.outcome, 'failed', 'a rejected fetch is an ending like any other');
            assert.ok(dropped.retry);

            const hung = await page.evalFn(async () => {
                window.__command.hangCommands();
                await window.__command.pressKey('flush', { wait: 60 });
                return window.__command.notices();
            });
            assert.equal(hung.outcome, 'sending',
                'while it is out, the surface says so rather than nothing');
        }));

    test('a STOP that never reached the machine says so', () => staged(async (page) => {
        const shown = await page.evalFn(async () => {
            await window.__command.pushMachine('espresso', { pressure: 6, flow: 2.1 });
            window.__command.failCommands(500);
            return window.__command.pressStop();
        });

        assert.equal(shown.outcome, 'failed',
            'a stop that did not arrive is the one press that must never look like it did');
        assert.ok(shown.retry);
    }));

    test('a WAKE that failed is retained on Live, though Live never sent it',
        () => staged(async (page) => {
            const shown = await page.evalFn(async () => {
                await window.__command.pushMachine('sleeping');
                window.__command.failCommands(503);
                return window.__command.wake();
            });

            assert.equal(shown.outcome, 'failed');
            assert.ok(shown.error, 'the wake failed silently and the blank simply came back');
            assert.ok(shown.retry, 'and there was no way to ask again from here');
        }));

    test('a wake the machine ACCEPTS and then ignores is not reported as a success',
        () => staged(async (page) => {
            const shown = await page.evalFn(async () => {
                await window.__command.pushMachine('sleeping');
                return window.__command.wake();
            });

            assert.equal(shown.outcome, 'waiting',
                'a 200 is the request landing, never the machine waking');
            assert.ok(shown.note, 'and the surface has to say which of the two it knows');
        }));

    test('the retry sends the same command again, through the same door',
        () => staged(async (page) => {
            const after_ = await page.evalFn(async () => {
                window.__command.failCommands(503);
                await window.__command.pressKey('hot-water');
                window.__command.acceptCommands();
                return window.__command.retry();
            });

            assert.deepEqual(after_.commands, ['hotWater', 'hotWater'],
                'the retry must ask for what was asked for, not for what is on screen now');
            assert.equal(after_.notices.error, null, 'and the banner goes when it succeeds');
        }));

    test('the dismissal clears the record, not just the pixels', () => staged(async (page) => {
        const after_ = await page.evalFn(async () => {
            window.__command.failCommands(503);
            await window.__command.pressKey('espresso');
            const shown = await window.__command.dismiss();
            return { shown, record: window.__command.record() };
        });

        assert.equal(after_.shown.error, null, 'the banner is gone');
        assert.equal(after_.record.status, 'idle',
            'a surface that hid an ending the store still held would be two owners of one state');
    }));

    test('the machine doing it is the confirmation, and it is the only one',
        () => staged(async (page) => {
            const sent = await page.evalFn(() => window.__command.pressKey('espresso'));
            assert.equal(sent.outcome, 'waiting', 'the route answered; the machine has not moved');

            const running = await page.evalFn(() => window.__command.pushMachine('espresso', { pressure: 6 }));
            assert.equal(running.notices.outcome, 'confirmed',
                "only the machine's own feed can confirm a state request");
        }));

    test('a confirmation is a moment: it retires, and the column costs the chart nothing again',
        () => staged(async (page) => {
            const shown = await page.evalFn(async () => {
                await window.__command.pressKey('espresso');
                await window.__command.pushMachine('espresso', { pressure: 6 });
                const confirmed = window.__command.notices();
                await new Promise((done) => { setTimeout(done, 4200); });
                const later = await window.__command.pushMachine('espresso', { pressure: 6.2 });
                return { confirmed, later: later.notices };
            });

            assert.equal(shown.confirmed.outcome, 'confirmed');
            assert.equal(shown.later.note, null, 'the line stayed after it had been read');
            assert.equal(shown.later.error, null, 'and it did not turn into an alarm on the way out');
        }));

    test('A FAILED COMMAND LEAVES THE READINGS ALONE — they are about the machine, not the press',
        () => staged(async (page) => {
            const shown = await page.evalFn(async () => {
                await window.__command.pushMachine('idle', { pressure: 6.1, flow: 2.4 });
                window.__command.failCommands(503);
                await window.__command.pressKey('steam');
                await window.__command.pushMachine('idle', { pressure: 7.2, flow: 1.8 });
                return { notices: window.__command.notices(), readings: window.__command.readings() };
            });

            assert.equal(shown.notices.outcome, 'failed', 'the command failure is on screen');
            const pressure = shown.readings.find((tile) => tile.label === 'Pressure');
            assert.equal(pressure.value, '7.2',
                'telemetry kept arriving and kept being drawn while the command surface said no');
        }));

    test('the two surfaces stay apart: a command failure is not drawn as a profile refusal',
        () => staged(async (page) => {
            const shown = await page.evalFn(async () => {
                window.__command.failCommands(503);
                return window.__command.pressKey('espresso');
            });
            assert.equal(shown.refusal, null,
                'the refusal banner is about arming a profile and must not answer for a press');
            assert.ok(shown.error, 'and the press has its own surface');
        }));
});

describe('the tare answers for itself @ bench', () => {
    test('a REFUSED tare is quoted, with a retry', () => staged(async (page) => {
        const shown = await page.evalFn(async () => {
            window.__command.refuseTare();
            return window.__command.pressTare();
        });

        assert.equal(shown.tareStatus, 'refused');
        assert.match(shown.tare, /shot is in progress/, "the machine's own words");
        assert.ok(shown.tareRetry);
    }));

    test('a tare the scale never answers is UNCONFIRMED, not tared', () => staged(async (page) => {
        const shown = await page.evalFn(async () => {
            await window.__command.pushScale(18.4);
            return window.__command.pressTare({ wait: 3000 });
        });

        assert.equal(shown.tareStatus, 'unconfirmed');
        assert.ok(shown.tareRetry, 'the one ending a person most needs to be able to answer');
    }));

    test('A STALE ZERO CANNOT CONFIRM A TARE, and a fresh one can', () => staged(async (page) => {
        const stale = await page.evalFn(async () => {
            await window.__command.pushScale(0);
            /* Long enough for the scale feed's own budget to expire on the reading. */
            await new Promise((done) => { setTimeout(done, 4200); });
            return window.__command.pressTare({ wait: 3000 });
        });
        assert.equal(stale.tareStatus, 'unconfirmed',
            'a zero older than the request cannot confirm it');

        const fresh = await page.evalFn(async () => {
            await window.__command.pushScale(18.4);
            const done = window.__command.pressTare({ wait: 800 });
            await window.__command.pushScale(0.02);
            return done;
        });
        assert.equal(fresh.tareStatus, 'done', 'nonzero to zero, on a frame from this attempt');
    }));

    test('a scale already at zero says so, and does not claim an operation it could not see',
        () => staged(async (page) => {
            const shown = await page.evalFn(async () => {
                await window.__command.pushScale(0.01);
                const done = window.__command.pressTare({ wait: 800 });
                await window.__command.pushScale(0.01);
                return done;
            });

            assert.equal(shown.tareStatus, 'already-zero');
            assert.notEqual(shown.tareStatus, 'done',
                'nothing could move, so nothing was observed — and the surface says which');
        }));

    test('the tare retry is the tile\'s own gesture, and it asks again', () => staged(async (page) => {
        const after_ = await page.evalFn(async () => {
            window.__command.failTare(500);
            await window.__command.pressTare();
            return window.__command.retry('tare');
        });

        assert.equal(after_.tares, 2, 'the retry reached the same route the tile does');
    }));
});

describe('a dialog owns the keyboard @ bench', () => {
    test('E, W, S, F and P cannot start the machine through an open keypad',
        () => staged(async (page) => {
            const opened = await page.evalFn(() => window.__command.openKeypad());
            assert.equal(opened.open, true, 'the keypad is up');
            assert.equal(opened.modalOpen, true, 'and the screen knows it');

            for (const key of ['e', 'w', 's', 'f', 'p']) {
                const typed = await page.evalFn(
                    (k) => window.__command.typeKeyInKeypad(k), key,
                );
                assert.deepEqual(typed.commands, [],
                    `"${key}" reached the machine through a dialog that had made everything else inert`);
            }
        }));

    test('the shortcuts come back when the dialog is dismissed', () => staged(async (page) => {
        const back = await page.evalFn(async () => {
            await window.__command.openKeypad();
            await window.__command.closeKeypad();
            return window.__command.typeKey('e');
        });

        assert.equal(back.notices.modalOpen, undefined, 'the reading is the command list below');
        assert.deepEqual(back.commands, ['espresso'],
            'the shortcuts come back when the dialog goes');
    }));

    test('STOP stays global, deliberately, and it is the only one', () => staged(async (page) => {
        const stopped = await page.evalFn(async () => {
            await window.__command.pushMachine('espresso', { pressure: 6 });
            await window.__command.openKeypad();
            return window.__command.typeKeyInKeypad(' ');
        });

        assert.deepEqual(stopped.commands, ['idle'],
            'a shot is running behind that dialog and the abort must not need it dismissed first');
    }));
});
