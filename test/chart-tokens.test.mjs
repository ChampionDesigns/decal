
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
    CHANNELS,
    COMPARISON_CHANNELS,
    FONT_FAMILY_TOKEN,
    GEOMETRY_TOKENS,
    SURFACE_PARTS,
    axisFont,
    channelToken,
    parsePx,
    primaryFamily,
    readChartTokens,
    surfaceToken,
} from '../src/lib/chart-tokens.js';

const cssText = (name) => readFileSync(new URL(`../styles/${name}`, import.meta.url), 'utf8');
const CHANNEL_CSS = cssText('chart-channels.css');
const TOKENS_CSS = cssText('tokens.css');

/** A complete, plausible declaration — every token this module asks for, resolved. */
function fullMap(overrides = {}) {
    const map = {};
    for (const name of CHANNELS) map[channelToken(name)] = '#123456';
    for (const part of SURFACE_PARTS) map[surfaceToken(part)] = '#654321';
    map[FONT_FAMILY_TOKEN] = 'Geist, sans-serif';
    const lengths = {
        strokeMajor: '3px', strokeMinor: '2px', tickFontPx: '17px', legendFontPx: '17px',
        stepLabelPx: '14px',
        statFontPx: '27px', gutterLeft: '70px', gutterRight: '64px', gutterTop: '12px',
        gutterBottom: '52px', minHeight: '160px', minTickGapPx: '170px',
    };
    for (const [key, token] of Object.entries(GEOMETRY_TOKENS)) map[token] = lengths[key];
    return { ...map, ...overrides };
}

/** The `read` seam: a getComputedStyle-shaped reader over a plain object. */
const readerOf = (map) => () => ({ getPropertyValue: (name) => map[name] ?? '' });

describe('the token names are written in exactly one place', () => {
    test('channelToken and surfaceToken own their prefixes', () => {
        assert.equal(channelToken('pressure'), '--ui-channel-pressure');
        assert.equal(surfaceToken('well'), '--ui-chart-well');
    });

    test('the channel list is exactly what the stylesheet declares, and four surface parts', () => {
        const declared = new Set(
            [...CHANNEL_CSS.matchAll(/--ui-channel-([a-z0-9-]+)\s*:/g)].map((m) => m[1]),
        );
        assert.equal(CHANNELS.length + COMPARISON_CHANNELS.length, declared.size,
            `JS names ${CHANNELS.length + COMPARISON_CHANNELS.length}, CSS declares ${declared.size}`);
        assert.deepEqual([...SURFACE_PARTS], ['well', 'grid', 'axis', 'label']);
        assert.equal(new Set(CHANNELS).size, CHANNELS.length, 'and no name is listed twice');
    });
});

describe('freshness — every name this module states is DECLARED in a stylesheet', () => {
    test('every channel token is in chart-channels.css', () => {
        const missing = [...CHANNELS, ...COMPARISON_CHANNELS].filter((name) => !CHANNEL_CSS.includes(`${channelToken(name)}:`));
        assert.deepEqual(missing, [],
            'a token with no declaration resolves to an empty string, which draws NOTHING — '
            + 'and an empty plot photographs exactly like a plot whose palette did not arrive');
    });

    test('all four surface tokens are in chart-channels.css', () => {
        const missing = SURFACE_PARTS.filter((part) => !CHANNEL_CSS.includes(`${surfaceToken(part)}:`));
        assert.deepEqual(missing, []);
    });

    test('no channel colour is declared that this module does not name', () => {
        const declared = new Set(
            [...CHANNEL_CSS.matchAll(/--ui-channel-([a-z0-9-]+)\s*:/g)].map((m) => m[1]),
        );
        const named = [...CHANNELS, ...COMPARISON_CHANNELS];
        const orphans = [...declared].filter((name) => !named.includes(name));
        assert.deepEqual(orphans, [],
            'a colour the sheet declares and the reader never asks for is the drift A6 ends '
            + '(bug C4: a documented value that had already drifted from the constant it documented)');
    });

    test('every geometry token, and the family, are in tokens.css', () => {
        const missing = Object.values(GEOMETRY_TOKENS).filter((token) => !TOKENS_CSS.includes(`${token}:`));
        assert.deepEqual(missing, []);
        assert.ok(TOKENS_CSS.includes(`${FONT_FAMILY_TOKEN}:`), 'C9: one family token, declared once');
    });
});

describe('parsePx — a broken chain is not a zero', () => {
    test('px values, with whitespace', () => {
        assert.equal(parsePx('70px'), 70);
        assert.equal(parsePx('  12px  '), 12);
        assert.equal(parsePx('0px'), 0);
        assert.equal(parsePx('1.5px'), 1.5);
    });

    test('anything unparseable throws, and names the token', () => {
        assert.throws(() => parsePx('auto', '--ui-chart-gutter-l'), /--ui-chart-gutter-l did not resolve/);
        assert.throws(() => parsePx(''), /did not resolve to a length/);
        assert.throws(() => parsePx(null), /did not resolve to a length/);
        assert.throws(() => parsePx(undefined), /did not resolve to a length/);
    });
});

