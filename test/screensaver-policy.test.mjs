// One tap on the sleep button slept the machine and woke it 46 ms later.
//
// PUT /machine/state/sleeping  15:53:55.035
// PUT /machine/state/idle      15:53:55.081   <- the screensaver's teardown
//
// The teardown (deactivateScreensaver) emitted setMachineState('idle') as part of hiding the
// overlay. The sleep button raised the overlay optimistically; the next snapshot still said
// 'idle'; the "machine is awake, tidy the overlay away" branch tore it down — and the
// teardown woke the machine.
//
// These tests pin the invariant that makes that impossible: the screensaver action derived
// from a machine snapshot is PAINT-ONLY, and a hide never carries a wake. They are the old
// skin's suite, carried with the logic (SCOPE Part 6, "Tests"), with three assertions
// CORRECTED in the same change as the code they defend:
//
//   1. `state matching is case-insensitive` pinned a lenient matcher. Under A7 a case-fold
//      is a fallback — it makes a name ReaPrime cannot send match, and what it matches on is
//      blanking the screen. Now pinned the other way, from the generated enum.
//   2. `every state that can follow a dim eventually restores` asserted its own claim over
//      exactly two names ('idle', 'error') while its comment asserted a stronger premise —
//      that those are the only states that can follow a sleep. The generated enum has 21.
//      Now asserted over all of them.
//   3. `states that are neither sleep nor a wake nor a drop leave brightness alone` included
//      transitions OUT of a sleep in its "leave alone" set, which is the dead-end dim of
//      reaprime#519. Split: awake-to-awake still leaves brightness alone; sleep-to-anything
//      releases.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
    DISPLAY_ACTION,
    SCREENSAVER_ACTION,
    SCREENSAVER_BRIGHTNESS,
    WAKE_CONFIRM_GRACE_MS,
    deriveDisplayAction,
    deriveScreensaverAction,
    deriveSleepButtonAction,
    isMachineAsleep,
    isWakePending,
} from '../src/lib/screensaver-policy.js';
import { MACHINE_STATE, MACHINE_STATES, isMachineState } from '../src/data/machine-state.js';
import { WS_CHANNELS } from '../src/data/rea-ws-channels.js';
import { noReading, ABSENCE } from '../src/data/reading.js';
import { stripComments } from '../scripts/lib/source-scan.js';

const MODULE_PATH = fileURLToPath(new URL('../src/lib/screensaver-policy.js', import.meta.url));

/** The absences the address layer actually hands a consumer, plus the raw empties. */
const ABSENT_STATES = [
    noReading(ABSENCE.NO_SOURCE),
    noReading(ABSENCE.ABSENT),
    noReading(ABSENCE.ERROR),
    null,
    undefined,
    '',
];

const AWAKE_STATES = MACHINE_STATES.filter((state) => state !== MACHINE_STATE.SLEEPING);

// --- Gate 2: the names are the generated ones ----------------------------------

describe('every state name in the policy comes from the generated enum', () => {
    test('the sleep state this module compares against is a real MachineState', () => {
        // If ReaPrime renames it, MACHINE_STATE.SLEEPING stops being a name and this fails —
        // which is the whole point of not spelling 'sleeping' by hand in the policy.
        assert.equal(typeof MACHINE_STATE.SLEEPING, 'string');
        assert.ok(isMachineState(MACHINE_STATE.SLEEPING));
    });

    test('both sleep-button commands are states ReaPrime accepts', () => {
        // The caller PUTs these at /api/v1/machine/state/{newState}. A name the server does
        // not know is a 400 the user never sees.
        for (const machineState of [MACHINE_STATE.IDLE, MACHINE_STATE.SLEEPING]) {
            assert.ok(isMachineState(deriveSleepButtonAction({ machineState }).command));
        }
    });
});

// --- deriveScreensaverAction: a snapshot may paint, never command ---------------

