/**
 *.2, the contract-and-modality cluster.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';
import { assertTokenDrill, pressBackdrop, DRILL_COLOUR, DRILL_LENGTH } from '../harness/assertions.js';
import { limitsFor } from '../../src/lib/machine-limits.js';

const BENGLE_LIMITS = limitsFor('bengle');

/* The library #18 composes, plus the two controls every fixture puts on the page. */
const BASE = [
    '/src/components/ui-dialog.js',
    '/src/components/ui-button.js',
    '/src/components/ui-icon-button.js',
];

/**
 * Two fields, no caption — the shape `ui-sheet.render.test.mjs` uses for its own
 * dialog composition, and small enough that the FLOOR geometry is not the subject.
 */
const SHEET_FIELDS = JSON.stringify([
    { name: 'time', label: 'Wake Time' },
    { name: 'awake', label: 'Keep Awake For', layout: 'inline' },
]).replace(/"/g, '&quot;');

const page = (contents) => `
<div id="page" style="padding: 40px">
  <ui-button id="invoker">Open</ui-button>
  <button id="outside" style="margin-inline-start: 24px">Outside</button>
  <ui-button id="page-btn">Cancel</ui-button>
  ${contents}
</div>`;

const INSTANCES = [
    {
        id: 'shell #18',
        host: '#d',
        shell: '#d',
        cancel: '#cancel',
        inside: /ui-dialog#d/,
        modules: BASE,
        markup: page(`
  <ui-dialog id="d" heading="Edit step">
    <ui-icon-button id="close" slot="header-trail" label="Close">✕</ui-icon-button>
    <div slot="body" id="body-content">
      <p id="prose" style="margin: 0">A body written by hand, which is what a screen does.</p>
      <button id="b1">First</button>
      <button id="b2">Second</button>
    </div>
    <ui-button id="cancel" slot="actions">Cancel</ui-button>
    <ui-button id="confirm" slot="actions" variant="primary">Confirm</ui-button>
  </ui-dialog>`),
    },
    {
        id: 'confirm #19',
        host: '#c',
        shell: '#c >>> #dialog',
        cancel: '#c >>> #cancel',
        inside: /ui-confirm-dialog#c/,
        modules: [...BASE, '/src/components/ui-confirm-dialog.js'],
        markup: page(`
  <ui-confirm-dialog id="c" tone="destructive"
    question="Restore factory profiles?"
    detail="Three profiles you have edited will be replaced."
    cancel-label="Cancel" confirm-label="Restore"></ui-confirm-dialog>`),
    },
    {
        id: 'sheet #20',
        host: '#d',
        shell: '#d',
        cancel: '#cancel',
        inside: /ui-dialog#d/,
        modules: [...BASE, '/src/components/ui-sheet.js'],
        markup: page(`
  <ui-dialog id="d" heading="Add schedule">
    <ui-sheet id="sheet" slot="body" fields="${SHEET_FIELDS}">
      <input class="child" slot="time" id="s-time" type="text" value="05:30">
      <input class="child" slot="awake" id="s-hours" type="text" value="1">
      <span class="unit" slot="awake">hr</span>
    </ui-sheet>
    <ui-button id="cancel" slot="actions">Cancel</ui-button>
    <ui-button id="confirm" slot="actions" variant="primary">Save</ui-button>
  </ui-dialog>`),
    },
    {
        id: 'numpad #53',
        host: '#np',
        shell: '#np >>> #dialog',
        cancel: '#np >>> #cancel',
        inside: /ui-numeric-keypad#np/,
        modules: [...BASE, '/src/components/ui-numeric-keypad.js'],
        prepare: async (p) => {
            await p.evalFn((t) => { document.getElementById('np').limits = t; return true; }, BENGLE_LIMITS);
            await p.settle(2);
        },
        markup: page(`
  <ui-numeric-keypad id="np" heading="Dose in" limit-key="dose" unit="g" value="18"></ui-numeric-keypad>`),
    },
    {
        id: 'time picker #54',
        host: '#d',
        shell: '#d',
        cancel: '#cancel',
        inside: /ui-dialog#d/,
        modules: [...BASE, '/src/components/ui-time-picker.js'],
        markup: page(`
  <ui-dialog id="d" heading="Set time">
    <ui-time-picker id="tp" slot="body" value="06:30"></ui-time-picker>
    <ui-button id="cancel" slot="actions">Cancel</ui-button>
    <ui-button id="confirm" slot="actions" variant="primary">Set</ui-button>
  </ui-dialog>`),
    },
    {
        id: 'notes editor #55',
        host: '#d',
        shell: '#d',
        cancel: '#cancel',
        inside: /ui-dialog#d/,
        modules: [...BASE, '/src/components/ui-notes-editor.js'],
        markup: page(`
  <ui-dialog id="d" heading="Notes">
    <ui-notes-editor id="nt" slot="body" label="Notes" value="Ethiopia Guji, 17.5 g in."></ui-notes-editor>
    <ui-button id="cancel" slot="actions">Cancel</ui-button>
    <ui-button id="confirm" slot="actions" variant="primary">Save</ui-button>
  </ui-dialog>`),
    },
];

/** Wires the page the way a screen does: the press opens, and the page records hits. */
const wire = (hostId) => `(() => {
    window.__hits = [];
    window.__esc = [];
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') window.__esc.push('document'); });
    const host = document.querySelector('${hostId}');
    const invoker = document.getElementById('invoker');
    if (invoker && host) invoker.addEventListener('click', () => host.show({ invoker, reason: 'press' }));
    const outside = document.getElementById('outside');
    if (outside) outside.addEventListener('click', () => window.__hits.push('outside'));
    return true;
})()`;

/** Rendered lengths at dsf 1.5 are not string-comparable; whole CSS px are. */
const near = (got, want, what, tol = 0.51) => assert.ok(
    Math.abs(got - want) <= tol,
    `${what}: expected ${want}, got ${got}`,
);

/** Where the caret is, through every shadow root, as a readable path. */
const activePath = (p) => p.eval('window.__h.anchorPath(window.__h.deepActiveElement())');

const hits = async (p) => JSON.parse(await p.eval('JSON.stringify(window.__hits)'));

const escapesSeenByDocument = async (p) => JSON.parse(await p.eval('JSON.stringify(window.__esc)'));

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`the dialog contract @ ${geometry.name} (${geometry.width}×${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

        for (const instance of INSTANCES) {
            describe(instance.id, () => {

                const SHELL = instance.shell;
                const NATIVE = `${SHELL} >>> #dialog`;
                const HEAD = `${SHELL} >>> #head`;
                const BODY = `${SHELL} >>> #body`;
                const ACTIONS = `${SHELL} >>> #actions`;
                const CANCEL = `${instance.cancel} >>> #btn`;

                const mounted = (fn) => browser.withPage({ geometry }, async (p) => {
                    await p.mount(instance.markup, instance.modules);
                    await p.eval(wire(instance.host));
                    if (instance.prepare) await instance.prepare(p);
                    assert.deepEqual(p.pageErrors, [], 'the instance must mount without throwing');
                    return fn(p);
                });

                /** Open the way a finger does: a real CDP press on the invoker. */
                const open = async (p) => {
                    await p.click('#invoker');
                    await p.settle(3);
                    assert.equal(
                        await p.evalFn((s) => window.__h.need(s).open === true, instance.host), true,
                        'the press did not open the dialog',
                    );
                };

                const isOpen = (p) => p.evalFn((s) => window.__h.need(s).open === true, instance.host);

                test('the cell count is the row count, and the body is the only track that flexes',
                    () => mounted(async (p) => {
                        await open(p);
                        const seam = parseFloat(await p.resolveValue('var(--ui-seam)', 'width'));
                        const tracks = (await p.prop(NATIVE, 'grid-template-rows')).split(/\s+/);
                        assert.equal(await p.prop(NATIVE, 'display'), 'grid');

                        const card = await p.box(NATIVE);
                        const boxes = {
                            head: await p.box(HEAD),
                            body: await p.box(BODY),
                            actions: await p.box(ACTIONS),
                        };
                        const cells = [boxes.head, boxes.body, boxes.actions].filter((b) => b.height > 0.5);
                        assert.equal(tracks.length, cells.length,
                            `§4.6's template is one track per cell; tracks=${tracks.join(' ')}`);
                        assert.ok(boxes.body.height > 0.5, '§4.6: the body cell always exists');

                        let top = card.top;
                        for (const cell of cells) {
                            near(cell.top, top, 'the cells stack in order, one seam apart');
                            top = cell.bottom + seam;
                        }
                        near(cells[cells.length - 1].bottom, card.bottom, 'the last cell ends the card');

                        const autoHeight = cells
                            .filter((b) => b !== boxes.body)
                            .reduce((sum, b) => sum + b.height, 0);
                        near(boxes.body.height, card.height - autoHeight - (cells.length - 1) * seam,
                            'the body is the residual — `auto minmax(0,1fr) auto`, with 1fr in the middle');
                    }));

                test('the body is the scroll region, bounded by --ui-space-5 and scrolling inside it',
                    () => mounted(async (p) => {
                        await open(p);
                        assert.equal(await p.prop(BODY, 'overflow-y'), 'auto',
                            '§4.6: "body: overflow-y auto — MANDATORY". Only the numpad did this in the '
                            + 'old app and it was "the best-behaved overlay in the group"');

                        const space5 = parseFloat(await p.resolveValue('var(--ui-space-5)', 'width'));
                        const natural = await p.box(NATIVE);
                        assert.ok(natural.height <= geometry.height - 2 * space5 + 0.51,
                            `the cap is a maximum and it holds unforced: ${natural.height} > ${geometry.height - 2 * space5}`);

                        await p.setToken('--ui-space-5', '120px');
                        await p.settle(3);
                        const cap = geometry.height - 240;
                        const capped = await p.box(NATIVE);
                        const metrics = await p.metrics(BODY);
                        assert.ok(capped.height <= cap + 0.51,
                            `max-block-size must read the token: cap ${cap}, card ${capped.height}`);

                        if (metrics.scrollHeight > metrics.clientHeight + 0.5) {
                            near(capped.height, cap,
                                'a body that cannot fit takes the card to the cap and stops there — '
                                + '§4.6: bounded and scrollable is "the floor of the contract, not an option"');
                            const scrolled = await p.evalFn((s) => {
                                const el = window.__h.need(s);
                                el.scrollTop = 9999;
                                return el.scrollTop;
                            }, BODY);
                            assert.ok(scrolled > 0,
                                'and the overflow really scrolls: the time picker `overflow: visible`d at '
                                + 'max-height 96vh and the notes container was `overflow: hidden` with '
                                + 'nothing scrolling (§4.6)');
                        }

                        await p.setToken('--ui-space-5', null);
                    }));

                test('the inline size is min(intrinsic, 100% - 2 × --ui-space-6), and it stays centred',
                    () => mounted(async (p) => {
                        await open(p);
                        const space6 = parseFloat(await p.resolveValue('var(--ui-space-6)', 'width'));
                        const natural = await p.box(NATIVE);
                        assert.ok(natural.width <= geometry.width - 2 * space6 + 0.51,
                            'the intrinsic arm of the min() must already respect the window clamp');
                        near(natural.left, (geometry.width - natural.width) / 2, 'centred by `inset: 0; margin: auto`');

                        await p.setStyle(SHELL, { '--_ui-dialog-inline': '4000px' });
                        await p.settle(3);
                        const wide = await p.box(NATIVE);
                        near(wide.width, geometry.width - 2 * space6, 'the window clamp is 100% - 2 × --ui-space-6');
                        near(wide.left, space6, 'and it is still centred');
                        await p.setStyle(SHELL, { '--_ui-dialog-inline': null });
                    }));

                test('the scrim is the shell\'s own ::backdrop, drilled — one colour and one radius',
                    () => mounted(async (p) => {
                        await open(p);
                        const backdrop = await p.computed(NATIVE, ['background-color', 'backdrop-filter'], { pseudo: '::backdrop' });
                        assert.equal(backdrop['background-color'], await p.resolveValue('var(--ui-scrim)', 'background-color'),
                            'O6: "eight scrim colours, six blur radii" become one pair, and it is the token');
                        assert.equal(backdrop['backdrop-filter'], await p.resolveValue('blur(var(--ui-scrim-blur))', 'backdrop-filter'),
                            '§4.6: "With no canvas the ::backdrop works directly" — three sheets used to blur '
                            + '#scaled-content from the outside :1237)');

                        await assertTokenDrill(p, {
                            token: '--ui-scrim',
                            value: DRILL_COLOUR,
                            selector: NATIVE,
                            property: 'background-color',
                            pseudo: '::backdrop',
                        });
                        await assertTokenDrill(p, {
                            token: '--ui-scrim-blur',
                            value: DRILL_LENGTH,
                            selector: NATIVE,
                            property: 'backdrop-filter',
                            pseudo: '::backdrop',
                            expected: await p.resolveValue('blur(37px)', 'backdrop-filter'),
                        });
                    }));

                test('S7/S8/O7/O17: one coordinate space, no transformed ancestor, no z-index of its own',
                    () => mounted(async (p) => {
                        await open(p);

                        const inside = await p.box(CANCEL);
                        const outside = await p.box('#page-btn >>> #btn');
                        near(inside.height, outside.height,
                            'S7: the same control is the same height in both places. The old app measured '
                            + '1.5× — a scale is uniform, so one axis settles it, and the labels are not '
                            + 'the same on every body');

                        const chain = await p.evalFn((s) => {
                            const out = [];
                            let node = window.__h.need(s);
                            for (let i = 0; node && i < 100; i += 1) {
                                const cs = getComputedStyle(node);
                                if (cs.transform !== 'none' || cs.scale !== 'none' || cs.zoom !== '1') {
                                    out.push(`${window.__h.anchorPath(node)} { transform: ${cs.transform}; scale: ${cs.scale}; zoom: ${cs.zoom} }`);
                                }
                                const root = node.getRootNode();
                                node = node.parentElement ?? (root && root.host ? root.host : null);
                            }
                            return out;
                        }, NATIVE);
                        assert.deepEqual(chain, [],
                            'O7/O17 die with the canvas: nothing on the path from the card to <html> is scaled');

                        assert.equal(await p.prop(NATIVE, 'z-index'), 'auto',
                            'S8: a dead number on a top-layer box would read as load-bearing');
                    }));

                test('modality is real: the caret goes in, and a full Tab cycle never leaves',
                    () => mounted(async (p) => {
                        await open(p);
                        const first = await p.evalFn(
                            (s) => window.__h.anchorPath(window.__h.need(s).tabbables[0]),
                            SHELL,
                        );
                        assert.equal(await activePath(p), first, 'opening moves the caret to the first control');

                        const count = await p.evalFn((s) => window.__h.need(s).tabbables.length, SHELL);
                        assert.ok(count >= 2, `the instance must have controls to cycle through, has ${count}`);

                        const walk = [];
                        for (let i = 0; i < count + 1; i += 1) {
                            await p.press('Tab');
                            walk.push(await activePath(p));
                        }
                        for (const stop of walk) {
                            assert.match(stop, instance.inside,
                                `Tab left the dialog: ${stop}\n  The browser's own cycle wraps through `
                                + 'document.body — that is the step the trap removes (H9: "every control '
                                + 'behind them stays focusable")');
                        }
                        assert.equal(walk[count], walk[0], 'after one full cycle the caret is back where it started');

                        const claimants = await p.evalFn(() => window.__h.deepAll(document)
                            .filter((el) => el.getAttribute && el.getAttribute('aria-modal') === 'true')
                            .map((el) => window.__h.anchorPath(el)));
                        assert.equal(claimants.length, 1,
                            `O8/H9: one claim, on one box — got ${JSON.stringify(claimants)}`);
                        assert.match(claimants[0], /dialog#dialog$/,
                            'and it is the native <dialog> the platform makes modal, not a div');
                    }));

                test('modality is real: the page behind is dead to focus, and the MARK is what kills it',
                    () => mounted(async (p) => {
                        await open(p);
                        assert.equal(await p.evalFn(() => document.getElementById('outside').inert === true), true,
                            '§4.6 asks for `inert` on the page, by name');

                        const before = await activePath(p);
                        const after = await p.eval(`(() => {
                            document.getElementById('outside').focus();
                            return window.__h.anchorPath(window.__h.deepActiveElement());
                        })()`);
                        assert.equal(after, before, 'a focus() call on a background control must do nothing');

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
                            + '#outside, the dialog would not be modal and the top layer would not be covering '
                            + 'the page at all (which is the S8/O8 failure, not a passing falsification)');
                    }));

                test('modality is real: a real press behind the scrim runs no handler — the top layer owns the point',
                    () => mounted(async (p) => {
                        await open(p);

                        const atPoint = await p.eval(`(() => {
                            const r = document.getElementById('outside').getBoundingClientRect();
                            const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
                            return window.__h.anchorPath(el);
                        })()`);
                        assert.match(atPoint, instance.inside,
                            `the element at the background control's own coordinates must be the open dialog, `
                            + `not the control: got ${atPoint}`);

                        await p.click('#outside');
                        assert.deepEqual(await hits(p), [],
                            'a real hit-tested click behind the scrim must run no handler — and "behind" the '
                            + 'scrim on this machine includes Sleep and the shot controls (layout/overlays.md 9.7)');
                    }));

                test('modality is real: a press on the ::backdrop dismisses with reason `backdrop`, and hands the page back',
                    () => mounted(async (p) => {
                        await open(p);
                        await p.recordEvents(SHELL, ['close-request']);

                        const point = await pressBackdrop(p, NATIVE);

                        const events = await p.recordedEvents();
                        assert.deepEqual(events.map((e) => e.detail.reason), ['backdrop'],
                            `the press at (${point.x}, ${point.y}) must arrive as one close-request a consumer `
                            + 'could refuse (ui-dialog.js:744-755), not as a bare close');
                        assert.equal(await isOpen(p), false);
                        assert.equal(await p.evalFn(() => document.getElementById('outside').inert === true), false,
                            'a page left permanently inert is the failure mode this machinery has that a missing trap does not');
                        await p.click('#outside');
                        assert.deepEqual(await hits(p), ['outside'], 'and the control works again');
                    }));

                test('modality is real: Escape closes it, the document never sees the key, and the caret goes back to the invoker',
                    () => mounted(async (p) => {
                        await open(p);
                        assert.doesNotMatch(await activePath(p), /ui-button#invoker/, 'the caret starts inside');

                        await p.press('Escape');
                        await p.settle(3);
                        assert.equal(await isOpen(p), false, 'Escape closes every body, not just the ones that wired it');
                        assert.deepEqual(await escapesSeenByDocument(p), [],
                            'own the key before anything else acts on it');
                        assert.match(await activePath(p), /ui-button#invoker/,
                            '§4.6: "no focus restore" is the half of the modality gap a screenshot cannot see');

                        assert.equal(await p.evalFn(() => document.getElementById('outside').inert === true), false,
                            'the marks come off on the Escape path too, not only on the backdrop one');
                        await p.click('#outside');
                        assert.deepEqual(await hits(p), ['outside'], 'and the page is live again after an Escape close');
                    }));
            });
        }

        describe('nested dialogs', () => {

            const NESTED = `
<div id="page" style="padding: 40px">
  <ui-button id="invoker">Edit step</ui-button>
  <button id="outside" style="margin-inline-start: 24px">Outside</button>
  <ui-dialog id="outer" heading="Exit condition">
    <ui-icon-button id="outer-close" slot="header-trail" label="Close">✕</ui-icon-button>
    <div slot="body">
      <button id="outer-body">Outer body control</button>
      <ui-button id="open-inner">Dose in</ui-button>
      <ui-dialog id="inner" heading="Dose in">
        <div slot="body">
          <button id="inner-body">Inner first</button>
          <button id="inner-b2">Inner second</button>
        </div>
        <ui-button id="inner-cancel" slot="actions">Cancel</ui-button>
      </ui-dialog>
    </div>
    <ui-button id="outer-cancel" slot="actions">Cancel</ui-button>
  </ui-dialog>
</div>`;

            const NESTED_WIRE = `(() => {
                window.__hits = [];
                window.__esc = [];
                document.addEventListener('keydown', (e) => { if (e.key === 'Escape') window.__esc.push('document'); });
                const outer = document.getElementById('outer');
                const inner = document.getElementById('inner');
                const invoker = document.getElementById('invoker');
                const openInner = document.getElementById('open-inner');
                invoker.addEventListener('click', () => outer.show({ invoker, reason: 'press' }));
                openInner.addEventListener('click', () => inner.show({ invoker: openInner, reason: 'press' }));
                document.getElementById('outside').addEventListener('click', () => window.__hits.push('outside'));
                document.getElementById('outer-body').addEventListener('click', () => window.__hits.push('outer-body'));
                return true;
            })()`;

            const mounted = (fn) => browser.withPage({ geometry }, async (p) => {
                await p.mount(NESTED, BASE);
                await p.eval(NESTED_WIRE);
                assert.deepEqual(p.pageErrors, [], 'the nested fixture must mount without throwing');
                return fn(p);
            });

            /** Both levels, opened the way a finger does: two real presses. */
            const openBoth = async (p) => {
                await p.click('#invoker');
                await p.settle(3);
                await p.click('#open-inner');
                await p.settle(3);
                assert.deepEqual(await p.evalFn(() => ({
                    outer: document.getElementById('outer').open === true,
                    inner: document.getElementById('inner').open === true,
                })), { outer: true, inner: true }, 'the stage is two dialogs deep');
            };

            const marks = (p) => p.evalFn(() => ({
                outside: document.getElementById('outside').inert === true,
                outerBody: document.getElementById('outer-body').inert === true,
                outerCancel: document.getElementById('outer-cancel').inert === true,
                outerHead: document.getElementById('outer').shadowRoot.getElementById('head').inert === true,
                outerActions: document.getElementById('outer').shadowRoot.getElementById('actions').inert === true,
            }));

            const openState = (p) => p.evalFn(() => ({
                outer: document.getElementById('outer').open === true,
                inner: document.getElementById('inner').open === true,
            }));

            test('the outer isolates the page; the inner then isolates the outer', () => mounted(async (p) => {
                await p.click('#invoker');
                await p.settle(3);
                assert.deepEqual(await marks(p), {
                    outside: true, outerBody: false, outerCancel: false, outerHead: false, outerActions: false,
                }, 'one level: the page is inert and the dialog\'s own cells are not');

                await p.click('#open-inner');
                await p.settle(3);
                assert.deepEqual(await marks(p), {
                    outside: true, outerBody: true, outerCancel: true, outerHead: true, outerActions: true,
                }, 'two levels: the outer dialog is background now, its own header and footer included — '
                 + '#applyInert walks the FLAT tree, so it crosses the outer\'s shadow boundary (ui-dialog.js:977-988)');

                assert.match(await activePath(p), /ui-dialog#inner/, 'and the caret is in the inner');
            }));

            test('one Escape closes the INNER and the outer never sees the gesture', () => mounted(async (p) => {
                await openBoth(p);
                await p.press('Escape');
                await p.settle(3);
                assert.deepEqual(await openState(p), { outer: true, inner: false },
                    'Appendix 13: "a nested numpad closes by itself and the Exit dialog underneath never sees '
                    + 'that same physical gesture"');
                assert.deepEqual(await escapesSeenByDocument(p), [],
                    'and no document-level handler sees it either ');
            }));

            test('the second Escape belongs to the outer, and only then', () => mounted(async (p) => {
                await openBoth(p);
                await p.press('Escape');
                await p.settle(3);
                await p.press('Escape');
                await p.settle(3);
                assert.deepEqual(await openState(p), { outer: false, inner: false },
                    'the next press belongs to the one underneath — one gesture, one dialog, in order');
            }));

            test('the restore chain runs two levels deep, innermost first', () => mounted(async (p) => {
                await openBoth(p);
                await p.press('Escape');
                await p.settle(3);
                assert.match(await activePath(p), /ui-button#open-inner/,
                    'the inner hands the caret back to the control INSIDE the outer that opened it — '
                    + '#returnFocusTo is captured at show() (ui-dialog.js:707)');

                await p.press('Escape');
                await p.settle(3);
                assert.match(await activePath(p), /ui-button#invoker/,
                    'and the outer hands it back to the page. A chain that restored to the page at the '
                    + 'first Escape would leave the caret behind an open modal');
            }));

            test('while the inner is open the trap is the INNER\'s, both ways', () => mounted(async (p) => {
                await openBoth(p);
                const count = await p.evalFn(() => document.getElementById('inner').tabbables.length);
                assert.ok(count >= 3, `the inner must have controls to cycle through, has ${count}`);

                const forward = [];
                for (let i = 0; i < count + 1; i += 1) {
                    await p.press('Tab');
                    forward.push(await activePath(p));
                }
                for (const stop of forward) {
                    assert.match(stop, /ui-dialog#inner/,
                        `Tab reached the outer dialog: ${stop}\n  The outer's capture-phase keydown runs `
                        + 'FIRST on every press — its own tabbable list must have collapsed to the inner\'s, '
                        + 'because flatTabbables does not enter an inert subtree (focus-trap.js:159-177)');
                }
                assert.equal(forward[count], forward[0], 'one full cycle, inside the inner');

                const back = [];
                for (let i = 0; i < 3; i += 1) {
                    await p.press('Tab', { modifiers: 8 });
                    back.push(await activePath(p));
                }
                for (const stop of back) assert.match(stop, /ui-dialog#inner/, `Shift+Tab reached the outer: ${stop}`);
            }));

            test('the outer\'s tabbable list IS the inner\'s while nested — one list, not two competing traps',
                () => mounted(async (p) => {
                    await openBoth(p);
                    const lists = await p.evalFn(() => ({
                        outer: document.getElementById('outer').tabbables.map((el) => window.__h.anchorPath(el)),
                        inner: document.getElementById('inner').tabbables.map((el) => window.__h.anchorPath(el)),
                    }));
                    assert.deepEqual(lists.outer, lists.inner,
                        'both capture handlers fire on one Tab; they must agree on the cycle or the outer\'s '
                        + 'wrap would fight the inner\'s');
                    assert.ok(lists.inner.length >= 3, 'and the list is the inner\'s controls');
                }));

            test('closing the inner gives the outer back and leaves the PAGE inert — the release is layered',
                () => mounted(async (p) => {
                    await openBoth(p);
                    await p.press('Escape');
                    await p.settle(3);
                    assert.deepEqual(await marks(p), {
                        outside: true, outerBody: false, outerCancel: false, outerHead: false, outerActions: false,
                    }, '#releaseInert clears exactly what THIS dialog marked (ui-dialog.js:993-997), and the '
                     + 'inner never marked the page: #applyInert skips a sibling that is already inert (:969). '
                     + 'A global release here would hand the page back with a modal still open');

                    await p.click('#outside');
                    assert.deepEqual(await hits(p), [], 'so the page is still dead to a real press');

                    await p.press('Escape');
                    await p.settle(3);
                    assert.deepEqual(await marks(p), {
                        outside: false, outerBody: false, outerCancel: false, outerHead: false, outerActions: false,
                    }, 'and the last dialog out gives the page back');
                    await p.click('#outside');
                    assert.deepEqual(await hits(p), ['outside']);
                }));

            test('a real press on the outer\'s own control does nothing while the inner is open',
                () => mounted(async (p) => {
                    await openBoth(p);
                    await p.click('#outer-body');
                    await p.settle(2);
                    assert.deepEqual(await hits(p), [],
                        'the outer is background while the inner is up — the case a scrim alone cannot express');
                    assert.deepEqual(await openState(p), { outer: true, inner: true },
                        'and the press is not a backdrop dismissal of either dialog');
                }));

            test('a `cancel` delivered to the OUTER is refused while the inner is open', () => mounted(async (p) => {
                await openBoth(p);
                const result = await p.dispatch('#outer >>> #dialog', 'cancel', {});
                await p.settle(2);
                assert.equal(result.defaultPrevented, true,
                    'the UA never closes a dialog behind the component: close-request is the only door '
                    + '(ui-dialog.js:1060-1069)');
                assert.deepEqual(await openState(p), { outer: true, inner: true },
                    'the dialog underneath must not act on a gesture that belongs to the one on top');

                await p.dispatch('#inner >>> #dialog', 'cancel', {});
                await p.settle(2);
                assert.deepEqual(await openState(p), { outer: true, inner: false },
                    'and the same event at the top-most dialog does close it');
            }));
        });

        describe('P13 — a page of closed dialogs', () => {

            const ALL_MODULES = [
                ...BASE,
                '/src/components/ui-confirm-dialog.js',
                '/src/components/ui-sheet.js',
                '/src/components/ui-numeric-keypad.js',
                '/src/components/ui-time-picker.js',
                '/src/components/ui-notes-editor.js',
            ];

            const PAGE_CYCLE = [
                /button#p1$/,
                /ui-button#p2 ▸ button#btn$/,
                /input#p3$/,
                /^html ▸ body$/,
            ];

            const CLOSED = `
<div id="page" style="padding: 40px">
  <button id="p1">Page one</button>
  <ui-button id="p2">Page two</ui-button>
  <input id="p3" type="text" value="page three">

  <ui-dialog id="d1" heading="Edit step">
    <ui-icon-button id="d1-close" slot="header-trail" label="Close">✕</ui-icon-button>
    <div slot="body">
      <button id="d1-a">a</button><input id="d1-b" type="text"><ui-button id="d1-c">c</ui-button>
    </div>
    <ui-button id="d1-ok" slot="actions">OK</ui-button>
  </ui-dialog>

  <ui-confirm-dialog id="c" question="Restore factory profiles?"
    detail="Three profiles you have edited will be replaced."
    cancel-label="Keep mine" confirm-label="Restore"></ui-confirm-dialog>

  <ui-numeric-keypad id="np" heading="Dose in" limit-key="dose" unit="g" value="18"></ui-numeric-keypad>

  <ui-dialog id="d2" heading="Add schedule">
    <ui-sheet id="sheet" slot="body" fields="${SHEET_FIELDS}">
      <input class="child" slot="time" id="s-time" type="text" value="05:30">
      <input class="child" slot="awake" id="s-hours" type="text" value="1">
      <span class="unit" slot="awake">hr</span>
    </ui-sheet>
    <ui-button id="d2-save" slot="actions">Save</ui-button>
  </ui-dialog>

  <ui-dialog id="d3" heading="Set time">
    <ui-time-picker id="tp" slot="body" value="06:30"></ui-time-picker>
    <ui-button id="d3-save" slot="actions">Save</ui-button>
  </ui-dialog>

  <ui-dialog id="d4" heading="Notes">
    <ui-notes-editor id="nt" slot="body" label="Notes" value="Ethiopia Guji"></ui-notes-editor>
    <ui-button id="d4-save" slot="actions">Save</ui-button>
  </ui-dialog>
</div>`;

            const CENSUS = `(() => {
                function flatParent(el) {
                    if (el.assignedSlot) return el.assignedSlot;
                    if (el.parentElement) return el.parentElement;
                    var root = el.getRootNode();
                    return root && root.host ? root.host : null;
                }
                function closedOverlayAbove(el) {
                    var node = flatParent(el);
                    for (var i = 0; node && i < 200; i++) {
                        if (node.localName === 'dialog' && node.open === false) return node;
                        node = flatParent(node);
                    }
                    return null;
                }
                var all = window.__h.deepAll(document);
                var candidates = 0;
                var reachable = [];
                for (var i = 0; i < all.length; i++) {
                    var el = all[i];
                    if (el.disabled === true) continue;
                    var ti = typeof el.tabIndex === 'number' ? el.tabIndex : -1;
                    if (ti < 0) continue;
                    if (!closedOverlayAbove(el)) continue;
                    candidates++;
                    var visible = typeof el.checkVisibility === 'function'
                        ? el.checkVisibility({ checkVisibilityCSS: true, visibilityProperty: true })
                        : el.getClientRects().length > 0;
                    if (visible) reachable.push(window.__h.anchorPath(el));
                }
                return JSON.stringify({ candidates: candidates, reachable: reachable });
            })()`;

            const mounted = (fn) => browser.withPage({ geometry }, async (p) => {
                await p.mount(CLOSED, ALL_MODULES);
                await p.evalFn((t) => { document.getElementById('np').limits = t; return true; }, BENGLE_LIMITS);
                await p.settle(4);
                assert.deepEqual(p.pageErrors, [], 'six closed dialogs must mount without throwing');
                return fn(p);
            });

            test('every closed dialog is display: none and holds nothing tabbable', () => mounted(async (p) => {
                const state = await p.evalFn(() => {
                    const shells = {
                        d1: document.getElementById('d1'),
                        d2: document.getElementById('d2'),
                        d3: document.getElementById('d3'),
                        d4: document.getElementById('d4'),
                        confirm: document.getElementById('c').shadowRoot.getElementById('dialog'),
                        numpad: document.getElementById('np').shadowRoot.getElementById('dialog'),
                    };
                    const out = {};
                    for (const key of Object.keys(shells)) {
                        const shell = shells[key];
                        out[key] = {
                            open: shell.open === true,
                            display: getComputedStyle(shell.shadowRoot.getElementById('dialog')).display,
                            tabbables: shell.tabbables.length,
                        };
                    }
                    return out;
                });
                for (const [key, got] of Object.entries(state)) {
                    assert.deepEqual(got, { open: false, display: 'none', tabbables: 0 },
                        `${key}: P13 is an author `
                        + '`display: grid` written on the ELEMENT rather than the open STATE. #18 declares '
                        + 'the layout on `.dialog[open]` and lets the UA sheet keep the closed box out '
                        + '(ui-dialog.js:403-419, :449-452)');
                }
            }));

            test('nothing inside a closed dialog is reachable, and the page is at least as loaded as the old app\'s',
                () => mounted(async (p) => {
                    const census = JSON.parse(await p.eval(CENSUS));
                    assert.ok(census.candidates >= 16,
                        'the fixture must be at least as loaded as the measured page — 16 focusables inside '
                        + `dialog:not([open]) out of 30 (§7.7 P13) — and it holds ${census.candidates}`);
                    assert.deepEqual(census.reachable, [],
                        `P13: ${census.candidates} focusable elements live inside closed dialogs and NONE of `
                        + 'them is rendered. The old app reached 16 of them.');
                }));

            test('the whole document\'s tab order is the page\'s own three controls, and it closes on itself',
                () => mounted(async (p) => {
                    const walk = [];
                    for (let i = 0; i < 8; i += 1) {
                        await p.press('Tab');
                        walk.push(await activePath(p));
                    }
                    for (const stop of walk) {
                        assert.doesNotMatch(stop, /ui-dialog|ui-confirm-dialog|ui-numeric-keypad|ui-sheet|ui-time-picker|ui-notes-editor/,
                            `the tab order entered a closed dialog: ${stop}`);
                    }

                    walk.forEach((stop, i) => assert.match(stop, PAGE_CYCLE[i % PAGE_CYCLE.length],
                        `stop ${i + 1} of the document's tab order is not the ${(i % PAGE_CYCLE.length) + 1}th `
                        + `thing the page declares: ${stop}`));
                }));

            test('and Shift+Tab retraces the same three, backwards', () => mounted(async (p) => {
                const back = [];
                for (let i = 0; i < 5; i += 1) {
                    await p.press('Tab', { modifiers: 8 });
                    back.push(await activePath(p));
                }
                for (const stop of back) {
                    assert.doesNotMatch(stop, /ui-dialog|ui-confirm-dialog|ui-numeric-keypad|ui-sheet|ui-time-picker|ui-notes-editor/,
                        `the backward tab order entered a closed dialog: ${stop}`);
                }
            }));
        });
    });
}
