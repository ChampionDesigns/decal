/**
 *.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, sleep, GATE_A_GEOMETRIES } from '../harness/index.js';
import { entry as galleryEntry } from '../../tools/gallery/entries/ui-screensaver.entry.js';
import { assertTokenDrill, assertFocusUnclipped, DRILL_COLOUR } from '../harness/assertions.js';

const MODULE = ['/src/components/ui-screensaver.js'];

/** The screen the blank covers, so "covered" and "not covered" are both visible. */
const PANEL = '<div id="panel" style="position:fixed; inset:0;'
    + ' background-color:var(--ui-fascia)"></div>';

/** One viewport-anchored blank over a panel, machine confirmed asleep. */
const ASLEEP = `${PANEL}
<ui-screensaver id="s1" machine-state="sleeping" brightness-supported></ui-screensaver>`;

const CLOCK = `${PANEL}
<ui-screensaver id="s1" machine-state="sleeping" brightness-supported clock></ui-screensaver>`;

const IMAGE = `${PANEL}
<ui-screensaver id="s1" machine-state="sleeping" brightness-supported
    image="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
></ui-screensaver>`;

/** The same, with the user's `screensaverEnabled` setting off. */
const DISABLED = `${PANEL}
<ui-screensaver id="s1" machine-state="sleeping" enabled="false" brightness-supported></ui-screensaver>`;

/** Two of them — the D10 owner test. Both are viewport-anchored, both see a sleep. */
const TWO = `${PANEL}
<ui-screensaver id="s1" machine-state="sleeping" brightness-supported></ui-screensaver>
<ui-screensaver id="s2" machine-state="sleeping" brightness-supported></ui-screensaver>`;

const TWO_AND_A_PARENT = `${PANEL}
<div id="host-a">
  <ui-screensaver id="s1" machine-state="sleeping" brightness-supported></ui-screensaver>
  <ui-screensaver id="s2" machine-state="sleeping" brightness-supported></ui-screensaver>
</div>
<div id="host-b"></div>`;

/** Container-anchored, in a positioned stage — the gallery's shape and the floor test. */
const IN_PANEL = `
<div id="stage" style="position:relative; inline-size:320px; block-size:200px;
     background-color:var(--ui-fascia)">
  <ui-screensaver id="s1" anchor="container" machine-state="sleeping"></ui-screensaver>
</div>`;

/** Rendered lengths at dsf 1.5 are not string-comparable; whole CSS px are. */
const near = (got, want, what, tol = 0.51) => assert.ok(
    Math.abs(got - want) <= tol,
    `${what}: expected ${want}, got ${got}`,
);

const SHEET_AUDIT = `(() => {
    const host = document.getElementById('s1');
    const sheets = Array.from(host.shadowRoot.adoptedStyleSheets);
    const own = sheets.filter((s) => Array.from(s.cssRules)
        .some((r) => (r.cssText || '').indexOf('--_ui-focus-offset') !== -1
            && (r.cssText || '').indexOf('.blank') !== -1));
    const selectors = [];
    const atRules = [];
    const declares = {};
    const important = [];
    const tokens = new Set();
    const walk = (rules) => {
        for (const r of rules) {
            if (r.constructor && /FontFace/.test(r.constructor.name)) atRules.push('font-face');
            if (typeof r.conditionText === 'string') atRules.push(r.conditionText);
            if (typeof r.selectorText === 'string' && r.style) {
                selectors.push(r.selectorText);
                for (const prop of r.style) {
                    declares[prop] = (declares[prop] || 0) + 1;
                    if (r.style.getPropertyPriority(prop)) important.push(r.selectorText + ' { ' + prop + ' }');
                    const value = r.style.getPropertyValue(prop) || '';
                    for (const m of value.matchAll(/var\\(\\s*(--[a-z0-9-]+)/gi)) tokens.add(m[1]);
                }
            }
            if (r.cssRules) walk(r.cssRules);
        }
    };
    for (const s of own) walk(s.cssRules);
    return JSON.stringify({
        ownSheets: own.length, selectors, atRules, declares, important,
        tokens: [...tokens].sort(),
    });
})()`;