test('the derived screensaver action is paint-only — "show" | "hide" | "none", never a command', () => {
    const allowed = new Set(Object.values(SCREENSAVER_ACTION));

    for (const machineState of [...MACHINE_STATES, ...ABSENT_STATES]) {
        for (const screensaverActive of [true, false]) {
            for (const screensaverEnabled of [true, false]) {
                for (const wakePending of [true, false]) {
                    const action = deriveScreensaverAction({
                        machineState, screensaverActive, screensaverEnabled, wakePending,
                    });
                    assert.ok(allowed.has(action), `${String(machineState)} -> ${action}`);
                    // The point of the whole fix: no reachable input produces a wake.
                    assert.notEqual(action, MACHINE_STATE.IDLE);
                    assert.notEqual(action, 'wake');
                }
            }
        }
    }
});

test('machine confirms SLEEPING with the overlay down -> show it', () => {
    assert.equal(
        deriveScreensaverAction({ machineState: MACHINE_STATE.SLEEPING, screensaverActive: false }),
        SCREENSAVER_ACTION.SHOW,
    );
});

test('machine confirms SLEEPING with the overlay already up -> do nothing', () => {
    assert.equal(
        deriveScreensaverAction({ machineState: MACHINE_STATE.SLEEPING, screensaverActive: true }),
        SCREENSAVER_ACTION.NONE,
    );
});

test('screensaver setting off: a sleeping machine does NOT raise the overlay', () => {
    // Black-vs-dimmed is no longer a setting (D10); on-vs-off still is.
    assert.equal(
        deriveScreensaverAction({
            machineState: MACHINE_STATE.SLEEPING, screensaverActive: false, screensaverEnabled: false,
        }),
        SCREENSAVER_ACTION.NONE,
    );
});

test('THE BUG: an awake machine with the overlay up -> HIDE (a paint), not a wake', () => {
    // This is the exact branch that fired 46 ms after the sleep press, when the stale
    // snapshot still reported 'idle' and the overlay was optimistically up. It must resolve
    // to a hide — and a hide sends nothing.
    assert.equal(
        deriveScreensaverAction({ machineState: MACHINE_STATE.IDLE, screensaverActive: true }),
        SCREENSAVER_ACTION.HIDE,
    );
});

test('an awake machine with the overlay already down -> do nothing', () => {
    assert.equal(
        deriveScreensaverAction({ machineState: MACHINE_STATE.IDLE, screensaverActive: false }),
        SCREENSAVER_ACTION.NONE,
    );
});

// --- CORRECTED (1): the case-fold was a fallback, not null-safety ---------------

describe('only a CONFIRMED sleep blanks the screen', () => {
    test('a differently-cased name is not a state and never raises the overlay', () => {
        // The old module folded case, so 'SLEEPING' blanked the screen. ReaPrime serialises
        // its enum exactly; a name that needs folding to match is a name it did not send,
        // and matching it anyway is a fallback that decides to blank the panel.
        for (const name of ['SLEEPING', 'Sleeping', ' sleeping', 'sleeping ']) {
            assert.equal(isMachineState(name), false, `${name} is not a MachineState`);
            assert.equal(isMachineAsleep(name), false);
            assert.equal(
                deriveScreensaverAction({ machineState: name, screensaverActive: false }),
                SCREENSAVER_ACTION.NONE,
            );
        }
    });

    test('an unrecognised name is a machine doing something, not a sleeping one', () => {
        // The server knows a state this build's enum does not. Never blank on it, and
        // release a blanking that is up.
        assert.equal(
            deriveScreensaverAction({ machineState: 'teleporting', screensaverActive: false }),
            SCREENSAVER_ACTION.NONE,
        );
        assert.equal(
            deriveScreensaverAction({ machineState: 'teleporting', screensaverActive: true }),
            SCREENSAVER_ACTION.HIDE,
        );
    });

    test('an ABSENCE never raises the overlay, and releases one that is up', () => {
        // A7: nothing readable arrived, so there is nothing to confirm a sleep. The old
        // module reached the same answer by coercing null to '' — an accident of
        // `String(x || '')` rather than a rule. It is a rule now, and it is the same one the
        // display action follows: never leave a screen blanked on a machine we cannot see.
        for (const machineState of ABSENT_STATES) {
            assert.equal(
                deriveScreensaverAction({ machineState, screensaverActive: false }),
                SCREENSAVER_ACTION.NONE,
                `absence ${String(machineState?.reason ?? machineState)} must not raise the overlay`,
            );
            assert.equal(
                deriveScreensaverAction({ machineState, screensaverActive: true }),
                SCREENSAVER_ACTION.HIDE,
            );
        }
        assert.equal(deriveScreensaverAction(), SCREENSAVER_ACTION.NONE);
    });
});

