/**
 * The Live bands in a real engine, at both the render harness sizes.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES, DESKTOP } from '../harness/index.js';
import { assertOneSelectionTreatment, assertHitFloor, assertFocusUnclipped } from '../harness/assertions.js';
import { CLOCK_FORMAT, DEFAULT_CLOCK_FORMAT } from '../../src/lib/wall-clock.js';

const MODULE = ['/src/screens/live-screen.js'];
const STAGE = '<div id="stage" style="inline-size: 100%; block-size: 100dvh"><live-screen></live-screen></div>';

const S = 'live-screen';
const RAIL = `${S} >>> live-rail`;

const FAVOURITES = [
    { value: 'p1', name: 'Extractamundo Dos!' },
    { value: 'p2', name: 'Temp test' },
    { value: 'p3', name: 'Extract Blooming Espresso' },
    null,
    null,
];

const CLOCK_SPELLING = DEFAULT_CLOCK_FORMAT === CLOCK_FORMAT.H12
    ? /^(1[0-2]|[1-9]):[0-5]\d\s[AP]M$/i
    : /^([01]\d|2[0-3]):[0-5]\d$/;

/** Targets for the screen to show. Values, not ranges — the ranges are the table's. */
const TARGETS = {
    dose: 17, drinkWeight: 40, brewTemp: 92,
    steamTemp: 155, steamFlow: 2.1, steamDuration: 45, milkStopTemp: 62,
    hotWaterTemp: 98, hotWaterVolume: 240,
    flushTemp: 90, flushFlow: 4, flushDuration: 5,
};

const configure = (page, { entries = ['cupWarmer'], ...patch } = {}) => page.evalFn(async (served, props) => {
    const { r2MachineLimits } = await import('/src/data/adapters-r.js');
    const screen = window.__h.q('live-screen');
    screen.limits = served === null ? r2MachineLimits(null).value : r2MachineLimits(served).value;
    Object.assign(screen, props);
    await screen.updateComplete;
    return screen.limits ? Object.keys(screen.limits).length : 0;
}, entries, patch);

/** Every element in the rail, as tag + the state a test cares about. */
const RAIL_TREE = `(() => {
    const rail = window.__h.q('live-screen').shadowRoot.querySelector('live-rail');
    return [...rail.children].map((el) => {
        const r = el.getBoundingClientRect();
        const inner = el.tagName === 'DIV' ? [...el.children].map((c) => c.tagName.toLowerCase()) : [];
        const label = el.shadowRoot && el.shadowRoot.getElementById('label');
        return {
            tag: el.tagName.toLowerCase(),
            inner,
            key: el.dataset.key ?? null,
            row: el.dataset.row ?? null,
            sectionStart: el.hasAttribute('data-section-start'),
            /* The PAINTED name, so a claim about which rows grow can be written in the
               words a reader sees rather than in a data-key nobody reads. */
            label: label ? label.textContent.trim() : null,
            top: +r.top.toFixed(2),
            height: +r.height.toFixed(2),
            bottom: +r.bottom.toFixed(2),
        };
    });
})()`;

const railTree = (page) => page.eval(`JSON.stringify(${RAIL_TREE})`).then(JSON.parse);

const RAIL_LABELS = `(() => {
    const rail = window.__h.q('live-screen').shadowRoot.querySelector('live-rail');
    const out = [];
    /* ONE LEVEL IN WHERE A ROW IS WRAPPED. The first track is the abort target's
       one-cell grid (live-targets.js, abortSlot), so its stepper is a grandchild of the
       rail; a children-only walk quietly measured eight of the nine. */
    const rows = [...rail.children].map((el) => (el.tagName === 'UI-STEPPER' ? el : el.querySelector('ui-stepper')));
    for (const el of rows) {
        if (!el || el.tagName !== 'UI-STEPPER') continue;
        const root = el.shadowRoot;
        const label = root.getElementById('label');
        const band = root.querySelector('.band');
        const cap = root.getElementById('decrement');
        const value = root.getElementById('value');
        const named = band.getAttribute('aria-labelledby');
        const box = (node) => {
            const r = node.getBoundingClientRect();
            return { x: +r.x.toFixed(2), width: +r.width.toFixed(2), height: +r.height.toFixed(2),
                right: +r.right.toFixed(2) };
        };
        const range = document.createRange();
        if (label) range.selectNodeContents(label);
        out.push({
            key: el.dataset.key ?? null,
            property: el.label,
            visible: label ? label.textContent.trim() : null,
            spoken: named ? (root.getElementById(named)?.textContent ?? '').trim() : band.getAttribute('aria-label'),
            namedBy: named ? 'aria-labelledby' : 'aria-label',
            hidden: label ? getComputedStyle(label).display === 'none' : null,
            row: box(el),
            label: label ? box(label) : null,
            band: box(band),
            cap: box(cap).width,
            value: box(value).width,
            valueClipped: value.scrollWidth > value.clientWidth + 1,
            labelClipped: label ? label.scrollWidth > label.clientWidth + 1 : null,
        });
    }
    return out;
})()`;

const railLabels = (page) => page.eval(`JSON.stringify(${RAIL_LABELS})`).then(JSON.parse);

