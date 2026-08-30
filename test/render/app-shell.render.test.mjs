/**
 * app-shell.render.test.mjs — the application shell, in a real engine, at both standard
 * geometries (wave 5.1, `live-app-shell`).
 *
 * WHAT ONLY A BROWSER CAN SAY. `test/app-shell.test.mjs` already pins the route table, the
 * theme precedence and the boot sequence without a DOM. What is left needs the engine:
 * that the element MOUNTS a screen and takes it away again, that the pre-paint stamp in
 * the real `index.html` reaches the real palette, that the ground has one owner and it is
 * a token, that the shell's box is the viewport's and nothing scrolls the document, and
 * that a route swap leaves no listener behind (bug S10's class).
 *
 * BOTH GEOMETRIES, like every rendering suite in this tree: 1281×801 @ dsf 1.5 (the bench
 * truth) and the 1000×600 design floor. The shell has no responsive behaviour of its own —
 * it is one box — which is exactly why running it at both is cheap and worth it: the box
 * is the thing every screen's `height: 100%` chain hangs from, and a shell that was right
 * at one size and not the other would poison every screen above it.
 *
 * THE REST MOCK. `test/fixtures/app-shell-fixture.js` serves `tools/rea-fixtures/` — the
 * mock's own corpus, keyed by `mock_rea.py`'s own `_key` — through the harness's static
 * server, with a 503 for a path the corpus has no recording of. That is the whole of the
 * mock minus the process, and the process is the part a rendering suite must not start
 * (fixed port 8080, shared with the capture battery; browser/port contention was wave 3's
 * recorded intermittency hazard).
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

        /* -- the display size, put back like the theme ---------------------- */

        test('a stored display size is applied at BOOT, not when Settings is opened',
            () => browser.withPage({ geometry }, async (page) => {
                /* IT WAS CHOSEN AND THEN FORGOTTEN. `applyDensity` had exactly one caller —
                 * the settings screen's own leaf-change handler — so a size picked on a
                 * previous visit applied when it was picked and never again. Reload the
                 * tablet and the app came up at "Fit screen" whatever was stored, until the
                 * person opened Display > Display Size, at which point it silently snapped
                 * to their choice. The behaviour audit filed it as a boot gap.
                 *
                 * IT IS THE SAME SHAPE AS THE THEME, which has been hydrated at boot since
                 * the shell was built — and the theme is the reason the gap was visible at
                 * all: one preference came back and the other did not. */
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
                /* NOTHING STORED IS NOT NOTHING — it is Ben's decided default, and the
                 * settings store answers it (O3: "the current option should always be shown
                 * as selected … Where its not a machine setting then we need to decide what
                 * default value is", and he decided all thirty-eight). `density` is
                 * `fit-screen`.
                 *
                 * FIT SCREEN IS THE IDENTITY, which is why applying it is safe: its factor
                 * is 1, so the root comes up at exactly the size the sheet's own
                 * declarations give it. The claim worth pinning is the OUTCOME — a device
                 * that has never chosen looks the way it always has — not whether an inline
                 * property is present. */
                await page.mount('', MODULES);
                await page.evalFn(() => window.__shell.mount());
                await page.settle(6);
                const base = await page.evalFn(() => getComputedStyle(document.documentElement)
                    .getPropertyValue('--ui-density-base').trim());
                assert.equal(base, '1', 'Fit screen is factor 1 — the same size the sheet draws');
            }));

        /* -- 0. the blank the shell owns ----------------------------------- */

        test('the screensaver is MOUNTED, and the wake is the shell\'s to send', () => booted(async (page) => {
            /* Ben, 23 Aug 2026: "please add slates black sleep screen for when it goes to
             * sleep." `<ui-screensaver>` (#57) and `screensaver-policy.js` were both
             * finished — the policy with its own suite, the component raising a top-layer
             * blank — and nothing in src/ ever rendered one. A finished half with no
             * other half, like the tank's feed and the header's dead buttons.
             *
             * IT IS THE SHELL\'S AND NOT A SCREEN\'S: Slate blanks the tablet from
             * wherever you are standing, and a saver inside <live-screen> would leave
             * Settings lit on a sleeping machine and flicker on every route change. */
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

        test('the DIM reaches the panel — the shell listens for it now', () => booted(async (page) => {
            /* THE OTHER HALF OF THE SAME SHAPE, and it survived the first repair.
             *
             * `ui-screensaver.js` emits `ui-screensaver-dim` and its own header states the
             * decision it belongs to — "the skin drives the DIM and stands back on the
             * RESTORE" — with the whole of Q13 argued around it. The shell bound
             * `@ui-screensaver-wake` and NOTHING ELSE, and a grep of `src/` for the dim
             * event on 26 August 2026 returned the emitter and no consumer. So the overlay
             * went black and the panel behind it stayed at whatever brightness it was.
             *
             * IT ALSO BROKE THE ARGUMENT DOWNSTREAM. ReaPrime restores an awake machine
             * sitting at requested brightness 0 (`display_controller.dart:276-285`), so the
             * skin's dim to 0 is what ARMS that restore — with no dim there was no restore
             * either, and the whole wake-edge design was inert.
             *
             * All three of the component's own tests assert that it EMITS. None asserted
             * that anybody acts, which is exactly how a finished half stays unfinished. */
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

        /* THE TEST ABOVE SET THE PROPERTY BY HAND AND THAT IS WHY IT MISSED THIS.
         *
         * Ben, 24 August 2026: "When the machine goes into the sleep state the black
         * screen should appear, you just need to monitor the state to do this". It did
         * not, from the day the saver was mounted, on a machine that was reporting
         * `sleeping` the whole time.
         *
         * `render()` returned THREE separate `html` templates — error, booting, ready —
         * each opening with the saver. Lit keys a template by its strings array, so those
         * are three different templates and every move between them DESTROYS the
         * `<ui-screensaver>` and builds a new one. The shell's attach was a one-shot flag,
         * so it stayed bound to the element from the phase before and the mounted one was
         * never fed.
         *
         * EVERY GUARD PASSED while it was broken: the element was in the shadow root, the
         * feed was live and publishing, `attachScreensaver` worked when called by hand.
         * Only the element IDENTITY was wrong, and no assertion in this file read it.
         * Driving the SOCKET is what tells the two apart. */
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

        /* -- 0a2. THE SAVER A TABLET GETS BEFORE ANYONE CONFIGURES IT ----------- */

        /* BEN'S BENCH TABLET, 28 AUGUST 2026, Decal 0.1.41: the panel was FULLY BLACK
         * while the device was awake. `dumpsys power` said `mWakefulness=Awake`, the app
         * was focused, and `adb exec-out screencap -p` came back with 2,304,000 pixels of
         * which ZERO were non-black. A tap cleared it to Live, normally. Read over CDP into
         * the live WebView while that screen was up:
         *
         *     <ui-screensaver>  active: true  clock: false  image: ''   <- painting nothing
         *     /ws/v1/display    brightness: 0    requestedBrightness: 0
         *     settings.value('screensaverType')       -> 'image'
         *     settings.storedValue('screensaverType') -> undefined
         *
         * So the Settings page drew Image selected and the saver painted Black and spent
         * the Black saver's dim to 0 underneath it. `attachScreensaver` fed the element
         * from `settings.subscribe(...)`, which publishes the STORED value and never
         * `defaultFor` — the store calls `defaultFor` in `value()` and nowhere else
         * (`settings-store.js:250-271` vs `:284`). Its comment claimed the opposite in as
         * many words: "the settings store resolves that for us — a subscriber sees the
         * default, not undefined."
         *
         * WHY IT LIVES HERE. The component's own suite sets `clock` and `image` as
         * ATTRIBUTES and proves every branch of the paint and the dim correctly; the
         * settings suite proves the key stores and that `value()` resolves. Both halves
         * were green throughout. What nobody asserted is that the shell's store and the
         * shell's saver read the same answer — which is the only place the defect could
         * be, and it is the shape this fork exists to remove.
         *
         * NOTHING IS STORED IN THIS FIXTURE, which is exactly the bench state: a tablet
         * where nobody has opened Settings > Display. */
        test('a tablet nobody has configured gets the saver Ben DECIDED, not the black one',
            () => booted(async (page) => {
                const seen = await page.evalFn(async () => {
                    const root = document.querySelector('app-root');
                    const saver = root.shadowRoot.querySelector('#screensaver');
                    const dims = [];
                    const live = root.boot.live;
                    const real = live.setBrightness.bind(live);
                    live.setBrightness = (value) => { dims.push(value); return real(value); };

                    /* The capability half. Without a display frame `brightnessSupported`
                     * is false and `#applyDisplay()` returns before it decides anything,
                     * so "no dim" would be true for the wrong reason. */
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
                    'the Settings page reads Ben\'s decided default (settings-defaults.js)');
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

                /* AND THE PANEL IS NOT BLANKED UNDER IT. This is the half that made the
                 * bug frightening rather than merely wrong: the Black saver's dim to 0
                 * went out under a saver that was supposed to be showing something. */
                assert.deepEqual(seen.dims, [],
                    'a picture painted on a panel at brightness 0 is a black screen with a '
                    + 'cost — Image and Clock send nothing at all');

                /* THE OTHER THREE KEYS ON THE SAME BROKEN DOOR. Each was decided and each
                 * arrived as `undefined`; `language` is the one that mattered, because ''
                 * is not a locale and `Intl` answers it with the BROWSER's — a second
                 * answer to a question the user has already been asked. */
                assert.equal(seen.language, 'en', 'Ben\'s decided language, not the empty string');
                assert.equal(seen.cycleReads, 10, 'and his ten minutes, from the one table');
            }));

        /* THE CONTROL, and without it the assertion above is not evidence: the same shell,
         * the same fixture, the same capability, with BLACK actually chosen. If this fails
         * the test above is passing because nothing dims, not because Image declined to. */
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

        /* -- 0b. the faint clock, and the switch that was dead beside it -------- */

        test('the screen-saver preferences reach the blank — both of them', () => booted(async (page) => {
            /* `screensaverEnabled` HAD A SWITCH AND REACHED NOTHING. It has a row in the
             * routing table, a row in the settings registry and a store behind it, and
             * `attachScreensaver` filled `machineState` and `brightnessSupported` and
             * never this — so the blank went up on a sleeping machine whether or not the
             * user had turned it off. The same finished-half shape as the saver itself.
             *
             * It is asserted here rather than in the settings suite because the settings
             * suite can only prove the value was STORED. Whether it reaches the element
             * is a fact about the shell. */
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
            /* Ben, 24 August 2026: "In settings I want an option for this black screen to
             * have a faint clock showing the time in the same font the skin uses."
             *
             * OFF BY DEFAULT is the decision worth pinning: black costs the panel nothing,
             * so a lit element is a choice the user makes and not one the skin makes for
             * them. It is one of THREE saver kinds now (`screensaverType`), and the clock
             * is not the default one. */
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
                /* THE KEY IS `screensaverType` SINCE 26 AUGUST 2026. It was a switch over
                 * the blank; Ben made the saver a CHOICE of three — Black, Image, Clock —
                 * and two switches cannot express three states without an unreachable
                 * combination and no name for what is showing. */
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
            /* TWELVE-HOUR ON A TABLET NOBODY HAS TOUCHED, and it used to be twenty-four.
             *
             * THE DEFECT THIS PINS was a table disagreeing with itself, and it survived
             * because no test anywhere read `clockFormat`. `wall-clock.js` declared
             * `DEFAULT_CLOCK_FORMAT = H24` with the comment "24-hour, which is what the skin
             * drew before the option existed" — a description of the PAST — while
             * `settings-defaults.js` carried Ben's 26 August decision of '12h'. So Settings ›
             * Units & Language › Time drew 12-hour selected, and BOTH surfaces that write a
             * time drew 21:40: the Live header (which reads the router directly and coerces
             * anything that is not '12h' to the constant) and this screensaver (whose store
             * subscription publishes the STORED value only, never `defaultFor`, so an
             * unwritten key arrives as `undefined` and is coerced the same way). A control
             * and its readers disagreeing about one preference, on the skin's own screens.
             *
             * The constant now IMPORTS the decision instead of copying it, so the two cannot
             * drift; `test/wall-clock.test.mjs` pins the tables against each other and this
             * pins what a person actually sees. */
            assert.match(shown.text ?? '', /^\d{1,2}:\d{2}\s?(am|pm)$/i,
                "Ben's ruling, 26 August 2026: 12-hour, everywhere, on a tablet nobody has set");

            /* AND THE PREFERENCE MOVES BOTH HALVES. A test that checked only the settings
             * page would have passed throughout the bug. */
            const twentyFour = await page.evalFn(async () => {
                const root = document.querySelector('app-root');
                const saver = root.shadowRoot.querySelector('#screensaver');
                await root.boot.settings.set('clockFormat', '24h');
                /* A TICK, NOT A FRAME. The screensaver writes its clock property only when
                 * the SPELLING changes — that is what keeps a one-second interval to one
                 * render a minute rather than sixty — so a format change lands on the next
                 * tick rather than on the write. `CLOCK_TICK_MS` is a second; this waits for
                 * one and a little. On a screen that is asleep, up to a second is not a
                 * defect, and the alternative is a second mechanism doing what the tick
                 * already does. */
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
            /* QUOTES STRIPPED ON BOTH SIDES: the token is authored as "Geist", … and
             * `getComputedStyle` on the element answers the resolved list unquoted. The
             * comparison is about the FACE, not about how the two are serialised. */
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
            /* Ben, 24 August 2026: "make it drift a little please. it should start in the
             * very centre of the screen then drift up 1.2x the text height, then back down
             * to centre."
             *
             * IT IS A BURN-IN MITIGATION, which is why the numbers are asserted rather
             * than eyeballed: a lit element on a screen that stays black for hours can
             * mark the panel, and a drift that quietly stopped would look identical to one
             * that works.
             *
             * MEASURED AS A RATIO, NOT IN PIXELS. `app-fit.js` scales the app with `zoom`
             * and `getBoundingClientRect` reports PAINTED units, so the travel and the
             * text height are both scaled — and their ratio is the claim. Measured on the
             * bench before this test was written: 115.3px of travel over a 96.1px painted
             * line, which is 1.199. */
            const drift = await page.evalFn(async () => {
                const root = document.querySelector('app-root');
                const saver = root.shadowRoot.querySelector('#screensaver');
                /* THE KEY IS `screensaverType` SINCE 26 AUGUST 2026. It was a switch over
                 * the blank; Ben made the saver a CHOICE of three — Black, Image, Clock —
                 * and two switches cannot express three states without an unreachable
                 * combination and no name for what is showing. */
                await root.boot.settings.set('screensaverType', 'clock');
                await new Promise((r) => setTimeout(r, 60));
                window.__shell.pushMachineFrame('sleeping');
                /* TWICE. The clock's timer starts in `updated()` and writes `_time`
                 * there, which schedules a SECOND update — the one that paints the
                 * element. One `updateComplete` lands between them. */
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
            /* `Math.round` CAN ANSWER -0, and `assert.equal` uses Object.is — so a drift
             * that returns to centre from ABOVE fails a comparison against 0 while a
             * drift returning from below passes. Measured: green at the bench geometry,
             * red at the floor, on the same code. `+ 0` normalises the sign without
             * loosening the tolerance. */
            assert.equal(Math.round(drift.start) + 0, 0, 'it starts in the very centre');
            assert.ok(drift.end < 0, 'and it goes UP');
            assert.equal(Math.round(drift.cycle) + 0, 0, 'a full alternate cycle returns to centre');

            const ratio = Math.abs(drift.end) / drift.height;
            assert.ok(Math.abs(ratio - 1.2) < 0.02,
                `the travel is ${ratio.toFixed(3)} text heights, and 1.2 was asked for`);

            /* LINEAR, NOT EASED, and the quarter points are how a test can tell. An eased
             * cycle lingers at the two extremes — which is exactly where a static clock
             * would sit, and exactly what this drift exists to avoid. */
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
            /* THE FIRST BUILD PAINTED IT WITH --ui-text AND THAT WAS WRONG. --ui-blackout
             * is deliberately the same in both themes — "a blanked screen does not follow
             * the theme, which is the whole content of the decision" — and --ui-text is
             * NEAR-BLACK in light. Measured on the bench before the fix: oklab lightness
             * 0.215 at 22% alpha, on black. Invisible, and invisible only for the half of
             * users on a light theme. */
            const inks = await page.evalFn(async () => {
                const root = document.querySelector('app-root');
                const saver = root.shadowRoot.querySelector('#screensaver');
                /* THE KEY IS `screensaverType` SINCE 26 AUGUST 2026. It was a switch over
                 * the blank; Ben made the saver a CHOICE of three — Black, Image, Clock —
                 * and two switches cannot express three states without an unreachable
                 * combination and no name for what is showing. */
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
            /* THE OTHER HALF OF THE SAME BUG. A saver rebuilt on navigation is a saver the
             * shell is no longer feeding, and the symptom is identical: the machine sleeps
             * and nothing happens. Identity is the assertion; `active` is the consequence. */
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

        /* -- 1. it boots to Live ------------------------------------------- */

        test('the shell boots to Live against the REST mock', () => booted(async (page) => {
            const state = await page.evalFn(() => window.__shell.capabilitiesSettled());

            assert.equal(state.phase, 'ready', 'the shell reaches ready');
            assert.equal(state.route, 'live', 'Live is the default route');
            assert.equal(state.screenTag, 'live-screen');
            assert.equal(state.screenCount, 1, 'exactly one screen is mounted');
            assert.equal(state.ariaBusy, 'false', 'and it stops announcing itself as busy');
            assert.ok(await page.exists('app-root >>> live-screen'), 'the screen is in the shell\'s shadow root');

            // The eight channels the live layer opens — the shell dials none of them itself.
            /* SEVEN SINCE 23 Aug: the tank joined them. Ben — "Tank just shows as -, no
             * water level being shown" — and the tile's own note had named the gap since
             * the band was built: the channel was tabled and no feed attached it.
             *
             * EIGHT SINCE THE WEATHER CORNER. Its feed is the first consumer of the
             * address layer's `pluginEndpoint` template, and it is bounded to three
             * attempts, so a machine without the plugin stops dialling and the corner is
             * absent rather than broken. */
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

            /* FIVE READS, each on its tabled path and each owned by one store.
             * The second arrived with `live-capability-gates-ghc` (wave 5.1): the
             * capability store will not fetch `machine/info` ("one store, one route") and
             * both R3 gates answer from that body, so until `machine-info-store.js` owned
             * the feed the GHC gate could only ever say "not known".
             *
             * THE THIRD IS THE LIVE RAIL'S, and its absence is what made the rail dead:
             * `<live-screen>` declared `targets`, nothing set them, and every stepper,
             * preset cell and the keypad's Confirm rendered DISABLED on any machine, with
             * the one handler that writes `targets` sitting behind those controls. The ten
             * values live on the workflow document (DQ-707) and `workflow-store.js` owns
             * it. Asked here on the start path, gated on nothing.
             *
             * THE FOURTH AND FIFTH ARRIVED WITH BEN'S LIVE-COMPOSITION RULING (22 Aug
             * 2026), and they are the same shape of gap the third was: `<live-screen>`
             * declared `favourites`, `profileName`, `storedDerivation` and `shotId` and
             * nothing under src/ ever wrote one of them (DQ-1-D), so the header's five
             * favourite slots were five numbered blanks and the chart and the band said
             * "no shot yet" on a machine with 321 stored shots. The profile listing owns
             * the first; the shots store owns the second, at limit=1 because the Live
             * page wants one row from it.
             *
             * AND A SIXTH CALL, WHICH IS A FINDING RATHER THAN A DESIGN: the profile
             * library store reads `/workflow` AGAIN, for a different question (R1's
             * loaded-profile highlight). Its own header records the seam and names the
             * condition — "if a third reader appears, this is the file that should
             * absorb them" — and until this pass the two reads happened at different
             * moments, so nobody saw them together. They are one boot apart now.
             * Recorded for Ben; folding the highlight onto the workflow store is a
             * one-owner change and not this pass's. */
            const calls = await page.evalFn(() => window.__shell.calls());
            /* THE LAST TWO READS RACE, AND THE ORDER BETWEEN THEM IS NOT A CLAIM.
             * `machine/cupWarmer/preheat` and `store/…/favouriteProfilesSeeded` belong to
             * two different stores that were started together and neither waits on the
             * other, so which lands first is the network's business. Measured: this
             * assertion failed about one run in four with exactly those two swapped and
             * nothing else different.
             *
             * SO THE ORDER IS PINNED WHERE IT IS CAUSAL — everything above the pair is a
             * chain, the capability read gating the cup warmer and the listing feeding
             * the favourites — and the racing pair is compared as a SET. A call that
             * appears twice, or a sixth call nobody asked for, still fails: the tail is
             * sorted, not ignored. */
            /* SIX SINCE THE RAIL'S STORED PREFERENCES GOT A READER (wave 5.8). Four KV
             * rows joined the pair: `steamStopMode`, `hotWaterStopMode`,
             * `drinkOutPresets` and `steamFlowPresets` (the first two have since been
             * retired — see the 27 August note below). All four were TABLED in
             * `storage-routes.js` and read by nothing, which is why the Live rail said
             * "Timed stop" whatever Settings held and why an edited preset bank could
             * never come back. They are issued together with the listing reads and wait
             * on nothing, so they belong in the set half of this assertion rather than
             * in the chain. SEVEN, not six: the cup-warmer preheat read races them too,
             * and pinning it in the ordered half made the assertion depend on which of
             * seven concurrent requests the network happened to answer first.
             *
             * NINE SINCE 26 AUGUST 2026, and both new ones are settings that did nothing.
             * `waterTankUnit` had offered mm | mL since the settings screen was built and
             * `tempUnit` had offered Celsius | Fahrenheit; NEITHER had a reader anywhere,
             * so the Tank tile drew millimetres and every temperature drew Celsius
             * whichever the person picked. They are read beside the four rail preferences,
             * in the same `Promise.all`, and wait on nothing — so they race with them.
             *
             * SEVEN SINCE 27 AUGUST 2026, AND THE COUNT WENT DOWN, which is the shape of
             * this change: `steamStopMode` and `hotWaterStopMode` are no longer read at boot
             * because they are no longer read at all. Both rows are RETIRED in
             * `storage-routes.js` — the Live rail derives what ends a steam session from the
             * machine's own `steamSettings` fields and what ends a hot-water pour from
             * ReaPrime's `stopHotWaterAtWeight`, so there is no copy left to load. Two KV
             * round trips per boot went with them, and the read that replaced them is not in
             * this racing set at all: `GET /api/v1/settings` is issued on the START path with
             * the other machine-shaped reads, so it appears in the ORDERED half below.
             *
             * EIGHT SINCE 27 AUGUST 2026, AND THE EIGHTH IS NOT APP-BOOT'S. `GET /api/v1/plugins`
             * is issued by `<live-wiring>` when the LIVE SCREEN mounts, not from the boot
             * path: `app-boot.js` constructs the plugins store and deliberately does not
             * read it, because the listing reaches exactly one pixel — whether the DYE2
             * bean-picker button is drawn — and the store's own in-flight guard makes a
             * second caller free. The Live screen is the shell's first route, so mounting
             * the shell mounts its reader and the request goes out beside the others.
             *
             * IT IS IN THE RACING HALF because it chains on nothing: the screen mounts and
             * asks, while the boot path's own reads are already in flight, so which of them
             * the network answers first is not a claim this suite should make. */
            const RACING = 8;
            const ordered = calls.slice(0, calls.length - RACING);
            const byPath = (a, b) => a.path.localeCompare(b.path);
            const racing = calls.slice(calls.length - RACING).sort(byPath);
            assert.deepEqual([...ordered, ...racing], [
                { path: '/api/v1/machine/capabilities', method: 'GET' },
                { path: '/api/v1/machine/info', method: 'GET' },
                { path: '/api/v1/workflow', method: 'GET' },
                { path: '/api/v1/profiles?includeHidden=true', method: 'GET' },
                /* limit=25 SINCE 23 Aug, AND THE NUMBER IS THE ARROWS' REACH. It was
                 * 1, because the Live page wanted one thing from the list — the newest
                 * shot's id — and `total` answers "how many are there" whatever the
                 * limit is. Ben asked the band to page: "The history pannel part on the
                 * left needs left and right arrows to allow navigating between old
                 * shots in the history, this should update the chart etc." A page is
                 * what prev/next can walk without a second read; the rows are LIST rows,
                 * and the 221 KB record is fetched one at a time only when the arrows
                 * land on it. */
                { path: '/api/v1/shots?limit=25&offset=0&order=desc', method: 'GET' },
                /* AND REAPRIME'S OWN PREFERENCES (27 August 2026), which are neither the
                 * machine's nor this skin's and are read here for ONE FIELD:
                 * `stopHotWaterAtWeight` is what `hot_water_sequencer.dart:106` consults to
                 * decide whether a hot-water pour ends on millilitres or on the scale, so it
                 * is what the Live rail's stop caption SAYS and what the unit beside its
                 * number MEANS. The rail used to answer that from a KV row of its own, which
                 * is why two of the racing reads below have gone.
                 *
                 * IT IS IN THE ORDERED HALF because it is issued on the start path with the
                 * other unchained reads, before the cup warmer — which waits on the
                 * capability list and therefore lands after everything started beside it. */
                { path: '/api/v1/settings', method: 'GET' },
                /* AND A SIXTH READ, THE CUP WARMER, which arrived with the header's
                 * restored Warmer control (ORACLE live-ready #cupwarmer-toggle-btn
                 * [i=9], "Warmer ON", rect [1293,18,104,82]). Same shape as the two
                 * above it: `src/stores/cup-warmer.js` was written whole and called
                 * from nowhere under src/.
                 *
                 * IT CHAINS ON THE CAPABILITY READ (A3: "the capability list first, the
                 * handler's own 404 second and authoritative"), which is why it lands
                 * after the four started beside it rather than among them. */
                { path: '/api/v1/machine/cupWarmer', method: 'GET' },
                { path: '/api/v1/workflow', method: 'GET' },
                /* AND THE FAVOURITE SLOTS, THROUGH THE B7 ROUTER'S KV BACKEND. These
                 * three are the reason a REAL BUG was found by this pass rather than by
                 * a machine: they used to be recorded at
                 * `/api/v1/api/v1/store/decal/favouriteProfiles` — `app-boot.js`
                 * appended `DEFAULT_API_BASE` to a base that already ended in it, so
                 * every KV read and write the app made went to a doubled path. Nothing
                 * exercised the URL end to end until the profile library store moved
                 * onto the boot path. The POST is rule 4's first-launch seed: the mock
                 * has no favourites row for this namespace, so the rail auto-populates
                 * from the listing and saves it (markUserInitialized: false — the launch
                 * stays retryable, which is why there is no `…Seeded` write here). */
                { path: '/api/v1/store/decal/favouriteProfiles', method: 'GET' },
                /* AND THE PRE-HEAT ROUTE, WHICH IS THE CAPABILITY GAP SHOWING RATHER
                 * THAN A SECOND DESIGN. The corpus has no `machine/capabilities`
                 * recording (see the note below this list), so the mock answers its own
                 * 503 miss, `entries()` is null, and the store reads null as "not known
                 * yet" — which is correct and is NOT "absent". With no list to gate on
                 * it asks both of its routes once and lets the handler answer. On a
                 * machine that serves the list and does not name `preheat`, this
                 * request is not made: `test/app-shell.test.mjs` pins exactly that,
                 * against a fake that answers the list, and its boot is six calls with
                 * no preheat among them. The two tests together are the claim. */
                /* The last two are the racing pair, listed in sorted order — see the
                 * note above the assertion. */
                { path: '/api/v1/machine/cupWarmer/preheat', method: 'GET' },
                /* THE PLUGIN LISTING, ASKED BY THE SCREEN THAT READS IT — see the note on
                 * `RACING` above. One request, one reader, and it is `<live-wiring>`. */
                { path: '/api/v1/plugins', method: 'GET' },
                { path: '/api/v1/store/decal/drinkOutPresets', method: 'GET' },
                { path: '/api/v1/store/decal/favouriteProfiles', method: 'POST' },
                { path: '/api/v1/store/decal/favouriteProfilesSeeded', method: 'GET' },
                { path: '/api/v1/store/decal/steamFlowPresets', method: 'GET' },
                { path: '/api/v1/store/decal/tempUnit', method: 'GET' },
                { path: '/api/v1/store/decal/waterTankUnit', method: 'GET' },
            ]);

            /* AND THE SHELL SURVIVES THE ANSWER, WHATEVER IT IS. The corpus has no
             * `machine/capabilities` recording today, so the mock's answer is its own
             * 503 miss and the store lands on `error` with `entries: null` — which is
             * fail-CLOSED, not fail-shut: every gate answers "no" and the screen is
             * still on screen. Written as an implication rather than as `'error'` so
             * that recording the fixture (a live gap, reported with this wave) turns
             * this test green from the other side rather than red. */
            assert.ok(['ready', 'error'].includes(state.capabilityStatus), state.capabilityStatus);
            if (state.capabilityStatus === 'error') {
                assert.equal(state.capabilityEntries, null, 'a failed read is NOT an empty capability set');
                assert.equal(state.offersCupWarmer, false, 'unknown gates stay closed');
            }
        }));

        /**
         * RUNNING THE MACHINE, END TO END (wave 5.8).
         *
         * WHY IT IS HERE AND NOT IN A SOURCE-TEXT ASSERTION. The claim is "a press on the
         * machine strip reaches `PUT /api/v1/machine/state/<newState>`", and every part of
         * that trip is a different file: the screen dispatches, the wiring listens, the
         * store calls the route, the route table builds the path. A test that read the
         * source of any one of them would prove the wiring is SPELLED, not that it runs
         * (A8's whole rule). This presses the button.
         *
         * THE GATE IS FORCED, because the mock's recorded machine has a group-head
         * controller and the strip is drawn only when there is none. The capability store
         * is the one thing overridden; everything below it is the shipping path.
         */
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

        /* -- 2. the box the whole app hangs from ---------------------------- */

        test('the shell is exactly one viewport tall and hands the screen the whole of it',
            () => booted(async (page) => {
                await page.evalFn(() => window.__shell.settled());
                const shell = await page.box('app-root');
                const screen = await page.box('app-root >>> live-screen');
                assert.equal(Math.round(shell.height), geometry.height,
                    'the shell paints exactly one viewport tall — one owner of the page '
                    + 'height (bug S3), now the fit rather than a raw 100dvh');
                /* THE DESIGN FLOOR NO LONGER COSTS A DOCUMENT SCROLLBAR, and that is the
                 * fit paying for itself rather than a test being relaxed.
                 *
                 * The recorded shortfall was real: Ben's foot ruling (22 Aug 2026) put
                 * Slate's own last-shot identity and its four derived scalars in the
                 * band, and at 1000x600 the band's content plus the chart card's own
                 * floor came to about 25px more than the screen. `styles/document.css`
                 * REFUSES `overflow: hidden` on purpose — "if something does [overflow],
                 * it must be visible rather than silently clipped" — so the page scrolled
                 * and the scrollbar took 10 CSS px of width.
                 *
                 * What changed is that 600px stopped being the number the layout sees.
                 * src/lib/app-fit.js draws the app at a 1200-unit reference height and
                 * scales it, so at 1000x600 the design lays out at 2000x1200 units and
                 * the band has the room it was designed with. The content did not shrink
                 * and nothing was hidden — the screen the content is measured against
                 * grew back to its design size. Both assertions below are now the plain
                 * ones, at every geometry, and the scroll check further down is what
                 * would catch a return of the overflow. */
                assert.equal(Math.round(shell.width), geometry.width,
                    'the shell paints the full viewport width — a short answer here is a '
                    + 'document scrollbar, which the fit is supposed to have removed');
                assert.equal(Math.round(screen.height), Math.round(shell.height),
                    'the screen fills the shell\'s single grid row: a screen written to §4.1\'s '
                    + '`height: 100%` needs a definite box and this is where it comes from');
                assert.equal(Math.round(screen.width), Math.round(shell.width));

                // Nothing scrolls the document. LAYOUT_SPEC_DRAFT §4.1: "None on Live at
                // or above the design floor", and the shell must not be what breaks it.
                const doc = await page.evalFn(() => ({
                    scrollHeight: document.documentElement.scrollHeight,
                    clientHeight: document.documentElement.clientHeight,
                    bodyOverflowY: getComputedStyle(document.body).overflowY,
                }));
                /* AT EVERY GEOMETRY NOW, the design floor included — see the note above:
                 * the fit gave the floor its design height back, so the branch that
                 * tolerated 25px of overflow at 1000x600 has nothing left to tolerate. */
                assert.ok(doc.scrollHeight <= doc.clientHeight + 1,
                    `the document scrolls: ${doc.scrollHeight} > ${doc.clientHeight}`);
                assert.equal(doc.bodyOverflowY, 'visible',
                    'and it is not hidden either — §2.4 exists to end silent clipping');
            }));

        /* -- 3. one owner of the ground, and it is a token (bug S6) ---------- */

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
            // body inherits it; what matters is that no element paints a DIFFERENT one.
            // S6 is precisely "the letterbox/gutter colour is off-token", `#FFFFFF` light
            // and `#101217` dark against a canvas of `#e8eaeb` / `#090d10`.
            assert.equal(grounds.body, canvas);

            // The drill: move the token and every ground must move with it. A shell that
            // hard-coded the colour passes every equality above and fails this.
            await page.setToken('--ui-canvas', 'rgb(255, 0, 170)');
            const moved = await page.evalFn(() => ({
                html: getComputedStyle(document.documentElement).backgroundColor,
                root: getComputedStyle(document.querySelector('app-root')).backgroundColor,
            }));
            assert.equal(moved.html, 'rgb(255, 0, 170)');
            assert.equal(moved.root, 'rgb(255, 0, 170)');
            await page.setToken('--ui-canvas', null);
        }));

        /* -- 4. the boot surface ------------------------------------------- */

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

                assert.ok(await page.exists('app-root >>> ui-alert-banner'),
                    'the refusal SURFACE is the library\'s banner — it takes a message, it does not know one');
                const text = await page.evalFn(
                    () => document.querySelector('app-root').shadowRoot.querySelector('ui-alert-banner').textContent.trim(),
                );
                assert.ok(text.length > 0, 'the banner is not empty');
                // The banner sets its own role="alert" (component #49, DEPARTURE 4).
                const role = await page.evalFn(
                    () => document.querySelector('app-root').shadowRoot.querySelector('ui-alert-banner').getAttribute('role'),
                );
                assert.equal(role, 'alert');
            },
            { screens: 'failing' },
        ));

        /* -- 4b. THE INTENTS A SCREEN DISPATCHES AT THE SHELL ---------------- */

        /**
         * Ben, on the glass, 23 Aug 2026: "many of the buttons dont work. I cannot edit
         * profiles or pick a new profile, go to settings etc."
         *
         * Nothing was broken. Nothing was LISTENING. `live-screen.js` dispatches six
         * events and `live-wiring.js` listens to four; its own contract block says so,
         * and the fullscreen control's note names the fix and declines it — "a shell
         * listener is another surface's work". The mapping is pinned without a DOM in
         * test/app-intents.test.mjs; what needs a browser is that the event actually
         * REACHES the shell from inside two shadow roots, and that the shell moves.
         */
        test('a header action from inside the screen navigates the shell',
            () => booted(async (page) => {
                await page.evalFn(() => window.__shell.capabilitiesSettled());

                /* ROUTE AND ADDRESS, NOT THE MOUNTED TAG. This fixture serves the REST
                 * corpus and two screen modules; `settings-screen` and `editor-screen`
                 * are not among them, so the shell routes correctly and then mounts
                 * nothing. That is the fixture's boundary, not a defect, and asserting
                 * the tag here would be asserting the fixture. The real mount of every
                 * screen is its own suite's. */
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
            /* A shell that swapped the screen without writing the hash would leave
             * browser Back pointing at the screen already on the glass. `goto()` writes
             * the address and the one hashchange listener does the rest — the intent
             * handler must go through it, never through boot.goto(). */
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

        /* -- 5. the route swap, and bug S10's class ------------------------- */

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

        /* -- 6. the connection store, composed rather than re-derived -------- */

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

        /* -- 7. ids: one document, no collisions (bug S13) ------------------ */

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

/* ===========================================================================
 * The real document: the pre-paint stamp, end to end
 *
 * Everything above drives the shell with an injected boot. This drives `index.html`
 * itself — the importmap, the inline stamp, the three global sheets and `<app-root>`
 * booting from `window` — because the stamp is the one part of the shell that exists
 * OUTSIDE any module and can only be observed on the page it is written in.
 *
 * There is no server on ReaPrime's port here, so the capability read fails and the six
 * sockets do not open; that is not what this asserts. It asserts the theme.
 * ======================================================================== */

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
        /* WAIT FOR THE BOOT TO SETTLE, rather than for a fixed number of frames. Nothing
         * is serving ReaPrime's port here, so every read has to FAIL before the phase can
         * move — and the boot grew four more of them on 24 Aug 2026 (the rail's stored
         * preferences). A frame count that was enough for six reads is not a claim about
         * the shell; the phase leaving `connecting` is. */
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
                // Network failures are expected (nothing is serving ReaPrime's port here)
                // and they are console noise, not page errors. An uncaught exception in
                // the boot path would be a page error, and there must be none.
                assert.deepEqual(page.pageErrors, []);
            } finally {
                await page.evalFn(() => { localStorage.removeItem('decal.theme'); return true; });
            }
        }));

    test('the stamp runs before the stylesheets it decides — the no-flash order', () =>
        browser.withPage({ geometry: BENCH }, async (page) => {
            // Structural, because a flash cannot be screenshotted reliably: what makes it
            // impossible is that the attribute is set by a synchronous inline script that
            // appears BEFORE the first <link rel="stylesheet"> in the document.
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
                'one attribute on the root is the whole switching mechanism (SCOPE Part 2 §6)');
            assert.equal(result.after.source, 'stored');
        }));
});
