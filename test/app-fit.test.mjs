/**
 * THE FIT — the one number that maps the design onto a screen.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    computeFit, applyFit, installFit, effectivePixelRatio, readScale,
    FIT_EVENT, MIN_DESIGN_HEIGHT, MIN_DESIGN_WIDTH, MIN_SCALE, MAX_SCALE,
    MIN_GLASS_HIT, HIT_FLOOR_PROPERTY,
} from '../src/lib/app-fit.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const GEOMETRIES = [
    { name: "the bench tablet", width: 1281, height: 801,  scale: 0.6675, designW: 1919.1, designH: 1200 },
    { name: 'the 1920 gate', width: 1920, height: 1200, scale: 1,      designW: 1920,   designH: 1200 },
    { name: '16:9 desk',     width: 1920, height: 1080, scale: 0.9,    designW: 2133.3, designH: 1200 },
    { name: '16:9 UHD',      width: 2560, height: 1440, scale: 1.2,    designW: 2133.3, designH: 1200 },
    { name: '4:3',           width: 1024, height: 768,  scale: 0.64,   designW: 1600,   designH: 1200 },
    { name: '5:4',           width: 1280, height: 1024, scale: 0.8533, designW: 1500,   designH: 1200 },
];

const AGREEMENT_GEOMETRIES = [
    ...GEOMETRIES,
    { name: 'portrait (MIN_DESIGN_WIDTH binds)', width: 800, height: 1280 },
    { name: 'ultrawide (MAX_DESIGN_WIDTH binds)', width: 3840, height: 1080 },
    { name: 'tall (MAX_DESIGN_HEIGHT binds)', width: 800, height: 2000 },
    { name: 'tiny (MIN_SCALE binds)', width: 320, height: 240 },
    { name: '8K (MAX_SCALE binds)', width: 7680, height: 4320 },
];

const near = (actual, expected, tolerance = 0.1) =>
    assert.ok(Math.abs(actual - expected) <= tolerance,
        `expected ~${expected}, got ${actual}`);

test('every landscape screen gets the design height of 1200', () => {
    for (const g of GEOMETRIES) {
        const fit = computeFit(g);
        assert.equal(fit.designHeight, MIN_DESIGN_HEIGHT,
            `${g.name} did not get the reference height — a screen is laying out at a size no oracle exists for`);
    }
});

test('the scale and the design width match what the browser measured', () => {
    for (const g of GEOMETRIES) {
        const fit = computeFit(g);
        near(fit.scale, g.scale, 0.0005);
        near(fit.designWidth, g.designW, 0.15);
    }
});

test("the tablet lands within a unit of the oracle's 1920", () => {
    const fit = computeFit({ width: 1281, height: 801 });
    assert.ok(Math.abs(fit.designWidth - 1920) < 1.5,
        `the tablet lays out at ${fit.designWidth}, not ~1920 — the oracle no longer applies to it`);
});

test('the rails keep their size and only the centre column grows', () => {
    /* Stated in design units, which is the promise: a wider screen does not re-rank
     * anything, it hands the difference to the middle. */
    const RAILS = 260 * 2;
    const centre = (g) => computeFit(g).designWidth - RAILS;
    assert.ok(centre({ width: 1920, height: 1080 }) > centre({ width: 1920, height: 1200 }),
        'a 16:9 screen did not give its extra width to the centre column');
    assert.equal(centre({ width: 2560, height: 1440 }), centre({ width: 1920, height: 1080 }),
        'two screens of the same aspect ratio produced different layouts');
});

test('a viewport with no size answers the identity fit, not NaN', () => {
    const fit = computeFit({ width: 0, height: 0 });
    assert.equal(fit.scale, 1);
    assert.ok(Number.isFinite(fit.designWidth) && Number.isFinite(fit.designHeight));
});

