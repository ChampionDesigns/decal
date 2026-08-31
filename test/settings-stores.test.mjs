

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { createPresenceStore, SLEEP_TIMEOUT_RANGE, KEEP_AWAKE_RANGE } from '../src/stores/presence-store.js';
import {
    createPluginsStore, settingFields, secureState, unsupportedSettings, VISUALIZER_PLUGIN_ID,
} from '../src/stores/plugins-store.js';
import { createFeedbackStore, FEEDBACK_STATUS, FEEDBACK_REFUSAL, FEEDBACK_TYPES } from '../src/stores/feedback-store.js';
import { createDecentAccountStore, ACCOUNT_STATUS } from '../src/stores/decent-account-store.js';
import {
    createDecentSupportStore, SUPPORT_STATUS, SUPPORT_REFUSAL, SEND_STATUS,
} from '../src/stores/decent-support-store.js';
import { createScaleConnectStore, SCAN_STATUS, WRITE_OP } from '../src/stores/scale-connect-store.js';
import {
    BINDABLE_ACTIONS, DEFAULT_BINDINGS_BY_ACTION, resolveBindings, bindingsByAction,
    conflictFor, withBinding, normaliseKey, keyLabel, SPACE_KEY,
} from '../src/lib/key-bindings.js';
import { stateForKey } from '../src/lib/live-targets.js';
import { MACHINE_STATE } from '../src/data/machine-state.js';
import { reaSuccess, reaFailure } from '../src/data/rea-errors.js';

function transportOf(script) {
    const calls = [];
    return {
        calls,
        socketUrl: () => 'ws://test',
        url: (path) => `http://test${path}`,
        async request(path, { method = 'GET', body, query } = {}) {
            calls.push({ path, method, body, query });
            return script({ path, method, body, query, key: `${method} ${path}` });
        },
    };
}

const ok = (data, status = 200) => reaSuccess({ status, data, method: 'GET', url: 'test' });
const bad = (status, data = null) => reaFailure('http', {
    status, message: `test ${status}`, problem: data, method: 'GET', url: 'test',
});

describe('presence: one read serves both cards, and the handler clamps', () => {
    const SETTINGS = Object.freeze({
        userPresenceEnabled: true,
        sleepTimeoutMinutes: 30,
        keepAwakeUntil: null,
        schedules: [{ id: 'a', time: '05:30', daysOfWeek: [], enabled: true, keepAwakeFor: 60 }],
    });

    test('the settings read carries the schedules, so the schedules route is never called', async () => {
        const transport = transportOf(({ key }) => (
            key === 'GET /presence/settings' ? ok({ ...SETTINGS }) : bad(500)));
        const store = createPresenceStore({ transport });
        await store.load();
        const state = store.get();
        assert.equal(state.presenceEnabled, true);
        assert.equal(state.sleepTimeoutMinutes, 30);
        assert.equal(state.schedules.length, 1);
        /* TWO READS FOR ONE ANSWER is two chances to show a schedule list that disagrees
         * with the switch above it. */
        assert.equal(transport.calls.filter((c) => c.path === '/presence/schedules').length, 0);
    });

    test('an unread value is null and never false — "not asked" is not "switched off"', async () => {
        const store = createPresenceStore({ transport: transportOf(() => bad(503)) });
        assert.equal(store.get().presenceEnabled, null);
        await store.load();
        assert.equal(store.get().status, 'unavailable');
        assert.equal(store.get().presenceEnabled, null);
    });

    test('a non-integer sleep timeout is rounded, because the handler tests `v is! int`', async () => {
        const transport = transportOf(({ key }) => (
            key === 'GET /presence/settings' ? ok({ ...SETTINGS }) : ok({})));
        const store = createPresenceStore({ transport });
        await store.setSleepTimeout(29.6);
        const post = transport.calls.find((c) => c.method === 'POST');
        assert.deepEqual(post.body, { sleepTimeoutMinutes: 30 });
    });

    test('a sleep timeout outside the clamp band never leaves the tablet', async () => {
        const transport = transportOf(() => ok({}));
        const store = createPresenceStore({ transport });
        assert.equal(await store.setSleepTimeout(SLEEP_TIMEOUT_RANGE.max + 1), false);
        assert.equal(await store.setSleepTimeout(-1), false);
        assert.equal(transport.calls.length, 0);
    });

    test('every write re-reads, because the server clamps and mints ids', async () => {
        let served = 30;
        const transport = transportOf(({ key, body }) => {
            if (key === 'GET /presence/settings') return ok({ ...SETTINGS, sleepTimeoutMinutes: served });
            if (key === 'POST /presence/settings') { served = Math.min(240, body.sleepTimeoutMinutes); return ok({}); }
            return bad(500);
        });
        const store = createPresenceStore({ transport });
        await store.load();
        await store.setSleepTimeout(60);
        assert.equal(store.get().sleepTimeoutMinutes, 60, 'the value shown is the value the server holds');
    });

    test('an empty day set is legal and is sent as an empty array', async () => {
        const transport = transportOf(({ key }) => (
            key === 'GET /presence/settings' ? ok({ ...SETTINGS }) : ok({})));
        const store = createPresenceStore({ transport });
        assert.equal(await store.addSchedule({ time: '07:00', days: [] }), true);
        const post = transport.calls.find((c) => c.method === 'POST');
        /* `WakeSchedule.matchesTime` filters by day ONLY when the set is non-empty, so an
         * empty set means EVERY day. Refusing it would remove the most useful schedule. */
        assert.deepEqual(post.body, { time: '07:00', daysOfWeek: [], enabled: true });
    });

    test('a weekday outside 1..7, or a malformed time, never leaves the tablet', async () => {
        const transport = transportOf(() => ok({}));
        const store = createPresenceStore({ transport });
        assert.equal(await store.addSchedule({ time: '07:00', days: [0] }), false);
        assert.equal(await store.addSchedule({ time: '07:00', days: [8] }), false);
        assert.equal(await store.addSchedule({ time: '7:00', days: [] }), false);
        assert.equal(await store.addSchedule({ time: '24:00', days: [] }), false);
        assert.equal(transport.calls.length, 0);
    });

    test('keepAwakeFor: 0 and null both mean CLEAR, and the key is then omitted', async () => {
        const transport = transportOf(({ key }) => (
            key === 'GET /presence/settings' ? ok({ ...SETTINGS }) : ok({})));
        const store = createPresenceStore({ transport });
        await store.addSchedule({ time: '07:00', days: [1], keepAwakeFor: 0 });
        assert.ok(!Object.hasOwn(transport.calls.find((c) => c.method === 'POST').body, 'keepAwakeFor'));
        assert.equal(await store.addSchedule({ time: '07:00', days: [1], keepAwakeFor: KEEP_AWAKE_RANGE.max + 1 }), false);
    });

    test('the update route takes only the fields that changed', async () => {
        const transport = transportOf(({ key }) => (
            key === 'GET /presence/settings' ? ok({ ...SETTINGS }) : ok({})));
        const store = createPresenceStore({ transport });
        await store.updateSchedule('a', { enabled: false });
        const put = transport.calls.find((c) => c.method === 'PUT');
        assert.deepEqual(put.body, { enabled: false });
        assert.equal(put.path, '/presence/schedules/a');
    });
});