describe('readChartTokens', () => {
    test('resolves every token and parses the lengths to numbers', () => {
        const got = readChartTokens({}, { read: readerOf(fullMap()) });

        assert.deepEqual(got.missing, []);
        assert.equal(got.channels.pressure, '#123456');
        assert.equal(got.surface.well, '#654321');
        assert.equal(got.fontFamily, 'Geist, sans-serif');
        assert.equal(got.geometry.gutterLeft, 70, 'a length is a NUMBER of CSS px by the time a plot sees it');
        assert.equal(got.geometry.minTickGapPx, 170);
        assert.equal(Object.keys(got.channels).length, CHANNELS.length);
    });

    test('the result is frozen — nothing downstream can edit the palette it was handed', () => {
        const got = readChartTokens({}, { read: readerOf(fullMap()) });
        assert.ok(Object.isFrozen(got));
        assert.ok(Object.isFrozen(got.channels));
        assert.ok(Object.isFrozen(got.surface));
        assert.ok(Object.isFrozen(got.geometry));
    });

    test('STRICT is the default and it throws with the full list of names', () => {
        const map = fullMap();
        delete map['--ui-channel-flow'];
        delete map['--ui-chart-gutter-b'];

        assert.throws(
            () => readChartTokens({}, { read: readerOf(map) }),
            (error) => {
                assert.match(error.message, /2 token\(s\) resolved to nothing/);
                assert.match(error.message, /--ui-channel-flow/);
                assert.match(error.message, /--ui-chart-gutter-b/);
                return true;
            },
            'a chart whose palette did not arrive must fail on its first build, loudly, rather '
            + 'than paint sixteen invisible traces',
        );
    });

    test('strict:false reports the absences instead — the road a live retheme takes', () => {
        const map = fullMap();
        delete map['--ui-channel-flow'];
        delete map['--ui-chart-gutter-b'];
        const got = readChartTokens({}, { read: readerOf(map), strict: false });

        assert.deepEqual([...got.missing], ['--ui-channel-flow', '--ui-chart-gutter-b']);
        assert.equal(got.channels.flow, '');
        assert.equal(got.geometry.gutterBottom, null, 'a missing length is null, never 0');
        assert.equal(got.geometry.gutterTop, 12, 'and the ones that did resolve are still numbers');
    });

    test('a token that resolves to something that is not a length still throws', () => {
        const map = fullMap({ '--ui-chart-gutter-l': 'auto' });
        assert.throws(() => readChartTokens({}, { read: readerOf(map) }), /did not resolve to a length/);
    });

    test('with no reader and no getComputedStyle it says so rather than reading nothing', () => {
        assert.throws(
            () => readChartTokens({}),
            /no getComputedStyle available and no `read` provided/,
        );
    });
});

describe('axisFont — the CSS-space shorthand', () => {
    test('size and family, in that order', () => {
        assert.equal(axisFont(17, 'Geist, sans-serif'), '17px Geist, sans-serif');
    });

    test('it refuses the two ways it could produce a silently wrong font', () => {
        assert.throws(() => axisFont(0, 'Geist'), /sizePx must be positive/);
        assert.throws(() => axisFont(-1, 'Geist'), /sizePx must be positive/);
        assert.throws(() => axisFont(17, ''), /no family — read --ui-font-family/);
        assert.throws(() => axisFont(17, undefined), /no family/);
    });

    test('it does NOT multiply by a pixel ratio — that belongs to the caller (bug chart-C12)', () => {
        assert.equal(axisFont(20, 'X'), '20px X');
    });
});

describe('primaryFamily — the one string that can tell a face from its fallback', () => {
    test('the first family, quotes intact', () => {
        assert.equal(primaryFamily('"Geist", system-ui, sans-serif'), '"Geist"');
        assert.equal(primaryFamily('Geist, sans-serif'), 'Geist');
        assert.equal(primaryFamily("  'IBM Plex Sans' , serif "), "'IBM Plex Sans'");
    });

    test('a single family passes through unchanged', () => {
        assert.equal(primaryFamily('system-ui'), 'system-ui');
        assert.equal(primaryFamily('  Geist  '), 'Geist');
    });

    test('a comma INSIDE a quoted family name is not a separator', () => {
        assert.equal(primaryFamily('"Foo, Bold", sans-serif'), '"Foo, Bold"');
        assert.equal(primaryFamily("'A, B'"), "'A, B'");
    });

    test('it refuses what it cannot answer rather than returning an empty font', () => {
        assert.throws(() => primaryFamily(''), /no family — read --ui-font-family/);
        assert.throws(() => primaryFamily(undefined), /no family/);
        assert.throws(() => primaryFamily(', sans-serif'), /empty first family/);
    });

    test('its output is a legal axisFont family', () => {
        assert.equal(axisFont(20, primaryFamily('"Geist", system-ui')), '20px "Geist"');
    });
});