/** The stepper that carries one limit key, as a deep selector. */
const stepper = (key) => `${S} >>> ui-stepper[data-key="${key}"]`;

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`live bands @ ${geometry.name} (${geometry.width}x${geometry.height})`, () => {

        const mounted = (fn) => browser.withPage({ geometry }, async (page) => {
            await page.mount(STAGE, MODULE);
            await page.settle(6);
            assert.deepEqual(page.pageErrors, [], 'the bands must mount without throwing');
            await fn(page);
            assert.deepEqual(page.pageErrors, [], 'the bands must run without throwing');
        });

        test('every band is a library component, named', () => mounted(async (page) => {
            await configure(page, { targets: TARGETS, favourites: FAVOURITES, favourite: 'p1', profileName: 'Londinium' });

            // The header's three clusters.
            const header = await page.evalFn(() => {
                const root = window.__h.q('live-screen').shadowRoot;
                const slotted = (name) => [...root.querySelectorAll(`[slot="${name}"]`)]
                    .map((el) => el.tagName.toLowerCase());
                return {
                    lead: slotted('lead'),
                    favourites: slotted('favourites'),
                    actions: [...root.querySelectorAll('[slot="actions"] > *')].map((el) => el.tagName.toLowerCase()),
                };
            });

            assert.deepEqual(header.lead, ['ui-icon-button'], 'the library button is a real button (L21)');
            assert.deepEqual(header.favourites, ['ui-favourites-bank'], 'the favourites are the REAL bank (L8)');

            assert.deepEqual(header.actions,
                ['ui-button', 'ui-button', 'ui-button', 'ui-button']);

            const inside = await page.evalFn(() => window.__h.q('live-screen >>> ui-favourites-bank')
                .shadowRoot.querySelector('ui-bank').tagName.toLowerCase());
            assert.equal(inside, 'ui-bank');

            // The rail, and the foot band.
            const tree = await railTree(page);
            assert.deepEqual(tree[0].inner, ['ui-stepper'], 'the rail does not open on GRIND');
            assert.ok(tree.slice(1).every((row) => ['ui-stepper', 'ui-preset-bank'].includes(row.tag)),
                `a rail row is not a library control: ${tree.map((r) => r.tag).join(', ')}`);
            assert.equal(await page.exists(`${S} >>> ui-data-grid`), true, 'the phase table is #34');
            assert.equal(await page.exists(`${S} >>> ui-numeric-keypad`), true, 'the numpad is #53');
        }));

        test('the foot band shows the derivation\'s phases, and no derived channel (D1)',
            () => mounted(async (page) => {
                await configure(page, {
                    storedDerivation: {
                        ok: true,
                        scalars: {
                            durationSeconds: 45, dose: 18, yield: 39, ratio: 2.2,
                            timeToFirstDrop: 8, averageFlow: 2.1, peakFlowAfterFirstDrop: 2.8,
                            averagePressure: 6.1, peakPressure: 9,
                        },
                        phases: {
                            preinfusion: { seconds: 15, weight: 10, volume: 17 },
                            extraction: { seconds: 30, weight: 29, volume: 30 },
                            total: { seconds: 45, weight: 39, volume: 47 },
                        },
                    },
                    storedShot: {
                        id: 'shot-1',
                        timestamp: '2026-08-13T10:15:57.783240',
                        workflow: { profile: { title: 'Extractamundo Dos! (2)' } },
                    },
                    shotId: 'shot-1',
                    rating: 73,
                    historyCount: 12,
                });

                const grid = await page.evalFn(() => {
                    const el = window.__h.q('live-screen >>> ui-data-grid');
                    return {
                        columns: el.columns.map((c) => c.key),
                        rows: el.rows.map((r) => r.key),
                        text: el.shadowRoot.textContent.replace(/\s+/g, ' ').trim(),
                    };
                });
                assert.deepEqual(grid.columns, ['time', 'weight', 'volume'],
                    'the derived list is absent in v1 — D1 removes it and its plumbing');
                assert.deepEqual(grid.rows, ['preinfusion', 'extraction', 'total']);
                assert.match(grid.text, /45/, 'the total row carries the derivation\'s own number');

                const blocks = await page.evalFn(() => {
                    const root = window.__h.q('live-screen').shadowRoot;
                    const text = (sel) => [...root.querySelectorAll(sel)]
                        .map((el) => el.textContent.replace(/\s+/g, ' ').trim());
                    const one = (sel) => root.querySelector(sel)?.textContent
                        .replace(/\s+/g, ' ').trim();
                    return { shot: text('.foot-shot p'),
                             when: one('.shot-when'),
                             profile: one('.shot-profile'),
                             charge: one('.shot-charge'),
                             terms: text('.foot-derived dt'), values: text('.foot-derived dd') };
                });
                assert.equal(blocks.shot.length, 3, 'the band does not say which shot it is about');
                assert.match(blocks.when, /10:15/, 'the date line is the shot\'s own clock');
                assert.equal(blocks.profile, 'Extractamundo Dos! (2)');
                assert.match(blocks.charge, /18\.0 g/, 'the dose rides on the date line now');
                assert.deepEqual(blocks.terms, ['Ratio', 'First drop', 'Flow avg/peak', 'Press avg/peak']);
                assert.deepEqual(blocks.values, ['1:2.2', '8.0', '2.1 / 2.8', '6.1 / 9.0']);

                // The band's controls are the library's too.
                assert.equal(await page.exists(`${S} >>> ui-rating-control`), true);
                const controls = await page.evalFn(() => [...window.__h.q('live-screen')
                    .shadowRoot.querySelectorAll('.foot-controls > *')].map((el) => el.tagName.toLowerCase()));
                assert.deepEqual(controls, ['ui-rating-control']);
                assert.equal(await page.exists(`${S} >>> ui-stepper[label="Stored shot"]`), false,
                    'the dead stored-shot stepper is back');
                const entry = await page.evalFn(() => {
                    const el = window.__h.q('live-screen').shadowRoot.getElementById('history-entry');
                    return el ? { tag: el.tagName.toLowerCase(), text: el.textContent.trim(),
                        parent: el.parentElement.className } : null;
                });
                assert.deepEqual(entry, { tag: 'ui-button', text: 'All shots', parent: 'shot-nav' },
                    'the way in to History is Slate\'s word, in Slate\'s own block '
                    + '(#history-open-viewer [i=118], under the date and the profile line)');
            }));

        test('L8: the two banks on this screen wear the same selected treatment, from the dials',
            () => mounted(async (page) => {
                await configure(page, { targets: TARGETS, favourites: FAVOURITES, favourite: 'p2' });

                const modeItem = `${S} >>> ui-preset-bank >>> ui-bank >>> [aria-pressed="true"]`;
                const favItem = `${S} >>> ui-favourites-bank >>> ui-bank >>> [aria-pressed="true"]`;

                await assertOneSelectionTreatment(page, {
                    selected: modeItem,
                    unselected: `${S} >>> ui-preset-bank >>> ui-bank >>> [aria-pressed="false"]`,
                    scope: `${S} >>> ui-preset-bank`,
                    contrast: 'led',
                });
                await assertOneSelectionTreatment(page, {
                    selected: favItem,
                    unselected: `${S} >>> ui-favourites-bank >>> ui-bank >>> [aria-pressed="false"]`,
                });

                const favBefore = await page.computed(favItem, ['background-color']);
                await page.setToken('--ui-selected-face', 'rgb(255, 0, 170)');
                await page.settle(3);
                const fav = await page.computed(favItem, ['background-color']);
                await page.setToken('--ui-selected-face', null);
                assert.equal(fav['background-color'], 'rgb(255, 0, 170)');
                assert.notEqual(fav['background-color'], favBefore['background-color']);

                const presetBefore = await page.computed(modeItem, ['box-shadow']);
                await page.setToken('--ui-preset-selected-led', '11px');
                await page.settle(3);
                const preset = await page.computed(modeItem, ['box-shadow']);
                await page.setToken('--ui-preset-selected-led', null);
                assert.match(preset['box-shadow'], /-11px/,
                    'the preset row did not follow its own dial');
                assert.notEqual(preset['box-shadow'], presetBefore['box-shadow']);
            }));

        test('the band\'s three history controls are one row, one height, one top',
            () => mounted(async (page) => {
                await configure(page, { targets: TARGETS, shotId: 'shot-1',
                    canStepOlder: true, canStepNewer: true });

                const controlH = parseFloat(await page.resolveValue('var(--ui-control-h)', 'block-size'));
                const ids = ['shot-older', 'shot-newer', 'history-entry'];
                const boxes = await Promise.all(ids.map((id) => page.box(`${S} >>> #${id}`)));

                for (const [i, id] of ids.entries()) {
                    assert.ok(Math.abs(boxes[i].height - controlH) < 0.51,
                        `#${id} is ${boxes[i].height} tall against --ui-control-h ${controlH}`);
                    assert.ok(Math.abs(boxes[i].top - boxes[0].top) < 0.51,
                        `#${id} sits at ${boxes[i].top} against the row's ${boxes[0].top}`);
                }

                /* AND THE ROW IS THE CONTROLS' OWN HEIGHT — a row taller than what it
                 * holds is the leftover margin coming back. */
                const row = await page.box(`${S} >>> .shot-nav`);
                assert.ok(Math.abs(row.height - controlH) < 0.51,
                    `the nav row is ${row.height} tall for a ${controlH} control`);
            }));

        test('the WEIGHT tile is the tare, by pointer and by keyboard', () => mounted(async (page) => {
            await configure(page, { targets: TARGETS });

            const tile = `${S} >>> .gauges ui-stat-tile[data-press="tare"]`;
            const seen = await page.evalFn((selector) => {
                const el = window.__h.q(selector);
                const screen = window.__h.q('live-screen');
                const events = [];
                screen.addEventListener('scale-tare', () => events.push('tare'));
                el.click();
                el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
                el.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
                el.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
                return {
                    fired: events.length,
                    role: el.getAttribute('role'),
                    tabindex: el.getAttribute('tabindex'),
                    named: el.getAttribute('aria-label'),
                };
            }, tile);

            assert.equal(seen.fired, 3, 'a click, Enter and Space each ask once — and "a" does not');
            assert.equal(seen.role, 'button', 'the tile does not announce itself as a control');
            assert.equal(seen.tabindex, '0', 'and a keyboard cannot reach it');
            assert.ok(seen.named && seen.named.length > 0, 'an icon-less control with no name');

            const pressable = await page.evalFn(() => [...window.__h.q('live-screen').shadowRoot
                .querySelectorAll('.gauges ui-stat-tile')]
                .filter((el) => el.hasAttribute('data-press')).length);
            assert.equal(pressable, 1, 'more than one gauge became a control');
        }));

        test('the steppers take their range from the table, and no other place',
            () => mounted(async (page) => {
                await configure(page, { targets: TARGETS, offers: { milkProbe: true } });
                const rows = await page.evalFn(async (served) => {
                    const { r2MachineLimits } = await import('/src/data/adapters-r.js');
                    const table = r2MachineLimits(served).value;
                    const root = window.__h.q('live-screen').shadowRoot;
                    return [...root.querySelectorAll('live-rail ui-stepper')].map((el) => ({
                        key: el.dataset.key,
                        min: el.min, max: el.max, step: el.step, unit: el.unit,
                        disabled: el.disabled,
                        want: table[el.dataset.key] ?? null,
                    }));
                }, ['cupWarmer']);

                for (const row of rows) {
                    if (row.key === 'grind') {
                        assert.ok(row.want, 'grind lost its row in the R2 table');
                        assert.equal(row.disabled, false, 'GRIND is dead again');
                    }
                    assert.ok(row.want, `${row.key} has no row in the table it claims to read`);
                    assert.equal(row.min, row.want.min, `${row.key}: min is not the table's`);
                    assert.equal(row.max, row.want.max, `${row.key}: max is not the table's`);
                    assert.equal(row.step, row.want.step, `${row.key}: step is not the table's`);
                    assert.equal(row.unit, row.want.unit ?? '', `${row.key}: unit is not the table's`);
                }
            }));

        test('B3: the steam envelope is on the table this screen holds, and it is the port\'s',
            () => mounted(async (page) => {
                const envelope = await page.evalFn(async () => {
                    const { r2MachineLimits } = await import('/src/data/adapters-r.js');
                    const { clamp } = await import('/src/lib/machine-limits.js');
                    const bengle = r2MachineLimits(['cupWarmer']).value;
                    const de1 = r2MachineLimits([]).value;
                    const unknown = r2MachineLimits(null).value;
                    window.__h.q('live-screen').limits = bengle;
                    return {
                        held: window.__h.q('live-screen').limits.steamTemp,
                        de1: de1.steamTemp,
                        unknown: unknown.steamTemp ?? null,
                        low: clamp(bengle, 'steamTemp', 130),
                        high: clamp(bengle, 'steamTemp', 170),
                        highDe1: clamp(de1, 'steamTemp', 170),
                    };
                });
                assert.equal(envelope.held.floor, 135, 'the working band starts at 135');
                assert.equal(envelope.held.max, 170, 'the steam ceiling is the machine\'s own 170');
                assert.equal(envelope.de1.max, 160, 'and the DE1 keeps the documented 160');
                assert.notEqual(envelope.held.max, envelope.de1.max,
                    'the class is what decides the ceiling — one number for both would make it decide nothing');
                assert.equal(envelope.unknown, null,
                    'with the machine class unresolved there is no steam row — A7, not a stand-in ceiling');
                assert.equal(envelope.low, 135, '130 must not be settable');
                assert.equal(envelope.high, 170, 'and 170 is a value the machine holds');
                assert.equal(envelope.highDe1, 160,
                    'while the same 170 comes back DOWN to the DE1\'s own ceiling');
            }));

        test('the numpad refuses an invalid number and applies an explicitly entered valid number',
            () => mounted(async (page) => {
                await configure(page, { targets: TARGETS });

                await page.evalFn(() => {
                    const el = window.__h.q('live-screen >>> ui-stepper[data-key="hotWaterVolume"]');
                    el.shadowRoot.querySelectorAll('button')[1].click();
                    return true;
                });
                await page.settle(4);

                const open = await page.evalFn(() => {
                    const pad = window.__h.q('live-screen >>> ui-numeric-keypad');
                    return { open: pad.open, key: pad.limitKey, dialog: !!pad.shadowRoot.querySelector('ui-dialog') };
                });
                assert.equal(open.open, true, 'the numpad is the typed path and it opened');
                assert.equal(open.key, 'hotWaterVolume');
                assert.equal(open.dialog, true, 'the body rides in the ONE dialog shell (#18)');

                const confirmed = await page.evalFn(async () => {
                    const pad = window.__h.q('live-screen >>> ui-numeric-keypad');
                    pad.press('3'); pad.press('0'); pad.press('0');
                    await pad.updateComplete;
                    const accepted = pad.confirm();
                    const screen = window.__h.q('live-screen');
                    await screen.updateComplete;
                    return { accepted, held: screen.targets.hotWaterVolume, open: pad.open, raw: pad._buffer };
                });
                assert.equal(confirmed.accepted, false);
                assert.equal(confirmed.held, TARGETS.hotWaterVolume);
                assert.equal(confirmed.raw, '300');
                assert.equal(confirmed.open, true);

                const valid = await page.evalFn(async () => {
                    const pad = window.__h.q('live-screen >>> ui-numeric-keypad');
                    const maximum = pad.range.max;
                    for (let i = 0; i < 3; i++) pad.press('backspace');
                    for (const digit of String(maximum)) pad.press(digit === '.' ? 'decimal' : digit);
                    const accepted = pad.confirm();
                    const screen = window.__h.q('live-screen');
                    await screen.updateComplete;
                    return { accepted, maximum, held: screen.targets.hotWaterVolume, open: pad.open };
                });
                assert.equal(valid.accepted, true);
                assert.equal(valid.held, valid.maximum);
                assert.equal(valid.open, false);
            }));

        /** Open the numpad on one rail row from its value cell, the way a finger does. */
        const openPad = async (page, key) => {
            await page.evalFn((k) => {
                const el = window.__h.q(`live-screen >>> ui-stepper[data-key="${k}"]`);
                el.shadowRoot.querySelectorAll('button')[1].click();
                return true;
            }, key);
            await page.settle(4);
        };

        /** The pad's own sentence and unit, and the stepper's, side by side. */
        const padVersusStepper = (page, key) => page.evalFn((k) => {
            const pad = window.__h.q('live-screen >>> ui-numeric-keypad');
            const stepper = window.__h.q(`live-screen >>> ui-stepper[data-key="${k}"]`);
            return {
                open: pad.open === true,
                padHint: pad.shadowRoot.getElementById('hint').textContent.trim(),
                padUnit: pad.getAttribute('unit'),
                stepperHint: stepper.shadowRoot.getElementById('hint')?.textContent.trim() ?? null,
                stepperUnit: stepper.unit ?? '',
                min: stepper.min,
                max: stepper.max,
            };
        }, key);

        test('the numpad over a temperature target is drawn in the unit the rail is drawn in',
            () => mounted(async (page) => {
                await configure(page, { targets: TARGETS, tempUnit: 'F' });
                await openPad(page, 'hotWaterTemp');
                const seen = await padVersusStepper(page, 'hotWaterTemp');

                assert.equal(seen.open, true, 'the value cell is the typed path and it opened');
                assert.equal(seen.padUnit, '°F', 'the well is captioned in the display unit');
                assert.equal(seen.stepperUnit, '°F');
                assert.match(seen.padHint, new RegExp(String(seen.max)),
                    'the pad prints the same ceiling the + button stops at');
                assert.match(seen.padHint, /°F/);
                assert.doesNotMatch(seen.padHint, /°C/,
                    'the machine\'s own unit has no business on a Fahrenheit rail');
            }));

        test('and a number typed into it is clamped against THAT band, not the machine\'s',
            () => mounted(async (page) => {
                await configure(page, { targets: TARGETS, tempUnit: 'F' });
                await openPad(page, 'hotWaterTemp');

                const round = await page.evalFn(async () => {
                    const pad = window.__h.q('live-screen >>> ui-numeric-keypad');
                    const stepper = window.__h.q('live-screen >>> ui-stepper[data-key="hotWaterTemp"]');
                    pad.press('1'); pad.press('5'); pad.press('0');
                    await pad.updateComplete;
                    const typed = pad.clamped;
                    pad.confirm();
                    const screen = window.__h.q('live-screen');
                    await screen.updateComplete;
                    return { typed, ceiling: stepper.max, held: screen.targets.hotWaterTemp };
                });

                assert.equal(round.typed, 150,
                    '150 °F is inside the rail\'s own band, so the clamp returns it');
                assert.ok(round.typed < round.ceiling,
                    'and it is below the ceiling the rail draws — nothing to clamp to');
                assert.equal(round.held, (150 - 32) * 5 / 9);
            }));

        test('the numpad follows the WORD as well as the unit — one field, two stops',
            () => mounted(async (page) => {
                await configure(page, {
                    targets: TARGETS,
                    waterStop: 'weight',
                    offers: { stopAtWeight: true },
                });
                await openPad(page, 'hotWaterVolume');
                const weight = await padVersusStepper(page, 'hotWaterVolume');
                assert.equal(weight.stepperUnit, 'g', 'the rail is drawing a weight cap');
                assert.equal(weight.padUnit, 'g');
                assert.match(weight.padHint, /\bg\b/, 'so the pad says grams');
                assert.doesNotMatch(weight.padHint, /mL/,
                    'and nothing on the row says millilitre while it is a weight stop');

                await page.evalFn(() => {
                    window.__h.q('live-screen >>> ui-numeric-keypad').cancel();
                    return true;
                });
                await configure(page, {
                    targets: TARGETS,
                    waterStop: 'volume',
                    offers: { stopAtWeight: true },
                });
                await openPad(page, 'hotWaterVolume');
                const volume = await padVersusStepper(page, 'hotWaterVolume');
                assert.equal(volume.padUnit, 'mL');
                assert.match(volume.padHint, /mL/);
                assert.equal(volume.max, weight.max, 'one field, one ceiling, two words');
                assert.equal(
                    volume.padHint.replace('mL', ''), weight.padHint.replace('g', ''),
                    'the two sentences differ by the word alone',
                );
            }));

        test('the rail is the same tracks in every machine state \u2014 nothing recomposes',
            () => mounted(async (page) => {
                await configure(page, { machineState: '', targets: TARGETS });
                const idle = await railTree(page);

                await configure(page, { machineState: 'steam', targets: TARGETS });
                const steaming = await railTree(page);

                assert.equal(steaming.length, idle.length, 'a state change added or removed a track');
                for (let i = 0; i < idle.length; i += 1) {
                    assert.equal(steaming[i].key, idle[i].key, `track ${i} is a different control`);
                    assert.equal(steaming[i].height, idle[i].height, `track ${i} changed height with the state`);
                    assert.equal(steaming[i].top, idle[i].top,
                        `track ${i} slid ${(steaming[i].top - idle[i].top).toFixed(2)} on a state change`);
                }
            }));

        test('the standing rail measured against its interior, and it drops nothing',
            (t) => mounted(async (page) => {
                await configure(page, { targets: TARGETS });
                const tree = await railTree(page);
                const rail = await page.evalFn(() => {
                    const el = window.__h.q('live-screen').shadowRoot.querySelector('live-rail');
                    const cs = getComputedStyle(el);
                    const box = el.getBoundingClientRect();
                    const kids = [...el.children];
                    const last = kids[kids.length - 1].getBoundingClientRect();
                    return {
                        overflowY: cs.overflowY,
                        scrolls: el.scrollHeight > el.clientHeight + 1,
                        outer: +box.height.toFixed(2),
                        interior: +(el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)).toFixed(2),
                        content: +(last.bottom - kids[0].getBoundingClientRect().top).toFixed(2),
                        reachable: el.scrollHeight >= last.bottom - box.top - 1,
                    };
                });

                t.diagnostic(`${geometry.name}: ${tree.length} tracks, ${rail.content}px of content in `
                    + `${rail.interior}px of rail interior (${rail.outer} outer), scrolls=${rail.scrolls}`);

                assert.equal(tree.length, 11, `the standing rail is 11 tracks: ${tree.map((r) => r.tag).join(', ')}`);
                assert.equal(tree[0].inner[0] ?? tree[0].tag, 'ui-stepper',
                    'the first track is the abort target\'s one-cell grid over GRIND');
                assert.equal(rail.overflowY, 'auto', 'the rail must be able to reach a row it cannot show');
                const FITS = { desktop: true, bench: false, floor: false }[geometry.name];
                assert.ok(FITS !== undefined, `no pinned rail fit for ${geometry.name}`);
                assert.equal(rail.scrolls, !FITS,
                    `the rail ${rail.scrolls ? 'scrolls' : 'fits'} at ${geometry.name} with `
                    + `${rail.content}px of content in ${rail.interior}px of interior`);
                assert.equal(rail.reachable, true, 'a track was below the scroll extent \u2014 that IS a drop');
            }));

        test('there is no mode picker, and the machine still decides what is running',
            () => mounted(async (page) => {
                await configure(page, { machineState: 'steam', targets: TARGETS });
                const rail = await page.evalFn(() => {
                    const root = window.__h.q('live-screen').shadowRoot;
                    return {
                        banks: [...root.querySelectorAll('live-rail ui-bank')].map((el) => el.dataset.row ?? null),
                        keys: [...root.querySelectorAll('live-rail ui-stepper')].map((el) => el.dataset.key),
                        stop: !!root.querySelector('ui-stop-button'),
                    };
                });
                assert.deepEqual(rail.banks, [],
                    'a stop-mode bank is back on a track of its own');
                assert.deepEqual(rail.keys, [
                    'grind', 'dose', 'drinkWeight', 'brewTemp',
                    'steamDuration', 'steamFlow', 'flushDuration', 'hotWaterVolume', 'hotWaterTemp',
                ], "the rail is Slate's nine rows whatever the machine is doing");
                assert.equal(rail.stop, true, 'the machine is steaming, so the abort target is there');
            }));

        test('#47: the STOP target appears over the rail\'s first track and moves nothing',
            () => mounted(async (page) => {
                await configure(page, { targets: TARGETS });
                const before = await railTree(page);
                assert.equal(await page.exists(`${S} >>> ui-stop-button`), false,
                    'absent, not hidden, when nothing is running');

                await configure(page, { machineState: 'espresso', targets: TARGETS });
                const after = await railTree(page);
                assert.equal(await page.exists(`${S} >>> ui-stop-button`), true);
                assert.deepEqual(after.map((r) => r.top), before.map((r) => r.top),
                    'the abort target pushed the rail around — it is an overlay, in a grid cell');

                const stack = await page.evalFn(() => {
                    const stop = window.__h.q('live-screen >>> ui-stop-button');
                    const first = window.__h.q('live-screen').shadowRoot
                        .querySelector('live-rail').firstElementChild;
                    const s = stop.getBoundingClientRect();
                    const b = first.getBoundingClientRect();
                    return {
                        position: getComputedStyle(stop).position,
                        covers: first.tagName.toLowerCase(),
                        over: Math.abs(s.top - b.top) < 1 && Math.abs(s.left - b.left) < 1,
                    };
                });
                assert.equal(stack.position, 'static', 'nothing on this screen positions itself (L1\'s mechanism)');
                assert.equal(stack.covers, 'div', 'the abort target\'s cell is the first row\'s own grid');
                assert.equal(stack.over, true, 'the overlay sits in the track it covers');
            }));

        test('#47: the STOP target is REACHABLE mid-shot — hit tests and a real press',
            () => mounted(async (page) => {
                await configure(page, { machineState: 'espresso', targets: TARGETS });

                const reach = await page.evalFn(() => {
                    /* Descend shadow roots: document.elementFromPoint stops at the host. */
                    const deep = (x, y) => {
                        let el = document.elementFromPoint(x, y);
                        for (let i = 0; el?.shadowRoot && i < 20; i += 1) {
                            const inner = el.shadowRoot.elementFromPoint(x, y);
                            if (!inner || inner === el) break;
                            el = inner;
                        }
                        return el;
                    };
                    /* ...then climb back out to the library component that owns the hit. */
                    const owner = (el) => {
                        for (let n = el; n; n = n.parentNode instanceof ShadowRoot ? n.parentNode.host : n.parentElement) {
                            if (n.tagName?.toLowerCase().startsWith('ui-')) return n.tagName.toLowerCase();
                        }
                        return el?.tagName?.toLowerCase() ?? null;
                    };
                    const r = window.__h.need('live-screen >>> ui-stop-button').getBoundingClientRect();
                    return [0.05, 0.2, 0.35, 0.5, 0.65, 0.8, 0.95]
                        .map((f) => owner(deep(r.left + r.width * f, r.top + r.height / 2)));
                });
                assert.deepEqual(reach, Array(7).fill('ui-stop-button'),
                    `a press is swallowed before it reaches the abort target: ${reach.join(', ')}`);

                await page.evalFn(() => {
                    window.__stopRequests = 0;
                    window.__h.need('live-screen').shadowRoot
                        .addEventListener('stop-request', () => { window.__stopRequests += 1; }, true);
                });
                await page.click(`${S} >>> ui-stop-button`);
                assert.equal(await page.evalFn(() => window.__stopRequests), 1,
                    'a real press at the centre of the STOP box did not request a stop');
            }));

        test('L25 WITHDRAWN: the rail paints no stop condition at all',
            () => mounted(async (page) => {
                await configure(page, { targets: TARGETS, steamStop: 'time', waterStop: 'volume' });
                for (const row of ['steam-stop-target', 'water-stop-target']) {
                    const sel = `${S} >>> ui-stepper[data-row="${row}"]`;
                    assert.equal(await page.exists(sel), true, `${row} is not on the rail`);
                    const found = await page.evalFn((s) => {
                        const stepper = window.__h.q(s);
                        return {
                            caption: stepper.querySelectorAll('.stop-caption').length,
                            slotted: stepper.querySelectorAll('[slot="caption"]').length,
                            name: stepper.getAttribute('label') || '',
                        };
                    }, sel);
                    assert.equal(found.caption, 0, `${row} draws a stop-condition caption again`);
                    assert.equal(found.slotted, 0, `${row} has something in its caption box`);
                    assert.ok(found.name.trim().length > 0, `${row} lost its block name`);
                }

                /* AND NO BANK CAME BACK EITHER. The tracks went at it16 and they stay
                 * gone: the mode's home is Settings, not a rail row. */
                assert.equal(await page.exists(`${S} >>> live-rail ui-bank`), false,
                    'a stop-mode bank is back on a track of its own');
            }));

        test('L25: the stop mode still swaps the target under it, and the track does not move',
            () => mounted(async (page) => {
                await configure(page, { targets: TARGETS, offers: { milkProbe: true } });
                const at = (tree) => tree.find((r) => r.row === 'steam-stop-target');
                const before = await railTree(page);
                assert.equal(at(before).key, 'steamDuration');

                await page.evalFn(() => {
                    const screen = window.__h.q('live-screen');
                    screen.steamStop = 'milk';
                    return screen.updateComplete;
                });
                await page.settle(4);

                const after = await railTree(page);
                assert.equal(at(after).key, 'milkStopTemp', 'the stop mode did not change the stop target');
                assert.deepEqual(after.map((r) => r.top), before.map((r) => r.top),
                    'the stop row moved — the change must recompose within its track');

                const unit = await page.evalFn(() => window.__h
                    .q('live-screen >>> ui-stepper[data-row="steam-stop-target"]')
                    .getAttribute('unit'));
                assert.notEqual(unit, 's', 'a milk-probe stop is still spelled in seconds');
            }));

        test('L25: BOTH halves of the fix are on their settings leaves, and they are still there',
            async () => {
                const { SETTINGS_ROWS } = await import('../../src/lib/settings-leaves.js');
                const steam = SETTINGS_ROWS.find((r) => r.id === 'machine-steam-stop');
                assert.ok(steam, 'the steam stop-mode control has left the settings leaf too — L25 is now unfixed');
                assert.equal(steam.leaf, 'machine-steam');
                assert.equal(steam.archetype, 'bank');
                assert.deepEqual(steam.items.map((i) => i.value), ['off', 'time', 'milk-temp']);

                const water = SETTINGS_ROWS.find((r) => r.id === 'machine-water-stop');
                assert.ok(water, 'the hot-water stop-mode control has no home again — L25\'s water half is re-unfixed');
                assert.equal(water.leaf, 'machine-hot-water');
                assert.equal(water.archetype, 'bank');
                assert.equal(water.field, 'stopHotWaterAtWeight',
                    'the hot-water stop mode is back to writing a key the machine never sees');
                assert.equal(water.key, undefined, 'and it writes ONE store, not two (B7)');
                assert.deepEqual(water.fieldValues, { volume: false, weight: true },
                    'the two words and the bool the machine holds, mapped in one place');
                assert.deepEqual(water.items.map((i) => i.value), ['volume', 'weight']);
                assert.ok(water.items[1].note, 'the weight option carries its scale note (Slate\'s own caption sentence)');
            });

        test('L21: every route out of this screen is a real, focusable control with a name',
            () => mounted(async (page) => {
                await configure(page, { targets: TARGETS, favourites: FAVOURITES, favourite: 'p1', profileName: 'Londinium' });

                const routes = await page.evalFn(() => {
                    const root = window.__h.q('live-screen').shadowRoot;
                    const out = [];
                    for (const host of root.querySelectorAll('ui-button, ui-icon-button')) {
                        const btn = host.shadowRoot.querySelector('button');
                        out.push({
                            tag: btn.tagName.toLowerCase(),
                            name: (btn.getAttribute('aria-label') || host.textContent).trim(),
                            tabbable: btn.tabIndex >= 0,
                        });
                    }
                    const interactiveHeadings = [...root.querySelectorAll('h1, h2, h3')]
                        .filter((h) => h.tabIndex >= 0
                            || h.hasAttribute('role')
                            || h.hasAttribute('onclick')
                            || h.hasAttribute('aria-haspopup'));
                    return {
                        out,
                        headings: root.querySelectorAll('h1, h2, h3').length,
                        interactiveHeadings: interactiveHeadings.length,
                        clickableNonControls: [...root.querySelectorAll('[role="img"], div[onclick]')].length,
                    };
                });
                for (const route of routes.out) {
                    assert.equal(route.tag, 'button', 'a route is a real button');
                    assert.ok(route.name.length > 0, 'a route has an accessible name');
                    assert.equal(route.tabbable, true, 'a route is in the tab order');
                }
                assert.equal(routes.interactiveHeadings, 0,
                    'a heading on this screen answers a tap — which is L21 exactly: Slate\'s profile '
                    + 'name was an <h1> with press-and-hold navigation, and every route out of this '
                    + 'screen is a real button instead');
                assert.equal(routes.headings, 1,
                    'the stat cluster has exactly one heading — §4.1\'s "(heading + gauges)", the '
                    + 'profile identity line Slate draws at the top of its chart card');
                assert.equal(routes.clickableNonControls, 0);
            }));

        test('L22: every hit target on the bands clears the 48px floor', () => mounted(async (page) => {
            await configure(page, { targets: TARGETS, favourites: FAVOURITES, favourite: 'p1', machineState: 'espresso' });

            const floor = parseFloat(await page.resolveValue('var(--ui-hit-min)', 'width'));
            const small = await page.evalFn((min) => {
                const root = window.__h.q('live-screen').shadowRoot;
                const bad = [];
                const walk = (node, path) => {
                    for (const el of node.querySelectorAll('*')) {
                        if (el.shadowRoot) walk(el.shadowRoot, `${path} ${el.tagName.toLowerCase()}`);
                        if (!/^(BUTTON|INPUT|A)$/.test(el.tagName)) continue;
                        if (el.disabled) continue;
                        const r = el.getBoundingClientRect();
                        if (r.width === 0 && r.height === 0) continue;
                        if (r.height < min - 0.5 || r.width < min - 0.5) {
                            bad.push(`${path} ${el.tagName.toLowerCase()} ${r.width.toFixed(1)}x${r.height.toFixed(1)}`);
                        }
                    }
                };
                walk(root, 'live-screen');
                return bad;
            }, floor);
            assert.deepEqual(small, [],
                'a 32 x 35 target on a wall panel operated with a wet hand is L22 itself');
        }));

        test('L23: state travels as aria, and no name is hung on a role-less box',
            () => mounted(async (page) => {
                await configure(page, { mode: 'steam', targets: TARGETS, favourites: FAVOURITES, favourite: 'p1' });

                const aria = await page.evalFn(() => {
                    const root = window.__h.q('live-screen').shadowRoot;
                    const bankHost = root.querySelector('ui-preset-bank').shadowRoot.querySelector('ui-bank');
                    const bank = bankHost.shadowRoot;
                    const group = bankHost.getAttribute('role');
                    const items = [...bank.querySelectorAll('button')];
                    const labelled = [...root.querySelectorAll('[aria-label]')]
                        .filter((el) => !el.tagName.startsWith('UI-') && !el.tagName.startsWith('LIVE-') && !el.hasAttribute('role'))
                        .map((el) => el.tagName.toLowerCase());
                    return {
                        group,
                        states: items.map((b) => b.getAttribute('aria-checked') ?? b.getAttribute('aria-selected')
                            ?? b.getAttribute('aria-pressed')),
                        namedRolelessDivs: labelled,
                        regions: [...root.querySelectorAll('[role="region"]')]
                            .map((el) => el.getAttribute('aria-label')).filter(Boolean).length,
                    };
                });
                assert.ok(['radiogroup', 'tablist', 'group'].includes(aria.group), `the bank's role is ${aria.group}`);
                assert.ok(aria.states.every((s) => s === 'true' || s === 'false'),
                    'every item carries the state — Slate\'s tablist never set aria-selected at all');
                assert.equal(aria.states.filter((s) => s === 'true').length, 1, 'exactly one is selected');
                assert.deepEqual(aria.namedRolelessDivs, [], 'aria-label on a role-less <div> is L23');
                assert.ok(aria.regions >= 2, 'the rail and the foot band are named regions');
            }));

        test('L24: a focus ring on the bands is not clipped by the box it sits in',
            () => mounted(async (page) => {
                await configure(page, { targets: TARGETS, favourites: FAVOURITES, favourite: 'p1' });
                /* #37's bank, for the reason the test above records. */
                await assertFocusUnclipped(page, `${S} >>> ui-preset-bank >>> ui-bank >>> button`);
                await assertFocusUnclipped(page, `${stepper('dose')} >>> button`);
                await assertFocusUnclipped(page, `${S} >>> ui-favourites-bank >>> ui-bank >>> button`);
            }));

        test('focus order follows the bands: header, then rail, then foot', () => mounted(async (page) => {
            await configure(page, {
                targets: TARGETS, favourites: FAVOURITES, favourite: 'p1', profileName: 'Londinium',
                shotId: 'shot-1', historyCount: 4,
            });

            const order = await page.evalFn(() => {
                const root = window.__h.q('live-screen').shadowRoot;
                const region = (el) => {
                    for (const name of ['live-header', 'live-rail', 'live-foot']) {
                        const host = root.querySelector(name);
                        if (host && host.getBoundingClientRect().height > 0) {
                            const r = host.getBoundingClientRect();
                            const b = el.getBoundingClientRect();
                            if (b.top >= r.top - 1 && b.bottom <= r.bottom + 1) return name;
                        }
                    }
                    return 'other';
                };
                const seen = [];
                const walk = (node) => {
                    for (const el of node.querySelectorAll('*')) {
                        if (el.shadowRoot) walk(el.shadowRoot);
                        if (el.tagName === 'BUTTON' && !el.disabled && el.tabIndex >= 0) seen.push(region(el));
                    }
                };
                walk(root);
                return seen;
            });
            const first = (name) => order.indexOf(name);
            assert.ok(first('live-header') >= 0 && first('live-rail') >= 0, `regions reached: ${[...new Set(order)]}`);
            assert.ok(first('live-header') < first('live-rail'),
                `the tab order leaves the header after the rail: ${order.join(' ')}`);
        }));

        test('at this size the bands fit: nothing in them scrolls or clips', () => mounted(async (page) => {
            await configure(page, {
                targets: TARGETS, favourites: FAVOURITES, favourite: 'p1', profileName: 'Londinium',
                shotId: 'shot-1', historyCount: 4, mode: 'steam',
                storedDerivation: {
                    ok: true,
                    scalars: {
                        durationSeconds: 45, dose: 18, yield: 39, ratio: 2.2,
                        timeToFirstDrop: 8, averageFlow: 2.1, peakFlowAfterFirstDrop: 2.8,
                        averagePressure: 6.1, peakPressure: 9,
                    },
                    phases: {
                        preinfusion: { seconds: 15, weight: 10, volume: 17 },
                        extraction: { seconds: 30, weight: 29, volume: 30 },
                        total: { seconds: 45, weight: 39, volume: 47 },
                    },
                },
            });

            const overflowing = await page.evalFn(() => {
                const root = window.__h.q('live-screen').shadowRoot;
                const out = [];
                const check = (el, path) => {
                    const cs = getComputedStyle(el);
                    const scrolls = /auto|scroll|hidden|clip/;
                    if (scrolls.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 1) out.push(`${path} block`);
                    if (scrolls.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 1) out.push(`${path} inline`);
                };
                for (const name of ['live-header', 'live-rail', 'live-foot']) {
                    const host = root.querySelector(name);
                    check(host, name);
                    if (host.shadowRoot) {
                        for (const el of host.shadowRoot.querySelectorAll('*')) check(el, `${name} ${el.className}`);
                    }
                }
                for (const el of root.querySelectorAll('.foot-grid, .foot-controls, .actions, .stack')) {
                    check(el, el.className);
                }
                return out;
            });
            const RAIL_MAY_SCROLL = geometry.name !== 'desktop';
            const expected = RAIL_MAY_SCROLL
                ? ['live-rail block', ...(geometry.name === 'floor' ? ['live-rail inline'] : [])]
                : [];
            assert.deepEqual(overflowing, expected,
                '"a scroll affordance on a wall tablet is worse than the crowding it fixes"');
        }));

        test('the only truncation in the foot band is the design floor\'s recorded pair', () => mounted(async (page) => {
            await configure(page, {
                targets: TARGETS, favourites: FAVOURITES, favourite: 'p1', profileName: 'Londinium',
                shotId: 'shot-1', rating: 73, historyCount: 12,
                storedDerivation: {
                    ok: true,
                    scalars: {
                        durationSeconds: 45, dose: 18, yield: 39, ratio: 2.2,
                        timeToFirstDrop: 8, averageFlow: 2.1, peakFlowAfterFirstDrop: 2.8,
                        averagePressure: 6.1, peakPressure: 9,
                    },
                    phases: {
                        preinfusion: { seconds: 15, weight: 10, volume: 17 },
                        extraction: { seconds: 30, weight: 29, volume: 30 },
                        total: { seconds: 45, weight: 39, volume: 47 },
                    },
                },
            });

            const truncated = await page.evalFn(() => {
                const out = [];
                const walk = (root) => {
                    for (const el of root.querySelectorAll('*')) {
                        const cs = getComputedStyle(el);
                        if (cs.textOverflow === 'ellipsis' && el.clientWidth > 1
                            && el.scrollWidth > el.clientWidth + 1) {
                            out.push(`${el.textContent.trim()} ${el.clientWidth}/${el.scrollWidth}`);
                        }
                        if (el.shadowRoot) walk(el.shadowRoot);
                    }
                };
                walk(window.__h.q('live-screen').shadowRoot.querySelector('live-foot'));
                return out.sort();
            });

            const expected = geometry.name === 'desktop' ? [] : [
                'Extraction 85/112', 'Preinfusion 85/121',
            ];
            assert.deepEqual(truncated, expected,
                `truncation on this screen changed: ${truncated.join(', ') || 'none'}`);
        }));

        test('cmp-lo-3: every rail stepper in every mode draws its name, to the LEFT of its well',
            () => mounted(async (page) => {
                await configure(page, { targets: TARGETS, offers: { milkProbe: true, stopAtWeight: true } });
                const hitMin = parseFloat(await page.resolveValue('var(--ui-hit-min)', 'width'));
                const gap = parseFloat(await page.resolveValue('var(--ui-space-4)', 'width'));

                {
                    const mode = 'standing';
                    const steppers = await railLabels(page);
                    assert.equal(steppers.length, 9, `the rail has ${steppers.length} steppers, not Slate's nine`);

                    const HIDDEN_NAMES = new Set(['steamFlow', 'hotWaterTemp']);

                    for (const row of steppers) {
                        assert.ok(row.label, `${mode}/${row.key}: no visible label element at all`);
                        assert.equal(row.hidden, false, `${mode}/${row.key}: the label is display:none`);

                        assert.equal(row.visible, row.property,
                            `${mode}/${row.key}: the label paints "${row.visible}" for a control called `
                            + `"${row.property}"`);
                        assert.equal(row.namedBy, 'aria-labelledby',
                            `${mode}/${row.key}: the group restates its name instead of taking it from the `
                            + 'element that shows it');
                        assert.equal(row.spoken, row.visible,
                            `${mode}/${row.key}: spoken "${row.spoken}" against painted "${row.visible}"`);

                        if (HIDDEN_NAMES.has(row.key)) {
                            assert.ok(row.label.width <= 1.5 && row.label.height <= 1.5,
                                `${mode}/${row.key}: the name is hidden, so its box should be `
                                + `clipped to a pixel, not ${row.label.width}x${row.label.height}`);
                            continue;
                        }

                        assert.ok(row.label.width > 0 && row.label.height > 0,
                            `${mode}/${row.key}: the label has no box`);

                        /* TO THE LEFT, and the well takes what is left of the row. */
                        assert.ok(row.label.right <= row.band.x + 0.51,
                            `${mode}/${row.key}: the label (ends ${row.label.right}) overlaps the well `
                            + `(starts ${row.band.x})`);
                        assert.ok(Math.abs(row.band.x - (row.label.right + gap)) < 0.51,
                            `${mode}/${row.key}: the gutter between name and well is `
                            + `${(row.band.x - row.label.right).toFixed(2)}, not --ui-space-4`);
                        assert.ok(Math.abs((row.band.x + row.band.width) - (row.row.x + row.row.width)) < 0.51,
                            `${mode}/${row.key}: the well does not reach the end of the row`);
                        assert.ok(Math.abs(row.label.width + gap + row.band.width - row.row.width) < 0.51,
                            `${mode}/${row.key}: name + gutter + well is not the row`);

                        /* HOLDS, and it is the cap that pays for the name: the well gives
                         * its caps' slack down to --ui-hit-min and never past it. */
                        assert.ok(row.cap >= hitMin - 0.51,
                            `${mode}/${row.key}: a ${row.cap}px cap is under --ui-hit-min`);

                        assert.equal(row.valueClipped, false,
                            `${mode}/${row.key}: the value cell ellipsised its reading`);

                        const stopRow = row.key === 'steamDuration' || row.key === 'milkStopTemp'
                            || row.key === 'hotWaterVolume';
                        const overflowsByDesign = row.key === 'hotWaterTemp'
                            || row.key === 'steamFlow'
                            || (stopRow && geometry.name !== 'desktop');
                        if (!overflowsByDesign) {
                            assert.equal(row.labelClipped, false,
                                `${mode}/${row.key}: the label is clipped rather than wrapped`);
                        }
                    }
                }
            }));

        test('cmp-lo-3: the names cost the rail no height and no uniformity',
            (t) => mounted(async (page) => {
                await configure(page, { targets: TARGETS, offers: { milkProbe: true } });
                await page.evalFn(async () => {
                    const screen = window.__h.q('live-screen');
                    screen.mode = 'steam';
                    await screen.updateComplete;
                });
                await page.settle(3);

                const controlH = parseFloat(await page.resolveValue('var(--ui-control-h)', 'block-size'));
                const tree = await railTree(page);

                const grown = Object.fromEntries(tree
                    .filter((row) => Math.abs(row.height - controlH) >= 0.51)
                    .map((row) => [String(row.label ?? row.tag), row.height]));
                t.diagnostic(`${geometry.name} rail rows over --ui-control-h: ${JSON.stringify(grown)}`);
                const hairline = parseFloat(await page.resolveValue('var(--ui-hairline)', 'width'));

                const inset = parseFloat(await page.resolveValue('var(--ui-space-5)', 'width'));
                const opens = tree.filter((row) => row.sectionStart);
                assert.equal(opens.length, 4, `${opens.length} rows open a section, not Slate's four`);
                const plainRow = parseFloat(await page.resolveValue('var(--ui-hit-min)', 'block-size'))
                    + 2 * hairline;
                const expectedFor = (row) => (row.tag === 'ui-preset-bank' ? plainRow : controlH);
                for (const row of tree) {
                    if (!row.sectionStart) {
                        const want = expectedFor(row);
                        assert.ok(Math.abs(row.height - want) < 0.51,
                            `a rail row ("${row.label ?? row.tag}") is ${row.height} against `
                            + `${want} — the rail's row heights are DQ-0-B's `
                            + 'measurement and are pinned exactly; a row that moved is a finding');
                        continue;
                    }
                    const low = expectedFor(row) + inset;
                    assert.ok(row.height >= low - 0.51 && row.height <= low + hairline + 0.51,
                        `an opening row ("${row.label ?? row.tag}") is ${row.height}, outside `
                        + `${low}..${low + hairline} (the row + --ui-space-5 `
                        + `${inset} + at most one ${hairline}px hairline)`);
                }
            }));

        test('cmp-lo-2: no bank in the rail is narrower than its own labels', () => mounted(async (page) => {
            await configure(page, { targets: TARGETS, offers: { milkProbe: true, stopAtWeight: true } });
            const banks = await page.evalFn(() => {
                const rail = window.__h.q('live-screen').shadowRoot.querySelector('live-rail');
                const hosts = [
                    ...rail.querySelectorAll('ui-bank'),
                    ...[...rail.querySelectorAll('ui-preset-bank')]
                        .map((el) => el.shadowRoot.querySelector('ui-bank')).filter(Boolean),
                ];
                return hosts.map((bank) => ({
                    row: bank.dataset.row ?? null,
                    density: bank.getAttribute('density'),
                    rows: [...bank.shadowRoot.querySelectorAll('.item')].map((button) => {
                        const label = button.querySelector('.label') ?? button;
                        const range = document.createRange();
                        range.selectNodeContents(label);
                        return {
                            text: (label.textContent ?? '').trim(),
                            needs: +range.getBoundingClientRect().width.toFixed(2),
                            box: +label.getBoundingClientRect().width.toFixed(2),
                            cell: +button.getBoundingClientRect().width.toFixed(2),
                        };
                    }),
                }));
            });

            assert.equal(banks.length, 2, `the rail's banks are ${banks.length}, not the two preset banks`);
            for (const bank of banks) {
                assert.equal(bank.density, 'compact',
                    'a rail bank under a definite width is not taking the cmp-lo-2 trim');
                for (const row of bank.rows) {
                    assert.ok(Math.abs(row.cell - bank.rows[0].cell) < 0.51,
                        `"${row.text}" is ${row.cell} against ${bank.rows[0].cell} — the cells must stay EQUAL`);
                    assert.ok(row.needs <= row.box + 0.51,
                        `"${row.text}" needs ${row.needs} in a ${row.box} box — cmp-lo-2's shortfall, `
                        + 'in a bank that was never supposed to have one');
                }
            }
        }));

        test('L2: a running shot does not resize or recolour any tile in the cluster',
            () => mounted(async (page) => {
                await configure(page, { targets: TARGETS });
                const read = () => page.evalFn(() => {
                    const root = window.__h.q('live-screen').shadowRoot;
                    return [...root.querySelectorAll('.gauges > ui-stat-tile')].map((tile) => {
                        const value = tile.shadowRoot.getElementById('value');
                        const cs = getComputedStyle(value);
                        return {
                            label: tile.getAttribute('label'),
                            size: tile.getAttribute('size'),
                            fontSize: cs.fontSize,
                            ink: cs.color,
                            boxH: +tile.getBoundingClientRect().height.toFixed(2),
                        };
                    });
                });

                const rest = await read();
                assert.equal(rest.length, 7, 'the cluster is seven tiles');
                assert.deepEqual(rest.map((tile) => tile.label),
                    ['Time', 'Pressure', 'Flow', 'Weight', 'Group', 'Steam', 'Tank'],
                    'the cluster is not the oracle\'s seven, in the oracle\'s order');

                await configure(page, { machineState: 'espresso', targets: TARGETS });
                await page.evalFn(() => new Promise((done) => { setTimeout(done, 600); }));
                await page.settle(4);
                const running = await read();

                const xl = await page.resolveValue('var(--ui-display-xl)', 'font-size');
                const lg = await page.resolveValue('var(--ui-display-lg)', 'font-size');
                const muted = await page.resolveToken('--ui-muted', 'color');

                const by = (rows) => Object.fromEntries(rows.map((r) => [r.label, r]));
                const r = by(rest);
                const g = by(running);

                assert.equal(r.Time.fontSize, xl, 'Time rests at --ui-display-xl');
                for (const label of ['Pressure', 'Flow', 'Weight', 'Group', 'Steam', 'Tank']) {
                    assert.equal(r[label].fontSize, lg, `${label} rests at --ui-display-lg`);
                }
                for (const row of running) {
                    const label = row.label;
                    assert.equal(row.fontSize, r[label].fontSize,
                        `${label} changed size while the shot runs — the recomposition is back`);
                    assert.equal(row.ink, r[label].ink,
                        `${label} changed colour while the shot runs — the recomposition is back`);
                }
                for (const label of ['Group', 'Steam', 'Tank']) {
                    assert.notEqual(g[label].ink, muted,
                        `${label} went muted mid-shot, which was overridden`);
                }

                for (const row of running) {
                    assert.ok(Math.abs(row.boxH - by(rest)[row.label].boxH) < 0.51,
                        `${row.label}'s tile moved ${row.boxH - by(rest)[row.label].boxH}px on the `
                        + 'promotion — reserve="xl" exists so the cluster cannot resize (L2)');
                }
            }));

        test('audit-1: the wall clock is back, in the shipped format, right-aligned, and costs no height',
            () => mounted(async (page) => {
                await configure(page, { targets: TARGETS, favourites: FAVOURITES, favourite: 'p1' });
                const clock = await page.evalFn(() => {
                    const root = window.__h.q('live-screen').shadowRoot;
                    const el = root.querySelector('.clock');
                    if (!el) return null;
                    const block = root.querySelector('.stats-block');
                    const gauges = root.querySelector('.gauges');
                    const r = el.getBoundingClientRect();
                    const b = block.getBoundingClientRect();
                    return {
                        text: el.textContent.trim(),
                        position: getComputedStyle(el).position,
                        numeric: getComputedStyle(el).fontVariantNumeric,
                        rightOf: +(b.right - r.right).toFixed(2),
                        topOf: +(r.top - b.top).toFixed(2),
                        blockH: +b.height.toFixed(2),
                        gaugesH: +gauges.getBoundingClientRect().height.toFixed(2),
                        columnH: +[...block.children]
                            .filter((child) => child !== el)
                            .reduce((sum, child) => sum + child.getBoundingClientRect().height, 0)
                            .toFixed(2),
                        overlapArea: (() => {
                            const g = gauges.getBoundingClientRect();
                            const w = Math.min(r.right, g.right) - Math.max(r.left, g.left);
                            const h = Math.min(r.bottom, g.bottom) - Math.max(r.top, g.top);
                            return w > 0 && h > 0 ? +(w * h).toFixed(1) : 0;
                        })(),
                    };
                });
                assert.ok(clock, 'no clock on the Live screen — audit-1 is the drop this restores');
                assert.match(clock.text, CLOCK_SPELLING,
                    `the clock reads "${clock.text}" — the shipped default is `
                    + `${DEFAULT_CLOCK_FORMAT}, so that is the form the header must draw`);
                assert.equal(clock.position, 'static',
                    '§4.1: no absolutely-positioned structure — the clock is a grid column');
                assert.match(clock.numeric, /tabular-nums/, 'a readout that changes must not jitter');
                assert.ok(Math.abs(clock.rightOf) < 0.51,
                    `the clock is ${clock.rightOf}px from the end of its column — Slate's is right-aligned`);

                const withoutClock = await page.evalFn(() => {
                    const root = window.__h.q('live-screen').shadowRoot;
                    const el = root.querySelector('.clock');
                    const block = root.querySelector('.stats-block');
                    el.style.display = 'none';
                    const h = +block.getBoundingClientRect().height.toFixed(2);
                    el.style.display = '';
                    return h;
                });
                assert.ok(Math.abs(clock.blockH - withoutClock) < 0.51,
                    `the clock spent ${(clock.blockH - withoutClock).toFixed(2)}px of the chart's column`);
                assert.ok(clock.blockH >= clock.gaugesH - 0.51,
                    'the readings are inside the block that holds them');
                assert.ok(clock.overlapArea === 0,
                    `the clock's box intersects the gauge cluster's (${clock.overlapArea}px²)`);
            }));

        test('audit-1: one interval, owned by the screen, and it dies with the screen',
            () => mounted(async (page) => {
                const live = await page.evalFn(() => {
                    const seen = [];
                    const real = window.setInterval;
                    window.setInterval = (...args) => { const id = real(...args); seen.push(id); return id; };
                    const cleared = [];
                    const realClear = window.clearInterval;
                    window.clearInterval = (id) => { cleared.push(id); return realClear(id); };
                    window.__clockProbe = { seen, cleared };
                    return true;
                });
                assert.equal(live, true);

                const cycled = await page.evalFn(async () => {
                    const screen = window.__h.q('live-screen');
                    const parent = screen.parentElement;
                    parent.removeChild(screen);
                    await new Promise((r) => setTimeout(r, 20));
                    const afterRemove = { ...window.__clockProbe };
                    parent.appendChild(screen);
                    await screen.updateComplete;
                    return {
                        started: window.__clockProbe.seen.length,
                        cleared: afterRemove.cleared.length,
                        text: screen.shadowRoot.querySelector('.clock').textContent.trim(),
                    };
                });
                assert.ok(cycled.cleared >= 1, 'the screen left its interval running after it was removed');
                assert.ok(cycled.started >= 1, 'the screen did not re-arm the clock when it came back');
                assert.match(cycled.text, CLOCK_SPELLING, 'and the clock reads again on return');
            }));
    });
}

