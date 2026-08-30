

import { MACHINE_STATE } from '../data/machine-state.js';

export const SCREENSAVER_BRIGHTNESS = 0;

/** What the overlay should do. Paint only — there is no command in this vocabulary. */
export const SCREENSAVER_ACTION = Object.freeze({
    SHOW: 'show',
    HIDE: 'hide',
    NONE: 'none',
});

/** What the panel brightness should do. Also paint only. */
export const DISPLAY_ACTION = Object.freeze({
    DIM: 'dim',
    RESTORE: 'restore',
    NONE: 'none',
});

export function isMachineAsleep(machineState) {
    return machineState === MACHINE_STATE.SLEEPING;
}

function stateReported(machineState) {
    return typeof machineState === 'string' && machineState !== '';
}

export const WAKE_CONFIRM_GRACE_MS = 3000;

export function isWakePending(wakeRequestedAt, now = Date.now(), graceMs = WAKE_CONFIRM_GRACE_MS) {
    if (!wakeRequestedAt) return false;
    return (now - wakeRequestedAt) < graceMs;
}

export function deriveScreensaverAction({
    machineState,
    screensaverActive = false,
    screensaverEnabled = true,
    wakePending = false,
} = {}) {
    if (isMachineAsleep(machineState)) {
        if (wakePending) return SCREENSAVER_ACTION.NONE;

        if (!screensaverEnabled) {
            return screensaverActive ? SCREENSAVER_ACTION.HIDE : SCREENSAVER_ACTION.NONE;
        }

        // Only raise it if it is not already up.
        return screensaverActive ? SCREENSAVER_ACTION.NONE : SCREENSAVER_ACTION.SHOW;
    }

    return screensaverActive ? SCREENSAVER_ACTION.HIDE : SCREENSAVER_ACTION.NONE;
}

export function deriveSleepButtonAction({ machineState, screensaverActive = false } = {}) {
    if (isMachineAsleep(machineState)) {
        return Object.freeze({ command: MACHINE_STATE.IDLE, hideScreensaver: screensaverActive });
    }
    return Object.freeze({ command: MACHINE_STATE.SLEEPING, hideScreensaver: false });
}

export function deriveDisplayAction(previousState, currentState) {
    const wasAsleep = isMachineAsleep(previousState);
    const isAsleep = isMachineAsleep(currentState);

    if (isAsleep) return wasAsleep ? DISPLAY_ACTION.NONE : DISPLAY_ACTION.DIM;
    if (wasAsleep) return DISPLAY_ACTION.RESTORE;

    if (previousState === undefined || previousState === null) {
        return stateReported(currentState) ? DISPLAY_ACTION.RESTORE : DISPLAY_ACTION.NONE;
    }

    return DISPLAY_ACTION.NONE;
}
