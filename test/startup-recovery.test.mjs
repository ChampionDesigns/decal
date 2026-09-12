import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startupFailureDetails, canOpenDashboard, openDashboard } from '../src/lib/startup-recovery.js';

test('startup details retain the failed module and useful error without inventing a cause', () => {
    assert.equal(startupFailureDetails({ specifier: 'src/screens/live-screen.js', message: 'Failed to fetch dynamically imported module' }), 'src/screens/live-screen.js\nFailed to fetch dynamically imported module');
    assert.equal(startupFailureDetails(null), '');
    assert.equal(startupFailureDetails({ message: '<network unavailable>' }), '<network unavailable>');
});

test('dashboard recovery requires both the native host marker and the supported bridge', () => {
    let exits = 0;
    const win = { decentApp: { exitToDashboard: () => exits++ } };
    assert.equal(canOpenDashboard(win), false);
    assert.equal(openDashboard(win), false);
    win.__DECENT_HOST__ = true;
    assert.equal(canOpenDashboard(win), true);
    assert.equal(openDashboard(win), true);
    assert.equal(exits, 1);
    win.decentApp.exitToDashboard = () => { throw new Error('host unavailable'); };
    assert.equal(openDashboard(win), false);
    assert.equal(canOpenDashboard({ __DECENT_HOST__: true }), false);
});
