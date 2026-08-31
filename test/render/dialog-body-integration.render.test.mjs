/**
 *.2, item dialog-body-integration.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';
import { limitsFor } from '../../src/lib/machine-limits.js';
import { assertScrollFloor, pressBackdrop } from '../harness/assertions.js';

const BENGLE = limitsFor('bengle');

const page = (subject) => `
<div id="page" style="padding: 40px">
  <ui-button id="invoker">Open</ui-button>
  <button id="outside" style="margin-inline-start: 24px">Outside</button>
  ${subject}
</div>`;

/** Opens the subject the way a screen does, whichever family it belongs to. */
const WIRE = `(() => {
    window.__hits = [];
    window.__esc = [];
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') window.__esc.push('document'); });
    const subject = document.getElementById('subject');
    const invoker = document.getElementById('invoker');
    if (invoker && subject) {
        invoker.addEventListener('click', () => subject.show({ invoker, reason: 'press' }));
    }
    const outside = document.getElementById('outside');
    if (outside) outside.addEventListener('click', () => window.__hits.push('outside'));
    return true;
})()`;

const DIALOG_MODULE = '/src/components/ui-dialog.js';
const BUTTON_MODULE = '/src/components/ui-button.js';

const BODIES = [
    {
        id: '#19 ui-confirm-dialog',
        family: 'hosted',
        shell: '#subject >>> #dialog',
        content: '#subject >>> #body',
        bodyFocusables: false,
        modules: ['/src/components/ui-confirm-dialog.js', BUTTON_MODULE, DIALOG_MODULE],
        markup: page(`
  <ui-confirm-dialog id="subject"
      question="Delete “Morning ristretto”?"
      detail="The profile, its notes and every shot recorded against it are removed from this machine. Nothing is copied anywhere first, and there is no undo: a profile deleted here is gone the moment the dialog closes."
      confirm-label="Delete" cancel-label="Keep" tone="danger"></ui-confirm-dialog>`),
    },
    {
        id: '#20 ui-sheet',
        family: 'slotted',
        shell: '#subject',
        content: '#subject ui-sheet',
        bodyFocusables: true,
        modules: [
            DIALOG_MODULE, '/src/components/ui-sheet.js', '/src/components/ui-text-field.js',
            '/src/components/ui-bank.js', BUTTON_MODULE,
        ],
        markup: page(`
  <ui-dialog id="subject" heading="Add schedule" style="--_ui-dialog-inline: 680px">
    <ui-sheet slot="body" fields='[
        {"name":"time","label":"Wake Time"},
        {"name":"days","label":"Days of Week"},
        {"name":"awake","label":"Keep Awake For","layout":"inline",
         "caption":"Duration to keep machine awake after schedule starts."}]'>
      <ui-text-field slot="time" label="Wake Time" hide-label value="05:30"></ui-text-field>
      <ui-bank slot="days" label="Days of week" value="Mon"
               items='["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]'></ui-bank>
      <ui-text-field slot="awake" label="Hours" hide-label value="1"
                     align="center" style="inline-size: 120px"></ui-text-field>
      <span slot="awake">hr</span>
    </ui-sheet>
    <ui-button slot="actions">Cancel</ui-button>
    <ui-button slot="actions" variant="primary">Save</ui-button>
  </ui-dialog>`),
    },
    {
        id: '#53 ui-numeric-keypad',
        family: 'hosted',
        shell: '#subject >>> #dialog',
        content: '#subject >>> #body',
        bodyFocusables: true,
        modules: ['/src/components/ui-numeric-keypad.js', BUTTON_MODULE, DIALOG_MODULE],
        markup: page(`
  <ui-numeric-keypad id="subject" heading="Dose in" limit-key="dose" unit="g"
                     value="18"></ui-numeric-keypad>`),
        /* The R2 table is a PROPERTY — "the ONLY route to a bound"
         * (`ui-numeric-keypad.js:219`). Without it the body renders its unavailable
         * state, which would prove the contract on the wrong content. */
        prime: (p) => p.evalFn((table) => {
            document.getElementById('subject').limits = table;
            return true;
        }, BENGLE),
    },
    {
        id: '#54 ui-time-picker',
        family: 'slotted',
        shell: '#subject',
        content: '#subject ui-time-picker',
        bodyFocusables: true,
        modules: [DIALOG_MODULE, '/src/components/ui-time-picker.js', BUTTON_MODULE],
        markup: page(`
  <ui-dialog id="subject" heading="Set time">
    <ui-time-picker slot="body" value="06:30"></ui-time-picker>
    <ui-button slot="actions">Cancel</ui-button>
    <ui-button slot="actions" variant="primary">OK</ui-button>
  </ui-dialog>`),
    },
    {
        id: '#55 ui-notes-editor',
        family: 'slotted',
        shell: '#subject',
        content: '#subject ui-notes-editor',
        bodyFocusables: true,
        modules: [DIALOG_MODULE, '/src/components/ui-notes-editor.js', BUTTON_MODULE],
        markup: page(`
  <ui-dialog id="subject" heading="Notes">
    <ui-notes-editor slot="body" label="Notes"
                     value="Dialled in on the 14 g basket. Grind two clicks finer than the bag suggests, and the shot runs long by about three seconds on a cold group."></ui-notes-editor>
    <ui-button slot="actions">Cancel</ui-button>
    <ui-button slot="actions" variant="primary">Save</ui-button>
  </ui-dialog>`),
    },
    {
        id: '#exit editor-exit-dialog',
        family: 'hosted',
        shell: '#subject >>> #dialog',
        content: '#subject >>> #body',
        bodyFocusables: true,
        modules: ['/src/screens/editor-exit-dialog.js', BUTTON_MODULE, DIALOG_MODULE],
        markup: page('\n  <editor-exit-dialog id="subject"></editor-exit-dialog>'),
        prime: (p) => p.evalFn(async () => {
            const ranges = await import('/src/lib/editor-ranges.js');
            const adapters = await import('/src/data/adapters-r.js');
            const subject = document.getElementById('subject');
            subject.ranges = ranges.createEditorRanges({
                machineLimits: adapters.r2MachineLimits([{ id: 'machine' }]).value,
                machineClass: adapters.machineClassFromServedSet([{ id: 'machine' }]),
            });
            subject.step = {
                name: 'Infusion', pump: 'flow', transition: 'fast', flow: 4, seconds: 30,
                temperature: 92, sensor: 'coffee', volume: 0, weight: 0,
                exit: { type: 'pressure', condition: 'over', value: 4.5 },
                limiter: { value: 9, range: 0.6 },
            };
            await subject.updateComplete;
            return true;
        }),
    },
    {
        id: '#lever editor-lever-dialog',
        family: 'hosted',
        shell: '#subject >>> #dialog',
        content: '#subject >>> #body',
        bodyFocusables: true,
        modules: ['/src/screens/editor-lever-dialog.js', BUTTON_MODULE, DIALOG_MODULE],
        markup: page('\n  <editor-lever-dialog id="subject"></editor-lever-dialog>'),
        prime: (p) => p.evalFn(async () => {
            const ranges = await import('/src/lib/editor-ranges.js');
            const adapters = await import('/src/data/adapters-r.js');
            const subject = document.getElementById('subject');
            subject.ranges = ranges.createEditorRanges({
                machineLimits: adapters.r2MachineLimits([{ id: 'machine' }]).value,
                machineClass: adapters.machineClassFromServedSet([{ id: 'machine' }]),
            });
            subject.step = {
                name: 'Lever pull', pump: 'lever', transition: 'fast', pressure: 8,
                leverSpring: 0.4, leverGive: 0.8, seconds: 25, temperature: 92,
                sensor: 'coffee', volume: 0, weight: 0, exit: null,
                limiter: { value: 0, range: 0.6 },
            };
            await subject.updateComplete;
            return true;
        }),
    },
];

