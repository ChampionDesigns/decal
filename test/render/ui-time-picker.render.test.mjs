/**
 *.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';
import { entry as galleryEntry } from '../../tools/gallery/entries/ui-time-picker.entry.js';
import {
    assertTokenDrill,
    assertOneSelectionTreatment,
    assertFocusUnclipped,
    DRILL_COLOUR,
    DRILL_LENGTH,
} from '../harness/assertions.js';

const MODULE = ['/src/components/ui-time-picker.js'];

const MODULE_IN_DIALOG = [...MODULE, '/src/components/ui-dialog.js'];

/* 06:30 — the wake time the schedule sheet opens on, and an hour whose chip is not
 * index 0, so "12 o'clock lives at index 0" is actually exercised. */
const TP = '<ui-time-picker id="tp" value="06:30" label="Wake time"></ui-time-picker>';
const TP_MIN = '<ui-time-picker id="min" value="06:30" mode="minute" label="Wake"></ui-time-picker>';
const TP_OFF = '<ui-time-picker id="off" value="07:37" mode="minute" label="Off tick"></ui-time-picker>';
const TP_DIS = '<ui-time-picker id="dis" value="18:00" disabled label="Disabled"></ui-time-picker>';
const MARKUP = `${TP}${TP_MIN}${TP_OFF}${TP_DIS}`;

/** A stage of a stated width, so "reads its own container" is a measurement. */
const boxed = (width, inner, id = 'stage') =>
    `<div id="${id}" style="inline-size:${width}px">${inner}</div>`;

const FACE_MAX = 264;
const FACE_MID = 256;

/** Rendered lengths at dsf 1.5 are not string-comparable; whole CSS px are. */
const near = (got, want, what, tol = 0.6) => assert.ok(
    Math.abs(got - want) <= tol,
    `${what}: expected ${want}, got ${got}`,
);

