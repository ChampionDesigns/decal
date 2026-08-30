// ARMING A PROFILE, AND THE REFUSAL THAT COMES BACK — B9's v1 half.
//
// ITEM `live-refusal-surface`. SCOPE.md:1861-1868, verbatim: "Surface a profile refusal
// unconditionally (B9/R7), in two decided steps: **v1 builds the refusal surface and wires
// it to every refusal ReaPrime can already report** — the arm-time 400 (`Unsupported
// profile`) exists today and needs zero upstream work … Live is where the user is
// standing; this is the register's 'worst failure shape' — a shot that silently isn't
// running the profile you picked."
//
// ============================================================================
// UNCONDITIONAL. THE WORD IS THE SPECIFICATION.
// ============================================================================
//
// There is no capability check in this file, and there must never be one. The temptation
// is precise and named: `capabilities.profileModes()` can say which advanced pump modes
// the machine offers, so a "clever" arm path would pre-filter and refuse locally without
// asking. Both the store and the scope forbid it — "R3: which advanced pump modes may the
// UI OFFER? A HINT. The authority is ReaPrime's arm-time refusal (B9) — surface that
// message intact rather than pre-filtering the profile list on this answer"
// (`capabilities-store.js` `profileModes`), and "the bitmask is a UI-offer hint only; the
// authority is ReaPrime's arm-time refusal (400 `Unsupported profile`), which the skin
// must surface (B9) and today cannot see" (SCOPE.md:1156).
//
// A local pre-filter has two failure modes and both are the worst failure shape: it hides
// a refusal the server WOULD have made (so the surface never fires and the user believes
// the profile is loaded), or it invents one the server would not have made. So: always
// send, always read the answer, always publish it. `test/live-connection-gates.test.mjs`
// asserts this module's source contains no capability read at all.
//
// ============================================================================
// THE TRIGGER, WHICH LANDED IN WAVE 5.3
// ============================================================================
//
// `src/stores/profile-library-store.js` `arm()` CALLS THIS STORE — one line,
// `arm.arm(record.profile, {profileId})`, exactly as the note that used to stand here said
// it would ("the profile-library row that owns picking a profile is the one that closes
// it"). So B9 is now reachable end to end from the shipping app: pick a profile in the
// selector, press Confirm, and a typed 400 renders at the point of picking.
//
// IT IS THE ONLY CALLER IN `src/`, AND THAT IS PINNED. The profile BODY belongs to the
// store that owns the listing — a second call site would be a second place deciding what
// gets sent, which is the row gate `shape-asymmetry` waiting to happen. The READ side is
// unchanged and still wired end to end: `LiveWiring` exposes `refusal`, `<live-refusal>`
// renders it, the dismiss reaches `clear()`.
//
// WHAT IS STILL NOT A TRIGGER, said plainly so the old gap is not read as closed twice:
// `<live-screen>` dispatches `favourite-select` on a favourite tap and no listener for it
// exists, and `favourites` is never populated by anything in `src/`. B9 is reachable from
// the SELECTOR, not from Live.
//
// THE PIN MOVED WITH THE FACT. `test/live-connection-gates.test.mjs` ("B9's trigger") used
// to assert that five named files did NOT arm, and it went on passing when the trigger
// landed in a sixth — a hardcoded deny-list cannot notice a new file. It now walks `src/`,
// asserts this store has exactly one caller, and fails if that caller disappears.
//
// ============================================================================
// THE ROUTE, AS WRITTEN AT THE PIN 2b047d02
// ============================================================================
//
// Contract row `postMachineProfile`: POST /api/v1/machine/profile ->
// `De1Handler._profileHandler` (`lib/src/services/webserver/de1handler.dart`).
//   200 body null                                    armed
//   400 {error:'Unsupported profile', message}       the arm-time CAPABILITY refusal
//   400 {error:'Invalid profile', message}           a parse failure
//   500                                              any other fault
// Row gate `arm-time-refusal`: "setProfile is called OUTSIDE runDeviceWrite specifically
// so a ProfileModeUnsupportedException maps to a clean 400 instead of the catch-all 500;
// the machine cannot run a Power or Lever step, or a HOLD transition."
// Row gate `shape-asymmetry`: "this route takes the BARE profile; POST /profiles takes it
// WRAPPED in {profile:…}" — which is why the body goes through `profileArmBody()` and is
// not assembled here.
//
// NOTHING IN THIS FILE WORDS A REFUSAL. `profileRefusal()` (`src/data/rea-profile.js`)
// reads `{kind, error, message}` out of the failure and its own header says "Neither is
// worded here"; the alert banner "takes a message, it does not know the message"
// (SCOPE.md:1530). The server's sentence reaches the screen intact, which is the only way
// R7's machine-side refusal can later ride the same surface without a second vocabulary.

