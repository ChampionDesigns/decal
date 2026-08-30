/**
 * The two tokens.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const tokensCss = readFileSync(
    fileURLToPath(new URL('../styles/tokens.css', import.meta.url)),
    'utf8',
);

/** Comments stripped first: tokens.css quotes selectors and values inside its prose. */
const stripBlockComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

const declaration = (token) => new RegExp(`^\\s*${token}\\s*:\\s*([^;]+);`, 'm');

test('--ui-blackout is declared, and it is the same value in BOTH theme blocks', () => {
    const css = stripBlockComments(tokensCss);
    const darkIndex = css.indexOf('[data-theme="dark"]');
    assert.ok(darkIndex > 0, 'tokens.css has no dark block');

    const light = css.slice(0, darkIndex).match(declaration('--ui-blackout'));
    const dark = css.slice(darkIndex).match(declaration('--ui-blackout'));

    assert.ok(light, '--ui-blackout is missing from the light block — ui-screensaver would paint transparent');
    assert.ok(dark, '--ui-blackout is missing from the dark block — ui-screensaver would paint transparent');
    assert.equal(light[1].trim(), dark[1].trim(),
        'D10 is "fully black" in both themes; a theme-varying blank is a different decision');
});

test('--ui-z-blackout is on the z scale and sits above every other layer on it', () => {
    const css = stripBlockComments(tokensCss);
    const value = (token) => {
        const match = css.match(declaration(token));
        assert.ok(match, `${token} is not declared in styles/tokens.css`);
        return Number.parseInt(match[1].trim(), 10);
    };

    const blackout = value('--ui-z-blackout');
    for (const other of ['--ui-z-sticky', '--ui-z-overlay', '--ui-z-menu', '--ui-z-toast']) {
        assert.ok(blackout > value(other),
            `${other} is at or above --ui-z-blackout: something can paint on a blanked screen`);
    }
});

test('the z scale is theme-invariant — the blackout layer is declared exactly once', () => {
    const css = stripBlockComments(tokensCss);
    const hits = css.match(/^\s*--ui-z-blackout\s*:/gm) || [];
    assert.equal(hits.length, 1, `--ui-z-blackout declared ${hits.length} times`);
});
