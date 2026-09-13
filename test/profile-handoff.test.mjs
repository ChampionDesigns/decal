/**
 * profile-handoff.test.mjs — leaving for the profile generator and coming back.
 *
 * Covers the browser's detached new tab, a blocked or refused one, and the two
 * native surfaces: an embedded plugin page, and anything else.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generatorHandoff, openProfileGenerator } from '../src/lib/profile-handoff.js';

const local = 'http://localhost:8080/api/v1/plugins/decent-profile.reaplugin/ui';

test('browser opens a detached new tab and keeps the current page', () => {
    const calls = [];
    const child = { opener: {}, location: { replace(url) {
        assert.equal(child.opener, null, 'the opener must be detached before navigation');
        calls.push(url);
    } } };
    const win = { location: { href: 'http://machine.local:3000/' }, open(url, target) {
        assert.equal(url, 'about:blank'); assert.equal(target, '_blank'); return child;
    } };
    assert.equal(generatorHandoff(win, local).mode, 'browser');
    assert.equal(openProfileGenerator(win, local), true);
    assert.deepEqual(calls, [local]);
    assert.equal(win.location.href, 'http://machine.local:3000/');
});

test('blocked or failed new tab is reported without navigating the current page', () => {
    const win = { location: { href: 'http://machine.local/' }, open: () => null };
    assert.equal(openProfileGenerator(win, local), false);
    win.open = () => { throw new Error('blocked'); };
    assert.equal(openProfileGenerator(win, local), false);
    assert.equal(win.location.href, 'http://machine.local/');
    assert.equal(openProfileGenerator(win, 'javascript:alert(1)'), false);
    assert.equal(openProfileGenerator(win, ''), false);
    assert.equal(openProfileGenerator(win, null), false);
});

test('native local plugin keeps its existing route and names the Dashboard return', () => {
    for (const platform of ['android', 'ios', 'macos', 'windows', 'linux']) {
        const calls = [];
        const win = { __DECENT_HOST__: { app: 'decent.app', platform },
            location: { href: 'http://localhost:3000/', assign: url => calls.push(url) },
            open: () => { throw new Error('native has no supported separate window'); } };
        const handoff = generatorHandoff(win, local);
        assert.equal(handoff.surface, 'embedded');
        assert.match(handoff.returnKey, /Dashboard/);
        assert.equal(openProfileGenerator(win, local), true);
        assert.deepEqual(calls, [local]);
    }
});

test('native external destinations explain returning from the system browser', () => {
    const win = { __DECENT_HOST__: { platform: 'android' }, location: { href: 'http://localhost:3000/' } };
    const handoff = generatorHandoff(win, 'https://example.org/generator');
    assert.equal(handoff.surface, 'external');
    assert.match(handoff.returnKey, /switch back to Decal/);
    assert.doesNotMatch(handoff.returnKey, /Dashboard/);
});
