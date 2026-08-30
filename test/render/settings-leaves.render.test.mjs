/**
 * settings-leaves.render.test.mjs — wave 5.4's one-primitive cluster, measured off the
 * engine: `settings-row-thirty-leaves`, `c6-density-type-scale`, `d8-way-out-of-the-skin`,
 * `d11-save-count`, `a11y-cluster-t15`.
 *
 * ONE SUITE, because every claim below is about the same leaf pane holding the same rows,
 * and splitting them would mean mounting the screen six times to ask six questions about
 * one box. The sections are the rows.
 *
 * ENGINE TRUTH ONLY. Nothing here reads a source file (that is
 * `test/settings-leaves.test.mjs`, which asks what a measurement cannot). The rhythm
 * claims are computed rects across DIFFERENT LEAVES rather than one leaf twice — T13 is
 * one leaf out of thirty-seven sitting 12px low, so a suite that only ever renders one
 * leaf could not see it. The accessible names are read off the live elements after the
 * naming ladder has run, not asserted from the markup that was written.
 *
 * BOTH GATE A GEOMETRIES. The leaf pane is the elastic region and it collapses to two
 * columns at the floor, so the same rows are measured in two boxes.
 *
 * THE FIXTURE BUILDS THE DATA LAYER, and it is the same fixture the capture battery
 * drives (`tools/screens/screens.js`, states `settings--leaf-rows` and
 * `settings--dirty-save`): memory-backed storage through the real router and the real
 * settings store, a capability store that has asked nothing (so every gate reads UNKNOWN
 * and every gated row is hidden — the mock's own verdict), the real limits table through
 * the R2 door, and a scripted machine document. A picture nobody asserts and an assertion
 * nobody photographs are the two halves of the same mistake.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';

const MODULES = ['/test/fixtures/settings-shell-fixture.js'];
const STAGE = '<div id="stage" style="inline-size: 100%; block-size: 100dvh"></div>';

const S = 'settings-screen';
const BAND = `${S} >>> #band`;
const LEAF = `${S} >>> #leaf`;
const HEADING = `${S} >>> #leaf >>> #leaf-heading`;
const ROWS = `${S} >>> #leaf >>> ui-settings-row`;
const ROW = (id) => `${S} >>> #leaf >>> ui-settings-row[data-row="${id}"]`;
const LEAF_PANE = `${S} >>> #leaf-pane`;

/** Rendered lengths at dsf 1.5 are not string-comparable; whole CSS px are. */
const near = (got, want, what, tol = 0.51) => assert.ok(
    Math.abs(got - want) <= tol,
    `${what}: expected ${want}, got ${got}`,
);

/** Every row's box and its parts, in DOM order — one round trip per leaf. */
const rowReport = (page) => page.evalFn(() => {
    const leaf = document.querySelector('settings-screen').shadowRoot.getElementById('leaf');
    return [...leaf.shadowRoot.querySelectorAll('ui-settings-row')].map(function (row) {
        const box = row.getBoundingClientRect();
        const label = row.shadowRoot.getElementById('label');
        const control = row.shadowRoot.getElementById('control');
        const slotted = row.control;
        const style = getComputedStyle(row);
        return {
            id: row.dataset.row,
            archetype: row.dataset.archetype,
            staged: row.hasAttribute('data-staged'),
            heading: row.shadowRoot.getElementById('heading')?.textContent.trim() ?? '',
            hint: row.shadowRoot.getElementById('hint')?.textContent.trim() ?? '',
            reading: row.shadowRoot.getElementById('reading')?.textContent.trim() ?? null,
            paddingBlock: style.paddingBlockStart + '/' + style.paddingBlockEnd,
            gap: style.columnGap,
            box: { x: box.x, y: box.y, width: box.width, height: box.height },
            labelBox: label ? label.getBoundingClientRect().width : null,
            controlBox: control
                ? { x: control.getBoundingClientRect().x, right: control.getBoundingClientRect().right }
                : null,
            control: slotted.map(function (el) {
                const r = el.getBoundingClientRect();
                return {
                    tag: el.localName,
                    width: r.width,
                    right: r.right,
                    name: el.label || el.getAttribute('aria-label') || el.textContent.trim(),
                };
            }),
        };
    });
});

/**
 * EVERY SWITCH THE SCREEN CAN SHOW, and its computed accessible name.
 *
 * T15's clause is "four of twenty switches have no accessible name", so the assertion has
 * to be over ALL of them rather than over one leaf's. The walk visits every leaf that
 * carries a switch row, renders it, and reads the name off the live element after #29's
 * naming ladder has run — a label read from the template would prove only that the
 * template was written, not that the name arrived.
 */
const switchWalk = (page) => page.evalFn(async () => {
    const api = window.__settings;
    const nav = await import('/src/lib/settings-nav.js');
    const registry = await import('/src/lib/settings-leaves.js');
    const leaves = [...new Set(registry.SETTINGS_ROWS
        .filter((row) => row.archetype === registry.ARCHETYPE.SWITCH)
        .map((row) => row.leaf))];
    const out = [];
    for (const leafId of leaves) {
        const category = nav.categoryOf(leafId);
        await api.selectCategory(category.id);
        await api.selectLeaf(leafId);
        const leaf = document.querySelector('settings-screen').shadowRoot.getElementById('leaf');
        for (const el of leaf.shadowRoot.querySelectorAll('ui-switch')) {
            out.push({
                leaf: leafId,
                role: el.getAttribute('role') || (el.shadowRoot?.querySelector('[role]')?.getAttribute('role') ?? null),
                name: el.getAttribute('aria-label') || '',
                labelledby: el.getAttribute('aria-labelledby') || '',
            });
        }
    }
    return out;
});

/**
 * EVERY BANK THE SCREEN CAN SHOW, its box INSIDE its row, and whether a finger
 * reaches it. cmp-sm-2's assertion class, and the one this suite did not have.
 *
 * The gap was not that nobody looked at a bank: section 5 below has asserted the
 * display-size bank's four labels since wave 5.4. It read them out of the shadow
 * tree with textContent and drove the choice through the store, so a bank whose host
 * had collapsed to its two hairlines — items overflowing an overflow: hidden box,
 * invisible on the panel and dead to the touch — answered every question this file
 * asked. MEASURED at the freeze: ui-bank inside ui-settings-row computed 2.00px wide
 * with three 36px items (padding only, zero content box), and elementFromPoint at an
 * item centre answered settings-leaf-pane rather than the button.
 *
 * So the walk measures the BOX and the HIT, over every BANK row in the registry
 * rather than over the one leaf a section happens to render — the same reason the
 * switch walk is a walk. The label width comes off a Range over the item's own text
 * (cross-1's pattern): a label that is being ellipsised still LAYS OUT at its full
 * width, so the range says what the cell would need and the cell's content box says
 * what it got, and the two agreeing is "n x the widest item" stated as a number.
 */
const bankWalk = (page) => page.evalFn(async () => {
    const api = window.__settings;
    const nav = await import('/src/lib/settings-nav.js');
    const registry = await import('/src/lib/settings-leaves.js');
    const leaves = [...new Set(registry.SETTINGS_ROWS
        .filter((row) => row.archetype === registry.ARCHETYPE.BANK)
        .map((row) => row.leaf))];

    /* Down through every shadow root under the point, which is what a finger does.
     * document.elementFromPoint alone answers the outermost host and would pass
     * against a control that is not there. */
    const deepFromPoint = (x, y) => {
        let node = document.elementFromPoint(x, y);
        for (let i = 0; i < 16 && node && node.shadowRoot; i += 1) {
            const next = node.shadowRoot.elementFromPoint(x, y);
            if (!next || next === node) break;
            node = next;
        }
        return node;
    };

    /* The laid-out width of an item's text, ellipsis or no ellipsis. Nothing is
     * slotted into a settings bank, so assignedNodes({ flatten: true }) hands back
     * the slot's fallback — the label ui-bank rendered itself. */
    const textWidth = (item) => {
        const label = item.querySelector('.label');
        if (!label) return 0;
        const slot = label.querySelector('slot');
        const nodes = slot ? slot.assignedNodes({ flatten: true }) : [...label.childNodes];
        const range = document.createRange();
        let width = 0;
        for (const node of nodes) {
            if (node.nodeType === Node.TEXT_NODE) {
                range.selectNodeContents(node);
                width += range.getBoundingClientRect().width;
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                width += node.getBoundingClientRect().width;
            }
        }
        return width;
    };

    const out = [];
    for (const leafId of leaves) {
        const category = nav.categoryOf(leafId);
        await api.selectCategory(category.id);
        await api.selectLeaf(leafId);
        const leaf = document.querySelector('settings-screen').shadowRoot.getElementById('leaf');
        for (const bank of leaf.shadowRoot.querySelectorAll('ui-bank')) {
            const row = bank.closest('ui-settings-row');
            /* SCROLL IT INTO VIEW BEFORE MEASURING OR PRESSING. The leaf pane scrolls, and
             * elementFromPoint answers null for a point outside the viewport — so a hit
             * test that does not scroll first is not testing the control, it is testing
             * whether the control happens to fit above the fold.
             *
             * IT STARTED FAILING when the leaf gained a rule and a description under its
             * title (Ben's O5 and O6, 26 August 2026), which pushes every row down by
             * about 45px and put the Steam stop bank below 600 at the floor geometry. The
             * bank did not move within its row and nothing about it changed; the page got
             * taller, which is what was asked for. */
            bank.scrollIntoView({ block: 'center' });
            const rect = bank.getBoundingClientRect();
            const style = getComputedStyle(bank);
            out.push({
                leaf: leafId,
                row: row ? row.dataset.row : null,
                rowBox: row ? { x: row.getBoundingClientRect().x, right: row.getBoundingClientRect().right } : null,
                display: style.display,
                border: parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth),
                width: rect.width,
                height: rect.height,
                scrollWidth: bank.scrollWidth,
                clientWidth: bank.clientWidth,
                items: [...bank.shadowRoot.querySelectorAll('.item')].map((item) => {
                    const r = item.getBoundingClientRect();
                    const cs = getComputedStyle(item);
                    const cx = r.x + r.width / 2;
                    const cy = r.y + r.height / 2;
                    const hit = deepFromPoint(cx, cy);
                    return {
                        label: item.textContent.trim(),
                        width: r.width,
                        height: r.height,
                        padding: parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight),
                        text: textWidth(item),
                        hit: hit ? (item === hit || item.contains(hit)) : false,
                        hitName: hit ? (hit.localName + (hit.id ? '#' + hit.id : '')) : null,
                    };
                }),
            });
        }
    }
    return out;
});

/** The tab order through the populated pane — M9, exercised rather than read. */
const focusWalk = (page, steps) => page.evalFn((n) => {
    const deepActive = () => {
        let el = document.activeElement;
        while (el && el.shadowRoot && el.shadowRoot.activeElement) el = el.shadowRoot.activeElement;
        return el;
    };
    const seen = [];
    for (let i = 0; i < n; i += 1) {
        const el = deepActive();
        seen.push({
            tag: el ? el.localName : null,
            row: el ? (el.closest?.('ui-settings-row')?.dataset.row
                ?? el.getRootNode()?.host?.closest?.('ui-settings-row')?.dataset.row ?? null) : null,
        });
    }
    return seen;
}, steps);

let browser;
/**
 * EVERY CONTROL ON EVERY REGISTRY LEAF, AND WHETHER IT IS INSIDE THE PANE.
 *
 * THE DEFECT THIS EXISTS FOR, measured on 26 August. `connection-machine-host` is the
 * one TEXT row in the registry. ui-settings-row's control track is `flex: none`, so it
 * takes its content's own base size; ui-text-field declares no host block at all and
 * lays out as a block, which contributes ZERO to a shrink-to-fit track. The track
 * computed 0 wide, the field computed 0 wide, and the field's label and input drew at
 * x=1207 with the leaf pane ending at 1281 — a control rendering outside the surface
 * that holds it, on the page whose whole subject is the connection.
 *
 * NOT ONE ASSERTION ABOUT ONE ROW, because the shape is general: any archetype that
 * states no width lands in a zero track, and the registry can grow one at any time.
 * The walk renders every leaf and asks the same question of every control in it.
 *
 * THE PANE, NOT THE VIEWPORT. A control can overflow its pane and still sit inside the
 * window — the ReaPrime field did, by 74px — so a viewport test would have passed
 * through the whole defect. Two CSS px of tolerance for subpixel layout at dsf 1.5.
 */
const controlBounds = (page) => page.evalFn(async () => {
    const api = window.__settings;
    const nav = await import('/src/lib/settings-nav.js');
    const screen = document.querySelector('settings-screen');
    const out = [];
    for (const cat of nav.SETTINGS_TREE) {
        for (const leafNode of cat.leaves) {
            await api.selectCategory(cat.id);
            await api.selectLeaf(leafNode.id);
            const leaf = screen.shadowRoot.getElementById('leaf');
            const pane = screen.shadowRoot.getElementById('leaf-pane');
            const paneBox = pane.getBoundingClientRect();
            for (const row of leaf.shadowRoot.querySelectorAll('ui-settings-row')) {
                for (const el of row.control) {
                    const b = el.getBoundingClientRect();
                    out.push({
                        leaf: leafNode.id,
                        row: row.dataset.row,
                        tag: el.localName,
                        width: b.width,
                        right: b.right,
                        paneRight: paneBox.right,
                        paneLeft: paneBox.left,
                        left: b.left,
                    });
                }
            }
        }
    }
    return out;
});