describe('plugins: the form is the manifest’s, and a secure field has no value', () => {
    const MANIFEST = Object.freeze({
        id: VISUALIZER_PLUGIN_ID,
        name: 'Visualizer upload',
        autoLoad: true,
        loaded: true,
        settings: {
            Username: { type: 'string', description: 'Visualiser username' },
            Password: { type: 'string', secure: true, description: 'Visualiser password' },
            AutoUpload: { type: 'boolean', description: 'Upload shots automatically', default: true },
            Weird: { type: 'colour', description: 'a kind this skin has no control for' },
        },
    });

    test('`{isSet}` is read in one place and nowhere else has to know the shape', () => {
        assert.equal(secureState({ isSet: true }), true);
        assert.equal(secureState({ isSet: false }), false);
        assert.equal(secureState({ isSet: true, other: 1 }), null, 'two keys is a plain object');
        assert.equal(secureState('hunter2'), null);
        assert.equal(secureState(null), null);
    });

    test('a secure field carries its STATE and no value, whatever the server sent', () => {
        const fields = settingFields(MANIFEST, { Username: 'ben', Password: { isSet: true }, AutoUpload: false });
        const password = fields.find((f) => f.key === 'Password');
        assert.equal(password.secure, true);
        assert.equal(password.value, undefined, 'the skin cannot show a stored secret');
        assert.equal(password.isSet, true);
        assert.equal(fields.find((f) => f.key === 'Username').value, 'ben');
        assert.equal(fields.find((f) => f.key === 'AutoUpload').value, false);
    });

    test('manifest order is the form’s order — it is what the plugin author wrote', () => {
        assert.deepEqual(settingFields(MANIFEST, null).map((f) => f.key),
            ['Username', 'Password', 'AutoUpload', 'Weird']);
    });

    test('a type this skin cannot draw is REPORTED, not skipped', () => {
        const unsupported = unsupportedSettings(MANIFEST);
        assert.deepEqual(unsupported.map((f) => f.key), ['Weird']);
        /* A form that quietly omitted a field is a form nobody can trust to be the whole
         * of one, and the plugin's author would have no way to tell. */
        assert.equal(settingFields(MANIFEST, null).length, 4);
    });

    test('a plugin with no settings block produces no form at all', () => {
        assert.deepEqual(settingFields({ id: 'x' }, null), []);
        assert.deepEqual(settingFields(null, null), []);
    });

    test('the settled document comes from the REPLY, because the handler reloads and re-reads', async () => {
        const transport = transportOf(({ key }) => {
            if (key === 'GET /plugins') return ok([{ ...MANIFEST }]);
            if (key === `POST /plugins/${VISUALIZER_PLUGIN_ID}/settings`) {
                return ok({ Username: 'ben', Password: { isSet: true }, AutoUpload: true });
            }
            return bad(500);
        });
        const store = createPluginsStore({ transport });
        await store.load();
        assert.equal(await store.writeSettings(VISUALIZER_PLUGIN_ID, { Password: 'hunter2' }), true);
        /* THE REPLY AND NOT THE REQUEST: the password went up as text and comes back as
         * `{isSet}`, which is the round trip working as designed. */
        assert.deepEqual(store.settingsFor(VISUALIZER_PLUGIN_ID).Password, { isSet: true });
    });

    test('a 400 leaves the draft the caller’s problem and reports false', async () => {
        const transport = transportOf(({ key }) => (key === 'GET /plugins' ? ok([{ ...MANIFEST }]) : bad(400)));
        const store = createPluginsStore({ transport });
        await store.load();
        assert.equal(await store.writeSettings(VISUALIZER_PLUGIN_ID, { Nope: 1 }), false);
        assert.notEqual(store.get().writeError, null);
    });

    test('enable and disable are one call each, and the list is re-read after', async () => {
        const transport = transportOf(({ key }) => {
            if (key === 'GET /plugins') return ok([{ ...MANIFEST }]);
            if (key.startsWith('POST /plugins/')) return ok({ message: 'ok' });
            return bad(500);
        });
        const store = createPluginsStore({ transport });
        await store.load();
        await store.setEnabled(VISUALIZER_PLUGIN_ID, false);
        assert.ok(transport.calls.some((c) => c.path === `/plugins/${VISUALIZER_PLUGIN_ID}/disable`));
        await store.setEnabled(VISUALIZER_PLUGIN_ID, true);
        assert.ok(transport.calls.some((c) => c.path === `/plugins/${VISUALIZER_PLUGIN_ID}/enable`));
    });

    test('nothing in this store calls /plugins/install — the handler answers 501', () => {
        const store = createPluginsStore({ transport: transportOf(() => bad(500)) });
        assert.equal(typeof store.install, 'undefined', 'a wrapper for a 501 is a promise nobody can keep');
    });

    test('nothing in this store deletes a plugin — a bundled one comes back, unconfigured', async () => {
        const transport = transportOf(({ key }) => (key === 'GET /plugins' ? ok([{ ...MANIFEST }]) : bad(500)));
        const store = createPluginsStore({ transport });
        await store.load();
        assert.equal(typeof store.remove, 'undefined',
            'a removal this skin cannot describe honestly is not one it offers');
        assert.deepEqual(transport.calls.filter((c) => c.method === 'DELETE'), [],
            'no path through this store reaches DELETE /plugins/<id>');
        /* AND THE CONTROL THAT REPLACES IT IS ALREADY HERE. Dropping Remove is only
         * defensible because disable does the work the button was reached for. */
        assert.equal(typeof store.setEnabled, 'function');
    });
});

