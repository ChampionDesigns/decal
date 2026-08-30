/**
 * app-intents.js — what a screen's INTENT means to the shell.
 *
 * THE GAP THIS CLOSES, in the words the screen itself used. `live-screen.js` dispatches
 * six events and `live-wiring.js` listens to four; the file's own contract block says so
 * plainly — "NOTHING under `src/` listens to the rest. So a favourite selected, Sleep
 * pressed and a stop requested are local state or nothing at all" — and the fullscreen
 * control's note calls the missing listener "one finding about four buttons rather than
 * a new one about this one … NOT fixed here, because a shell listener is another
 * surface's work". This is that surface. Ben, 23 Aug 2026, on the glass: "many of the
 * buttons dont work. I cannot edit profiles or pick a new profile, go to settings etc."
 * A control that looks live and is not is P-1's shape, and P-1 is the bug this project
 * has now paid for twice.
 *
 * WHY THE SHELL AND NOT THE SCREEN. Two of the three intents are ROUTE CHANGES, and the
 * route is the shell's own noun: `app-root` owns `goto()`, owns the address, and owns
 * the `hashchange` listener that is the single path a route change travels. A screen
 * that navigated itself would be a second owner of the address — S10's shape, in the
 * file that exists to prevent it. The third intent needs `boot.library`, which the shell
 * also holds and hands down.
 *
 * WHY A SEPARATE FILE. `src/lib/` is "plain ES modules with no DOM access" (SCOPE Part 2
 * §2), so the whole mapping is string-in / object-out and runs under `node:test`. What
 * is left in `app-root.js` is three `addEventListener` calls and a two-branch switch on
 * the answer — small enough to read, and with nothing in it worth a test of its own.
 *
 * THE FIELD IS `route` AND NOT `routeId`, WHICH IS NOT COSMETIC. Gate D scans the
 * client for `routeId: '<id>'` because that is how the generated REST client addresses
 * a tabled route, and it correctly refused this file when the app's route names wore
 * the same spelling: "route id 'selector' is addressed here and has no entry in
 * src/data/CONTRACTS.json". Two namespaces, one word. Renaming the app-route field
 * keeps Gate D's scan exact instead of teaching it an exception, which is the allowlist
 * mistake its own header warns about.
 *
 * `navigate` IS DELIBERATELY NOT HERE, AND IT COST AN HOUR TO LEARN WHY. Five screens
 * dispatch it and a grep for a listener under src/ finds none — so it looks exactly like
 * the silence this file exists to end. It is not: `app-root` has always handled it, as a
 * TEMPLATE BINDING (`@navigate=` on the mounted screen) rather than an
 * `addEventListener`, which no search for the quoted event name can see. Adding it here
 * made every navigation fire twice, and the second `back()` walked off the end of the
 * history stack and out of the document — caught by history-route's own suite, which
 * went from 16 passing to 4 failing.
 *
 * SO: A TEMPLATE BINDING IS A LISTENER. Before concluding that an event has no owner,
 * grep for `@<name>=` as well as for the quoted string.
 *
 * WHAT IS DELIBERATELY NOT HERE. `stop-request` and `target-change` are not intents for
 * the shell: the first is the machine's, the second already has an owner in
 * `live-wiring.js` (P-1's fix). `Sleep` and `Full screen` have no row because Ben
 * removed both controls in the same message — see `ACTIONS` in `live-screen.js`. An
 * action with no row answers `null`, which is "the shell has no opinion", not an error:
 * a control this file has not been taught about must stay silent rather than navigate
 * somewhere arbitrary.
 */

/**
 * The header's words, and where each one goes. The KEY IS THE ACTION NAME the button
 * carries in `data-action`, which is the untranslated English string — `t()` is applied
 * to what is DRAWN, never to what is dispatched, so this table cannot break when a
 * second language lands (D2).
 */
export const HEADER_ACTION_ROUTES = Object.freeze({
    'Edit profile': 'editor',
    Settings: 'settings',
});

