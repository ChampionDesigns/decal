/**
 * The full-screen chart owns the keyboard while it is up, and the steam chart does not
 * advertise a door it has not got. Both are asserted through real key presses and clicks.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, BENCH } from '../harness/index.js';

const MODULE = ['/src/screens/live-screen.js'];
const STAGE = '<div id="stage" style="inline-size: 100%; block-size: 100dvh"><live-screen></live-screen></div>';
const SHOT_URL = '/tools/rea-fixtures/api__v1__shots__cd020a51-f353-4ffb-8389-72c931640181.json';

const SCREEN = 'live-screen';
const CARD = `${SCREEN} >>> ui-chart-card`;
const WELL = `${CARD} >>> .well`;
const OVERLAY = `${SCREEN} >>> live-expanded-chart`;

/** Fill a real buffer and hand it over, the way the wiring row does. */
const FEED = `(async () => {
    const { createShotBuffer } = await import('/src/stores/shot-buffer.js');
    const record = await (await fetch('${SHOT_URL}')).json();
    const screen = document.querySelector('live-screen');
    await screen.updateComplete;
    const card = screen.shadowRoot.querySelector('ui-chart-card');
    await card.ready;
    const buffer = createShotBuffer({});
    buffer.open(record.id, {});
    for (let i = 0; i < 200; i += 1) buffer.addSample(record.measurements[i]);
    screen.shot = buffer;
    await screen.updateComplete;
    await card.updateComplete;
    card.drawNow();
    return card.derivation.ok;
})()`;

/**
 * The caret, through every shadow boundary, plus which surface it is inside.
 * `deepActiveElement` is the app's own walk, imported rather than rewritten.
 */
const CARET = `(async () => {
    const { deepActiveElement } = await import('/src/lib/focus-trap.js');
    const el = deepActiveElement();
    const overlay = document.querySelector('live-screen').shadowRoot
        .querySelector('live-expanded-chart');
    const within = (node, surface) => {
        for (let at = node; at; at = at.parentNode ?? at.host ?? null) {
            if (at === surface) return true;
            if (at.parentNode == null && at.host == null) return false;
        }
        return false;
    };
    const host = el?.getRootNode?.()?.host ?? null;
    return {
        tag: el ? el.tagName.toLowerCase() : null,
        id: el ? el.id : null,
        name: el ? (el.getAttribute('aria-label') ?? (el.textContent ?? '').trim().slice(0, 40)) : null,
        inOverlay: Boolean(el && overlay && within(el, overlay)),
        hostTag: host ? host.tagName.toLowerCase() : null,
    };
})()`;

const caret = (page) => page.eval(CARET);

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

