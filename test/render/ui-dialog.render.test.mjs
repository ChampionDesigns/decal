/**
 * ui-dialog.render.test.mjs — Wave 3 item #18's rendering suite.
 *
 * Gate A: headless Chrome over CDP, computed styles, box geometry and BEHAVIOUR,
 * never source text, at BOTH standard geometries — 1281×801 @ dsf 1.5 and the
 * 1000×600 floor (CONVENTIONS §10).
 *
 * WHAT THIS SUITE IS REALLY FOR. The row's subject is not a card with a shadow; it is
 * the claim §4.6 makes about every overlay in the old app — "Modality is real, or the
 * attribute comes off ... no inert, no aria-hidden, no focus trap, no focus restore"
 * (H9, O8). Every one of those is invisible to a screenshot: a dialog with a perfect
 * scrim and no trap photographs exactly like a dialog with one. So the four claims are
 * driven as INPUT and read as OUTCOME:
 *
 *   trap     — real CDP Tab and Shift+Tab presses, and where the caret lands after
 *              each one. The browser's own cycle wraps THROUGH document.body (measured
 *              in the wave-0 probe: five controls, six steps); the assertion is that
 *              every stop of a full cycle is inside the dialog.
 *   inert    — a real focus() call and a real hit-tested click on a background
 *              control, and whether either did anything. Then the same two again
 *              after closing, because a page left permanently inert is the failure
 *              mode this machinery has that a missing trap does not.
 *   restore  — press the invoker, press Escape, read where the caret is.
 *   Escape   — including two SIBLING dialogs, which is the case Slate's numpad could
 *              not defend (numpad-modal.js:252-268 owns the key on one propagation
 *              path; two siblings share none).
 *
 * The token half is drilled rather than compared: a scrim written as a literal and a
 * scrim reading --ui-scrim photograph identically, which is O6's whole shape ("eight
 * scrim colours, six blur radii, no z-index scale, no motion tokens").
 *
 * ALMOST EVERY STARTING VALUE IS A SOURCE READ, because the oracle has almost none:
 * `prov_query.py find --cls numpad-modal-overlay | slate-dialog | notes-modal-overlay |
 * slate-sheet-actions` returns 0 elements in 0 of 49 states — no captured state has an
 * overlay open — and ::backdrop is outside the probe's 18-property surface in any case
 * (styles/tokens.css:41). The exception is the numpad's CARD, which is captured, and
 * its three probed answers each back an assertion below: width 820px, border-top-left-
 * radius 12px, box-shadow rgba(0, 0, 0, 0.52) 0px 24px 70px 0px in dark. They are
 * quoted at those assertions and the full citations are in the component's header.
 * Colours and lengths are asserted against the resolved token, never against a hex, so
 * the suite is true in both themes.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';
import { entry as galleryEntry } from '../../tools/gallery/entries/ui-dialog.entry.js';
import {
    assertTokenDrill,
    assertFocusUnclipped,
    assertScrollFloor,
    DRILL_COLOUR,
    DRILL_LENGTH,
} from '../harness/assertions.js';

/* #16 is the header this row composes; #1 is what an actions cluster holds. */
const MODULE = [
    '/src/components/ui-dialog.js',
    '/src/components/ui-button.js',
    '/src/components/ui-icon-button.js',
];

/**
 * The default page. An invoker to press and to give the caret back to, a control
 * BEHIND the dialog inside a transformed z-index: 10000 pane (S8's exact shape), a
 * plain button outside for the inert measurements, and — for S7 — the same ui-button
 * markup twice, once on the page and once in the dialog's footer.
 */
const MARKUP = `
<div id="page" style="padding: 60px">
  <ui-button id="invoker">Set time</ui-button>
  <button id="outside" style="margin-inline-start: 24px">Outside</button>
  <ui-button id="page-btn">Confirm</ui-button>
  <div id="behind" style="position: fixed; inset-block-start: 30%; inset-inline-start: 30%; inline-size: 40%; block-size: 40%; transform: translateZ(0); z-index: 10000; display: grid; place-items: center">
    <button id="behind-btn">Behind</button>
  </div>
  <ui-dialog id="d" heading="Set time">
    <ui-icon-button id="close" slot="header-trail" label="Close">✕</ui-icon-button>
    <div slot="body" id="body-content">
      <p id="prose">Every overlay in the old app claims aria-modal and none isolates the page.</p>
      <button id="b1">First</button>
      <button id="b2">Second</button>
      <ui-button id="body-btn">Reset</ui-button>
    </div>
    <ui-button id="cancel" slot="actions">Cancel</ui-button>
    <ui-button id="dialog-btn" slot="actions" variant="primary">Confirm</ui-button>
  </ui-dialog>
</div>`;

/** A body that cannot fit: the scroll region §4.6 calls mandatory. */
const TALL = `
<div id="page" style="padding: 60px">
  <ui-button id="invoker">Open</ui-button>
  <ui-dialog id="d" heading="Notes">
    <div slot="body" id="body-content">
      <p id="prose" style="block-size: 2000px; margin: 0">tall</p>
      <button id="b1">Last</button>
    </div>
    <ui-button id="cancel" slot="actions">Close</ui-button>
  </ui-dialog>
</div>`;

/** Nothing but a body: no heading, no trail, no actions. One grid track. */
const MINIMAL = `
<div id="page" style="padding: 60px">
  <button id="invoker">Open</button>
  <ui-dialog id="d"><p slot="body" id="prose">Nothing to focus in here.</p></ui-dialog>
</div>`;

/** Two dialogs opened as SIBLINGS — Appendix 13's nested-Escape case, hard mode. */
const SIBLINGS = `
<div id="page" style="padding: 60px">
  <button id="invoker">Open</button>
  <ui-dialog id="outer" heading="Exit condition">
    <div slot="body"><button id="outer-btn">Outer</button></div>
  </ui-dialog>
  <ui-dialog id="inner" heading="Numpad">
    <div slot="body"><button id="inner-btn">Inner</button></div>
  </ui-dialog>
</div>`;

/**
 * A LIGHTER OVERLAY INSIDE THE DIALOG — finding cross-2's stage. A `ui-menu` in the
 * body is the ordinary shape of a profile dialog, and it is the case Appendix 13's
 * "the top-most overlay acts" was never asserted against: `OPEN_DIALOGS` cannot see a
 * menu, so one Escape used to close the dialog UNDERNEATH the open menu.
 */
const WITH_MENU = `
<div id="page" style="padding: 60px">
  <ui-button id="invoker">Open</ui-button>
  <ui-dialog id="d" heading="Profile">
    <div slot="body">
      <ui-menu id="m" label="Profile actions"
        items='[{"id":"dup","label":"Duplicate"},{"id":"del","label":"Delete"}]'>
        <ui-button id="trig" slot="trigger">Actions</ui-button>
      </ui-menu>
      <button id="b1">First</button>
    </div>
    <ui-button id="cancel" slot="actions">Cancel</ui-button>
  </ui-dialog>
</div>`;