import { callRoute } from '../data/rea-routes.js';
import { profileArmBody, profileRefusal } from '../data/rea-profile.js';
import { createStore } from './store.js';

/** Where an arm attempt got to. */
export const ARM_STATUS = Object.freeze({
    IDLE: 'idle',
    ARMING: 'arming',
    /** 200. The machine is running what the user picked. */
    ARMED: 'armed',
    /** A typed 400. `refusal` carries the server's own `{kind, error, message}`. */
    REFUSED: 'refused',
    /** Anything else — a 500, a timeout, a network failure. Not a refusal. */
    FAILED: 'failed',
});

const EMPTY_STATE = Object.freeze({
    status: ARM_STATUS.IDLE,
    /** `{kind: 'unsupported'|'invalid', error, message}` from `profileRefusal`, or null. */
    refusal: null,
    /** The transport failure for a non-400 fault, verbatim. Never a refusal. */
    error: null,
    /** Which profile the state is about, when the caller named one. */
    profileId: null,
    at: null,
});

/**
 * @param {object} deps
 * @param {object} deps.transport  createReaTransport(...)
 * @param {object} [deps.logger]
 * @param {() => number} [deps.now]
 */
export function createProfileArmStore({ transport, logger = null, now = () => Date.now() } = {}) {
    if (!transport || typeof transport.request !== 'function') {
        throw new Error('createProfileArmStore: a transport must be injected (see createReaTransport)');
    }
    const log = logger && logger.scope ? logger.scope('arm') : logger;
    const store = createStore({ ...EMPTY_STATE }, { label: 'profileArm', logger: log });
    const publish = (next) => store.set(next);

    return {
        subscribe(listener) { return store.subscribe(listener); },
        get() { return store.get(); },
        /** The refusal to surface, or null. The one thing `<live-refusal>` reads. */
        refusal() { return store.get().refusal; },

        /**
         * Send the profile to the machine and publish whatever comes back.
         *
         * @param {object} profile   a ReaPrime profile object
         * @param {object} [options]
         * @param {string|null} [options.profileId]  for the state only; not sent
         * @returns {Promise<object>} the published state
         */
        async arm(profile, { profileId = null } = {}) {
            publish({ ...EMPTY_STATE, status: ARM_STATUS.ARMING, profileId, at: now() });

            const result = await callRoute(transport, 'postMachineProfile', {
                body: profileArmBody(profile),
            });

            if (result.ok) {
                return publish({ ...EMPTY_STATE, status: ARM_STATUS.ARMED, profileId, at: now() });
            }

            const refusal = profileRefusal(result);
            if (refusal) {
                // NOT logged as an error: a refusal is the server working correctly. It is
                // published, and the screen shows it.
                if (log && log.info) log.info(`profile refused: ${refusal.error}`);
                return publish({
                    ...EMPTY_STATE, status: ARM_STATUS.REFUSED, refusal, profileId, at: now(),
                });
            }

            if (log && log.warn) log.warn(`arming failed: ${result.message}`);
            return publish({
                ...EMPTY_STATE, status: ARM_STATUS.FAILED, error: result, profileId, at: now(),
            });
        },

        /**
         * Clear the surface — the user acknowledged it, or picked something else.
         *
         * A refusal is not cleared by a later frame arriving, on purpose: the machine goes
         * on publishing snapshots while running the profile it kept, so a state that
         * dismissed itself on the next frame would flash the worst failure shape for 66ms
         * and then hide it.
         */
        clear() { return publish({ ...EMPTY_STATE }); },

        stop() { store.destroy(); },
    };
}