/** The layout viewport — what a fixed box is inset from; innerWidth counts a scrollbar. */
const VIEWPORT = 'JSON.stringify({w: document.documentElement.clientWidth,'
    + ' h: document.documentElement.clientHeight})';

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`ui-screensaver @ ${geometry.name} (${geometry.width}×${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

        const mounted = (fn, markup = ASLEEP) => browser.withPage({ geometry }, async (page) => {
            await page.mount(markup, MODULE);
            assert.deepEqual(page.pageErrors, [], 'the component must mount without throwing');
            return fn(page);
        });

        test('the emulated geometry is the one the suite asked for', () => mounted(async (page) => {
            const env = JSON.parse(await page.eval(
                'JSON.stringify({dpr: devicePixelRatio, w: innerWidth, h: innerHeight})',
            ));
            assert.deepEqual(env, {
                dpr: geometry.deviceScaleFactor,
                w: geometry.width,
                h: geometry.height,
            });
        }));

        test('a confirmed sleep paints a fully black box over the whole layout viewport',
            () => mounted(async (page) => {
                const host = await page.computed('#s1', ['position', 'z-index', 'display', 'background-color']);
                assert.equal(host.position, 'fixed',
                    'the blank pins itself; a screen does not have to wrap it');
                assert.equal(host.display, 'block');

                assert.equal(host['z-index'], await page.resolveToken('--ui-z-blackout', 'z-index'));
                assert.equal(host['z-index'], '400');

                /* FULLY BLACK. Not --ui-canvas, which is #e8eaeb in the light theme. */
                assert.equal(host['background-color'], 'rgb(0, 0, 0)');
                assert.equal(await page.prop('#s1 >>> #blank', 'background-color'), 'rgb(0, 0, 0)');

                const box = await page.box('#s1');
                const vp = JSON.parse(await page.eval(VIEWPORT));
                near(box.left, 0, 'inset-inline-start is 0');
                near(box.top, 0, 'inset-block-start is 0');
                near(box.width, vp.w, 'the blank spans the layout viewport');
                near(box.height, vp.h, 'the blank spans the layout viewport');

                /* The panel under it is genuinely covered — the real hit test, which is
                 * the half a screenshot cannot see. Retargeted to the host, because the
                 * button lives in a shadow root. */
                const under = await page.eval(
                    '(() => { const el = document.elementFromPoint(8, 8);'
                    + ' return el ? (el.id || el.tagName.toLowerCase()) : null; })()',
                );
                assert.equal(under, 's1', 'a press anywhere on the blank must land on the blank');
            }));

        test('the blank is promoted into the top layer, so nothing paints on a blanked screen',
            () => mounted(async (page) => {
                const layer = await page.evalFn(() => {
                    const el = document.getElementById('s1');
                    return {
                        popover: el.getAttribute('popover'),
                        open: el.matches(':popover-open'),
                        supported: typeof HTMLElement.prototype.showPopover === 'function',
                    };
                });
                assert.equal(layer.supported, true, 'this Chrome must support the API the guard tests for');
                assert.equal(layer.popover, 'manual',
                    'manual: light dismiss and Escape must not take a screensaver down');
                assert.equal(layer.open, true, 'an active blank is in the top layer');
            }));

        test('anchor="container" leaves the top layer and fills its own box instead',
            () => mounted(async (page) => {
                const got = await page.computed('#s1', ['position']);
                assert.equal(got.position, 'absolute');
                assert.equal(await page.evalFn(() => document.getElementById('s1').hasAttribute('popover')), false,
                    'a panel-scoped blank must not take the whole window with it');

                const stage = await page.box('#stage');
                const box = await page.box('#s1');
                near(box.width, stage.width, 'the blank fills its container inline');
                near(box.height, stage.height, 'the blank fills its container block');
                near(box.left, stage.left, 'and does not leak past its left edge');
                near(box.top, stage.top, 'and does not leak past its top edge');
                near(await page.box('#s1 >>> #blank').then((b) => b.width), stage.width,
                    'the press target is the whole blank');
            }, IN_PANEL));

        test('the ground is --ui-blackout and nothing else (token drill)',
            () => mounted(async (page) => {
                await assertTokenDrill(page, {
                    token: '--ui-blackout',
                    value: DRILL_COLOUR,
                    selector: '#s1 >>> #blank',
                    property: 'background-color',
                });
                await assertTokenDrill(page, {
                    token: '--ui-blackout',
                    value: DRILL_COLOUR,
                    selector: '#s1',
                    property: 'background-color',
                });
            }));

        test('an awake machine, an unknown name and an absence all leave the screen alone',
            () => mounted(async (page) => {
                const paints = async (state) => {
                    await page.evalFn((s) => {
                        const el = document.getElementById('s1');
                        if (s === null) el.removeAttribute('machine-state');
                        else el.setAttribute('machine-state', s);
                    }, state);
                    await page.settle(2);
                    return page.prop('#s1', 'display');
                };

                assert.equal(await page.prop('#s1', 'display'), 'block', 'sleeping blanks');

                /* Awake. */
                assert.equal(await paints('idle'), 'none');
                /* A name this build's generated enum does not carry — a machine doing
                 * something we have no name for is still a machine doing something. */
                assert.equal(await paints('sleeping'), 'block');
                assert.equal(await paints('Sleeping'), 'none',
                    'case-folding here would blank the screen on a name ReaPrime never sent (A7)');
                /* The address layer's absence — what a BLE drop now arrives as. */
                assert.equal(await paints('sleeping'), 'block');
                assert.equal(await paints(null), 'none',
                    'nothing is not a confirmation, and an absence RELEASES a blank (reaprime#519)');
            }));

        test('the user setting turns the whole feature off — no overlay AND no dim',
            () => mounted(async (page) => {
                assert.equal(await page.prop('#s1', 'display'), 'none',
                    'a sleep with the feature off paints nothing');

                await page.recordEvents('#s1', ['ui-screensaver-dim', 'ui-screensaver-blank']);
                await page.evalFn(() => document.getElementById('s1').setAttribute('machine-state', 'idle'));
                await page.settle(2);
                await page.evalFn(() => document.getElementById('s1').setAttribute('machine-state', 'sleeping'));
                await page.settle(2);
                assert.equal(await page.prop('#s1', 'display'), 'none');
                assert.equal((await page.recordedEvents()).filter((e) => e.type === 'ui-screensaver-dim').length, 0,
                    'one feature, one switch: off means neither half');

                /* Turning it back on is the port's answer and not a repair: the overlay
                 * goes up on the next derivation, because the machine still confirms a
                 * sleep. Nothing here is optimistic. */
                await page.evalFn(() => document.getElementById('s1').setAttribute('enabled', ''));
                await page.settle(2);
                assert.equal(await page.prop('#s1', 'display'), 'block');
            }, DISABLED));

        test('a second screensaver is REFUSED the blank, and says so', () => mounted(async (page) => {
            const one = await page.prop('#s1', 'display');
            const two = await page.prop('#s2', 'display');
            assert.equal(one, 'block', 'the first claimant holds the blank');
            assert.equal(two, 'none', 'exactly one piece of software may blank the screen (D10)');

            const owner = await page.evalFn(async () => {
                const m = await import('/src/components/ui-screensaver.js');
                return {
                    isFirst: m.blankingOwner() === document.getElementById('s1'),
                    isSecond: m.blankingOwner() === document.getElementById('s2'),
                };
            });
            assert.equal(owner.isFirst, true, 'the owner slot holds the element that painted');
            assert.equal(owner.isSecond, false, 'and it holds exactly one');

            /* Both refusals already happened at mount, so the recorder is attached and
             * the second element is made to derive again — same inputs, same answer. */
            await page.recordEvents('#s2', ['ui-screensaver-blank', 'ui-screensaver-dim']);
            await page.evalFn(() => document.getElementById('s2').removeAttribute('machine-state'));
            await page.settle(2);
            await page.evalFn(() => document.getElementById('s2').setAttribute('machine-state', 'sleeping'));
            await page.settle(2);
            assert.equal(await page.prop('#s2', 'display'), 'none', 'still refused');

            const seen = await page.recordedEvents();
            assert.equal(await page.evalFn(() => document.getElementById('s2').active), false,
                'the refused element does not believe it blanked');
            assert.equal(seen.filter((e) => e.type === 'ui-screensaver-dim').length, 0,
                'a refused screensaver dims nothing: the owner owns both halves');
            assert.deepEqual(seen, [],
                'and it announces nothing at all — the paint is not a report (F-013)');

            /* And the slot is released, not leaked: the owner going away lets the other
             * one take it, which is what stops one stale element blanking the skin for
             * the rest of the session. */
            await page.evalFn(() => document.getElementById('s1').remove());
            await page.evalFn(() => {
                const el = document.getElementById('s2');
                el.removeAttribute('machine-state');
                el.setAttribute('machine-state', 'sleeping');
            });
            await page.settle(2);
            assert.equal(await page.prop('#s2', 'display'), 'block',
                'the owner slot is released on disconnect');
            assert.equal(
                await page.evalFn(async () => {
                    const m = await import('/src/components/ui-screensaver.js');
                    return m.blankingOwner() === document.getElementById('s2');
                }),
                true,
                'the slot moved to the new owner rather than staying empty or holding a corpse',
            );
        }, TWO));

        test('a RE-PARENTED screensaver still cannot blank beside the owner', () => mounted(async (page) => {
            assert.equal(await page.prop('#s1', 'display'), 'block', 'the first claimant paints');
            assert.equal(await page.prop('#s2', 'display'), 'none', 'the second is refused');

            await page.evalFn(() => {
                document.getElementById('host-b').appendChild(document.getElementById('s1'));
                return true;
            });
            await page.settle(2);
            assert.equal(await page.prop('#s1', 'display'), 'block',
                'a move is not a wake: the machine is still asleep');
            assert.equal(
                await page.evalFn(async () => {
                    const m = await import('/src/components/ui-screensaver.js');
                    return m.blankingOwner() === document.getElementById('s1');
                }),
                true,
                'the mover re-takes the slot it released on the way out, or it is painting a blank it does not own',
            );

            /* And the other one is still refused, because the slot was never vacant. */
            await page.evalFn(() => document.getElementById('s2').removeAttribute('machine-state'));
            await page.settle(1);
            await page.evalFn(() => document.getElementById('s2').setAttribute('machine-state', 'sleeping'));
            await page.settle(2);
            const painting = await page.evalFn(() => [...document.querySelectorAll('ui-screensaver')]
                .filter((el) => getComputedStyle(el).display !== 'none').length);
            assert.equal(painting, 1, 'two blankers is inexpressible (D10), re-parent or not');

            await page.evalFn(() => {
                window.__parked = document.getElementById('s1');
                window.__parked.remove();
            });
            await page.evalFn(() => document.getElementById('s2').removeAttribute('machine-state'));
            await page.settle(1);
            await page.evalFn(() => document.getElementById('s2').setAttribute('machine-state', 'sleeping'));
            await page.settle(2);
            assert.equal(await page.prop('#s2', 'display'), 'block',
                'the slot is released on disconnect, so the survivor takes it');

            await page.recordEvents('#host-b', ['ui-screensaver-blank', 'ui-screensaver-dim']);
            await page.evalFn(() => {
                document.getElementById('host-b').appendChild(window.__parked);
                return true;
            });
            await page.settle(2);

            assert.equal(await page.prop('#s1', 'display'), 'none',
                'a returning element does not paint over the element that owns the blank');
            assert.equal(
                await page.evalFn(async () => {
                    const m = await import('/src/components/ui-screensaver.js');
                    return m.blankingOwner() === document.getElementById('s2');
                }),
                true,
                'and it does not take the slot from under it either',
            );

            const seen = await page.recordedEvents();
            assert.equal(await page.evalFn(() => document.getElementById('s1').active), false,
                'the returning element does not believe it blanked');
            assert.equal(seen.filter((e) => e.type === 'ui-screensaver-dim').length, 0,
                'a refused screensaver dims nothing, whichever way it was refused');
            assert.deepEqual(seen, [],
                'and it announces nothing at all, whichever way it was refused (F-013)');
        }, TWO_AND_A_PARENT));

        test('the dim goes out with the blank, once, and carries the port\'s integer',
            () => mounted(async (page) => {
                /* Recorded from a clean mount: re-arm by leaving sleep and coming back. */
                await page.recordEvents('#s1', ['ui-screensaver-dim', 'ui-screensaver-blank']);
                await page.evalFn(() => document.getElementById('s1').setAttribute('machine-state', 'idle'));
                await page.settle(2);
                await page.evalFn(() => document.getElementById('s1').setAttribute('machine-state', 'sleeping'));
                await page.settle(2);

                const seen = await page.recordedEvents();
                const dims = seen.filter((e) => e.type === 'ui-screensaver-dim');
                assert.equal(dims.length, 1, `exactly one dim per entry into sleep — saw ${JSON.stringify(seen)}`);
                /* SCREENSAVER_BRIGHTNESS, an INT: display_handler drops a setBrightness
                 * that is not an integer 0..100 with a log line and no reply, so a float
                 * here is a command that vanishes. */
                assert.equal(dims[0].detail.brightness, 0);
                assert.equal(Number.isInteger(dims[0].detail.brightness), true);

                assert.equal(await page.prop('#s1', 'display'), 'block',
                    'the dim went out with the blank up, not instead of it');
                assert.deepEqual(seen.map((e) => e.type), ['ui-screensaver-dim'],
                    `the dim is the whole of what this element says (F-013) — saw ${JSON.stringify(seen)}`);
            }));

        test('a CLOCK saver blanks and asks for no dim at all',
            () => mounted(async (page) => {
                await page.recordEvents('#s1', ['ui-screensaver-dim', 'ui-screensaver-blank']);
                await page.evalFn(() => document.getElementById('s1').setAttribute('machine-state', 'idle'));
                await page.settle(2);
                await page.evalFn(() => document.getElementById('s1').setAttribute('machine-state', 'sleeping'));
                await page.settle(2);
                assert.equal(await page.prop('#s1', 'display'), 'block', 'the overlay still goes up');
                const seen = await page.recordedEvents();
                assert.equal(seen.filter((e) => e.type === 'ui-screensaver-dim').length, 0,
                    'a clock on a panel at brightness 0 is a clock nobody can read');
            }, CLOCK));

        test('an IMAGE saver blanks and asks for no dim at all',
            () => mounted(async (page) => {
                await page.recordEvents('#s1', ['ui-screensaver-dim', 'ui-screensaver-blank']);
                await page.evalFn(() => document.getElementById('s1').setAttribute('machine-state', 'idle'));
                await page.settle(2);
                await page.evalFn(() => document.getElementById('s1').setAttribute('machine-state', 'sleeping'));
                await page.settle(2);
                assert.equal(await page.prop('#s1', 'display'), 'block');
                const seen = await page.recordedEvents();
                assert.equal(seen.filter((e) => e.type === 'ui-screensaver-dim').length, 0,
                    'a picture on a panel at brightness 0 is a black screen with a cost');
            }, IMAGE));

        test('and switching a sleeping saver TO black spends the dim it was holding',
            () => mounted(async (page) => {
                await page.recordEvents('#s1', ['ui-screensaver-dim']);
                await page.evalFn(() => document.getElementById('s1').setAttribute('machine-state', 'idle'));
                await page.settle(2);
                await page.evalFn(() => document.getElementById('s1').setAttribute('machine-state', 'sleeping'));
                await page.settle(2);
                assert.equal((await page.recordedEvents()).length, 0, 'a clock saver holds its dim');

                await page.evalFn(() => document.getElementById('s1').removeAttribute('clock'));
                await page.settle(2);
                const dims = (await page.recordedEvents()).filter((e) => e.type === 'ui-screensaver-dim');
                assert.equal(dims.length, 1);
                assert.equal(dims[0].detail.brightness, 0);
            }, CLOCK));

        test('a platform with no brightness control is never asked to dim',
            () => mounted(async (page) => {
                await page.recordEvents('#s1', ['ui-screensaver-dim']);
                await page.evalFn(() => {
                    const el = document.getElementById('s1');
                    el.removeAttribute('brightness-supported');
                    el.setAttribute('machine-state', 'idle');
                });
                await page.settle(2);
                await page.evalFn(() => document.getElementById('s1').setAttribute('machine-state', 'sleeping'));
                await page.settle(2);
                assert.equal(await page.prop('#s1', 'display'), 'block', 'the overlay still blanks');
                assert.equal((await page.recordedEvents()).length, 0,
                    'an absent capability is not a capability — no ?? true anywhere (A7)');
            }));

        test('Q13: the wake edge derives a RESTORE and the skin asks nobody for it',
            () => mounted(async (page) => {
                await page.recordEvents('#s1', [
                    'ui-screensaver-dim', 'ui-screensaver-restore', 'ui-screensaver-blank',
                ]);
                assert.equal(await page.prop('#s1', 'display'), 'block');

                /* The wake edge: a confirmed sleep exits to any other state. */
                await page.evalFn(() => document.getElementById('s1').setAttribute('machine-state', 'idle'));
                await page.settle(2);

                /* The port's answer is computed and VISIBLE — that is the evidence the
                 * reversal would read before changing anything. */
                assert.equal(
                    await page.evalFn(() => document.getElementById('s1').getAttribute('display-action')),
                    'restore',
                );
                assert.equal(await page.prop('#s1', 'display'), 'none', 'the overlay came down');

                const seen = await page.recordedEvents();
                assert.deepEqual(seen, [],
                    'ReaPrime restores autonomously on awake-with-brightness-0 '
                    + '(display_controller.dart:276-285); exactly one side drives that edge '
                    + `and it is not this one — saw ${JSON.stringify(seen)}`);

                /* And there is no restore in the vocabulary to be turned on by accident. */
                const vocabulary = await page.evalFn(async () => {
                    const m = await import('/src/components/ui-screensaver.js');
                    return Object.values(m.SCREENSAVER_EVENT);
                });
                assert.deepEqual(vocabulary.filter((n) => /restore/i.test(n)), [],
                    'the absence is structural, not a disabled branch');
            }));

        test('a press on a sleeping machine wakes it once, with the generated name',
            () => mounted(async (page) => {
                await page.recordEvents('#s1', ['ui-screensaver-wake', 'ui-screensaver-blank']);
                await page.click('#s1 >>> #blank');
                await page.settle(2);

                const seen = await page.recordedEvents();
                const wakes = seen.filter((e) => e.type === 'ui-screensaver-wake');
                assert.equal(wakes.length, 1, `one press, one wake — saw ${JSON.stringify(seen)}`);
                /* MACHINE_STATE.IDLE, from deriveSleepButtonAction, not spelled in the
                 * component: the screen's PUT /machine/state/{newState} cannot carry a
                 * name ReaPrime does not accept. */
                assert.equal(wakes[0].detail.state, 'idle');

                assert.equal(await page.prop('#s1', 'display'), 'none',
                    'the overlay comes down with the press, not with the confirmation');

                await page.evalFn(() => {
                    const el = document.getElementById('s1');
                    el.setAttribute('machine-state', 'idle');
                    el.setAttribute('machine-state', 'sleeping');
                });
                await page.settle(3);
                assert.equal(await page.prop('#s1', 'display'), 'none',
                    'a stale sleeping frame during the grace must not re-raise the blank');
            }));

        test('a press on a blank over an AWAKE machine sends no command at all',
            () => mounted(async (page) => {
                /* The overlay is up and the machine reports awake — the exact shape of
                 * the original defect, where the teardown itself sent setMachineState. */
                await page.recordEvents('#s1', ['ui-screensaver-wake', 'ui-screensaver-blank']);
                await page.evalFn(() => {
                    const el = document.getElementById('s1');
                    el.machineState = 'idle';
                    el.shadowRoot.getElementById('blank').click();
                });
                await page.settle(2);

                const seen = await page.recordedEvents();
                assert.equal(seen.filter((e) => e.type === 'ui-screensaver-wake').length, 0,
                    'hiding an overlay is not a user asking for a machine state '
                    + `(screensaver-policy.js:23-25) — saw ${JSON.stringify(seen)}`);
                assert.equal(await page.prop('#s1', 'display'), 'none');
            }));

        test('the wake suppression is time-bounded: an unconfirmed wake cannot latch the blank off',
            () => mounted(async (page) => {
                await page.evalFn(() => document.getElementById('s1').setAttribute('grace-ms', '600'));
                await page.settle(2);
                await page.recordEvents('#s1', ['ui-screensaver-dim', 'ui-screensaver-blank']);

                await page.click('#s1 >>> #blank');
                await page.settle(2);
                assert.equal(await page.prop('#s1', 'display'), 'none');

                /* The PUT was lost or refused; the machine is still asleep. The blank must
                 * come back on its own — nothing else is going to change. */
                await sleep(900);
                await page.settle(2);
                assert.equal(await page.prop('#s1', 'display'), 'block',
                    'the suppression expires and the blank is a pure function of the '
                    + 'confirmed state again');

                assert.equal((await page.recordedEvents()).filter((e) => e.type === 'ui-screensaver-dim').length, 0,
                    'the panel was never restored, so it must not be dimmed a second time');
            }));

        test('the press target takes the one focus ring, drawn INSIDE the blank',
            () => mounted(async (page) => {
                await assertFocusUnclipped(page, '#s1 >>> #blank');
                const offset = parseFloat(await page.prop('#s1 >>> #blank', 'outline-offset'));
                assert.ok(offset < 0,
                    `a full-bleed control's outset ring falls off the screen; expected the `
                    + `inset offset, got ${offset}`);
            }));

        test('the blank announces what pressing it does, and Enter does it',
            () => mounted(async (page) => {
                const named = await page.evalFn(() => {
                    const el = document.getElementById('s1').shadowRoot.getElementById('blank');
                    return { tag: el.tagName.toLowerCase(), text: el.textContent.trim() };
                });
                assert.equal(named.tag, 'button', 'a real button, not a div with a click handler');
                assert.equal(named.text, 'Wake the machine');

                await page.recordEvents('#s1', ['ui-screensaver-wake']);
                await page.focusVisible('#s1 >>> #blank');
                await page.press('Enter');
                await page.settle(2);
                assert.equal((await page.recordedEvents()).length, 1,
                    'the whole screen is the wake affordance, so it must be reachable '
                    + 'without a pointer');
            }));

        test('attachScreensaver drives the blank from a real feed store, absences included',
            () => mounted(async (page) => {
                const result = await page.evalFn(async () => {
                    const [{ attachScreensaver }, { createFeedStore }, address, readers] = await Promise.all([
                        import('/src/components/ui-screensaver.js'),
                        import('/src/stores/feed-store.js'),
                        import('/src/data/rea-address.js'),
                        import('/src/stores/feed-readers.js'),
                    ]);
                    const el = document.getElementById('s1');
                    el.removeAttribute('machine-state');
                    el.removeAttribute('brightness-supported');

                    const machine = createFeedStore({ label: 'machine', read: address.readMachineSnapshot });
                    const display = createFeedStore({ label: 'display', read: readers.readDisplayFrame });
                    const detach = attachScreensaver(el, { machine, display });
                    await el.updateComplete;
                    const before = getComputedStyle(el).display;

                    /* A real MachineSnapshot frame, read by the real reader. */
                    machine.accept({ state: { state: 'sleeping' } });
                    display.accept({ brightness: 42, platformSupported: { brightness: true } });
                    await el.updateComplete;
                    const asleep = getComputedStyle(el).display;

                    /* A frame that carries no state at all: the address layer's absence,
                     * handed through untouched. */
                    machine.accept({ timestamp: '2026-08-18T00:00:00Z' });
                    await el.updateComplete;
                    const absent = getComputedStyle(el).display;
                    const absentKind = el.machineState && typeof el.machineState === 'object'
                        ? 'noReading' : typeof el.machineState;

                    detach();
                    machine.accept({ state: { state: 'sleeping' } });
                    await el.updateComplete;
                    const afterDetach = getComputedStyle(el).display;
                    return { before, asleep, absent, absentKind, afterDetach };
                });

                assert.equal(result.before, 'none', 'no frame yet is the boot case, and it never blanks');
                assert.equal(result.asleep, 'block', 'a confirmed sleep off the real feed blanks');
                assert.equal(result.absent, 'none',
                    'a frame with no state releases the blank — the BLE drop reaprime#519 was written for');
                assert.equal(result.absentKind, 'noReading',
                    'the absence arrives whole; coercing it here would be the fallback A7 forbids');
                assert.equal(result.afterDetach, 'none', 'detach really unsubscribes');
            }));

        test('attachScreensaver reads the DECIDED default, not the stored absence',
            () => mounted(async (page) => {
                const result = await page.evalFn(async () => {
                    const [{ attachScreensaver }, { createSettingsStore }, { createStorageRouter },
                        { defaultFor }] = await Promise.all([
                        import('/src/components/ui-screensaver.js'),
                        import('/src/stores/settings-store.js'),
                        import('/src/lib/storage-router.js'),
                        import('/src/lib/settings-defaults.js'),
                    ]);

                    const memory = new Map();
                    const backend = {
                        kind: 'memory',
                        get: (k) => memory.get(k),
                        set: (k, v) => { memory.set(k, v); },
                        remove: (k) => { memory.delete(k); },
                    };
                    const settings = createSettingsStore({
                        storage: createStorageRouter({ backends: { local: backend, kv: backend } }),
                    });

                    const el = document.getElementById('s1');
                    el.removeAttribute('clock');
                    el.image = '';
                    const detach = attachScreensaver(el, { settings });
                    await el.updateComplete;
                    const sync = { clock: el.clock, image: el.image, enabled: el.enabled,
                        language: el.language, clockFormat: el.clockFormat };

                    /* And after the `load()` promises settle, which is where a STORED
                     * answer would arrive. There is none, so nothing may move. */
                    await new Promise((r) => setTimeout(r, 60));
                    await el.updateComplete;
                    const settled = { clock: el.clock, image: el.image, enabled: el.enabled,
                        language: el.language, clockFormat: el.clockFormat };
                    /* READ BEFORE THE `set` BELOW, or it reads the value the test wrote. */
                    const storedType = settings.storedValue('screensaverType');

                    /* THE STORED VALUE STILL WINS. A default that could not be overridden
                     * would be a worse bug than the one being fixed. */
                    await settings.set('screensaverType', 'clock');
                    await new Promise((r) => setTimeout(r, 30));
                    await el.updateComplete;
                    const chosen = { clock: el.clock, image: el.image };

                    detach();
                    return {
                        sync,
                        settled,
                        chosen,
                        table: {
                            type: defaultFor('screensaverType'),
                            language: defaultFor('language'),
                            clockFormat: defaultFor('clockFormat'),
                            enabled: defaultFor('screensaverEnabled'),
                        },
                        storedType,
                    };
                });

                assert.equal(result.table.type, 'image', 'the premise: Ben decided Image');
                assert.equal(result.sync.clock, false, 'Image is not Clock');
                assert.notEqual(result.sync.image, '',
                    'the saver paints the bundled picture — before this fix it painted a '
                    + 'black screen while the Settings page drew Image selected');
                assert.equal(result.settled.image, result.sync.image,
                    'and nothing stored means nothing moves when the reads land');

                assert.equal(result.sync.enabled, result.table.enabled,
                    'the switch\'s default, from the table');
                assert.equal(result.sync.language, result.table.language,
                    'the clock is spelled in Ben\'s language, not in the empty string — '
                    + '\'\' is not a locale, it is Intl\'s door to the BROWSER\'s');
                assert.equal(result.sync.clockFormat, result.table.clockFormat,
                    'and in his 12-hour, which wall-clock.js already read from this table');

                assert.equal(result.storedType, undefined,
                    'nothing was written: a default is not a write (settings-store.js)');
                assert.equal(result.chosen.clock, true, 'a chosen value still wins');
                assert.equal(result.chosen.image, '', 'and takes the picture away with it');
            }));

        test('a settings store missing value() is refused, not quietly worked around',
            () => mounted(async (page) => {
                const thrown = await page.evalFn(async () => {
                    const { attachScreensaver } = await import('/src/components/ui-screensaver.js');
                    const el = document.getElementById('s1');
                    try {
                        attachScreensaver(el, { settings: { subscribe: () => () => {}, load: () => {} } });
                        return null;
                    } catch (error) { return error.message; }
                });
                assert.match(String(thrown), /must provide value\(\)/);
            }));

        test('the component\'s own sheet: no width query, no !important, no @font-face, no dial',
            () => mounted(async (page) => {
                const sheet = JSON.parse(await page.eval(SHEET_AUDIT));
                assert.equal(sheet.ownSheets, 1, 'the component must contribute exactly one sheet');
                assert.deepEqual(sheet.important, [], 'zero !important (CONVENTIONS §6)');
                for (const rule of sheet.atRules) {
                    assert.doesNotMatch(rule, /width|height|orientation|aspect-ratio/,
                        `${rule}: a blank that covers the screen needs no breakpoint`);
                    assert.doesNotMatch(rule, /font-face/,
                        `${rule}: a shadow-declared face never registers`);
                    assert.match(rule, /prefers-reduced-motion|prefers-color-scheme/,
                        `${rule} is neither a user preference nor an at-rule this component has a reason for`);
                }

                for (const token of ['--ui-blackout', '--ui-z-blackout', '--ui-focus-offset-inset']) {
                    assert.ok(sheet.tokens.includes(token), `${token} must be read by name`);
                }
                for (const dial of ['--ui-selected-face', '--ui-selected-ink', '--ui-selected-led', '--ui-selected-glow']) {
                    assert.ok(!sheet.tokens.includes(dial),
                        `${dial}: #57 has no selection state, so it must not own a selection look`);
                }
                assert.ok(sheet.tokens.every((t) => t.startsWith('--ui-')),
                    `every token read must be a public --ui-* name: ${sheet.tokens.join(', ')}`);
            }));

        test('every gallery state mounts and paints what its title claims', () => mounted(async (page) => {
            assert.equal(galleryEntry.id, 'ui-screensaver');
            assert.equal(galleryEntry.module, '../../src/components/ui-screensaver.js');
            assert.ok(galleryEntry.states.length >= 5);

            const blanks = { blank: true, awake: false, 'unknown-state': false, 'no-reading': false, disabled: false, 'narrow-container': true };
            for (const state of galleryEntry.states) {
                assert.ok(state.html.includes('anchor="container"'),
                    `${state.id}: a viewport-anchored gallery state blacks out the gallery`);
                assert.ok(state.hostStyle && state.hostStyle.position === 'relative',
                    `${state.id}: the stage must be the positioned ancestor`);

                await page.mount(
                    `<div id="stage" style="position:relative; inline-size:${state.hostStyle['inline-size']};`
                    + ` block-size:${state.hostStyle['block-size']}">${state.html}</div>`,
                    MODULE,
                );
                assert.deepEqual(page.pageErrors, [], `${state.id} must mount without throwing`);
                const painted = await page.prop('ui-screensaver', 'display');
                assert.equal(painted, blanks[state.id] ? 'block' : 'none',
                    `${state.id}: expected ${blanks[state.id] ? 'a blank' : 'an untouched screen'}`);
            }
        }, IN_PANEL));
    });
}