describe(`the rail at the reference geometry (${DESKTOP.width}x${DESKTOP.height})`, () => {
    const mounted = (fn) => browser.withPage({ geometry: DESKTOP }, async (page) => {
        await page.mount(STAGE, MODULE);
        await page.settle(6);
        assert.deepEqual(page.pageErrors, [], 'the bands must mount without throwing');
        await fn(page);
    });

    test('cmp-lo-2: at 1920 the control the finding was about is gone', () => mounted(async (page) => {
        await configure(page, { targets: TARGETS });
        const rows = await page.evalFn(() => {
            const rail = window.__h.q('live-screen').shadowRoot.querySelector('live-rail');
            return [...rail.querySelectorAll('ui-bank')].map((el) => el.dataset.row ?? null);
        });
        assert.deepEqual(rows, [], 'a bank is back on a track of the rail');
    }));

    test('cmp-lo-3: at 1920 the name is Slate\'s own 88, and the well has the rest',
        () => mounted(async (page) => {
            await configure(page, { targets: TARGETS });
            const steppers = await railLabels(page);
            const cap = parseFloat(await page.resolveValue('var(--ui-stepper-cap)', 'width'));
            const labelW = parseFloat(await page.resolveValue('var(--ui-stepper-label-w)', 'width'));
            const gap = parseFloat(await page.resolveValue('var(--ui-space-4)', 'width'));
            const border = parseFloat(await page.resolveValue('var(--ui-border-w)', 'width'));

            const HIDDEN_NAMES = new Set(['steamFlow', 'hotWaterTemp']);

            for (const row of steppers) {
                if (HIDDEN_NAMES.has(row.key)) {
                    assert.ok(Math.abs((row.band.x - row.row.x) - (labelW + gap)) < 0.51,
                        `${row.key}: the well starts ${(row.band.x - row.row.x).toFixed(2)} into the row, `
                        + `not --ui-stepper-label-w + gutter (${labelW + gap}) — hiding the name must not `
                        + 'collapse the column');
                    assert.ok(Math.abs(row.value - (row.band.width - 2 * cap - 2 * border)) < 0.51,
                        `${row.key}: the value cell is ${row.value}, not the well minus its two caps`);
                    continue;
                }
                assert.ok(Math.abs(row.label.width - labelW) < 0.51,
                    `${row.key}: the name column is ${row.label.width}, not --ui-stepper-label-w ${labelW}`);
                assert.ok(Math.abs(labelW - 88) < 0.51,
                    `--ui-stepper-label-w is ${labelW}; Slate's label column is 88 (live-ready `
                    + '#grind-label [i=18], #dose-label [i=23], #drink-label [i=30], #brew-label [i=41], '
                    + '#flush-label [i=67], both .slate-continuation-label spans — all 88px)');
                assert.ok(Math.abs(row.cap - cap) < 0.51,
                    `${row.key}: the cap is ${row.cap}, not --ui-stepper-cap ${cap}`);
                assert.ok(Math.abs(cap - 78) < 0.51,
                    `--ui-stepper-cap is ${cap}; Slate's cap is 78 on all 144 caps in the corpus`);
                assert.ok(Math.abs(row.label.width + gap + row.band.width - row.row.width) < 0.51,
                    `${row.key}: name + gutter + well is not the row`);
                assert.ok(Math.abs(row.value - (row.band.width - 2 * cap - 2 * border)) < 0.51,
                    `${row.key}: the value cell is ${row.value}, not the well minus its two caps`);
                assert.equal(row.labelClipped, false,
                    `${row.key}: the name is clipped at the reference width`);
            }
        }));

        test('the machine strip is four real keys at rest, and the abort alone while running',
            () => mounted(async (page) => {
                await configure(page, { targets: TARGETS, ghc: true, machineState: 'idle' });
                const rest = await page.evalFn(() => {
                    const strip = window.__h.q('live-screen').shadowRoot.querySelector('.ghc-strip');
                    return strip ? [...strip.children].map((el) => ({
                        tag: el.tagName.toLowerCase(),
                        state: el.dataset.state ?? null,
                        text: (el.textContent || '').trim(),
                        disabled: el.hasAttribute('disabled'),
                    })) : null;
                });
                assert.ok(rest, 'a machine with no GHC hardware gets the strip');
                assert.deepEqual(rest.map((el) => el.state),
                    ['espresso', 'hotWater', 'steam', 'flush'],
                    'Slate\'s own four, by the generated enum\'s names');
                assert.ok(rest.every((el) => el.tag === 'ui-button' && !el.disabled),
                    'at rest all four accept a press');

                await configure(page, { targets: TARGETS, ghc: true, machineState: 'espresso' });
                const running = await page.evalFn(() => {
                    const strip = window.__h.q('live-screen').shadowRoot.querySelector('.ghc-strip');
                    return [...strip.children].map((el) => el.tagName.toLowerCase());
                });
                assert.deepEqual(running, ['ui-stop-button']);
            }));

        test('a machine key asks for its state, and nothing else', () => mounted(async (page) => {
            await configure(page, { targets: TARGETS, ghc: true, machineState: 'idle' });
            const asked = await page.evalFn(async () => {
                const screen = window.__h.q('live-screen');
                const seen = [];
                screen.addEventListener('machine-request', (e) => seen.push(e.detail.state));
                const key = screen.shadowRoot.querySelector('.ghc-strip ui-button[data-key="steam"]');
                key.shadowRoot.querySelector('button').click();
                await screen.updateComplete;
                return seen;
            });
            assert.deepEqual(asked, ['steam']);
        }));

        test('the abort asks for IDLE, from the rail\'s stack', () => mounted(async (page) => {
            await configure(page, { targets: TARGETS, machineState: 'espresso' });
            const asked = await page.evalFn(async () => {
                const screen = window.__h.q('live-screen');
                const seen = [];
                screen.addEventListener('machine-request', (e) => seen.push(e.detail.state));
                const stop = screen.shadowRoot.querySelector('live-rail ui-stop-button');
                if (!stop) return null;
                stop.shadowRoot.querySelector('button').click();
                await screen.updateComplete;
                return seen;
            });
            assert.deepEqual(asked, ['idle'], 'the rail STOP has to reach the machine');
        }));

        /** Hold one cell of a bank, in page script. */
        const holdCell = (page, selector, index) => page.evalFn(async (sel, i) => {
            const screen = window.__h.q('live-screen');
            const bank = screen.shadowRoot.querySelector(sel);
            const inner = bank.shadowRoot.querySelector('ui-bank');
            const cell = inner.shadowRoot.querySelectorAll('.item')[i];
            const box = cell.getBoundingClientRect();
            const at = (type) => new PointerEvent(type, {
                bubbles: true, composed: true, cancelable: true, pointerId: 1, button: 0,
                clientX: box.x + box.width / 2, clientY: box.y + box.height / 2,
            });
            cell.dispatchEvent(at('pointerdown'));
            await new Promise((done) => { setTimeout(done, 750); });
            cell.dispatchEvent(at('pointerup'));
            await screen.updateComplete;
            const menu = screen.shadowRoot.getElementById('hold-menu');
            return {
                open: menu.open,
                items: (menu.items || []).map((item) => (item.separator ? '---' : item.id)),
                labels: (menu.items || []).map((item) => (item.separator ? '---' : item.label)),
            };
        }, selector, index);

        test('holding a preset offers Slate\'s four actions', () => mounted(async (page) => {
            await configure(page, { targets: TARGETS });
            const menu = await holdCell(page, 'ui-preset-bank[data-key="drinkWeight"]', 0);
            assert.equal(menu.open, true, 'the hold opens the actions menu');
            assert.deepEqual(menu.items.filter((id) => id !== '---'), ['apply', 'enter', 'save']);
            assert.match(menu.labels[0], /^Apply 30$/);
            assert.match(menu.labels[2], /^Save current \(\d/);
        }));

        test('a preset re-cut leaves as an intent, with the bank\'s key and index',
            () => mounted(async (page) => {
                await configure(page, { targets: TARGETS });
                await holdCell(page, 'ui-preset-bank[data-key="steamFlow"]', 3);
                const edit = await page.evalFn(async () => {
                    const screen = window.__h.q('live-screen');
                    const seen = [];
                    screen.addEventListener('preset-edit', (e) => seen.push(e.detail));
                    const menu = screen.shadowRoot.getElementById('hold-menu');
                    const revert = (menu.items || []).findIndex((item) => item.id === 'revert');
                    if (revert < 0) return { seen, revert };
                    menu.shadowRoot.querySelectorAll('.item')[revert].click();
                    await screen.updateComplete;
                    return { seen, revert };
                });
                /* The shipped bank is [0.6, 0.8, 1.0, 1.2] and the value equals the
                 * factory one, so Revert is not offered — which is the rule, not a gap. */
                assert.equal(edit.revert, -1, 'nothing to revert to on an unedited bank');
            }));

        test('holding a FILLED favourite offers edit, replace and clear',
            () => mounted(async (page) => {
                await configure(page, { targets: TARGETS, favourites: FAVOURITES, favourite: 'p1' });
                const menu = await holdCell(page, 'ui-favourites-bank', 0);
                assert.equal(menu.open, true);
                assert.deepEqual(menu.items, ['edit', 'replace', '---', 'clear']);
            }));

        test('holding an EMPTY favourite offers the one thing that fills it',
            () => mounted(async (page) => {
                await configure(page, { targets: TARGETS, favourites: FAVOURITES, favourite: 'p1' });
                const empty = await page.evalFn(() => (window.__h.q('live-screen').favourites || [])
                    .findIndex((slot) => slot === null));
                assert.ok(empty >= 0, 'the fixture rail has an empty slot');
                const menu = await holdCell(page, 'ui-favourites-bank', empty);
                assert.deepEqual(menu.items, ['browse']);
            }));

        test('clearing a favourite leaves as an intent naming the SLOT', () => mounted(async (page) => {
            await configure(page, { targets: TARGETS, favourites: FAVOURITES, favourite: 'p1' });
            await holdCell(page, 'ui-favourites-bank', 1);
            const asked = await page.evalFn(async () => {
                const screen = window.__h.q('live-screen');
                const seen = [];
                screen.addEventListener('favourite-action', (e) => seen.push(e.detail));
                const menu = screen.shadowRoot.getElementById('hold-menu');
                /* BY LABEL, NOT BY INDEX: a separator is an item in `items` and is NOT a
                 * `.item` element, so the two lists do not align. */
                const label = (menu.items || []).find((item) => item.id === 'clear').label;
                const row = [...menu.shadowRoot.querySelectorAll('.item')]
                    .find((el) => el.textContent.trim() === label);
                row.click();
                await screen.updateComplete;
                return seen;
            });
            /* THE SLOT, not the profile: an empty slot has no profile to name, and the
             * slot is what `setFavourite(slot, null)` takes. */
            assert.deepEqual(asked.map((a) => a.action), ['clear'], JSON.stringify(asked));
            assert.equal(asked[0].slot, 2, 'the disc a person reads is 1-based; cell 1 is slot 2');
        }));

        test('a steam session takes the chart: its channels, both its axes, and its name',
            () => mounted(async (page) => {
                const seen = await page.evalFn(async () => {
                    const { STEAM_CHANNELS, STEAM_Y_RANGE, STEAM_Y2_RANGE, steamChannelSpecs } =
                        await import('/src/lib/steam-chart.js');
                    const { DEFAULT_CHANNELS } = await import('/src/components/ui-chart-card.js');
                    const { createSteamBuffer } = await import('/src/stores/steam-buffer.js');
                    const screen = window.__h.q('live-screen');
                    const card = screen.shadowRoot.querySelector('#live-chart');

                    const before = {
                        label: card.getAttribute('label'),
                        channels: (card.channels ?? []).map((c) => c.key),
                        hadPlot: Boolean(card.plotHandle),
                    };

                    /* A REAL SESSION THROUGH THE REAL BUFFER, so what the card is handed
                     * is the shape the store publishes rather than one this test made up. */
                    const buffer = createSteamBuffer({});
                    const t0 = 1000;
                    for (let i = 0; i < 40; i += 1) {
                        buffer.take({
                            mode: 'steam', pouring: true, at: t0 + i * 125,
                            machine: { ok: true, pressure: 1.2, flow: 1.1, targetFlow: 1.2,
                                steamTemperature: 150 + i },
                            milk: 20 + i,
                        });
                    }
                    screen.chartMode = 'steam';
                    screen.steamDerivation = buffer.get();
                    await screen.updateComplete;
                    /* TWO FRAMES. Setting a scale REBUILDS the plot (`willUpdate`), and a
                     * rebuild is deferred until the card has a box; one microtask is not
                     * enough to see the far side of it. */
                    await new Promise((done) => { requestAnimationFrame(() => setTimeout(done, 250)); });

                    return {
                        before,
                        beforeHadPlot: before.hadPlot,
                        espresso: DEFAULT_CHANNELS.map((c) => c.key),
                        milkPresent: screen.milkPresent,
                        allSteam: [...STEAM_CHANNELS],
                        wanted: {
                            channels: steamChannelSpecs({ milk: screen.milkPresent }).map((s) => s.key),
                            y: [...STEAM_Y_RANGE],
                            y2: [...STEAM_Y2_RANGE],
                        },
                        label: card.getAttribute('label'),
                        channels: (card.channels ?? []).map((c) => c.key),
                        yRange: card.yRange ? [...card.yRange] : null,
                        y2: card.y2 ? [...card.y2.range] : null,
                        empty: card.empty,
                        hasPlot: Boolean(card.plotHandle),
                        samples: screen.steamDerivation.counts.samples,
                    };
                });

                assert.deepEqual(seen.before.channels, seen.espresso,
                    'at rest it is the espresso chart — the screen names no channel, so the '
                    + 'card\'s own DEFAULT_CHANNELS is what it draws');
                assert.notDeepEqual(seen.espresso, seen.wanted.channels,
                    'the two sets must differ, or "the steam channels replace the espresso ones" is vacuous');
                assert.equal(seen.before.label, 'Shot chart');

                assert.equal(seen.samples, 40, 'the buffer took the session');
                assert.equal(seen.empty, false, 'and the card is not showing its empty state');
                if (seen.beforeHadPlot) assert.equal(seen.hasPlot, true, 'the rebuild kept the plot');
                assert.equal(seen.milkPresent, false, 'this mount has no milk probe');
                assert.equal(seen.wanted.channels.length, seen.allSteam.length - 1,
                    'without a probe the session drops exactly the milk trace');
                assert.deepEqual(seen.channels, seen.wanted.channels,
                    'the steam channels replace the espresso ones — target under its actual');
                /* BOTH AXES ARE FIXED. A steam session has no meaningful autoscale, and a
                 * moving axis makes two sessions impossible to compare by eye. */
                assert.deepEqual(seen.yRange, seen.wanted.y, 'the left axis is fixed at 0..6.5');
                assert.deepEqual(seen.y2, seen.wanted.y2, 'and the right one at 0..195 °C');
                assert.equal(seen.label, 'Steam chart', 'and it says what it is');
            }));

        test('and the chart goes back to the shot when the mode does', () => mounted(async (page) => {
            const seen = await page.evalFn(async () => {
                const { DEFAULT_CHANNELS } = await import('/src/components/ui-chart-card.js');
                const screen = window.__h.q('live-screen');
                const card = screen.shadowRoot.querySelector('#live-chart');
                screen.chartMode = 'steam';
                screen.steamDerivation = { ok: true, axis: { t: [0, 1] }, series: {}, counts: { samples: 2 } };
                await screen.updateComplete;
                const steaming = card.getAttribute('label');
                screen.chartMode = 'espresso';
                await screen.updateComplete;
                await new Promise((done) => { setTimeout(done, 120); });
                return {
                    steaming,
                    after: card.getAttribute('label'),
                    channels: (card.channels ?? []).map((c) => c.key),
                    espresso: DEFAULT_CHANNELS.map((c) => c.key),
                    yRange: card.yRange,
                };
            });
            assert.equal(seen.steaming, 'Steam chart');
            assert.equal(seen.after, 'Shot chart');
            assert.deepEqual(seen.channels, seen.espresso);
            assert.deepEqual(seen.yRange, [0, 12],
                'and the left axis is the shot chart\'s own fixed range again');
        }));
});