describe('feedback: three refusals, and only one of them is worth retrying', () => {
    test('the four types are the Dart enum’s own names', () => {
        assert.deepEqual(FEEDBACK_TYPES.map((entry) => entry.value), ['bug', 'feature', 'question', 'other']);
    });

    test('a blank description is refused here, because the handler would 500 on it', async () => {
        const transport = transportOf(() => ok({}));
        const store = createFeedbackStore({ transport });
        await store.submit({ description: '   ' });
        assert.equal(store.get().status, FEEDBACK_STATUS.REFUSED);
        assert.equal(store.get().reason, FEEDBACK_REFUSAL.EMPTY_DESCRIPTION);
        /* THE HANDLER'S TEST IS `(json['description'] as String).trim().isEmpty`, so a
         * body with NO description key casts null to String and throws into the
         * catch-all — a 500 where a 400 was meant. */
        assert.equal(transport.calls.length, 0);
    });

    test('a 503 is NOT_CONFIGURED — the build carries no token and retrying cannot help', async () => {
        const store = createFeedbackStore({ transport: transportOf(() => bad(503, { message: 'no token' })) });
        await store.submit({ description: 'it broke' });
        assert.equal(store.get().reason, FEEDBACK_REFUSAL.NOT_CONFIGURED);
    });

    test('an unknown type is made explicit rather than left to the handler’s orElse', async () => {
        const transport = transportOf(() => ok({}, 201));
        const store = createFeedbackStore({ transport });
        await store.submit({ description: 'hello', type: 'nonsense' });
        /* `FeedbackType.values.firstWhere(..., orElse:  => other)` would answer 200 for
         * a request that did not say what it meant. */
        assert.equal(transport.calls.at(-1).body.type, 'other');
    });

    test('the two include switches default to true, which is the handler’s own default', async () => {
        const transport = transportOf(() => ok({}, 201));
        const store = createFeedbackStore({ transport });
        await store.submit({ description: 'hello' });
        assert.equal(transport.calls.at(-1).body.includeLogs, true);
        assert.equal(transport.calls.at(-1).body.includeSystemInfo, true);
        assert.equal(store.get().status, FEEDBACK_STATUS.SENT);
    });

    test('a 201 keeps the issue it filed, because "Thank you" is not an answer to "where?"', async () => {
        const store = createFeedbackStore({
            transport: transportOf(() => ok({
                success: true,
                issueUrl: 'https://github.com/decentespresso/decaid/issues/123',
                issueNumber: 123,
            }, 201)),
        });
        await store.submit({ description: 'it broke' });
        assert.equal(store.get().status, FEEDBACK_STATUS.SENT);
        assert.equal(store.get().issueNumber, 123);
        assert.equal(store.get().issueUrl, 'https://github.com/decentespresso/decaid/issues/123');
    });

    test('a 201 carrying neither field is still SENT, and neither is invented', async () => {
        const store = createFeedbackStore({ transport: transportOf(() => ok({ success: true }, 201)) });
        await store.submit({ description: 'it broke' });
        assert.equal(store.get().status, FEEDBACK_STATUS.SENT);
        assert.equal(store.get().issueNumber, null);
        assert.equal(store.get().issueUrl, null);
    });

    test('a numeric-looking string issue number is NOT taken, because a link would follow it', async () => {
        const store = createFeedbackStore({
            transport: transportOf(() => ok({ success: true, issueNumber: '123', issueUrl: 42 }, 201)),
        });
        await store.submit({ description: 'it broke' });
        assert.equal(store.get().issueNumber, null);
        assert.equal(store.get().issueUrl, null);
    });

    test('a failed submit shows the SERVER’s reason, which lives in `problem` and never in `data`', async () => {
        const store = createFeedbackStore({
            transport: transportOf(() => bad(500, { success: false, errorMessage: 'Failed to create GitHub issue' })),
        });
        await store.submit({ description: 'it broke' });
        assert.equal(store.get().reason, FEEDBACK_REFUSAL.FAILED);
        assert.equal(store.get().message, 'Failed to create GitHub issue');
    });

    test('and the 400/503 spelling is read too, because the handler genuinely uses two', async () => {
        /* A 400 and a 503 are hand-built {error, message} bodies; a failed SUBMIT is
         * jsonError(result.toJson()), which spells the same idea `errorMessage`. */
        const store = createFeedbackStore({
            transport: transportOf(() => bad(503, { error: 'Service unavailable', message: 'no token at build time' })),
        });
        await store.submit({ description: 'it broke' });
        assert.equal(store.get().reason, FEEDBACK_REFUSAL.NOT_CONFIGURED);
        assert.equal(store.get().message, 'no token at build time');
    });

    test('a refusal with no readable body leaves the message null, so the screen says its own sentence', async () => {
        const store = createFeedbackStore({ transport: transportOf(() => bad(500, 'not json at all')) });
        await store.submit({ description: 'it broke' });
        assert.equal(store.get().message, null);
    });
});