/**
 * THE HEADER ACTIONS THAT COMMAND THE MACHINE RATHER THAN CHANGING THE ROUTE.
 *
 * Ben, 25 August 2026: "I think I have changed my mind and please add a sleep button on
 * the top right, to the right of settings." He removed it on 23 August; the removal is
 * recorded in `key-bindings.js` ("Sleep has no button on this skin's Live screen — Ben
 * removed it on 23 Aug") and this is the reversal.
 *
 * IT IS A DIFFERENT KIND OF ACTION FROM THE OTHER TWO and the table says so rather than
 * the handler branching on a name. Edit profile and Settings go somewhere; Sleep does
 * something. A route table asked to hold a machine command would have to answer "which
 * screen is sleeping", which has no answer.
 *
 * WHAT IT DOES NOT DECIDE IS SLEEP-VERSUS-WAKE. `screensaver-policy.js`'s
 * `deriveSleepButtonAction` owns that, and it owns it because of a real bug: "one tap on
 * the sleep button slept the machine and woke it again 46 ms later". This table names the
 * ACTION; the shell asks the policy what command that action means for the machine's
 * current state.
 */
export const HEADER_ACTION_MACHINE = Object.freeze({
    Sleep: 'sleep',
});

/** The one header action that has to seat a record before it routes. */
export const EDIT_ACTION = 'Edit profile';

/** The events the shell listens for. One place, so the add/remove pair cannot drift. */
export const INTENT_EVENTS = Object.freeze(['header-action', 'library-open', 'favourite-select']);

/**
 * An intent event, as the shell should act on it.
 *
 * Returns `null` for anything this file has not been taught — an unknown action name, a
 * favourite slot with no profile in it, an event type that is not an intent. Null is the
 * answer, not an exception: the caller's job is to do nothing.
 *
 * @param {string} type    the event's `type`
 * @param {object|null} detail  the event's `detail`
 * @returns {{kind: 'route', route: string, invoker?: string|null}
 *          | {kind: 'edit', route: string}
 *          | {kind: 'back'}
 *          | {kind: 'arm', profileId: string}
 *          | null}
 */
export function intentFor(type, detail = null) {
    switch (type) {
        case 'header-action': {
            /* EDIT IS NOT A PLAIN ROUTE, and the blank editor is what proves it. The
             * editor screen "takes what it is given and never builds one" — it reads a
             * record the SELECTOR seated in `boot.profileEditor` before asking for the
             * route, because a route swap destroys the outgoing screen and anything it
             * was holding. Routing there from the Live band with nothing seated mounts
             * the whole structure around no profile, which is exactly what Ben saw. */
            /* A PROFILE ID MAY RIDE ALONG, and then it names which profile to edit. The
             * band's own Edit button carries none and means "the one the machine is
             * running"; a favourite's hold menu carries the slot's profile, which is not
             * the loaded one and must not be resolved as if it were. */
            if (detail?.action === EDIT_ACTION) {
                return {
                    kind: 'edit',
                    route: 'editor',
                    profileId: typeof detail.profileId === 'string' && detail.profileId
                        ? detail.profileId : null,
                };
            }
            /* A MACHINE ACTION IS ANSWERED BEFORE A ROUTE, because the two tables are
             * disjoint and a name in both would be a bug the reader could not see. */
            const command = HEADER_ACTION_MACHINE[detail?.action];
            if (command) return { kind: 'machine', command };
            const route = HEADER_ACTION_ROUTES[detail?.action];
            return route ? { kind: 'route', route } : null;
        }
        /* The library IS the profile picker — "pick a new profile" in Ben's words, and
         * `selector` in the route table's. */
        case 'library-open':
            return { kind: 'route', route: 'selector' };
        /* A favourite slot carries the PROFILE ID (`favouriteEntries()` in
         * profile-library-store.js emits `{value: id, name}`), and an empty slot is
         * `null` — which is why the guard is on the value and not on the slot. */
        case 'favourite-select': {
            const profileId = detail?.value;
            return profileId ? { kind: 'arm', profileId: String(profileId) } : null;
        }
        default:
            return null;
    }
}