test('the scale is clamped at both ends', () => {
    assert.equal(computeFit({ width: 320, height: 240 }).scale, MIN_SCALE,
        'a tiny panel scaled below the floor and rendered text nobody can read');
    assert.equal(computeFit({ width: 7680, height: 4320 }).scale, MAX_SCALE,
        'an 8K panel scaled past the ceiling');
});

test('an extreme aspect ratio is letterboxed, not stretched', () => {
    const wide = computeFit({ width: 3840, height: 1080 });
    assert.equal(wide.designWidth, 2400, 'an ultrawide stretched the centre column without limit');
    /* Painted narrower than the screen is the point: the body ground shows each side. */
    assert.ok(wide.designWidth * wide.scale < 3840);
});

test('portrait gives up width last — the design gets taller, never narrower', () => {
    const portrait = computeFit({ width: 800, height: 1280 });
    assert.ok(portrait.designWidth >= MIN_DESIGN_WIDTH,
        'a portrait viewport squeezed the design below the width the rails need');
});

/** The smallest document that `applyFit`, `readScale` and `installFit` need. */
function fakeWindow(width, height) {
    const props = new Map();
    const listeners = new Map();
    const win = {
        innerWidth: width,
        innerHeight: height,
        devicePixelRatio: 1.5,
        events: [],
        document: {
            documentElement: {
                style: {
                    setProperty: (k, v) => props.set(k, v),
                    getPropertyValue: (k) => props.get(k) ?? '',
                },
            },
        },
        addEventListener: (type, fn) => listeners.set(type, (listeners.get(type) ?? []).concat(fn)),
        removeEventListener: (type, fn) => listeners.set(type, (listeners.get(type) ?? []).filter((f) => f !== fn)),
        dispatchEvent: (event) => { win.events.push(event); return true; },
        listenerCount: (type) => (listeners.get(type) ?? []).length,
        fire: (type) => (listeners.get(type) ?? []).forEach((fn) => fn()),
    };
    win.props = props;
    return win;
}

test('the three properties are published in design units', () => {
    const win = fakeWindow(1281, 801);
    applyFit(win.document, computeFit({ width: 1281, height: 801 }));
    assert.equal(win.props.get('--ui-app-scale'), String(0.6675));
    assert.equal(win.props.get('--ui-app-h'), '1200px');
    assert.ok(win.props.get('--ui-app-w').endsWith('px'));
});

test('the hit floor is published as the design length that renders as the floor', () => {
    for (const [width, height, scale] of [[1281, 801, 0.6675], [1000, 600, 0.5], [1920, 1200, 1]]) {
        const win = fakeWindow(width, height);
        applyFit(win.document, computeFit({ width, height }));
        const published = parseFloat(win.props.get(HIT_FLOOR_PROPERTY));
        assert.ok(Number.isFinite(published), `${width}x${height} published no hit floor`);
        near(published * scale, MIN_GLASS_HIT, 0.02);
    }
});

test('the floor is the token, not a second opinion about a fingertip', () => {
    assert.equal(MIN_GLASS_HIT, 48);
});

test('a hand-built fit with no scale publishes a length, not Infinity', () => {
    const win = fakeWindow(1281, 801);
    applyFit(win.document, { scale: 0, designWidth: 1280, designHeight: 1200 });
    assert.equal(win.props.get(HIT_FLOOR_PROPERTY), `${MIN_GLASS_HIT}px`);
});

test('the canvas backing factor is dpr TIMES the scale', () => {
    const win = fakeWindow(1281, 801);
    installFit(win);
    /* 1.5 * 0.6675 = 1.00125. On this panel one design unit IS one device pixel, and
     * `devicePixelRatio` alone would have oversampled every chart by half. */
    near(effectivePixelRatio(win), 1.5 * 0.6675, 0.0001);
    assert.equal(readScale(win), 0.6675);
});

