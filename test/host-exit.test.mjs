/**
 * The two destinations a skin has when it stops being the page, proved against windows
 * the test builds: a native view, a browser tab a script opened, and one it did not, at a
 * skin root and at a nested route.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { hostEntryUrl, hostServesThisPage, leaveSkin } from '../src/lib/host-exit.js';

/** A location as `window.location` reports one. */
const locationAt = (href) => {
    const url = new URL(href);
    return {
        href,
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port,
        pathname: url.pathname,
        hash: url.hash,
    };
};

/**
 * A window at a URL, with whichever host machinery the case is about. `native` injects
 * both the host marker and the bridge; `served` is the bridge alone, which is what a
 * browser tab on a page the host served has.
 */
function windowAt(href, { native = false, served = native, opener = false } = {}) {
    const win = {
        location: locationAt(href),
        exits: 0,
        closes: 0,
        assigned: [],
        reloads: 0,
    };
    win.location.assign = (target) => { win.assigned.push(target); };
    win.location.reload = () => { win.reloads += 1; };
    if (served) win.decentApp = { exitToDashboard: () => { win.exits += 1; } };
    if (native) win.__DECENT_HOST__ = Object.freeze({ platform: 'android', version: '0.7.19' });
    if (opener) win.opener = { name: 'the tab that opened this one' };
    win.close = () => { win.closes += 1; };
    return win;
}

describe('the reload destination after a skin switch', () => {
    test('it is the host entry point, on the host this page was reached by', () => {
        assert.equal(hostEntryUrl(locationAt('http://127.0.0.1:27731/#/settings')), 'http://127.0.0.1:3000/');
        assert.equal(hostEntryUrl(locationAt('http://192.0.2.44:25099/')), 'http://192.0.2.44:3000/');
        assert.equal(hostEntryUrl(locationAt('http://localhost:27731/some/nested/page')), 'http://localhost:3000/');
    });

    test('it never reuses the port this page was served from', () => {
        for (const href of ['http://127.0.0.1:27731/', 'http://127.0.0.1:27731/#/settings']) {
            const entry = hostEntryUrl(locationAt(href));
            assert.equal(entry.includes('27731'), false, `${entry} still names the stopped server`);
        }
    });

    test('an IPv6 host survives, and so does the entry root', () => {
        assert.equal(hostEntryUrl(locationAt('http://[::1]:27731/')), 'http://[::1]:3000/');
        assert.equal(hostEntryUrl(locationAt('http://127.0.0.1:27731/#/settings/display')), 'http://127.0.0.1:3000/');
    });

    test('a page that is not on http is not sent to an http entry point', () => {
        assert.equal(hostEntryUrl(locationAt('file:///skins/decal/index.html')), null);
    });

    test('nothing to build from answers null rather than an invented address', () => {
        assert.equal(hostEntryUrl(null), null);
        assert.equal(hostEntryUrl({}), null);
        assert.equal(hostEntryUrl({ hostname: '' }), null);
    });

    test('a page the host did not serve is not sent to an entry point that is not there', () => {
        assert.equal(hostServesThisPage(windowAt('http://localhost:5173/#/settings')), false);
        assert.equal(hostServesThisPage(windowAt('http://127.0.0.1:27731/', { served: true })), true);
        assert.equal(hostServesThisPage(null), false);
        assert.equal(hostServesThisPage({ decentApp: {} }), false, 'a decentApp with no bridge is not the host\'s');
    });
});

describe('leaving the skin', () => {
    test('inside the app it calls the host bridge — at the root and at a nested route', () => {
        for (const href of ['http://localhost:27731/', 'http://localhost:27731/#/settings', 'http://localhost:27731/a/b/c']) {
            const win = windowAt(href, { native: true });
            assert.equal(leaveSkin(win), true, `${href} did not leave`);
            assert.equal(win.exits, 1, `${href} did not reach the bridge`);
            assert.deepEqual(win.assigned, [], `${href} navigated as well as leaving`);
            assert.equal(win.closes, 0);
        }
    });

    test('in a browser the bridge alone is NOT an exit, and is not reported as one', () => {
        const win = windowAt('http://127.0.0.1:27731/#/settings', { served: true });
        assert.equal(leaveSkin(win), false);
        assert.equal(win.exits, 0, 'a no-op bridge was called and counted as leaving');
    });

    test('a browser tab a script opened is closed — the one supported browser exit', () => {
        const win = windowAt('http://127.0.0.1:27731/#/settings', { served: true, opener: true });
        assert.equal(leaveSkin(win), true);
        assert.equal(win.closes, 1);
        assert.deepEqual(win.assigned, [], 'it navigated instead of closing');
    });

    test('a tab that cannot be closed goes NOWHERE rather than reloading the skin', () => {
        for (const href of ['http://127.0.0.1:27731/', 'http://127.0.0.1:27731/#/settings']) {
            const win = windowAt(href, { served: true });
            assert.equal(leaveSkin(win), false);
            assert.deepEqual(win.assigned, [], `${href} navigated on a refusal`);
            assert.equal(win.reloads, 0, `${href} reloaded on a refusal`);
            assert.equal(win.closes, 0);
        }
    });

    test('a bridge that throws is a refusal, not an exit', () => {
        const win = windowAt('http://localhost:27731/', { native: true });
        win.decentApp.exitToDashboard = () => { throw new Error('gone'); };
        assert.equal(leaveSkin(win), false);
        assert.deepEqual(win.assigned, []);
    });

    test('an opener that cannot be read is not a window we may close', () => {
        const win = windowAt('http://127.0.0.1:27731/', { served: true });
        Object.defineProperty(win, 'opener', { get() { throw new Error('cross-origin'); } });
        assert.equal(leaveSkin(win), false);
        assert.equal(win.closes, 0);
    });

    test('no window at all is a refusal rather than a throw', () => {
        assert.equal(leaveSkin(null), false);
        assert.equal(leaveSkin(undefined), false);
    });
});
