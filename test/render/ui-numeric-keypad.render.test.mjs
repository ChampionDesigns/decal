/**
 *.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';
import { entry as galleryEntry } from '../../tools/gallery/entries/ui-numeric-keypad.entry.js';
import { limitsFor, numpadRange, clamp, bandHint } from '../../src/lib/machine-limits.js';
import {
    TEMP_UNIT, displayRange, toDisplayTemp, fromDisplayTemp,
} from '../../src/lib/temperature.js';
import {
    assertTokenDrill,
    assertFocusUnclipped,
    assertScrollFloor,
    assertHitFloor,
    DRILL_COLOUR,
    DRILL_LENGTH,
} from '../harness/assertions.js';

const MODULE = [
    '/src/components/ui-numeric-keypad.js',
    '/src/components/ui-button.js',
    '/src/components/ui-dialog.js',
];

const BENGLE = limitsFor('bengle');
const DE1 = limitsFor('de1');
const UNKNOWN = limitsFor(null);

/** The keypad, and something outside it to give the caret back to. */
const MARKUP = `
<div id="page" style="padding: 40px">
  <ui-button id="invoker">18 g</ui-button>
  <button id="outside" style="margin-inline-start: 24px">Outside</button>
  <ui-numeric-keypad id="np" heading="Dose in" limit-key="dose" unit="g" value="18"></ui-numeric-keypad>
</div>`;

/** A keypad nested over a plain #18 instance — the appendix's Escape case. */
const NESTED = `
<div id="page" style="padding: 40px">
  <ui-dialog id="under" open heading="Edit step">
    <p slot="body" style="margin: 0">The step editor, with a numpad opened over it.</p>
  </ui-dialog>
  <ui-numeric-keypad id="np" heading="Dose in" limit-key="dose" unit="g" value="18"></ui-numeric-keypad>
</div>`;

/**
 * Hands the component the table and opens it, the way a screen does. The table is
 * passed in as an argument rather than written into the page, so the ONE table is the
 * one this file imported.
 */
const WIRE = `(() => {
    window.__events = [];
    const np = document.getElementById('np');
    if (!np) return false;
    np.addEventListener('confirm', (e) => window.__events.push(
        'confirm:' + e.detail.value + ':' + e.detail.raw + ':' + e.detail.limitKey));
    np.addEventListener('cancel', (e) => window.__events.push('cancel:' + e.detail.reason));
    const invoker = document.getElementById('invoker');
    if (invoker) invoker.addEventListener('click', () => np.show({ invoker, reason: 'press' }));
    return true;
})()`;

const SHELL = '#np >>> #dialog';                     /* the ui-dialog element   */
const NATIVE = '#np >>> #dialog >>> #dialog';        /* the platform <dialog>   */
const CELL_BODY = '#np >>> #dialog >>> #body';       /* #18's scroll region     */
const TITLE = '#np >>> #dialog >>> ui-sheet-header >>> #title';
const BODY = '#np >>> #body';                        /* this component's box    */
const LAYOUT = '#np >>> #layout';
const WELL = '#np >>> #well';
const DISPLAY = '#np >>> #display';
const UNIT = '#np >>> #unit';
const HINT = '#np >>> #hint';
const PAD = '#np >>> #pad';
const KEY_1 = '#np >>> #key-1';
const KEY_7 = '#np >>> #key-7';
/* The face lives in #15's shadow root, and #15 is a CHILD of the button — so the
 * middle hop is a light-DOM descendant selector, not a second `>>>`. */
const KEY_FACE_7 = '#np >>> #key-7 ui-keycap >>> #cap';
const KEY_DECIMAL = '#np >>> #key-decimal';
const KEY_BACKSPACE = '#np >>> #key-backspace';
const CANCEL = '#np >>> #cancel >>> #btn';
const CONFIRM = '#np >>> #confirm >>> #btn';

/** Rendered lengths at dsf 1.5 are not string-comparable; whole CSS px are. */
const near = (got, want, what, tol = 0.51) => assert.ok(
    Math.abs(got - want) <= tol,
    `${what}: expected ${want}, got ${got}`,
);

const events = async (page) => JSON.parse(await page.eval('JSON.stringify(window.__events)'));

const isOpen = (page) => page.evalFn(() => document.getElementById('np').open === true);

/** Give the component the table and open it. */
const arm = async (page, { limits = BENGLE, limitKey = null, value = null } = {}) => {
    await page.evalFn((t, k, v) => {
        const np = document.getElementById('np');
        if (k !== null) np.setAttribute('limit-key', k);
        if (v !== null) np.setAttribute('value', v);
        np.limits = t;
        np.open = true;
    }, limits, limitKey, value);
    await page.settle(3);
};

