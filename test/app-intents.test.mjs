/**
 * app-intents — what a screen's intent means to the shell.
 *
 * WHY THIS FILE EXISTS, in Ben's words on the glass, 23 Aug 2026: "many of the buttons
 * dont work. I cannot edit profiles or pick a new profile, go to settings etc." The
 * cause was not a broken handler; it was no handler at all. `live-screen.js` dispatches
 * six events, `live-wiring.js` listens to four, and the file's own contract block says
 * so plainly — "NOTHING under `src/` listens to the rest". The fullscreen control's note
 * even names the fix and declines it: "a shell listener is another surface's work".
 *
 * A control that looks live and is not is P-1's shape, and P-1 has now cost this project
 * twice. So the mapping is a pure function with a test, and the two branches that act on
 * it are three lines in `app-root.js`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    intentFor, HEADER_ACTION_ROUTES, HEADER_ACTION_MACHINE, INTENT_EVENTS,
} from '../src/lib/app-intents.js';
import { ROUTES } from '../src/lib/app-routes.js';

test('the header\'s two words go to the two screens they name', () => {
    /* EDIT IS A DIFFERENT KIND, and the blank editor is why. That screen "takes what it
     * is given and never builds one" — the record has to be seated in the shell's editor
     * store BEFORE the route, because a route swap destroys the outgoing screen. Routing
     * there with nothing seated mounts the whole structure around no profile, which is
     * what Ben saw on the glass. */
    /* `profileId: null` MEANS "the one the machine is running", and it is a field rather
     * than an absence because a SECOND caller now sends this action with an id: the
     * favourites strip's press-and-hold menu edits the profile in the SLOT, which is not
     * normally the loaded one. A null here and an id there are the same shape of answer. */
    assert.deepEqual(intentFor('header-action', { action: 'Edit profile' }),
        { kind: 'edit', route: 'editor', profileId: null });
    assert.deepEqual(intentFor('header-action', { action: 'Settings' }),
        { kind: 'route', route: 'settings' });
});

test('an Edit intent may NAME the profile, and then that is the one', () => {
    assert.deepEqual(intentFor('header-action', { action: 'Edit profile', profileId: 'prof-9' }),
        { kind: 'edit', route: 'editor', profileId: 'prof-9' });
    /* An empty string is not an id. Falling through to "the loaded one" is the right
     * answer for a caller that had nothing to name. */
    assert.deepEqual(intentFor('header-action', { action: 'Edit profile', profileId: '' }),
        { kind: 'edit', route: 'editor', profileId: null });
});

test('a favourite carries the profile to arm', () => {
    assert.deepEqual(intentFor('favourite-select', { value: 'prof-7' }),
        { kind: 'arm', profileId: 'prof-7' });
});

test('an EMPTY favourite slot arms nothing', () => {
    /* `favouriteEntries()` emits null for an unassigned slot, so the value can be null
     * or absent. Arming "null" would be a request the machine has to refuse. */
    assert.equal(intentFor('favourite-select', { value: null }), null);
    assert.equal(intentFor('favourite-select', {}), null);
    assert.equal(intentFor('favourite-select', null), null);
});

test('an action the shell has not been taught is SILENT, not an error', () => {
    /* Sleep and Full screen were removed from the header in the same ruling that asked for
     * this wiring, and the rule was: "If either comes back, it must sit inert until someone
     * decides where it goes — never navigate somewhere arbitrary."
     *
     * SLEEP CAME BACK AND SOMEONE DECIDED. Ben, 25 August 2026: "I think I have changed my
     * mind and please add a sleep button on the top right, to the right of settings." Where
     * it goes is nowhere — it is not a route — so it is in the OTHER table, and the next
     * test is what says so. Full screen is still undecided and still inert. */
    assert.equal(intentFor('header-action', { action: 'Full screen' }), null);
    assert.equal(intentFor('header-action', {}), null);
    assert.equal(intentFor('header-action', null), null);
});

test('Sleep is a machine command, not a route', () => {
    /* THE TWO TABLES ARE DISJOINT AND THE INTENT SAYS WHICH ONE ANSWERED. A route table
     * asked to hold a machine command would have to answer "which screen is sleeping",
     * which has no answer.
     *
     * WHAT IT DOES NOT CARRY IS SLEEP-VERSUS-WAKE. `deriveSleepButtonAction` decides that
     * from the machine's confirmed state, and it exists because of a real bug: one tap on
     * the old sleep button slept the machine and woke it again 46 ms later. The intent
     * names the ACTION; the shell asks the policy what command it means. */
    assert.deepEqual(intentFor('header-action', { action: 'Sleep' }),
        { kind: 'machine', command: 'sleep' });
    assert.equal(HEADER_ACTION_ROUTES.Sleep, undefined,
        'Sleep must not also be a route — a name in both tables is a bug a reader cannot see');
    for (const name of Object.keys(HEADER_ACTION_MACHINE)) {
        assert.equal(HEADER_ACTION_ROUTES[name], undefined, `${name} is in both tables`);
    }
});

test('an event that is not an intent is not one', () => {
    /* `target-change` already has an owner in live-wiring.js (P-1's fix) and
     * `stop-request` is the machine's. Two owners of one event is L11's shape. */
    for (const type of ['target-change', 'stop-request', 'warmer-toggle', 'click']) {
        assert.equal(intentFor(type, { action: 'Settings', value: 'x' }), null,
            `${type} was treated as a shell intent — it has an owner already`);
    }
});

test('the listener list and the mapping agree', () => {
    /* The shell adds and removes exactly INTENT_EVENTS. An event in the mapping but not
     * in the list is a button that never fires; one in the list but not the mapping is a
     * listener that can only ever do nothing. */
    const answered = INTENT_EVENTS.filter((type) => intentFor(type, { action: 'Settings', value: 'p' }));
    assert.deepEqual([...answered].sort(), [...INTENT_EVENTS].sort(),
        'an event is listened for that the mapping cannot answer');
});