describe('the Decent account is a reading, and "not asked" is one of its answers', () => {
    test('a served false is SIGNED OUT and a failed read is NOT ASKED', async () => {
        const signedOut = createDecentAccountStore({ transport: transportOf(() => ok({ loggedIn: false })) });
        await signedOut.load();
        assert.equal(signedOut.get().status, ACCOUNT_STATUS.READY);
        assert.equal(signedOut.get().loggedIn, false);

        const unreachable = createDecentAccountStore({ transport: transportOf(() => bad(503)) });
        await unreachable.load();
        assert.equal(unreachable.get().status, ACCOUNT_STATUS.UNAVAILABLE);
        assert.equal(unreachable.get().loggedIn, null, 'never guessed as signed out');
    });
});

describe('the support thread survives a body this skin did not design', () => {
    const THREAD = JSON.stringify([
        { from_user: 'Support', now: 200, subject: 'Re: grinder', body: 'Try 1.2 finer.', automsg: 0 },
        { now: 100, subject: 'grinder', body: 'The grind seems coarse.' },
    ]);

    const supportOf = (script, token = 'bearer-1') => {
        const transport = transportOf(script);
        return { transport, store: createDecentSupportStore({ transport, token }) };
    };

    test('the thread is asked for as TEXT, with the bearer, and no `since`', async () => {
        const transport = {
            calls: [],
            socketUrl: () => 'ws://test',
            url: (path) => `http://test${path}`,
            async request(path, options = {}) {
                transport.calls.push({ path, ...options });
                return ok(THREAD);
            },
        };
        const store = createDecentSupportStore({ transport, token: 'bearer-1' });
        await store.load();
        const call = transport.calls[0];
        assert.equal(call.path, '/account/proxy/support/api/emails');
        assert.equal(call.expect, 'text',
            'the relay types its body application/octet-stream; a JSON read of it is wrong twice over');
        assert.deepEqual(call.headers, { Authorization: 'Bearer bearer-1' });
        assert.equal(call.query, null);
    });

    test('the conversation is oldest first, with each side named off `from_user` alone', async () => {
        const { store } = supportOf(() => ok(THREAD));
        await store.load();
        const state = store.get();
        assert.equal(state.status, SUPPORT_STATUS.READY);
        assert.deepEqual(state.messages.map((m) => m.body),
            ['The grind seems coarse.', 'Try 1.2 finer.'],
            'the fixture serves them newest-first; a conversation read bottom-to-top is unreadable');
        assert.equal(state.messages[0].from, null, 'no from_user means the account wrote it');
        assert.equal(state.messages[1].from, 'Support');
    });

    test('a message with only a body keeps its absences, and invents nothing', async () => {
        const { store } = supportOf(() => ok(JSON.stringify([{ body: 'just text' }])));
        await store.load();
        const [message] = store.get().messages;
        assert.equal(message.subject, null, 'no "(no subject)" — the screen decides what absence looks like');
        assert.equal(message.at, null, 'and no fabricated timestamp');
        assert.equal(message.auto, false);
    });

    test('an empty value before a comma is repaired, because the upstream really emits one', async () => {
        const { store } = supportOf(() => ok('[{"from_user":"Support","now":1,"subject": ,"body":"hello"}]'));
        await store.load();
        assert.equal(store.get().status, SUPPORT_STATUS.READY);
        assert.deepEqual(store.get().messages.map((m) => m.body), ['hello']);
    });

    test('anything else unreadable is UNAVAILABLE and never an empty conversation', async () => {
        for (const body of ['<html>nope', '{"not":"an array"}']) {
            const { store } = supportOf(() => ok(body));
            await store.load();
            assert.equal(store.get().status, SUPPORT_STATUS.UNAVAILABLE, body);
            assert.equal(store.get().reason, SUPPORT_REFUSAL.UNREADABLE, body);
            assert.deepEqual(store.get().messages, []);
        }
    });

    test('a bodyless 200 IS an empty conversation, which is a real answer', async () => {
        const { store } = supportOf(() => ok(''));
        await store.load();
        assert.equal(store.get().status, SUPPORT_STATUS.READY);
        assert.deepEqual(store.get().messages, []);
    });

    test("the upstream's own '0' is a refusal even on a 200", async () => {
        const { store } = supportOf(() => ok('0'));
        await store.load();
        assert.equal(store.get().reason, SUPPORT_REFUSAL.UPSTREAM_REFUSED);

        const send = supportOf(() => ok('0'));
        assert.equal(await send.store.send({ subject: 's', body: 'b' }), false);
        assert.equal(send.store.get().send.status, SEND_STATUS.REFUSED);
        assert.equal(send.store.get().send.reason, SUPPORT_REFUSAL.UPSTREAM_REFUSED);
    });

    test('401 and 403 are different sentences, because they are different things to do', async () => {
        const unlinked = supportOf(() => bad(401, { error: 'Decent account not linked' }));
        await unlinked.store.load();
        assert.equal(unlinked.store.get().reason, SUPPORT_REFUSAL.NOT_LINKED);

        const forbidden = supportOf(() => bad(403, { error: 'Path not allowed' }));
        await forbidden.store.load();
        assert.equal(forbidden.store.get().reason, SUPPORT_REFUSAL.FORBIDDEN);

        const gone = supportOf(() => bad(503));
        await gone.store.load();
        assert.equal(gone.store.get().reason, SUPPORT_REFUSAL.FAILED);
    });

    test('with no token nothing reaches the wire, and the reason names the cause', async () => {
        const transport = transportOf(() => ok(THREAD));
        const store = createDecentSupportStore({ transport, token: null });
        assert.equal(store.hasToken, false);
        await store.load();
        assert.equal(store.get().reason, SUPPORT_REFUSAL.NO_TOKEN);
        assert.equal(await store.send({ subject: 's', body: 'b' }), false);
        assert.deepEqual(transport.calls, [], 'a request with no credential is worse than no request');
    });

    test('the send is a GET with the message on the query string — the only shape a read scope has', async () => {
        const { transport, store } = supportOf(({ path }) => (
            path === '/account/proxy/support/api/email' ? ok('1') : ok(THREAD)));
        assert.equal(await store.send({ subject: '  Grinder  ', body: '  coarse  ' }), true);

        const sendCall = transport.calls.find((c) => c.path === '/account/proxy/support/api/email');
        assert.equal(sendCall.method, 'GET',
            'POST through this proxy needs account:proxy:write and the injected skin token has account:proxy');
        assert.deepEqual(sendCall.query, { subject: 'Grinder', body: 'coarse' },
            'both are trimmed — trailing whitespace in a subject line is not a subject line');
        assert.equal(store.get().send.status, SEND_STATUS.SENT);
    });

    test('a successful send re-reads the thread, because nothing is appended locally', async () => {
        const { transport, store } = supportOf(({ path }) => (
            path === '/account/proxy/support/api/email' ? ok('1') : ok(THREAD)));
        await store.send({ subject: 's', body: 'b' });
        const reads = transport.calls.filter((c) => c.path === '/account/proxy/support/api/emails');
        assert.equal(reads.length, 1, 'the sent message becomes visible only by re-reading');
        assert.equal(store.get().messages.length, 2);
    });

    test('a send that succeeds survives a re-read that does not', async () => {
        const { store } = supportOf(({ path }) => (
            path === '/account/proxy/support/api/email' ? ok('1') : bad(503)));
        assert.equal(await store.send({ subject: 's', body: 'b' }), true);
        assert.equal(store.get().send.status, SEND_STATUS.SENT, 'the send really happened');
        assert.equal(store.get().status, SUPPORT_STATUS.UNAVAILABLE, 'and the thread really did not load');
    });

    test('a blank field is refused before a request is built', async () => {
        const { transport, store } = supportOf(() => ok('1'));
        assert.equal(await store.send({ subject: '', body: 'b' }), false);
        assert.equal(await store.send({ subject: 's', body: '   ' }), false);
        assert.deepEqual(transport.calls, []);
        assert.equal(store.get().send.status, SEND_STATUS.IDLE,
            'a press that never became a request leaves no verdict for the page to print');
    });
});