test('a scale change is announced once, and a resize that changes nothing is silent', () => {
    const win = fakeWindow(1920, 1200);
    const stop = installFit(win);
    assert.equal(win.events.length, 1, 'the first fit was not announced');
    assert.equal(win.events[0].type, FIT_EVENT);

    win.fire('resize');
    assert.equal(win.events.length, 1, 'a resize that did not move the scale still announced one');

    win.innerHeight = 801; win.innerWidth = 1281;
    win.fire('resize');
    assert.equal(win.events.length, 2, 'the scale moved and nothing was told');
    assert.equal(win.props.get('--ui-app-scale'), String(0.6675));

    stop();
    win.innerHeight = 1200; win.innerWidth = 1920;
    win.fire('resize');
    assert.equal(win.events.length, 2, 'the listener outlived its stop function');
    assert.equal(win.listenerCount('resize'), 0);
});

function keyboardWindow(width, height) {
    const win = fakeWindow(width, height);
    const docListeners = new Map();
    Object.assign(win.document, {
        activeElement: null,
        addEventListener: (type, fn) => docListeners.set(type, (docListeners.get(type) ?? []).concat(fn)),
        removeEventListener: (type, fn) => docListeners.set(type, (docListeners.get(type) ?? []).filter((f) => f !== fn)),
        fire: (type) => (docListeners.get(type) ?? []).forEach((fn) => fn()),
        listenerCount: (type) => (docListeners.get(type) ?? []).length,
    });
    win.focusField = () => { win.document.activeElement = { tagName: 'INPUT' }; };
    win.blurField = () => { win.document.activeElement = null; };
    return win;
}

const scaleOf = (win) => parseFloat(win.props.get('--ui-app-scale'));

test('a keyboard shrink stays refused after the field it belonged to has gone', () => {
    const win = keyboardWindow(1281, 801);
    installFit(win);
    assert.equal(scaleOf(win), 0.6675, 'the bench fit did not apply');

    win.focusField();
    win.innerHeight = 430;
    win.fire('resize');
    assert.equal(scaleOf(win), 0.6675, 'the keyboard shrank the whole panel');

    /* The person taps Save: the field goes, the keyboard is still up. */
    win.blurField();
    win.document.fire('focusout');
    assert.equal(scaleOf(win), 0.6675,
        `focusout with the keyboard still up refitted to ${scaleOf(win)}, taking the keyboard height for the screen`);

    /* And any resize that arrives at the same shrunken height is the same hole. */
    win.fire('resize');
    assert.equal(scaleOf(win), 0.6675, 'a resize after the blur took the keyboard height for the screen');
    assert.equal(win.props.get('--ui-app-w'), '1919.1011235955057px',
        'the design width moved — the panel was re-laid-out at the keyboard height');

    win.innerHeight = 801;
    win.fire('resize');
    assert.equal(scaleOf(win), 0.6675, 'the panel did not come back when the keyboard closed');

    /* AND THE LATCH IS GONE, not stuck on: a real shrink after it releases is honoured. */
    win.innerHeight = 600;
    win.fire('resize');
    assert.equal(scaleOf(win), 0.5,
        'the latch never released — a genuine resize is now refused for ever');
});

test('the latch is narrow: it never fires without a field, and never blocks a grow', () => {
    /* The three shapes that must still get through, because the rule is meant to catch
     * exactly one thing and a guard that catches more is a different bug. */
    const win = keyboardWindow(1281, 801);
    installFit(win);

    /* 1. A shrink with nothing focused is a real window resize. */
    win.innerHeight = 600;
    win.fire('resize');
    assert.equal(scaleOf(win), 0.5, 'a shrink with nothing focused was refused');

    /* 2. A GROW while a field has focus is a keyboard being dismissed, or a rotation. */
    win.focusField();
    win.innerHeight = 1200;
    win.fire('resize');
    assert.equal(scaleOf(win), 1, 'a grow during typing was refused');

    /* 3. And the keyboard closing WITHOUT leaving the field still comes back — the
     *    latch releases on the height, not on the blur. */
    win.innerHeight = 430;
    win.fire('resize');
    assert.equal(scaleOf(win), 1, 'the keyboard shrank the panel');
    win.innerHeight = 1200;
    win.fire('resize');
    assert.equal(scaleOf(win), 1, 'the panel did not return when the keyboard closed under focus');
});

