/**
 *.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';
import { entry as galleryEntry } from '../../tools/gallery/entries/ui-exit-sentence.entry.js';
import {
    assertTokenDrill,
    assertFocusUnclipped,
    assertScrollFloor,
    DRILL_COLOUR,
    DRILL_LENGTH,
} from '../harness/assertions.js';
import { serializeExitSlots, exitBand } from '../../src/lib/exit-sentence.js';

const MODULE = ['/src/components/ui-exit-sentence.js'];

const PRESSURE_STEP = { pump: 'flow', exit: { type: 'pressure', condition: 'over', value: 4.5 }, volume: 100 };

const DEAD_STEP = { pump: 'pressure', exit: { type: 'flow', condition: 'under', value: 0 }, volume: 100 };

const EMPTY_STEP = { pump: 'flow' };

const SLATE_BAND_W = 346;
const SLATE_SENTENCE_W = 274;
const SLATE_CONTROL = 64;
const SLATE_GAP = 8;

const host = (step, extra = '') =>
    `<ui-exit-sentence id="band" index="0" step='${JSON.stringify(step)}' ${extra}></ui-exit-sentence>`;

/** Rendered lengths at dsf 1.5 are not string-comparable; whole CSS px are. */
const near = (got, want, what, tol = 0.6) => assert.ok(
    Math.abs(got - want) <= tol,
    `${what}: expected ${want}, got ${got}`,
);

const TREE_AUDIT = `(() => {
    const el = document.querySelector('ui-exit-sentence');
    const nodes = window.__h.deepAll(el.shadowRoot);
    const interactive = [];
    const hidden = [];
    const selectionish = [];
    const bounds = [];
    for (const n of nodes) {
        const cs = getComputedStyle(n);
        const tag = n.tagName.toLowerCase();
        if (tag === 'button' || tag === 'input' || tag === 'select' || tag === 'textarea'
            || n.hasAttribute('tabindex')) {
            interactive.push(tag + (n.id ? '#' + n.id : ''));
        }
        if (cs.display === 'none' || cs.visibility === 'hidden' || n.hasAttribute('hidden')) {
            hidden.push(window.__h.anchorPath(n) + ' [' + cs.display + '/' + cs.visibility + ']');
        }
        for (const attr of ['aria-selected', 'aria-pressed', 'aria-current', 'aria-checked']) {
            if (n.hasAttribute(attr)) selectionish.push(tag + '@' + attr);
        }
        if (n.classList.contains('is-selected')) selectionish.push(tag + '.is-selected');
        for (const attr of ['min', 'max', 'step']) {
            if (n.hasAttribute(attr)) bounds.push(tag + '@' + attr + '=' + n.getAttribute(attr));
        }
    }
    return JSON.stringify({
        interactive, hidden, selectionish, bounds,
        rows: el.shadowRoot.querySelectorAll('.row').length,
        notes: el.shadowRoot.querySelectorAll('.note').length,
        menus: el.shadowRoot.querySelectorAll('ui-menu').length,
        dialogs: el.shadowRoot.querySelectorAll('dialog, ui-dialog, .backdrop, .scrim').length,
        rowIds: Array.from(el.shadowRoot.querySelectorAll('.row')).map((r) => r.id),
    });
})()`;

