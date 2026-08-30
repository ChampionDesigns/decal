/**
 * dialog-body-integration.render.test.mjs — wave 5.2, item `dialog-body-integration`.
 *
 * "Every dialog body mounted inside #18 — the contract proven across the full set."
 *
 * WHY THIS FILE EXISTS, in the row's own words: "O6 is this phase's entire reason to
 * exist — the old app accumulated seven dialog implementations. Each body is the
 * CONTENT of a #18 instance, never its own modal machinery."
 *
 *   O6  "No modal component. Seven hand-rolled dialogs, four hand-rolled button
 *        implementations, three focus treatments, eight scrim colours, six blur radii,
 *        no z-index scale, no motion tokens, no menu/list-item/popover/toast
 *        component."   (LAYOUT_SPEC_DRAFT.md §7.7, `layout/overlays.md` §2.3, C5)
 *
 * WHAT IS PROVEN HERE AND NOWHERE ELSE. `ui-dialog.render.test.mjs` proves the shell
 * once, on its own fixtures. Each body's own suite proves the body. Neither proves the
 * COMPOSITION, and the composition is where seven implementations came from: a body
 * that needs one thing the shell does not give grows its own scrim, and then there are
 * two. So this suite mounts the five bodies that EXIST (SCOPE Part 4 Wave 4 'Dialog
 * bodies': #19 confirm, #20 sheet, #53 numpad, #54 time picker face, #55 notes editor
 * host) inside a real #18 and asks each of them the same eight questions, at both Gate
 * A geometries. The table is the point: one loop, five bodies, no per-body exemption.
 *
 * TWO COMPOSITION FAMILIES, and the table covers both because they fail differently:
 *   HOSTED   #19 and #53 own a <ui-dialog> in their own shadow root and slot a
 *            `<div slot="body">` into it (`ui-confirm-dialog.js:503-522`,
 *            `ui-numeric-keypad.js:857-884`). Their `show()/hide()/requestClose()`
 *            forward to #18 (`:365-385`, `:617-634`). The risk here is a second
 *            machinery growing INSIDE the wrapper.
 *   SLOTTED  #20, #54 and #55 are placed by the caller as `<x slot="body">` inside the
 *            screen's own <ui-dialog> (the shape their gallery entries use). The risk
 *            here is the shell's trap or its scroll region not reaching across the
 *            slot boundary into another shadow tree.
 *
 * THE TWO BODIES THAT WERE ABSENT LANDED IN WAVE 5.5, AS ROWS OF THIS TABLE. The
 * exit-condition dialog and the lever dialog are named in LAYOUT_SPEC_DRAFT.md §4.6
 * (line 685 "dialog (exit condition, lever)", :795-796) as bodies the ONE shell must
 * eventually cover, and neither was ever numbered by the 57-component inventory — which
 * is why neither is a COMPONENT: both are screen-level compositions in
 * `src/screens/editor-exit-dialog.js` and `src/screens/editor-lever-dialog.js`, each
 * hosting a #18 exactly as #19 and #53 do, and owning
 * no modality of their own. Per Part 10 §12's w5p2 row ("this phase INTEGRATES AND
 * PROVES — it does not construct") wave 5.2 deferred them to the phase that owns the
 * profile editor; wf-w5p5-editor is that phase. They are added HERE rather than in a
 * suite of their own, because a second suite is how a body grows a second contract.
 *
 * ENGINE TRUTH ONLY (CONVENTIONS §10). Every claim below is a computed style, a box, a
 * real CDP key press or a real hit-tested click. Nothing reads source text.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';
import { limitsFor } from '../../src/lib/machine-limits.js';
import { assertScrollFloor, pressBackdrop } from '../harness/assertions.js';

/* The port's own table, built the way a screen builds it — `limitsFor` is what the
 * capabilities store calls, so the ONE table is the one this file imported. #53 is the
 * only body that needs priming; the other four render from attributes alone. */
const BENGLE = limitsFor('bengle');

/**
 * The page every body is mounted on. Two things outside the dialog and both load
 * bearing: `#invoker` is what the caret must come back to, and `#outside` is the
 * background control `inert` has to refuse and then give back.
 */
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