function timedWindow(width, height) {
    const win = keyboardWindow(width, height);
    const timers = new Map();
    let next = 1;
    win.setTimeout = (fn, ms) => { timers.set(next, { fn, ms }); return next++; };
    win.clearTimeout = (id) => { timers.delete(id); };
    win.pending = () => timers.size;
    /** Fire every armed timer once, in order. */
    win.tick = () => {
        for (const [id, timer] of [...timers]) { timers.delete(id); timer.fn(); }
    };
    return win;
}

const appWidth = (win) => parseFloat(win.props.get('--ui-app-w')) * scaleOf(win);

/** The three fit properties as published on the document. */
const publishedFit = (win) => ({
    scale: parseFloat(win.props.get('--ui-app-scale')),
    designWidth: parseFloat(win.props.get('--ui-app-w')),
    designHeight: parseFloat(win.props.get('--ui-app-h')),
});

test('a resize that changes the WIDTH is never a keyboard, focused or not', () => {
    /* A keyboard takes height off the bottom of the layout viewport and touches nothing
     * else, so a width that moved is proof this is a different screen. */
    const win = timedWindow(1281, 801);
    installFit(win);
    assert.equal(scaleOf(win), 0.6675);

    win.focusField();
    win.innerWidth = 1000; win.innerHeight = 600;
    win.fire('resize');

    assert.deepEqual(publishedFit(win), computeFit({ width: 1000, height: 600 }),
        'the fit is not the one this viewport computes');
    assert.ok(appWidth(win) <= 1000 + 0.5,
        `the app is ${appWidth(win)} CSS px wide inside a 1000 px window`);

    win.blurField();
    win.document.fire('focusout');
    assert.deepEqual(publishedFit(win), computeFit({ width: 1000, height: 600 }));
    assert.equal(win.pending(), 0, 'a settle was armed for a latch that was never taken');
});

test('an orientation change while a field has focus refits at once', () => {
    /* Portrait is not a supported layout, but the fit must still be the one this
     * viewport computes rather than the landscape one it was holding. */
    const win = timedWindow(1281, 801);
    installFit(win);
    win.focusField();
    win.innerWidth = 801; win.innerHeight = 1281;
    win.fire('resize');
    assert.deepEqual(publishedFit(win), computeFit({ width: 801, height: 1281 }),
        'a rotation under a focused field was taken for a keyboard');
});

test('a same-width shrink IS latched, and editing ending releases it on a settled frame', () => {
    const win = timedWindow(1281, 801);
    installFit(win);
    win.focusField();
    win.innerHeight = 600;
    win.fire('resize');
    assert.equal(scaleOf(win), 0.6675, 'a shrink under a focused field was not refused');
    assert.equal(win.pending(), 0, 'a settle was armed while the field still had focus');

    /* Editing ends. Nothing is decided in the handler — the settle is armed. */
    win.blurField();
    win.document.fire('focusout');
    assert.equal(scaleOf(win), 0.6675,
        `focusout refitted to ${scaleOf(win)} in the handler instead of arming the settle`);
    assert.equal(win.pending(), 1, 'editing ended under a short viewport and nothing was armed');

    /* The window really is 600 high, and it still is when the settle fires. */
    win.tick();
    assert.deepEqual(publishedFit(win), computeFit({ width: 1281, height: 600 }),
        'the latch never released — the app is stuck at a size the window does not have');
    assert.ok(appWidth(win) <= 1281 + 0.5);
});