/** Press a pad key the way a finger does — a real CDP click on the button. */
const tap = async (page, id) => {
    const selector = `#np >>> #key-${id}`;
    await page.evalFn((s) => {
        window.__h.need(s).scrollIntoView({ block: 'nearest', inline: 'nearest' });
        return true;
    }, selector);
    await page.settle(1);
    await page.click(selector);
    await page.settle(2);
};

const readout = (page) => page.evalFn((s) => window.__h.need(s).textContent, DISPLAY);

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`ui-numeric-keypad @ ${geometry.name} (${geometry.width}×${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

        const mounted = (fn, markup = MARKUP, { wire = WIRE } = {}) => browser.withPage(
            { geometry },
            async (page) => {
                await page.mount(markup, MODULE);
                if (wire) await page.eval(wire);
                assert.deepEqual(page.pageErrors, [], 'the component must mount without throwing');
                return fn(page);
            },
        );

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

        test('B3: the steam range on a Bengle is 135–170, and the 130 dead band appears nowhere',
            () => mounted(async (page) => {
                await arm(page, { limits: BENGLE, limitKey: 'steamTemp', value: '155' });
                const hint = await page.evalFn((s) => window.__h.need(s).textContent, HINT);

                assert.equal(hint, numpadRange(BENGLE, 'steamTemp').label);
                assert.match(hint, /135/, 'the corrected steam FLOOR must be on screen');
                assert.match(hint, /170/, 'the Bengle steam CEILING must be on screen');
                assert.doesNotMatch(hint, /130/, 'B3: 130 is the retired dead-band floor');
            }));

        test('B3: the same field on a DE1 is 135–160 — the class is what moves the range',
            () => mounted(async (page) => {
                await arm(page, { limits: BENGLE, limitKey: 'steamTemp', value: '155' });
                const bengle = await page.evalFn((s) => window.__h.need(s).textContent, HINT);

                /* Nothing changes but the data. Same element, same markup, same
                 * property — a different table from the same port. */
                await page.evalFn((t) => { document.getElementById('np').limits = t; }, DE1);
                await page.settle(2);
                const de1 = await page.evalFn((s) => window.__h.need(s).textContent, HINT);

                assert.notEqual(de1, bengle, 'retargeting the limits data must move the range');
                assert.match(de1, /160/, 'the DE1 steam ceiling is 160 (doc/Skins.md:573)');
                assert.doesNotMatch(de1, /170/, 'the Bengle\'s measured ceiling is not the DE1\'s');
                assert.match(bengle, /170/);
            }));

        test('B3: retargeting the table moves the ACCEPTED range, not just the label',
            () => mounted(async (page) => {
                /* 163 is legal on a Bengle and above the DE1 ceiling. One typed value,
                 * two tables, two outcomes — and this component never picks a number. */
                await arm(page, { limits: BENGLE, limitKey: 'steamTemp', value: '155' });
                for (const d of ['1', '6', '3']) await tap(page, d);
                assert.equal(await readout(page), '163');
                await page.click(CONFIRM);
                await page.settle(2);
                assert.deepEqual(await events(page), [
                    `confirm:${clamp(BENGLE, 'steamTemp', 163)}:163:steamTemp`,
                ]);
                assert.equal(await isOpen(page), false);

                await page.evalFn((t) => {
                    window.__events = [];
                    const np = document.getElementById('np');
                    np.limits = t;
                    np.open = true;
                }, DE1);
                await page.settle(3);
                for (const d of ['1', '6', '3']) await tap(page, d);
                assert.equal(await readout(page), '163');
                assert.equal(
                    await page.evalFn((s) => window.__h.need(s).disabled === true, CONFIRM),
                    true, '163 is above the DE1 ceiling, so there is nothing to confirm');
                await page.click(CONFIRM);
                await page.settle(2);
                assert.deepEqual(await events(page), [],
                    'a refused value leaves nothing on the wire and no substitute number');
                assert.equal(await isOpen(page), true, 'and the pad stays open to be corrected');

                assert.equal(clamp(BENGLE, 'steamTemp', 163), 163);
                assert.equal(numpadRange(DE1, 'steamTemp').max, 160);
            }));

        test('B3: a value inside the dead band cannot be confirmed AT ALL',
            () => mounted(async (page) => {
                await arm(page, { limits: BENGLE, limitKey: 'steamTemp', value: '155' });
                for (const d of ['1', '3', '0']) await tap(page, d);
                assert.equal(await readout(page), '130',
                    'the keys still type — the refusal is at Confirm, not at the pad');
                assert.equal(
                    await page.evalFn((s) => window.__h.need(s).disabled === true, CONFIRM),
                    true);
                await page.click(CONFIRM);
                await page.settle(2);
                assert.deepEqual(await events(page), []);
                assert.equal(await isOpen(page), true);
            }));

        test('F-021: the steam pad refuses 63 and 134 and accepts 135 and 170',
            () => mounted(async (page) => {
                const disabled = () => page.evalFn(
                    (s) => window.__h.need(s).disabled === true, CONFIRM);
                const type = async (digits) => {
                    await page.evalFn(() => { document.getElementById('np').open = false; });
                    await page.settle(2);
                    await arm(page, { limits: BENGLE, limitKey: 'steamTemp', value: '155' });
                    /* The close above reports itself as a cancel, which is #18 behaving
                     * correctly and is not what this test is reading. */
                    await page.evalFn(() => { window.__events = []; });
                    for (const d of digits) await tap(page, d);
                    return readout(page);
                };

                /* THE NUMBER THAT TURNED THE HEATER OFF. Far below the floor, so the old
                 * clamp snapped it DOWN to 0 — the machine's own spelling of "no steam". */
                assert.equal(await type(['6', '3']), '63');
                assert.equal(await disabled(), true, '63 is in the hole and must be refused');

                /* AND THE NUMBER ONE BELOW THE FLOOR, which the old clamp snapped UP. Both
                 * ends of the hole are refusals now; neither is a correction. */
                assert.equal(await type(['1', '3', '4']), '134');
                assert.equal(await disabled(), true);

                /* THE FLOOR ITSELF IS NOT IN THE HOLE. An off-by-one here would make the
                 * coldest steam the machine makes unreachable from the pad. */
                assert.equal(await type(['1', '3', '5']), '135');
                assert.equal(await disabled(), false);

                assert.equal(await type(['1', '7', '0']), '170');
                assert.equal(await disabled(), false);
                await page.click(CONFIRM);
                await page.settle(2);
                assert.deepEqual(await events(page), ['confirm:170:170:steamTemp']);
            }));

        test('F-021: the empty readout is a zero, and a zero is off — so it is refused too',
            () => mounted(async (page) => {
                await arm(page, { limits: BENGLE, limitKey: 'steamTemp', value: '155' });
                for (let i = 0; i < 4; i += 1) await tap(page, 'backspace');
                assert.equal(await readout(page), '0');
                assert.equal(
                    await page.evalFn((s) => window.__h.need(s).disabled === true, CONFIRM),
                    true);
                /* In code as well as in paint — `useprevious` and an `api` confirm go
                 * through the same gate as the button. */
                assert.equal(
                    await page.evalFn(() => document.getElementById('np').confirm('api')),
                    false);
                assert.deepEqual(await events(page), []);
                assert.equal(await isOpen(page), true);
            }));

        test('F-021/F-047: the pad prints the band it accepts, in the ONE composer\'s words',
            () => mounted(async (page) => {
                await arm(page, { limits: BENGLE, limitKey: 'steamTemp', value: '155' });
                const hint = await page.evalFn((s) => window.__h.need(s).textContent, HINT);
                assert.equal(hint, '135–170 °C');
                assert.equal(hint, bandHint({ ...BENGLE.steamTemp, min: 135, floor: undefined }));
                assert.doesNotMatch(hint, /0 or/);
                /* AND THE READOUT SAYS SO TO A SCREEN READER, which cannot see a dimmed
                 * button. `aria-invalid` moves with the state and is absent when legal. */
                const invalid = () => page.evalFn(
                    (s) => window.__h.need(s).getAttribute('aria-invalid'), DISPLAY);
                assert.equal(await invalid(), null);
                for (const d of ['6', '3']) await tap(page, d);
                assert.equal(await invalid(), 'true');
                await tap(page, 'backspace');
                await tap(page, '5');
                assert.equal(await readout(page), '65');
                assert.equal(await invalid(), 'true');
                for (const d of ['backspace', 'backspace', '1', '5', '5']) await tap(page, d);
                assert.equal(await readout(page), '155');
                assert.equal(await invalid(), null,
                    'the state is recomputed on every press and never latched');
            }));

        test('A7: no row means no keypad — nothing is invented', () => mounted(async (page) => {
            /* `known === false`: the machine class has not arrived, so the table has no
             * steam row at all. A fallback ceiling here is the thing the rule forbids. */
            await arm(page, { limits: UNKNOWN, limitKey: 'steamTemp', value: '' });

            assert.equal(await page.exists(PAD), false, 'no bounds, no pad');
            assert.equal(await page.exists(WELL), false, 'no bounds, no readout to type into');
            assert.equal(await page.exists('#np >>> #unavailable'), true);
            assert.equal(await page.evalFn((s) => window.__h.need(s).disabled === true, CONFIRM), true);

            /* And it refuses in code as well as in paint. */
            const confirmed = await page.evalFn(() => document.getElementById('np').confirm('api'));
            assert.equal(confirmed, false);
            assert.deepEqual(await events(page), []);
            assert.equal(await isOpen(page), true, 'refusing to confirm must not close it');
        }));

        test('B2: every affordance follows the declaration, including the decimal key',
            () => mounted(async (page) => {
                /* dose declares step 1; steamFlow declares step 0.1. One component, one
                 * table, two behaviours — and no branch in this file names a number. */
                await arm(page, { limits: BENGLE, limitKey: 'dose', value: '18' });
                assert.equal(Number.isInteger(numpadRange(BENGLE, 'dose').step), true);
                assert.equal(
                    await page.evalFn((s) => window.__h.need(s).disabled === true, KEY_DECIMAL),
                    true, 'an integer-step field offers no decimal point',
                );

                await page.evalFn(() => {
                    document.getElementById('np').setAttribute('limit-key', 'steamFlow');
                });
                await page.settle(2);
                assert.equal(Number.isInteger(numpadRange(BENGLE, 'steamFlow').step), false);
                assert.equal(
                    await page.evalFn((s) => window.__h.need(s).disabled === true, KEY_DECIMAL),
                    false, 'a fractional step turns the decimal point on',
                );
            }));

        test('B2: the buffer length is derived from the range, not fixed at five',
            () => mounted(async (page) => {
                await arm(page, { limits: BENGLE, limitKey: 'dose', value: '18' });
                for (const d of ['1', '2', '3', '4', '5']) await tap(page, d);
                assert.equal(await readout(page), '123');
                assert.equal(String(numpadRange(BENGLE, 'dose').max).length, 3);
            }));

        const tellBand = (page, key, unit) => page.evalFn(async (k, u) => {
            const limits = await import('/src/lib/machine-limits.js');
            const temp = await import('/src/lib/temperature.js');
            const table = limits.limitsFor('bengle');
            const shown = temp.displayRange(table[k], u);
            const np = document.getElementById('np');
            np.setAttribute('limit-key', k);
            np.setAttribute('unit', shown.unit);
            np.limits = table;
            np.band = {
                min: shown.min,
                max: shown.max,
                step: shown.step,
                decimals: shown.decimals ?? temp.decimalsForStep(shown.step),
                label: limits.bandHint(shown),
                clamp: (value) => temp.toDisplayTemp(
                    limits.clamp(table, k, temp.fromDisplayTemp(Number(value), u)), u),
            };
            np.open = true;
            return true;
        }, key, unit);

        /** What the same two modules answer in Node, so the claim is not self-referential. */
        const fahrenheit = (key) => {
            const shown = displayRange(BENGLE[key], TEMP_UNIT.FAHRENHEIT);
            return {
                label: bandHint(shown),
                min: shown.min,
                max: shown.max,
                decimals: shown.decimals,
                inBand: (typed) => toDisplayTemp(
                    clamp(BENGLE, key, fromDisplayTemp(typed, TEMP_UNIT.FAHRENHEIT)),
                    TEMP_UNIT.FAHRENHEIT),
            };
        };

        test('a TOLD band decides the hint, and the machine\'s own table decides neither',
            () => mounted(async (page) => {
                await tellBand(page, 'milkStopTemp', TEMP_UNIT.FAHRENHEIT);
                const hint = await page.evalFn((s) => window.__h.need(s).textContent, HINT);
                const shown = fahrenheit('milkStopTemp');

                assert.equal(hint, shown.label, 'the hint is the band the caller is drawing');
                assert.notEqual(hint, numpadRange(BENGLE, 'milkStopTemp').label,
                    'the raw table\'s sentence is exactly what was on screen before this');
                assert.match(hint, /°F/, 'the unit beside the numbers is the one being drawn');
            }));

        test('a TOLD band decides the CLAMP, which is the half that reaches the machine',
            () => mounted(async (page) => {
                await tellBand(page, 'milkStopTemp', TEMP_UNIT.FAHRENHEIT);
                const shown = fahrenheit('milkStopTemp');

                for (const d of ['1', '5', '0']) await tap(page, d);
                assert.equal(await readout(page), '150', 'the buffer length follows the shown max');
                await page.click(CONFIRM);
                await page.settle(2);
                assert.deepEqual(await events(page), [
                    `confirm:${shown.inBand(150)}:150:milkStopTemp`,
                ]);
                assert.equal(shown.inBand(150), 150,
                    '150 °F is inside the band, so a correct clamp returns it untouched');
                assert.notEqual(shown.inBand(150), clamp(BENGLE, 'milkStopTemp', 150),
                    'and the raw-table answer is a different number — that was the defect');
            }));

        test('a TOLD band still clamps, at its own ceiling and in its own unit',
            () => mounted(async (page) => {
                await tellBand(page, 'milkStopTemp', TEMP_UNIT.FAHRENHEIT);
                const shown = fahrenheit('milkStopTemp');

                /* A band the caller declares is not a band without one: 200 °F is above
                 * the machine's 85 °C ceiling and must come back at it, converted. */
                for (const d of ['2', '0', '0']) await tap(page, d);
                await page.click(CONFIRM);
                await page.settle(2);
                assert.deepEqual(await events(page), [
                    `confirm:${shown.inBand(200)}:200:milkStopTemp`,
                ]);
                assert.equal(shown.inBand(200), shown.max,
                    'the ceiling it lands on is the one the hint printed');
            }));

        test('the decimal key follows the band\'s stated PRECISION, not its converted step',
            () => mounted(async (page) => {
                await tellBand(page, 'milkStopTemp', TEMP_UNIT.FAHRENHEIT);
                const shown = fahrenheit('milkStopTemp');
                assert.equal(Number.isInteger(shown.max - shown.min), true);
                assert.equal(shown.decimals, 0, 'the machine steps this band by a whole degree');
                assert.equal(
                    await page.evalFn((s) => window.__h.need(s).step, '#np'),
                    undefined, 'the component exposes no step of its own');
                assert.equal(
                    await page.evalFn((s) => window.__h.need(s).disabled === true, KEY_DECIMAL),
                    true, 'a whole-degree band offers no decimal point, converted or not',
                );
            }));

        test('NO band told is the old path — the fallback is the same band, not a rewrite',
            () => mounted(async (page) => {
                /* Every caller that has no converted band — the profile editor, the
                 * gallery, every test above — takes its band from the ONE table. */
                await arm(page, { limits: BENGLE, limitKey: 'steamTemp', value: '155' });
                const hint = await page.evalFn((s) => window.__h.need(s).textContent, HINT);
                assert.equal(hint, numpadRange(BENGLE, 'steamTemp').label);
                for (const d of ['1', '3', '0']) await tap(page, d);
                assert.equal(
                    await page.evalFn((s) => window.__h.need(s).disabled === true, CONFIRM),
                    true, '130 is in the hole, on the derived path as on the told one');
                await page.click(CONFIRM);
                await page.settle(2);
                assert.deepEqual(await events(page), []);
                /* AND A LEGAL VALUE STILL GOES THROUGH THE TABLE'S OWN CLAMP, untouched:
                 * the fallback is the same two calls it always was. */
                for (const d of ['backspace', 'backspace', 'backspace', '1', '5', '0']) {
                    await tap(page, d);
                }
                await page.click(CONFIRM);
                await page.settle(2);
                assert.deepEqual(await events(page), [
                    `confirm:${clamp(BENGLE, 'steamTemp', 150)}:150:steamTemp`,
                ]);
            }));

        test('A7 is not something a caller can talk it out of with an unbounded band',
            () => mounted(async (page) => {
                await page.evalFn(async () => {
                    const limits = await import('/src/lib/machine-limits.js');
                    const np = document.getElementById('np');
                    np.setAttribute('limit-key', 'steamTemp');
                    np.limits = limits.limitsFor(null);
                    np.band = { min: null, max: null, step: null, unit: '°C', label: '' };
                    np.open = true;
                    return true;
                });
                await page.settle(3);
                assert.equal(await page.exists(PAD), false, 'no bounds, no pad');
                assert.equal(await page.exists('#np >>> #unavailable'), true);
                assert.equal(await page.evalFn(() => document.getElementById('np').confirm('api')), false);
                assert.deepEqual(await events(page), []);
            }));

        test('O9: the backspace key has an accessible name and the glyph is hidden from it',
            () => mounted(async (page) => {
                await arm(page);
                const name = await page.evalFn(
                    (s) => window.__h.need(s).getAttribute('aria-label'), KEY_BACKSPACE,
                );
                assert.ok(name && name.trim().length > 0,
                    'O9: "an unlabelled <svg>, not even aria-hidden" — the pressable must have a name');

                assert.equal(
                    await page.evalFn(
                        (s) => window.__h.need(s).getAttribute('aria-hidden'),
                        '#np >>> #key-backspace ui-keycap >>> #glyph',
                    ),
                    'true',
                );

                /* The digit keys need no aria-label: their content IS their name. */
                assert.equal(
                    await page.evalFn((s) => window.__h.need(s).hasAttribute('aria-label'), KEY_7),
                    false,
                );
            }));

        test('O9: the readout is a live region, and its text is set as text',
            () => mounted(async (page) => {
                await arm(page);
                const aria = await page.evalFn((s) => {
                    const el = window.__h.need(s);
                    return {
                        role: el.getAttribute('role'),
                        live: el.getAttribute('aria-live'),
                        atomic: el.getAttribute('aria-atomic'),
                        children: el.childElementCount,
                    };
                }, DISPLAY);

                assert.deepEqual(aria, {
                    role: 'status', live: 'polite', atomic: 'true', children: 0,
                }, 'O9: "the display is updated by innerHTML with no aria-live"');

                assert.equal(await page.exists(UNIT), true);
                assert.equal(
                    await page.evalFn(
                        (s) => window.__h.need(s).contains(window.__h.need('#np >>> #unit')),
                        DISPLAY,
                    ),
                    false, 'the unit must not be inside the live region',
                );
            }));

        test('O9: a press announces the new value', () => mounted(async (page) => {
            await arm(page);
            assert.equal(await readout(page), '18');
            await tap(page, '4');
            assert.equal(await readout(page), '4', 'the first press replaces');
            await tap(page, '0');
            assert.equal(await readout(page), '40');
            await tap(page, 'backspace');
            assert.equal(await readout(page), '4');
            await tap(page, 'backspace');
            assert.equal(await readout(page), '0', 'backspacing past the end lands on 0, not blank');
        }));

        test('O10: the heading is token-sized, and the drill proves it', () => mounted(async (page) => {
            await arm(page);
            await assertTokenDrill(page, {
                token: '--ui-text-xl',
                value: DRILL_LENGTH,
                selector: TITLE,
                property: 'font-size',
            });
        }));

        test('O10: nothing in the keypad or its heading carries an inline style',
            () => mounted(async (page) => {
                await arm(page);
                assert.equal(
                    await page.evalFn((s) => window.__h.need(s).getAttribute('style'), TITLE),
                    null, 'O10: "writes an inline 28px unconditionally on every open"',
                );
                const inlined = await page.evalFn(() => {
                    const np = document.getElementById('np');
                    return [...np.shadowRoot.querySelectorAll('[style]')].map((el) => el.id || el.localName);
                });
                assert.deepEqual(inlined, [], 'no element in this body styles itself inline');
            }));

        test('O10: a long heading does not shrink the type — there is no fit loop',
            () => mounted(async (page) => {
                await arm(page);
                const short = await page.prop(TITLE, 'font-size');

                await page.evalFn(() => {
                    document.getElementById('np').heading = 'Steam temperature, volume flow multiplier';
                });
                await page.settle(3);
                const long = await page.prop(TITLE, 'font-size');

                assert.equal(long, short,
                    'O10: the title shrank to a 16px floor; one line, ellipsised, is #16\'s answer');
                assert.equal(await page.prop(TITLE, 'text-overflow'), 'ellipsis');
            }));

        test('token drill: the readout, the well, the seam, the gutter and the hint',
            () => mounted(async (page) => {
                await arm(page);

                await assertTokenDrill(page, {
                    token: '--ui-display-md', value: DRILL_LENGTH,
                    selector: DISPLAY, property: 'font-size',
                });

                await assertTokenDrill(page, {
                    token: '--ui-fascia', value: DRILL_COLOUR,
                    selector: WELL, property: 'background-color',
                });

                await assertTokenDrill(page, {
                    token: '--ui-line-strong', value: DRILL_COLOUR,
                    selector: WELL, property: 'border-top-color',
                });

                await assertTokenDrill(page, {
                    token: '--ui-line', value: DRILL_COLOUR,
                    selector: LAYOUT, property: 'background-color',
                });

                await assertTokenDrill(page, {
                    token: '--ui-space-3', value: DRILL_LENGTH,
                    selector: PAD, property: 'column-gap',
                });

                /* The range hint is .ui-caption — muted ink, --ui-text-note. */
                await assertTokenDrill(page, {
                    token: '--ui-muted', value: DRILL_COLOUR,
                    selector: HINT, property: 'color',
                });
            }));

        test('focus rings are unclipped inside the scrolled body (L24)', () => mounted(async (page) => {
            await arm(page);
            await assertFocusUnclipped(page, KEY_1);
            await assertFocusUnclipped(page, KEY_BACKSPACE);
        }));

        test('the recent-value pills are focusable and unclipped too', () => mounted(async (page) => {
            await page.evalFn(() => { document.getElementById('np').previous = ['18', '20', '17', '21']; });
            await arm(page);
            assert.equal(await page.count('#np >>> .previous-grid ui-button'), 4);
            await assertFocusUnclipped(page, '#np >>> #previous-0 >>> #btn');
        }));

        test('the key face CLEARS the --ui-hit-min floor, and is Slate\'s 88 tall', () => mounted(async (page) => {
            await arm(page);
            const floor = parseFloat(await page.resolveValue('var(--ui-hit-min)', 'width'));
            await assertHitFloor(page, KEY_FACE_7);

            const face = await page.box(KEY_FACE_7);
            assert.ok(face.height >= floor,
                `the face clears the wet-fingertip floor (got ${face.height}, floor ${floor})`);
            const want = parseFloat(await page.resolveValue(
                'calc(var(--ui-control-h) + var(--ui-space-5))', 'width'));
            near(face.height, want, 'the face is Slate\'s own key height');
            assert.ok(face.width > floor,
                `the key is wider than the floor because the column is 1fr (got ${face.width})`);

            /* The pressable and the face are the same box, so the ring lands on the
             * key rather than around an invisible wrapper. */
            const button = await page.box(KEY_7);
            near(button.width, face.width, 'button and face are one box (inline)');
            near(button.height, face.height, 'button and face are one box (block)');
        }));

        test('the card is bounded and its body scrolls — Appendix 13, through #18',
            () => mounted(async (page) => {
                await arm(page);
                await assertScrollFloor(page, {
                    selector: CELL_BODY,
                    squeezeSelector: NATIVE,
                    squeeze: { 'max-block-size': '260px' },
                });
            }));

        test('the card never exceeds the viewport at either geometry', () => mounted(async (page) => {
            await arm(page);
            const card = await page.box(NATIVE);
            assert.ok(card.height <= geometry.height,
                `the card is ${card.height}px tall in a ${geometry.height}px viewport`);
            assert.ok(card.width <= geometry.width,
                `the card is ${card.width}px wide in a ${geometry.width}px viewport`);
        }));

        test('the pad is three columns by four rows, in reading order', () => mounted(async (page) => {
            await arm(page);
            assert.equal(await page.count('#np >>> .key'), 12);

            const boxes = await page.evalFn(() => [...document.getElementById('np')
                .shadowRoot.querySelectorAll('.key')]
                .map((el) => {
                    const r = el.getBoundingClientRect();
                    return { id: el.id, x: Math.round(r.x), y: Math.round(r.y) };
                }));

            const columns = [...new Set(boxes.map((b) => b.x))];
            const rows = [...new Set(boxes.map((b) => b.y))];
            assert.equal(columns.length, 3, 'three columns');
            assert.equal(rows.length, 4, 'four rows');
            assert.deepEqual(boxes.map((b) => b.id), [
                'key-1', 'key-2', 'key-3', 'key-4', 'key-5', 'key-6',
                'key-7', 'key-8', 'key-9', 'key-decimal', 'key-0', 'key-backspace',
            ]);
        }));

        test('the column rule is one grid gap, not a border on a cell', () => mounted(async (page) => {
            await arm(page);
            const seam = await page.resolveValue('var(--ui-seam)', 'column-gap');
            assert.equal(await page.prop(LAYOUT, 'column-gap'), seam);
            assert.equal(await page.prop(LAYOUT, 'row-gap'), '0px', 'a column rule only');
            for (const side of ['border-left-width', 'border-right-width']) {
                assert.equal(await page.prop('#np >>> #entry', side), '0px');
                assert.equal(await page.prop('#np >>> #pad-col', side), '0px');
            }
        }));

        test('the carried breakpoint is a CONTAINER query on the dialog box (§4.6)',
            () => mounted(async (page) => {
                await arm(page);
                assert.equal(await page.prop(BODY, 'container-type'), 'inline-size');

                const tracks = (v) => v.trim().split(/\s+/).length;
                const wideTracks = await page.prop(LAYOUT, 'grid-template-columns');
                const wideEntry = await page.box('#np >>> #entry');
                const widePad = await page.box('#np >>> #pad-col');
                assert.equal(tracks(wideTracks), 2, 'two tracks above the breakpoint');
                assert.ok(widePad.x > wideEntry.x + wideEntry.width - 1,
                    'side by side above the breakpoint');

                await page.setStyle('#np', { '--_ui-numpad-inline': '460px' });
                await page.settle(3);
                const narrowEntry = await page.box('#np >>> #entry');
                const narrowPad = await page.box('#np >>> #pad-col');
                const narrowTracks = await page.prop(LAYOUT, 'grid-template-columns');
                await page.setStyle('#np', { '--_ui-numpad-inline': null });

                assert.equal(tracks(narrowTracks), 1, 'one track below the breakpoint');
                assert.ok(narrowPad.y > narrowEntry.y + narrowEntry.height - 1,
                    'stacked below the breakpoint');
            }));

        test('Escape closes the keypad and leaves the dialog underneath open',
            () => mounted(async (page) => {
                await arm(page);
                assert.equal(await page.evalFn(() => document.getElementById('under').open === true), true);
                assert.equal(await isOpen(page), true);

                await page.press('Escape');
                await page.settle(3);

                assert.equal(await isOpen(page), false, 'the keypad closes');
                assert.equal(
                    await page.evalFn(() => document.getElementById('under').open === true),
                    true, 'Appendix 13: the dialog underneath must NOT see the same gesture',
                );
                assert.deepEqual(await events(page), ['cancel:escape']);
            }, NESTED));

        test('the only <dialog> is #18\'s, and this body owns none', () => mounted(async (page) => {
            await arm(page);
            const own = await page.evalFn(
                () => document.getElementById('np').shadowRoot.querySelectorAll('dialog').length,
            );
            assert.equal(own, 0, 'a second modal machinery in a dialog BODY is a wave block');
            assert.equal(await page.exists(NATIVE), true, 'the shell still has exactly one');
            assert.equal(await page.exists(SHELL), true);
        }));

        test('a key is pressed, never selected — no private selection treatment',
            () => mounted(async (page) => {
                await arm(page);
                const before = await page.computed(KEY_FACE_7, ['background-color', 'color', 'box-shadow']);
                await page.evalFn((s) => {
                    const el = window.__h.need(s);
                    el.setAttribute('aria-pressed', 'true');
                    el.setAttribute('aria-selected', 'true');
                    el.setAttribute('aria-checked', 'true');
                    el.setAttribute('aria-current', 'true');
                    el.classList.add('is-selected');
                }, KEY_7);
                await page.settle(2);
                const after = await page.computed(KEY_FACE_7, ['background-color', 'color', 'box-shadow']);
                assert.deepEqual(after, before);
            }));

        test('confirm reports the clamped value once and closes', () => mounted(async (page) => {
            await arm(page);
            for (const d of ['9', '9', '9']) await tap(page, d);
            assert.equal(await readout(page), '999');
            await page.click(CONFIRM);
            await page.settle(2);
            /* dose declares max 120; 999 is clamped by the PORT, not by this file. */
            assert.deepEqual(await events(page), [`confirm:${clamp(BENGLE, 'dose', 999)}:999:dose`]);
            assert.equal(await isOpen(page), false);
        }));

        test('cancel reports once and leaves the value alone', () => mounted(async (page) => {
            await arm(page);
            await tap(page, '9');
            await page.click(CANCEL);
            await page.settle(2);
            assert.deepEqual(await events(page), ['cancel:press']);
            assert.equal(
                await page.evalFn(() => document.getElementById('np').value), '18',
                'a cancelled edit does not touch the screen\'s value',
            );
        }));

        test('a recent value is one gesture: press, confirm, close', () => mounted(async (page) => {
            await page.evalFn(() => { document.getElementById('np').previous = ['20', '17']; });
            await arm(page);
            await page.click('#np >>> #previous-0 >>> #btn');
            await page.settle(2);
            assert.deepEqual(await events(page), [`confirm:${clamp(BENGLE, 'dose', 20)}:20:dose`]);
            assert.equal(await isOpen(page), false);
        }));

        test('a refused confirm keeps it open — the async-write idiom', () => mounted(async (page) => {
            await arm(page);
            await page.eval('(() => { document.getElementById("np")'
                + '.addEventListener("confirm", (e) => e.preventDefault()); return true; })()');
            await page.click(CONFIRM);
            await page.settle(2);
            assert.equal(await isOpen(page), true);
        }));

        test('the dialog announces the field name', () => mounted(async (page) => {
            await arm(page);
            assert.equal(
                await page.evalFn((s) => window.__h.need(s).getAttribute('aria-modal'), NATIVE),
                'true',
            );
            assert.equal(
                await page.evalFn((s) => window.__h.need(s).getAttribute('aria-label'), NATIVE),
                'Dose in', 'one string, used as the heading AND the accessible name (#16)',
            );
            /* The heading is a real heading element, not a styled span
             * (TYPE_ROLES.md rule 2). */
            assert.equal(
                await page.evalFn((s) => window.__h.need(s).localName, TITLE), 'h2',
            );
        }));

        test('every gallery state mounts and settles', () => browser.withPage(
            { geometry },
            async (page) => {
                for (const state of galleryEntry.states) {
                    await page.mount(state.html, [`/tools/gallery/entries/${galleryEntry.id}.demo.js`]);
                    await page.settle(4);
                    assert.deepEqual(page.pageErrors, [], `${galleryEntry.id}--${state.id} threw`);
                    assert.equal(await page.exists(SHELL), true,
                        `${galleryEntry.id}--${state.id} did not render a shell`);
                }
            },
        ));
    });
}