// --- the wake path: an optimistic HIDE must not be undone by a stale frame -------
//
// The mirror of the show-side race: that one was an optimistic SHOW undone by a stale 'idle'
// frame — and, back then, the teardown that followed woke the machine. This is an optimistic
// HIDE undone by a stale 'sleeping' frame: the user taps to wake, we take the overlay down at
// once, and for the next frame or three the machine still honestly reports 'sleeping' because
// the PUT has not round-tripped — so the overlay flashed back up for ~100-300 ms, right as
// the user reached for the machine. Same class of bug, opposite direction.

test('THE WAKE FLICKER: a stale "sleeping" frame does NOT re-raise the overlay we just hid', () => {
    assert.equal(
        deriveScreensaverAction({
            machineState: MACHINE_STATE.SLEEPING, screensaverActive: false, wakePending: true,
        }),
        SCREENSAVER_ACTION.NONE,
    );
});

test('and WITHOUT a wake in flight that very same frame still raises it', () => {
    // The discriminator: it is the pending wake that changes the answer, nothing else. A
    // machine that is asleep of its own accord must still show the overlay.
    assert.equal(
        deriveScreensaverAction({
            machineState: MACHINE_STATE.SLEEPING, screensaverActive: false, wakePending: false,
        }),
        SCREENSAVER_ACTION.SHOW,
    );
});

test('the suppression CANNOT latch the screensaver off — it expires with the grace window', () => {
    const sentAt = 10_000;
    const expired = isWakePending(sentAt, sentAt + WAKE_CONFIRM_GRACE_MS);

    assert.equal(expired, false, 'the grace window must close');
    assert.equal(
        deriveScreensaverAction({
            machineState: MACHINE_STATE.SLEEPING, screensaverActive: false, wakePending: expired,
        }),
        SCREENSAVER_ACTION.SHOW,
        'once the wake has expired, a still-sleeping machine gets its overlay back',
    );
});

test('isWakePending: none / in-flight / expired', () => {
    assert.equal(isWakePending(0), false, 'no wake was ever sent');
    assert.equal(isWakePending(null), false);
    assert.equal(isWakePending(undefined), false);

    const sentAt = 50_000;
    assert.equal(isWakePending(sentAt, sentAt), true, 'just sent');
    assert.equal(isWakePending(sentAt, sentAt + 300), true, 'a normal round-trip is well inside the window');
    assert.equal(isWakePending(sentAt, sentAt + WAKE_CONFIRM_GRACE_MS - 1), true);
    assert.equal(isWakePending(sentAt, sentAt + WAKE_CONFIRM_GRACE_MS), false, 'boundary is exclusive');
    assert.equal(isWakePending(sentAt, sentAt + WAKE_CONFIRM_GRACE_MS + 1), false);
    assert.equal(WAKE_CONFIRM_GRACE_MS, 3000);
});

test('a pending wake never suppresses a HIDE — the show-side invariant is untouched', () => {
    // The show-side fix rests on an awake machine tidying the overlay away. wakePending must
    // not interfere with that branch at all: it only ever declines to SHOW.
    for (const machineState of AWAKE_STATES) {
        assert.equal(
            deriveScreensaverAction({ machineState, screensaverActive: true, wakePending: true }),
            SCREENSAVER_ACTION.HIDE,
            `${machineState} with the overlay up must still hide it`,
        );
    }
});