/* =============================================================================
 * THE FIVE BODIES THAT EXIST
 *
 * `shell` is the path to the <ui-dialog> ELEMENT — the difference between the two
 * families and the only thing in the table that varies structurally. `content` is the
 * element that must land in #18's body cell. `bodyFocusables` says whether the body
 * itself contributes to the trap: #19's body is a question and a detail paragraph, so
 * it contributes none, and asserting otherwise would be asserting a fiction.
 * =========================================================================== */
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
        /* `guard-unsaved` is deliberately OFF. It is #55's documented use of #18's
         * cancellable `close-request` (`ui-notes-editor.js:925-948`) and it would make
         * Escape a no-op — the right behaviour for a dirty editor, and the wrong
         * fixture for proving that Escape reaches the shell at all. Its own suite owns
         * the guarded case. */
        markup: page(`
  <ui-dialog id="subject" heading="Notes">
    <ui-notes-editor slot="body" label="Notes"
                     value="Dialled in on the 14 g basket. Grind two clicks finer than the bag suggests, and the shot runs long by about three seconds on a cold group."></ui-notes-editor>
    <ui-button slot="actions">Cancel</ui-button>
    <ui-button slot="actions" variant="primary">Save</ui-button>
  </ui-dialog>`),
    },
    /* =====================================================================
     * WAVE 5.5's TWO. Both are HOSTED: each file renders a <ui-dialog> in its
     * own shadow root and forwards show/hide/requestClose to it, so the risk this table
     * watches for — a second machinery growing inside the wrapper — is the same risk,
     * asked the same way.
     *
     * BOTH MUST BE PRIMED, and for the same reason #53 must: the ONE ranges door (B2,
     * `src/lib/editor-ranges.js`) is the only route to a bound, and a dialog without it
     * renders its controls disabled with the door's own refusal on them. Priming here
     * builds the door the way a screen does — `r2MachineLimits()` behind the R2 door —
     * so this suite proves the contract on the armed body.
     * =================================================================== */
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

                /* =========================================================
                 * 1. O6 — ONE DIALOG IMPLEMENTATION, COUNTED
                 * ======================================================= */

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

                        /* §4.6 "Backdrop, not a canvas blur": three sheets blur
                         * #scaled-content from the outside today. Nothing in the
                         * composed tree may carry a filter of its own. */
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

                /* =========================================================
                 * 2. THE §4.6 CONTRACT BLOCK, MEASURED THROUGH THIS BODY
                 * ======================================================= */

                test('the contract block holds: bounded card, three tracks, the body the only 1fr',
                    () => mounted(async (p) => {
                        await open(p);
                        const space5 = parseFloat(await p.resolveValue('var(--ui-space-5)', 'width'));
                        const space6 = parseFloat(await p.resolveValue('var(--ui-space-6)', 'width'));
                        const seam = parseFloat(await p.resolveValue('var(--ui-seam)', 'width'));

                        const style = await p.computed(NATIVE, ['display', 'grid-template-rows']);
                        assert.equal(style.display, 'grid');

                        /* THE ROW COUNT IS THE CELL COUNT, and that is deliberate:
                         * "a confirm dialog with no header would otherwise keep an
                         * empty 0px track AND the seam gap above it, which draws a
                         * hairline against nothing at the top of the card"
                         * (ui-dialog.js:431-436, the three degenerate variants at
                         * :419/:438/:442). #19 supplies `label` rather than `heading`
                         * and so has two cells; asserting a flat three here would be
                         * asserting the bug the variants exist to avoid. */
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
                        /* The cells that exist, in grid order, each one seam below the
                         * last, the first flush with the top and the last with the
                         * bottom — the seam IS the divider (CONVENTIONS §13). */
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

                        /* Contained on three sides. NOT the fourth: a body taller than
                         * the cell is the scroll region doing its job, so a bottom
                         * check here would fail on exactly the case §4.6 made
                         * mandatory. What must never happen is content starting above
                         * the cell or reaching outside it inline — that is a box
                         * escaping the card, which is what a hand-rolled overlay does. */
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

                        /* Squeeze to "everything that does not surrender, plus 96px of
                         * body" so the assertion is never vacuous and never squeezes a
                         * body past its own --ui-control-h floor. */
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

                /* =========================================================
                 * 3. REAL MODALITY, PER BODY — H9/O8's four halves
                 * "Today every overlay claims aria-modal=true and none isolates
                 *  anything." Trap, restore, Escape, inert — once per body.
                 * ======================================================= */

                test('the trap holds: every tabbable is inside the card, and Tab wraps',
                    () => mounted(async (p) => {
                        await open(p);

                        const count = await p.evalFn((s) => window.__h.need(s).tabbables.length, body.shell);
                        assert.ok(count >= 2,
                            `the trap needs something to cycle through; ${body.id} offered ${count}`);

                        /* CONTAINMENT IS A TREE QUESTION, NOT A RECT ONE — measured,
                         * and the measurement is #55's. CodeMirror's real focusable is
                         * "a 3px-wide hidden textarea parked at the caret"
                         * (ui-notes-editor.js:549-553) and it parks OUTSIDE the card's
                         * rect while unfocused. It is nonetheless the editor's input
                         * and belongs in the trap, so the honest assertion is that
                         * every trapped control belongs to THIS <ui-dialog> — reached by
                         * walking parentElement and then hopping the shadow host, which
                         * is the same walk #18's own #applyInert() makes (:955-991) —
                         * and that none of them is on the page. The actions cluster
                         * lives in the dialog's LIGHT tree, so the host element, not
                         * the native <dialog> in its shadow, is the honest root. */
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

                /* SPLIT FROM ONE TEST — finding c-modality-2, the same defect as
                 * c-modality-1 and re-measured per body rather than inherited. The old
                 * test clicked `#outside`, pressed Escape and read `inert` back. The
                 * click could not fail (the ::backdrop covers the viewport, so the
                 * handler does not run whether or not the page is marked — measured
                 * with `inert` forced false on all five bodies at both geometries), and
                 * where it landed clear of the card it was itself the close: measured
                 * straight after the click, before any Escape, `{open: false, inert:
                 * false}` for all five bodies at bench and for #19 at the floor. In the
                 * other four floor cases the card covers the point and the click closed
                 * nothing — so one test proved two different things depending on the
                 * card's height. Each half now names its own cause. */

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

                        /* THE FALSIFICATION, RUN — and it does not falsify. Take the
                         * mark off and repeat the call: the caret still stays inside
                         * the card, for all five bodies at both geometries, because a
                         * native modal <dialog> already blocks the rest of the document
                         * on its own account. The component's walk and the platform's
                         * modal blocking cover `#outside` together, so neither can be
                         * measured by removing the other, and the walk's own falsifiable
                         * half is its RELEASE — asserted by the two close tests. */
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

                        /* Synchronously: read the caret in the same turn as hide(),
                         * before any microtask could put it back. Wave 3's cmodality-1. */
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
                            'numpad-modal.js:260-268 — the shell owns the key before anything else acts on it');

                        /* The ESCAPE path's own release. The old shape read this back
                         * after a click that had, on six of the ten body × geometry
                         * cases, already dismissed the dialog — so the backdrop path
                         * was measured twice and this one never (finding c-modality-2). */
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
