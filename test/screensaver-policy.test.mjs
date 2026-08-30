
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
        assert.equal(typeof MACHINE_STATE.SLEEPING, 'string');
        assert.ok(isMachineState(MACHINE_STATE.SLEEPING));
    });

    test('both sleep-button commands are states ReaPrime accepts', () => {
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
    assert.equal(
        deriveScreensaverAction({
            machineState: MACHINE_STATE.SLEEPING, screensaverActive: false, screensaverEnabled: false,
        }),
        SCREENSAVER_ACTION.NONE,
    );
});

test('THE BUG: an awake machine with the overlay up -> HIDE (a paint), not a wake', () => {
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

test('THE WAKE FLICKER: a stale "sleeping" frame does NOT re-raise the overlay we just hid', () => {
    assert.equal(
        deriveScreensaverAction({
            machineState: MACHINE_STATE.SLEEPING, screensaverActive: false, wakePending: true,
        }),
        SCREENSAVER_ACTION.NONE,
    );
});

test('and WITHOUT a wake in flight that very same frame still raises it', () => {
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
    const action = deriveSleepButtonAction({ machineState: MACHINE_STATE.IDLE, screensaverActive: false });
    assert.equal(action.command, MACHINE_STATE.SLEEPING);
    assert.ok(!('showScreensaver' in action), 'the button has no optimistic-show outcome at all');
});

test('sleep button on a SLEEPING machine: one wake, and the overlay comes down', () => {
    const action = deriveSleepButtonAction({ machineState: MACHINE_STATE.SLEEPING, screensaverActive: true });
    assert.deepEqual({ ...action }, { command: MACHINE_STATE.IDLE, hideScreensaver: true });
});

test('sleep button on a SLEEPING machine with no overlay up: still exactly one wake', () => {
    const action = deriveSleepButtonAction({ machineState: MACHINE_STATE.SLEEPING, screensaverActive: false });
    assert.deepEqual({ ...action }, { command: MACHINE_STATE.IDLE, hideScreensaver: false });
});

test('INVARIANT: only a machine that is genuinely ASLEEP may derive a wake', () => {
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

test('a machine that drops off BLE while asleep releases the dim', () => {
    assert.equal(deriveDisplayAction(MACHINE_STATE.IDLE, MACHINE_STATE.SLEEPING), DISPLAY_ACTION.DIM);
    assert.equal(deriveDisplayAction(MACHINE_STATE.SLEEPING, MACHINE_STATE.ERROR), DISPLAY_ACTION.RESTORE);
});

// --- CORRECTED (2): the no-dead-end claim, asserted over the whole enum ---------

test('EVERY state that can follow a dim restores it — no dead end, over all 21', () => {
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
    for (const gone of ABSENT_STATES) {
        assert.equal(
            deriveDisplayAction(MACHINE_STATE.SLEEPING, gone),
            DISPLAY_ACTION.RESTORE,
            `a machine that went ${String(gone?.reason ?? gone)} while asleep must not stay dark`,
        );
    }
});

test('the display action is transition-only — a repeated state does nothing', () => {
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
    assert.equal(deriveDisplayAction(MACHINE_STATE.SLEEPING, MACHINE_STATE.IDLE), DISPLAY_ACTION.RESTORE);
    assert.equal(deriveDisplayAction(MACHINE_STATE.SLEEPING, MACHINE_STATE.ERROR), DISPLAY_ACTION.RESTORE);
});

test('a mid-session feed hiccup while AWAKE touches nothing in either direction', () => {
    const gone = noReading(ABSENCE.NO_SOURCE);
    assert.equal(deriveDisplayAction(MACHINE_STATE.IDLE, gone), DISPLAY_ACTION.NONE);
    assert.equal(deriveDisplayAction(gone, MACHINE_STATE.IDLE), DISPLAY_ACTION.NONE);
    assert.equal(deriveDisplayAction(gone, gone), DISPLAY_ACTION.NONE);
});

test('the first frame after boot dims if the machine is already asleep', () => {
    assert.equal(deriveDisplayAction(undefined, MACHINE_STATE.SLEEPING), DISPLAY_ACTION.DIM);
});

test('the dark-tablet rescue: the first frame of a session restores an awake machine', () => {
    for (const first of [undefined, null]) {
        assert.equal(deriveDisplayAction(first, MACHINE_STATE.IDLE), DISPLAY_ACTION.RESTORE);
        assert.equal(deriveDisplayAction(first, MACHINE_STATE.HEATING), DISPLAY_ACTION.RESTORE);
        assert.equal(deriveDisplayAction(first, noReading(ABSENCE.NO_SOURCE)), DISPLAY_ACTION.NONE);
    }
});

test('the boot rescue fires on a state name this build does not know', () => {
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
        assert.equal(
            WS_CHANNELS.display.validateCommand({
                command: 'setBrightness', brightness: SCREENSAVER_BRIGHTNESS,
            }),
            null,
        );
        assert.equal(
            WS_CHANNELS.display.validateCommand({ command: 'setBrightness', brightness: 0.0 + 0.5 }),
            'setBrightness needs an integer 0..100 (display_handler drops anything else silently)',
        );
    });
});

describe('the feature switch works in BOTH directions', () => {
    test('switched off while the blank is up takes it down', () => {
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