/**
 * THE LIVE REGION AND THE MODAL — finding cross-1's stage. The toast region is a
 * body-level sibling, which is where an app puts one and exactly what `#applyInert`
 * walks over on its way to the document.
 */
const WITH_TOAST = `
<div id="page" style="padding: 60px">
  <ui-button id="invoker">Open</ui-button>
  <ui-dialog id="d" heading="Save profile">
    <div slot="body"><button id="b1">First</button></div>
  </ui-dialog>
</div>
<ui-toast id="t"></ui-toast>`;

/**
 * A dialog three levels down, one of them a shadow boundary — what a real screen
 * looks like. `probe-shell` is defined in the page before the mount because
 * `innerHTML` does not run scripts and the harness waits on `whenDefined` for every
 * hyphenated tag it finds (the trap `ui-menu.demo.js` documents).
 */
const SHELL_DEFINITION = `(() => {
    if (customElements.get('probe-shell')) return true;
    class ProbeShell extends HTMLElement {
        constructor() {
            super();
            const root = this.attachShadow({ mode: 'open' });
            root.innerHTML = '<button id="shell-sibling">Shell sibling</button>'
                + '<div id="shell-slot"><slot></slot></div>';
        }
    }
    customElements.define('probe-shell', ProbeShell);
    return true;
})()`;

const DEEP = `
<div id="page" style="padding: 60px">
  <button id="page-sibling">Page sibling</button>
  <probe-shell id="shell">
    <div id="wrap">
      <button id="wrap-sibling">Wrap sibling</button>
      <ui-dialog id="d" heading="Deep"><div slot="body"><button id="b1">Inside</button></div></ui-dialog>
    </div>
  </probe-shell>
</div>`;

/** Wires the page up the way a screen does. Kept out of the markup: see SHELL. */
const WIRE = `(() => {
    window.__hits = [];
    const dialog = document.getElementById('d');
    const invoker = document.getElementById('invoker');
    if (invoker && dialog) {
        invoker.addEventListener('click', () => dialog.show({ invoker, reason: 'press' }));
    }
    for (const id of ['outside', 'behind-btn', 'page-sibling', 'wrap-sibling']) {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', () => window.__hits.push(id));
    }
    return true;
})()`;

const DIALOG = '#d >>> #dialog';
const BODY = '#d >>> #body';
const HEAD = '#d >>> #head';
const ACTIONS = '#d >>> #actions';

/** Rendered lengths at dsf 1.5 are not string-comparable; whole CSS px are. */
const near = (got, want, what, tol = 0.51) => assert.ok(
    Math.abs(got - want) <= tol,
    `${what}: expected ${want}, got ${got}`,
);

/** Where the caret is, through every shadow root, as a readable path. */
const activePath = (page) => page.eval('window.__h.anchorPath(window.__h.deepActiveElement())');

const isOpen = (page, host = 'd') => page.evalFn((s) => window.__h.need(s).open === true, `#${host}`);