test('a pending wake does not override the user turning the screensaver off', () => {
    assert.equal(
        deriveScreensaverAction({
            machineState: MACHINE_STATE.SLEEPING,
            screensaverActive: false,
            screensaverEnabled: false,
            wakePending: true,
        }),
        SCREENSAVER_ACTION.NONE,
    );
});

test('wakePending defaults to false — an omitted flag never suppresses', () => {
    assert.equal(
        deriveScreensaverAction({ machineState: MACHINE_STATE.SLEEPING, screensaverActive: false }),
        SCREENSAVER_ACTION.SHOW,
    );
});

test('isMachineAsleep is exact, and every other generated state is awake', () => {
    assert.equal(isMachineAsleep(MACHINE_STATE.SLEEPING), true);
    for (const machineState of AWAKE_STATES) {
        assert.equal(isMachineAsleep(machineState), false, `${machineState} is not sleep`);
    }
    for (const machineState of ABSENT_STATES) {
        assert.equal(isMachineAsleep(machineState), false);
    }
});

// --- deriveSleepButtonAction ---------------------------------------------------

test('sleep button on an AWAKE machine: sends "sleeping", and nothing else', () => {
    const action = deriveSleepButtonAction({ machineState: MACHINE_STATE.IDLE, screensaverActive: false });
    assert.deepEqual({ ...action }, { command: MACHINE_STATE.SLEEPING, hideScreensaver: false });
});

test('THE RACE: the sleep button does NOT raise the screensaver optimistically', () => {
    // The old handler called activateScreensaver() right after PUT sleeping. That opened the
    // 46 ms window in which a stale 'idle' snapshot could tear the overlay back down (and,
    // back then, wake the machine). The screensaver now has exactly one source of truth: the
    // machine's CONFIRMED state.
    const action = deriveSleepButtonAction({ machineState: MACHINE_STATE.IDLE, screensaverActive: false });
    assert.equal(action.command, MACHINE_STATE.SLEEPING);
    assert.ok(!('showScreensaver' in action), 'the button has no optimistic-show outcome at all');
});

test('sleep button on a SLEEPING machine: one wake, and the overlay comes down', () => {
    const action = deriveSleepButtonAction({ machineState: MACHINE_STATE.SLEEPING, screensaverActive: true });
    assert.deepEqual({ ...action }, { command: MACHINE_STATE.IDLE, hideScreensaver: true });
});

test('sleep button on a SLEEPING machine with no overlay up: still exactly one wake', () => {
    // Previously this path sent the wake twice — once itself, once via
    // deactivateScreensaver()'s baked-in wake.
    const action = deriveSleepButtonAction({ machineState: MACHINE_STATE.SLEEPING, screensaverActive: false });
    assert.deepEqual({ ...action }, { command: MACHINE_STATE.IDLE, hideScreensaver: false });
});

test('INVARIANT: only a machine that is genuinely ASLEEP may derive a wake', () => {
    // "Nothing that is not a wake may emit a wake." Every other state — and every absence,
    // which is the case the old module reached by coercion — takes the sleep half, the half
    // that cannot surprise anyone.
    for (const machineState of [...AWAKE_STATES, ...ABSENT_STATES, 'teleporting']) {
        for (const screensaverActive of [true, false]) {
            const action = deriveSleepButtonAction({ machineState, screensaverActive });
            assert.equal(
                action.command,
                MACHINE_STATE.SLEEPING,
                `state ${String(machineState)} must never derive a wake`,
            );
            assert.equal(action.hideScreensaver, false);
        }
    }

    for (const screensaverActive of [true, false]) {
        const action = deriveSleepButtonAction({ machineState: MACHINE_STATE.SLEEPING, screensaverActive });
        assert.equal(action.command, MACHINE_STATE.IDLE);
    }
});

test('sleep button derivation is pure — repeated calls give the same answer', () => {
    const input = { machineState: MACHINE_STATE.IDLE, screensaverActive: false };
    assert.deepEqual({ ...deriveSleepButtonAction(input) }, { ...deriveSleepButtonAction(input) });
    assert.deepEqual({ ...deriveSleepButtonAction(input) }, {
        command: MACHINE_STATE.SLEEPING, hideScreensaver: false,
    });
});

