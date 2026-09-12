/**
 * May this screen go away, and the loop rule. One place an in-app navigation, a history
 * traversal and a reload all ask the same question, so a screen holding an unsaved draft
 * answers each of them the same way. A refused traversal owes a correction, and a
 * correction written as an address change comes back in as another traversal.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
    createLeaveContract, LEAVE_ACTION, LEAVE_KIND,
} from '../src/lib/app-routes.js';

/** A guard that always refuses, and counts how often it was asked. */
const refuser = (reason = null) => {
    const calls = [];
    const fn = (details) => {
        calls.push(details);
        return reason === null ? false : { allow: false, reason };
    };
    fn.calls = calls;
    return fn;
};

describe('the route leave contract', () => {

    test('with nothing registered every navigation leaves', () => {
        const contract = createLeaveContract();
        for (const kind of Object.values(LEAVE_KIND)) {
            const answer = contract.request({ from: 'editor', to: 'live', kind });
            assert.equal(answer.action, LEAVE_ACTION.LEAVE, `${kind} leaves`);
            assert.equal(answer.restoreTo, null);
        }
    });

    test('a guard refuses an in-app navigation without owing a correction', () => {
        const contract = createLeaveContract();
        contract.guard(refuser('there is unsaved work'));
        const answer = contract.request({ from: 'editor', to: 'live', kind: LEAVE_KIND.NAVIGATE });
        assert.equal(answer.action, LEAVE_ACTION.STAY);
        assert.equal(answer.reason, 'there is unsaved work');
        assert.equal(answer.restoreTo, null, 'the address never moved, so there is nothing to put back');
        assert.equal(contract.pendingRestore(), null);
    });

    test('a guard refusing a history traversal names the address to put back', () => {
        const contract = createLeaveContract();
        contract.guard(refuser());
        const answer = contract.request({ from: 'editor', to: 'live', kind: LEAVE_KIND.HISTORY });
        assert.equal(answer.action, LEAVE_ACTION.RESTORE);
        assert.equal(answer.restoreTo, 'editor');
        assert.equal(contract.pendingRestore(), 'editor');
    });

    test('the correction that comes back as an event is consumed, not re-refused', () => {
        const contract = createLeaveContract();
        const guard = refuser();
        contract.guard(guard);

        const refused = contract.request({ from: 'editor', to: 'live', kind: LEAVE_KIND.HISTORY });
        assert.equal(refused.action, LEAVE_ACTION.RESTORE);

        /* The shell wrote the address back, and the write fired `hashchange`. */
        const correction = contract.request({ from: 'editor', to: 'editor', kind: LEAVE_KIND.HISTORY });
        assert.equal(correction.action, LEAVE_ACTION.LEAVE);
        assert.equal(correction.consulted, false, 'our own correction never reaches a guard');
        assert.equal(correction.restoreTo, null, 'and it owes no second correction');
        assert.equal(contract.pendingRestore(), null, 'the latch disarms itself');
        assert.equal(guard.calls.length, 1, 'the guard was asked once, by the press, and not by the correction');
    });

    test('a correction is consumed even when the mounted route has already moved', () => {
        /* The other spelling: a shell that swapped the screen before it asked, so `from`
         * is the address it is correcting TO rather than the one it is correcting FROM. */
        const contract = createLeaveContract();
        const guard = refuser();
        contract.guard(guard);

        contract.request({ from: 'editor', to: 'live', kind: LEAVE_KIND.HISTORY });
        const correction = contract.request({ from: 'live', to: 'editor', kind: LEAVE_KIND.HISTORY });
        assert.equal(correction.action, LEAVE_ACTION.LEAVE);
        assert.equal(correction.consulted, false);
        assert.equal(guard.calls.length, 1);
    });

    test('pressing Back twice asks twice and never grows a pending correction', () => {
        /* Every refusal must replace the outstanding correction, never queue a second. */
        const contract = createLeaveContract();
        const guard = refuser();
        contract.guard(guard);

        const first = contract.request({ from: 'editor', to: 'live', kind: LEAVE_KIND.HISTORY });
        contract.request({ from: 'editor', to: 'editor', kind: LEAVE_KIND.HISTORY });
        const second = contract.request({ from: 'editor', to: 'history', kind: LEAVE_KIND.HISTORY });

        assert.equal(first.action, LEAVE_ACTION.RESTORE);
        assert.equal(second.action, LEAVE_ACTION.RESTORE);
        assert.equal(second.restoreTo, 'editor');
        assert.equal(contract.pendingRestore(), 'editor', 'one outstanding correction, not two');
        assert.equal(guard.calls.length, 2, 'each press was a question; neither correction was');
    });

    test('a shell that corrects with replaceState fires no second event and still leaves cleanly', () => {
        /* replaceState does not raise `hashchange`, so the latch is never consumed by an
         * event. The next genuine navigation must still be asked, not swallowed by a
         * correction nobody claimed. */
        const contract = createLeaveContract();
        let dirty = true;
        contract.guard(() => (dirty ? { allow: false, reason: 'unsaved' } : true));

        assert.equal(contract.request({ from: 'editor', to: 'live', kind: LEAVE_KIND.HISTORY }).action,
            LEAVE_ACTION.RESTORE);
        assert.equal(contract.pendingRestore(), 'editor');

        dirty = false;
        const after = contract.request({ from: 'editor', to: 'live', kind: LEAVE_KIND.HISTORY });
        assert.equal(after.action, LEAVE_ACTION.LEAVE, 'the saved draft lets the same press through');
        assert.equal(after.consulted, true, 'and it was a real question, not a swallowed correction');
        assert.equal(contract.pendingRestore(), null, 'the stale correction was dropped');
    });

    test('a stale correction cannot swallow a navigation the person asked for', () => {
        const contract = createLeaveContract();
        let dirty = true;
        const asked = [];
        contract.guard((details) => { asked.push(details.to); return !dirty; });

        contract.request({ from: 'editor', to: 'live', kind: LEAVE_KIND.HISTORY });
        /* An in-app navigation now, while the correction is still outstanding. */
        assert.equal(contract.request({ from: 'editor', to: 'settings', kind: LEAVE_KIND.NAVIGATE }).action,
            LEAVE_ACTION.STAY);
        assert.equal(contract.pendingRestore(), null, 'the outstanding correction went with it');

        dirty = false;
        assert.equal(contract.request({ from: 'editor', to: 'editor', kind: LEAVE_KIND.HISTORY }).action,
            LEAVE_ACTION.LEAVE);
        assert.deepEqual(asked, ['live', 'settings'], 'every question, and no others');
    });

    test('re-asserting the address we are on is not a dismissal', () => {
        const contract = createLeaveContract();
        const guard = refuser();
        contract.guard(guard);
        const answer = contract.request({ from: 'editor', to: 'editor', kind: LEAVE_KIND.NAVIGATE });
        assert.equal(answer.action, LEAVE_ACTION.LEAVE);
        assert.equal(guard.calls.length, 0, 'a screen is never asked whether it may stay put');
    });

    test('a reload is refused without a correction, because there is no address to put back', () => {
        const contract = createLeaveContract();
        contract.guard(refuser('unsaved'));
        const answer = contract.request({ from: 'editor', to: null, kind: LEAVE_KIND.UNLOAD });
        assert.equal(answer.action, LEAVE_ACTION.STAY);
        assert.equal(answer.reason, 'unsaved');
        assert.equal(answer.restoreTo, null);
    });

    test('the first refusal wins and the guards after it are not asked', () => {
        const contract = createLeaveContract();
        const first = refuser('first');
        const second = refuser('second');
        contract.guard(first);
        contract.guard(second);
        assert.equal(contract.request({ from: 'a', to: 'b' }).reason, 'first');
        assert.equal(second.calls.length, 0);
    });

    test('a guard that throws allows the navigation and is reported', () => {
        const warned = [];
        const contract = createLeaveContract({ logger: { warn: (...args) => warned.push(args) } });
        contract.guard(() => { throw new Error('broken guard'); });
        const answer = contract.request({ from: 'editor', to: 'live', kind: LEAVE_KIND.HISTORY });
        assert.equal(answer.action, LEAVE_ACTION.LEAVE, 'a broken guard must not lock the app on one screen');
        assert.equal(warned.length, 1);
    });

    test('registering returns its own removal', () => {
        const contract = createLeaveContract();
        const off = contract.guard(refuser());
        assert.equal(contract.size(), 1);
        off();
        assert.equal(contract.size(), 0);
        assert.equal(contract.request({ from: 'editor', to: 'live' }).action, LEAVE_ACTION.LEAVE);
    });

    test('the guards see where the navigation came from, where it is going and how it was asked', () => {
        const contract = createLeaveContract();
        const seen = [];
        contract.guard((details) => { seen.push(details); return true; });
        contract.request({ from: 'editor', to: 'live', kind: LEAVE_KIND.HISTORY });
        assert.deepEqual(seen, [{ from: 'editor', to: 'live', kind: 'history' }]);
    });
});