const hits = async (page) => JSON.parse(await page.eval('JSON.stringify(window.__hits)'));

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`ui-dialog @ ${geometry.name} (${geometry.width}×${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

        const mounted = (fn, markup = MARKUP, { define = null, modules = MODULE } = {}) => browser.withPage(
            { geometry },
            async (page) => {
                if (define) await page.eval(define);
                await page.mount(markup, modules);
                await page.eval(WIRE);
                assert.deepEqual(page.pageErrors, [], 'the component must mount without throwing');
                return fn(page);
            },
        );

        /** Open the way a finger does: a real CDP press on the invoker. */
        const openByPress = async (page) => {
            await page.click('#invoker');
            await page.settle(2);
            assert.equal(await isOpen(page), true, 'the press did not open the dialog');
        };

        /** Open the way the gallery does: the property. */
        const openByProperty = async (page, host = 'd') => {
            await page.evalFn((s) => { window.__h.need(s).open = true; return true; }, `#${host}`);
            await page.settle(3);
            assert.equal(await isOpen(page, host), true, 'the property did not open the dialog');
        };

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

        /* ================================================================
         * 1. CLOSED IS CLOSED — and P13's shape, one component over.
         *    "Closed dialogs stay in the tab order: DaisyUI's .modal sets
         *    display: grid; opacity: 0 with no visibility: hidden, defeating the
         *    UA's dialog:not([open]) { display: none }. Measured 16 focusables
         *    inside dialog:not([open]) out of 30 on the page."
         * ============================================================== */

        test('a closed dialog renders nothing, holds no focusables, and inerts nobody', () => mounted(async (page) => {
            assert.equal(await page.exists(DIALOG), true, 'the element is there');
            assert.equal(await page.prop(DIALOG, 'display'), 'none',
                'P13: a closed dialog that is not display: none keeps its controls in the tab order');
            assert.equal(await page.evalFn((s) => window.__h.need(s).tabbables.length, '#d'), 0,
                'nothing inside a closed dialog is reachable by Tab');
            assert.equal(await page.evalFn(() => document.getElementById('outside').inert === true), false,
                'nothing is inert while nothing is open');
        }));

        test('the host has no box of its own — a top-layer component must not move a layout', () => mounted(async (page) => {
            assert.equal(await page.prop('#d', 'display'), 'contents');
            const box = await page.box('#d');
            near(box.height, 0, 'a display: contents host contributes no box');
        }));

        /* ================================================================
         * 2. §4.6's SKELETON, line by line
         * ============================================================== */

        test('the open dialog is the three-row grid §4.6 specifies, with the body as the only 1fr', () => mounted(async (page) => {
            await openByPress(page);
            const style = await page.computed(DIALOG, [
                'display', 'grid-template-rows', 'gap', 'padding-top', 'border-radius',
            ]);
            assert.equal(style.display, 'grid');
            const tracks = style['grid-template-rows'].split(/\s+/).map(parseFloat);
            assert.equal(tracks.length, 3, `header/body/actions is three tracks, got ${style['grid-template-rows']}`);

            const dialog = await page.box(DIALOG);
            const head = await page.box(HEAD);
            const body = await page.box(BODY);
            const actions = await page.box(ACTIONS);
            const seam = parseFloat(await page.resolveValue('var(--ui-seam)', 'width'));

            near(head.top, dialog.top, 'the header is the first track');
            near(body.top, head.bottom + seam, 'one seam between header and body');
            near(actions.top, body.bottom + seam, 'one seam between body and actions');
            near(actions.bottom, dialog.bottom, 'the actions cluster is the last track');
        }));

        test('inline-size is min(intrinsic, 100% - 2 × --ui-space-6) and max-block-size is 100% - 2 × --ui-space-5', () => mounted(async (page) => {
            await openByPress(page);
            const space6 = parseFloat(await page.resolveValue('var(--ui-space-6)', 'width'));
            const box = await page.box(DIALOG);
            near(box.width, 820,
                'ORACLE modal-numpad .numpad-modal-container [i=166] rect w=820 (captured at 1920x1200), '
                + 'and SOURCE numpad-modal.css:13 min(820px, calc(100vw - 48px)) — the intrinsic width');

            // Clamped: ask for a dialog wider than the window and the min() must bind.
            await page.setStyle('#d', { '--_ui-dialog-inline': '4000px' });
            const wide = await page.box(DIALOG);
            near(wide.width, geometry.width - 2 * space6, 'the window clamp is 100% - 2 × --ui-space-6');
            near(wide.left, space6, 'and it stays centred');

            await page.setStyle('#d', { '--_ui-dialog-inline': null });
        }));

        test('a body that cannot fit caps the dialog at 100% - 2 × --ui-space-5 and scrolls inside it', () => mounted(async (page) => {
            await openByPress(page);
            const space5 = parseFloat(await page.resolveValue('var(--ui-space-5)', 'width'));
            const box = await page.box(DIALOG);
            near(box.height, geometry.height - 2 * space5, 'the block cap is 100% - 2 × --ui-space-5');
            near(box.top, space5, 'and the card is centred in what is left');

            const m = await page.metrics(BODY);
            assert.equal(m.overflowY, 'auto', '§4.6: overflow-y: auto is MANDATORY on the body');
            assert.ok(m.scrollHeight > m.clientHeight + 0.5, 'the body is the region that overflows');
            assert.ok(m.scrollbarInline > 0,
                'spec §2.4 bans hiding the scrollbar — a region the user cannot tell scrolls is the same defect later');
        }, TALL));

        test('the order of surrender is the body: header and footer keep their height while it absorbs', () => mounted(async (page) => {
            await openByPress(page);
            const headBefore = await page.box(HEAD);
            const actionsBefore = await page.box(ACTIONS);

            await assertScrollFloor(page, {
                selector: BODY,
                squeezeSelector: DIALOG,
                squeeze: { 'max-block-size': '320px' },
            });

            // …and the two auto tracks are still exactly as tall as they were.
            await page.setStyle(DIALOG, { 'max-block-size': '320px' });
            const headAfter = await page.box(HEAD);
            const actionsAfter = await page.box(ACTIONS);
            await page.setStyle(DIALOG, { 'max-block-size': null });

            near(headAfter.height, headBefore.height, 'the header does not surrender');
            near(actionsAfter.height, actionsBefore.height,
                'nor does the footer — the last thing to go is the way out of the dialog');
        }, TALL));

        test('the body floor is --ui-control-h, and it is read from the token', () => mounted(async (page) => {
            await openByPress(page);
            await assertTokenDrill(page, {
                token: '--ui-control-h',
                value: DRILL_LENGTH,
                selector: BODY,
                property: 'min-block-size',
            });
        }, TALL));

        /* ================================================================
         * 3. THE SCRIM — O6's eight colours and six radii, once
         * ============================================================== */

        test('the scrim is the real ::backdrop, painted from --ui-scrim and --ui-scrim-blur', () => mounted(async (page) => {
            await openByPress(page);
            const backdrop = await page.computed(DIALOG, ['background-color', 'backdrop-filter'], { pseudo: '::backdrop' });
            assert.equal(backdrop['background-color'], await page.resolveValue('var(--ui-scrim)', 'background-color'),
                'O6: eight scrim colours become one, and it is the token');
            assert.equal(backdrop['backdrop-filter'], await page.resolveValue('blur(var(--ui-scrim-blur))', 'backdrop-filter'),
                '§4.6: "With no canvas the ::backdrop works directly" — no #scaled-content blur');
        }));

        test('the scrim colour is drilled, because a literal and a token photograph identically', () => mounted(async (page) => {
            await openByPress(page);
            await assertTokenDrill(page, {
                token: '--ui-scrim',
                value: DRILL_COLOUR,
                selector: DIALOG,
                property: 'background-color',
                pseudo: '::backdrop',
            });
        }));

        test('the blur radius is drilled too — six radii in the old app, one here', () => mounted(async (page) => {
            await openByPress(page);
            await assertTokenDrill(page, {
                token: '--ui-scrim-blur',
                value: DRILL_LENGTH,
                selector: DIALOG,
                property: 'backdrop-filter',
                pseudo: '::backdrop',
                expected: await page.resolveValue('blur(37px)', 'backdrop-filter'),
            });
        }));

        test('the card reads --ui-elev-3, --ui-radius-xl and the seam ink from their families', () => mounted(async (page) => {
            await openByPress(page);
            const style = await page.computed(DIALOG, ['box-shadow', 'border-radius', 'background-color', 'row-gap']);
            assert.equal(style['box-shadow'], await page.resolveValue('var(--ui-elev-3)', 'box-shadow'),
                'ORACLE modal-numpad .numpad-modal-container [i=166] box-shadow = rgba(0, 0, 0, 0.52) '
                + '0px 24px 70px 0px (dark, FROZEN/hardcoded) — --ui-elev-3 to the byte, and now themable');
            assert.equal(style['border-radius'], await page.resolveValue('var(--ui-radius-xl)', 'border-radius'),
                'ORACLE same element, border-top-left-radius = 12px (token-driven) = --ui-radius-xl');
            assert.equal(style['background-color'], await page.resolveValue('var(--ui-line)', 'background-color'),
                'the grid ground is the seam ink; the cells paint over it');
            assert.equal(style['row-gap'], await page.resolveValue('var(--ui-seam)', 'row-gap'),
                'CONVENTIONS §13: a divider is a gap, not a border');
            assert.equal(await page.prop(HEAD, 'background-color'), await page.resolveValue('var(--ui-surface)', 'background-color'));
            assert.equal(await page.prop(BODY, 'background-color'), await page.resolveValue('var(--ui-surface)', 'background-color'));
        }));

        test('the seam is drilled: move --ui-seam and the hairline under the header moves with it', () => mounted(async (page) => {
            await openByPress(page);
            await assertTokenDrill(page, {
                token: '--ui-seam',
                value: '7px',
                read: async (p) => {
                    const head = await p.box(HEAD);
                    const body = await p.box(BODY);
                    return Math.round(body.top - head.bottom);
                },
                expected: 7,
            });
        }));

        test('the footer cluster is the shell\'s own three declarations, on --ui-space-4', () => mounted(async (page) => {
            await openByPress(page);
            const style = await page.computed(ACTIONS, ['display', 'justify-content', 'column-gap']);
            assert.equal(style.display, 'flex');
            assert.equal(style['justify-content'], 'flex-end',
                'SOURCE slate-shell.css:2227-2231 — O13\'s footer, under the name #16 left for it');
            assert.equal(style['column-gap'], await page.resolveValue('var(--ui-space-4)', 'column-gap'));
        }));

        /* ================================================================
         * 4. MOTION — the family that had no consumer
         * ============================================================== */

        test('the fade is --ui-dur × --ui-ease on the card and on the scrim', () => mounted(async (page) => {
            await openByPress(page);
            const card = await page.computed(DIALOG, ['transition-duration', 'transition-timing-function', 'transition-property']);
            assert.equal(card['transition-duration'], await page.resolveValue('var(--ui-dur)', 'transition-duration'));
            assert.equal(card['transition-timing-function'], await page.resolveValue('var(--ui-ease)', 'transition-timing-function'));
            assert.equal(card['transition-property'], 'opacity',
                'opacity only: a transform would move the box the trap assertions measure');
            const backdrop = await page.computed(DIALOG, ['transition-duration'], { pseudo: '::backdrop' });
            assert.equal(backdrop['transition-duration'], await page.resolveValue('var(--ui-dur)', 'transition-duration'));
        }));

        test('prefers-reduced-motion: reduce takes the duration to zero', () => mounted(async (page) => {
            await openByPress(page);
            await page.send('Emulation.setEmulatedMedia', {
                features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
            });
            await page.settle(1);
            assert.equal(await page.prop(DIALOG, 'transition-duration'), '0s',
                'CONVENTIONS §11: an animating component carries its own reduced-motion rule');
            await page.send('Emulation.setEmulatedMedia', { features: [] });
        }));

        /* ================================================================
         * 5. THE TRAP  (H9, O8)
         * ============================================================== */

        test('Tab cycles inside the dialog and never lands on the page — the measured body step is gone', () => mounted(async (page) => {
            await openByPress(page);
            const count = await page.evalFn((s) => window.__h.need(s).tabbables.length, '#d');
            assert.ok(count >= 4, `the fixture must have several controls to cycle through, has ${count}`);

            const walk = [];
            for (let i = 0; i < count + 1; i += 1) {
                await page.press('Tab');
                walk.push(await activePath(page));
            }
            for (const stop of walk) {
                assert.match(stop, /ui-dialog#d/,
                    `Tab left the dialog: ${stop}\n  The browser's own cycle wraps through document.body — that is the step this trap removes.`);
            }
            assert.equal(walk[count], walk[0],
                'after one full cycle the caret is back where it started');
        }));

        test('Shift+Tab reverses the same cycle, and wraps at the first control', () => mounted(async (page) => {
            await openByPress(page);
            const forward = [];
            for (let i = 0; i < 3; i += 1) { await page.press('Tab'); forward.push(await activePath(page)); }

            const back = [];
            for (let i = 0; i < 3; i += 1) { await page.press('Tab', { modifiers: 8 }); back.push(await activePath(page)); }

            assert.deepEqual(back.slice(0, 2), [forward[1], forward[0]],
                'Shift+Tab retraces the forward walk');
            for (const stop of back) assert.match(stop, /ui-dialog#d/, `Shift+Tab left the dialog: ${stop}`);

            // From the first control, backwards, the caret must wrap to the last.
            const count = await page.evalFn((s) => window.__h.need(s).tabbables.length, '#d');
            await page.evalFn((s) => { window.__h.need(s).tabbables[0].focus(); return true; }, '#d');
            await page.press('Tab', { modifiers: 8 });
            const last = await page.evalFn(
                (s) => window.__h.anchorPath(window.__h.need(s).tabbables[window.__h.need(s).tabbables.length - 1]),
                '#d',
            );
            assert.equal(await activePath(page), last, `wrapping backwards must reach control ${count} of ${count}`);
        }));

        test('the slotted body is IN the cycle — a DOM-tree trap would skip it entirely', () => mounted(async (page) => {
            await openByPress(page);
            const paths = await page.evalFn(
                (s) => window.__h.need(s).tabbables.map((el) => window.__h.anchorPath(el)),
                '#d',
            );
            assert.ok(paths.some((p) => /button#b1/.test(p)), `the body's controls are missing: ${paths.join(' | ')}`);
            assert.ok(paths.some((p) => /button#b2/.test(p)));
            assert.ok(paths.some((p) => /ui-icon-button#close/.test(p)), 'the header trail is in the cycle');
            assert.ok(paths.some((p) => /ui-button#cancel/.test(p)), 'so is the footer');
        }));

        test('a dialog with nothing to focus keeps the caret on the dialog box itself', () => mounted(async (page) => {
            await openByProperty(page);
            assert.equal(await page.evalFn((s) => window.__h.need(s).tabbables.length, '#d'), 0);
            await page.press('Tab');
            assert.match(await activePath(page), /dialog#dialog/,
                'with nothing inside to hold it, the caret must not step out of a modal dialog');
            await page.press('Tab', { modifiers: 8 });
            assert.match(await activePath(page), /dialog#dialog/);
        }, MINIMAL));

        test('opening moves the caret INTO the dialog, at the first control', () => mounted(async (page) => {
            await openByPress(page);
            const first = await page.evalFn((s) => window.__h.anchorPath(window.__h.need(s).tabbables[0]), '#d');
            assert.equal(await activePath(page), first);
        }));

        /* ================================================================
         * 6. INERT  (H9's "every control behind them stays focusable")
         * ============================================================== */

        test('the background is inert while the dialog is open: focus is refused and a real click does nothing', () => mounted(async (page) => {
            await openByPress(page);

            assert.equal(await page.evalFn(() => document.getElementById('outside').inert === true), true,
                'the row asks for inert on the page, by name');

            const before = await activePath(page);
            const after = await page.eval(`(() => {
                document.getElementById('outside').focus();
                return window.__h.anchorPath(window.__h.deepActiveElement());
            })()`);
            assert.equal(after, before, 'a focus() call on a background control must do nothing');

            await page.click('#outside');
            assert.deepEqual(await hits(page), [],
                'a real hit-tested click on a background control must run no handler — H9: '
                + '"every control behind them stays focusable"');
        }));

        test('closing gives the page back — the failure mode this machinery has that a missing trap does not', () => mounted(async (page) => {
            await openByPress(page);
            assert.equal(await page.evalFn(() => document.getElementById('outside').inert === true), true,
                'nothing is proven by releasing a mark that was never made');
            await page.press('Escape');
            await page.settle(2);

            assert.equal(await page.evalFn(() => document.getElementById('outside').inert === true), false,
                'a page left permanently inert is worse than a page that was never isolated');
            await page.click('#outside');
            assert.deepEqual(await hits(page), ['outside'], 'and the control works again');
        }));

        test('inert crosses shadow boundaries — a dialog three levels down isolates the app, not its div', () => mounted(async (page) => {
            await openByProperty(page);
            const marks = await page.evalFn(() => ({
                wrap: document.getElementById('wrap-sibling').inert === true,
                page: document.getElementById('page-sibling').inert === true,
                shell: document.getElementById('shell').shadowRoot.getElementById('shell-sibling').inert === true,
                shellHost: document.getElementById('shell').inert === true,
            }));
            assert.deepEqual(marks, { wrap: true, page: true, shell: true, shellHost: false },
                'every sibling on the composed path is marked; nothing ON the path is');

            await page.evalFn((s) => { window.__h.need(s).open = false; return true; }, '#d');
            await page.settle(2);
            const cleared = await page.evalFn(() => ({
                wrap: document.getElementById('wrap-sibling').inert === true,
                page: document.getElementById('page-sibling').inert === true,
                shell: document.getElementById('shell').shadowRoot.getElementById('shell-sibling').inert === true,
            }));
            assert.deepEqual(cleared, { wrap: false, page: false, shell: false },
                'exactly what was marked is un-marked');
        }, DEEP, { define: SHELL_DEFINITION }));

        test('a disconnected dialog releases the page — the gallery replaces its stage with innerHTML', () => mounted(async (page) => {
            await openByPress(page);
            assert.equal(await page.evalFn(() => document.getElementById('outside').inert === true), true);
            await page.eval(`(() => {
                const d = document.getElementById('d');
                d.parentNode.removeChild(d);
                return true;
            })()`);
            await page.settle(2);
            assert.equal(await page.evalFn(() => document.getElementById('outside').inert === true), false,
                'the marks are ours and must not outlive the component that made them');
        }));

        /* ================================================================
         * 7. FOCUS RESTORE
         * ============================================================== */

        test('closing puts the caret back on the invoker', () => mounted(async (page) => {
            await openByPress(page);
            assert.match(await activePath(page), /ui-dialog#d/);
            await page.press('Escape');
            await page.settle(2);
            assert.match(await activePath(page), /ui-button#invoker/,
                '§4.6: "no focus restore" is the half a screenshot cannot see');
        }));

        test('the restore is SYNCHRONOUS — a close handler that moves focus is the last writer', () => mounted(async (page) => {
            await openByPress(page);
            const seen = await page.eval(`(() => {
                const d = document.getElementById('d');
                d.hide('api');
                return window.__h.anchorPath(window.__h.deepActiveElement());
            })()`);
            assert.match(seen, /ui-button#invoker/,
                'wave 3\'s own cmodality-1: a restore left to updated() takes the caret back from the caller');

            await page.eval("(() => { document.getElementById('outside').focus(); return true; })()");
            await page.settle(3);
            assert.match(await activePath(page), /button#outside/,
                'and nothing steals it back a microtask later');
        }));

        test('an explicit invoker wins over whoever had the caret', () => mounted(async (page) => {
            await page.eval(`(() => {
                const d = document.getElementById('d');
                document.getElementById('b1');
                d.show({ invoker: document.getElementById('outside'), reason: 'api' });
                return true;
            })()`);
            await page.settle(3);
            await page.press('Escape');
            await page.settle(2);
            assert.match(await activePath(page), /button#outside/);
        }));

        test('a dialog opened declaratively still returns the caret to where it was', () => mounted(async (page) => {
            await page.eval("(() => { document.getElementById('outside').focus(); return true; })()");
            await openByProperty(page);
            assert.match(await activePath(page), /ui-dialog#d/, 'the caret went into the dialog');
            await page.press('Escape');
            await page.settle(2);
            assert.match(await activePath(page), /button#outside/,
                'without a captured target the caret would land on document.body — §4.6\'s defect by the other door');
        }));

        /* ================================================================
         * 8. ESCAPE  (Appendix 13 item 13)
         * ============================================================== */

        test('Escape closes, and says why', () => mounted(async (page) => {
            await openByPress(page);
            await page.recordEvents('#d', ['close-request', 'open-change']);
            await page.press('Escape');
            await page.settle(2);

            assert.equal(await isOpen(page), false);
            const events = await page.recordedEvents();
            assert.deepEqual(events.map((e) => e.type), ['close-request', 'open-change'],
                'exactly one of each: the UA cancel is prevented so there is one door');
            assert.equal(events[0].detail.reason, 'escape');
            assert.deepEqual(events[1].detail, { open: false, reason: 'escape' });
        }));

        test('preventDefault on close-request refuses the dismissal — the whole opt-out', () => mounted(async (page) => {
            await openByPress(page);
            await page.eval(`(() => {
                document.getElementById('d').addEventListener('close-request', (e) => e.preventDefault());
                return true;
            })()`);
            await page.press('Escape');
            await page.settle(2);
            assert.equal(await isOpen(page), true, 'a dialog with unsaved work keeps Escape from throwing it away');
            assert.match(await activePath(page), /ui-dialog#d/, 'and the caret stays inside');
        }));

        test('Escape is consumed: a document-level handler never sees the gesture', () => mounted(async (page) => {
            await page.eval(`(() => {
                window.__esc = [];
                document.addEventListener('keydown', (e) => { if (e.key === 'Escape') window.__esc.push('document'); });
                return true;
            })()`);
            await openByPress(page);
            await page.press('Escape');
            await page.settle(2);
            assert.deepEqual(JSON.parse(await page.eval('JSON.stringify(window.__esc)')), [],
                'numpad-modal.js:260-268 — own the key before anything else acts on it');
        }));

        test('one Escape closes ONE of two sibling dialogs, top-most first', () => mounted(async (page) => {
            await page.evalFn((s) => { window.__h.need(s).open = true; return true; }, '#outer');
            await page.settle(2);
            await page.evalFn((s) => { window.__h.need(s).open = true; return true; }, '#inner');
            await page.settle(2);
            assert.equal(await isOpen(page, 'outer'), true);
            assert.equal(await isOpen(page, 'inner'), true);

            await page.press('Escape');
            await page.settle(2);
            assert.equal(await isOpen(page, 'inner'), false, 'the top-most dialog took the key');
            assert.equal(await isOpen(page, 'outer'), true,
                'Appendix 13: "a nested numpad closes by itself and the Exit dialog underneath never sees that '
                + 'same physical gesture" — and two SIBLINGS share no propagation path at all');

            await page.press('Escape');
            await page.settle(2);
            assert.equal(await isOpen(page, 'outer'), false, 'the next Escape belongs to the one underneath');
        }, SIBLINGS));

        test('the duplicate `cancel` the stack exists for is refused by everyone but the top-most', () => mounted(async (page) => {
            // THE MECHANISM, DRIVEN DIRECTLY. numpad-modal.js:252-256: "Desktop Chrome
            // can synthesize a separate native cancel for every open top-layer dialog
            // from one Escape key." THIS Chrome does not — measured, by removing the
            // top-most guard and re-running the sibling test above, which still passed.
            // A guard that nothing in the rig can falsify is a guard that has silently
            // stopped covering its target (Gate C's named failure mode), so the
            // duplicate is dispatched by hand instead of waited for.
            await page.evalFn((s) => { window.__h.need(s).open = true; return true; }, '#outer');
            await page.settle(2);
            await page.evalFn((s) => { window.__h.need(s).open = true; return true; }, '#inner');
            await page.settle(2);

            const result = await page.dispatch('#outer >>> #dialog', 'cancel', {});
            await page.settle(2);
            assert.equal(result.defaultPrevented, true,
                'the UA never closes a dialog behind the component: close-request is the only door');
            assert.equal(await isOpen(page, 'outer'), true,
                'the dialog underneath must not act on a gesture that belongs to the one on top');
            assert.equal(await isOpen(page, 'inner'), true);

            // …and the same event at the top-most dialog does close it.
            await page.dispatch('#inner >>> #dialog', 'cancel', {});
            await page.settle(2);
            assert.equal(await isOpen(page, 'inner'), false);
            assert.equal(await isOpen(page, 'outer'), true);
        }, SIBLINGS));

        /* ================================================================
         * 8b. A NESTED OVERLAY OWNS ITS OWN ESCAPE  (finding cross-2)
         * ============================================================== */

        const MENU_MODULE = [...MODULE, '/src/components/ui-menu.js'];

        const openMenuInDialog = async (page) => {
            await page.evalFn(() => { window.__h.need('#d').open = true; return true; });
            await page.settle(3);
            await page.click('#trig');
            await page.settle(3);
            const state = await page.evalFn(() => ({
                dialog: document.getElementById('d').open === true,
                menu: document.getElementById('m').open === true,
            }));
            assert.deepEqual(state, { dialog: true, menu: true }, 'the stage is two overlays deep');
        };

        test('with a menu open inside it, Escape closes the MENU and leaves the dialog',
            () => mounted(async (page) => {
                await openMenuInDialog(page);
                await page.press('Escape');
                await page.settle(3);
                assert.deepEqual(await page.evalFn(() => ({
                    dialog: document.getElementById('d').open === true,
                    menu: document.getElementById('m').open === true,
                })), { dialog: true, menu: false },
                'Appendix 13: the TOP-MOST overlay acts, and OPEN_DIALOGS cannot see a menu. '
                + 'Closing the dialog underneath left a menu whose anchor was display: none — '
                + 'open by its own state, and unreachable by any press.');

                await page.press('Escape');
                await page.settle(3);
                assert.equal(await isOpen(page), false, 'and the next one belongs to the dialog');
            }, WITH_MENU, { modules: MENU_MODULE }));

        test('a menu open in the body does not survive the dialog closing by another door',
            () => mounted(async (page) => {
                await openMenuInDialog(page);
                await page.evalFn(() => { window.__h.need('#d').hide('api'); return true; });
                await page.settle(3);
                assert.deepEqual(await page.evalFn(() => ({
                    dialog: document.getElementById('d').open === true,
                    menu: document.getElementById('m').open === true,
                })), { dialog: false, menu: false },
                'a menu left open behind a closed dialog comes back with it, uninvited');
            }, WITH_MENU, { modules: MENU_MODULE }));

        test('and nothing changes for the dialog that has no nested overlay open',
            () => mounted(async (page) => {
                await page.evalFn(() => { window.__h.need('#d').open = true; return true; });
                await page.settle(3);
                await page.press('Escape');
                await page.settle(3);
                assert.equal(await isOpen(page), false,
                    'the stand-down is about the gesture\'s path, not about a menu existing');
            }, WITH_MENU, { modules: MENU_MODULE }));

        /* ================================================================
         * 8c. A RE-PARENTED DIALOG  (finding cmodality-2)
         * ============================================================== */

        test('a moved dialog is still open, still presented, and still traps',
            () => mounted(async (page) => {
                await openByPress(page);
                const moved = await page.eval(`(() => {
                    const d = document.getElementById('d');
                    const host = document.getElementById('page');
                    host.removeChild(d);
                    host.appendChild(d);
                    return true;
                })()`);
                assert.equal(moved, true);
                await page.settle(3);

                assert.deepEqual(await page.evalFn(() => {
                    const d = document.getElementById('d');
                    return {
                        property: d.open === true,
                        platform: d.dialog.open === true,
                        display: getComputedStyle(d.dialog).display !== 'none',
                    };
                }), { property: true, platform: true, display: true },
                'the property said open, the top layer said closed and nothing announced the difference: '
                + 'the app believed a dialog was on screen with nothing on screen');

                /* The listener that carries the trap is attached ONCE, in
                 * firstUpdated(), and removed on disconnect — so the caret used to walk
                 * out to document.body on the second Tab. */
                await page.click('#b1');
                const walk = [];
                for (let i = 0; i < 5; i += 1) {
                    await page.press('Tab');
                    await page.settle(1);
                    walk.push(await activePath(page));
                }
                assert.equal(walk.some((p) => /\bBODY\b|body$/.test(p)), false,
                    `the trap survived the move: ${JSON.stringify(walk)}`);
            }));

        test('and Escape still belongs to a moved dialog', () => mounted(async (page) => {
            await openByPress(page);
            await page.eval(`(() => {
                window.__esc = [];
                document.addEventListener('keydown', (e) => { if (e.key === 'Escape') window.__esc.push('document'); });
                const d = document.getElementById('d');
                const host = document.getElementById('page');
                host.removeChild(d);
                host.appendChild(d);
                return true;
            })()`);
            await page.settle(3);
            await page.press('Escape');
            await page.settle(3);
            assert.equal(await isOpen(page), false, 'the owned keydown came back with it');
            assert.deepEqual(JSON.parse(await page.eval('JSON.stringify(window.__esc)')), [],
                'including the stopPropagation half of Appendix 13\'s ownership');
        }));

        /* ================================================================
         * 8d. A LIVE REGION IS NOT BACKGROUND  (finding cross-1)
         * ============================================================== */

        const TOAST_MODULE = [...MODULE, '/src/components/ui-toast.js'];

        test('the toast region is not marked inert, and is in the top layer when a notice arrives',
            () => mounted(async (page) => {
                await openByPress(page);
                const raised = await page.evalFn(() => {
                    const box = (el) => { const r = el.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; };
                    const t = document.getElementById('t');
                    const n = t.show('Saved', { tone: 'ok', duration: 0 });
                    /* The A/B is the same region with the same notice in it, in the top
                     * layer and out of it — the only difference that can move a box. */
                    const promoted = [box(t), box(n)];
                    t.hidePopover();
                    t.removeAttribute('popover');
                    const plain = [box(t), box(n)];
                    t.setAttribute('popover', 'manual');
                    t.showPopover();
                    return {
                        inert: t.inert === true || t.hasAttribute('inert'),
                        topLayer: t.matches(':popover-open'),
                        promoted,
                        plain,
                        noticePainted: promoted[1][2] > 0 && promoted[1][3] > 0,
                    };
                });

                assert.equal(raised.inert, false,
                    'a status region is not background: #applyInert marks every sibling on the way to the '
                    + 'document, and this is the one kind it must not');
                assert.equal(raised.topLayer, true,
                    'a modal <dialog> and its ::backdrop are in the TOP LAYER, which --ui-z-toast (300) cannot '
                    + 'reach — the notice painted UNDER the scrim, so the one tone a modal save flow needs '
                    + 'arrived by no channel at all');
                assert.equal(raised.noticePainted, true);
                assert.deepEqual(raised.promoted, raised.plain,
                    'and the promotion moves nothing: the UA [popover] card styling — margin: auto, '
                    + 'fit-content sizing, a border, padding, an opaque background — is neutralised, not inherited');

                await page.press('Escape');
                await page.settle(3);
                assert.equal(await isOpen(page), false);
                assert.equal(await page.evalFn(() => document.getElementById('t').matches(':popover-open')), true,
                    'the region stays where it is; only the dialog came and went');
            }, WITH_TOAST, { modules: TOAST_MODULE }));

        test('a closed test: the region a screen anchors to a container is NOT promoted',
            () => mounted(async (page) => {
                const got = await page.evalFn(() => {
                    const t = document.getElementById('t');
                    t.setAttribute('anchor', 'container');
                    document.getElementById('page').appendChild(t);
                    t.show('Panel notice', { duration: 0 });
                    return { popover: t.getAttribute('popover'), position: getComputedStyle(t).position };
                });
                assert.equal(got.popover, null,
                    'a top-layer box takes the viewport as its containing block, which would move a '
                    + 'container-anchored region to the window corner and take the capture battery with it');
                assert.equal(got.position, 'absolute');
            }, WITH_TOAST, { modules: TOAST_MODULE }));

        test('a closed dialog announces nothing at mount; one that mounts open announces once', () => mounted(async (page) => {
            // Lit puts every property set before the first update into
            // changedProperties with an old value of undefined, so the naive
            // "announce whenever open changed" fires open: false for every dialog on
            // a screen the moment it mounts — before anything has happened.
            const seen = await page.eval(`(() => {
                window.__evts = [];
                document.addEventListener('open-change', (e) => window.__evts.push(e.detail));
                const closed = document.createElement('ui-dialog');
                closed.heading = 'Fresh';
                document.getElementById('page').appendChild(closed);
                return true;
            })()`);
            assert.equal(seen, true);
            await page.settle(3);
            assert.deepEqual(JSON.parse(await page.eval('JSON.stringify(window.__evts)')), [],
                'mounting a closed dialog is not an event');

            await page.eval(`(() => {
                const opened = document.createElement('ui-dialog');
                opened.heading = 'Already open';
                opened.open = true;
                document.getElementById('page').appendChild(opened);
                window.__opened = opened;
                return true;
            })()`);
            await page.settle(3);
            assert.deepEqual(JSON.parse(await page.eval('JSON.stringify(window.__evts)')), [{ open: true, reason: 'api' }],
                'a dialog that mounts already open IS an event, and announces exactly once');
            await page.eval('(() => { window.__opened.open = false; return true; })()');
            await page.settle(2);
        }));

        test('a close the component did not ask for is noticed — el.dialog.close() is public API', () => mounted(async (page) => {
            // `dialog` is exposed because wave 5.2 integrates real bodies into this
            // shell and a body may close the thing it sits in. Without the native
            // `close` listener the property would say open while the top layer says
            // closed, and the inert marks would never be released — the page would
            // stay dead with nothing on screen to explain it.
            await openByPress(page);
            await page.eval("(() => { document.getElementById('d').dialog.close(); return true; })()");
            await page.settle(3);
            assert.equal(await isOpen(page), false, 'the property follows the platform');
            assert.equal(await page.evalFn(() => document.getElementById('outside').inert === true), false,
                'and the page is released');
            assert.match(await activePath(page), /ui-button#invoker/, 'and the caret comes home');
        }));

        /* ================================================================
         * 9. BACKDROP DISMISSAL  (O8's "no backdrop dismiss")
         * ============================================================== */

        test('a press on the scrim closes the dialog', () => mounted(async (page) => {
            await openByPress(page);
            await page.recordEvents('#d', ['close-request']);
            const box = await page.box(DIALOG);
            const x = Math.max(4, box.left / 2);
            await page.mouse('mousePressed', x, 8, { clickCount: 1 });
            await page.mouse('mouseReleased', x, 8, { clickCount: 1 });
            await page.settle(2);
            assert.equal(await isOpen(page), false);
            const events = await page.recordedEvents();
            assert.equal(events[0].detail.reason, 'backdrop');
        }));

        test('a press on the seam between two cells does NOT close it', () => mounted(async (page) => {
            await openByPress(page);
            const box = await page.box(DIALOG);
            const head = await page.box(HEAD);
            // The 1px gap IS the dialog's own background showing through, so the click
            // targets the dialog element exactly as a backdrop click does. Only the
            // coordinates tell them apart.
            await page.dispatch(DIALOG, 'click', {
                clientX: box.left + 40,
                clientY: head.bottom + 0.5,
            });
            await page.settle(2);
            assert.equal(await isOpen(page), true,
                'target alone would make the hairline under the header a dismiss button');
        }));

        test('a press inside the body does not close it', () => mounted(async (page) => {
            await openByPress(page);
            await page.click('#b1');
            await page.settle(1);
            assert.equal(await isOpen(page), true);
        }));

        /* finding cmodality-1. Every backdrop test above presses and releases at ONE
         * point, so none of them could tell a dismissal from a DRAG that merely ended
         * outside — and a click whose two ends straddle the card edge is dispatched at
         * the dialog with the RELEASE's coordinates. An ordinary text selection, or a
         * flick in the scrolling body that runs past the end of a list, threw the
         * dialog and whatever was unsaved in it away. Both ends have to be outside. */
        test('a press that STARTS in the card and ends past its edge does not close it',
            () => mounted(async (page) => {
                await openByPress(page);
                const box = await page.box(DIALOG);
                const x = box.left + box.width / 2;
                await page.mouse('mousePressed', x, box.top + 60, { clickCount: 1 });
                await page.mouse('mouseMoved', x, box.bottom + 40);
                await page.mouse('mouseReleased', x, box.bottom + 40, { clickCount: 1 });
                await page.settle(2);
                assert.equal(await isOpen(page), true,
                    'a drag out of the body is not a dismissal, and the work inside is not the price of one');
            }));

        test('a press that starts on the scrim and ends in the card does not close it either',
            () => mounted(async (page) => {
                await openByPress(page);
                const box = await page.box(DIALOG);
                const x = Math.max(4, box.left / 2);
                await page.mouse('mousePressed', x, 8, { clickCount: 1 });
                await page.mouse('mouseMoved', box.left + box.width / 2, box.top + 60);
                await page.mouse('mouseReleased', box.left + box.width / 2, box.top + 60, { clickCount: 1 });
                await page.settle(2);
                assert.equal(await isOpen(page), true, 'the release point is inside the card');
            }));

        /* ================================================================
         * 10. THE STRUCTURAL DEFECTS: S7, S8, O6, O13
         * ============================================================== */

        test('S7: a button in the dialog is the same size as the same button on the page', () => mounted(async (page) => {
            await openByPress(page);
            const outside = await page.box('#page-btn');
            const inside = await page.box('#dialog-btn');
            near(inside.height, outside.height,
                'S7: "a 64px dialog button is 1.5× the 64px rail button beside it" — with no canvas there is one coordinate space');
            near(inside.width, outside.width, 'same markup, same box');
        }));

        test('S8: the top layer paints above a transformed z-index: 10000 pane', () => mounted(async (page) => {
            await openByPress(page);
            const box = await page.box(DIALOG);
            const at = await page.evalFn(
                (x, y) => window.__h.anchorPath(document.elementFromPoint(x, y)),
                box.left + box.width / 2,
                box.top + box.height / 2,
            );
            assert.match(at, /ui-dialog#d/,
                'S8: #scaled-content\'s transform sealed the notes modal\'s z-index: 10000 inside a stacking '
                + 'context and it painted BELOW a body child at 9999. The top layer is not on the z scale at all.');
            assert.doesNotMatch(at, /behind/);
        }));

        test('S8: and it declares no z-index of its own', () => mounted(async (page) => {
            await openByPress(page);
            assert.equal(await page.prop(DIALOG, 'z-index'), 'auto',
                'styles/tokens.css:455-462: "with no canvas and real top-layer <dialog>, nothing outside a '
                + 'dialog needs a z-index above --ui-z-sticky" — a number here would read as load-bearing and be ignored');
        }));

        test('O6: opening adds no element to the page — one machinery, no injected scrim div', () => mounted(async (page) => {
            const before = await page.evalFn(() => document.querySelectorAll('*').length);
            await openByPress(page);
            const after = await page.evalFn(() => document.querySelectorAll('*').length);
            assert.equal(after, before,
                'seven hand-rolled dialogs each brought their own overlay node; the top layer needs none');
        }));

        test('O13/#16: the header IS the sheet header, and the trail cluster is assigned into it', () => mounted(async (page) => {
            await openByPress(page);
            assert.equal(await page.exists('#d >>> ui-sheet-header'), true, 'the row composes #16');
            assert.equal(await page.evalFn((s) => window.__h.need(s).heading, '#d >>> ui-sheet-header'), 'Set time');
            const assigned = await page.evalFn(() => {
                const close = document.getElementById('close');
                const slot = close.assignedSlot;
                return { name: slot ? slot.name : null, forwarded: slot ? slot.getAttribute('slot') : null };
            });
            assert.deepEqual(assigned, { name: 'header-trail', forwarded: 'trail' },
                'the way out rides in #16\'s trail cluster; `actions` is the FOOTER (O13\'s two jobs, two names)');
        }));

        test('the accessible name is the heading, on a dialog that says it is modal', () => mounted(async (page) => {
            await openByPress(page);
            const aria = await page.evalFn((s) => {
                const el = window.__h.need(s);
                return { modal: el.getAttribute('aria-modal'), label: el.getAttribute('aria-label') };
            }, DIALOG);
            assert.deepEqual(aria, { modal: 'true', label: 'Set time' },
                '§4.6: "Modality is real, or the attribute comes off." Every test above is what earns it.');
        }));

        /* ================================================================
         * 11. THE ABSENT CELLS, AND THE CONTAINER QUERY
         * ============================================================== */

        test('with no header and no actions there is ONE track and no hairline against nothing', () => mounted(async (page) => {
            await openByProperty(page);
            const tracks = (await page.prop(DIALOG, 'grid-template-rows')).split(/\s+/);
            assert.equal(tracks.length, 1, 'an empty 0px track would still draw its seam gap');
            const dialog = await page.box(DIALOG);
            const body = await page.box(BODY);
            near(body.height, dialog.height, 'the body is the whole card');
            assert.equal(await page.prop(HEAD, 'display'), 'none', 'an empty cell is not a grid item');
            assert.equal(await page.prop(ACTIONS, 'display'), 'none');
        }, MINIMAL));

        test('the cell inset is --ui-space-5, and drops to --ui-space-4 under the 720px container', () => mounted(async (page) => {
            await openByPress(page);
            const wide = await page.prop(BODY, 'padding-top');
            assert.equal(wide, await page.resolveValue('var(--ui-space-5)', 'padding-top'),
                'SOURCE numpad-modal.css:61 padding: 24px');

            await page.setStyle('#d', { '--_ui-dialog-inline': '600px' });
            assert.equal(await page.prop(BODY, 'padding-top'), await page.resolveValue('var(--ui-space-4)', 'padding-top'),
                'SOURCE numpad-modal.css:416 — the shell\'s share of the one breakpoint §4.6 keeps, as a CONTAINER query');

            await page.setStyle('#d', { '--_ui-dialog-inline': null });
            assert.equal(await page.prop(BODY, 'padding-top'), wide, 'and back');
        }));

        /* ================================================================
         * 12. THE RING, UNCLIPPED  (bug L24's class)
         * ============================================================== */

        test('a control inside the scrolling body draws an unclipped ring', () => mounted(async (page) => {
            await openByPress(page);
            // A COMPONENT control, not the plain <button> beside it: the base's one
            // ring lives inside each component's shadow root, so a bare light-DOM
            // button in a slotted body wears the UA's 1px default and there is no
            // token ring to assert on. That is a property of the architecture, not of
            // this dialog — CONVENTIONS §3a — and it is why every real body slots
            // components rather than raw controls.
            await assertFocusUnclipped(page, '#body-btn >>> #btn');
        }));

        test('a control in the footer draws an unclipped ring', () => mounted(async (page) => {
            await openByPress(page);
            await assertFocusUnclipped(page, '#cancel >>> #btn');
        }));

        /* ================================================================
         * 13. THE GALLERY'S OWN STATES, in a real browser
         * ============================================================== */

        test('every gallery state mounts, opens and has something to photograph', () => browser.withPage({ geometry }, async (page) => {
            for (const state of galleryEntry.states) {
                await page.mount(state.html, MODULE);
                await page.settle(3);
                assert.deepEqual(page.pageErrors, [], `state ${state.id} threw on mount`);
                const box = await page.box('ui-dialog >>> #dialog');
                assert.ok(box.width > 100 && box.height > 60,
                    `state ${state.id} photographs as ${box.width}×${box.height}`);
                assert.equal(await page.prop('ui-dialog >>> #dialog', 'display'), 'grid',
                    `state ${state.id} is not open — the battery would photograph an empty stage`);
            }
        }));
    });
}