describe('the scan sends connect=false and never quick=true', () => {
    test('a settings-page scan must not connect to what it finds', async () => {
        const transport = transportOf(({ key }) => (
            key === 'GET /devices/scan' ? ok([]) : (key === 'GET /devices' ? ok([]) : bad(500))));
        const store = createScaleConnectStore({ transport });
        await store.scan();
        const scanCall = transport.calls.find((c) => c.path === '/devices/scan');
        /* AN ABSENT `connect` MEANS CONNECT: the handler's test is `!= "false"`, so a bare
         * scan runs `scanAndConnect()`. */
        assert.deepEqual(scanCall.query, { connect: 'false' });
        /* AND `quick=true` RETURNS AN EMPTY ARRAY IMMEDIATELY, which reads as "nothing
         * found" on every press. */
        assert.ok(!Object.hasOwn(scanCall.query, 'quick'));
        assert.equal(store.get().status, SCAN_STATUS.DONE);
    });

    test('a scan RE-READS what is remembered, because a scan changes it', async () => {
        let seen = false;
        const transport = transportOf(({ key }) => {
            if (key === 'GET /devices/scan') { seen = true; return ok([{ id: 'sc-1', type: 'scale' }]); }
            if (key === 'GET /devices') {
                return ok([{ id: 'sc-1', type: 'scale', state: 'disconnected', available: seen }]);
            }
            return bad(500);
        });
        const store = createScaleConnectStore({ transport });
        await store.loadDevices();
        assert.equal(store.get().known[0].available, false, 'remembered and out of reach');
        await store.scan();
        assert.equal(store.get().known[0].available, true,
            'the scan proved it is there, so the remembered row says so');
        assert.equal(transport.calls.filter((c) => c.path === '/devices').length, 2);
    });

    test('Reconnect on a REMEMBERED device scans first — the direct route cannot succeed', async () => {
        let seen = false;
        const transport = transportOf(({ key }) => {
            if (key === 'GET /devices/scan') { seen = true; return ok([{ id: 'm-1', type: 'machine' }]); }
            if (key === 'GET /devices') {
                return ok([{ id: 'm-1', type: 'machine', state: 'disconnected', available: seen }]);
            }
            if (key === 'PUT /devices/connect') return ok({ outcome: 'connected', deviceId: 'm-1' });
            return bad(500);
        });
        const store = createScaleConnectStore({ transport });
        await store.loadDevices();
        assert.equal(await store.reconnectDevice('m-1'), true);
        const order = transport.calls.map((c) => `${c.method} ${c.path}`);
        assert.ok(order.indexOf('GET /devices/scan') < order.indexOf('PUT /devices/connect'),
            'the scan is what makes the connect answerable');
    });

    test('and if the scan does not surface it, NO connect is fired at all', async () => {
        const transport = transportOf(({ key }) => {
            if (key === 'GET /devices/scan') return ok([]);
            if (key === 'GET /devices') {
                return ok([{ id: 'm-1', type: 'machine', state: 'disconnected', available: false }]);
            }
            return bad(500);
        });
        const store = createScaleConnectStore({ transport });
        await store.loadDevices();
        assert.equal(await store.reconnectDevice('m-1'), false);
        assert.ok(!transport.calls.some((c) => c.path === '/devices/connect'),
            'a blind 404 is not an answer worth waiting for');
        assert.deepEqual(store.get().writeError.op, WRITE_OP.CONNECT);
        assert.equal(store.get().writeError.reason, 'not-found');
    });

    test('a refusal carries the OPERATION it belongs to, and the server’s own words', async () => {
        const transport = transportOf(({ key }) => {
            if (key === 'GET /devices') return ok([]);
            if (key === 'PUT /devices/forget') {
                return bad(409, { outcome: 'conflict', error: 'Device is inventory-only and cannot be controlled here' });
            }
            return bad(500);
        });
        const store = createScaleConnectStore({ transport });
        assert.equal(await store.forgetDevice('m-1'), false);
        assert.equal(store.get().writeError.op, WRITE_OP.FORGET);
        assert.match(store.get().writeError.reason, /inventory-only/,
            'the reason is the server’s, never a sentence this layer composed');
    });

    test('a second press joins the first scan rather than starting a second sweep', async () => {
        let resolve;
        const parked = new Promise((r) => { resolve = r; });
        const transport = transportOf(() => parked);
        const store = createScaleConnectStore({ transport });
        const first = store.scan();
        const second = store.scan();
        assert.equal(first, second);
        resolve(ok([]));
        await first;
        assert.equal(transport.calls.filter((c) => c.path === '/devices/scan').length, 1);
    });

    test('the WiFi endpoint routes answer with the whole list, so a write needs no re-read', async () => {
        const transport = transportOf(({ key, body, query }) => {
            if (key === 'GET /devices/wifi') return ok({ endpoints: [] });
            if (key === 'POST /devices/wifi') return ok({ endpoints: [body.host] });
            if (key === 'DELETE /devices/wifi') return ok({ endpoints: [] });
            return bad(500);
        });
        const store = createScaleConnectStore({ transport });
        await store.loadEndpoints();
        assert.deepEqual(store.get().endpoints, []);
        assert.equal(await store.addEndpoint('  192.0.2.10 '), true);
        assert.deepEqual(store.get().endpoints, ['192.0.2.10'], 'trimmed, as the handler trims');
        assert.equal(transport.calls.filter((c) => c.method === 'GET').length, 1, 'no re-read');
    });

    test('the delete sends the host as a QUERY, which is what the spec declares', async () => {
        const transport = transportOf(({ key }) => (
            key === 'DELETE /devices/wifi' ? ok({ endpoints: [] }) : bad(500)));
        const store = createScaleConnectStore({ transport });
        await store.removeEndpoint('192.0.2.10');
        const call = transport.calls.at(-1);
        assert.deepEqual(call.query, { host: '192.0.2.10' });
        /* A DELETE BODY is the one place a fetch stack or an intermediary may drop what it
         * was given, and `buildQuery` checks the query spelling against the contract. */
        assert.equal(call.body, undefined);
    });

    test('FORGET IS HERE NOW — this store IS the connection surface (26 Aug 2026)', async () => {
        const transport = transportOf(({ key }) => (
            key === 'PUT /devices/forget' || key === 'GET /devices' ? ok([]) : bad(500)));
        const store = createScaleConnectStore({ transport });
        assert.equal(await store.forgetDevice('m-1'), true);
        assert.equal(transport.calls[0].path, '/devices/forget');
        assert.equal(transport.calls[0].method, 'PUT');
        assert.deepEqual(transport.calls[0].body, { deviceId: 'm-1' });
        /* AND IT RE-READS. None of the three device routes answers with the new LIST. */
        assert.equal(transport.calls.at(-1).path, '/devices');
    });
});

