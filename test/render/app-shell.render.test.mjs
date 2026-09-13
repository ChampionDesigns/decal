/**
 * The application shell, in a real engine, at both standard geometries (.1, live-app-shell).
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES, BENCH } from '../harness/index.js';

const FIXTURE = ['/test/fixtures/app-shell-fixture.js'];
const PROBE = ['/test/fixtures/probe-screen.js'];
const MODULES = [...FIXTURE, ...PROBE];

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

/** The shell's own state object, read out of the page in one round trip. */
const shellState = (page) => page.evalFn(() => window.__shell.state());

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`app shell @ ${geometry.name} (${geometry.width}×${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

        const booted = (fn, options = {}) => browser.withPage({ geometry }, async (page) => {
            await page.mount('', MODULES);
            const state = await page.evalFn((opts) => window.__shell.mount(opts), options);
            assert.deepEqual(page.pageErrors, [], 'the shell must boot without throwing');
            return fn(page, state);
        });

        test('a stored display size is applied at BOOT, not when Settings is opened',
            () => browser.withPage({ geometry }, async (page) => {
                await page.mount('', MODULES);
                await page.evalFn(() => window.__shell.mount({
                    backends: { kv: { kind: 'memory', get: (k) => (k === 'density' ? 'largest' : undefined), set() {}, remove() {} } },
                }));
                await page.settle(6);

                const applied = await page.evalFn(() => ({
                    base: getComputedStyle(document.documentElement)
                        .getPropertyValue('--ui-density-base').trim(),
                    scale: getComputedStyle(document.documentElement)
                        .getPropertyValue('--ui-type-scale').trim(),
                }));
                assert.notEqual(applied.base, '', 'the boot put the stored size on the root');
                assert.notEqual(applied.scale, '', 'and the type scale with it');
            }));

        test('nothing stored comes up at Fit screen, which changes nothing',
            () => browser.withPage({ geometry }, async (page) => {
                await page.mount('', MODULES);
                await page.evalFn(() => window.__shell.mount());
                await page.settle(6);
                const base = await page.evalFn(() => getComputedStyle(document.documentElement)
                    .getPropertyValue('--ui-density-base').trim());
                assert.equal(base, '1', 'Fit screen is factor 1 — the same size the sheet draws');
            }));

        test('the screensaver is MOUNTED, and the wake is the shell\'s to send', () => booted(async (page) => {
            assert.ok(await page.exists('app-root >>> ui-screensaver'), 'the blank is in the shell');

            const wake = await page.evalFn(async () => {
                const root = document.querySelector('app-root');
                const saver = root.shadowRoot.querySelector('#screensaver');
                /* THE POLICY IS A PURE FUNCTION OF THE CONFIRMED STATE — the shell never
                 * raises it optimistically, so this drives the state the feed drives. */
                saver.machineState = 'sleeping';
                await saver.updateComplete;
                const asleep = saver.active;
                saver.dispatchEvent(new CustomEvent('ui-screensaver-wake', { bubbles: true, composed: true }));
                await new Promise((r) => setTimeout(r, 60));
                return { asleep, request: root.boot.machineState.get() };
            });

            assert.equal(wake.asleep, true, 'a confirmed sleep raises the blank');
            assert.equal(wake.request.requested, 'idle',
                'and the press reaches the machine — a full-screen blank with no way off '
                + 'it is worse than no blank');
        }));

        test('a wake that did not reach the machine is reported on the blank', () => booted(async (page) => {
            const wake = await page.evalFn(async () => {
                const root = document.querySelector('app-root');
                const saver = root.shadowRoot.querySelector('#screensaver');
                saver.machineState = 'sleeping';
                await saver.updateComplete;
                saver.dispatchEvent(new CustomEvent('ui-screensaver-wake', { bubbles: true, composed: true }));
                await new Promise((r) => setTimeout(r, 120));
                await saver.updateComplete;
                return {
                    status: root.boot.machineState.get().status,
                    said: saver.wakeError,
                    drawn: saver.shadowRoot.getElementById('wake-error')?.textContent?.trim() ?? null,
                };
            });

            assert.equal(wake.status, 'failed', 'the request has to have failed, or this proves nothing');
            assert.match(wake.said, /did not wake/,
                'the press was answered by nothing a person can see');
            assert.equal(wake.drawn, wake.said, 'the shell set a property the blank does not draw');
        }));

        test('the DIM reaches the panel — the shell listens for it now', () => booted(async (page) => {
            const sent = await page.evalFn(async () => {
                const root = document.querySelector('app-root');
                const saver = root.shadowRoot.querySelector('#screensaver');
                const seen = [];
                const live = root.boot.live;
                const real = live.setBrightness.bind(live);
                live.setBrightness = (value) => { seen.push(value); return real(value); };
                saver.dispatchEvent(new CustomEvent('ui-screensaver-dim', {
                    bubbles: true, composed: true, detail: { brightness: 0 },
                }));
                await new Promise((r) => setTimeout(r, 30));
                return seen;
            });
            assert.deepEqual(sent, [0],
                'the port\'s SCREENSAVER_BRIGHTNESS, passed through — the shell holds no policy');
        }));

        test('a sleeping machine blanks the screen with nothing pressed', () => booted(async (page) => {
            const before = await page.evalFn(() => {
                const saver = document.querySelector('app-root').shadowRoot.querySelector('#screensaver');
                return { state: saver.machineState ?? null, active: saver.active };
            });
            assert.equal(before.active, false, 'an awake machine is not blanked');

            const asleep = await page.evalFn(async () => {
                window.__shell.pushMachineFrame('sleeping');
                const root = document.querySelector('app-root');
                const saver = root.shadowRoot.querySelector('#screensaver');
                await saver.updateComplete;
                return { state: saver.machineState, active: saver.active };
            });
            assert.equal(asleep.state, 'sleeping', 'the FEED reached the element, not a test');
            assert.equal(asleep.active, true, 'and the blank went up on its own');

            /* AND IT COMES DOWN, as a paint and never as a command. */
            const awake = await page.evalFn(async () => {
                window.__shell.pushMachineFrame('idle');
                const saver = document.querySelector('app-root').shadowRoot.querySelector('#screensaver');
                await saver.updateComplete;
                return { state: saver.machineState, active: saver.active };
            });
            assert.equal(awake.state, 'idle');
            assert.equal(awake.active, false);
        }));

        test('a tablet nobody has configured gets the DECIDED saver, not the black one',
            () => booted(async (page) => {
                const seen = await page.evalFn(async () => {
                    const root = document.querySelector('app-root');
                    const saver = root.shadowRoot.querySelector('#screensaver');
                    const dims = [];
                    const live = root.boot.live;
                    const real = live.setBrightness.bind(live);
                    live.setBrightness = (value) => { dims.push(value); return real(value); };

                    window.__shell.pushDisplayFrame();
                    /* `attachScreensaver` kicks a `load()` per key; those are promises. */
                    await new Promise((r) => setTimeout(r, 80));

                    window.__shell.pushMachineFrame('sleeping');
                    await saver.updateComplete;
                    await new Promise((r) => setTimeout(r, 60));
                    await saver.updateComplete;

                    return {
                        pageReads: root.boot.settings.value('screensaverType'),
                        stored: root.boot.settings.storedValue('screensaverType') ?? null,
                        active: saver.active,
                        supported: saver.brightnessSupported,
                        clock: saver.clock,
                        image: saver.image,
                        picture: Boolean(saver.shadowRoot.getElementById('saver-image')),
                        language: saver.language,
                        cycleReads: root.boot.settings.value('screensaverCycleMinutes'),
                        dims,
                    };
                });

                assert.equal(seen.stored, null,
                    'the premise: nothing is stored, which is every tablet until somebody '
                    + 'opens the page');
                assert.equal(seen.pageReads, 'image',
                    'the Settings page reads the decided default (settings-defaults.js)');
                assert.equal(seen.active, true, 'a confirmed sleep still blanks');
                assert.equal(seen.supported, true,
                    'the platform CAN dim — so a missing dim below is a decision, not an '
                    + 'absent capability');

                /* THE JOIN. The saver must read the same answer the page shows. */
                assert.equal(seen.clock, false, 'image is not clock');
                assert.notEqual(seen.image, '',
                    'the SAVER reads the same default the page draws — before this fix it '
                    + 'read undefined and painted a black screen');
                assert.equal(seen.picture, true,
                    'and the picture is actually in the shadow root, not just a property');

                assert.deepEqual(seen.dims, [],
                    'a picture painted on a panel at brightness 0 is a black screen with a '
                    + 'cost — Image and Clock send nothing at all');

                assert.equal(seen.language, 'en', 'the decided language, not the empty string');
                assert.equal(seen.cycleReads, 10, 'and his ten minutes, from the one table');
            }));

        test('and choosing Black on that same tablet DOES blank the panel, to 0',
            () => booted(async (page) => {
                const seen = await page.evalFn(async () => {
                    const root = document.querySelector('app-root');
                    const saver = root.shadowRoot.querySelector('#screensaver');
                    const dims = [];
                    const live = root.boot.live;
                    const real = live.setBrightness.bind(live);
                    live.setBrightness = (value) => { dims.push(value); return real(value); };

                    window.__shell.pushDisplayFrame();
                    await root.boot.settings.set('screensaverType', 'black');
                    await new Promise((r) => setTimeout(r, 80));

                    window.__shell.pushMachineFrame('sleeping');
                    await saver.updateComplete;
                    await new Promise((r) => setTimeout(r, 60));
                    return { image: saver.image, clock: saver.clock, active: saver.active, dims };
                });
                assert.equal(seen.active, true);
                assert.equal(seen.image, '', 'black paints nothing');
                assert.equal(seen.clock, false);
                /* SCREENSAVER_BRIGHTNESS, and 0 is the only value that both preserves
                 * ReaPrime's `_preSleepBrightness` and arms its restore
                 * (`display_controller.dart:277-285`). */
                assert.deepEqual(seen.dims, [0],
                    'Black is the saver the dim belongs to, and it still spends it');
            }));

        test('the screen-saver preferences reach the blank — both of them', () => booted(async (page) => {
            const off = await page.evalFn(async () => {
                const root = document.querySelector('app-root');
                const saver = root.shadowRoot.querySelector('#screensaver');
                await root.boot.settings.set('screensaverEnabled', false);
                await new Promise((r) => setTimeout(r, 60));
                window.__shell.pushMachineFrame('sleeping');
                await saver.updateComplete;
                return { enabled: saver.enabled, active: saver.active, state: saver.machineState };
            });
            assert.equal(off.state, 'sleeping', 'the machine is asleep');
            assert.equal(off.enabled, false, 'the preference reached the element');
            assert.equal(off.active, false, 'and a saver the user switched off does not blank the screen');

            const on = await page.evalFn(async () => {
                const root = document.querySelector('app-root');
                const saver = root.shadowRoot.querySelector('#screensaver');
                await root.boot.settings.set('screensaverEnabled', true);
                await new Promise((r) => setTimeout(r, 60));
                await saver.updateComplete;
                return { enabled: saver.enabled, active: saver.active };
            });
            assert.equal(on.enabled, true);
            assert.equal(on.active, true, 'switching it back on blanks the still-sleeping machine');
        }));

        test('the faint clock is OFF by default and appears when it is asked for', () => booted(async (page) => {
            const blanked = await page.evalFn(async () => {
                const saver = document.querySelector('app-root').shadowRoot.querySelector('#screensaver');
                window.__shell.pushMachineFrame('sleeping');
                await saver.updateComplete;
                return { active: saver.active, clock: saver.clock, drawn: Boolean(saver.shadowRoot.getElementById('clock')) };
            });
            assert.equal(blanked.active, true);
            assert.equal(blanked.clock, false, 'off until it is asked for');
            assert.equal(blanked.drawn, false, 'and nothing is painted — not a hidden element');

            const shown = await page.evalFn(async () => {
                const root = document.querySelector('app-root');
                const saver = root.shadowRoot.querySelector('#screensaver');
                await root.boot.settings.set('screensaverType', 'clock');
                await new Promise((r) => setTimeout(r, 60));
                await saver.updateComplete;
                const el = saver.shadowRoot.getElementById('clock');
                const style = el ? getComputedStyle(el) : null;
                const box = el ? el.getBoundingClientRect() : null;
                const host = saver.getBoundingClientRect();
                const page_ = getComputedStyle(document.documentElement);
                return {
                    text: el ? el.textContent.trim() : null,
                    font: style ? style.fontFamily : null,
                    skinFont: page_.getPropertyValue('--ui-font-family').trim(),
                    hidden: el ? el.getAttribute('aria-hidden') : null,
                    dx: box ? Math.round((box.left + box.width / 2) - (host.left + host.width / 2)) : null,
                    dy: box ? Math.round((box.top + box.height / 2) - (host.top + host.height / 2)) : null,
                };
            });
            assert.match(shown.text ?? '', /^\d{1,2}:\d{2}\s?(am|pm)$/i,
                "the ruling: 12-hour, everywhere, on a tablet nobody has set");

            /* AND THE PREFERENCE MOVES BOTH HALVES. A test that checked only the settings
             * page would have passed throughout the bug. */
            const twentyFour = await page.evalFn(async () => {
                const root = document.querySelector('app-root');
                const saver = root.shadowRoot.querySelector('#screensaver');
                await root.boot.settings.set('clockFormat', '24h');
                await new Promise((r) => setTimeout(r, 1200));
                await saver.updateComplete;
                return saver.shadowRoot.getElementById('clock')?.textContent.trim() ?? null;
            });
            assert.match(twentyFour ?? '', /^\d{2}:\d{2}$/,
                'and choosing 24-hour gives the fixed-width spelling, from the same one formatter');
            await page.evalFn(async () => {
                const root = document.querySelector('app-root');
                await root.boot.settings.set('clockFormat', '12h');
                await new Promise((r) => setTimeout(r, 1200));
                return true;
            });
            /* "in the same font the skin uses" — the FAMILY the document declares, not a
             * face this component chose. */
            assert.ok(shown.skinFont.length > 0, 'the skin declares a family');
            const face = (list) => list.split(',')[0].trim().replace(/^["']|["']$/g, '');
            assert.equal(face(shown.font), face(shown.skinFont),
                `the clock is set in ${shown.font}, the skin in ${shown.skinFont}`);
            /* THE BUTTON CARRIES THE NAME. A time read out on top of "wake the machine"
             * is noise on a screen whose only action is a wake. */
            assert.equal(shown.hidden, 'true');
            assert.equal(shown.dx, 0, 'centred');
            assert.equal(shown.dy, 0);
        }));

        test('the clock drifts one text height and a fifth, and comes back to centre', () => booted(async (page) => {
            const drift = await page.evalFn(async () => {
                const root = document.querySelector('app-root');
                const saver = root.shadowRoot.querySelector('#screensaver');
                await root.boot.settings.set('screensaverType', 'clock');
                await new Promise((r) => setTimeout(r, 60));
                window.__shell.pushMachineFrame('sleeping');
                await saver.updateComplete;
                await saver.updateComplete;

                const el = saver.shadowRoot.getElementById('clock');
                if (!el) return { count: -1 };
                const host = saver.getBoundingClientRect();
                const offset = () => {
                    const b = el.getBoundingClientRect();
                    return (b.top + b.height / 2) - (host.top + host.height / 2);
                };

                const animations = el.getAnimations();
                if (animations.length !== 1) return { count: animations.length };
                const animation = animations[0];
                const duration = animation.effect.getTiming().duration;

                const at = async (fraction) => {
                    animation.currentTime = duration * fraction;
                    await new Promise((r) => requestAnimationFrame(r));
                    return offset();
                };

                const start = await at(0);
                const quarter = await at(0.25);
                const half = await at(0.5);
                const end = await at(1);
                /* ALTERNATE: the second half of the pair is the same path in reverse, so
                 * two durations is one full cycle and lands back where it began. */
                const cycle = await at(2);
                await at(0);
                const height = el.getBoundingClientRect().height;

                return {
                    count: 1,
                    timing: getComputedStyle(el).animationTimingFunction,
                    direction: getComputedStyle(el).animationDirection,
                    start, quarter, half, end, cycle, height, duration,
                };
            });

            assert.equal(drift.count, 1, 'one animation, and it is the drift');
            assert.equal(Math.round(drift.start) + 0, 0, 'it starts in the very centre');
            assert.ok(drift.end < 0, 'and it goes UP');
            assert.equal(Math.round(drift.cycle) + 0, 0, 'a full alternate cycle returns to centre');

            const ratio = Math.abs(drift.end) / drift.height;
            assert.ok(Math.abs(ratio - 1.2) < 0.02,
                `the travel is ${ratio.toFixed(3)} text heights, and 1.2 was asked for`);

            assert.equal(drift.timing, 'linear');
            assert.equal(drift.direction, 'alternate');
            assert.ok(Math.abs(drift.quarter / drift.end - 0.25) < 0.02, 'a quarter of the way in, a quarter of the way up');
            assert.ok(Math.abs(drift.half / drift.end - 0.5) < 0.02, 'and half at half');

            /* SLOW ENOUGH THAT A GLANCE DOES NOT SEE IT. "Drift a little" is the
             * requirement; a clock that visibly slides is a different thing. */
            const pixelsPerSecond = Math.abs(drift.end) / (drift.duration / 1000);
            assert.ok(pixelsPerSecond < 3, `${pixelsPerSecond.toFixed(2)} px/s is a drift, not a slide`);
        }));

        test('the clock is the same ink in both themes, because the ground is', () => booted(async (page) => {
            const inks = await page.evalFn(async () => {
                const root = document.querySelector('app-root');
                const saver = root.shadowRoot.querySelector('#screensaver');
                await root.boot.settings.set('screensaverType', 'clock');
                await new Promise((r) => setTimeout(r, 60));
                window.__shell.pushMachineFrame('sleeping');
                await saver.updateComplete;
                const out = {};
                for (const theme of ['light', 'dark']) {
                    document.documentElement.setAttribute('data-theme', theme);
                    await new Promise((r) => setTimeout(r, 30));
                    out[theme] = getComputedStyle(saver.shadowRoot.getElementById('clock')).color;
                }
                document.documentElement.removeAttribute('data-theme');
                return out;
            });
            assert.equal(inks.light, inks.dark, 'a ground that ignores the theme cannot carry an ink that follows it');
            const lightness = Number(/oklab\(([\d.]+)/.exec(inks.light)?.[1]);
            assert.ok(lightness > 0.8, `the ink is light on a black ground (measured ${lightness})`);
        }));

        test('the saver survives a route change — one element for the life of the shell', () => booted(async (page) => {
            const same = await page.evalFn(async () => {
                const root = document.querySelector('app-root');
                const first = root.shadowRoot.querySelector('#screensaver');
                await window.__shell.goto('probe');
                const second = root.shadowRoot.querySelector('#screensaver');
                window.__shell.pushMachineFrame('sleeping');
                await second.updateComplete;
                return { identical: first === second, active: second.active, state: second.machineState };
            });
            assert.equal(same.identical, true, 'Lit rebuilt the saver, so the shell stopped feeding it');
            assert.equal(same.state, 'sleeping');
            assert.equal(same.active, true, 'and a sleeping machine still blanks the screen from Probe');
        }));

        test('the shell boots to Live against the REST mock', () => booted(async (page) => {
            const state = await page.evalFn(() => window.__shell.capabilitiesSettled());

            assert.equal(state.phase, 'ready', 'the shell reaches ready');
            assert.equal(state.route, 'live', 'Live is the default route');
            assert.equal(state.screenTag, 'live-screen');
            assert.equal(state.screenCount, 1, 'exactly one screen is mounted');
            assert.equal(state.ariaBusy, 'false', 'and it stops announcing itself as busy');
            assert.ok(await page.exists('app-root >>> live-screen'), 'the screen is in the shell\'s shadow root');

            // The eight channels the live layer opens — the shell dials none of them itself.
            assert.deepEqual(state.sockets.map((u) => new URL(u).pathname).sort(), [
                '/ws/v1/devices',
                '/ws/v1/display',
                '/ws/v1/machine/shotState',
                '/ws/v1/machine/snapshot',
                '/ws/v1/machine/waterLevels',
                '/ws/v1/plugins/weather.reaplugin/weather',
                '/ws/v1/scale/snapshot',
                '/ws/v1/update',
            ]);

            const calls = await page.evalFn(() => window.__shell.calls());

            const RACING = 7;
            const ordered = calls.slice(0, calls.length - RACING);
            const byPath = (a, b) => a.path.localeCompare(b.path);
            const racing = calls.slice(calls.length - RACING).sort(byPath);
            assert.deepEqual([...ordered, ...racing], [
                /* Read on the START path, so it is the first call out. */
                { path: '/api/v1/plugins', method: 'GET' },
                { path: '/api/v1/machine/capabilities', method: 'GET' },
                { path: '/api/v1/machine/info', method: 'GET' },
                { path: '/api/v1/workflow', method: 'GET' },
                { path: '/api/v1/profiles?includeHidden=true', method: 'GET' },
                { path: '/api/v1/shots?limit=25&offset=0&order=desc', method: 'GET' },
                { path: '/api/v1/settings', method: 'GET' },
                { path: '/api/v1/machine/cupWarmer', method: 'GET' },
                { path: '/api/v1/workflow', method: 'GET' },
                { path: '/api/v1/store/decal/favouriteProfiles', method: 'GET' },
                /* The last two are the racing pair, listed in sorted order — see the
                 * note above the assertion. */
                { path: '/api/v1/machine/cupWarmer/preheat', method: 'GET' },
                /* THE PLUGIN LISTING, ASKED BY THE SCREEN THAT READS IT — see the note on
                 * `RACING` above. One request, one reader, and it is `<live-wiring>`. */
                { path: '/api/v1/store/decal/drinkOutPresets', method: 'GET' },
                { path: '/api/v1/store/decal/favouriteProfiles', method: 'POST' },
                { path: '/api/v1/store/decal/favouriteProfilesSeeded', method: 'GET' },
                { path: '/api/v1/store/decal/steamFlowPresets', method: 'GET' },
                { path: '/api/v1/store/decal/tempUnit', method: 'GET' },
                { path: '/api/v1/store/decal/waterTankUnit', method: 'GET' },
            ]);

            assert.ok(['ready', 'error'].includes(state.capabilityStatus), state.capabilityStatus);
            if (state.capabilityStatus === 'error') {
                assert.equal(state.capabilityEntries, null, 'a failed read is NOT an empty capability set');
                assert.equal(state.offersCupWarmer, false, 'unknown gates stay closed');
            }
        }));

        test('a machine key reaches PUT /machine/state, and so does the abort',
            () => booted(async (page) => {
                await page.evalFn(() => window.__shell.capabilitiesSettled());
                const asked = await page.evalFn(async () => {
                    const root = document.querySelector('app-root');
                    const screen = root.shadowRoot.querySelector('live-screen');
                    root.boot.capabilities.groupHeadController = () => ({
                        capability: 'absent', known: true, value: false, reason: null,
                        provisional: false, tag: 'test', adapter: 'test', basis: null, swapWhen: null,
                    });
                    screen.requestUpdate();
                    await screen.updateComplete;
                    await screen.updateComplete;
                    const before = window.__shell.calls().length;
                    const key = screen.shadowRoot.querySelector('.ghc-strip ui-button[data-key="espresso"]');
                    key.shadowRoot.querySelector('button').click();
                    /* AND THE ABORT, from the one place it can be pressed at rest: the
                     * screen's own host listener, which is what `<ui-stop-button>` reaches
                     * from either the rail or the strip. */
                    screen.dispatchEvent(new CustomEvent('stop-request', {
                        detail: { reason: 'press' }, bubbles: true, composed: true,
                    }));
                    await new Promise((done) => { setTimeout(done, 400); });
                    return window.__shell.calls().slice(before);
                });
                assert.deepEqual(asked, [
                    { path: '/api/v1/machine/state/espresso', method: 'PUT' },
                    { path: '/api/v1/machine/state/idle', method: 'PUT' },
                ]);
            }));

        test('the shell is exactly one viewport tall and hands the screen the whole of it',
            () => booted(async (page) => {
                await page.evalFn(() => window.__shell.settled());
                const shell = await page.box('app-root');
                const screen = await page.box('app-root >>> live-screen');
                assert.equal(Math.round(shell.height), geometry.height,
                    'the shell paints exactly one viewport tall — one owner of the page '
                    + 'height (bug S3), now the fit rather than a raw 100dvh');
                assert.equal(Math.round(shell.width), geometry.width,
                    'the shell paints the full viewport width — a short answer here is a '
                    + 'document scrollbar, which the fit is supposed to have removed');
                assert.equal(Math.round(screen.height), Math.round(shell.height),
                    'the screen fills the shell\'s single grid row: a screen written to §4.1\'s '
                    + '`height: 100%` needs a definite box and this is where it comes from');
                assert.equal(Math.round(screen.width), Math.round(shell.width));

                const doc = await page.evalFn(() => ({
                    scrollHeight: document.documentElement.scrollHeight,
                    clientHeight: document.documentElement.clientHeight,
                    bodyOverflowY: getComputedStyle(document.body).overflowY,
                }));
                assert.ok(doc.scrollHeight <= doc.clientHeight + 1,
                    `the document scrolls: ${doc.scrollHeight} > ${doc.clientHeight}`);
                assert.equal(doc.bodyOverflowY, 'visible',
                    'and it is not hidden either — §2.4 exists to end silent clipping');
            }));

        test('the ground is --ui-canvas everywhere, with no second owner', () => booted(async (page) => {
            await page.evalFn(() => window.__shell.settled());
            const canvas = await page.resolveToken('--ui-canvas', 'background-color');
            const grounds = await page.evalFn(() => ({
                html: getComputedStyle(document.documentElement).backgroundColor,
                body: getComputedStyle(document.body).backgroundColor,
                root: getComputedStyle(document.querySelector('app-root')).backgroundColor,
            }));

            assert.equal(grounds.html, canvas, 'styles/document.css:36');
            assert.equal(grounds.root, canvas, 'styles/document.css:92 — the app-root ground');
            assert.equal(grounds.body, canvas);

            await page.setToken('--ui-canvas', 'rgb(255, 0, 170)');
            const moved = await page.evalFn(() => ({
                html: getComputedStyle(document.documentElement).backgroundColor,
                root: getComputedStyle(document.querySelector('app-root')).backgroundColor,
            }));
            assert.equal(moved.html, 'rgb(255, 0, 170)');
            assert.equal(moved.root, 'rgb(255, 0, 170)');
            await page.setToken('--ui-canvas', null);
        }));

        test('while the screen is loading the shell says so, and takes it back', () => booted(
            async (page) => {
                let state = await shellState(page);
                assert.equal(state.phase, 'connecting');
                assert.equal(state.ariaBusy, 'true');
                assert.equal(state.screenTag, null, 'no screen yet');

                // A polite live region, not an alert: starting up is not an interruption.
                assert.equal(await page.prop('app-root >>> .booting', 'display'), 'grid');
                assert.ok(await page.exists('app-root >>> ui-empty-state'),
                    'the boot surface composes the library\'s empty state, it does not draw its own');
                const role = await page.evalFn(
                    () => document.querySelector('app-root').shadowRoot.querySelector('.booting').getAttribute('role'),
                );
                assert.equal(role, 'status');
                const boot = await page.evalFn(() => {
                    const root = document.querySelector('app-root').shadowRoot;
                    const band = root.querySelector('.booting');
                    const empty = root.querySelector('ui-empty-state');
                    return {
                        band: band.getBoundingClientRect().width,
                        empty: empty.getBoundingClientRect().width,
                        lines: Math.round(empty.getBoundingClientRect().height),
                    };
                });
                assert.ok(boot.empty > 0,
                    `the boot message has no width at all (${boot.empty}px inside ${boot.band}px)`);
                assert.ok(boot.empty > boot.band / 2,
                    `the boot message shrink-wrapped to ${boot.empty}px of a ${boot.band}px surface`);

                state = await page.evalFn(() => window.__shell.releaseScreen());
                assert.equal(state.phase, 'ready');
                assert.equal(state.screenTag, 'live-screen');
                assert.equal(state.ariaBusy, 'false');
                assert.equal(await page.exists('app-root >>> ui-empty-state'), false,
                    'the boot surface goes when the screen arrives');
            },
            { screens: 'blocked' },
        ));

        test('a screen module that will not load leaves a message, not a blank page', () => booted(
            async (page) => {
                const state = await page.evalFn(() => window.__shell.settled());
                assert.equal(state.phase, 'error');
                assert.equal(state.ariaBusy, 'true');
                assert.equal(state.screenTag, null);

                assert.ok(await page.exists('app-root >>> #recovery-reload'));
                const text = await page.evalFn(
                    () => document.querySelector('app-root').shadowRoot.querySelector('.recovery [role="alert"]').textContent.trim(),
                );
                assert.ok(text.length > 0, 'the failure is explained');
                assert.ok(await page.exists('app-root >>> #recovery-details'));
                assert.ok(await page.exists('app-root >>> #recovery-copy'));
            },
            { screens: 'failing' },
        ));

        test('a header action from inside the screen navigates the shell',
            () => booted(async (page) => {
                await page.evalFn(() => window.__shell.capabilitiesSettled());

                for (const [action, routeId] of [
                    ['Settings', 'settings'],
                    ['Edit profile', 'editor'],
                ]) {
                    /* Dispatched on the SCREEN, composed and bubbling, exactly as the
                     * header's buttons do it — not on the shell, which would prove only
                     * that addEventListener works. */
                    await page.evalFn((detail) => {
                        const screen = document.querySelector('app-root').shadowRoot
                            .querySelector('live-screen, probe-screen, settings-screen, editor-screen');
                        screen.dispatchEvent(new CustomEvent('header-action', {
                            detail, bubbles: true, composed: true,
                        }));
                        return true;
                    }, { action });
                    const state = await page.evalFn(() => window.__shell.settled());
                    assert.equal(state.route, routeId, `${action} did not reach the ${routeId} route`);
                    const hash = await page.evalFn(() => location.hash);
                    assert.equal(hash, `#/${routeId}`, `${action} moved the screen but not the address`);

                    await page.evalFn(() => window.__shell.goto('live'));
                }
            }));

        test('the library button opens the profile picker', () => booted(async (page) => {
            await page.evalFn(() => window.__shell.capabilitiesSettled());
            await page.evalFn(() => {
                const screen = document.querySelector('app-root').shadowRoot
                    .querySelector('live-screen');
                screen.dispatchEvent(new CustomEvent('library-open', { bubbles: true, composed: true }));
                return true;
            });
            const state = await page.evalFn(() => window.__shell.settled());
            assert.equal(state.route, 'selector', 'the library button reached no route');
            const hash = await page.evalFn(() => location.hash);
            assert.equal(hash, '#/selector', 'the picker opened without moving the address');
        }));

        test('THE ADDRESS IS WHAT MOVED, not the mounted screen alone', () => booted(async (page) => {
            await page.evalFn(() => window.__shell.capabilitiesSettled());
            await page.evalFn(() => {
                document.querySelector('app-root').shadowRoot.querySelector('live-screen')
                    .dispatchEvent(new CustomEvent('header-action', {
                        detail: { action: 'Settings' }, bubbles: true, composed: true,
                    }));
                return true;
            });
            await page.evalFn(() => window.__shell.settled());
            const hash = await page.evalFn(() => location.hash);
            assert.equal(hash, '#/settings', `the address says ${hash}`);
        }));

        test('the intent listeners are removed with the shell (bug S10\'s class)',
            () => booted(async (page) => {
                await page.evalFn(() => window.__shell.capabilitiesSettled());
                const after = await page.evalFn(() => window.__shell.teardown());
                /* A detached shell must not answer an intent. Dispatching on the
                 * document proves the listener is gone rather than merely idle. */
                const moved = await page.evalFn(() => {
                    const before = location.hash;
                    document.dispatchEvent(new CustomEvent('header-action', {
                        detail: { action: 'Settings' }, bubbles: true, composed: true,
                    }));
                    return location.hash !== before;
                });
                assert.equal(moved, false, 'a torn-down shell still navigates');
                assert.ok(after, 'teardown reported nothing');
            }));

        test('a route swap mounts and unmounts cleanly, with no listener left behind',
            () => booted(async (page) => {
                const first = await page.evalFn(() => window.__shell.capabilitiesSettled());
                assert.equal(first.screenTag, 'live-screen');
                const hashListeners = first.hashListeners;
                assert.equal(hashListeners, 1, 'the shell adds exactly one hashchange listener');

                for (let i = 0; i < 5; i += 1) {
                    const toProbe = await page.evalFn(() => window.__shell.goto('probe'));
                    assert.equal(toProbe.screenTag, 'probe-screen', `swap ${i}: to probe`);
                    assert.equal(toProbe.screenCount, 1, `swap ${i}: the old screen was removed, not hidden`);
                    assert.equal(toProbe.probe.connects - toProbe.probe.disconnects, 1,
                        `swap ${i}: exactly one probe screen is live`);

                    const toLive = await page.evalFn(() => window.__shell.goto('live'));
                    assert.equal(toLive.screenTag, 'live-screen', `swap ${i}: back to live`);
                    assert.equal(toLive.screenCount, 1);
                    assert.equal(toLive.probe.connects - toLive.probe.disconnects, 0,
                        `swap ${i}: the probe screen disconnected on the way out`);
                    assert.equal(toLive.hashListeners, hashListeners,
                        `swap ${i}: a swap must not add a listener (bug S10)`);
                    assert.equal(toLive.watchers, first.watchers,
                        `swap ${i}: a swap must not add a boot subscriber`);
                    assert.equal(toLive.attachments, 1, `swap ${i}: one subscription on the live layer, never two`);
                }

                // Five round trips: ten mounts, ten unmounts, balanced.
                const end = await shellState(page);
                assert.equal(end.probe.connects, 5);
                assert.equal(end.probe.disconnects, 5);

                // And taking the shell off the page hands everything back.
                const after = await page.evalFn(() => window.__shell.teardown());
                assert.equal(after.hashListeners, 0, 'the shell removes its listener on disconnect');
                assert.equal(after.watchers, 0, 'and unsubscribes from its own boot state');
                assert.deepEqual(page.pageErrors, []);
            }));

        test('the connection feed is mirrored into the shell\'s state', () => booted(async (page) => {
            const before = await page.evalFn(() => window.__shell.settled());
            assert.equal(before.connection, 'never', 'nothing has arrived yet — the boot state of every feed');

            const after = await page.evalFn(() => {
                window.__shell.pushDevicesFrame();
                return window.__shell.state();
            });
            assert.equal(after.connection, 'live');
            assert.equal(after.phase, 'ready', 'and the screen was never held behind it');
        }));

        test('no id collides — not in the document, not inside any one shadow root',
            () => booted(async (page) => {
                await page.evalFn(() => window.__shell.settled());
                const collisions = await page.evalFn(() => {
                    const out = [];
                    const walk = (root, label) => {
                        const seen = new Map();
                        for (const el of root.querySelectorAll('[id]')) {
                            if (el.getRootNode() !== root) continue;   // owned by a nested root
                            seen.set(el.id, (seen.get(el.id) ?? 0) + 1);
                        }
                        for (const [id, n] of seen) if (n > 1) out.push(`${label}: #${id} x${n}`);
                        for (const el of root.querySelectorAll('*')) {
                            if (el.shadowRoot) walk(el.shadowRoot, el.tagName.toLowerCase());
                        }
                    };
                    walk(document, 'document');
                    return out;
                });
                assert.deepEqual(collisions, [],
                    'bug S13 was a duplicate id "correct only by document order"');
            }));
    });
}

