/**
 * ui-numeric-keypad.render.test.mjs — Wave 4 item #53's rendering suite.
 *
 * Gate A: headless Chrome over CDP, computed styles, box geometry and BEHAVIOUR,
 * never source text, at BOTH standard geometries — 1281×801 @ dsf 1.5 and the
 * 1000×600 floor (CONVENTIONS §10).
 *
 * WHAT THIS SUITE IS REALLY FOR. Row #53's acceptance test is "the defect cannot be
 * expressed", and there are three defects, two of them named on the row:
 *
 *   O9   "The numpad's backspace key has no accessible name (an unlabelled <svg>, not
 *         even aria-hidden), and the display is updated by innerHTML with no
 *         aria-live."   (§7 Overlays, `numpad-modal.js:220-222, 291-292`)
 *   O10  "The numpad title writes an inline 28px unconditionally on every open and
 *         shrinks to a 16px floor — the one piece of type in the skin whose size is
 *         not a token — while its comment describes two-line wrapping that three
 *         white-space: nowrap declarations forbid."
 *         (§7 Overlays, `numpad-modal.js:508-522`)
 *   B3    the retired 130/170 steam table. 130 °C is inside the dead band where the
 *         heater is off, and the old clamp put people there. The row's own words:
 *         "the current tables snap users into the 130 °C dead band where the heater
 *         is off."
 *
 * None of the three photographs. An unnamed backspace and a named one are the same
 * pixels; a literal 28px and a token 28px are the same pixels; and 130 and 135 differ
 * by five characters of hint text and by where a clamp lands. So sections 1–3 read
 * attributes, drill tokens and drive real presses.
 *
 * THE ORACLE IS EVIDENCE, NOT A TARGET, and the disqualification check (SCOPE Part 10
 * §4) was run per element before any value below was carried:
 *   - the TITLE is bug O10 → DISQUALIFIED. Its 28px is quoted as the defect.
 *   - the BACKSPACE key is bug O9 → DISQUALIFIED for its accessibility shape.
 *   - RESPONSIVE BEHAVIOUR is disqualified everywhere (Slate is frozen at 1920×1200);
 *     §4.6 governs and says to carry the one real breakpoint "as a container query on
 *     the dialog's own box".
 *   - the pad geometry, the readout and the well are CLEAR.
 *
 *   CITE modal-numpad .numpad-modal-container [i=166] rect x=550 y=284 w=820 h=545
 *   CITE modal-numpad .numpad-modal-numpad-btn [i=175] rect x=1000 y=416 w=107 h=88;
 *        "distinct geometries (w x h), all matched elements: 107 x 88 x12"
 *   CITE modal-numpad .numpad-modal-numpad-btn [i=175] font-size = 30px <-
 *        numpad-modal.css `.numpad-modal-numpad-btn` authored `var(--slate-display-sm)`
 *        !important=no (token-driven)
 *   CITE modal-numpad #numpad-display-value [i=173] rect x=575 y=574 w=376 h=104;
 *        font-size = 42px <- numpad-modal.css `.numpad-modal-input-value` authored
 *        `var(--slate-display-md)` !important=no (token-driven)
 *   CITE modal-numpad #numpad-modal-title [i=167] font-size = 28px <- <inline>
 *        `<inline>` authored `28px` !important=no (FROZEN/hardcoded)      ← O10
 *   CITE modal-numpad .numpad-modal-input-box [i=171] background-color: dark
 *        rgb(14, 19, 23) / light rgb(248, 249, 249) — two different tokens, which is
 *        departure 3.
 *
 * Everything about modality — trap, inert, restore, the scrim, the Escape stack — is
 * #18's and is proven in `ui-dialog.render.test.mjs`. What is proven here is that
 * composing this body does not break it (section 7), and that this component owns no
 * second copy of it (section 8).
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';
import { entry as galleryEntry } from '../../tools/gallery/entries/ui-numeric-keypad.entry.js';
import { limitsFor, numpadRange, clamp, bandHint } from '../../src/lib/machine-limits.js';
/* THE CONVERSION, FROM THE MODULE THAT OWNS IT. Section 1b builds a Fahrenheit band the
 * way a screen builds one; computing the expected numbers here from the same two modules
 * is what keeps this suite from carrying a second copy of a bound (B2). */
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