test('a keyboard that closes inside the settle window does not collapse the panel', () => {
    /* `focusout` can arrive with the keyboard still up. The settle re-measures, so a
     * keyboard that has gone by the time it fires reads as the full height. */
    const win = timedWindow(1281, 801);
    installFit(win);
    win.focusField();
    win.innerHeight = 430;
    win.fire('resize');
    win.blurField();
    win.document.fire('focusout');
    assert.equal(scaleOf(win), 0.6675, 'the panel collapsed in the focusout handler');

    /* The keyboard closes. No resize is delivered — only the height is back. */
    win.innerHeight = 801;
    win.tick();
    assert.equal(scaleOf(win), 0.6675, 'the panel did not come back when the keyboard closed');
    assert.deepEqual(publishedFit(win), computeFit({ width: 1281, height: 801 }));
});

test('a viewport still moving when the settle fires is measured again, not believed', () => {
    const win = timedWindow(1281, 801);
    installFit(win);
    win.focusField();
    win.innerHeight = 430;
    win.fire('resize');
    win.blurField();
    win.document.fire('focusout');

    /* Mid-animation: the height has moved since the settle was armed. */
    win.innerHeight = 560;
    win.tick();
    assert.equal(scaleOf(win), 0.6675, 'a frame mid-animation was taken for the settled size');
    assert.equal(win.pending(), 1, 'the settle did not re-arm — the latch is now stuck');

    /* It stops moving. */
    win.tick();
    assert.deepEqual(publishedFit(win), computeFit({ width: 1281, height: 560 }));
});

test('a field focused again during the settle keeps the latch', () => {
    const win = timedWindow(1281, 801);
    installFit(win);
    win.focusField();
    win.innerHeight = 430;
    win.fire('resize');
    win.blurField();
    win.document.fire('focusout');

    /* The person taps the next field. The keyboard never went. */
    win.focusField();
    win.tick();
    assert.equal(scaleOf(win), 0.6675, 'the panel shrank while the keyboard was being typed on');
});

test('the settle does not outlive the stop function', () => {
    const win = timedWindow(1281, 801);
    const stop = installFit(win);
    win.focusField();
    win.innerHeight = 600;
    win.fire('resize');
    win.blurField();
    win.document.fire('focusout');
    assert.equal(win.pending(), 1);
    stop();
    assert.equal(win.pending(), 0, 'a settle was left armed on a window nothing is fitting any more');
});

/**
 * Pull the fit's inline script out of index.html and run it against a fake window.
 * Located by the properties it writes rather than by position, so adding a third
 * inline script above it does not silently start testing the wrong one.
 */
function runInlineFit(win) {
    const html = readFileSync(path.join(REPO, 'index.html'), 'utf8');
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    const source = scripts.filter((s) => s.includes('--ui-app-scale'));
    assert.equal(source.length, 1,
        'index.html does not carry exactly one inline fit script — the pre-paint copy moved or vanished');
    // eslint-disable-next-line no-new-func
    new Function('window', 'document', `${source[0]}`)(win, win.document);
    return win.props;
}

test('the inline pre-paint copy agrees with the module at every geometry', () => {
    for (const g of AGREEMENT_GEOMETRIES) {
        const inline = runInlineFit(fakeWindow(g.width, g.height));
        const win = fakeWindow(g.width, g.height);
        applyFit(win.document, computeFit(g));

        for (const key of ['--ui-app-scale', '--ui-app-w', '--ui-app-h']) {
            assert.equal(inline.get(key), win.props.get(key),
                `${g.name}: index.html and app-fit.js disagree on ${key} — the tablet would paint one `
                + 'geometry before first paint and a different one after it');
        }
    }
});

test('the inline copy refuses a zero viewport instead of writing NaN', () => {
    const props = runInlineFit(fakeWindow(0, 0));
    assert.equal(props.size, 0, 'a teardown-sized viewport wrote NaN into the fit');
});