describe('index.html — the pre-paint theme stamp, honoured end to end', () => {
    /** Load the real document with a stored theme already in place. */
    async function bootReal(page, stored) {
        await page.goto('/index.html');
        await page.evalFn((value) => {
            if (value === null) localStorage.removeItem('decal.theme');
            else localStorage.setItem('decal.theme', JSON.stringify(value));
            return true;
        }, stored);
        await page.goto('/index.html');
        await page.settle();
        await page.evalFn(async () => {
            const root = document.querySelector('app-root');
            for (let i = 0; i < 400; i += 1) {
                if (root?.getAttribute('phase') !== 'connecting') return true;
                await new Promise((done) => { setTimeout(done, 25); });
            }
            return false;
        });
        return page.evalFn(() => ({
            stamp: document.documentElement.getAttribute('data-theme'),
            canvas: getComputedStyle(document.documentElement).backgroundColor,
            phase: document.querySelector('app-root')?.getAttribute('phase') ?? null,
            hasScreen: !!document.querySelector('app-root')?.shadowRoot?.querySelector('live-screen'),
            themeSource: document.querySelector('app-root')?.theme?.state?.source ?? null,
            themeValue: document.querySelector('app-root')?.theme?.state?.theme ?? null,
        }));
    }

    test('a stored choice paints before the first frame and the shell adopts it', () =>
        browser.withPage({ geometry: BENCH }, async (page) => {
            try {
                const light = await bootReal(page, 'light');
                assert.equal(light.stamp, 'light', 'the stamp reads the stored value');
                assert.equal(light.themeValue, 'light', 'and the shell\'s theme store agrees with the screen');
                assert.equal(light.themeSource, 'stored');

                const dark = await bootReal(page, 'dark');
                assert.equal(dark.stamp, 'dark');
                assert.equal(dark.themeValue, 'dark');
                assert.notEqual(dark.canvas, light.canvas,
                    'the two themes must actually paint differently, or this proves nothing');
            } finally {
                await page.evalFn(() => { localStorage.removeItem('decal.theme'); return true; });
            }
        }));

    test('the real document boots to Live with the shell it ships', () =>
        browser.withPage({ geometry: BENCH }, async (page) => {
            try {
                const state = await bootReal(page, 'dark');
                assert.equal(state.phase, 'ready');
                assert.equal(state.hasScreen, true, '<live-screen> is mounted in <app-root>');
                assert.deepEqual(page.pageErrors, []);
            } finally {
                await page.evalFn(() => { localStorage.removeItem('decal.theme'); return true; });
            }
        }));

    test('the stamp runs before the stylesheets it decides — the no-flash order', () =>
        browser.withPage({ geometry: BENCH }, async (page) => {
            const order = await page.evalFn(async () => {
                const html = await (await fetch('/index.html')).text();
                return {
                    stamp: html.indexOf("setAttribute('data-theme'"),
                    firstSheet: html.indexOf('<link rel="stylesheet"'),
                    bodyStart: html.indexOf('<body'),
                };
            });
            assert.ok(order.stamp > 0 && order.firstSheet > 0);
            assert.ok(order.stamp < order.firstSheet,
                'the theme is decided before the first stylesheet is requested');
            assert.ok(order.firstSheet < order.bodyStart,
                'and both are in <head>, before anything can paint');
        }));

    test('the store-driven switch after boot moves the palette, without a reload', () =>
        browser.withPage({ geometry: BENCH }, async (page) => {
            await page.mount('', ['/test/fixtures/app-shell-fixture.js']);
            const result = await page.evalFn(async () => {
                const theme = window.__shell.theme();          // the shell's own controller
                const before = {
                    stamp: document.documentElement.getAttribute('data-theme'),
                    canvas: getComputedStyle(document.documentElement).backgroundColor,
                };
                await theme.set(before.stamp === 'dark' ? 'light' : 'dark');
                const after = {
                    stamp: document.documentElement.getAttribute('data-theme'),
                    canvas: getComputedStyle(document.documentElement).backgroundColor,
                    source: theme.state.source,
                };
                theme.destroy();
                return { before, after };
            });
            assert.notEqual(result.after.stamp, result.before.stamp);
            assert.notEqual(result.after.canvas, result.before.canvas,
                'one attribute on the root is the whole switching mechanism');
            assert.equal(result.after.source, 'stored');
        }));
});