/* The compound imports #18, #1 and #15 itself; ui-button is listed because the PAGE
 * outside the dialog mounts an invoker, and the harness waits on whenDefined for every
 * hyphenated tag it finds on the stage (the trap ui-menu.demo.js documents). */
const MODULE = [
    '/src/components/ui-numeric-keypad.js',
    '/src/components/ui-button.js',
    '/src/components/ui-dialog.js',
];

/* THE ONE TABLE, built here exactly as a screen builds it — the port's own
 * constructor. `capabilitiesStore.machineLimits().value` is what a screen passes; a
 * test has no store, so it calls the same module the store calls. Nothing in this file
 * writes a min, a max or a step. */
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

/** A keypad nested over a plain #18 instance — Appendix 13's Escape case. */
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
/**
 * Press one key.
 *
 * IT SCROLLS FIRST, and the reason is a real behaviour rather than harness plumbing. The
 * pad's rows are Slate's own 88px since 24 Aug 2026 (Ben: "make it look the same"), and
 * #18's body is a BOUNDED SCROLL REGION by Appendix 13 — so at the 1000x600 floor the
 * bottom row is below the fold and a click at its box coordinates lands on whatever is
 * painted there instead. Measured before this line: '1','3','0' produced "13".
 *
 * Slate answers the same squeeze with a `@media (max-height: 650px)` rule that shrinks
 * the rows to 62px. A component here may not read the VIEWPORT (§2.1 Rule 1), and the
 * container-query form of that question needs a size container this card does not have —
 * so the shortfall is scrolling, which is what the card is built to do, and it is
 * recorded here rather than hidden behind a helper that quietly worked.
 */
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

        /* =================================================================
         * 0. THE RIG IS THE RIG
         * ================================================================= */

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

        /* =================================================================
         * 1. B2 / B3 — EVERY BOUND COMES FROM THE ONE TABLE
         *
         * The row: "Ranges arrive from the machine-limits.js port with the corrected
         * steam floor — the current tables snap users into the 130 °C dead band where
         * the heater is off." These are that sentence, asserted.
         * ================================================================= */

        test('B3: the steam range on a Bengle is 135–170, and the 130 dead band appears nowhere',
            () => mounted(async (page) => {
                await arm(page, { limits: BENGLE, limitKey: 'steamTemp', value: '155' });
                const hint = await page.evalFn((s) => window.__h.need(s).textContent, HINT);

                /* The port's own sentence, not one assembled here — numpadRange() is
                 * the single author of this string, so the screen and the clamp cannot
                 * disagree (that is the defect the port's rangeHint comment names). */
                assert.equal(hint, numpadRange(BENGLE, 'steamTemp').label);
                assert.match(hint, /135/, 'the corrected steam FLOOR must be on screen');
                /* 170, AND IT CAME BACK. B3 lowered the Bengle ceiling to 165; the bench
                 * then served `steamTargetTemperature` 170, so 165 was a skin refusing a
                 * value the machine holds. Ben, 26 August 2026, point 4: "If its set to 170
                 * then + should be grayed out" — the ceiling IS 170, not a number below it. */
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
                /* THE TWO CLASSES MUST NOT AGREE HERE. For one day they both read 170 —
                 * Ben's bench reading applied to a machine it was not taken on — and this
                 * assertion is what makes that state fail rather than pass quietly. */
                assert.doesNotMatch(de1, /170/, 'the Bengle\'s measured ceiling is not the DE1\'s');
                assert.match(bengle, /170/);
            }));

        /* THE SECOND HALF OF THIS TEST CHANGED ON 29 AUGUST 2026 (audit F-021). It read
         *
         *     assert.deepEqual(await events(page), [
         *         `confirm:${clamp(DE1, 'steamTemp', 163)}:163:steamTemp`,
         *     ]);
         *
         * i.e. a typed 163 on a DE1 confirmed as 160 — the readout saying one number and
         * the wire carrying another, with nothing on the glass to say a substitution had
         * happened. The claim the test is FOR ("retargeting the table moves the accepted
         * range") is unchanged and is now stated the sharper way: the same keystrokes are
         * ACCEPTED on one class and REFUSED on the other. */
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

                /* Spelled out, so a reader does not have to run clamp() in their head:
                 * the SAME keystrokes are inside one class's band and outside the other's,
                 * and the component contributed neither bound. */
                assert.equal(clamp(BENGLE, 'steamTemp', 163), 163);
                assert.equal(numpadRange(DE1, 'steamTemp').max, 160);
            }));

        /* AND THIS ONE CHANGED WITH IT (audit F-021). It read
         *
         *     assert.deepEqual(await events(page), ['confirm:135:130:steamTemp']);
         *
         * — the assertion that a typed 130 confirms as 135. That is a silent substitution
         * and it is the *harmless* end of the same mechanism: on the other side of the
         * hole's midpoint a typed 63 confirmed as 0, which switches the steam heater OFF
         * (F-021, reproduced four times; Wave 4 proved the server stores the 0). The pad's
         * band is now the working band, so neither number can be typed at all. */
        test('B3: a value inside the dead band cannot be confirmed AT ALL',
            () => mounted(async (page) => {
                /* The whole reason B3 is a wave law. Slate's table said 130..170, so a
                 * typed 130 was accepted and the machine sat with its heater off. */
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

        /* =================================================================
         * 1b. F-021 — THE HOLE IS NOT TYPEABLE, AND 63 IS THE NUMBER THAT PROVED IT
         *
         * The audit's own sweep, four times over, on the tablet:
         *
         *     typed 150 → row reads 150      typed 134 → row reads 135  (snapped UP)
         *     typed 136 → row reads 136      typed 120 → row reads 135  (snapped UP)
         *     typed 135 → row reads 135      typed  63 → row reads "–", HEATER OFF
         *
         * The pad printed "0 or 135–170" throughout and said nothing about any of it.
         * ================================================================= */

        test('F-021: the steam pad refuses 63 and 134 and accepts 135 and 170',
            () => mounted(async (page) => {
                const disabled = () => page.evalFn(
                    (s) => window.__h.need(s).disabled === true, CONFIRM);
                /* CLOSED AND REOPENED BETWEEN VALUES, because the buffer only reloads from
                 * `value` on an open→close→open edge (`willUpdate`) — re-asserting `open`
                 * on an already-open pad leaves the previous digits in place, which is the
                 * component's own documented behaviour and not something to work around. */
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
                /* THE AUDIT'S OWN GESTURE: "the pad opened at 170, backspace cleared it to
                 * '0', the keys made '63'". The cleared buffer READS "0" and confirming it
                 * used to send `targetTemperature: 0` with no keys pressed at all. */
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
                /* NO "0 or" ANY MORE. The pad used to print a zero it would accept and a
                 * band it would not hold you to; it now prints the one band it takes. */
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
             * steam row at all. A fallback ceiling here is the thing A7 forbids. */
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
                /* `numpad-modal.js:300` capped every field at five characters, so 999.9
                 * could be typed into a 120 g dose and clamped afterwards. dose declares
                 * max 120 and step 1, which is three digits. */
                await arm(page, { limits: BENGLE, limitKey: 'dose', value: '18' });
                for (const d of ['1', '2', '3', '4', '5']) await tap(page, d);
                assert.equal(await readout(page), '123');
                assert.equal(String(numpadRange(BENGLE, 'dose').max).length, 3);
            }));

        /* =================================================================
         * 1b. THE DISPLAY BAND THE PORT IS TOLD (27 August 2026)
         *
         * The defect: this component derived its hint and its clamp from the RAW
         * machine table, which is always in the machine's own units, while the
         * control that opened it drew a converted band. MEASURED on the settings
         * fixture, Machine › Steam, `milkStopTemp`: the keypad answered
         * `{min: 30, max: 85}` and clamped a typed 150 to 85 while the well beside
         * it read °F. The clamp is the serious half — the screen converts display →
         * machine on the way out, so 150 °F became 85 and then 85 °F.
         *
         * NOTHING IN THIS SECTION WRITES A BOUND. The band handed to the component
         * is built IN THE PAGE from `machine-limits.js` and `temperature.js` — the
         * same two modules the screens use — and every expectation is computed in
         * Node from the same functions. A number typed into this file would be the
         * second copy B2 exists to prevent, in the suite instead of the source.
         * ================================================================= */

        /**
         * Build a display band the way a screen does and hand it over, then open.
         *
         * IT IS ASSEMBLED IN THE PAGE because a band carries a CLAUSE — `clamp` is a
         * function, and a function cannot cross the CDP boundary as an argument. So
         * the page imports the same two modules the screens import and composes the
         * band there, which is also a fair rehearsal of what a screen actually does.
         */
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
                /* AND IT IS NOT THE CELSIUS ONE. Spelled as a NEGATIVE against the other
                 * sentence the same table can produce, because "it equals the F label" is
                 * satisfied by a bug that makes both labels the same string. */
                assert.notEqual(hint, numpadRange(BENGLE, 'milkStopTemp').label,
                    'the raw table\'s sentence is exactly what was on screen before this');
                assert.match(hint, /°F/, 'the unit beside the numbers is the one being drawn');
            }));

        test('a TOLD band decides the CLAMP, which is the half that reaches the machine',
            () => mounted(async (page) => {
                await tellBand(page, 'milkStopTemp', TEMP_UNIT.FAHRENHEIT);
                const shown = fahrenheit('milkStopTemp');

                /* 150 °F IS INSIDE THE BAND — 65.6 °C, between 30 and 85 — and it used to
                 * come back as 85 because it was measured against the CELSIUS ceiling.
                 * `1`, `5`, `0` is also three characters, which the buffer only allows
                 * because the band's max is three digits: the old two-digit Celsius max
                 * capped the entry at two and the third press was swallowed. */
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
                /* 1 °C is 1.8 °F. A component inferring "fractional" from the converted
                 * step would light the decimal key on a band whose every reachable value
                 * is a whole machine degree — a key that can only produce a number the
                 * clamp rounds away. `decimals` is what the port states and it wins. */
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

        /* THE CLOSING ASSERTION CHANGED ON 29 AUGUST 2026 (audit F-021). It read
         *
         *     assert.deepEqual(await events(page), [
         *         `confirm:${clamp(BENGLE, 'steamTemp', 130)}:130:steamTemp`,
         *     ]);
         *
         * — the derived path confirming a typed 130 as 135. The claim the test is FOR is
         * that a caller with no told band gets the DERIVED band and nothing invented, and
         * that is unchanged and still asserted; what moved is the derived band itself,
         * which now excludes the hole, so the same keystrokes are refused instead of
         * corrected. The two paths agreeing is the whole point of the test and they still
         * agree — see the told-band case in the next section. */
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
                /* The settings model answers `{min: null, max: null, bounded: false,
                 * clamp: null}` for a reading with no declared range. Handing that over
                 * must not turn "this value cannot be set yet" into a typeable well with
                 * nothing behind it — a band with no bounds and no clamp is not a band. */
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

        /* =================================================================
         * 2. O9 — THE UNNAMED BACKSPACE AND THE SILENT READOUT
         * ================================================================= */

        test('O9: the backspace key has an accessible name and the glyph is hidden from it',
            () => mounted(async (page) => {
                await arm(page);
                const name = await page.evalFn(
                    (s) => window.__h.need(s).getAttribute('aria-label'), KEY_BACKSPACE,
                );
                assert.ok(name && name.trim().length > 0,
                    'O9: "an unlabelled <svg>, not even aria-hidden" — the pressable must have a name');

                /* And the face's glyph is taken OUT of the name, through #15's own
                 * `label` affordance, which exists for exactly this
                 * (ui-keycap.js ACCESSIBILITY: "Recorded for Wave 4"). */
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

                /* childElementCount 0 is the second half: Slate wrote
                 * `${currentValue}<span class=…cursor></span><span class=…unit>` into
                 * innerHTML on every press, so the announced node was replaced wholesale
                 * and the unit lived inside the live region. Here the value is a text
                 * node Lit updates in place and the unit is its own element outside it. */
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

        /* =================================================================
         * 3. O10 — THE ONE PIECE OF TYPE WHOSE SIZE IS NOT A TOKEN
         * ================================================================= */

        test('O10: the heading is token-sized, and the drill proves it', () => mounted(async (page) => {
            await arm(page);
            /* CITE modal-numpad #numpad-modal-title [i=167] font-size = 28px <-
             *      <inline> authored `28px` !important=no (FROZEN/hardcoded).
             * A literal 28px and a token 28px photograph identically; only the drill
             * separates them. --ui-text-xl is what .ui-title reads
             * (type-roles.js:205-208, styles/tokens.css:359). */
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

                /* "STEAM TEMPERATURE" and "VOLUME FLOW MULT" are the two names
                 * `numpad-modal.js:508-511` names as the reason the loop exists; it
                 * stepped 28 → 16px one pixel at a time on every open. */
                await page.evalFn(() => {
                    document.getElementById('np').heading = 'Steam temperature, volume flow multiplier';
                });
                await page.settle(3);
                const long = await page.prop(TITLE, 'font-size');

                assert.equal(long, short,
                    'O10: the title shrank to a 16px floor; one line, ellipsised, is #16\'s answer');
                assert.equal(await page.prop(TITLE, 'text-overflow'), 'ellipsis');
            }));

        /* =================================================================
         * 4. THE STANDING TOKEN DRILL — every colour and length is a token
         * ================================================================= */

        test('token drill: the readout, the well, the seam, the gutter and the hint',
            () => mounted(async (page) => {
                await arm(page);

                /* CITE #numpad-display-value [i=173] font-size = 42px <-
                 *      authored `var(--slate-display-md)` (token-driven). */
                await assertTokenDrill(page, {
                    token: '--ui-display-md', value: DRILL_LENGTH,
                    selector: DISPLAY, property: 'font-size',
                });

                /* Departure 3: the well is --ui-fascia in BOTH themes, where Slate
                 * computed --fascia in dark and --key in light. */
                await assertTokenDrill(page, {
                    token: '--ui-fascia', value: DRILL_COLOUR,
                    selector: WELL, property: 'background-color',
                });

                /* Departure 4: the enclosure ink, not --ui-steel (the focus ink). */
                await assertTokenDrill(page, {
                    token: '--ui-line-strong', value: DRILL_COLOUR,
                    selector: WELL, property: 'border-top-color',
                });

                /* The column rule is a seam: a grid gap with the ground showing
                 * through (CONVENTIONS §13), so the ink is the GROUND. */
                await assertTokenDrill(page, {
                    token: '--ui-line', value: DRILL_COLOUR,
                    selector: LAYOUT, property: 'background-color',
                });

                /* CITE the pad gutter: 1119 − 1000 − 107 = 12 and 516 − 416 − 88 = 12,
                 * both axes, = --ui-space-3. */
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

        /* =================================================================
         * 5. THE FOUR STANDING ASSERTIONS — focus, hit floor, scroll floor
         * ================================================================= */

        test('focus rings are unclipped inside the scrolled body (L24)', () => mounted(async (page) => {
            await arm(page);
            /* The top-left key and the bottom-right key are the two worst cases: #18's
             * body cell is overflow-y: auto, which computes overflow-x to auto too, so
             * an OUTSET ring on an edge key is clipped on that side. The inset offset is
             * declared once on `.body`. */
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
            /* Departure 1, measured rather than claimed. Bugs P4 and L22 are both "a
             * floor the comment claims and the box does not have".
             *
             * IT WAS `near(height, floor)` — EXACTLY 48 — AND THAT PINNED THE LOSS.
             * Departure 1 recorded the loss and named its own reversal ("two additive
             * lines in #15 plus one declaration here"); Ben asked for it on 24 Aug 2026
             * ("The numberpad modal is ugly compared to Slate, please make it look the
             * same"), and Slate's rule is 88px with its own reason: "this is the one
             * control on the machine that is used with a fingertip, at speed, often with
             * a wet hand". A test that demanded EQUALITY with the floor made the recorded
             * fix a failure, so it asserts the FLOOR — which is what the floor is. */
            const floor = parseFloat(await page.resolveValue('var(--ui-hit-min)', 'width'));
            await assertHitFloor(page, KEY_FACE_7);

            const face = await page.box(KEY_FACE_7);
            assert.ok(face.height >= floor,
                `the face clears the wet-fingertip floor (got ${face.height}, floor ${floor})`);
            /* ORACLE .numpad-modal-numpad-btn min-height 88px. Expressed here as the same
             * control + space arithmetic the pad's own row uses, so the assertion moves
             * with the tokens rather than pinning a measured constant. */
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
                /* "The numpad's bounded, scrollable card (numpad-modal.css:44-48) ... the
                 * only overlay that handles a short viewport, and a real fix to a real
                 * problem." Carried into #18; asserted here because a body that fought
                 * the shell's scroll region would break it. */
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

        /* =================================================================
         * 6. THE PAD IS SLATE'S PAD — geometry that is clear of the bug list
         * ================================================================= */

        test('the pad is three columns by four rows, in reading order', () => mounted(async (page) => {
            await arm(page);
            assert.equal(await page.count('#np >>> .key'), 12);

            const boxes = await page.evalFn(() => [...document.getElementById('np')
                .shadowRoot.querySelectorAll('.key')]
                .map((el) => {
                    const r = el.getBoundingClientRect();
                    return { id: el.id, x: Math.round(r.x), y: Math.round(r.y) };
                }));

            /* CITE rects [1000,416,107,88] [1119,416,...] [1238,416,...] [1000,516,...]
             * — three distinct columns, four distinct rows, 1..9 . 0 ⌫. */
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
            /* CONVENTIONS §13 and the checklist line "a divider is the seam utility,
             * never a per-cell border". Slate draws it as a 1px <div>
             * (numpad-modal.css:227-231). */
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

                /* Narrow the CARD, never the viewport — the oracle is disqualified for
                 * responsive behaviour and §4.6 governs. */
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

        /* =================================================================
         * 7. APPENDIX 13 — ESCAPE OWNERSHIP, INHERITED FROM #18
         * ================================================================= */

        test('Escape closes the keypad and leaves the dialog underneath open',
            () => mounted(async (page) => {
                await arm(page);
                assert.equal(await page.evalFn(() => document.getElementById('under').open === true), true);
                assert.equal(await isOpen(page), true);

                await page.press('Escape');
                await page.settle(3);

                /* `numpad-modal.js:252-268`: "Desktop Chrome can synthesize a separate
                 * native cancel for every open top-layer dialog from one Escape key."
                 * The numpad is the overlay that got this right; #18 copied it into its
                 * OPEN_DIALOGS stack, and this body adds no keydown handler of its own. */
                assert.equal(await isOpen(page), false, 'the keypad closes');
                assert.equal(
                    await page.evalFn(() => document.getElementById('under').open === true),
                    true, 'Appendix 13: the dialog underneath must NOT see the same gesture',
                );
                assert.deepEqual(await events(page), ['cancel:escape']);
            }, NESTED));

        /* =================================================================
         * 8. NO SECOND MODAL MACHINERY, AND NO PRIVATE SELECTION LOOK
         * ================================================================= */

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
                /* CONVENTIONS §4: the four dials mean something only because there is ONE
                 * selection component (#3). A numpad key has no selected state, so every
                 * spelling of one must leave the paint exactly where it was — the same
                 * pin #15 carries. */
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

        /* =================================================================
         * 9. THE OUTCOMES — one dismissal, one report
         * ================================================================= */

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

        /* =================================================================
         * 10. ARIA — the dialog's name is the field's name
         * ================================================================= */

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

        /* =================================================================
         * 11. THE GALLERY ENTRY IS THE SAME COMPONENT
         * ================================================================= */

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