/** The four parts of one sentence, as rendered. */
const partsOf = (slot) => `(() => {
    const root = document.querySelector('ui-exit-sentence').shadowRoot;
    const row = root.querySelector('#row-${slot}');
    const pick = (sel) => { const n = row.querySelector(sel); return n ? n.textContent : null; };
    const btn = row.querySelector('.sentence');
    return JSON.stringify({
        subject: pick('.subject'), verb: pick('.verb'),
        number: pick('.number'), unit: pick('.unit'),
        text: btn.textContent,
        ariaLabel: btn.getAttribute('aria-label'),
        removeLabel: (row.querySelector('ui-icon-button')
            ? row.querySelector('ui-icon-button').shadowRoot.querySelector('#control').getAttribute('aria-label')
            : null),
    });
})()`;

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`ui-exit-sentence @ ${geometry.name} (${geometry.width}×${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

        const mounted = (fn, step = PRESSURE_STEP, extra = '', width = SLATE_BAND_W) =>
            browser.withPage({ geometry }, async (page) => {
                await page.mount(host(step, extra), MODULE);
                assert.deepEqual(page.pageErrors, [], 'the component must mount without throwing');
                if (width) await page.setStyle('ui-exit-sentence', { 'inline-size': `${width}px` });
                await page.settle(2);
                return fn(page);
            });

        test('the emulated geometry is the one the suite asked for', () => mounted(async (page) => {
            const env = JSON.parse(await page.eval(
                'JSON.stringify({dpr: devicePixelRatio, w: innerWidth, h: innerHeight})',
            ));
            assert.deepEqual(env, {
                dpr: geometry.deviceScaleFactor, w: geometry.width, h: geometry.height,
            });
        }));

        describe('C8 — the visible sentence only', () => {
            test('the tree holds exactly 2 × occupied + offered controls, and nothing else',
                () => mounted(async (page) => {
                    const a = JSON.parse(await page.eval(TREE_AUDIT));
                    const band = exitBand(PRESSURE_STEP);
                    const occupied = band.filter((s) => s.occupied).length;
                    const offered = band.length - occupied;
                    assert.equal(a.interactive.length, 2 * occupied + offered,
                        'the shadow tree carries controls that are not on screen — that is the ' +
                        'hidden control set C8 removed (profile-editor-v3.css:695-698). Saw ' +
                        JSON.stringify(a.interactive));
                }));

            test('nothing anywhere in the composed tree is hidden',
                () => mounted(async (page) => {
                    const a = JSON.parse(await page.eval(TREE_AUDIT));
                    assert.deepEqual(a.hidden, [],
                        'Slate hid four controls per chip with visibility:hidden and kept them ' +
                        'as a serialization seam. The seam is now serializeExitSlots(); a hidden ' +
                        'node here means it came back.');
                }));

            test('the seam and the rendered sentence are ONE source',
                () => mounted(async (page) => {
                    const rendered = JSON.parse(await page.eval(partsOf('condition')));
                    const [record] = serializeExitSlots(PRESSURE_STEP);
                    assert.equal(rendered.subject, record.subject);
                    assert.equal(rendered.verb, record.verb);
                    assert.equal(rendered.number, record.text);
                    assert.equal(rendered.unit, record.unit);
                    assert.equal(
                        [rendered.subject, rendered.verb, rendered.number, rendered.unit].join(' '),
                        record.sentence,
                        'the seam reports a sentence the component does not render',
                    );
                }));

            test('the scalar slot renders the neutral verb, not a comparator',
                () => mounted(async (page) => {
                    const rendered = JSON.parse(await page.eval(partsOf('volume')));
                    assert.equal(rendered.verb, 'reaches');
                    assert.equal(rendered.unit, 'mL');
                }));

            test('there is no second popover or modal machinery — #21 is composed',
                () => mounted(async (page) => {
                    const a = JSON.parse(await page.eval(TREE_AUDIT));
                    assert.equal(a.dialogs, 0, 'this component owns no overlay of its own');
                    /* PRESSURE_STEP's condition slot is OCCUPIED, so there is no
                     * add-condition trigger and therefore no menu at all — the
                     * band composes #21 only where it offers a choice. */
                    assert.equal(a.menus, 0, 'a fully occupied condition slot offers no menu');
                }, PRESSURE_STEP).then(() => browser.withPage({ geometry }, async (page) => {
                    await page.mount(host(EMPTY_STEP), MODULE);
                    await page.settle(2);
                    const a = JSON.parse(await page.eval(TREE_AUDIT));
                    assert.equal(a.menus, 1, 'the offered condition slot composes exactly one ui-menu');
                    assert.equal(a.dialogs, 0);
                })));
        });

        describe('Appendix 9 — three slots, occupied first, add-slots below', () => {
            for (const [name, step] of [['a threshold and a volume', PRESSURE_STEP], ['nothing set', EMPTY_STEP]]) {
                test(`${name} still renders exactly three rows`, () => mounted(async (page) => {
                    const a = JSON.parse(await page.eval(TREE_AUDIT));
                    assert.equal(a.rows, 3, `saw ${JSON.stringify(a.rowIds)}`);
                }, step));
            }

            test('occupied rows come first and offers follow', () => mounted(async (page) => {
                const a = JSON.parse(await page.eval(TREE_AUDIT));
                assert.deepEqual(a.rowIds, ['row-condition', 'row-volume', 'row-weight']);
                const kinds = await page.evalFn(() => {
                    const root = document.querySelector('ui-exit-sentence').shadowRoot;
                    return Array.from(root.querySelectorAll('.row')).map((r) => (r.classList.contains('add') ? 'add' : 'set'));
                });
                assert.deepEqual(kinds, ['set', 'set', 'add']);
            }));

            test('every row is one --ui-control-h tall, whatever it holds', () => mounted(async (page) => {
                const h = parseFloat(await page.resolveToken('--ui-control-h', 'block-size'));
                for (const id of ['row-condition', 'row-volume', 'row-weight']) {
                    const box = await page.box(`ui-exit-sentence >>> #${id}`);
                    near(box.height, h, `${id} height`);
                }
            }));

            test('the row pitch is the band gap, once', () => mounted(async (page) => {
                const a = await page.box('ui-exit-sentence >>> #row-condition');
                const b = await page.box('ui-exit-sentence >>> #row-volume');
                near(b.top - a.bottom, SLATE_GAP, 'row gap');
                near(b.top - a.top, SLATE_CONTROL + SLATE_GAP, 'row pitch');
            }));
        });

        describe('the measured band, as a ratio', () => {
            test('at Slate\'s 346px the three numbers fall out: 274 + 8 + 64',
                () => mounted(async (page) => {
                    const sentence = await page.box('ui-exit-sentence >>> #sentence-condition');
                    const remove = await page.box('ui-exit-sentence >>> #remove-condition');
                    near(sentence.width, SLATE_SENTENCE_W, 'sentence width (oracle 274 x 64)');
                    near(sentence.height, SLATE_CONTROL, 'sentence height');
                    near(remove.width, SLATE_CONTROL, 'remove width (oracle 64 x 64)');
                    near(remove.height, SLATE_CONTROL, 'remove height');
                    near(remove.left - sentence.right, SLATE_GAP, 'gap (518 − 236 − 274 = 8)');
                }));

            test('the add slot is the whole band, like the oracle\'s 346-wide empty slot',
                () => mounted(async (page) => {
                    const add = await page.box('ui-exit-sentence >>> #add-weight');
                    near(add.width, SLATE_BAND_W, 'add slot width (oracle 346 x 64)');
                    near(add.height, SLATE_CONTROL, 'add slot height');
                }));

            test('274 is a consequence, not a declaration — move the stage and it moves',
                () => mounted(async (page) => {
                    await page.setStyle('ui-exit-sentence', { 'inline-size': '560px' });
                    await page.settle(2);
                    const sentence = await page.box('ui-exit-sentence >>> #sentence-condition');
                    const remove = await page.box('ui-exit-sentence >>> #remove-condition');
                    near(sentence.width, 560 - SLATE_GAP - SLATE_CONTROL, 'sentence at a 560px stage');
                    near(remove.width, SLATE_CONTROL, 'the remove button keeps its physical floor');
                }));

            test('the remove button never goes below the hit floor, however narrow the band',
                () => mounted(async (page) => {
                    await page.setStyle('ui-exit-sentence', { 'inline-size': '200px' });
                    await page.settle(2);
                    const hit = parseFloat(await page.resolveToken('--ui-hit-min', 'block-size'));
                    const remove = await page.box('ui-exit-sentence >>> #remove-condition');
                    assert.ok(remove.width >= hit - 0.6 && remove.height >= hit - 0.6,
                        `remove button ${remove.width}×${remove.height} against a ${hit}px floor — ` +
                        'ergonomics is physical (tokens.css:185, density never multiplies it)');
                }));
        });

        describe('E16 cannot express — the dead-exit note', () => {
            test('the note renders, in the flow, under its own row', () => mounted(async (page) => {
                const a = JSON.parse(await page.eval(TREE_AUDIT));
                assert.equal(a.notes, 1, 'the O5 note is missing');
                const row = await page.box('ui-exit-sentence >>> #row-condition');
                const note = await page.box('ui-exit-sentence >>> #note-condition');
                assert.ok(note.top >= row.bottom - 0.6,
                    'the note must sit UNDER its chip, never inside it — ' +
                    '"a child that wraps to a second line tears the card\'s layout apart" ' +
                    '(profile_editor.js:1764-1767)');
            }, DEAD_STEP));

            test('the note stays inside the host, at the band width and narrower',
                () => mounted(async (page) => {
                    for (const width of [SLATE_BAND_W, 260, 200]) {
                        await page.setStyle('ui-exit-sentence', { 'inline-size': `${width}px` });
                        await page.settle(2);
                        const hostBox = await page.box('ui-exit-sentence');
                        const note = await page.box('ui-exit-sentence >>> #note-condition');
                        assert.ok(note.right <= hostBox.right + 0.6 && note.left >= hostBox.left - 0.6,
                            `E16 (spec §7.4, :1167) at ${width}px: the note spills sideways — ` +
                            `note [${note.left}, ${note.right}] against host [${hostBox.left}, ${hostBox.right}]`);
                        assert.ok(note.bottom <= hostBox.bottom + 0.6,
                            `E16 at ${width}px: the note spills below the band — ` +
                            `note bottom ${note.bottom} against host bottom ${hostBox.bottom}. ` +
                            'Slate appends it into a FIXED 280px track with no overflow anywhere, ' +
                            '"so the excess spills symmetrically into the rows above and below".');
                    }
                }, DEAD_STEP));

            test('the three slot rows are the SAME height with the note and without it',
                () => browser.withPage({ geometry }, async (page) => {
                    const read = async (step) => {
                        await page.mount(host(step), MODULE);
                        await page.setStyle('ui-exit-sentence', { 'inline-size': `${SLATE_BAND_W}px` });
                        await page.settle(2);
                        return page.evalFn(() => {
                            const root = document.querySelector('ui-exit-sentence').shadowRoot;
                            return Array.from(root.querySelectorAll('.row'))
                                .map((r) => Math.round(r.getBoundingClientRect().height));
                        });
                    };
                    const withNote = await read(DEAD_STEP);
                    const without = await read(PRESSURE_STEP);
                    assert.deepEqual(withNote, without,
                        'Appendix 9: "the band never changes height" — the SLOTS must not. ' +
                        'A note that resizes its neighbours is E16 wearing a different hat.');
                }));

            test('the flagged sentence is marked, and says why in its own title',
                () => mounted(async (page) => {
                    const title = await page.evalFn(() => document.querySelector('ui-exit-sentence')
                        .shadowRoot.querySelector('#sentence-condition').getAttribute('title'));
                    assert.equal(title, 'never fires — cannot fall below zero');
                    const note = await page.evalFn(() => document.querySelector('ui-exit-sentence')
                        .shadowRoot.querySelector('#note-condition').textContent.replace(/\s+/g, ' ').trim());
                    /* The note names what WILL end the step, from the step's remaining
                     * exits — "not an assumed duration cap" (exit-validity.js:47-49). */
                    assert.equal(note, 'never fires — cannot fall below zero · ends on 100 mL');
                }, DEAD_STEP));
        });

        describe('token drills', () => {
            test('--ui-key paints the sentence face', () => mounted((page) => assertTokenDrill(page, {
                token: '--ui-key', value: DRILL_COLOUR,
                selector: 'ui-exit-sentence >>> #sentence-condition', property: 'background-color',
            })));

            test('--ui-text-2 is the sentence ink', () => mounted((page) => assertTokenDrill(page, {
                token: '--ui-text-2', value: DRILL_COLOUR,
                selector: 'ui-exit-sentence >>> #sentence-condition', property: 'color',
            })));

            test('--ui-channel-pressure is the pressure tone', () => mounted((page) => assertTokenDrill(page, {
                token: '--ui-channel-pressure', value: DRILL_COLOUR,
                selector: 'ui-exit-sentence >>> #row-condition .number', property: 'color',
            })));

            test('--ui-steel is the untoned slot\'s tone', () => mounted((page) => assertTokenDrill(page, {
                token: '--ui-steel', value: DRILL_COLOUR,
                selector: 'ui-exit-sentence >>> #row-volume .number', property: 'color',
            })));

            test('--ui-muted is the unit ink', () => mounted((page) => assertTokenDrill(page, {
                token: '--ui-muted', value: DRILL_COLOUR,
                selector: 'ui-exit-sentence >>> #row-condition .unit', property: 'color',
            })));

            test('--ui-line is the sentence border', () => mounted((page) => assertTokenDrill(page, {
                token: '--ui-line', value: DRILL_COLOUR,
                selector: 'ui-exit-sentence >>> #sentence-condition', property: 'border-top-color',
            })));

            test('--ui-tint-power is the dead-exit ink', () => mounted((page) => assertTokenDrill(page, {
                token: '--ui-tint-power', value: DRILL_COLOUR,
                selector: 'ui-exit-sentence >>> #note-condition', property: 'color',
            }), DEAD_STEP));

            test('--ui-status-danger reaches the × glyph through the mix',
                () => mounted((page) => assertTokenDrill(page, {
                    token: '--ui-status-danger', value: DRILL_COLOUR,
                    selector: 'ui-exit-sentence >>> #row-condition .glyph', property: 'color',
                    /* A component of a color-mix, not the whole value. */
                    expectLanding: false,
                })));

            test('--ui-line-strong reaches the add slot\'s dashed border through the mix',
                () => mounted((page) => assertTokenDrill(page, {
                    token: '--ui-line-strong', value: DRILL_COLOUR,
                    selector: 'ui-exit-sentence >>> #add-weight', property: 'border-top-color',
                    expectLanding: false,
                })));

            test('--ui-space-2 is the one gap, in both axes', () => mounted((page) => assertTokenDrill(page, {
                token: '--ui-space-2', value: DRILL_LENGTH,
                selector: 'ui-exit-sentence >>> #row-condition', property: 'column-gap',
            })));

            test('--ui-control-h is the row floor', () => mounted((page) => assertTokenDrill(page, {
                token: '--ui-control-h', value: DRILL_LENGTH,
                selector: 'ui-exit-sentence >>> #sentence-condition', property: 'min-block-size',
            })));

            test('--ui-text-note sizes the subject and the number',
                () => mounted((page) => assertTokenDrill(page, {
                    token: '--ui-text-note', value: DRILL_LENGTH,
                    selector: 'ui-exit-sentence >>> #row-condition .subject', property: 'font-size',
                })));

            test('--ui-text-sm sizes the verb and the unit', () => mounted((page) => assertTokenDrill(page, {
                token: '--ui-text-sm', value: DRILL_LENGTH,
                selector: 'ui-exit-sentence >>> #row-condition .unit', property: 'font-size',
            })));
        });

        test('there is no selection here, and therefore no private selected look',
            () => mounted(async (page) => {
                const a = JSON.parse(await page.eval(TREE_AUDIT));
                assert.deepEqual(a.selectionish, [],
                    'an exit slot is occupied or offered, never selected. A selection aria state ' +
                    'here means a private "selected" look arrived with it (wave law; spec §3.9).');
                const dials = await page.evalFn(() => {
                    const root = document.querySelector('ui-exit-sentence').shadowRoot;
                    const own = Array.from(root.adoptedStyleSheets)
                        .map((s) => Array.from(s.cssRules).map((r) => r.cssText).join('\n')).join('\n');
                    return ['--ui-selected-face', '--ui-selected-ink', '--ui-selected-led', '--ui-selected-glow']
                        .filter((d) => own.indexOf(d + ':') !== -1);
                });
                assert.deepEqual(dials, [],
                    'this component redeclares a selection dial without having a selection');
            }));

        describe('focus geometry', () => {
            test('the sentence ring is the token ring and nothing clips it',
                () => mounted((page) => assertFocusUnclipped(page, 'ui-exit-sentence >>> #sentence-condition')));

            test('the remove button\'s ring is unclipped through #2\'s boundary',
                () => mounted((page) => assertFocusUnclipped(page, 'ui-exit-sentence >>> #remove-condition >>> #control')));

            test('the add slot\'s ring is unclipped',
                () => mounted((page) => assertFocusUnclipped(page, 'ui-exit-sentence >>> #add-weight')));

            test('the ring survives the scrolling band — an inset-worthy case, measured',
                () => mounted(async (page) => {
                    await page.setStyle('ui-exit-sentence', { 'block-size': '140px' });
                    await page.settle(2);
                    await assertFocusUnclipped(page, 'ui-exit-sentence >>> #sentence-condition');
                }));
        });

        describe('the band\'s floor and overflow', () => {
            test('squeezed, it scrolls and shows it — it never clips silently',
                () => mounted(async (page) => {
                    const floor = parseFloat(await page.resolveToken('--ui-control-h', 'block-size'));
                    await assertScrollFloor(page, {
                        selector: 'ui-exit-sentence >>> #band',
                        squeezeSelector: 'ui-exit-sentence',
                        squeeze: { 'block-size': '120px' },
                        minBlockSize: floor,
                    });
                }));

            test('the host itself will not go below one row', () => mounted(async (page) => {
                const floor = parseFloat(await page.resolveToken('--ui-control-h', 'block-size'));
                await page.setStyle('ui-exit-sentence', { 'block-size': '10px' });
                await page.settle(2);
                const box = await page.box('ui-exit-sentence');
                assert.ok(box.height >= floor - 0.6,
                    `the band shrank to ${box.height}px against a stated floor of ${floor}px`);
            }));

            test('unconstrained, the band does not overflow itself', () => mounted(async (page) => {
                const m = await page.metrics('ui-exit-sentence >>> #band');
                assert.ok(m.scrollHeight <= m.clientHeight + 0.6,
                    `a content-sized band that already overflows is E16: scroll ${m.scrollHeight} ` +
                    `against client ${m.clientHeight}`);
            }, DEAD_STEP));
        });

        describe('aria — E14 cannot express', () => {
            test('the sentence keeps its visible words as its accessible name',
                () => mounted(async (page) => {
                    const rendered = JSON.parse(await page.eval(partsOf('condition')));
                    assert.equal(rendered.ariaLabel, null,
                        'an aria-label here would override the sentence a user can read — ' +
                        'Slate wrote "Edit Pressure condition" over "Pressure rises past 4.5 bar"');
                    for (const part of [rendered.subject, rendered.verb, rendered.number, rendered.unit]) {
                        assert.ok(rendered.text.includes(part), `"${part}" is not in the button's own text`);
                    }
                }));

            test('the two remove buttons have DIFFERENT names, and both name their slot',
                () => mounted(async (page) => {
                    const a = JSON.parse(await page.eval(partsOf('condition')));
                    const b = JSON.parse(await page.eval(partsOf('volume')));
                    assert.ok(a.removeLabel && b.removeLabel, 'a remove button with no name at all');
                    assert.notEqual(a.removeLabel, b.removeLabel,
                        'E14 verbatim: "32 grid ± buttons share two aria-labels". Two controls ' +
                        'that do different things may not answer to the same name.');
                    assert.ok(a.removeLabel.includes('Pressure'));
                    assert.ok(b.removeLabel.includes('Volume'));
                }));

            test('the add-condition trigger announces its popup, through #21',
                () => mounted(async (page) => {
                    const aria = await page.evalFn(() => {
                        const root = document.querySelector('ui-exit-sentence').shadowRoot;
                        const btn = root.querySelector('#add-condition');
                        return { haspopup: btn.getAttribute('aria-haspopup'), expanded: btn.getAttribute('aria-expanded') };
                    });
                    assert.equal(aria.haspopup, 'menu');
                    assert.equal(aria.expanded, 'false');
                }, EMPTY_STEP));

            test('B2 — no bound is written into the DOM anywhere', () => mounted(async (page) => {
                const a = JSON.parse(await page.eval(TREE_AUDIT));
                assert.deepEqual(a.bounds, [],
                    'a min/max/step attribute in the tree is a second copy of the one ranges ' +
                    'table (B2). Bounds travel on the seam record, not on an element.');
            }));
        });

        describe('events', () => {
            test('the sentence asks the SCREEN to edit, and carries the seam record with it',
                () => mounted(async (page) => {
                    await page.recordEvents('ui-exit-sentence', ['exit-edit']);
                    await page.click('ui-exit-sentence >>> #sentence-condition');
                    await page.settle(2);
                    const [event] = await page.recordedEvents();
                    assert.equal(event.type, 'exit-edit');
                    assert.equal(event.detail.slot, 'condition');
                    assert.equal(event.detail.type, 'pressure');
                    assert.equal(event.detail.index, 0);
                    assert.equal(event.detail.serialized.max, 12);
                    assert.equal(event.detail.serialized.sentence, 'Pressure rises past 4.5 bar');
                }));

            test('the × asks the screen to remove', () => mounted(async (page) => {
                await page.recordEvents('ui-exit-sentence', ['exit-remove']);
                await page.click('ui-exit-sentence >>> #remove-volume >>> #control');
                await page.settle(2);
                const [event] = await page.recordedEvents();
                assert.equal(event.type, 'exit-remove');
                assert.equal(event.detail.slot, 'volume');
            }));

            test('an add slot asks the screen to add', () => mounted(async (page) => {
                await page.recordEvents('ui-exit-sentence', ['exit-add']);
                await page.click('ui-exit-sentence >>> #add-weight');
                await page.settle(2);
                const [event] = await page.recordedEvents();
                assert.equal(event.type, 'exit-add');
                assert.equal(event.detail.slot, 'weight');
                assert.equal(event.detail.type, 'weight');
            }));

            test('nothing this component does mutates the step it was handed',
                () => mounted(async (page) => {
                    const after = await page.evalFn(() => {
                        const el = document.querySelector('ui-exit-sentence');
                        el.shadowRoot.querySelector('#sentence-condition').click();
                        el.shadowRoot.querySelector('#add-weight').click();
                        return JSON.stringify(el.step);
                    });
                    assert.deepEqual(JSON.parse(after), PRESSURE_STEP,
                        'the draft is the screen\'s; this band reads it and reports');
                }));

            test('disabled refuses as well as dims', () => mounted(async (page) => {
                const state = await page.evalFn(() => {
                    const root = document.querySelector('ui-exit-sentence').shadowRoot;
                    return {
                        sentence: root.querySelector('#sentence-condition').disabled,
                        add: root.querySelector('#add-weight').disabled,
                        remove: root.querySelector('#remove-condition').shadowRoot.querySelector('#control').disabled,
                        opacity: getComputedStyle(document.querySelector('ui-exit-sentence')).opacity,
                    };
                });
                assert.equal(state.sentence, true);
                assert.equal(state.add, true);
                assert.equal(state.remove, true);
                assert.ok(parseFloat(state.opacity) < 1, 'the base dial did not dim the host');
            }, PRESSURE_STEP, 'disabled'));
        });

        test('every gallery state mounts and renders three rows', () => browser.withPage({ geometry }, async (page) => {
            for (const state of galleryEntry.states) {
                await page.mount(state.html, MODULE);
                assert.deepEqual(page.pageErrors, [], `gallery state ${state.id} threw`);
                if (state.hostStyle) await page.setStyle('ui-exit-sentence', state.hostStyle);
                await page.settle(2);
                const rows = await page.evalFn(() => document.querySelector('ui-exit-sentence')
                    .shadowRoot.querySelectorAll('.row').length);
                assert.equal(rows, 3, `gallery state ${state.id} rendered ${rows} rows, not three`);
            }
        }));
    });
}