describe('key bindings: one key, one action, and one merge for two surfaces', () => {
    test('the six actions are Slate’s, and the defaults derive from the shipped map', () => {
        assert.deepEqual(BINDABLE_ACTIONS.map((a) => a.id),
            ['espresso', 'hot-water', 'steam', 'flush', 'stop', 'sleep']);
        assert.deepEqual(DEFAULT_BINDINGS_BY_ACTION, {
            espresso: 'e', 'hot-water': 'w', steam: 's', flush: 'f', stop: SPACE_KEY, sleep: 'p',
        });
    });

    test('nothing stored resolves to exactly the shipped map', () => {
        const resolved = resolveBindings(null);
        assert.equal(resolved.e, MACHINE_STATE.ESPRESSO);
        assert.equal(resolved[SPACE_KEY], MACHINE_STATE.IDLE);
        /* THE OTHER END: `live-wiring.js` hands this map to `stateForKey`, which is what
         * makes the settings page and the Live screen agree. */
        assert.equal(stateForKey('e', resolved), MACHINE_STATE.ESPRESSO);
    });

    test('an override moves the key at BOTH ends', () => {
        const resolved = resolveBindings({ espresso: 'x' });
        assert.equal(stateForKey('x', resolved), MACHINE_STATE.ESPRESSO);
        assert.equal(stateForKey('e', resolved), null, 'the old key stops working');
        assert.equal(bindingsByAction({ espresso: 'x' }).espresso, 'x');
    });

    test('an explicit null unbinds, and an unreadable override leaves the default alone', () => {
        assert.equal(bindingsByAction({ sleep: null }).sleep, null);
        /* A BAD OVERRIDE IS NOT AN UNBIND: the user asked for a different key, not for no
         * key, and refusing the whole map over one bad entry costs them a keyboard. */
        assert.equal(bindingsByAction({ espresso: 'Shift' }).espresso, 'e');
        assert.equal(bindingsByAction('nonsense').espresso, 'e');
    });

    test('a conflict is named before it is written, and is never resolved silently', () => {
        assert.equal(conflictFor('w', 'espresso', null).id, 'hot-water');
        assert.equal(conflictFor('x', 'espresso', null), null);
        assert.equal(conflictFor('e', 'espresso', null), null);
    });

    test('a duplicate that reaches the resolver leaves ONE action bound, in declared order', () => {
        const resolved = resolveBindings({ espresso: 'z', steam: 'z' });
        assert.equal(resolved.z, MACHINE_STATE.ESPRESSO, 'the earlier action in BINDABLE_ACTIONS keeps it');
        assert.equal(bindingsByAction({ espresso: 'z', steam: 'z' }).steam, null);
    });

    test('three keys cannot be bound, and each for a reason a user would recognise', () => {
        assert.equal(normaliseKey('Escape'), null, 'it closes the capture');
        assert.equal(normaliseKey('Shift'), null, 'a modifier is half a shortcut');
        assert.equal(normaliseKey('Dead'), null, 'an input-method artefact is not a key');
        assert.equal(normaliseKey('Tab'), null);
        assert.equal(normaliseKey('E'), 'e', 'stored lower case, as stateForKey looks it up');
        assert.equal(normaliseKey(SPACE_KEY), SPACE_KEY);
        assert.equal(normaliseKey('ArrowUp'), 'ArrowUp');
    });

    test('space is stored as a character and shown as a word', () => {
        assert.equal(keyLabel(SPACE_KEY), 'Space');
        assert.equal(keyLabel('e'), 'E');
        /* A SURFACE THAT SPELLED "Space" INTO STORAGE would write a binding no keydown
         * can ever match. */
        assert.equal(withBinding(null, 'stop', SPACE_KEY).stop, SPACE_KEY);
    });

    test('withBinding writes the overrides WHOLE, and refuses a key it cannot store', () => {
        assert.deepEqual(withBinding({ steam: 'q' }, 'espresso', 'x'), { steam: 'q', espresso: 'x' });
        assert.deepEqual(withBinding({ steam: 'q' }, 'espresso', 'Escape'), { steam: 'q' });
        assert.deepEqual(withBinding({ steam: 'q' }, 'not-an-action', 'x'), { steam: 'q' });
    });
});

describe('B7 holds for the STORE as well as for the key', () => {
    test('the reader can be handed over after construction, and does not refresh on the way in', async () => {
        const { createCupWarmerStore } = await import('../src/stores/cup-warmer.js');
        let reads = 0;
        const store = createCupWarmerStore({
            routes: {
                cupWarmer: async () => { reads += 1; return reaSuccess({ status: 200, data: { temperature: 40, enabled: true }, method: 'GET', url: 'x' }); },
                setCupWarmer: async () => reaSuccess({ status: 200, data: null, method: 'PUT', url: 'x' }),
                cupWarmerPreheat: async () => reaSuccess({ status: 200, data: { enabled: true, leadMinutes: 20 }, method: 'GET', url: 'x' }),
                setCupWarmerPreheat: async () => reaSuccess({ status: 200, data: null, method: 'PUT', url: 'x' }),
            },
            readCapabilities: () => ['cupWarmer', 'preheat'],
        });
        store.useSchedules(() => [{ id: 'a', time: '07:00' }]);
        assert.equal(reads, 0, 'handing over a reader is not a read');
        await store.refresh();
        assert.deepEqual(store.get().schedules, [{ id: 'a', time: '07:00' }],
            'and the next read uses it');
    });

});
