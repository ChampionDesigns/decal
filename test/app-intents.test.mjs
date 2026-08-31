/**
 * App-intents — what a screen's intent means to the shell.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    intentFor, HEADER_ACTION_ROUTES, HEADER_ACTION_MACHINE, INTENT_EVENTS,
} from '../src/lib/app-intents.js';
import { ROUTES } from '../src/lib/app-routes.js';

test('the header\'s two words go to the two screens they name', () => {

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
    assert.equal(intentFor('header-action', { action: 'Full screen' }), null);
    assert.equal(intentFor('header-action', {}), null);
    assert.equal(intentFor('header-action', null), null);
});

test('Sleep is a machine command, not a route', () => {
    assert.deepEqual(intentFor('header-action', { action: 'Sleep' }),
        { kind: 'machine', command: 'sleep' });
    assert.equal(HEADER_ACTION_ROUTES.Sleep, undefined,
        'Sleep must not also be a route — a name in both tables is a bug a reader cannot see');
    for (const name of Object.keys(HEADER_ACTION_MACHINE)) {
        assert.equal(HEADER_ACTION_ROUTES[name], undefined, `${name} is in both tables`);
    }
});

test('an event that is not an intent is not one', () => {
    /* `target-change` already has an owner in live-wiring.js and
     * `stop-request` is the machine's. Two owners of one event is 's shape. */
    for (const type of ['target-change', 'stop-request', 'warmer-toggle', 'click']) {
        assert.equal(intentFor(type, { action: 'Settings', value: 'x' }), null,
            `${type} was treated as a shell intent — it has an owner already`);
    }
});

test('the listener list and the mapping agree', () => {
    const answered = INTENT_EVENTS.filter((type) => intentFor(type, { action: 'Settings', value: 'p' }));
    assert.deepEqual([...answered].sort(), [...INTENT_EVENTS].sort(),
        'an event is listened for that the mapping cannot answer');
});