before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`settings leaves @ ${geometry.name} (${geometry.width}x${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {
        let page;

        before(async () => {
            page = await browser.newPage({ geometry });
            await page.mount(STAGE, MODULES);
            /* `.then(() => true)` because `mount()` resolves with the ELEMENT, and a DOM
             * node cannot cross the CDP boundary by value ('Object reference chain is too
             * long' is what that looks like from here). */
            await page.evalFn(() => window.__settings.mount().then(() => true));
            assert.deepEqual(page.pageErrors, [], 'the screen must mount without throwing');
        });

        after(async () => { await page?.close(); });

        const showLeaf = async (categoryId, leafId) => {
            await page.evalFn(async (c, l) => {
                await window.__settings.selectCategory(c);
                await window.__settings.selectLeaf(l);
                return true;
            }, categoryId, leafId);
            await page.settle();
        };

        /* ═══════════════════════════════════════════════════════════════════
         * 1. THE REGISTRY, RENDERED — one renderer, one row shape
         * ═════════════════════════════════════════════════════════════════ */

        describe('the one-primitive claim, as rendered rows', () => {
            test('a leaf renders exactly the rows the registry gives it, through #29', async () => {
                await showLeaf('machine', 'machine-flush');
                const rows = await rowReport(page);
                assert.deepEqual(rows.map((r) => r.id), [
                    'machine-flush-temp', 'machine-flush-flow', 'machine-flush-duration',
                ]);
                for (const row of rows) {
                    assert.equal(row.archetype, 'stepper');
                    assert.equal(row.control.length, 1, 'one control on the right');
                    assert.equal(row.control[0].tag, 'ui-stepper');
                }
            });

            test('the hint beside the label is the LIMITS TABLE\'s sentence', async () => {
                await showLeaf('machine', 'machine-flush');
                const rows = await rowReport(page);
                assert.equal(rows[0].hint, '5–95 °C');
                /* 2–8 SINCE 26 August 2026. Ben, point 20: "flush range should be 2 to
                 * 8ml/s". Below 2 the flush is too slow to clear the group. */
                assert.equal(rows[1].hint, '2–8 mL/s');
                /* NO ZERO CLAUSE since 26 Aug 2026 — Ben: "remove the 0 = no flush, it's
                 * a button the user needs to press." The hint is the band and nothing
                 * else; the second job hidden in the floor is gone. */
                assert.equal(rows[2].hint, '0–60 s');
            });

            /* THE FAN THRESHOLD BAND IS MACHINE-DEPENDENT SINCE 27 AUGUST 2026, so this
             * pin needs a machine before it can read a band at all.
             *
             * Ben: "I think I will update the FW in Bengle to 40-60c, 30 is too low and
             * seems pointless so lets increase it this in the decal for Bengle and do
             * what ever reaprime has for the DE1." It was 30–70 on both for one day (his
             * point 128) and 0–50 on both before that, read straight off
             * `MMRItem.fanThreshold`.
             *
             * WHAT THIS PIN HAS ALWAYS BEEN ABOUT SURVIVES INTACT and is now asserted twice
             * over: the hint is the LIMITS TABLE's sentence, in °C, and never the percentage
             * the old page printed over a caption that said °C.
             *
             * A NON-EMPTY SERVED SET IS A BENGLE AND AN EMPTY ONE IS A DE1 — ReaPrime's own
             * inference (`de1handler.dart` emits the seven inside one `if (de1 is
             * BengleInterface)`), read through `machineClassFromServedSet`. */
            const fanHint = async (served) => {
                await page.evalFn((entries) => window.__settings.capabilities(entries).then(() => true), served);
                await page.settle();
                await showLeaf('calibration', 'calibration-hardware');
                const rows = await rowReport(page);
                /* T7 IS ABOUT THE FAN, NOT ABOUT THE PAGE. It read `rows.length === 1`
                 * while Fan Threshold had a page to itself, so the page count and the Fan
                 * count were the same number. The 28 Aug merge put Refill Kit and Voltage
                 * beside it, so the proxy stopped holding while the rule it stands for did.
                 * Counting the Fan rows says what T7 always meant: one implementation. */
                const fan = rows.filter((row) => row.id === 'calibration-fan-threshold');
                assert.equal(fan.length, 1, 'T7: one Fan implementation, not two');
                assert.equal(rows.length, 3, 'and it shares Hardware with Refill Kit and Voltage');
                return fan[0].hint;
            };

            test('the fan threshold renders Ben\'s band on a Bengle, in °C and not a percentage', async () => {
                const hint = await fanHint(['cupWarmer']);
                assert.equal(hint, '40–60 °C');
                assert.doesNotMatch(hint, /%/, 'the old page printed a percentage over a caption saying °C');
            });

            test('and ReaPrime\'s own declared band on a DE1', async () => {
                /* "do what ever reaprime has for the DE1" — `MMRItem.fanThreshold` declares
                 * `min: 0, max: 50`, so that is what a DE1 owner is offered. There is no DE1
                 * on this bench to correct the declaration with, and evidence gathered on a
                 * Bengle is not evidence about a DE1. */
                const hint = await fanHint([]);
                assert.equal(hint, '0–50 °C');
            });

            test('with no machine answer there is NO band, and that is A7 rather than a gap', async () => {
                /* The two bands overlap without nesting — 40–60 against 0–50 — so there is
                 * no honest stand-in even in principle: either stand-in would let one
                 * machine's owner reach a number the other's machine is not offered, and
                 * their first press would land inside it. The row still draws; it simply
                 * has no sentence beside its label until the capability read lands, exactly
                 * as the steam row has behaved since B3. */
                assert.equal(await fanHint(null), '');
            });

            test('every stepper prints its range, and the range is the table\'s', async () => {
                /* THIS PIN INVERTED ON 26 August 2026. It used to prove that an UNBOUNDED
                 * row prints no hint — "nothing is invented", B2's unstated-is-unbounded —
                 * and hot-water Flow was the example because it had no limit.
                 *
                 * Ben's O8 retires the state it was proving: "All steppers should have a
                 * range and when at the max the + or - should be grayed out." Three rows
                 * had none (hot-water flow, the cup-warmer target, the machine's flow
                 * calibration) and all three now do — point 16 gives the first its 2–8 mL/s
                 * and point 55 the second its 40–70 °C.
                 *
                 * THE UNDERLYING RULE IS UNTOUCHED and is what this now asserts: a hint is
                 * the LIMITS TABLE's sentence and nothing else, so a row still cannot
                 * invent one. What changed is that no row is unbounded any more. */
                await showLeaf('machine', 'machine-hot-water');
                const rows = await rowReport(page);
                /* BY ID, NOT BY INDEX. This read `rows[0]` and meant Flow; on 24 Aug 2026
                 * Temperature and Volume landed above it (both bounded, both hinted) and
                 * the assertion silently moved onto a row it was never about. `hotWaterFlow`
                 * still has no row in the limits table, which is what "unstated is
                 * unbounded" looks like from the screen. */
                const flow = rows.find((row) => row.id === 'machine-hot-water-flow');
                assert.ok(flow, 'the leaf still draws the flow row');
                assert.equal(flow.hint, '2–8 mL/s', 'O8: no stepper is unbounded any more');
                const temperature = rows.find((row) => row.id === 'machine-hot-water-temp');
                assert.equal(temperature.hint, '0–99 °C', 'and the two beside it ARE bounded');
            });

            /* THIS TEST HAS MOVED TWICE IN ONE DAY, and both moves are the same sweep
             * working, so the trail is worth keeping.
             *
             * It began on `help-keyboard-shortcuts`, whose one registry row was a READING
             * of the stored bindings. Ben's pass deleted that row — the leaf IS the binding
             * table, and a count above it said the same fact twice — so `rows[0]` was
             * undefined and the suite reported a TypeError.
             *
             * It moved to `connection-scale-last`, which was deleted hours later for a
             * sharper reason: nothing in src/ had ever WRITTEN `scaleDeviceId`, so that row
             * printed the absence dash on every machine for ever.
             *
             * IT LIVES ON `extensions-decent-app-path` NOW, which is a reading that is
             * genuinely a reading: the web UI folder is served by the app, shown on the
             * page, and deliberately never offered — writing it re-points the server at
             * another folder, which is how a skin removes itself from the screen. The
             * ABSENCE half of the claim is pinned separately, on the cup warmer's plate
             * temperature, which the machine reports as null whenever the warmer is off. */
            test('a reading row renders its value and no control', async () => {
                await showLeaf('extensions', 'extensions-decent-app-settings');
                const rows = await rowReport(page);
                const reading = rows.find((row) => row.id === 'extensions-decent-app-path');
                assert.ok(reading, 'the reading row is on the leaf');
                assert.equal(reading.control.length, 0, 'no control in the slot');
                assert.match(String(reading.reading), /webui\/decal$/,
                    'and it prints what the app served, not a dash');
            });
        });

        /* ═══════════════════════════════════════════════════════════════════
         * 2. T13 / T14 / T20 — ONE RHYTHM ACROSS LEAVES, MEASURED
         * ═════════════════════════════════════════════════════════════════ */

        describe('one row component means one padding and one gap, across leaves', () => {
            test('T13: every leaf\'s heading lands at the same y', async () => {
                const ys = [];
                for (const [category, leaf] of [
                    ['machine', 'machine-flush'], ['machine', 'machine-steam'],
                    ['machine', 'machine-advanced'], ['display', 'display-screen'],
                    ['calibration', 'calibration-hardware'], ['help', 'help-quickstart-guide'],
                ]) {
                    await showLeaf(category, leaf);
                    ys.push(Math.round((await page.box(HEADING)).y * 100) / 100);
                }
                assert.equal(new Set(ys).size, 1,
                    `T13 is one leaf out of 37 sitting 12px low; heading tops measured ${ys.join(', ')}`);
            });

            test('T14 / T20: every row shares one padding and one gap', async () => {
                const seen = new Set();
                for (const [category, leaf] of [
                    ['machine', 'machine-flush'], ['machine', 'machine-advanced'],
                    ['display', 'display-screen'], ['help', 'help-quickstart-guide'],
                ]) {
                    await showLeaf(category, leaf);
                    for (const row of await rowReport(page)) seen.add(`${row.paddingBlock}|${row.gap}`);
                }
                assert.equal(seen.size, 1, `rows disagree about rhythm: ${[...seen].join(' / ')}`);
            });

            test('every row is the width of the leaf, and the leaf is the pane\'s measure', async () => {
                await showLeaf('machine', 'machine-flush');
                const leaf = await page.box(LEAF);
                for (const row of await rowReport(page)) {
                    near(row.box.width, leaf.width, `row ${row.id} states a width of its own`);
                }
            });
        });

        /* ═══════════════════════════════════════════════════════════════════
         * 3. T9 / T10 — CONTROLS HOLD THEIR SIZE AND NOTHING OVERFLOWS
         * ═════════════════════════════════════════════════════════════════ */

        describe('T9 / T10: a control holds its stated size and its cluster fits its track', () => {
            test('T9: the same control is the same width in two different rows', async () => {
                await showLeaf('machine', 'machine-flush');
                const widths = (await rowReport(page)).map((row) => Math.round(row.control[0].width));
                assert.equal(new Set(widths).size, 1,
                    `T9 measured 214 in one leaf and 250 two rows below; got ${widths.join(', ')}`);
            });

            test('T9: and the same width in a different leaf again', async () => {
                await showLeaf('machine', 'machine-flush');
                const flush = Math.round((await rowReport(page))[0].control[0].width);
                await showLeaf('calibration', 'calibration-hardware');
                const fan = Math.round((await rowReport(page))[0].control[0].width);
                assert.equal(flush, fan, 'one stepper geometry, every leaf');
            });

            test('T10: no control cluster overflows its own row, with or without a button', async () => {
                for (const [category, leaf] of [
                    ['machine', 'machine-flush'], ['machine', 'machine-advanced'],
                    ['display', 'display-screen'], ['connection', 'connection-machine'],
                ]) {
                    await showLeaf(category, leaf);
                    for (const row of await rowReport(page)) {
                        for (const control of row.control) {
                            assert.ok(control.right <= row.box.x + row.box.width + 0.51,
                                `${row.id}: the control cluster overflows its row by ${control.right - (row.box.x + row.box.width)}px`);
                        }
                    }
                }
            });

            test('nothing in the leaf pane scrolls sideways', async () => {
                await showLeaf('machine', 'machine-flush');
                const metrics = await page.metrics(LEAF_PANE);
                assert.ok(metrics.scrollWidth <= metrics.clientWidth + 1,
                    'a leaf that overflows its pane inline is the raggedness T10 is about');
            });
        });

        /* ═══════════════════════════════════════════════════════════════════
         * 3b. cmp-sm-2 — A BANK IN A ROW HAS A BOX, AND A FINGER REACHES IT
         *
         * The blocker of the final review, and the assertion class that would have
         * caught it: a bank's RENDERED BOX, measured inside a settings row, at both
         * Gate A geometries, for every BANK row the registry has. Slate's own
         * settings bank is the number to beat — .slate-bank 348x64 with 115px items
         * on the machine-steam stop row (prov-baseline/settings-machine-steam.json).
         * ═════════════════════════════════════════════════════════════════ */

        describe('cmp-sm-2: the bank archetype is a control, not a hairline', () => {
            test('every bank in the registry has a real box inside its row', async () => {
                const banks = await bankWalk(page);
                assert.ok(banks.length >= 4,
                    `the walk found no banks to measure: ${JSON.stringify(banks)}`);
                for (const bank of banks) {
                    assert.equal(bank.display, 'grid', `${bank.row}: the bank is n equal columns`);
                    assert.ok(bank.items.length >= 2, `${bank.row}: a bank with one cell is not a bank`);

                    /* THE ARITHMETIC OF "n x THE WIDEST ITEM", both halves stated.
                     * A cell is the widest label plus ui-bank's own padding-inline,
                     * every cell is that same width, and the bank is n of them
                     * between its two hairlines. The 2px failure satisfied none of
                     * the three. */
                    const widest = Math.max(...bank.items.map((item) => item.text));
                    const cell = bank.items[0].width;
                    near(cell, widest + bank.items[0].padding, `${bank.row}: a cell is the widest label plus its padding`, 1.01);
                    for (const item of bank.items) {
                        near(item.width, cell, `${bank.row}: "${item.label}" is not the same width as its siblings`, 1.01);
                        assert.ok(item.text <= item.width - item.padding + 1.01,
                            `${bank.row}: "${item.label}" wants ${item.text}px and has ${item.width - item.padding}px — it is ellipsised at the bank's own size`);
                        assert.ok(item.height >= 48,
                            `${bank.row}: "${item.label}" is ${item.height}px tall, under the touch floor`);
                    }
                    near(bank.width, bank.items.length * cell + bank.border,
                        `${bank.row}: the bank is not n cells wide`, 1.01);
                    assert.ok(bank.scrollWidth <= bank.clientWidth + 1,
                        `${bank.row}: the items overflow the bank's own overflow: hidden box`);
                }
            });

            test('and a finger landing on a cell reaches that cell', async () => {
                const banks = await bankWalk(page);
                for (const bank of banks) {
                    for (const item of bank.items) {
                        assert.ok(item.hit,
                            `${bank.row}: a press at the centre of "${item.label}" answers ${item.hitName}`);
                    }
                }
            });

            test('the steam-stop bank is the oracle\'s settings bank, and pressing a cell sets the mode', async () => {
                await showLeaf('machine', 'machine-steam');
                const [bank] = (await bankWalk(page)).filter((b) => b.row === 'machine-steam-stop');
                assert.ok(bank, 'the steam-stop row must carry a bank');

                /* prov-baseline settings-machine-steam: .slate-bank 348x64, items 115.
                 * Whole pixels, because the oracle was captured at dsf 1 and this suite
                 * runs at both — the claim is the SHAPE, not a sub-pixel identity. */
                near(bank.height, 64, 'the bank floor is --ui-control-h');
                assert.ok(Math.abs(bank.width - 348) <= 6,
                    `the steam-stop bank measured ${bank.width}, Slate's is 348`);
                assert.ok(bank.rowBox && bank.width < bank.rowBox.right - bank.rowBox.x,
                    'a bank that fills its whole row is not being sized by its content');

                /* THE PRESS, THROUGH CHROME'S OWN HIT TEST rather than through the
                 * store — the half of the blocker a programmatic change() cannot see.
                 * The value is read off the LEAF MODEL, so what is asserted is the
                 * whole path: hit test, button, bank, row, leaf, model. */
                /* bankWalk() left the screen on the LAST bank leaf in the registry. */
                await showLeaf('machine', 'machine-steam');
                const stopValue = () => page.evalFn(() => window.__settings.model()
                    .rows('machine-steam').find((view) => view.id === 'machine-steam-stop')?.value ?? null);
                const before = await stopValue();
                const target = await page.evalFn(() => {
                    const leaf = document.querySelector('settings-screen').shadowRoot.getElementById('leaf');
                    const el = leaf.shadowRoot.querySelector('ui-settings-row[data-row="machine-steam-stop"] ui-bank');
                    const items = [...el.shadowRoot.querySelectorAll('.item')];
                    const index = items.findIndex((item) => item.getAttribute('aria-pressed') !== 'true'
                        && item.getAttribute('aria-checked') !== 'true'
                        && item.getAttribute('aria-selected') !== 'true');
                    const at = index < 0 ? items.length - 1 : index;
                    return { id: items[at].id, label: items[at].textContent.trim() };
                });
                /* SCROLL IT UNDER THE FINGER FIRST — the same reason as in bankWalk. The
                 * leaf pane scrolls, a real click is a hit test, and a hit test on a point
                 * outside the viewport reaches nothing. The Steam stop row sits below the
                 * fold at the floor geometry since the leaf gained its rule and its
                 * description (O5, O6). */
                await page.evalFn(() => {
                    const leaf = document.querySelector('settings-screen').shadowRoot.getElementById('leaf');
                    leaf.shadowRoot
                        .querySelector('ui-settings-row[data-row="machine-steam-stop"] ui-bank')
                        ?.scrollIntoView({ block: 'center' });
                });
                await page.settle();
                await page.click(`${ROW('machine-steam-stop')} ui-bank >>> #${target.id}`);
                await page.settle();
                const after = await stopValue();
                assert.notEqual(after, before,
                    `pressing "${target.label}" changed nothing: still ${before}`);
            });
        });

        /* ═══════════════════════════════════════════════════════════════════
         * 3c. cmp-sm-1 — THE STEAM LEAF IS WHOLE
         *
         * The leaf shipped two rows where the oracle draws four, with nothing in
         * PENDING_ROWS to say so. prov-baseline/settings-machine-steam.json:
         * [i=65..69] the stop bank, [i=70] its caption, [i=71] the milk-probe note,
         * [i=72..79] Duration with the hint "0-120 s · 0 = steam heater off", and
         * [i=80..82] the Steam purge mode select with its caption.
         * ═════════════════════════════════════════════════════════════════ */

        describe('cmp-sm-1: the steam leaf draws five rows, not two', () => {
            const steam = async () => {
                await showLeaf('machine', 'machine-steam');
                return rowReport(page);
            };

            test('the five rows are there, in the oracle\'s order and archetypes', async () => {
                const rows = await steam();
                /* FOUR BECAME FIVE ON 24 AUG 2026: Temperature sits beside Flow, where
                 * the two machine numbers belong. Its pending entry pointed at
                 * `POST /machine/shotSettings`, which cannot carry one value — the
                 * workflow door can, and it reaches the DE1 through
                 * `De1Controller.updateWorkflowSettings`. */
                /* SIX SINCE 26 Aug 2026. The master switch is the new first row (Ben:
                 * "add a new toggle to the top to turn the steam on and off ... rest of
                 * the order is ok"), and the rest of the order is exactly what it was. */
                /* SEVEN, LATER THE SAME DAY, and the seventh is what the Milk Temp option
                 * had always been missing: `machine-steam-milk-target`, the temperature the
                 * probe stops at. The bank's own caption promises the machine stops "when
                 * the milk reaches the target temperature" and there was NO CONTROL anywhere
                 * on the page for that target — Slate draws a stepper and a live probe
                 * reading whenever that mode is chosen. It sits directly under the mode that
                 * names it, which is Slate's grouping and the same rule the night-mode times
                 * follow one cluster over. */
                assert.deepEqual(rows.map((row) => row.id), [
                    'machine-steam-enabled',
                    'machine-steam-flow', 'machine-steam-temp', 'machine-steam-stop',
                    'machine-steam-milk-target',
                    'machine-steam-duration', 'machine-steam-purge',
                ]);
                assert.deepEqual(rows.map((row) => row.archetype),
                    ['switch', 'stepper', 'stepper', 'bank', 'stepper', 'stepper', 'select']);
            });

            test('Duration carries the limits table\'s own hint, zero meaning and all', async () => {
                const duration = (await steam()).find((row) => row.id === 'machine-steam-duration');
                assert.equal(duration.heading, 'Duration');
                /* The string is machine-limits.js's rangeHint over steamDuration, not a
                 * string this suite or the registry composed — B2. The oracle's [i=73]
                 * reads the same words from the same table one skin over. */
                /* NO ZERO CLAUSE since 26 Aug 2026: the page has a master switch now, and
                 * Ben retired the sub-band rule with it — "the new toggle does that job".
                 * A stop time of zero is a stop time of zero.
                 *
                 * AND THE FLOOR IS 10, LATER THE SAME DAY, on Slate's own band
                 * (`settings.js:3474`, step 5 min 10 max 120) — the only stated one, since
                 * no MMR declares a range for this field. With the Steam stop bank carrying
                 * an explicit Off option, a duration of zero had become a SECOND spelling of
                 * "no time stop", which is the duplicate meaning Ben stripped out of the
                 * flush row and out of the tank row the same day. Off owns zero; this
                 * stepper offers durations. */
                assert.equal(duration.hint, '10–120 s');
                assert.equal(duration.control[0].tag, 'ui-stepper');
            });

            /* ═══════════════════════════════════════════════════════════════
             * F-021 / F-047 — THE STEAM TEMPERATURE ROW, WHICH TURNED THE HEATER OFF
             *
             * The audit's sweep, four times over, on the tablet: typed 150 → 150,
             * 136 → 136, 135 → 135, but 134 → 135 (snapped up), 120 → 135 (snapped up)
             * and 63 → "–" with `{"steamSettings":{"targetTemperature":0}}` on the wire
             * and the Steam switch above it flipped to false. Wave 4 confirmed the server
             * accepts and stores that 0. The band the pad offered was 0–170 and nothing on
             * the glass said a number inside it would be replaced.
             *
             * These drive the REAL settings screen — the pad the row opens, not a mounted
             * keypad — because the fault is in what this screen hands it (`#typingBand`).
             * ═══════════════════════════════════════════════════════════════ */

            /* THE MACHINE CLASS HAS TO BE KNOWN or the steam row has no band at all — its
             * ceiling is machine-dependent and A7 refuses a stand-in (the same note the
             * Fahrenheit section below carries). Served and then PUT BACK: this suite
             * shares one page and the default is the mock's own 503, which later sections
             * read as UNKNOWN. */
            const withClass = async (fn) => {
                await page.evalFn(() => window.__settings.capabilities(['cupWarmer']).then(() => true));
                try {
                    await fn();
                } finally {
                    await page.evalFn(() => window.__settings.capabilities(null).then(() => true));
                }
            };

            /**
             * Open the pad on a row the way a finger does: press the value cell.
             *
             * IT SCROLLS FIRST, for the reason `ui-numeric-keypad.render.test.mjs` records
             * about its own pad keys: at the 1000x600 floor the row is below the fold of
             * the leaf's scroll region and a click at its box coordinates lands on whatever
             * is painted there instead. Measured: the press did nothing and the pad stayed
             * shut, at the floor only.
             */
            const openPad = async (rowId) => {
                const cell = `${ROW(rowId)} ui-stepper >>> #value`;
                await page.evalFn((s) => {
                    window.__h.need(s).scrollIntoView({ block: 'center', inline: 'nearest' });
                    return true;
                }, cell);
                await page.settle(1);
                await page.click(cell);
                await page.settle(3);
            };

            const padState = () => page.evalFn(() => {
                const pad = document.querySelector('settings-screen').shadowRoot.getElementById('keypad');
                const confirm = pad.shadowRoot.getElementById('confirm');
                return {
                    open: pad.open === true,
                    hint: pad.shadowRoot.getElementById('hint')?.textContent ?? null,
                    readout: pad.shadowRoot.getElementById('display')?.textContent ?? null,
                    min: pad.range?.min ?? null,
                    max: pad.range?.max ?? null,
                    refused: confirm?.disabled === true,
                };
            });

            /** Type digits into the open pad through its own key buttons. */
            const padType = async (digits) => {
                await page.evalFn((keys) => {
                    const pad = document.querySelector('settings-screen').shadowRoot.getElementById('keypad');
                    for (const key of keys) pad.shadowRoot.getElementById(`key-${key}`).click();
                    return true;
                }, digits);
                await page.settle(2);
            };

            test('F-021: the steam pad offers the WORKING band, so 63 cannot be typed into it', () => withClass(async () => {
                /* THIS SUITE SHARES ONE PAGE and the staging band is deliberately durable
                 * across leaf changes, so an earlier section's edits are still pending
                 * here. Cleared first, so the only thing this test can measure is its own. */
                await page.evalFn(() => { window.__settings.model().discard(); return true; });
                await showLeaf('machine', 'machine-steam');
                await openPad('machine-steam-temp');
                const opened = await padState();
                assert.equal(opened.open, true, 'the value cell must open the pad');
                /* THE BAND THE PAD ACCEPTS IS THE ONE IT PRINTS. It used to accept 0–170
                 * while printing 135–170, and `clamp` decided what a number in between
                 * became. */
                assert.deepEqual({ min: opened.min, max: opened.max }, { min: 135, max: 170 });
                assert.equal(opened.hint, '135–170 °C');

                await padType(['6', '3']);
                const typed = await padState();
                assert.equal(typed.readout, '63', 'the keys still type — the refusal is Confirm\'s');
                assert.equal(typed.refused, true,
                    '63 °C is inside the hole; confirming it sent targetTemperature 0');

                /* AND NOTHING WAS STAGED BY THE ATTEMPT. */
                await page.evalFn(() => {
                    const pad = document.querySelector('settings-screen').shadowRoot.getElementById('keypad');
                    pad.shadowRoot.getElementById('confirm').click();
                    return true;
                });
                await page.settle(2);
                const after = await padState();
                assert.equal(after.open, true, 'a refusal leaves the pad open to be corrected');
                assert.deepEqual(
                    await page.evalFn(() => window.__settings.model().pendingPatch ?? {}),
                    {}, 'a refused number reaches neither the staging band nor the wire');
                assert.equal(
                    await page.evalFn(() => 'steamTargetTemperature' in
                        (window.__settings.model().pendingPatch ?? {})),
                    false, 'and the field it would have written is untouched');

                /* THE FLOOR ITSELF IS NOT A REFUSAL — an off-by-one here would make the
                 * coldest steam the machine makes unreachable from the pad. */
                await padType(['backspace', 'backspace', '1', '3', '5']);
                assert.equal((await padState()).refused, false);

                await page.evalFn(() => {
                    document.querySelector('settings-screen').shadowRoot
                        .getElementById('keypad').cancel('test');
                    return true;
                });
                await page.settle(2);
                await page.evalFn(() => { window.__settings.model().discard(); return true; });
                await page.settle();
            }));

            test('F-047: the steam row ANNOUNCES the band it prints, in the same words', () => withClass(async () => {
                await showLeaf('machine', 'machine-steam');
                const said = await page.evalFn(() => {
                    const leaf = document.querySelector('settings-screen').shadowRoot.getElementById('leaf');
                    const row = leaf.shadowRoot.querySelector('ui-settings-row[data-row="machine-steam-temp"]');
                    const stepper = row.querySelector('ui-stepper');
                    const described = stepper.shadowRoot.getElementById('range');
                    const group = stepper.shadowRoot.querySelector('[aria-describedby]');
                    return {
                        printed: row.shadowRoot.getElementById('hint')?.textContent?.trim() ?? null,
                        announced: described?.textContent?.trim() ?? null,
                        describedBy: group?.getAttribute('aria-describedby') ?? null,
                        min: stepper.min,
                        max: stepper.max,
                    };
                });
                /* THE DEFECT, VERBATIM FROM THE FINDING: "its accessible text says
                 * 'Range 0 to 170 °C'". The stepper derived that from the two numbers it is
                 * handed, and they ARE 0 and 170 — the min is the machine's "no steam". */
                assert.deepEqual({ min: said.min, max: said.max }, { min: 0, max: 170 },
                    'the stepper keeps its full band: stepping down to off is a real gesture');
                assert.equal(said.describedBy, 'range', 'the hint must still describe the group');
                assert.equal(said.printed, '135–170 °C');
                assert.equal(said.announced, said.printed,
                    'one band, one sentence — a screen-reader user and a sighted one are told the same thing');
                assert.doesNotMatch(said.announced, /Range 0 to/);
            }));

            test('F-047: a row with NO hole announces its band too, and it still agrees', async () => {
                /* THE FIX IS NOT A SPECIAL CASE FOR ONE ROW. Duration has no hole and its
                 * derived sentence was already true; it now reads the same string the row
                 * prints, which is what "one composer" means. */
                await showLeaf('machine', 'machine-steam');
                const said = await page.evalFn(() => {
                    const leaf = document.querySelector('settings-screen').shadowRoot.getElementById('leaf');
                    const row = leaf.shadowRoot.querySelector('ui-settings-row[data-row="machine-steam-duration"]');
                    const stepper = row.querySelector('ui-stepper');
                    return {
                        printed: row.shadowRoot.getElementById('hint')?.textContent?.trim() ?? null,
                        announced: stepper.shadowRoot.getElementById('range')?.textContent?.trim() ?? null,
                    };
                });
                assert.equal(said.printed, '10–120 s');
                assert.equal(said.announced, said.printed);
            });

            /* ═══════════════════════════════════════════════════════════════
             * F-042 — A PENDING ROW PAINTS AS PENDING
             *
             * The model half is pinned in `settings-leaf-model-commit-band.test.mjs`; this
             * is the half a person sees. `view.pending` and `view.inert` are different
             * states with the same RENDERING — disabled and dashed — because A7's answer to
             * "I do not know" is the same in both cases, and the assertion that matters is
             * that the renderer joins them at all.
             *
             * ONE ARCHETYPE IS NOW OUT OF THAT SENTENCE, and nothing below measures it.
             * Ben's decision D08 (30 Aug 2026) took SWITCH rows out of the join: a pending
             * switch draws a skeleton rather than a disabled control, because role=switch
             * announces a boolean in every state it has and "disabled and off" is still
             * "off". Everything this case measures is a STEPPER, so its assertions are
             * untouched and true; the switch half lives in
             * `settings-pending-switch.render.test.mjs`, where the pending window is a
             * state a fixture can hold open rather than a race to catch.
             * ═════════════════════════════════════════════════════════════ */
            test('F-042: pending and inert render alike, and a settled row renders neither', async () => {
                await showLeaf('machine', 'machine-steam');
                const settled = await page.evalFn(() => {
                    const model = window.__settings.model();
                    return model.rows('machine-steam').map((view) => ({
                        id: view.id, pending: view.pending, inert: view.inert,
                    }));
                });
                /* EVERY ROW HAS ANSWERED by the time a leaf is on screen and settled —
                 * which is why the fault only ever showed for the first few seconds. */
                assert.ok(settled.length > 0);
                for (const row of settled) {
                    assert.equal(row.pending, false, `${row.id} still waiting after load()`);
                }

                /* AND THE FLAG EXISTS ON EVERY ROW rather than being undefined on most,
                 * which is what an `undefined` would make of `view.inert || view.pending`
                 * the first time somebody reordered that expression. */
                for (const row of settled) assert.equal(typeof row.pending, 'boolean');

                /* THE INERT HALF, MEASURED ON THE GLASS: turning the master switch off
                 * disables the rows below it and dashes their values. That is the exact
                 * treatment a pending row now gets. */
                await page.evalFn(() => window.__settings
                    .change('machine-steam-enabled', false).then(() => true));
                await page.settle();
                const dashed = await page.evalFn(() => {
                    const leaf = document.querySelector('settings-screen').shadowRoot.getElementById('leaf');
                    const row = leaf.shadowRoot.querySelector('ui-settings-row[data-row="machine-steam-temp"]');
                    const stepper = row?.querySelector('ui-stepper');
                    return {
                        disabled: stepper?.disabled === true,
                        off: stepper?.off === true,
                        shown: stepper?.shadowRoot?.querySelector('.value')?.textContent?.trim() ?? null,
                    };
                });
                assert.equal(dashed.disabled, true);
                assert.equal(dashed.off, true);
                await page.evalFn(() => { window.__settings.model().discard(); return true; });
                await page.settle();
            });

            test('the purge select offers the machine\'s two modes and speaks its numbers', async () => {
                await showLeaf('machine', 'machine-steam');
                const select = await page.evalFn(() => {
                    const leaf = document.querySelector('settings-screen').shadowRoot.getElementById('leaf');
                    const el = leaf.shadowRoot.querySelector('ui-settings-row[data-row="machine-steam-purge"] ui-select');
                    return {
                        options: [...el.shadowRoot.querySelectorAll('option')]
                            .map((option) => `${option.value}=${option.textContent}`),
                        width: el.getBoundingClientRect().width,
                    };
                });
                /* TWO, and the finding said three: it read the walker's concatenated
                 * element text "Normal Two Tap Stop" as three labels. Slate's markup is
                 * two <option>s, value 0 and value 1 (settings.js:3392-3394). */
                assert.deepEqual(select.options, ['0=Normal', '1=Two Tap Stop']);
                assert.ok(select.width > 100, `the select collapsed to ${select.width}px`);
            });

            test('choosing a purge mode writes the NUMBER, never the option string', async () => {
                await showLeaf('machine', 'machine-steam');
                const wrote = await page.evalFn(async () => {
                    const leaf = document.querySelector('settings-screen').shadowRoot.getElementById('leaf');
                    const el = leaf.shadowRoot.querySelector('ui-settings-row[data-row="machine-steam-purge"] ui-select');
                    const control = el.shadowRoot.getElementById('control');
                    control.value = '1';
                    control.dispatchEvent(new Event('change', { bubbles: true }));
                    await new Promise((resolve) => setTimeout(resolve, 0));
                    const staged = window.__settings.model().pendingPatch;
                    return { value: staged.steamPurgeMode, type: typeof staged.steamPurgeMode };
                });
                assert.equal(wrote.type, 'number',
                    `steamPurgeMode staged as ${wrote.type} — a DOM string reaching an int field`);
                assert.equal(wrote.value, 1);
                /* THIS SUITE SHARES ONE PAGE, so a staged field left here is a change
                 * count D11's section reads later. Discard rather than commit: the
                 * write path is not what this test is about. */
                await page.evalFn(() => { window.__settings.model().discard(); return true; });
                await page.settle();
            });

            /* THE SAME CLAIM FOR #3, AND IT DID NOT HOLD UNTIL 24 AUG 2026.
             *
             * The select branch had made this round trip since cmp-sm-1; the BANK branch
             * handed `event.detail.value` straight to the model. Nothing noticed, because
             * every bank row's values were STRINGS — 'mm'/'ml', 'off'/'time'/'milk-temp' —
             * and a string that survives a DOM attribute round trip is the same string.
             *
             * `refillKitSetting` and `heaterVoltage` are the first banks whose values are
             * NUMBERS, and the defect showed on the wire the first time the app was driven
             * against a machine: `POST /machine/settings/advanced {"refillKitSetting":"2"}`.
             * It happens to survive — ReaPrime's `parseInt` ends in Dart's `int.parse`,
             * which takes the string — which is what makes it the dangerous kind. */
            test('choosing a bank cell writes the NUMBER too, not the attribute string', async () => {
                await showLeaf('calibration', 'calibration-hardware');
                const wrote = await page.evalFn(async () => {
                    const leaf = document.querySelector('settings-screen').shadowRoot.getElementById('leaf');
                    const bank = leaf.shadowRoot.querySelector('ui-settings-row[data-row="calibration-refill-kit-mode"] ui-bank');
                    /* The cell, pressed the way a finger presses it. `ui-bank` reflects
                     * its value as an ATTRIBUTE, which is where the type is lost. */
                    /* THE CELL IT IS NOT ON. The fixture's machine holds 2 (Auto-Detect)
                     * and `ui-bank` fires `change` only when the value MOVES, so pressing
                     * the lit cell asserts nothing at all. Force Off is 0 — a value whose
                     * falsiness is its own trap, and the right one to test with. */
                    const cells = [...bank.shadowRoot.querySelectorAll('button')];
                    cells[cells.length - 1].click();
                    await new Promise((resolve) => setTimeout(resolve, 0));
                    const staged = window.__settings.model().pendingPatch;
                    return { value: staged.refillKitSetting, type: typeof staged.refillKitSetting };
                });
                assert.equal(wrote.type, 'number',
                    `refillKitSetting staged as ${wrote.type} — a DOM string reaching an int field`);
                assert.equal(wrote.value, 0, 'Force Off is 0 in De1RefillKitSettings');
                await page.evalFn(() => { window.__settings.model().discard(); return true; });
                await page.settle();
            });

            test('the milk-probe note is back, as its own paragraph under the caption', async () => {
                await showLeaf('machine', 'machine-steam');
                const block = await page.evalFn(() => {
                    const leaf = document.querySelector('settings-screen').shadowRoot.getElementById('leaf');
                    const row = leaf.shadowRoot.querySelector('ui-settings-row[data-row="machine-steam-stop"]');
                    const caption = row.shadowRoot.getElementById('caption');
                    const note = row.shadowRoot.getElementById('note');
                    return {
                        caption: caption?.textContent.trim() ?? null,
                        note: note?.textContent.trim() ?? null,
                        /* Slate draws two sibling paragraphs, not one joined string. */
                        separate: Boolean(caption && note && caption !== note),
                        noteBelow: Boolean(caption && note
                            && note.getBoundingClientRect().top >= caption.getBoundingClientRect().bottom - 1),
                        role: note ? getComputedStyle(note).fontSize : null,
                        captionRole: caption ? getComputedStyle(caption).fontSize : null,
                    };
                });
                assert.equal(block.note, 'Requires the Bengle milk temperature probe.');
                assert.ok(block.separate, 'the note must be its own paragraph');
                assert.ok(block.noteBelow, 'the note sits under the caption');
                assert.equal(block.role, block.captionRole, 'one caption role, two paragraphs');
            });

            test('and it rides on the OPTION, so a leaf with no milk option shows none', async () => {
                /* The condition is the item list, not a second flag: no other leaf in
                 * the registry declares a noted option, so every other row's note is
                 * absent by the same rule that puts this one on screen. */
                for (const [category, leaf] of [
                    ['machine', 'machine-water-tank'], ['display', 'display-screen'],
                    ['machine', 'machine-flush'],
                ]) {
                    await showLeaf(category, leaf);
                    const notes = await page.evalFn(() => {
                        const el = document.querySelector('settings-screen').shadowRoot.getElementById('leaf');
                        return [...el.shadowRoot.querySelectorAll('ui-settings-row')]
                            .map((row) => row.shadowRoot.getElementById('note')?.textContent.trim() ?? null)
                            .filter(Boolean);
                    });
                    assert.deepEqual(notes, [], `${leaf} grew a note it does not declare`);
                }
            });

            /* A BANK THAT SELECTS NOTHING NOW SAYS WHY (point 121).
             *
             * `De1HeaterVoltage` has three members and this bank offers two: `unset(-1)` is
             * a real, shipping state — a machine nobody has told — and it cannot be a
             * segment, because choosing it would ask a heater to run on nothing. So the row
             * drew two unpressed keys with no explanation anywhere on the page, which is
             * indistinguishable from a bank that failed to render.
             *
             * THIS IS A7 SERVED, NOT BREACHED. Nothing is substituted: the bank still
             * selects no segment on -1, and the assertion below pins that. What is added is
             * the absence NAMED, which is what A7 asks for — and a sentence rather than a
             * dash, because a control's absence raises the question "what do I do about
             * it" and only a sentence answers it. Slate had it (`settings.js:5138`).
             *
             * AND IT GOES AWAY THE MOMENT A VOLTAGE IS SET, which is the half that makes it
             * a wiring test rather than a copy test: a note that is always on screen is a
             * caption in the wrong place. */
            test('an unset mains voltage selects nothing and says so', async () => {
                await showLeaf('calibration', 'calibration-hardware');
                const readRow = () => page.evalFn(() => {
                    const el = document.querySelector('settings-screen').shadowRoot.getElementById('leaf');
                    const row = el.shadowRoot.querySelector('ui-settings-row[data-row="calibration-voltage-mains"]');
                    /* THE CONTROL IS SLOTTED, so it is a LIGHT-DOM child of #29 rather
                     * than a node in its shadow root — the same reach the bank round-trip
                     * case above makes. */
                    const bank = row.querySelector('ui-bank');
                    return {
                        note: row.shadowRoot.getElementById('note')?.textContent.trim() ?? null,
                        value: bank ? bank.getAttribute('value') : null,
                        /* #3 IS A RADIOGROUP BY DEFAULT, so its selected spelling is
                         * `aria-checked` — one of the three the component binds, and the
                         * only one present in this mode. */
                        pressed: bank
                            ? [...bank.shadowRoot.querySelectorAll('button')]
                                .filter((b) => b.getAttribute('aria-checked') === 'true').length
                            : -1,
                    };
                });

                const set = await readRow();
                assert.equal(set.note, null, 'a machine that has been told says nothing extra');
                assert.equal(set.pressed, 1, 'and one segment is lit');

                await page.evalFn(() => window.__settings
                    .machineAdvancedField('heaterVoltage', -1).then(() => true));
                await page.settle();

                const unset = await readRow();
                assert.match(unset.note ?? '', /no voltage set yet/i,
                    'an unset machine names the absence rather than drawing a blank bank');
                assert.equal(unset.pressed, 0, 'and still selects nothing — the note is not a default');

                /* PUT IT BACK: this suite shares one page, and a machine left unset here
                 * would follow every later case down the sub-nav. */
                await page.evalFn(() => window.__settings
                    .machineAdvancedField('heaterVoltage', 230).then(() => true));
                await page.settle();
            });

            /* BOTH FLOW MULTIPLIERS ARE LOOKAHEAD SECONDS (H18, points 109 and 112).
             *
             * SETTLED BY THE CODE ON BOTH SIDES, not by preference. `shot_sequencer.dart`
             * computes `projectedWeight = currentWeight + (weightFlow * multiplier)`
             * (:432-433) and `projectedVolume = _accumulatedVolume + (machine.flow *
             * multiplier)` (:460-461); flow is a per-second rate in both, so a product that
             * comes out as a mass or a volume makes the multiplier a TIME. ReaPrime names
             * the identical construct `lookaheadSeconds` (`hot_water_stop.dart:112`), and
             * Slate's own inputs carry an 's'.
             *
             * SO THE ROW HAD TO PRINT THE UNIT, and `appFlowMultiplier.unit` was the empty
             * string — a number with no dimension on the one page where the dimension is
             * the whole meaning. And the captions opened "Corrects flow derived from…",
             * which is a calibration gain: something you turn because an instrument reads
             * high. Neither multiplier touches the flow it is given. A user reading
             * "corrects" would tune these against a scale error for ever.
             *
             * THE LEAF IS DE1-ONLY, so the machine has to be a DE1 for it to exist at all —
             * an EMPTY served set, which is ReaPrime's own "this is not a Bengle". */
            test('both flow multipliers print seconds and say how far ahead they look', async () => {
                await page.evalFn(() => window.__settings.capabilities([]).then(() => true));
                await page.settle();
                await showLeaf('calibration', 'calibration-flow-multiplier');

                const rows = await page.evalFn(() => {
                    const leaf = document.querySelector('settings-screen').shadowRoot.getElementById('leaf');
                    const one = (id) => {
                        const row = leaf.shadowRoot.querySelector(`ui-settings-row[data-row="${id}"]`);
                        if (!row) return null;
                        const stepper = row.querySelector('ui-stepper');
                        return {
                            caption: row.shadowRoot.getElementById('caption')?.textContent.trim() ?? '',
                            unit: stepper ? stepper.getAttribute('unit') : null,
                            step: stepper ? stepper.step : null,
                        };
                    };
                    return {
                        weight: one('calibration-flow-multiplier-weight'),
                        volume: one('calibration-flow-multiplier-volume'),
                    };
                });

                for (const [which, row] of Object.entries(rows)) {
                    assert.ok(row, `the ${which} row is not on the page`);
                    assert.equal(row.unit, 's',
                        `the ${which} multiplier prints no unit, and the unit is its meaning`);
                    assert.match(row.caption, /seconds/i,
                        `the ${which} caption does not say what the number is`);
                    assert.doesNotMatch(row.caption, /corrects flow/i,
                        `the ${which} caption still describes a gain — nothing is corrected`);
                    /* POINT 112: the direction belongs on BOTH rows. The mechanism is
                     * identical, and Slate states it only on the weight one — Slate being
                     * incomplete rather than Decal being faithful. */
                    assert.match(row.caption, /higher value stops the shot earlier/i,
                        `the ${which} caption does not say which way it moves the stop`);
                    /* POINT 111: the default is stated here because nothing else states it.
                     * Neither field is in RESET_FIELDS and neither has a MACHINE_FALLBACKS
                     * entry, so before this the recovery value was written down nowhere. */
                    assert.match(row.caption, /default [\d.]+ s/i,
                        `the ${which} caption does not name its default`);
                    assert.equal(row.step, 0.05,
                        `the ${which} stepper crosses its band in 200 presses, not 40`);
                }

                assert.match(rows.weight.caption, /1\.0 s/, "the weight default is ReaPrime's 1.0");
                assert.match(rows.volume.caption, /0\.3 s/, "the volume default is ReaPrime's 0.3");

                await page.evalFn(() => window.__settings.capabilities(['scaleCalibration']).then(() => true));
                await page.settle();
            });

            /* THE LEAF'S ONE HEADLINE SCALAR REACHES ITS NAV ROW (point 114, Slate's S20).
             *
             * "Confirming what the machine is set to cost six taps and six page loads" is
             * Slate's own note on why this exists. Decal had the data — every value on
             * every leaf is one view away — and slotted a bare label: a finished half with
             * no other half.
             *
             * THE PENDING STATE IS THE SOURCE AND THAT IS THE LOAD-BEARING HALF. A summary
             * read off the machine document would print 220V beside a control the user has
             * just moved to 110V, which is worse than no summary at all. */
            test('the Voltage nav row carries the set voltage, and agrees with an unsaved change', async () => {
                await showLeaf('calibration', 'calibration-hardware');
                const summaryFor = (leafId) => page.evalFn((id) => {
                    const root = document.querySelector('settings-screen').shadowRoot;
                    const row = root.getElementById('subnav').querySelector(`ui-subnav-row[data-id="${id}"]`);
                    if (!row) return { missing: true };
                    const el = row.shadowRoot.getElementById('summary');
                    return { missing: false, text: el ? el.textContent.trim() : null };
                }, leafId);

                const set = await summaryFor('calibration-hardware');
                assert.equal(set.missing, false, 'the Voltage row is in the sub-nav');
                assert.equal(set.text, '220V',
                    'the row prints the LABEL the page uses, not the raw 230 the wire carries');

                /* STAGED, NOT SAVED. #3 round-trips through a DOM attribute, so pressing
                 * the cell is also what proves the number survives that trip. */
                await page.evalFn(async () => {
                    const leaf = document.querySelector('settings-screen').shadowRoot.getElementById('leaf');
                    const bank = leaf.shadowRoot
                        .querySelector('ui-settings-row[data-row="calibration-voltage-mains"]')
                        .querySelector('ui-bank');
                    bank.shadowRoot.querySelectorAll('button')[0].click();
                    await new Promise((resolve) => setTimeout(resolve, 0));
                    return true;
                });
                await page.settle();

                const staged = await summaryFor('calibration-hardware');
                assert.equal(staged.text, '110V',
                    'the nav row agrees with the unsaved change rather than contradicting it');

                await page.evalFn(() => { window.__settings.model().discard(); return true; });
                await page.settle();
                assert.equal((await summaryFor('calibration-hardware')).text, '220V',
                    'and Cancel takes the summary back with the control');

                /* A LEAF WITH NO NOMINATED ROW DRAWS NO SUMMARY ELEMENT AT ALL — not a
                 * dash. A column of dashes in a nav list reads as a broken screen rather
                 * than as a set of pages that hold no single number. */
                const bare = await summaryFor('calibration-load-cells');
                assert.equal(bare.missing, false, 'the Load Cells row is in the same list');
                assert.equal(bare.text, null, 'and it draws no summary element');
            });
        });

        /* ═══════════════════════════════════════════════════════════════════
         * 3d. cmp-sm-3 — THE LEAF TITLE BLOCK: EYEBROW, AND THE LARGER TITLE
         *
         * ORACLE settings-calibration-load-cells [i=44] p.slate-eyebrow "Calibration"
         * y=146 h=31, [i=45] p.slate-title "Load Cell Calibration" y=181 — 28px, one
         * category word above it, 4px apart. The rebuild dropped the eyebrow and set
         * the title at the 20px heading role, and nothing declared either.
         * ═════════════════════════════════════════════════════════════════ */

        describe('cmp-sm-3: every leaf names its category above its title', () => {
            const header = () => page.evalFn(() => {
                const leaf = document.querySelector('settings-screen').shadowRoot.getElementById('leaf');
                const eyebrow = leaf.shadowRoot.getElementById('leaf-eyebrow');
                const title = leaf.shadowRoot.getElementById('leaf-heading');
                const rows = [...leaf.shadowRoot.querySelectorAll('ui-settings-row')];
                const heading = rows[0]?.shadowRoot?.getElementById('heading') ?? null;
                return {
                    eyebrow: eyebrow ? eyebrow.textContent.trim() : null,
                    eyebrowCase: eyebrow ? getComputedStyle(eyebrow).textTransform : null,
                    eyebrowSize: eyebrow ? parseFloat(getComputedStyle(eyebrow).fontSize) : null,
                    eyebrowColour: eyebrow ? getComputedStyle(eyebrow).color : null,
                    title: title.textContent.trim(),
                    titleTag: title.localName,
                    titleSize: parseFloat(getComputedStyle(title).fontSize),
                    rowHeadingSize: heading ? parseFloat(getComputedStyle(heading).fontSize) : null,
                    gapToTitle: eyebrow && title
                        ? title.getBoundingClientRect().top - eyebrow.getBoundingClientRect().bottom
                        : null,
                    gapToFirstRow: title && rows[0]
                        ? rows[0].getBoundingClientRect().top - title.getBoundingClientRect().bottom
                        : null,
                };
            });

            test('the eyebrow is the nav tree\'s category, in the microcap role', async () => {
                await showLeaf('calibration', 'calibration-load-cells');
                const got = await header();
                assert.equal(got.eyebrow, 'Calibration');
                assert.equal(got.eyebrowCase, 'uppercase', 'the eyebrow takes .ui-microcap');
                assert.equal(got.eyebrowColour, await page.resolveToken('--ui-muted', 'color'));

                await showLeaf('machine', 'machine-steam');
                assert.equal((await header()).eyebrow, 'Machine');
                await showLeaf('display', 'display-screen');
                assert.equal((await header()).eyebrow, 'Display');
            });

            test('the title is the LARGER role, and it out-ranks a row heading again', async () => {
                await showLeaf('calibration', 'calibration-load-cells');
                const got = await header();
                assert.equal(got.titleTag, 'h2', 'still one h2 per leaf');
                /* NAMED, NOT A LITERAL: --ui-text-xl is what .ui-title carries and what
                 * the oracle measured at 28. The assertion reads the token so the
                 * density scale can still move it. */
                near(got.titleSize, parseFloat(await page.resolveToken('--ui-text-xl', 'font-size')),
                    'the leaf title takes .ui-title');
                assert.ok(got.titleSize > got.rowHeadingSize,
                    `the page title (${got.titleSize}) must out-rank a row heading (${got.rowHeadingSize})`);
                /* The rename STAYS: one naming path, the nav tree's own word. */
                assert.equal(got.title, 'Load Cells');
            });

            test('the pair reads as one block: tighter inside than between blocks', async () => {
                await showLeaf('machine', 'machine-steam');
                const got = await header();
                near(got.gapToTitle, parseFloat(await page.resolveToken('--ui-space-1', 'width')),
                    'the eyebrow and its title are --ui-space-1 apart');
                assert.ok(got.gapToFirstRow > got.gapToTitle,
                    `the header block must be tighter than the leaf rhythm: ${got.gapToTitle} vs ${got.gapToFirstRow}`);
            });
        });

        /* ═══════════════════════════════════════════════════════════════════
         * 3e. THE 1px SEPARATOR STAGGER (Ben-reported, measured 21 Aug 2026)
         *
         * Nav separators at y = 384 / 473 / 562 / 651 against sub-nav
         * 385 / 474 / 563 / 652: one pixel, every row, both columns 89px pitch.
         * The head track was `auto` and collapsed in the sub-nav instance, so the
         * lists were 88px apart against a 89px pitch — 88 mod 89 = one pixel short,
         * for ever.
         * ═════════════════════════════════════════════════════════════════ */

        describe('the two nav lists share a rhythm AND an origin', () => {
            const columns = () => page.evalFn(() => {
                const root = document.querySelector('settings-screen').shadowRoot;
                const out = {};
                for (const column of root.querySelectorAll('settings-nav-column')) {
                    const rows = [...column.querySelectorAll('ui-nav-row, ui-subnav-row')]
                        .map((row) => row.getBoundingClientRect());
                    const box = column.getBoundingClientRect();
                    out[column.getAttribute('slot')] = {
                        showing: box.width > 0 && box.height > 0,
                        origin: rows.length ? rows[0].top : null,
                        pitch: rows.length > 1 ? rows[1].top - rows[0].top : null,
                        /* A separator is the 1px the grid gap leaves between two rows:
                         * the bottom of one, which is also the top of the gap. */
                        separators: rows.slice(0, -1).map((row) => Math.round(row.bottom)),
                    };
                }
                return out;
            });

            test('both lists start at the same y, so every separator lands on one line', async () => {
                await showLeaf('machine', 'machine-steam');
                const got = await columns();
                assert.ok(got.nav && got.subnav, 'both columns must exist');

                /* THE COLLAPSED BRANCH SHOWS ONE COLUMN AT A TIME (§4.4's two-column
                 * layout below 1100), so there are no two lists to line up and the
                 * question is not asked at the floor. Asserted rather than skipped: a
                 * geometry where BOTH are hidden would be a different bug, and a
                 * geometry where both show is the wide branch and must be measured. */
                if (!got.nav.showing || !got.subnav.showing) {
                    assert.notEqual(got.nav.showing, got.subnav.showing,
                        'the collapsed branch shows exactly one nav column');
                    return;
                }

                assert.equal(got.nav.pitch, got.subnav.pitch, 'one pitch, by construction (T2)');
                near(got.nav.origin, got.subnav.origin, 'the two lists start at the same y', 0.51);

                /* THE REPORTED SYMPTOM, AS A NUMBER. Every separator the two lists have
                 * in common must be the same y — not one apart, which is what a reader
                 * sees as a stagger and what nothing in this suite could see before. */
                const shared = Math.min(got.nav.separators.length, got.subnav.separators.length);
                assert.ok(shared >= 3, 'not enough rows in both columns to compare');
                assert.deepEqual(
                    got.nav.separators.slice(0, shared),
                    got.subnav.separators.slice(0, shared),
                    'the nav and sub-nav separators must land on the same lines',
                );
            });
        });

        /* ═══════════════════════════════════════════════════════════════════
         * 4. T15 — THE ACCESSIBILITY CLUSTER
         * ═════════════════════════════════════════════════════════════════ */

        describe('T15: real semantics, named switches, and no dialog', () => {
            test('EVERY switch the screen can show has an accessible name', async () => {
                const switches = await switchWalk(page);
                assert.ok(switches.length >= 5, `expected the screen\'s switches; found ${switches.length}`);
                for (const found of switches) {
                    assert.notEqual(found.name, '',
                        `a switch in ${found.leaf} has no accessible name — T15's own "four of twenty"`);
                }
            });

            test('the screen is not a dialog, at any depth', async () => {
                const dialogs = await page.evalFn(() => {
                    const walk = (root, acc) => {
                        for (const el of root.querySelectorAll('*')) {
                            if (el.getAttribute && el.getAttribute('role') === 'dialog') acc.push(el.localName);
                            if (el.shadowRoot) walk(el.shadowRoot, acc);
                        }
                        return acc;
                    };
                    return walk(document, []);
                });
                assert.deepEqual(dialogs, [],
                    'T15: role="dialog" on a full-screen, always-present, non-dismissible page');
            });

            test('selection carries aria-current, and it moves with the selection', async () => {
                await showLeaf('machine', 'machine-flush');
                const current = await page.evalFn(() => {
                    const root = document.querySelector('settings-screen').shadowRoot;
                    return [...root.querySelectorAll('#subnav ui-subnav-row')]
                        .map((row) => ({
                            id: row.dataset.id,
                            current: row.shadowRoot.querySelector('[aria-current]')?.getAttribute('aria-current') ?? null,
                        }))
                        .filter((row) => row.current !== null);
                });
                assert.deepEqual(current.map((row) => row.id), ['machine-flush'],
                    'exactly one row is current, and it is the selected one');
            });

            test('M9: tabbing walks the leaf pane in the order the rows are drawn', async () => {
                await showLeaf('machine', 'machine-flush');
                /* REAL KEY EVENTS through CDP, not `.focus()` and not a synthetic click:
                 * T15's navigation clause is that focus never moved because the old page
                 * drove itself with `.click()`. What is asserted here is that focus DOES
                 * move, through the rows, in DOM order. */
                await page.evalFn(() => {
                    const stepper = document.querySelector('settings-screen').shadowRoot
                        .getElementById('leaf').shadowRoot.querySelector('ui-settings-row ui-stepper');
                    (stepper.shadowRoot.querySelector('button') ?? stepper).focus();
                    return true;
                });
                const walk = [];
                for (let i = 0; i < 8; i += 1) {
                    walk.push((await focusWalk(page, 1))[0]);
                    await page.press('Tab');
                }
                const rows = walk.map((step) => step.row).filter(Boolean);
                assert.ok(rows.length >= 3, `focus never entered the rows: ${JSON.stringify(walk)}`);
                const order = [...new Set(rows)];
                assert.deepEqual(order, order.slice().sort((a, b) => {
                    const ids = ['machine-flush-temp', 'machine-flush-flow', 'machine-flush-duration'];
                    return ids.indexOf(a) - ids.indexOf(b);
                }), `tab order does not follow the rows: ${order.join(' -> ')}`);
            });
        });

        /* ═══════════════════════════════════════════════════════════════════
         * 5. C6 — THE CONTROL MOVES THE TOKENS AND MAKES NO SCROLLER
         * ═════════════════════════════════════════════════════════════════ */

        describe('C6: display size drives the tokens, not a canvas transform', () => {
            const readDensity = () => page.evalFn(() => ({
                density: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-density')),
                base: getComputedStyle(document.documentElement).getPropertyValue('--ui-density-base').trim(),
                text: getComputedStyle(document.documentElement).getPropertyValue('--ui-text-base').trim(),
                navRow: getComputedStyle(document.documentElement).getPropertyValue('--ui-nav-row').trim(),
                docScrollWidth: document.documentElement.scrollWidth,
                docClientWidth: document.documentElement.clientWidth,
                transform: getComputedStyle(document.body).transform,
                headingType: getComputedStyle(
                    document.querySelector('settings-screen').shadowRoot
                        .getElementById('leaf').shadowRoot.getElementById('leaf-heading'),
                ).fontSize,
            }));

            const pick = (value) => page.evalFn(async (v) => {
                await window.__settings.change('display-display-size-density', v);
                return true;
            }, value);

            /* ═══════════════════════════════════════════════════════════════
             * THE BRIGHTNESS SLIDER — MOVED HERE 28 AUGUST 2026
             *
             * These two assertions were written against a BESPOKE leaf and they are the
             * whole reason that leaf could be retired safely: they pin the floor and they
             * pin which value the control shows. `ARCHETYPE.SLIDER` made the page
             * primitive, so the tests move to the primitive suite unchanged in what they
             * claim — only in where they look for the control.
             * ═══════════════════════════════════════════════════════════════ */
            const brightnessSlider = () => page.evalFn(() => {
                const leaf = document.querySelector('settings-screen').shadowRoot.getElementById('leaf');
                const row = leaf.shadowRoot.querySelector('ui-settings-row[data-row="display-screen-brightness"]');
                const slider = row?.querySelector('ui-slider') ?? row?.shadowRoot?.querySelector('ui-slider');
                if (!slider) return null;
                return {
                    min: slider.min,
                    max: slider.max,
                    value: slider.value,
                    valueText: slider.getAttribute('value-text'),
                    /* THE ROW CARRIES THE SENTENCE AS AN ATTRIBUTE, so it is read from the
                     * row and not from the leaf's text: `settings-leaf.js` passes
                     * `caption=` to <ui-settings-row>, which draws it inside its own
                     * shadow root. Reading the leaf's textContent finds nothing and would
                     * have failed a rule that holds. */
                    caption: (row.getAttribute('caption') || '').includes('never goes dark by accident'),
                };
            });

            test('the slider FLOORS at 10, which is what its own caption promises', async () => {
                /* A DECLARED BEHAVIOUR WITH NOTHING BACKING IT — the fork's own defect
                 * class. The slider ran 0..100 under a caption reading "The lowest setting
                 * stays readable, so the screen never goes dark by accident." Drag it to
                 * the left end and the screen went dark, which is what the sentence says
                 * cannot happen — and on a kiosk tablet the control you would need to undo
                 * it is now invisible. Slate is explicit: BRIGHTNESS_FLOOR = 10.
                 *
                 * THE SENTENCE IS THE SPECIFICATION, so this asserts the caption too. The
                 * band is `screenBrightness` in `machine-limits.js` and reaches the control
                 * through the row's bounds, so it is stated once and typed nowhere. */
                await page.evalFn(() => window.__settings.displayFrame(null));
                await showLeaf('display', 'display-screen');
                const report = await brightnessSlider();
                assert.ok(report, 'the brightness row draws a ui-slider');
                assert.equal(report.min, 10, 'the band is named in machine-limits.js, not typed here');
                assert.equal(report.max, 100);
                assert.equal(report.caption, true, 'the promise the floor exists to keep');
            });

            test('the slider shows the PANEL brightness, not the stored number', async () => {
                /* O2 AND A7 IN ONE LINE, and it survives the move to a registry row
                 * because a ROUTE row already prefers a panel's served value over its
                 * stored key — the same rule the wake lock below it runs on. The visible
                 * cost of getting it wrong is real: with ReaPrime's low-battery clamp
                 * active the panel is held at 20 and the slider went on claiming 100. */
                /* THE FRAME IS ARMED BEFORE THE LEAF IS SHOWN. A bespoke page read its
                 * feed during render, so arming it afterwards was enough; a REGISTRY row's
                 * view is computed when the leaf opens, so the panel has to have answered
                 * by then. The order is the difference between measuring the rule and
                 * measuring the fallback. */
                await page.evalFn(() => window.__settings.displayFrame({
                    brightness: 20, requestedBrightness: 100,
                }));
                await showLeaf('display', 'display-screen');
                const served = await brightnessSlider();
                assert.equal(Number(served.value), 20,
                    'the panel says 20 and the row must say 20, not the 100 that was asked for');
                assert.match(String(served.valueText), /20/, 'and the printed value agrees with it');
            });

            test('the four labels are the control, and it is a bank', async () => {
                await showLeaf('display', 'display-screen');
                const rows = await rowReport(page);
                assert.equal(rows[0].control[0].tag, 'ui-bank');
                const labels = await page.evalFn(() => {
                    const leaf = document.querySelector('settings-screen').shadowRoot.getElementById('leaf');
                    const bank = leaf.shadowRoot.querySelector('ui-bank');
                    return [...bank.shadowRoot.querySelectorAll('[role="radio"], .item')]
                        .map((el) => el.textContent.trim()).filter(Boolean);
                });
                assert.deepEqual(labels, ['Small', 'Fit screen', 'Larger', 'Largest']);
            });

            test('choosing a step moves --ui-density and the type scale, and nothing else', async () => {
                await showLeaf('display', 'display-screen');
                const before = await readDensity();
                await pick('larger');
                await page.settle();
                const after = await readDensity();

                near(after.density, before.density * 1.1, 'the base multiplies the band, it does not replace it', 0.01);
                assert.equal(after.base, '1.1');
                assert.equal(after.transform, before.transform, 'no canvas transform: C6 retires that mechanism');

                /* THE TYPE SCALE, MEASURED WHERE IT LANDS. A custom property carrying a
                 * calc() reads back as the calc() itself, so the honest question is what
                 * the ENGINE drew: the leaf heading's rendered font-size. */
                assert.ok(parseFloat(after.headingType) > parseFloat(before.headingType),
                    `the type scale moved with it: ${before.headingType} -> ${after.headingType}`);
            });

            test('and it produces no viewport scroller — the old control\'s defect', async () => {
                await showLeaf('display', 'display-screen');
                await pick('largest');
                await page.settle();
                const state = await readDensity();
                assert.ok(state.docScrollWidth <= state.docClientWidth + 1,
                    `above 1.0 the old control turned the viewport into a scroller: ${state.docScrollWidth} > ${state.docClientWidth}`);
            });

            /* THE REFUSED BRANCH. `pick()` always succeeds, so nothing above ever asks
             * what the preview does when the STORE SAID NO — quota, private mode, a
             * wedged backend (settings-store reason BACKEND_FAILED). `ok` rides along on
             * leaf-change for exactly this, and the listener has to read it: a refused
             * write that still repaints the root leaves the app at a size the stored
             * preference does not contain, and the boot-time apply reverts it later with
             * no explanation — the units.js silent-revert class B7 exists to stop. */
            const announce = (ok) => page.evalFn((detail) => {
                const leaf = document.querySelector('settings-screen').shadowRoot.getElementById('leaf');
                leaf.dispatchEvent(new CustomEvent('leaf-change', {
                    detail, bubbles: true, composed: true,
                }));
                return true;
            }, { row: 'display-display-size-density', value: 'largest', ok });

            test('a REFUSED density write does not repaint the root', async () => {
                await showLeaf('display', 'display-screen');
                await pick('larger');
                await page.settle();
                const stored = await readDensity();
                assert.equal(stored.base, '1.1', 'precondition: a stored choice is showing');

                await announce(false);
                await page.settle();
                const after = await readDensity();

                assert.equal(after.base, stored.base,
                    'a write the store refused must not move --ui-density-base');
                near(after.density, stored.density, 'nor the composed density', 0.001);
                assert.equal(after.headingType, stored.headingType, 'nor the type scale');
            });

            test('and the same announcement WITH ok repaints it, so the guard is not just dead', async () => {
                await showLeaf('display', 'display-screen');
                await pick('larger');
                await page.settle();
                const stored = await readDensity();

                await announce(true);
                await page.settle();
                const after = await readDensity();

                assert.notEqual(after.base, stored.base, 'a stored change still previews');
                assert.equal(after.base, '1.2', 'largest lands, so the refusal test proves a guard rather than a no-op');
            });

            test('the band still multiplies the choice at the short-window geometry', async () => {
                /* At FLOOR (600px tall) the height band is 0.875. The whole point of the
                 * split is that a chosen 1.1 becomes 0.9625, not 0.875 — "so a user choice
                 * survives a short window" (Part 2 §5 rule 2). */
                await showLeaf('display', 'display-screen');
                await pick('larger');
                await page.settle();
                const state = await readDensity();
                const band = geometry.height < 700 ? 0.875 : 1;
                near(state.density, 1.1 * band, 'base x band', 0.01);
            });

            test('RECORDED: the ch measure does not move with the type scale yet', async () => {
                /* THE FINDING, PINNED RATHER THAN FIXED. `--ui-measure-wide` is `84ch`
                 * and the token sheet's comment claims that is "what makes it survive C6:
                 * the density and type-scale control moves --ui-text-base, and a measure
                 * in ch moves with the type it is a measure OF". Half of that is true
                 * today: the token IS in ch. But `ch` resolves against the FONT OF THE
                 * ELEMENT the cap is applied to, and nothing in the chain down to the
                 * leaf sets a token-driven font-size — `styles/document.css` gives `html`
                 * a family and a leading and no size — so the cap is computed against the
                 * UA's 16px and does not move.
                 *
                 * NOT FIXED HERE, DELIBERATELY: the remedy is one declaration on the leaf
                 * pane (`font-size: var(--ui-text-base)`), which is another row's file and
                 * changes the inherited type of every leaf's content. It costs nothing
                 * visible today — on this hardware the pane is narrower than 84ch, so the
                 * cap never binds — and it is recorded as a deferred question. This test
                 * asserts the CURRENT behaviour so the day someone fixes it, it says so.  */
                await showLeaf('display', 'display-screen');
                await pick('fit-screen');
                await page.settle();
                const atOne = parseFloat(await page.resolveToken('--ui-measure-wide', 'block-size'));
                await pick('largest');
                await page.settle();
                const atLargest = parseFloat(await page.resolveToken('--ui-measure-wide', 'block-size'));
                assert.equal(atLargest, atOne,
                    'the measure moved — the pane now carries a token-driven font-size, so lift this pin');
                const leaf = await page.box(LEAF);
                const pane = await page.box(LEAF_PANE);
                assert.ok(leaf.width <= pane.width, 'and the cap still never binds on this hardware');
                await pick('fit-screen');
                await page.settle();
            });
        });

        /* ═══════════════════════════════════════════════════════════════════
         * 6. D11 — THE COUNT REACHES #31, WHICH OWNS THE WORDS
         * ═════════════════════════════════════════════════════════════════ */

        describe('D11: the screen supplies a count and the band says the sentence', () => {
            const bandText = () => page.evalFn(() => {
                const band = document.querySelector('settings-screen').shadowRoot.getElementById('band');
                return {
                    commit: band.shadowRoot.getElementById('save')?.textContent.trim()
                        ?? band.shadowRoot.querySelector('#commit, [part~="commit"]')?.textContent.trim() ?? '',
                    all: band.shadowRoot.textContent.replace(/\s+/g, ' ').trim(),
                    count: band.changeCount,
                };
            });

            test('a stored preference never makes the band dirty', async () => {
                /* THIS CASE WAS DRIVING A ROW THAT NO LONGER EXISTS, and it passed anyway.
                 *
                 * It used to call `change('help-quickstart-guide-button', true)` on the
                 * Quickstart leaf. That toggle was DELETED with rows 267/268, and the
                 * fixture's `change()` answers `false` and does nothing when it cannot
                 * find the row — silently, because a driver that threw on a missing row
                 * would be a driver no test could use to prove a row is absent. So this
                 * case went on asserting `count === 0` on a page where nothing had been
                 * touched: a guard that cannot fail, which is worse than no guard and is
                 * the same rule that retired the toggle in the first place.
                 *
                 * THE RETURN VALUE IS NOW ASSERTED, which is the half that makes the rest
                 * mean anything: the day THIS row is deleted the case turns red and names
                 * itself, instead of quietly measuring an untouched screen.
                 *
                 * THE ROW IT DRIVES IS A PLAIN STORED SWITCH. `display-screen-saver-enabled`
                 * is SOURCE.ROUTE with no machine door and no panel door behind it, so the
                 * write goes to the storage router and to nothing else — which is exactly
                 * the quantity this case is about. */
                await showLeaf('display', 'display-screen-saver');
                const changed = await page.evalFn(
                    () => window.__settings.change('display-screen-saver-enabled', false),
                );
                assert.equal(changed, true,
                    'the case drives a row that no longer exists — repoint it at a stored switch');
                await page.settle();
                const band = await bandText();
                assert.equal(band.count, 0);
                /* CLEAN IS "SAVE" WITHOUT A COUNT, not "Close" (Ben, 25 Aug 2026). He
                 * chose Slate's header for both committing screens: Slate shows Cancel
                 * and a filled Save whether or not anything has changed, and D11's "Close
                 * alone at zero" was the departure. What is asserted here is unchanged —
                 * a STORED preference writes at once and must never put a number on the
                 * band — and the count is what says so. */
                assert.match(band.all, /Save/, 'the band still offers Save, and #31 owns the word');
                assert.doesNotMatch(band.all, /Save \(/, 'with no count, because nothing is staged');
            });

            test('two staged machine fields reach the band as "Save (2)"', async () => {
                await showLeaf('machine', 'machine-flush');
                await page.evalFn(async () => {
                    await window.__settings.change('machine-flush-temp', 88);
                    await window.__settings.change('machine-flush-flow', 4);
                    return true;
                });
                await page.settle();
                const band = await bandText();
                assert.equal(band.count, 2, 'the count crosses, and nothing else');
                assert.match(band.all, /Save \(2\)/, 'the sentence is #31\'s, built from the count');
                assert.match(band.all, /Cancel/, 'and Cancel appears beside it');
            });

            test('the staged row is marked, and shows what you asked for', async () => {
                await showLeaf('machine', 'machine-flush');
                const rows = await rowReport(page);
                const staged = rows.filter((row) => row.staged).map((row) => row.id);
                assert.deepEqual(staged, ['machine-flush-temp', 'machine-flush-flow']);
            });

            test('Cancel drops them and the band loses its count', async () => {
                await page.evalFn(() => {
                    const band = document.querySelector('settings-screen').shadowRoot.getElementById('band');
                    band.shadowRoot.querySelector('#cancel, [part~="cancel"]')?.click();
                    return true;
                });
                await page.settle();
                const band = await bandText();
                assert.equal(band.count, 0);
                assert.doesNotMatch(band.all, /Save \(/, 'the count is gone with the staged edits');
                assert.match(band.all, /Save/, 'and Slate\'s pair stays — Ben, 25 Aug 2026');
            });
        });

        /* ═══════════════════════════════════════════════════════════════════
         * 7. D8 / D4 — THE WAY OUT, AND THE LEAF THAT KEEPS ITS ENTRY
         * ═════════════════════════════════════════════════════════════════ */

        describe('D8 and the D4 boundary, on screen', () => {
            test('D8 is one button, on a settings row, keeping its own name', async () => {
                await showLeaf('display', 'display-skin');
                const rows = await rowReport(page);
                const leave = rows.find((row) => row.id === 'display-skin-leave');
                assert.ok(leave, 'the way out of the skin is on screen');
                assert.equal(leave.control.length, 1);
                assert.equal(leave.control[0].tag, 'ui-button');
                assert.equal(leave.control[0].name, 'Leave',
                    'rule 0: a control that names itself keeps its name (WCAG 2.5.3)');
            });

            test('pressing it asks the screen once, and opens no dialog', async () => {
                await showLeaf('display', 'display-skin');
                const result = await page.evalFn(() => {
                    const screen = document.querySelector('settings-screen');
                    const asked = [];
                    screen.exit = (href) => asked.push(href);
                    const leaf = screen.shadowRoot.getElementById('leaf');
                    const row = leaf.shadowRoot.querySelector('[data-row="display-skin-leave"]');
                    row.querySelector('ui-button').click();
                    return { asked, dialogs: leaf.shadowRoot.querySelectorAll('ui-dialog, ui-confirm-dialog').length };
                });
                assert.equal(result.asked.length, 1, 'one control, one navigation');
                assert.equal(result.dialogs, 0, 'no new dialog shape');
                assert.match(result.asked[0], /^https?:/, 'it leaves for a real place');
            });

            test('D4 reversed: the firmware leaf carries real controls', async () => {
                /* D4 said "no firmware-update feature, and the hand-picked file upload is
                 * removed, not carried". Ben reversed it on 24 August 2026: "I should be
                 * able to pick a file, but it should also have a 'latest' button that
                 * pulls it." The note that stood in for the feature is gone with it.
                 *
                 * THE MOCK ANSWERS THE CATALOG 503, so what this measures is the leaf's
                 * ABSENT state — which is the state that used to hold the note. It must
                 * now say the machine has not answered rather than that Decal does not
                 * do this; the controls themselves are measured against the catalog in
                 * `test/firmware.test.mjs` and on the bench. */
                await showLeaf('updates', 'updates-firmware-update');
                const rows = await rowReport(page);
                assert.deepEqual(rows, [], 'it is not a settings ROW — a catalog is a bespoke layout');
                const seen = await page.evalFn(() => {
                    const screen = document.querySelector('settings-screen').shadowRoot;
                    /* THE PAIR. <settings-leaf> renders the heading and the registry rows
                     * for all thirty-seven; <settings-bespoke-leaf> is its sibling and
                     * renders the layout the ten need. They are two elements, not one. */
                    const leaf = screen.getElementById('leaf');
                    const root = screen.getElementById('bespoke')?.shadowRoot ?? null;
                    return {
                        note: leaf.shadowRoot.getElementById('note')?.textContent.trim() ?? null,
                        empty: root?.getElementById('firmware-empty') ? true : false,
                        text: (root?.textContent ?? '').replace(/\s+/g, ' ').trim(),
                    };
                });
                assert.equal(seen.note, null, 'the D4 sentence is gone with the decision');
                assert.equal(seen.empty, true, 'with no catalog it says the machine has not answered');
                assert.doesNotMatch(seen.text, /does not send firmware/i);
            });

            /* THE WHOLE CUP-WARMER PAGE DRAWS, AND IT USED TO DRAW TWO ROWS OF FIVE.
             *
             * This case previously asserted that under an UNKNOWN capability the leaf
             * rendered only "Pre-warm before wake-up" and "Start this long before" — three
             * rows carried `capability: 'cupWarmer'` and two did not, and `gateCapability`
             * fails closed on UNKNOWN as well as ABSENT. That is a page about a warmer with
             * no warmer on it, and this fixture's capability store is DELIBERATELY never
             * loaded, so it was the ordinary state rather than an edge one.
             *
             * IT WAS A SPLIT GATE, AND ONE LEAF MUST HAVE ONE VERDICT. ReaPrime returns
             * `cupWarmer` and `preheat` together for any `BengleInterface` and 404s both
             * routes together for anything else (`de1handler.dart:38-54, :632-637`), so
             * there is no machine on which three of these rows belong and two do not. The
             * gate that remains is the route's own answer: `cup-warmer.js` publishes
             * `status: UNSUPPORTED` on a 404 and every field goes absent with it, so a
             * machine with no warmer draws a page of dashes — which is A7's shape for "the
             * machine did not say", and is a state this screen has to render anyway.
             *
             * A3 IS STILL ASSERTED, on `machine-sleep-wake-schedules`, whose two registry
             * rows are BOTH gated and whose bespoke half is not a row at all — see
             * `test/settings-leaves.test.mjs`. */
            test('the capability list does not decide this leaf: five rows, or none', async () => {
                await showLeaf('accessories', 'accessories-cup-warmer');
                const rows = await rowReport(page);
                assert.deepEqual(rows.map((row) => row.id), [
                    'accessories-cup-warmer-enabled',
                    'accessories-cup-warmer-target',
                    'accessories-cup-warmer-now',
                    'accessories-cup-warmer-prewarm',
                    'accessories-cup-warmer-prewarm-lead',
                ], 'the whole page draws even with the capability list unread');
            });
        });

        /* ════════════════════════════════════════════════════════════════════
         * 8e. AN UNSAVED EDIT IS MARKED ON ITS OWN ROW
         * ═══════════════════════════════════════════════════════════════════ */

        describe('a staged row says so', () => {
            /* `data-staged` was written on every row from the day the commit model was
             * built and NO rule in src/ or styles/ matched it — an attribute that painted
             * nothing. So the Save button carried a count and there was no way to find out
             * WHICH of your edits it was counting. The behaviour audit filed it as a half
             * with no other half, and Slate has the mirror image: it designed a dirty dot
             * (slate-components.css:747) and never wired it either.
             *
             * THE MARK IS A ::after ON THE HOST, so this reads the pseudo-element rather
             * than looking for an extra node. There is no extra node, and that is the
             * point: #29 owns its own layout, and whether a row is staged is the commit
             * model's business, not the row's. */
            const markOn = (rowId) => page.evalFn((id) => {
                const leaf = document.querySelector('settings-screen').shadowRoot.getElementById('leaf');
                const row = leaf.shadowRoot.querySelector(`ui-settings-row[data-row="${id}"]`);
                const cs = getComputedStyle(row, '::after');
                return {
                    staged: row.hasAttribute('data-staged'),
                    content: cs.content,
                    width: cs.inlineSize,
                    radius: cs.borderTopLeftRadius,
                    ink: cs.backgroundColor,
                };
            }, rowId);

            test('no mark until something is staged, then a dot on that row alone', async () => {
                await page.evalFn(() => { window.__settings.model().discard(); return true; });
                await showLeaf('machine', 'machine-flush');

                const before = await markOn('machine-flush-duration');
                assert.equal(before.staged, false);
                assert.equal(before.content, 'none', 'a clean row carries no mark');

                await page.evalFn(() => window.__settings.change('machine-flush-duration', 9)
                    .then(() => true));
                await page.settle();

                const after = await markOn('machine-flush-duration');
                assert.equal(after.staged, true);
                assert.notEqual(after.content, 'none', 'the staged row is marked');
                /* ROUND, ASSERTED AS A SHAPE RATHER THAN AS ONE SPELLING OF IT.
                 *
                 * This read `radius === '50%'`, Slate's own literal, until 27 August 2026.
                 * The rule now says `var(--ui-radius-pill)` and draws exactly the same dot:
                 * ui-status-chip.js records the skin's mapping for this shape - "spec
                 * section 3.4 records that any value greater than or equal to half the
                 * height does the same for a pill" - and fourteen live rules in src/ round
                 * a disc through that token, this one having been the only holdout. The
                 * spelling changed because a bare percentage in a settings leaf trips the
                 * leaf-local-number guard, which cannot tell a shape from a setting's
                 * bounds.
                 *
                 * SO THE CLAIM IS SECTION 3.4'S OWN, which is the claim the test was always
                 * making: a radius of at least half the box is a circle, and it stays true
                 * whichever of the two ways the rule is written.
                 *
                 * IN PIXELS, AND THE UNIT IS PART OF THE ASSERTION. A computed radius comes
                 * back as a px length or as the percentage as written, so comparing bare
                 * numbers would read "10%" on an 8px box as a radius of ten and call a
                 * barely-softened square a circle. Requiring px is what makes the
                 * comparison mean what it says; a rule that went back to a percentage would
                 * fail here and be re-argued rather than slip through. */
                assert.match(after.radius, /px$/,
                    `the dot's radius computed as ${after.radius} — a length is what this `
                    + 'measurement can be compared against');
                const radiusPx = Number.parseFloat(after.radius);
                const widthPx = Number.parseFloat(after.width);
                assert.ok(Number.isFinite(radiusPx) && Number.isFinite(widthPx) && widthPx > 0,
                    `the dot has no measurable box: radius ${after.radius}, width ${after.width}`);
                assert.ok(radiusPx >= widthPx / 2,
                    `the mark is a ${after.radius} radius on a ${after.width} box — `
                    + 'Slate\'s own treatment is a ROUND dot');
                /* A NEUTRAL INK, not a warning colour: an unsaved edit is a STATE, not a
                 * problem. Compared against the resolved token so the claim is true in
                 * both themes. */
                const muted = await page.evalFn(() => {
                    const probe = document.createElement('span');
                    probe.style.color = 'var(--ui-muted)';
                    document.body.append(probe);
                    const value = getComputedStyle(probe).color;
                    probe.remove();
                    return value;
                });
                assert.equal(after.ink, muted, 'the dot is --ui-muted');

                /* THE ROW BESIDE IT IS UNTOUCHED. A mark on every row would say nothing. */
                const neighbour = await markOn('machine-flush-temp');
                assert.equal(neighbour.staged, false);
                assert.equal(neighbour.content, 'none');
            });

            test('discarding takes the mark with the edit', async () => {
                await page.evalFn(() => window.__settings.change('machine-flush-duration', 8)
                    .then(() => true));
                await page.settle();
                assert.equal((await markOn('machine-flush-duration')).staged, true);

                await page.evalFn(() => { window.__settings.model().discard(); return true; });
                await page.settle();
                const cleared = await markOn('machine-flush-duration');
                assert.equal(cleared.staged, false, 'Cancel throws the edit away');
                assert.equal(cleared.content, 'none', 'and the mark goes with it');
            });
        });

        /* ════════════════════════════════════════════════════════════════════
         * 8d. SAVE LEAVES ON SUCCESS AND STAYS ON A REFUSAL
         * ═══════════════════════════════════════════════════════════════════ */

        describe('the band gets you out, and a refused save does not', () => {
            /* BEN, ON THE TABLET: "the cancel button in Settings is not working, only save
             * can exit." The four-cell matrix is pinned in the skeleton suite, which has
             * the band and no model; this is the half that needs a model — a DIRTY save,
             * which has to write first and leave only if the machine took it.
             *
             * LEAVING ON A REFUSED WRITE would carry a person off the page with their
             * change still staged and nothing said, which is the silent loss B7 exists to
             * prevent. `commit()` has always reported `{ok, reason}`; this screen used to
             * discard it, and the behaviour audit filed that as a half with no other half. */
            const press = (button) => page.evalFn(async (which) => {
                const screen = document.querySelector('settings-screen');
                const seen = [];
                const listener = (event) => seen.push(event.detail?.route ?? null);
                document.addEventListener('navigate', listener);
                screen.shadowRoot.getElementById('band').shadowRoot.getElementById(which).click();
                await new Promise((r) => setTimeout(r, 30));
                document.removeEventListener('navigate', listener);
                await screen.updateComplete;
                return {
                    left: seen,
                    refusal: screen.shadowRoot.getElementById('commit-refusal')?.textContent.trim() ?? null,
                    count: screen.changeCount,
                };
            }, button);

            const stageOne = async () => {
                await showLeaf('machine', 'machine-flush');
                await page.evalFn(() => window.__settings.change('machine-flush-duration', 9).then(() => true));
                await page.settle();
            };

            test('a save the machine takes writes it and leaves', async () => {
                await page.evalFn(() => { window.__settings.refuseWrites(false); return true; });
                await stageOne();
                const said = await press('save');
                assert.deepEqual(said.left, ['live'], 'Save leaves once the write lands');
                assert.equal(said.refusal, null, 'and says nothing, because nothing went wrong');
                assert.equal(said.count, 0, 'the staged count is cleared by the commit');
            });

            test('a save the machine refuses STAYS, and says why', async () => {
                await page.evalFn(() => { window.__settings.refuseWrites(true); return true; });
                await stageOne();
                const said = await press('save');
                assert.deepEqual(said.left, [], 'a refused write must not navigate away');
                assert.match(String(said.refusal), /refused|busy|not connected/i,
                    'and the reason is on the page, not in a log nobody reads');
                /* THE CHANGE IS STILL HERE. `commit()` leaves the staged Map alone on a
                 * failure, so the count is still on the button and Save can be pressed
                 * again once the machine is back. */
                assert.ok(said.count > 0, 'the staged change survives the refusal');
                await page.evalFn(() => { window.__settings.refuseWrites(false); return true; });
                await page.evalFn(() => { window.__settings.model().discard(); return true; });
            });
        });

        /* ════════════════════════════════════════════════════════════════════
         * 8c. FAHRENHEIT — shown in the chosen unit, held in the machine's
         * ═══════════════════════════════════════════════════════════════════ */

        describe('a temperature is drawn in the unit the person chose', () => {
            /* THE PREFERENCE HAD NO READER. `units.js` carried the whole conversion — four
             * policy functions, a store, a formatter — and `createUnitsStore` had ZERO
             * callers in src/, so every temperature in the skin was drawn in Celsius
             * whatever the Temperature bank said. Found 26 August 2026 by sweeping every
             * settings row for something on the other end.
             *
             * A MISMATCH WOULD HAVE MADE THE WIRING SILENTLY INERT, and it is worth naming
             * because a green suite would have hidden it: the bank stores LOWERCASE 'c' /
             * 'f' and the module's constants are uppercase, so `normaliseUnit` answered
             * null for every value the app can actually store. It is case-insensitive now.
             *
             * BEN'S TWO RULES ARE BOTH ASSERTED. "Rounding to same decimal place as the
             * original value" — 322 °F, not 321.8, on a band that steps by a whole degree.
             * "Reverse conversion to go back to the machine" — the staged patch is exactly
             * 161, with no floating-point residue on the wire. */
            /* THE MACHINE CLASS HAS TO BE KNOWN, or the steam row has no band at all —
             * its ceiling is machine-dependent and A7 refuses a stand-in, so with no
             * served capability there is no hint element to read. */
            const serveClass = () => page.evalFn(() => window.__settings.capabilities(['cupWarmer'])
                .then(() => true));

            /* EACH CASE STARTS FROM THE MACHINE'S OWN VALUE. The model is shared across
             * this file and a staged edit survives a leaf change by design — that is the
             * commit model working — so a test that pressed + leaves 161 behind for the
             * next one. Discarding is what "as the machine holds it" means here. */
            const pickUnit = async (unit) => {
                await page.evalFn(() => { window.__settings.model().discard(); return true; });
                await serveClass();
                await showLeaf('units-language', 'units-language-units');
                await page.evalFn((u) => window.__settings.change('units-language-temperature-unit', u)
                    .then(() => true), unit);
                await page.settle();
            };
            const steamRow = () => page.evalFn(() => {
                const leaf = document.querySelector('settings-screen').shadowRoot.getElementById('leaf');
                const row = leaf.shadowRoot.querySelector('ui-settings-row[data-row="machine-steam-temp"]');
                const stepper = row.control[0];
                return {
                    hint: row.shadowRoot.getElementById('hint').textContent.trim(),
                    drawn: (stepper.shadowRoot.querySelector('.value, #value, output')?.textContent ?? '').trim(),
                    value: stepper.value,
                    unit: stepper.unit,
                };
            });

            test('Celsius is the wire\'s own unit and nothing moves', async () => {
                await pickUnit('c');
                await showLeaf('machine', 'machine-steam');
                /* THE HINT LOST ITS "0 or" ON 26 AUGUST 2026 AND THE BAND DID NOT MOVE.
                 * `steamTemp` still declares `min: 0` and `floor: 135` — the clamp, the step
                 * and the numpad all still work the hole, and the master switch above still
                 * writes the zero. What went is `zeroMeans`, and with it the sentence that
                 * taught a second way to switch the heater off directly under a switch that
                 * does it. Ben: "no need to have <130 = off, the new toggle has that now." */
                assert.deepEqual(await steamRow(), {
                    hint: '135–170 °C', drawn: '160°C', value: 160, unit: '°C',
                });
            });

            test('Fahrenheit moves the value, the band and the symbol together', async () => {
                await pickUnit('f');
                await showLeaf('machine', 'machine-steam');
                const shown = await steamRow();
                assert.equal(shown.unit, '°F');
                assert.equal(shown.drawn, '320°F', '160 C is 320 F exactly');
                /* THE BAND IS SHOWN IN THE UNIT THE VALUE IS, or the label contradicts the
                 * control beside it. Rounded to whole display units on purpose: a bound
                 * printed as 275.4 invites a value the band would refuse.
                 *
                 * THIS EXPECTATION WAS "0 or 275–338 °F" UNTIL 27 AUGUST 2026, AND IT WAS
                 * PINNING A DEFECT — read the Celsius case eleven lines above, which
                 * asserts "135–170 °C" for the same row on the same day. One band, two
                 * sentences, and which one you got was decided by a display preference
                 * that has no business deciding it.
                 *
                 * WHERE THE SECOND SENTENCE CAME FROM. Ben removed `zeroMeans` from the
                 * steam row on 26 August — "no need to have <130 = off, the new toggle has
                 * that now" — so `rangeHint` stopped printing the "0 or …" clause that
                 * taught a second way to switch the heater off directly under a switch
                 * that does it. `displayRangeHint` re-spelled the band shape by hand off
                 * `range.floor` instead of asking, so it never got the message. Both now
                 * go through `bandHint` in `machine-limits.js`, which is the only author
                 * of the shape.
                 *
                 * SO THE CLAUSE IS GONE FROM BOTH FACES, and the assertion below says
                 * that rather than restating one of them: the two hints must be the same
                 * sentence with different numbers and a different symbol, which is a
                 * claim the old expectation could not make and would have failed. */
                assert.equal(shown.hint, '275–338 °F');
                await pickUnit('c');
                await showLeaf('machine', 'machine-steam');
                const celsius = await steamRow();
                assert.equal(celsius.hint, '135–170 °C');
                const shape = (hint) => hint.replace(/[\d.]+/g, '#').replace(/°[CF]/, '°');
                assert.equal(shape(shown.hint), shape(celsius.hint),
                    'one band must be one sentence — only the numbers and the symbol move');
            });

            test('a press moves ONE MACHINE STEP, and the wire gets a whole degree', async () => {
                await pickUnit('f');
                await showLeaf('machine', 'machine-steam');
                await page.evalFn(async () => {
                    const leaf = document.querySelector('settings-screen').shadowRoot.getElementById('leaf');
                    const row = leaf.shadowRoot.querySelector('ui-settings-row[data-row="machine-steam-temp"]');
                    const stepper = row.control[0];
                    stepper.dispatchEvent(new CustomEvent('change', {
                        detail: { value: stepper.next(stepper.value, 1) }, bubbles: true, composed: true,
                    }));
                    return true;
                });
                await page.settle();

                const shown = await steamRow();
                /* BEN'S ROUNDING RULE. The underlying number is 321.8 — one Celsius step —
                 * and what is DRAWN carries the Celsius step's decimal places, which is
                 * none. A tenth of a Fahrenheit degree is a precision the machine has not
                 * got. */
                assert.equal(shown.drawn, '322°F');

                /* AND THE REVERSE. Every value a press can reach is a value the machine can
                 * hold: exactly 161, not 160.99999999999999. */
                const staged = await page.evalFn(() => window.__settings.model().pendingPatch);
                assert.deepEqual(staged, { steamTargetTemperature: 161 });
            });

            test('the switch above it still remembers the MACHINE\'s number', async () => {
                /* A zeroSwitch stores the value it is leaving so turning it back on comes
                 * back to the same setting. Remembering 320 because the page happened to be
                 * in Fahrenheit would come back as 320 °C — off the top of the band — so
                 * the round trip through the switch is the assertion. */
                await pickUnit('f');
                await showLeaf('machine', 'machine-steam');
                const flip = (checked) => page.evalFn(async (want) => {
                    const leaf = document.querySelector('settings-screen').shadowRoot.getElementById('leaf');
                    const row = leaf.shadowRoot.querySelector('ui-settings-row[data-row="machine-steam-enabled"]');
                    row.control[0].dispatchEvent(new CustomEvent('change', {
                        detail: { checked: want }, bubbles: true, composed: true,
                    }));
                    return true;
                }, checked);

                await flip(false);
                await page.settle();
                assert.deepEqual(await page.evalFn(() => window.__settings.model().pendingPatch),
                    { steamTargetTemperature: 0 }, 'off is zero on the wire, in either unit');

                await flip(true);
                await page.settle();
                assert.deepEqual(await page.evalFn(() => window.__settings.model().pendingPatch),
                    { steamTargetTemperature: 160 },
                    'and back to the machine\'s own 160 — not 320, which would be off the band');
            });

            /* ────────────────────────────────────────────────────────────────
             * THE NUMPAD OVER THE ROW, WHICH IS THE OTHER CONTROL ON IT
             *
             * Every case above drives the STEPPER. The keypad is the second way to
             * change the same number and it derived its own band from the RAW machine
             * table until 27 August 2026, so on this very page it disagreed with the
             * control it opened from. MEASURED on this fixture, Machine › Steam, with
             * the preference set to Fahrenheit: the row's hint read "275–338 °F" and
             * the keypad's read "0 or 135–170"; typing 300 clamped to 170.
             *
             * THE CLAMP IS THE HALF THAT REACHES THE MACHINE. `#onKeypadConfirm` puts
             * the confirmed number back through `model.set()`, which converts display
             * → machine — so a value clamped against the wrong band was wrong twice
             * and in opposite directions. These two cases drive REAL PRESSES on the
             * pad and read the STAGED machine field afterwards, because that field is
             * the only place the second error is visible.
             * ──────────────────────────────────────────────────────────────── */

            /** Open the numpad from a row's value cell — the gesture, not a property. */
            const openPad = async (rowId) => {
                await page.evalFn((id) => {
                    const leaf = document.querySelector('settings-screen').shadowRoot.getElementById('leaf');
                    const row = leaf.shadowRoot.querySelector(`ui-settings-row[data-row="${id}"]`);
                    row.control[0].shadowRoot.getElementById('value').click();
                    return true;
                }, rowId);
                await page.settle(3);
            };

            /** What the pad is showing, and what it would hand back. */
            const padState = () => page.evalFn(() => {
                const pad = document.querySelector('settings-screen').shadowRoot.getElementById('keypad');
                return {
                    open: pad.open === true,
                    key: pad.limitKey,
                    hint: pad.shadowRoot.getElementById('hint').textContent.trim(),
                    unit: pad.getAttribute('unit'),
                    readout: pad.shadowRoot.getElementById('display')?.textContent.trim() ?? null,
                };
            });

            /** Type digits on the pad and confirm, the way a finger does. */
            const typeAndConfirm = async (digits) => {
                await page.evalFn(async (keys) => {
                    const pad = document.querySelector('settings-screen').shadowRoot.getElementById('keypad');
                    for (const key of keys) pad.shadowRoot.getElementById(`key-${key}`).click();
                    await pad.updateComplete;
                    return true;
                }, digits);
                await page.settle(2);
                const said = await page.evalFn(async () => {
                    const pad = document.querySelector('settings-screen').shadowRoot.getElementById('keypad');
                    const clamped = pad.clamped;
                    pad.shadowRoot.getElementById('confirm').click();
                    await pad.updateComplete;
                    return clamped;
                });
                await page.settle(3);
                return said;
            };

            /** The machine field behind the steam stepper, as the model has it STAGED. */
            const stagedSteam = () => page.evalFn(() => {
                const model = window.__settings.model();
                const view = model.rows('machine-steam').find((v) => v.id === 'machine-steam-temp');
                return { staged: view.staged, machine: model.machineValue(view.row.field) };
            });

            test('the numpad hint is the row\'s own band, in the row\'s own unit', async () => {
                await pickUnit('f');
                await showLeaf('machine', 'machine-steam');
                await openPad('machine-steam-temp');
                const pad = await padState();

                assert.equal(pad.open, true, 'the value cell is the typed path and it opened');
                assert.equal(pad.key, 'steamTemp');
                /* THE SAME SENTENCE THE ROW PRINTS, character for character. Read off the
                 * row rather than written out here, so this cannot pass by agreeing with a
                 * string that is itself wrong. */
                assert.equal(pad.hint, (await steamRow()).hint,
                    'the keypad and the row it opened from describe one band');
                assert.equal(pad.unit, '°F', 'and the well is captioned in the same unit');
                assert.match(pad.hint, /°F/);
                assert.doesNotMatch(pad.hint, /°C/,
                    'the machine\'s own unit has no business on a Fahrenheit page');
                await page.evalFn(() => {
                    document.querySelector('settings-screen').shadowRoot.getElementById('keypad').cancel();
                    return true;
                });
                await page.settle(2);
            });

            test('a number typed on the pad is clamped against the band the pad SHOWED',
                async () => {
                    await pickUnit('f');
                    await showLeaf('machine', 'machine-steam');
                    await openPad('machine-steam-temp');

                    /* 300 °F IS INSIDE THE BAND — 148.9 °C, between the 135 floor and the
                     * 170 ceiling. Against the CELSIUS band it is above the ceiling and
                     * clamps to 170, which is what shipped: the confirm handler then read
                     * that 170 as Fahrenheit and staged 76.7 °C. Wrong twice. */
                    const clamped = await typeAndConfirm(['3', '0', '0']);
                    assert.equal(clamped, 300, '300 °F is in band, so the clamp returns it');

                    const after = await stagedSteam();
                    assert.equal(after.staged, true, 'confirming stages the machine field');
                    /* AND THE MACHINE GETS CELSIUS. Computed, not written: the assertion is
                     * that the wire carries the same temperature the person typed, and the
                     * only honest way to say that is to convert it here the same way. */
                    const staged = await page.evalFn(() => {
                        const model = window.__settings.model();
                        const view = model.rows('machine-steam').find((v) => v.id === 'machine-steam-temp');
                        return view.value;
                    });
                    assert.equal(staged, 300, 'the row draws back exactly what was typed');

                    await page.evalFn(() => { window.__settings.model().discard(); return true; });
                    await page.settle();
                });

            test('and the pad still clamps — at ITS ceiling, not the machine\'s number',
                async () => {
                    await pickUnit('f');
                    await showLeaf('machine', 'machine-steam');
                    await openPad('machine-steam-temp');

                    /* 400 °F is above the band on any reading of it. What must come back is
                     * the ceiling THE HINT PRINTED, in the unit it printed it in — not 170,
                     * which is the same ceiling wearing the machine's unit and would land
                     * on the machine as 76.7 °C. */
                    const clamped = await typeAndConfirm(['4', '0', '0']);
                    const shownMax = Number((await steamRow()).hint.match(/(\d+)\s*°F/)[1]);
                    assert.equal(clamped, shownMax,
                        'the ceiling it lands on is the ceiling the hint named');
                    assert.notEqual(clamped, 170,
                        '170 is the machine\'s own ceiling and is not a Fahrenheit temperature');

                    await page.evalFn(() => { window.__settings.model().discard(); return true; });
                    await page.settle();
                });

            /* PUT THE UNIT BACK. It is a stored preference and this file's other cases
             * read temperatures too — leaving Fahrenheit set would make the next suite's
             * band assertions fail for a reason that has nothing to do with the band. */
            test('Celsius again, for everything after this', async () => {
                await pickUnit('c');
                await showLeaf('machine', 'machine-steam');
                assert.equal((await steamRow()).unit, '°C');
            });
        });

        /* ════════════════════════════════════════════════════════════════════
         * 8a. A VARIANT ROW SPEAKS ONE UNIT, NOT TWO
         * ═══════════════════════════════════════════════════════════════════ */

        describe('the hot-water cap follows its stop mode all the way down', () => {
            /* MEASURED 26 August 2026. `machine-hot-water-volume` is one machine field
             * behind two modes: a volume cap in millilitres, or a weight cap in grams.
             * The variant moved the heading and the stepper's unit and stopped there, so
             * in weight mode the row read "Weight", "0 g", and — beside them — the hint
             * "0-255 mL · 0 = no volume cap", straight off the limits row, which is
             * written in millilitres. Two units and two nouns on one row at one moment.
             *
             * THE NUMBERS DO NOT MOVE, and that is why the machine holds one field: a
             * millilitre of water weighs a gram. Only the words follow the mode. */
            test('weight mode says grams and weight; volume mode says millilitres and volume', async () => {
                await showLeaf('machine', 'machine-hot-water');
                const readRow = () => page.evalFn(() => {
                    const leaf = document.querySelector('settings-screen').shadowRoot.getElementById('leaf');
                    const row = leaf.shadowRoot.querySelector('ui-settings-row[data-row="machine-hot-water-volume"]');
                    return {
                        heading: row.shadowRoot.getElementById('heading').textContent.trim(),
                        hint: row.shadowRoot.getElementById('hint').textContent.trim(),
                        unit: row.control[0].unit ?? '',
                    };
                });
                const setMode = async (mode) => {
                    await page.evalFn((m) => window.__settings.change('machine-water-stop', m).then(() => true), mode);
                    await page.settle();
                };

                /* THE MACHINE HAS TO SAY IT CAN STOP AT WEIGHT BEFORE WEIGHT IS REACHABLE,
                 * and that is new on 26 August 2026 rather than a fixture detail. Ben's rule
                 * — "weight grayed out if no scale is connected and volume selected" — was
                 * written down as `HOT_WATER_STOP` and imported by nothing, so the page
                 * offered Weight ungreyed on a tablet with no scale and a pour started that
                 * way had no stop at all. The gate is the served `stopAtWeight` entry, which
                 * is the same one the Live rail's identical option asks for. */
                await page.evalFn(() => window.__settings.capabilities(['stopAtWeight']).then(() => true));
                await showLeaf('machine', 'machine-hot-water');

                await setMode('weight');
                assert.deepEqual(await readRow(), {
                    heading: 'Weight',
                    hint: '0–255 g · 0 = no weight cap',
                    unit: 'g',
                }, 'in weight mode nothing on the row says millilitre or volume');

                await setMode('volume');
                assert.deepEqual(await readRow(), {
                    heading: 'Volume',
                    hint: '0–255 mL · 0 = no volume cap',
                    unit: 'mL',
                }, 'and the whole row goes back together');
                /* THIS SUITE SHARES ONE PAGE, and the stop mode is a MACHINE field since
                 * 26 August 2026 — so setting it STAGES rather than storing, and a staged
                 * field left here is a change count a later section reads. */
                await page.evalFn(() => { window.__settings.model().discard(); return true; });
                await page.settle();
            });

            test('with no scale answer the Weight cell is disabled and the row reads Volume', async () => {
                /* THE HALF THAT WAS MISSING UNTIL 26 AUGUST 2026, and it is the fork's own
                 * defect class in its purest form: Ben dictated the whole rule and it was
                 * stored as an exported constant nothing imported, three lines below the
                 * defaults that do work. The cost was concrete rather than tidy — Weight
                 * selected, Weight offered, and no stop on the pour.
                 *
                 * FAIL-CLOSED ON UNKNOWN AS WELL AS ABSENT, which is the settings store's
                 * one verdict rule: a machine that has not answered is not a machine with a
                 * scale. This fixture's capability store is deliberately never loaded, so
                 * `capabilities(null)` is the same state a real tablet is in for the first
                 * moment of every boot. */
                await page.evalFn(() => window.__settings.capabilities(null).then(() => true));
                await showLeaf('machine', 'machine-hot-water');
                await page.evalFn(() => { window.__settings.model().discard(); return true; });
                const seen = await page.evalFn(async () => {
                    const leaf = document.querySelector('settings-screen').shadowRoot.getElementById('leaf');
                    const row = leaf.shadowRoot.querySelector('ui-settings-row[data-row="machine-water-stop"]');
                    const bank = row.control[0];
                    const cells = [...bank.shadowRoot.querySelectorAll('button')].map((b) => ({
                        label: b.textContent.trim(),
                        disabled: b.disabled,
                    }));
                    /* THE WRITE, THROUGH THE MODEL rather than through the fixture's own
                     * `change()`: that helper reports whether it found a control, not what
                     * the model decided, so asserting on its answer would pass whatever
                     * happened. The staged patch is the honest evidence — a refused write
                     * stages nothing. */
                    const stopRow = window.__settings.model().allRows('machine-hot-water')
                        .find((view) => view.id === 'machine-water-stop').row;
                    const result = await window.__settings.model().set(stopRow, 'weight');
                    return {
                        value: bank.value,
                        cells,
                        ok: result.ok,
                        reason: result.reason ?? null,
                        patch: window.__settings.model().pendingPatch,
                    };
                });
                assert.equal(seen.value, 'volume', "Ben's rule: volume selected when there is no scale");
                assert.deepEqual(seen.cells, [
                    { label: 'Volume', disabled: false },
                    { label: 'Weight', disabled: true },
                ], 'one disabled cell inside a live bank — not a hidden row and not a hidden option');
                assert.equal(seen.ok, false, 'greying a cell is the paint; refusing the write is what makes it true');
                assert.equal(seen.reason, 'capability');
                assert.deepEqual(seen.patch, {}, 'and nothing is waiting to be committed');
                await page.evalFn(() => { window.__settings.model().discard(); return true; });
                await page.settle();
            });
        });

        /* ════════════════════════════════════════════════════════════════════
         * 8b. THE STEAM ENVELOPE ARRIVES LATE, AND THE ROW MUST TAKE IT
         * ═══════════════════════════════════════════════════════════════════ */

        describe('a limit that depends on the machine class is read when it is known', () => {
            /* THE SHIPPED DEFECT, measured 26 August 2026. The steam row is in the limits
             * table only once the machine class is known, and the class is read off the
             * SERVED capability array — an asynchronous request. `settings-model.js` took
             * `machineLimits().value` ONCE at construction, and the screen builds its
             * model the moment it connects, so on a normal boot the captured table was the
             * unknown-class one. The Temperature row then drew no range, no degree sign
             * and no clamp FOR THE WHOLE SESSION, whatever the machine answered a moment
             * later. Nothing failed and nothing logged: A7's "no honest stand-in" is a
             * correct behaviour for an unknown class, and it simply never stopped.
             *
             * WHAT IS ASSERTED IS THE ORDER. Serving the capability BEFORE the row is
             * asked would pass against the old code too — the defect only exists in the
             * gap between construction and the answer. So the row is read first with the
             * mock refusing capabilities, and again after they are served. */
            test('the steam row gains its band, its unit and its clamp when the class lands', async () => {
                await page.evalFn(() => window.__settings.capabilities(null).then(() => true));
                await showLeaf('machine', 'machine-steam');
                const before = (await rowReport(page)).find((row) => row.id === 'machine-steam-temp');
                assert.ok(before, 'the row is on the page whether or not the class is known');
                assert.equal(before.hint, '', 'A7: an unknown class prints no band rather than a stand-in');

                await page.evalFn(() => window.__settings.capabilities(['cupWarmer']).then(() => true));
                await showLeaf('machine', 'machine-steam');
                const after = (await rowReport(page)).find((row) => row.id === 'machine-steam-temp');
                assert.equal(after.hint, '135–170 °C', 'the served array says bengle, and the envelope follows');

                const stepper = await page.evalFn(() => {
                    const leaf = document.querySelector('settings-screen').shadowRoot.getElementById('leaf');
                    const row = leaf.shadowRoot.querySelector('ui-settings-row[data-row="machine-steam-temp"]');
                    const el = row.control[0];
                    return { unit: el.unit ?? '', max: el.max ?? null, min: el.min ?? null };
                });
                assert.equal(stepper.unit, '°C', 'and the control is in degrees, not unitless');
                assert.equal(stepper.max, 170, 'and bounded at the ceiling this bench serves');
            });
        });

        /* ════════════════════════════════════════════════════════════════════
         * 9. NO CONTROL RENDERS OUTSIDE ITS PANE — every leaf, every control
         * ═══════════════════════════════════════════════════════════════════ */

        describe('every control lands inside the leaf pane', () => {
            test('no control is zero-width, and none crosses either pane edge', async () => {
                const controls = await controlBounds(page);
                assert.ok(controls.length > 30, `the walk must reach real controls, got ${controls.length}`);

                const zero = controls.filter((c) => c.width <= 0);
                assert.deepEqual(zero, [], 'a control with no width states no size and lands in a zero track');

                const spilled = controls.filter(
                    (c) => c.right > c.paneRight + 2 || c.left < c.paneLeft - 2,
                );
                assert.deepEqual(spilled, [], 'a control outside its pane is drawn outside the surface holding it');
            });

            test('a text field takes its NAME from the row and does not print it twice', async () => {
                /* MEASURED ON THE CURRENT TREE before the fix: row heading "ReaPrime
                 * address", field `label` property "ReaPrime address", inner <label> text
                 * "ReaPrime address", input aria-label NULL.
                 *
                 * TWO DEFECTS, ONE WORD. #29 auto-names a slotted control, and rule 1 is
                 * "a ui-* control with its own `label` property" gets the heading written
                 * onto that property. #4 then DRAWS any label it is given unless told to
                 * hide it — that is the visible duplication. And because #4 sets `aria-label`
                 * only when it is NOT drawing a visible label, the drawn label suppressed
                 * the input's accessible name entirely: the heading is a sibling <span>, not
                 * a <label for>, so nothing named the field at all. The audit could see the
                 * first and not the second.
                 *
                 * #4 ALREADY DOCUMENTED THE RESOLUTION at its E14 note — "with `hide-label`
                 * the name survives as `aria-label`" — and neither component was wrong on
                 * its own; the duplication only existed between them. */
                const fields = await page.evalFn(async () => {
                    const api = window.__settings;
                    const nav = await import('/src/lib/settings-nav.js');
                    const screen = document.querySelector('settings-screen');
                    const out = [];
                    for (const cat of nav.SETTINGS_TREE) {
                        for (const leafNode of cat.leaves) {
                            await api.selectCategory(cat.id);
                            await api.selectLeaf(leafNode.id);
                            const leaf = screen.shadowRoot.getElementById('leaf');
                            for (const row of leaf.shadowRoot.querySelectorAll('ui-settings-row')) {
                                for (const el of row.control) {
                                    if (el.localName !== 'ui-text-field') continue;
                                    out.push({
                                        leaf: leafNode.id,
                                        row: row.dataset.row,
                                        heading: row.heading,
                                        drawnLabel: el.shadowRoot.getElementById('label')?.textContent.trim() ?? null,
                                        ariaLabel: el.shadowRoot.getElementById('control')?.getAttribute('aria-label') ?? null,
                                    });
                                }
                            }
                        }
                    }
                    return out;
                });

                assert.ok(fields.length > 0, 'the registry has at least one TEXT row to check');
                for (const field of fields) {
                    assert.equal(field.drawnLabel, null,
                        `${field.leaf}/${field.row} prints its heading twice`);
                    assert.equal(field.ariaLabel, field.heading,
                        `${field.leaf}/${field.row} leaves its input with no accessible name`);
                }
            });
        });
    });
}