// --- deriveDisplayAction: a dim must always have something that undoes it -------
//
// reaprime#519: the DE1 dropped off BLE while asleep. The dim was applied on the 'sleeping'
// transition and only an 'idle' transition released it — which a machine that is no longer
// there never sends. The tablet stayed dark for the rest of the session, with the settings
// brightness slider (invisible on a dark panel) the only way back.

test('a machine that drops off BLE while asleep releases the dim', () => {
    assert.equal(deriveDisplayAction(MACHINE_STATE.IDLE, MACHINE_STATE.SLEEPING), DISPLAY_ACTION.DIM);
    assert.equal(deriveDisplayAction(MACHINE_STATE.SLEEPING, MACHINE_STATE.ERROR), DISPLAY_ACTION.RESTORE);
});

// --- CORRECTED (2): the no-dead-end claim, asserted over the whole enum ---------

test('EVERY state that can follow a dim restores it — no dead end, over all 21', () => {
    // The old suite asserted this over two names while its comment claimed those were the
    // only two states that can follow a sleep. They are not: a machine that wakes on its own
    // schedule, or into heating, or that reboots, left the panel black with nothing to undo
    // it — the same failure as reaprime#519 by a different route.
    assert.ok(MACHINE_STATES.length >= 20, 'the generated enum is the source of this list');
    for (const next of AWAKE_STATES) {
        assert.equal(
            deriveDisplayAction(MACHINE_STATE.SLEEPING, next),
            DISPLAY_ACTION.RESTORE,
            `${next} must undo the dim`,
        );
    }
});

test('an ABSENCE after a dim releases it — the BLE drop as the address layer sees it', () => {
    // Under the address layer a machine that vanishes does not send 'error'; the feed simply
    // stops and the state reads as an absence. That is the case the old 'error' branch was
    // written for, in its modern shape, and it must release the dim.
    for (const gone of ABSENT_STATES) {
        assert.equal(
            deriveDisplayAction(MACHINE_STATE.SLEEPING, gone),
            DISPLAY_ACTION.RESTORE,
            `a machine that went ${String(gone?.reason ?? gone)} while asleep must not stay dark`,
        );
    }
});

test('the display action is transition-only — a repeated state does nothing', () => {
    // The snapshot feed repeats the same state at ~10 Hz. Acting on every frame would re-dim
    // over a brightness the user just picked on the settings slider.
    for (const state of MACHINE_STATES) {
        assert.equal(deriveDisplayAction(state, state), DISPLAY_ACTION.NONE);
    }
});

// --- CORRECTED (3): awake-to-awake leaves brightness alone; sleep-to-anything does not ---

test('an awake-to-awake transition leaves brightness alone', () => {
    for (const next of ['espresso', 'steam', 'hotWater', 'heating', 'flush', 'booting']) {
        assert.equal(deriveDisplayAction(MACHINE_STATE.IDLE, next), DISPLAY_ACTION.NONE);
    }
    // Including one the enum does not know: an unrecognised name is not a wake edge either.
    assert.equal(deriveDisplayAction(MACHINE_STATE.IDLE, 'teleporting'), DISPLAY_ACTION.NONE);
});

// --- THE NARROWING, walked in the direction the corrected test above does not ----
//
// The correction above walks IDLE -> X. The old module keyed its restore on the CURRENT
// state alone, so it also fired on X -> idle and X -> error, from any state at all: the end
// of every shot lit the panel. That is a behaviour change and not a generalisation, so it
// gets its own assertions rather than living in the module's prose.

test('a transition INTO idle or error from an AWAKE state restores nothing', () => {
    for (const previous of AWAKE_STATES) {
        assert.equal(
            deriveDisplayAction(previous, MACHINE_STATE.IDLE), DISPLAY_ACTION.NONE,
            `${previous} -> idle is not a wake edge — restoring would overwrite the user's brightness`,
        );
        assert.equal(
            deriveDisplayAction(previous, MACHINE_STATE.ERROR), DISPLAY_ACTION.NONE,
            `${previous} -> error is not a wake edge either`,
        );
    }
});

