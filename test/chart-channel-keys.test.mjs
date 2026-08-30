
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
    CHANNELS,
    SERIES_KEY_CHANNELS,
    channelNameFor,
    channelToken,
    readChartTokens,
    resolveChannels,
} from '../src/lib/chart-tokens.js';
import { SERIES_KEYS } from '../src/lib/shot-derivation.js';

const CHANNEL_CSS = readFileSync(new URL('../styles/chart-channels.css', import.meta.url), 'utf8');

/** Every token this reader asks for, resolved to one recognisable value. */
const fullReader = () => {
    const map = {};
    for (const name of CHANNELS) map[channelToken(name)] = '#123456';
    for (const part of ['well', 'grid', 'axis', 'label']) map[`--ui-chart-${part}`] = '#654321';
    map['--ui-font-family'] = 'Geist, sans-serif';
    for (const token of ['stroke', 'stroke-minor', 'tick', 'legend', 'step-label', 'stat',
        'gutter-l', 'gutter-r', 'gutter-t', 'gutter-b', 'label-l', 'label-r',
        'min-h', 'tick-gap']) {
        map[`--ui-chart-${token}`] = '8px';
    }
    return () => ({ getPropertyValue: (name) => map[name] ?? '' });
};

/** The channel names declared inside one selector block of the sheet. */
function declaredIn(selector) {
    const start = CHANNEL_CSS.indexOf(selector);
    assert.ok(start >= 0, `${selector} is not in chart-channels.css`);
    const open = CHANNEL_CSS.indexOf('{', start);
    const close = CHANNEL_CSS.indexOf('\n}', open);
    return [...CHANNEL_CSS.slice(open, close).matchAll(/--ui-channel-([a-z0-9-]+)\s*:/g)].map((m) => m[1]);
}

describe('the map is complete in both directions', () => {
    test('SERIES_KEY_CHANNELS covers every derivation key, and the steam chart\'s two', () => {
        const mapped = new Set(Object.keys(SERIES_KEY_CHANNELS));
        for (const key of SERIES_KEYS) {
            assert.ok(mapped.has(key), `${key} is a derivation channel with no channel name`);
        }
        const extra = [...mapped].filter((key) => !SERIES_KEYS.includes(key)).sort();
        assert.deepEqual(extra, ['milkTemperature', 'steamTemperature'],
            'the only keys here that are not derivation channels are the steam chart\'s two');
    });

    test('every mapped name is a channel the stylesheet declares', () => {
        for (const [key, name] of Object.entries(SERIES_KEY_CHANNELS)) {
            assert.ok(CHANNELS.includes(name), `${key} maps to ${name}, which CHANNELS does not list`);
            assert.ok(CHANNEL_CSS.includes(`${channelToken(name)}:`), `${channelToken(name)} is not declared`);
        }
    });

    test('an unknown key passes through, so a fork may name its own channel', () => {
        assert.equal(channelNameFor('somethingElse'), 'somethingElse');
    });
});

describe('every channel a shot derivation carries can actually be drawn', () => {
    test('all fourteen resolve to a colour — the measured regression', () => {
        const { channels } = readChartTokens({}, { read: fullReader() });
        const { resolved, unresolved } = resolveChannels(SERIES_KEYS, channels, { strict: false });

        assert.deepEqual([...unresolved], [], 'these keys would draw with no stroke at all');
        assert.equal(resolved.length, SERIES_KEYS.length);
        assert.ok(resolved.every(([, colour]) => colour === '#123456'));
    });

    test('the nine that used to fall through, by the reason each one did', () => {
        const { channels } = readChartTokens({}, { read: fullReader() });

        // Seven were spelled differently in the two namespaces...
        const respelled = ['weightFlow', 'groupTemp', 'mixTemp', 'targetTemp',
            'targetMixTemp', 'targetPressure', 'targetFlow'];
        for (const key of respelled) {
            assert.notEqual(channelNameFor(key), key, `${key} is its own channel name?`);
            assert.ok(channels[channelNameFor(key)], `${key} still has no colour`);
            assert.equal(channels[key], undefined,
                `${key} must NOT be a key of the token map — that is the trap, not the fix`);
        }
        // ...and two had no token at all, under any spelling.
        for (const key of ['weight', 'volume']) {
            assert.equal(channelNameFor(key), key, 'the added channels are named as they are keyed');
            assert.ok(channels[key], `${key} has no colour — and it is one of gate 6's own two`);
        }
        assert.equal(respelled.length + 2, 9, 'nine keys resolved to nothing when this was measured');
    });

    test('gate 6\'s two added channels are declared in BOTH theme blocks', () => {
        const light = declaredIn(':root');
        const dark = declaredIn('[data-theme="dark"]');
        for (const name of ['weight', 'volume']) {
            assert.ok(light.includes(name), `--ui-channel-${name} is missing from :root`);
            assert.ok(dark.includes(name), `--ui-channel-${name} is missing from the dark block`);
        }
        assert.deepEqual([...light].sort(), [...dark].sort(),
            'a channel declared in one theme and not the other is dark-only or light-only by accident');
    });
});

describe('nothing resolves silently', () => {
    test('resolveChannels throws naming every key that has no colour', () => {
        const { channels } = readChartTokens({}, { read: fullReader() });
        assert.throws(
            () => resolveChannels(['pressure', 'weightFlow', 'nonesuch'], channels),
            (error) => {
                assert.match(error.message, /nonesuch \(--ui-channel-nonesuch\)/);
                assert.doesNotMatch(error.message, /weightFlow/, 'weightFlow resolves through the map');
                return true;
            },
        );
    });

    test('non-strict reports the same misses, and never guesses a colour', () => {
        const { channels } = readChartTokens({}, { read: fullReader() });
        const { resolved, unresolved } = resolveChannels(['pressure', 'nonesuch'], channels, { strict: false });
        assert.deepEqual([...unresolved], ['nonesuch (--ui-channel-nonesuch)']);
        assert.equal(resolved[0][1], '#123456');
        assert.equal(resolved[1][1], undefined, 'an unresolved channel is undefined, never a fallback colour');
    });

    test('`missing` being empty says the SHEET arrived, never that a caller\'s keys resolved', () => {
        const tokens = readChartTokens({}, { read: fullReader() });
        assert.deepEqual([...tokens.missing], [], 'the sheet is complete...');
        assert.equal(tokens.channels.weightFlow, undefined,
            '...and a derivation key read straight off it still gets nothing, which is the '
            + 'silent hole resolveChannels exists to close');
    });

    test('an empty channel list is not an error — a plot with no series simply waits', () => {
        const { channels } = readChartTokens({}, { read: fullReader() });
        assert.deepEqual(resolveChannels([], channels).resolved, []);
    });
});