describe(`the expanded chart's modality @ ${BENCH.name}`, () => {
    const mounted = (fn) => browser.withPage({ geometry: BENCH }, async (page) => {
        await page.mount(STAGE, MODULE);
        await page.settle(4);
        assert.deepEqual(page.pageErrors, [], 'the screen must mount without throwing');
        await fn(page);
        assert.deepEqual(page.pageErrors, [], 'and run without throwing');
    });

    test('opening it moves the caret into the overlay and Tab never leaves', () => mounted(async (page) => {
        assert.equal(await page.eval(FEED), true, 'the premise: there is a shot to expand');

        await page.focusVisible(WELL);
        const invoker = await caret(page);
        assert.equal(invoker.hostTag, 'ui-chart-card', 'the premise: the caret is on the Live chart');

        await page.press('Enter');
        await page.settle(3);
        assert.equal(await page.evalFn((s) => window.__h.need(s).open === true, OVERLAY), true,
            'Enter on the plot opens the expanded chart');

        const opened = await caret(page);
        assert.equal(opened.inOverlay, true,
            `the caret stayed on the covered page: ${JSON.stringify(opened)}`);

        /* Ten presses is more than the overlay has controls, so the cycle must wrap. */
        for (let i = 0; i < 10; i += 1) {
            await page.press('Tab');
            const at = await caret(page);
            assert.equal(at.inOverlay, true,
                `Tab ${i + 1} left the overlay and landed on ${JSON.stringify(at)}`);
        }
        /* Backwards too: the browser's own cycle is not symmetric. */
        for (let i = 0; i < 10; i += 1) {
            await page.press('Tab', { modifiers: 8 });
            const at = await caret(page);
            assert.equal(at.inOverlay, true,
                `Shift+Tab ${i + 1} left the overlay and landed on ${JSON.stringify(at)}`);
        }
    }));

    test('the covered page is inert while it is up, and live again when it is not', () => mounted(async (page) => {
        await page.eval(FEED);
        const before = await page.evalFn((s) => {
            const root = window.__h.need(s).shadowRoot;
            return [...root.children].map((el) => ({ tag: el.tagName.toLowerCase(), inert: el.inert === true }));
        }, SCREEN);
        assert.ok(before.every((el) => !el.inert), 'the premise: nothing is inert at rest');

        await page.click(WELL);
        await page.settle(3);

        const during = await page.evalFn((s) => {
            const root = window.__h.need(s).shadowRoot;
            return [...root.children].map((el) => ({ tag: el.tagName.toLowerCase(), inert: el.inert === true }));
        }, SCREEN);
        const overlay = during.find((el) => el.tag === 'live-expanded-chart');
        assert.ok(overlay && !overlay.inert, 'the overlay itself is never marked');
        assert.ok(during.filter((el) => el.tag !== 'live-expanded-chart').every((el) => el.inert),
            `every covered band must be inert: ${JSON.stringify(during)}`);

        const reachable = await page.evalFn(async (s) => {
            const { flatTabbables } = await import('/src/lib/focus-trap.js');
            const screen = window.__h.need(s);
            const overlayEl = screen.shadowRoot.querySelector('live-expanded-chart');
            const within = (node, surface) => {
                for (let at = node; at; at = at.parentNode ?? at.host ?? null) {
                    if (at === surface) return true;
                    if (at.parentNode == null && at.host == null) return false;
                }
                return false;
            };
            return flatTabbables(screen).filter((el) => !within(el, overlayEl)).length;
        }, SCREEN);
        assert.equal(reachable, 0, 'a covered control is still in the Tab order');

        await page.press('Escape');
        await page.settle(3);
        const after = await page.evalFn((s) => {
            const root = window.__h.need(s).shadowRoot;
            return [...root.children].every((el) => el.inert !== true);
        }, SCREEN);
        assert.equal(after, true, 'closing releases exactly what opening marked');
    }));

    test('Escape closes it and the caret goes back to the chart that opened it', () => mounted(async (page) => {
        await page.eval(FEED);
        await page.focusVisible(WELL);
        await page.press('Enter');
        await page.settle(3);
        assert.equal(await page.evalFn((s) => window.__h.need(s).open === true, OVERLAY), true);

        await page.press('Escape');
        await page.settle(3);

        assert.equal(await page.evalFn((s) => window.__h.need(s).open === true, OVERLAY), false,
            'Escape returns to the Live screen');
        assert.equal(await page.evalFn((s) => window.__h.need(s)._expanded === true, SCREEN), false,
            'and the screen agrees it is closed — the overlay tells it rather than only itself');

        const home = await caret(page);
        assert.equal(home.hostTag, 'ui-chart-card',
            `the caret must come home to the chart that opened it: ${JSON.stringify(home)}`);
        assert.equal(home.inOverlay, false, 'and not to a surface that is no longer on screen');
    }));
});

/**
 * A real steam session through the shipped buffer and the shipped mode: the ramp before
 * the valve opens, the pour, a pause inside it, and the hold after it closes.
 */