test('but sleep -> idle and sleep -> error DO restore — the two the old list carried', () => {
    // The narrowing must not take the original allow-list's own two cases with it: these are
    // the assertions the old suite made, and they are the reaprime#519 release path.
    assert.equal(deriveDisplayAction(MACHINE_STATE.SLEEPING, MACHINE_STATE.IDLE), DISPLAY_ACTION.RESTORE);
    assert.equal(deriveDisplayAction(MACHINE_STATE.SLEEPING, MACHINE_STATE.ERROR), DISPLAY_ACTION.RESTORE);
});

test('a mid-session feed hiccup while AWAKE touches nothing in either direction', () => {
    // We never dimmed, so there is nothing to release — and restoring here would override a
    // brightness the user had just chosen. This is why the boot rescue keys on "no frame has
    // ever arrived" rather than on "the previous state was absent".
    const gone = noReading(ABSENCE.NO_SOURCE);
    assert.equal(deriveDisplayAction(MACHINE_STATE.IDLE, gone), DISPLAY_ACTION.NONE);
    assert.equal(deriveDisplayAction(gone, MACHINE_STATE.IDLE), DISPLAY_ACTION.NONE);
    assert.equal(deriveDisplayAction(gone, gone), DISPLAY_ACTION.NONE);
});

test('the first frame after boot dims if the machine is already asleep', () => {
    assert.equal(deriveDisplayAction(undefined, MACHINE_STATE.SLEEPING), DISPLAY_ACTION.DIM);
});

test('the dark-tablet rescue: the first frame of a session restores an awake machine', () => {
    // The app died while the saver had the panel at 0. ReaPrime persists no brightness, so
    // if the skin does not light the panel on the first frame the tablet boots black with
    // the only recovery control invisible.
    for (const first of [undefined, null]) {
        assert.equal(deriveDisplayAction(first, MACHINE_STATE.IDLE), DISPLAY_ACTION.RESTORE);
        assert.equal(deriveDisplayAction(first, MACHINE_STATE.HEATING), DISPLAY_ACTION.RESTORE);
        // Nothing readable yet is not an awake machine: with no state at all we do not touch
        // the panel.
        assert.equal(deriveDisplayAction(first, noReading(ABSENCE.NO_SOURCE)), DISPLAY_ACTION.NONE);
    }
});

test('the boot rescue fires on a state name this build does not know', () => {
    // The rescue asks whether a frame carried a state, NOT whether the enum knows the name it
    // carried. That leniency is deliberate and this pins it: an enum that goes stale against a
    // newer ReaPrime must not be the reason a tablet boots black. It is the same side of the
    // line `isMachineAsleep` puts an unrecognised name on — a machine doing something.
    assert.equal(isMachineState('teleporting'), false, 'the premise: the generated enum has no such state');
    assert.equal(deriveDisplayAction(undefined, 'teleporting'), DISPLAY_ACTION.RESTORE);
    assert.equal(deriveDisplayAction(null, 'teleporting'), DISPLAY_ACTION.RESTORE);
    // An empty string is not a state that was reported; nor is an absence (asserted above).
    assert.equal(deriveDisplayAction(undefined, ''), DISPLAY_ACTION.NONE);
});

test('the display action vocabulary is paint-only too', () => {
    const allowed = new Set(Object.values(DISPLAY_ACTION));
    for (const previous of [...MACHINE_STATES, ...ABSENT_STATES]) {
        for (const current of [...MACHINE_STATES, ...ABSENT_STATES]) {
            const action = deriveDisplayAction(previous, current);
            assert.ok(allowed.has(action), `${String(previous)} -> ${String(current)} = ${action}`);
        }
    }
});

// --- the module imports nothing it does not use ---------------------------------
//
// This module shipped importing `isMachineState` and never calling it, which read as an
// unfinished intention: the one guard it plausibly belonged to (`stateReported`) deliberately
// does NOT use it, and the import made the module look like it disagreed with its own
// docblock. Nothing caught it — Gate C has no unused-import guard, and adding one across 199
// files is a different change from this one. This is the check at the scope of the defect.

