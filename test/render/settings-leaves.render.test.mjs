/**
 *.4's one-primitive cluster, measured off the engine: settings-row-thirty-leaves, c6-density-type-scale, d8-way-out-of-the-skin, d11-save-count, a11y-cluster-t15.
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
                assert.equal(rows[1].hint, '2–8 mL/s');
                assert.equal(rows[2].hint, '0–60 s');
            });

            const fanHint = async (served) => {
                await page.evalFn((entries) => window.__settings.capabilities(entries).then(() => true), served);
                await page.settle();
                await showLeaf('calibration', 'calibration-hardware');
                const rows = await rowReport(page);
                const fan = rows.filter((row) => row.id === 'calibration-fan-threshold');
                assert.equal(fan.length, 1, 'T7: one Fan implementation, not two');
                assert.equal(rows.length, 3, 'and it shares Hardware with Refill Kit and Voltage');
                return fan[0].hint;
            };

            test('the fan threshold renders the decided band on a Bengle, in °C and not a percentage', async () => {
                const hint = await fanHint(['cupWarmer']);
                assert.equal(hint, '40–60 °C');
                assert.doesNotMatch(hint, /%/, 'the old page printed a percentage over a caption saying °C');
            });

            test('and ReaPrime\'s own declared band on a DE1', async () => {
                const hint = await fanHint([]);
                assert.equal(hint, '0–50 °C');
            });

            test('with no machine answer there is NO band, and that is A7 rather than a gap', async () => {
                assert.equal(await fanHint(null), '');
            });

            test('every stepper prints its range, and the range is the table\'s', async () => {
                await showLeaf('machine', 'machine-hot-water');
                const rows = await rowReport(page);
                const flow = rows.find((row) => row.id === 'machine-hot-water-flow');
                assert.ok(flow, 'the leaf still draws the flow row');
                assert.equal(flow.hint, '2–8 mL/s', 'O8: no stepper is unbounded any more');
                const temperature = rows.find((row) => row.id === 'machine-hot-water-temp');
                assert.equal(temperature.hint, '0–99 °C', 'and the two beside it ARE bounded');
            });

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

        describe('cmp-sm-2: the bank archetype is a control, not a hairline', () => {
            test('every bank in the registry has a real box inside its row', async () => {
                const banks = await bankWalk(page);
                assert.ok(banks.length >= 4,
                    `the walk found no banks to measure: ${JSON.stringify(banks)}`);
                for (const bank of banks) {
                    assert.equal(bank.display, 'grid', `${bank.row}: the bank is n equal columns`);
                    assert.ok(bank.items.length >= 2, `${bank.row}: a bank with one cell is not a bank`);

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

                near(bank.height, 64, 'the bank floor is --ui-control-h');
                assert.ok(Math.abs(bank.width - 348) <= 6,
                    `the steam-stop bank measured ${bank.width}, Slate's is 348`);
                assert.ok(bank.rowBox && bank.width < bank.rowBox.right - bank.rowBox.x,
                    'a bank that fills its whole row is not being sized by its content');

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

        describe('cmp-sm-1: the steam leaf draws five rows, not two', () => {
            const steam = async () => {
                await showLeaf('machine', 'machine-steam');
                return rowReport(page);
            };

            test('the five rows are there, in the oracle\'s order and archetypes', async () => {
                const rows = await steam();

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

                assert.equal(duration.hint, '10–120 s');
                assert.equal(duration.control[0].tag, 'ui-stepper');
            });

            const withClass = async (fn) => {
                await page.evalFn(() => window.__settings.capabilities(['cupWarmer']).then(() => true));
                try {
                    await fn();
                } finally {
                    await page.evalFn(() => window.__settings.capabilities(null).then(() => true));
                }
            };

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
                await page.evalFn(() => { window.__settings.model().discard(); return true; });
                await showLeaf('machine', 'machine-steam');
                await openPad('machine-steam-temp');
                const opened = await padState();
                assert.equal(opened.open, true, 'the value cell must open the pad');
                assert.deepEqual({ min: opened.min, max: opened.max }, { min: 135, max: 170 });
                assert.equal(opened.hint, '135–170 °C');

                await padType(['6', '3']);
                const typed = await padState();
                assert.equal(typed.readout, '63', 'the keys still type — the refusal is Confirm\'s');
                assert.equal(typed.refused, true,
                    '63 °C is inside the hole; confirming it sent targetTemperature 0');

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
                assert.deepEqual({ min: said.min, max: said.max }, { min: 0, max: 170 },
                    'the stepper keeps its full band: stepping down to off is a real gesture');
                assert.equal(said.describedBy, 'range', 'the hint must still describe the group');
                assert.equal(said.printed, '135–170 °C');
                assert.equal(said.announced, said.printed,
                    'one band, one sentence — a screen-reader user and a sighted one are told the same thing');
                assert.doesNotMatch(said.announced, /Range 0 to/);
            }));

            test('F-047: a row with NO hole announces its band too, and it still agrees', async () => {
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

            test('F-042: pending and inert render alike, and a settled row renders neither', async () => {
                await showLeaf('machine', 'machine-steam');
                const settled = await page.evalFn(() => {
                    const model = window.__settings.model();
                    return model.rows('machine-steam').map((view) => ({
                        id: view.id, pending: view.pending, inert: view.inert,
                    }));
                });
                /* EVERY ROW HAS ANSWERED by the time a leaf is on screen and settled
                 * which is why the fault only ever showed for the first few seconds. */
                assert.ok(settled.length > 0);
                for (const row of settled) {
                    assert.equal(row.pending, false, `${row.id} still waiting after load()`);
                }

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
                 * count the rule's section reads later. Discard rather than commit: the
                 * write path is not what this test is about. */
                await page.evalFn(() => { window.__settings.model().discard(); return true; });
                await page.settle();
            });

            test('choosing a bank cell writes the NUMBER too, not the attribute string', async () => {
                await showLeaf('calibration', 'calibration-hardware');
                const wrote = await page.evalFn(async () => {
                    const leaf = document.querySelector('settings-screen').shadowRoot.getElementById('leaf');
                    const bank = leaf.shadowRoot.querySelector('ui-settings-row[data-row="calibration-refill-kit-mode"] ui-bank');
                    /* The cell, pressed the way a finger presses it. `ui-bank` reflects
                     * its value as an ATTRIBUTE, which is where the type is lost. */
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
                    assert.match(row.caption, /higher value stops the shot earlier/i,
                        `the ${which} caption does not say which way it moves the stop`);
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

                const bare = await summaryFor('calibration-load-cells');
                assert.equal(bare.missing, false, 'the Load Cells row is in the same list');
                assert.equal(bare.text, null, 'and it draws no summary element');
            });
        });

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

                if (!got.nav.showing || !got.subnav.showing) {
                    assert.notEqual(got.nav.showing, got.subnav.showing,
                        'the collapsed branch shows exactly one nav column');
                    return;
                }

                assert.equal(got.nav.pitch, got.subnav.pitch, 'one pitch, by construction (T2)');
                near(got.nav.origin, got.subnav.origin, 'the two lists start at the same y', 0.51);

                const shared = Math.min(got.nav.separators.length, got.subnav.separators.length);
                assert.ok(shared >= 3, 'not enough rows in both columns to compare');
                assert.deepEqual(
                    got.nav.separators.slice(0, shared),
                    got.subnav.separators.slice(0, shared),
                    'the nav and sub-nav separators must land on the same lines',
                );
            });
        });

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
                    caption: (row.getAttribute('caption') || '').includes('never goes dark by accident'),
                };
            });

            test('the slider FLOORS at 10, which is what its own caption promises', async () => {
                await page.evalFn(() => window.__settings.displayFrame(null));
                await showLeaf('display', 'display-screen');
                const report = await brightnessSlider();
                assert.ok(report, 'the brightness row draws a ui-slider');
                assert.equal(report.min, 10, 'the band is named in machine-limits.js, not typed here');
                assert.equal(report.max, 100);
                assert.equal(report.caption, true, 'the promise the floor exists to keep');
            });

            test('the slider shows the PANEL brightness, not the stored number', async () => {

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
                await showLeaf('display', 'display-screen');
                await pick('larger');
                await page.settle();
                const state = await readDensity();
                const band = geometry.height < 700 ? 0.875 : 1;
                near(state.density, 1.1 * band, 'base x band', 0.01);
            });

            test('RECORDED: the ch measure does not move with the type scale yet', async () => {
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
                await showLeaf('display', 'display-screen-saver');
                const changed = await page.evalFn(
                    () => window.__settings.change('display-screen-saver-enabled', false),
                );
                assert.equal(changed, true,
                    'the case drives a row that no longer exists — repoint it at a stored switch');
                await page.settle();
                const band = await bandText();
                assert.equal(band.count, 0);
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
                assert.match(band.all, /Save/, 'and the decided pair stays');
            });
        });

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
                await showLeaf('updates', 'updates-firmware-update');
                const rows = await rowReport(page);
                assert.deepEqual(rows, [], 'it is not a settings ROW — a catalog is a bespoke layout');
                const seen = await page.evalFn(() => {
                    const screen = document.querySelector('settings-screen').shadowRoot;
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

            test('the capability list does not decide this leaf: its rows, or none', async () => {
                await showLeaf('accessories', 'accessories-cup-warmer');
                const rows = await rowReport(page);
                assert.deepEqual(rows.map((row) => row.id), [
                    'accessories-cup-warmer-enabled',
                    'accessories-cup-warmer-target',
                    'accessories-cup-warmer-now',
                ], 'the whole page draws even with the capability list unread; the pre-warm pair '
                + 'is absent because the machine document says this firmware cannot pre-warm');
            });
        });

        describe('a staged row says so', () => {
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

        describe('the band gets you out, and a refused save does not', () => {
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

        describe('a temperature is drawn in the unit the person chose', () => {

            const serveClass = () => page.evalFn(() => window.__settings.capabilities(['cupWarmer'])
                .then(() => true));

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
                assert.equal(shown.drawn, '322°F');

                /* AND THE REVERSE. Every value a press can reach is a value the machine can
                 * hold: exactly 161, not 160.99999999999999. */
                const staged = await page.evalFn(() => window.__settings.model().pendingPatch);
                assert.deepEqual(staged, { steamTargetTemperature: 161 });
            });

            test('the switch above it still remembers the MACHINE\'s number', async () => {
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

                    const clamped = await typeAndConfirm(['3', '0', '0']);
                    assert.equal(clamped, 300, '300 °F is in band, so the clamp returns it');

                    const after = await stagedSteam();
                    assert.equal(after.staged, true, 'confirming stages the machine field');
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

                    const clamped = await typeAndConfirm(['4', '0', '0']);
                    const shownMax = Number((await steamRow()).hint.match(/(\d+)\s*°F/)[1]);
                    assert.equal(clamped, shownMax,
                        'the ceiling it lands on is the ceiling the hint named');
                    assert.notEqual(clamped, 170,
                        '170 is the machine\'s own ceiling and is not a Fahrenheit temperature');

                    await page.evalFn(() => { window.__settings.model().discard(); return true; });
                    await page.settle();
                });

            test('Celsius again, for everything after this', async () => {
                await pickUnit('c');
                await showLeaf('machine', 'machine-steam');
                assert.equal((await steamRow()).unit, '°C');
            });
        });

        describe('the hot-water cap follows its stop mode all the way down', () => {
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
                await page.evalFn(() => { window.__settings.model().discard(); return true; });
                await page.settle();
            });

            test('with no scale answer the Weight cell is disabled and the row reads Volume', async () => {
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
                assert.equal(seen.value, 'volume', "the rule: volume selected when there is no scale");
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

        describe('a limit that depends on the machine class is read when it is known', () => {
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