const STEAM = (phase) => `(async () => {
    const { createSteamBuffer } = await import('/src/stores/steam-buffer.js');
    const { CHART_MODE } = await import('/src/lib/steam-chart.js');
    const screen = document.querySelector('live-screen');
    await screen.updateComplete;
    const buffer = createSteamBuffer({});
    const frame = (pouring, at, temp) => buffer.take({
        mode: CHART_MODE.STEAM,
        pouring,
        machine: { pressure: 1.2, flow: 0.8, steamTemperature: temp, milkTemperature: null },
        at,
    });
    const phase = '${phase}';
    // The ramp: the mode is steam and the valve has not opened yet.
    frame(false, 1000, 100);
    if (phase !== 'ramp') {
        for (let i = 0; i < 40; i += 1) frame(true, 1100 + i * 100, 100 + i);
    }
    if (phase === 'paused' || phase === 'hold') frame(false, 6000, 140);
    screen.chartMode = CHART_MODE.STEAM;
    screen.steamDerivation = buffer.get();
    screen.steamSettled = phase === 'hold';
    await screen.updateComplete;
    const card = screen.shadowRoot.querySelector('ui-chart-card');
    await card.updateComplete;
    return { samples: screen.steamDerivation.counts.samples, mode: screen.chartMode };
})()`;

describe(`the steam chart advertises only what it does @ ${BENCH.name}`, () => {
    const mounted = (fn) => browser.withPage({ geometry: BENCH }, async (page) => {
        await page.mount(STAGE, MODULE);
        await page.settle(4);
        assert.deepEqual(page.pageErrors, [], 'the screen must mount without throwing');
        await fn(page);
        assert.deepEqual(page.pageErrors, [], 'and run without throwing');
    });

    for (const phase of ['ramp', 'pour', 'paused', 'hold']) {
        test(`during ${phase} the plot is not a button, and pressing it changes nothing`, () => mounted(async (page) => {
            const state = await page.eval(STEAM(phase));
            assert.equal(state.mode, 'steam', 'the premise: the steam chart holds the canvas');

            const well = await page.evalFn((s) => {
                const card = window.__h.need(s);
                const plot = card.shadowRoot.querySelector('.well');
                return {
                    activate: card.activate === true,
                    role: plot.getAttribute('role'),
                    tabindex: plot.getAttribute('tabindex'),
                    name: plot.getAttribute('aria-label'),
                    label: card.label,
                };
            }, CARD);

            assert.equal(well.activate, false,
                'a chart that refuses to open must not be an activator');
            assert.equal(well.role, 'group', `the well is announced as ${well.role}`);
            assert.equal(well.tabindex, null, 'and it does not take the caret');
            assert.notEqual(well.name, 'Open the shot charts',
                'the name must not promise a door that is not there');

            await page.click(WELL);
            await page.settle(2);
            assert.equal(await page.evalFn((s) => window.__h.need(s).open === true, OVERLAY), false,
                'a click on the steam chart does not open an espresso surface');
            assert.equal(await page.evalFn((s) => window.__h.need(s)._expanded === true, SCREEN), false,
                'and nothing behind the screen thinks it opened one');

            const said = await page.evalFn((s) => window.__h.need(s)
                .shadowRoot.querySelector('.chart-summary').textContent.trim(), SCREEN);
            assert.match(said, /steam/i, `the summary still describes an espresso shot: "${said}"`);
            assert.match(said, /expanded/i,
                `the missing expanded view must be stated, not merely absent: "${said}"`);
        }));
    }

    test('an espresso shot keeps the door it really has', () => mounted(async (page) => {
        await page.eval(FEED);
        const well = await page.evalFn((s) => {
            const card = window.__h.need(s);
            const plot = card.shadowRoot.querySelector('.well');
            return {
                activate: card.activate === true,
                role: plot.getAttribute('role'),
                name: plot.getAttribute('aria-label'),
            };
        }, CARD);
        assert.equal(well.activate, true, 'the espresso chart still opens');
        assert.equal(well.role, 'button');
        assert.equal(well.name, 'Open the shot charts');
    }));
});