const chip = (n, host = 'tp') => `#${host} >>> #chip-${n}`;

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`ui-time-picker @ ${geometry.name} (${geometry.width}×${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

        const mounted = (fn, markup = MARKUP, modules = MODULE) => browser.withPage({ geometry }, async (page) => {
            await page.mount(markup, modules);
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

        test('the hour dial checks the hour, and 12 o\'clock lives at index 0', () => mounted(async (page) => {
            // 06:30 -> to12h(6) = { h12: 6, ampm: 'AM' } -> selIndex = 6 % 12 = 6.
            const checked = await page.evalFn(
                () => [...window.__h.need('#tp >>> #ring').querySelectorAll('[role="radio"]')]
                    .map((b, i) => (b.getAttribute('aria-checked') === 'true' ? i : -1))
                    .filter((i) => i >= 0),
            );
            assert.deepEqual(checked, [6], 'exactly the 6 chip is checked at 06:30');

            const labels = await page.evalFn(
                () => [...window.__h.need('#tp >>> #ring').querySelectorAll('[role="radio"]')]
                    .map((b) => b.textContent.trim()),
            );
            assert.deepEqual(
                labels,
                ['12', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'],
                'HOUR_LABELS carried unchanged from ',
            );
        }));

        test('the hand points where hourHandAngle / minuteHandAngle say', () => mounted(async (page) => {
            const hourHand = await page.evalFn(
                () => {
                    const l = window.__h.need('#tp >>> .hand');
                    return { x1: +l.getAttribute('x1'), y1: +l.getAttribute('y1'), x2: +l.getAttribute('x2'), y2: +l.getAttribute('y2') };
                },
            );
            near(hourHand.x2, hourHand.x1, 'hourHandAngle(6) = 90deg: no horizontal component', 0.02);
            assert.ok(hourHand.y2 > hourHand.y1 + 90, 'and it points down the full ring radius');

            const offHand = await page.evalFn(
                () => {
                    const l = window.__h.need('#off >>> .hand');
                    return { x1: +l.getAttribute('x1'), y1: +l.getAttribute('y1'), x2: +l.getAttribute('x2'), y2: +l.getAttribute('y2') };
                },
            );
            assert.ok(offHand.x2 < offHand.x1, '07:37 -> 132deg, left of the hub');
            assert.ok(offHand.y2 > offHand.y1, '07:37 -> 132deg, below the hub');
        }));

        test('an off-tick minute checks nothing — snapMinute decides, not a guess', () => mounted(async (page) => {
            const checked = await page.evalFn(
                () => [...window.__h.need('#off >>> #ring').querySelectorAll('[role="radio"]')]
                    .filter((b) => b.getAttribute('aria-checked') === 'true').length,
            );
            assert.equal(checked, 0, '37 is not a multiple of 5, so nothing is lit');

            // ...and the minute dial's labels are the five-minute set.
            const labels = await page.evalFn(
                () => [...window.__h.need('#min >>> #ring').querySelectorAll('[role="radio"]')]
                    .map((b) => b.textContent.trim()),
            );
            assert.deepEqual(
                labels,
                ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'],
                'MIN_LABELS carried unchanged from ',
            );
        }));

        test('a garbage value renders a real time and does not overwrite the caller', () => mounted(
            async (page) => {
                const live = await page.evalFn(() => window.__h.need('#bad >>> #live').textContent.trim());
                assert.equal(live, '7:00 AM', 'parseTime24 fallback { h24: 7, m: 0 }, drawn');
                const attr = await page.evalFn(() => window.__h.need('#bad').getAttribute('value'));
                assert.equal(attr, 'nope', 'the caller\'s string is not silently rewritten');
                const checked = await page.evalFn(
                    () => [...window.__h.need('#bad >>> #ring').querySelectorAll('[role="radio"]')]
                        .filter((b) => b.getAttribute('aria-checked') === 'true').length,
                );
                assert.equal(checked, 1, 'and a real hour is lit — no NaN path reaches the DOM');
            },
            '<ui-time-picker id="bad" value="nope"></ui-time-picker>',
        ));

        test('no value at all draws the fallback and invents no value', () => mounted(
            async (page) => {
                const live = await page.evalFn(
                    () => window.__h.need('#zero >>> #live').textContent.trim(),
                );
                assert.equal(live, '7:00 AM', 'an unset value must draw parseTime24s fallback');

                const checked = await page.evalFn(
                    () => [...window.__h.need('#zero >>> #ring').querySelectorAll('[role="radio"]')]
                        .map((b, i) => (b.getAttribute('aria-checked') === 'true' ? i : -1))
                        .filter((i) => i >= 0),
                );
                assert.deepEqual(checked, [7], 'chip 7 is checked, and it is the only one');

                // hourHandAngle(7) = 7 * 30 - 90 = 120deg -> down and to the LEFT.
                const hand = await page.evalFn(() => {
                    const l = window.__h.need('#zero >>> .hand');
                    return {
                        x1: +l.getAttribute('x1'), y1: +l.getAttribute('y1'),
                        x2: +l.getAttribute('x2'), y2: +l.getAttribute('y2'),
                    };
                });
                assert.ok(hand.x2 < hand.x1, '07:00 -> 120deg, left of the hub');
                assert.ok(hand.y2 > hand.y1, '07:00 -> 120deg, below the hub');

                const state = await page.evalFn(() => {
                    const el = window.__h.need('#zero');
                    return { prop: el.value, attr: el.getAttribute('value') };
                });
                assert.equal(state.prop, '',
                    'the picker wrote itself a time the caller never chose');
                assert.equal(state.attr, '',
                    'the reflected attribute must stay empty until a real choice is made');
            },
            '<ui-time-picker id="zero"></ui-time-picker>',
        ));

        test('the artwork paints from --ui-steel', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-steel',
                value: DRILL_COLOUR,
                selector: '#tp >>> .hand',
                property: 'stroke',
                expected: DRILL_COLOUR,
            });
            await assertTokenDrill(page, {
                token: '--ui-steel',
                value: DRILL_COLOUR,
                selector: '#tp >>> .hub',
                property: 'fill',
                expected: DRILL_COLOUR,
            });
            await assertTokenDrill(page, {
                token: '--ui-steel',
                value: DRILL_COLOUR,
                selector: '#tp >>> .disc',
                property: 'fill',
                expectLanding: false,
            });
        }));

        test('the chip glyph is --ui-text-base and its box is --ui-radius-pill', () => mounted(async (page) => {
            const base = await page.resolveValue('var(--ui-text-base)', 'font-size');
            assert.equal(
                await page.prop(chip(6), 'font-size'), base,
                'settings-machine-sleep---wake-schedules #schedule-time-input [i=76] '
                + 'font-size = 17px <- authored var(--slate-text-base) (token-driven); '
                + 'gives the clock numbers the same token',
            );
            await assertTokenDrill(page, {
                token: '--ui-text-base', value: DRILL_LENGTH,
                selector: chip(6), property: 'font-size', expected: DRILL_LENGTH,
            });
            await assertTokenDrill(page, {
                token: '--ui-radius-pill', value: '7px',
                selector: chip(6), property: 'border-top-left-radius', expected: '7px',
            });
        }));

        test('the readout digits are --ui-display-md, slotted into #3', () => mounted(async (page) => {
            const bankItem = await page.prop('#tp >>> #field >>> #item-0', 'font-size');
            const digits = await page.prop('#tp >>> .digits', 'font-size');
            assert.notEqual(
                digits, bankItem,
                'the slotted digits must not fall back to the bank cell\'s --ui-text-base',
            );
            await assertTokenDrill(page, {
                token: '--ui-display-md', value: DRILL_LENGTH,
                selector: '#tp >>> .digits', property: 'font-size', expected: DRILL_LENGTH,
            });
        }));

        test('the composed banks have a real box — containment does not collapse them', () =>
            mounted(async (page) => {
                const floor = parseFloat(await page.resolveValue('var(--ui-hit-min)', 'width'));
                const inner = parseFloat(await page.resolveValue('var(--ui-control-inner)', 'height'));

                for (const bank of ['field', 'meridiem']) {
                    const host = await page.box(`#wide >>> #${bank}`);
                    const a = await page.box(`#wide >>> #${bank} >>> #item-0`);
                    const b = await page.box(`#wide >>> #${bank} >>> #item-1`);

                    assert.ok(
                        host.width >= a.width + b.width - 2.5,
                        `#${bank} is ${host.width}px around two cells of ${a.width} + ${b.width}: `
                        + 'its items are overflowing a host that clips them',
                    );
                    near(a.width, 88, `#${bank} cell 0 is one --_ui-tp-seg`, 1.5);
                    near(b.width, 88, `#${bank} cell 1 is one --_ui-tp-seg`, 1.5);
                    near(a.height, inner, `#${bank} cell 0 is --ui-control-inner tall`, 1.5);
                    assert.ok(a.height >= floor - 0.5, `#${bank} cell 0 clears --ui-hit-min`);

                    const under = await page.evalFn((x, y) => {
                        const path = document.elementsFromPoint(x, y);
                        return path.length ? path[0].tagName : null;
                    }, b.left + b.width / 2, b.top + b.height / 2);
                    assert.equal(
                        under, 'UI-TIME-PICKER',
                        `nothing of #${bank}'s second cell is under its own centre`,
                    );
                }
            }, boxed(600, '<ui-time-picker id="wide" value="06:30"></ui-time-picker>', 'stage-wide')));

        test('the readout refuses to shrink too — the clock is the fluid half, not it', () =>
            mounted(async (page) => {
                for (const cell of ['#field >>> #item-0', '#field >>> #item-1',
                    '#meridiem >>> #item-0', '#meridiem >>> #item-1']) {
                    const box = await page.box(`#squeezed >>> ${cell}`);
                    near(box.width, 88, `${cell} keeps --_ui-tp-seg in a 200px stage`, 1.5);
                }
                const row = await page.box('#squeezed >>> .display');
                const stage = await page.box('#stage');
                assert.ok(
                    row.width > stage.width,
                    `the readout is ${row.width}px in a ${stage.width}px stage: it must overflow, `
                    + 'not ellipsise its own digits',
                );
            }, boxed(200, '<ui-time-picker id="squeezed" value="06:30"></ui-time-picker>')));

        test('the selected number is the four dials and nothing else', () => mounted(async (page) => {
            await assertOneSelectionTreatment(page, {
                selected: chip(6),
                unselected: chip(5),
            });
        }));

        test('one treatment reaches the chip, the readout and the meridiem together', () =>
            mounted(async (page) => {
                const face = await page.resolveToken('--ui-selected-face', 'background-color');
                const targets = [
                    chip(6),                                 // the clock number
                    '#tp >>> #field >>> #item-0',            // the hour segment of the readout
                    '#tp >>> #meridiem >>> #item-0',         // AM
                ];
                for (const sel of targets) {
                    assert.equal(
                        await page.prop(sel, 'background-color'), face,
                        `${sel} does not rest on --ui-selected-face when checked`,
                    );
                }

                await page.setToken('--ui-selected-face', DRILL_COLOUR);
                const moved = [];
                for (const sel of targets) moved.push(await page.prop(sel, 'background-color'));
                await page.setToken('--ui-selected-face', null);

                const expected = await page.resolveValue(DRILL_COLOUR, 'background-color');
                assert.deepEqual(
                    moved, [expected, expected, expected],
                    'one dial, three selected surfaces — a private selected look anywhere in '
                    + 'this compound shows up as one of these staying put',
                );
            }));

        test('O16: the selected number\'s ink is a dial, so it can move — a hex cannot',
            () => mounted(async (page) => {
                const ink = await page.resolveToken('--ui-selected-ink', 'color');
                assert.equal(
                    await page.prop(chip(6), 'color'), ink,
                    'the selected chip must take --ui-selected-ink, not a literal',
                );

                await assertTokenDrill(page, {
                    token: '--ui-selected-ink',
                    value: DRILL_COLOUR,
                    selector: chip(6),
                    property: 'color',
                    expected: DRILL_COLOUR,
                });

                const svgText = await page.count('#tp >>> svg text');
                assert.equal(svgText, 0, 'no SVG <text> to need a fill literal');
            }));

        test('O16: the resting number is --ui-text, also a token', () => mounted(async (page) => {
            const text = await page.resolveToken('--ui-text', 'color');
            assert.equal(await page.prop(chip(5), 'color'), text);
            await assertTokenDrill(page, {
                token: '--ui-text', value: DRILL_COLOUR,
                selector: chip(5), property: 'color', expected: DRILL_COLOUR,
            });
        }));

        test('every one of the twelve targets is --ui-hit-min, at every face size', () =>
            mounted(async (page) => {
                const floor = parseFloat(await page.resolveValue('var(--ui-hit-min)', 'width'));
                near(floor, 48, '--ui-hit-min is the 48px touch floor');

                for (const host of ['tp', 'min']) {
                    for (let i = 0; i < 12; i += 1) {
                        const box = await page.box(chip(i, host));
                        near(box.width, floor, `#${host} chip ${i} inline hit extent`);
                        near(box.height, floor, `#${host} chip ${i} block hit extent`);
                    }
                }
                assert.ok(floor > 44, 'matching Slate here would reproduce the defect');
            }));

        test('the targets keep the floor when the face is squeezed — they do not scale', () =>
            mounted(async (page) => {
                const floor = parseFloat(await page.resolveValue('var(--ui-hit-min)', 'width'));
                for (let i = 0; i < 12; i += 1) {
                    const box = await page.box(`#squeezed >>> #chip-${i}`);
                    near(box.width, floor, `chip ${i} in a 200px stage is still the floor`);
                    near(box.height, floor, `chip ${i} in a 200px stage is still the floor`);
                }
            }, boxed(200, '<ui-time-picker id="squeezed" value="06:30"></ui-time-picker>')));

        test('two adjacent targets never overlap, because the FACE has the floor', () =>
            mounted(async (page) => {
                const floor = parseFloat(await page.resolveValue('var(--ui-hit-min)', 'width'));
                const centres = [];
                for (let i = 0; i < 12; i += 1) {
                    const b = await page.box(`#squeezed >>> #chip-${i}`);
                    centres.push({ x: b.left + b.width / 2, y: b.top + b.height / 2 });
                }
                for (let i = 0; i < 12; i += 1) {
                    const a = centres[i];
                    const c = centres[(i + 1) % 12];
                    const d = Math.hypot(a.x - c.x, a.y - c.y);
                    assert.ok(
                        d >= floor - 0.6,
                        `chips ${i} and ${(i + 1) % 12} are ${d.toFixed(1)}px apart against a `
                        + `${floor}px target: at the face's floor they would overlap`,
                    );
                }
            }, boxed(200, '<ui-time-picker id="squeezed" value="06:30"></ui-time-picker>')));

        test('the face reads its own container and stops at the artwork\'s size', () =>
            mounted(async (page) => {
                const wide = await page.box('#wide >>> #face');
                near(wide.width, FACE_MAX, 'a 600px stage gives the natural 264px face');
                near(wide.height, FACE_MAX, 'aspect-ratio 1 — no second length declared');

                const mid = await page.box('#mid >>> #face');
                near(mid.width, FACE_MID, 'a 256px stage gives a 256px face: the container is read');
                near(mid.height, FACE_MID, 'and it stays square, from aspect-ratio alone');
            }, boxed(600, '<ui-time-picker id="wide" value="06:30"></ui-time-picker>', 'stage-wide')
             + boxed(FACE_MID, '<ui-time-picker id="mid" value="06:30"></ui-time-picker>', 'stage-mid')));

        test('the container floor: below it the face overflows rather than shrinking', () =>
            mounted(async (page) => {
                const floor = parseFloat(await page.resolveValue('var(--ui-hit-min)', 'width'));
                const face = await page.box('#squeezed >>> #face');
                const stage = await page.box('#stage');

                assert.ok(
                    face.width > stage.width,
                    `the face is ${face.width}px in a ${stage.width}px stage: it must overflow, `
                    + 'not shrink its targets under the thumb (§2.2 row 1)',
                );
                assert.ok(
                    face.width >= floor * 5,
                    'the floor must clear twelve 48px chips on a ring, which is ~5.2 x hit-min',
                );
                near(face.height, face.width, 'the floor is applied on one axis; the ratio keeps both');

                const before = parseFloat(await page.prop('#squeezed >>> #face', 'min-inline-size'));
                await page.setToken('--ui-hit-min', DRILL_LENGTH);
                const after = parseFloat(await page.prop('#squeezed >>> #face', 'min-inline-size'));
                await page.setToken('--ui-hit-min', null);
                const restored = parseFloat(await page.prop('#squeezed >>> #face', 'min-inline-size'));

                assert.ok(before > 0 && after > 0, 'the floor is a real length in both states');
                near(
                    after / before, parseFloat(DRILL_LENGTH) / floor,
                    'the face floor is derived from --ui-hit-min, not typed', 0.01,
                );
                near(restored, before, 'and it restores');
            }, boxed(200, '<ui-time-picker id="squeezed" value="06:30"></ui-time-picker>')));

        test('§4.6: no vw, no vh — the same container gives the same face at both geometries', () =>
            mounted(async (page) => {
                const wide = await page.box('#wide >>> #face');
                const mid = await page.box('#mid >>> #face');
                near(wide.width, FACE_MAX, `264px at ${geometry.width}x${geometry.height}`);
                near(mid.width, FACE_MID, `256px at ${geometry.width}x${geometry.height}`);

                const chipBox = await page.box('#wide >>> #chip-0');
                near(chipBox.width, 48, `the target is 48px at ${geometry.width}x${geometry.height}`);
            }, boxed(600, '<ui-time-picker id="wide" value="06:30"></ui-time-picker>', 'stage-wide')
             + boxed(FACE_MID, '<ui-time-picker id="mid" value="06:30"></ui-time-picker>', 'stage-mid')));

        test('the 12 o\'clock chip takes the one ring, unclipped', () => mounted(async (page) => {
            await assertFocusUnclipped(page, chip(0));
        }));

        test('a chip inside the dialog body\'s scrollport is still unclipped', () => mounted(
            async (page) => {
                await assertFocusUnclipped(page, '#tp >>> #chip-0');
            },
            '<ui-dialog id="d" open heading="Set time">'
            + '<ui-time-picker id="tp" slot="body" value="06:30"></ui-time-picker>'
            + '</ui-dialog>',
            MODULE_IN_DIALOG,
        ));

        test('the dial is a radiogroup of twelve radios, named by the mode', () => mounted(async (page) => {
            const ring = await page.evalFn(() => {
                const r = window.__h.need('#tp >>> #ring');
                return { role: r.getAttribute('role'), label: r.getAttribute('aria-label') };
            });
            assert.equal(ring.role, 'radiogroup');
            assert.equal(ring.label, 'Hour', 'the group is named for the unit it edits');

            const minRing = await page.evalFn(
                () => window.__h.need('#min >>> #ring').getAttribute('aria-label'),
            );
            assert.equal(minRing, 'Minute', 'and it renames when the mode changes');

            assert.equal(await page.count('#tp >>> [role="radio"]'), 12);
            assert.equal(
                await page.evalFn(() => window.__h.need('#tp >>> svg').getAttribute('aria-hidden')),
                'true',
                'the artwork is decorative: every piece of meaning is on the buttons',
            );
        }));

        test('exactly one chip is the tab stop — roving, per Appendix 10', () => mounted(async (page) => {
            const stops = await page.evalFn(
                () => [...window.__h.need('#tp >>> #ring').querySelectorAll('[role="radio"]')]
                    .map((b, i) => (b.getAttribute('tabindex') === '0' ? i : -1))
                    .filter((i) => i >= 0),
            );
            assert.deepEqual(stops, [6], 'the checked chip is the one stop, not twelve stops');

            // ...and where nothing is checked, index 0 keeps the dial reachable at all.
            const offStops = await page.evalFn(
                () => [...window.__h.need('#off >>> #ring').querySelectorAll('[role="radio"]')]
                    .map((b, i) => (b.getAttribute('tabindex') === '0' ? i : -1))
                    .filter((i) => i >= 0),
            );
            assert.deepEqual(offStops, [0], 'an off-tick minute still has exactly one way in');
        }));

        test('the host is a named group and the time is announced politely', () => mounted(async (page) => {
            const host = await page.evalFn(() => {
                const h = window.__h.need('#tp');
                return { role: h.getAttribute('role'), label: h.getAttribute('aria-label') };
            });
            assert.equal(host.role, 'group');
            assert.equal(host.label, 'Wake time');

            const live = await page.evalFn(() => {
                const p = window.__h.need('#tp >>> #live');
                return {
                    text: p.textContent.trim(),
                    role: p.getAttribute('role'),
                    live: p.getAttribute('aria-live'),
                };
            });
            assert.deepEqual(live, { text: '6:30 AM', role: 'status', live: 'polite' });

            const style = await page.computed('#tp >>> #live', ['display', 'visibility', 'width', 'position']);
            assert.notEqual(style.display, 'none');
            assert.notEqual(style.visibility, 'hidden');
            assert.equal(style.position, 'absolute');
            assert.ok(parseFloat(style.width) > 0, 'still laid out, so still announced');
        }));

        test('tapping an hour writes it through to24h and advances to the minute dial', () =>
            mounted(async (page) => {
                await page.recordEvents('#tp', ['change']);
                await page.click(chip(9));

                assert.equal(await page.evalFn(() => window.__h.need('#tp').value), '09:30');
                assert.equal(
                    await page.evalFn(() => window.__h.need('#tp').getAttribute('mode')), 'minute',
                    'auto-advance, "like the OS picker" ',
                );
                const events = await page.recordedEvents();
                assert.equal(events.length, 1, 'one change, on the one user choice');
                assert.equal(events[0].type, 'change');
            }));

        test('the meridiem writes through to24h, and the bank\'s own change does not leak', () =>
            mounted(async (page) => {
                await page.recordEvents('#tp', ['change']);

                // PM is item 1 of the meridiem bank.
                await page.click('#tp >>> #meridiem >>> #item-1');
                assert.equal(await page.evalFn(() => window.__h.need('#tp').value), '18:30');

                await page.click('#tp >>> #field >>> #item-1');
                assert.equal(
                    await page.evalFn(() => window.__h.need('#tp').getAttribute('mode')), 'minute',
                );
                const events = await page.recordedEvents();
                assert.equal(events.length, 1, 'exactly one change: the meridiem, not the segment');
            }));

        test('arrow keys rove the dial without auto-advancing', () => mounted(async (page) => {
            await page.focusVisible(chip(6));
            await page.press('ArrowRight');

            assert.equal(await page.evalFn(() => window.__h.need('#tp').value), '07:30',
                'selection follows focus — the WAI-ARIA radio contract');
            assert.equal(
                await page.evalFn(() => window.__h.need('#tp').getAttribute('mode')), 'hour',
                'a dial that changed under the caret would be unusable from a keyboard',
            );
            const focused = await page.evalFn(
                () => window.__h.need('#tp').renderRoot.activeElement?.id,
            );
            assert.equal(focused, 'chip-7', 'and the roving stop moved with it');
        }));

        test('disabled paints once and refuses input', () => mounted(async (page) => {
            const dim = await page.tokenValue('--ui-opacity-disabled');
            assert.equal(await page.prop('#dis', 'opacity'), String(parseFloat(dim)));

            await page.recordEvents('#dis', ['change']);
            await page.click('#dis >>> #chip-3');
            assert.equal(await page.evalFn(() => window.__h.need('#dis').value), '18:00');
            assert.deepEqual(await page.recordedEvents(), [], 'no change from a disabled control');
        }));

        test('every gallery state mounts and produces a face', async () => {
            for (const state of galleryEntry.states) {
                await browser.withPage({ geometry }, async (page) => {
                    await page.mount(state.html, ['/tools/gallery/entries/ui-time-picker.demo.js']);
                    assert.deepEqual(page.pageErrors, [], `state ${state.id} threw on mount`);
                    const n = await page.count('ui-time-picker');
                    assert.ok(n > 0, `state ${state.id} mounts no ui-time-picker`);
                    const box = await page.box('ui-time-picker >>> #face');
                    assert.ok(
                        box.width > 0 && box.height > 0,
                        `state ${state.id} would photograph an empty stage`,
                    );
                });
            }
        });
    });
}