test('every named import is actually used — a dead import is an unfinished intention', () => {
    const code = stripComments(readFileSync(MODULE_PATH, 'utf8'), { dropStrings: true });
    const imports = [...code.matchAll(/import\s*\{([^}]*)\}\s*from\s*[^;]+;/g)];
    assert.ok(imports.length > 0, 'the scan found no import statement to check');
    const body = code.replace(/import\s*\{[^}]*\}\s*from\s*[^;]+;/g, '');
    for (const statement of imports) {
        for (const raw of statement[1].split(',')) {
            const name = raw.trim().split(/\s+as\s+/).pop().trim();
            if (!name) continue;
            assert.match(body, new RegExp(`\\b${name}\\b`), `${name} is imported and never used`);
        }
    }
});

// --- D10: fully black, one owner ------------------------------------------------

describe('D10 — the saver is black and the skin owns blanking', () => {
    test('the blank level is 0', () => {
        assert.equal(SCREENSAVER_BRIGHTNESS, 0);
    });

    test('the blank level satisfies the display handler, which fails silently otherwise', () => {
        // `display_handler.dart` takes an int 0..100 and drops anything else with a log line
        // and no reply — no error envelope, nothing on the wire. The check lives beside the
        // handler reference in rea-ws-channels.js; this asserts the constant passes it.
        assert.equal(
            WS_CHANNELS.display.validateCommand({
                command: 'setBrightness', brightness: SCREENSAVER_BRIGHTNESS,
            }),
            null,
        );
        // The guard is not vacuous: the old skin's non-black default was 10, and a float or
        // a string would have been dropped in silence.
        assert.equal(
            WS_CHANNELS.display.validateCommand({ command: 'setBrightness', brightness: 0.0 + 0.5 }),
            'setBrightness needs an integer 0..100 (display_handler drops anything else silently)',
        );
    });
});

/* ===========================================================================
 * SWITCHING IT OFF WHILE IT IS UP — found 24 Aug 2026, driving the settings pages
 * against a machine that was asleep at the time.
 * =========================================================================== */

describe('the feature switch works in BOTH directions', () => {
    test('switched off while the blank is up takes it down', () => {
        /* The branch read `(enabled && !active) ? SHOW : NONE`, and NONE means "leave the
         * paint alone" — so the switch could stop the NEXT blank and never the one on
         * screen. A person switching a thing off while looking at it is owed the thing
         * going away. */
        assert.equal(deriveScreensaverAction({
            machineState: MACHINE_STATE.SLEEPING,
            screensaverActive: true,
            screensaverEnabled: false,
        }), SCREENSAVER_ACTION.HIDE);
    });

    test('switched off while it is DOWN asks for nothing', () => {
        assert.equal(deriveScreensaverAction({
            machineState: MACHINE_STATE.SLEEPING,
            screensaverActive: false,
            screensaverEnabled: false,
        }), SCREENSAVER_ACTION.NONE);
    });

    test('and switched ON over a sleeping machine still raises it', () => {
        assert.equal(deriveScreensaverAction({
            machineState: MACHINE_STATE.SLEEPING,
            screensaverActive: false,
            screensaverEnabled: true,
        }), SCREENSAVER_ACTION.SHOW);
        /* Already up and still wanted: nothing to do, and NOT a second raise. */
        assert.equal(deriveScreensaverAction({
            machineState: MACHINE_STATE.SLEEPING,
            screensaverActive: true,
            screensaverEnabled: true,
        }), SCREENSAVER_ACTION.NONE);
    });

    test('a HIDE is a paint and never a command — the whole file’s rule, at this branch', () => {
        /* `SCREENSAVER_ACTION` has no member that carries a machine command, which is
         * what makes this assertion structural rather than hopeful. */
        assert.deepEqual([...new Set(Object.values(SCREENSAVER_ACTION))].sort(),
            ['hide', 'none', 'show']);
    });
});