/** Rendered lengths at dsf 1.5 are not string-comparable; whole CSS px are. */
const near = (got, want, what, tol = 0.51) => assert.ok(
    Math.abs(got - want) <= tol,
    `${what}: expected ${want}, got ${got}`,
);

const activePath = (p) => p.eval('window.__h.anchorPath(window.__h.deepActiveElement())');
const hits = async (p) => JSON.parse(await p.eval('JSON.stringify(window.__hits)'));
const escapes = async (p) => JSON.parse(await p.eval('JSON.stringify(window.__esc)'));

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`dialog bodies in #18 @ ${geometry.name} (${geometry.width}×${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {
        for (const body of BODIES) {
            describe(`${body.id} (${body.family})`, () => {
                const NATIVE = `${body.shell} >>> #dialog`;
                const CELL = `${body.shell} >>> #body`;
                const HEAD = `${body.shell} >>> #head`;
                const ACTIONS = `${body.shell} >>> #actions`;

                const mounted = (fn) => browser.withPage({ geometry }, async (p) => {
                    await p.mount(body.markup, body.modules);
                    await p.eval(WIRE);
                    if (body.prime) await body.prime(p);
                    await p.settle(3);
                    assert.deepEqual(p.pageErrors, [], 'the composition must mount without throwing');
                    return fn(p);
                });

                /** Open the way a finger does: a real press on a real invoker. */
                const open = async (p) => {
                    await p.click('#invoker');
                    await p.settle(3);
                    assert.equal(
                        await p.evalFn(() => document.getElementById('subject').open === true), true,
                        'the press did not open the dialog',
                    );
                };

                test('exactly one native <dialog> in the composed tree, and the body owns none',
                    () => mounted(async (p) => {
                        await open(p);

                        /* Every <dialog> anywhere on the page, through every shadow
                         * root. Seven implementations start at two. */
                        const total = await p.eval(
                            "window.__h.deepAll().filter(function (e) { return e.tagName === 'DIALOG'; }).length",
                        );
                        assert.equal(total, 1,
                            'O6: "seven hand-rolled dialogs" — the composition must contribute exactly one');
                        assert.equal(await p.exists(NATIVE), true, 'and it is #18\'s');
                    }));

                test('the shell paints the one scrim; the body contributes no second one',
                    () => mounted(async (p) => {
                        await open(p);
                        const backdrop = await p.computed(
                            NATIVE, ['background-color', 'backdrop-filter'], { pseudo: '::backdrop' },
                        );
                        assert.equal(
                            backdrop['background-color'],
                            await p.resolveValue('var(--ui-scrim)', 'background-color'),
                            'O6: eight scrim colours become one token, whichever body is inside',
                        );
                        assert.equal(
                            backdrop['backdrop-filter'],
                            await p.resolveValue('blur(var(--ui-scrim-blur))', 'backdrop-filter'),
                            'O6: six blur radii become one',
                        );

                        const filters = await p.eval(`(() => {
                            const out = [];
                            for (const el of window.__h.deepAll()) {
                                const cs = getComputedStyle(el);
                                if (cs.backdropFilter && cs.backdropFilter !== 'none') {
                                    out.push(window.__h.anchorPath(el));
                                }
                            }
                            return JSON.stringify(out);
                        })()`);
                        assert.deepEqual(JSON.parse(filters), [],
                            '§4.6: the ::backdrop reaches the page directly — nothing blurs a wrapper');
                    }));

                test('the contract block holds: bounded card, three tracks, the body the only 1fr',
                    () => mounted(async (p) => {
                        await open(p);
                        const space5 = parseFloat(await p.resolveValue('var(--ui-space-5)', 'width'));
                        const space6 = parseFloat(await p.resolveValue('var(--ui-space-6)', 'width'));
                        const seam = parseFloat(await p.resolveValue('var(--ui-seam)', 'width'));

                        const style = await p.computed(NATIVE, ['display', 'grid-template-rows']);
                        assert.equal(style.display, 'grid');

                        const headDisplay = await p.prop(HEAD, 'display');
                        const actsDisplay = await p.prop(ACTIONS, 'display');
                        const cells = ['body']
                            .concat(headDisplay === 'none' ? [] : ['head'])
                            .concat(actsDisplay === 'none' ? [] : ['actions']);
                        const tracks = style['grid-template-rows'].trim().split(/\s+/);
                        assert.equal(tracks.length, cells.length,
                            `§4.6 "grid-rows: auto minmax(0,1fr) auto" — one track per cell that exists `
                            + `(${cells.sort().join('/')}), got ${style['grid-template-rows']}`);

                        const card = await p.box(NATIVE);
                        const cell = await p.box(CELL);
                        const ordered = [];
                        if (headDisplay !== 'none') ordered.push(['header', await p.box(HEAD)]);
                        ordered.push(['body', cell]);
                        if (actsDisplay !== 'none') ordered.push(['actions', await p.box(ACTIONS)]);

                        near(ordered[0][1].top, card.top, `the ${ordered[0][0]} is the first track`);
                        for (let i = 1; i < ordered.length; i += 1) {
                            near(ordered[i][1].top, ordered[i - 1][1].bottom + seam,
                                `one seam between ${ordered[i - 1][0]} and ${ordered[i][0]}`);
                        }
                        near(ordered.at(-1)[1].bottom, card.bottom,
                            `the ${ordered.at(-1)[0]} is the last track`);

                        assert.ok(card.width <= geometry.width - 2 * space6 + 0.5,
                            '§4.6 inline-size: min(intrinsic, 100% - 2 × --ui-space-6)');
                        assert.ok(card.height <= geometry.height - 2 * space5 + 0.5,
                            '§4.6 max-block-size: calc(100% - 2 × --ui-space-5)');

                        const m = await p.metrics(CELL);
                        assert.equal(m.overflowY, 'auto',
                            '§4.6: "body: overflow-y auto — MANDATORY", for every body');
                    }));

                test('the body content is IN the body cell — one slot, not a hand-placed box',
                    () => mounted(async (p) => {
                        await open(p);

                        const slot = await p.evalFn(
                            (s) => window.__h.need(s).assignedSlot?.name ?? null, body.content,
                        );
                        assert.equal(slot, 'body',
                            '§4.6: "header / body / actions slots" — the body arrives through the body slot');

                        const cell = await p.box(CELL);
                        const content = await p.box(body.content);
                        assert.ok(content.top >= cell.top - 0.51,
                            `the body content starts above the scroll region (${JSON.stringify(content)} vs ${JSON.stringify(cell)})`);
                        assert.ok(content.left >= cell.left - 0.51 && content.right <= cell.right + 0.51,
                            'the body content escapes the scroll region horizontally');
                    }));

                test('the order of surrender is the body: it absorbs, the header and footer do not',
                    () => mounted(async (p) => {
                        await open(p);
                        const headBefore = await p.box(HEAD);
                        const actsBefore = await p.box(ACTIONS);
                        const seam = parseFloat(await p.resolveValue('var(--ui-seam)', 'width'));

                        const cap = `${Math.round(headBefore.height + actsBefore.height + 2 * seam + 96)}px`;
                        await assertScrollFloor(p, {
                            selector: CELL,
                            squeezeSelector: NATIVE,
                            squeeze: { 'max-block-size': cap },
                        });

                        await p.setStyle(NATIVE, { 'max-block-size': cap });
                        await p.settle(2);
                        const headAfter = await p.box(HEAD);
                        const actsAfter = await p.box(ACTIONS);
                        await p.setStyle(NATIVE, { 'max-block-size': null });

                        near(headAfter.height, headBefore.height, 'the header does not surrender');
                        near(actsAfter.height, actsBefore.height,
                            '§2.4: the last thing to go is the way out of the dialog');
                    }));

                test('the trap holds: every tabbable is inside the card, and Tab wraps',
                    () => mounted(async (p) => {
                        await open(p);

                        const count = await p.evalFn((s) => window.__h.need(s).tabbables.length, body.shell);
                        assert.ok(count >= 2,
                            `the trap needs something to cycle through; ${body.id} offered ${count}`);

                        const outside = await p.eval(`(() => {
                            const d = window.__h.need(${JSON.stringify(body.shell)});
                            const inside = (el) => {
                                let node = el;
                                while (node) {
                                    if (node === d) return true;
                                    const parent = node.parentElement;
                                    if (parent) { node = parent; continue; }
                                    const root = node.getRootNode();
                                    node = root && root.host ? root.host : null;
                                }
                                return false;
                            };
                            return JSON.stringify(d.tabbables
                                .filter((el) => !inside(el))
                                .map((el) => window.__h.anchorPath(el)));
                        })()`);
                        assert.deepEqual(JSON.parse(outside), [],
                            'every trapped control must be inside the one <dialog>, not on the page');

                        /* Land on the last one and Tab: the wrap is the trap. */
                        await p.evalFn((s) => {
                            const t = window.__h.need(s).tabbables;
                            t[t.length - 1].focus();
                            return true;
                        }, body.shell);
                        const first = await p.evalFn(
                            (s) => window.__h.anchorPath(window.__h.need(s).tabbables[0]), body.shell,
                        );
                        await p.press('Tab');
                        await p.settle(2);
                        assert.equal(await activePath(p), first,
                            'Tab past the last control wraps to the first — it never reaches the page');

                        await p.press('Tab', { modifiers: 8 });   /* Shift */
                        await p.settle(2);
                        const last = await p.evalFn((s) => {
                            const t = window.__h.need(s).tabbables;
                            return window.__h.anchorPath(t[t.length - 1]);
                        }, body.shell);
                        assert.equal(await activePath(p), last, 'and Shift+Tab wraps the other way');
                    }));

                if (body.bodyFocusables) {
                    test('the trap reaches ACROSS the slot into this body\'s own shadow tree',
                        () => mounted(async (p) => {
                            await open(p);
                            const cell = await p.box(CELL);
                            const inBody = await p.eval(`(() => {
                                const d = window.__h.need(${JSON.stringify(body.shell)});
                                const cell = window.__h.need(${JSON.stringify(CELL)}).getBoundingClientRect();
                                return d.tabbables.filter((el) => {
                                    const r = el.getBoundingClientRect();
                                    return r.top >= cell.top - 0.5 && r.bottom <= cell.bottom + 0.5;
                                }).length;
                            })()`);
                            assert.ok(inBody > 0,
                                `a DOM-tree trap would skip the slotted body entirely — none of the `
                                + `tabbables were inside ${JSON.stringify(cell)}`);
                        }));
                }

                test('the page is inert while this body is open, and the MARK is what refuses the caret',
                    () => mounted(async (p) => {
                        await open(p);
                        assert.equal(
                            await p.evalFn(() => document.getElementById('outside').inert === true), true,
                            'H9: "every control behind them stays focusable" — the mark is on the page',
                        );

                        const before = await activePath(p);
                        const after = await p.eval(`(() => {
                            document.getElementById('outside').focus();
                            return window.__h.anchorPath(window.__h.deepActiveElement());
                        })()`);
                        assert.equal(after, before, 'a focus() on a background control does nothing');

                        const unmarked = await p.eval(`(() => {
                            const o = document.getElementById('outside');
                            o.inert = false;
                            o.focus();
                            const seen = window.__h.anchorPath(window.__h.deepActiveElement());
                            o.inert = true;
                            return seen;
                        })()`);
                        assert.equal(unmarked, before,
                            'the caret must stay inside the card even with the mark removed — if it landed on '
                            + '#outside the composition would not be modal at all');

                        /* Coverage, asserted AS coverage: the point the background
                         * control occupies resolves to the open dialog, which is why no
                         * press of it can run its handler. */
                        const atPoint = await p.eval(`(() => {
                            const r = document.getElementById('outside').getBoundingClientRect();
                            const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
                            return window.__h.anchorPath(el);
                        })()`);
                        assert.doesNotMatch(atPoint, /button#outside/,
                            `the background control is not the element at its own coordinates: got ${atPoint}`);
                        await p.click('#outside');
                        assert.deepEqual(await hits(p), [], 'and a real hit-tested click runs no handler');
                    }));

                test('a press on the ::backdrop dismisses this body and hands the page back',
                    () => mounted(async (p) => {
                        await open(p);
                        await p.recordEvents(body.shell, ['close-request']);
                        const point = await pressBackdrop(p, NATIVE);

                        const events = await p.recordedEvents();
                        assert.deepEqual(events.map((e) => e.detail.reason), ['backdrop'],
                            `the press at (${point.x}, ${point.y}) must arrive as one close-request `
                            + '(ui-dialog.js:1120-1127) — O8 is the overlay with no backdrop dismiss');
                        assert.equal(
                            await p.evalFn(() => document.getElementById('subject').open === true), false,
                            'the dismissal must close the COMPOSITION, not just the shell',
                        );
                        assert.equal(
                            await p.evalFn(() => document.getElementById('outside').inert === true), false,
                            'a page left permanently inert is worse than a page never isolated',
                        );
                        await p.click('#outside');
                        assert.deepEqual(await hits(p), ['outside'], 'and the control works again');
                    }));

                test('closing puts the caret back on the invoker, synchronously',
                    () => mounted(async (p) => {
                        await open(p);
                        assert.doesNotMatch(await activePath(p), /button#invoker/,
                            'opening moves the caret into the dialog');

                        const seen = await p.eval(`(() => {
                            document.getElementById('subject').hide('api');
                            return window.__h.anchorPath(window.__h.deepActiveElement());
                        })()`);
                        assert.match(seen, /ui-button#invoker/,
                            '§4.6: "no focus restore" is the half a screenshot cannot see');

                        await p.eval("(() => { document.getElementById('outside').focus(); return true; })()");
                        await p.settle(3);
                        assert.match(await activePath(p), /button#outside/,
                            'and nothing steals the caret back a microtask later');
                    }));

                test('Escape closes this body through the shell, and the document never sees the key',
                    () => mounted(async (p) => {
                        await open(p);
                        await p.recordEvents(body.shell, ['close-request', 'open-change']);
                        await p.press('Escape');
                        await p.settle(3);

                        assert.equal(
                            await p.evalFn(() => document.getElementById('subject').open === true), false,
                            'Escape must close the composition, not just the shell',
                        );
                        const events = await p.recordedEvents();
                        assert.deepEqual(events.map((e) => e.type), ['close-request', 'open-change'],
                            'exactly one of each: the UA cancel is prevented so there is one door');
                        assert.equal(events[0].detail.reason, 'escape');

                        assert.deepEqual(await escapes(p), [],
                            'the shell owns the key before anything else acts on it');

                        assert.equal(
                            await p.evalFn(() => document.getElementById('outside').inert === true), false,
                            'the marks come off on the Escape path too, not only on the backdrop one',
                        );
                        await p.click('#outside');
                        assert.deepEqual(await hits(p), ['outside'],
                            'and the page is live again after an Escape close');
                    }));
            });
        }
    });
}
