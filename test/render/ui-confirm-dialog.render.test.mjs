/**
 *.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';
import { entry as galleryEntry } from '../../tools/gallery/entries/ui-confirm-dialog.entry.js';
import {
    assertTokenDrill,
    assertFocusUnclipped,
    assertScrollFloor,
    DRILL_COLOUR,
    DRILL_LENGTH,
} from '../harness/assertions.js';

const MODULE = [
    '/src/components/ui-confirm-dialog.js',
    '/src/components/ui-button.js',
];

/** The default page: an invoker to press and to give the caret back to. */
const MARKUP = `
<div id="page" style="padding: 60px">
  <ui-button id="invoker">Reset</ui-button>
  <button id="outside" style="margin-inline-start: 24px">Outside</button>
  <ui-confirm-dialog
    id="c"
    tone="destructive"
    question="Reset profile?"
    detail="Extractamundo Dos! goes back to the version that shipped with the machine."
    cancel-label="KEEP"
    confirm-label="Reset"></ui-confirm-dialog>
</div>`;

/** The affirmative half of the pair — P8's mirror. */
const AFFIRMATIVE = `
<div id="page" style="padding: 60px">
  <ui-button id="invoker">Send</ui-button>
  <ui-confirm-dialog
    id="c"
    question="Send this profile to the machine?"
    detail="It replaces whatever is loaded now."
    confirm-label="Send"></ui-confirm-dialog>
</div>`;

const FOUR_CLOSED = `
<div id="page" style="padding: 60px">
  <button id="page-a">Filter</button>
  <button id="page-b">Edit</button>
  <ui-confirm-dialog id="reset" tone="destructive" question="Reset profile?"
    cancel-label="KEEP" confirm-label="Reset"></ui-confirm-dialog>
  <ui-confirm-dialog id="add" question="Add this profile?" confirm-label="Add"></ui-confirm-dialog>
  <ui-confirm-dialog id="share" question="Import from Visualizer?" confirm-label="Import"></ui-confirm-dialog>
  <ui-confirm-dialog id="login" question="Log in to continue?" confirm-label="Log in"></ui-confirm-dialog>
</div>`;

const TALL = `
<div id="page" style="padding: 60px">
  <ui-button id="invoker">Restore</ui-button>
  <ui-confirm-dialog
    id="c"
    tone="destructive"
    question="Restore factory profiles?"
    detail="Three profiles you have edited will be replaced."
    cancel-label="Keep mine"
    confirm-label="Restore">
    <p id="slotted" style="block-size: 1400px; margin: 0">itemised</p>
  </ui-confirm-dialog>
</div>`;

/** Wires the invoker the way a screen does. */
const WIRE = `(() => {
    window.__outcomes = [];
    const confirm = document.getElementById('c');
    const invoker = document.getElementById('invoker');
    if (invoker && confirm) {
        invoker.addEventListener('click', () => confirm.show({ invoker, reason: 'press' }));
    }
    if (confirm) {
        confirm.addEventListener('confirm', (e) => window.__outcomes.push('confirm:' + e.detail.reason));
        confirm.addEventListener('cancel', (e) => window.__outcomes.push('cancel:' + e.detail.reason));
    }
    return true;
})()`;

/** Refuse the confirm so the dialog must stay open — the async-action idiom. */
const REFUSE_CONFIRM = `(() => {
    document.getElementById('c').addEventListener('confirm', (e) => e.preventDefault());
    return true;
})()`;

const SHELL = '#c >>> #dialog';                 /* the ui-dialog element  */
const NATIVE = '#c >>> #dialog >>> #dialog';    /* the platform <dialog>  */
const CELL_HEAD = '#c >>> #dialog >>> #head';
const CELL_BODY = '#c >>> #dialog >>> #body';
const CELL_ACTIONS = '#c >>> #dialog >>> #actions';
const BODY = '#c >>> #body';                    /* the compound's own stack */
const QUESTION = '#c >>> #question';
const DETAIL = '#c >>> #detail';
const CANCEL = '#c >>> #cancel >>> #btn';
const CONFIRM = '#c >>> #confirm >>> #btn';

/** Rendered lengths at dsf 1.5 are not string-comparable; whole CSS px are. */
const near = (got, want, what, tol = 0.51) => assert.ok(
    Math.abs(got - want) <= tol,
    `${what}: expected ${want}, got ${got}`,
);

const outcomes = async (page) => JSON.parse(await page.eval('JSON.stringify(window.__outcomes)'));

const isOpen = (page, host = 'c') => page.evalFn((s) => window.__h.need(s).open === true, `#${host}`);

/** Where the caret is, through every shadow root, as a readable path. */
const activePath = (page) => page.eval('window.__h.anchorPath(window.__h.deepActiveElement())');

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`ui-confirm-dialog @ ${geometry.name} (${geometry.width}×${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

        const mounted = (fn, markup = MARKUP, { wire = WIRE } = {}) => browser.withPage(
            { geometry },
            async (page) => {
                await page.mount(markup, MODULE);
                if (wire) await page.eval(wire);
                assert.deepEqual(page.pageErrors, [], 'the component must mount without throwing');
                return fn(page);
            },
        );

        /** Open the way a finger does: a real CDP press on the invoker. */
        const openByPress = async (page) => {
            await page.click('#invoker');
            await page.settle(3);
            assert.equal(await isOpen(page), true, 'the press did not open the confirm');
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

        test('P13: the selector\'s four confirms, closed, hold ZERO focusables', () => mounted(async (page) => {
            const counted = await page.evalFn(() => {
                let tabbables = 0;
                let laidOut = 0;
                const hosts = document.querySelectorAll('ui-confirm-dialog');
                for (const host of hosts) {
                    const shell = host.dialog;
                    tabbables += shell ? shell.tabbables.length : -1;
                    for (const id of ['cancel', 'confirm']) {
                        const el = host.renderRoot.querySelector('#' + id);
                        const r = el.getBoundingClientRect();
                        if (r.width > 0 || r.height > 0) laidOut += 1;
                    }
                }
                return { dialogs: hosts.length, tabbables, laidOut };
            });

            assert.equal(counted.dialogs, 4, 'the fixture must mount the selector\'s four');
            assert.equal(
                counted.tabbables, 0,
                'P13: "Measured 16 focusables inside dialog:not([open]) out of 30 on the page". '
                + 'Four confirms carry eight controls between them and NOT ONE of them is reachable.',
            );
            assert.equal(
                counted.laidOut, 0,
                'P13\'s other half: ORACLE profile-selector .modal-box [i=191] rect 450x205 — a CLOSED '
                + 'card that lays itself out. Every control here is a 0x0 box inside a display: none dialog.',
            );

            // …and the count is not vacuous: the page's own controls ARE reachable.
            const pageControls = await page.evalFn(() => {
                const reachable = (el) => el.getBoundingClientRect().width > 0 && el.inert !== true;
                return ['page-a', 'page-b'].filter((id) => reachable(document.getElementById(id))).length;
            });
            assert.equal(pageControls, 2, 'nothing is inert while nothing is open');
        }, FOUR_CLOSED, { wire: null }));

        test('P13: the closed dialog is display: none, which is the UA rule nothing here contradicts', () => mounted(async (page) => {
            assert.equal(await page.exists(NATIVE), true, 'the element is there');
            assert.equal(
                await page.prop(NATIVE, 'display'), 'none',
                'DaisyUI wrote `display: grid; opacity: 0` on the ELEMENT, which beats the UA sheet '
                + 'whatever its specificity. This component declares no display for the box at all.',
            );
            assert.equal(await page.prop('#c', 'display'), 'contents',
                'and the host contributes no box either — a confirm is written where the screen is written');
        }));

        test('P13: an open-then-closed confirm goes back to zero, which is where the half-states hide', () => mounted(async (page) => {
            await openByPress(page);
            assert.ok(
                await page.evalFn((s) => window.__h.need(s).tabbables.length > 0, SHELL),
                'the open confirm must actually hold controls, or the next assertion is vacuous',
            );
            await page.press('Escape');
            await page.settle(3);

            assert.equal(await isOpen(page), false, 'Escape must close it');
            assert.equal(await page.evalFn((s) => window.__h.need(s).tabbables.length, SHELL), 0);
            assert.equal(await page.prop(NATIVE, 'display'), 'none');
            assert.equal(
                await page.evalFn(() => document.getElementById('outside').inert === true), false,
                'a page left permanently inert is the failure mode this machinery has that P13 does not',
            );
        }));

        test('the card is TWO tracks and one seam: body, then actions', () => mounted(async (page) => {
            await openByPress(page);
            const tracks = (await page.prop(NATIVE, 'grid-template-rows')).split(/\s+/);
            assert.equal(
                tracks.length, 2,
                'ui-dialog.js:433-436: "a confirm dialog with no header would otherwise keep an empty '
                + '0px track AND the seam gap above it, which draws a hairline against nothing"',
            );
            assert.equal(await page.prop(CELL_HEAD, 'display'), 'none', 'an empty cell is not a grid item');

            const card = await page.box(NATIVE);
            const body = await page.box(CELL_BODY);
            const actions = await page.box(CELL_ACTIONS);
            const seam = parseFloat(await page.resolveValue('var(--ui-seam)', 'width'));

            near(body.top, card.top, 'the body is the first track');
            near(actions.top, body.bottom + seam, 'one seam between body and actions');
            near(actions.bottom, card.bottom, 'the actions cluster is the last track');
        }));

        test('the question is the first thing in the body, and it is a real heading', () => mounted(async (page) => {
            await openByPress(page);
            const shape = await page.evalFn(() => {
                const host = document.getElementById('c');
                const body = host.renderRoot.querySelector('#body');
                const first = body.firstElementChild;
                return { tag: first.tagName, id: first.id, text: first.textContent.trim() };
            });
            assert.deepEqual(shape, { tag: 'H2', id: 'question', text: 'Reset profile?' },
                'TYPE_ROLES.md rule 2: "A heading is structure, and a screen reader reads <h2>"');
        }));

        test('the pair is authored cancel-first, which is the reading order Slate has too', () => mounted(async (page) => {
            await openByPress(page);
            const cancel = await page.box('#c >>> #cancel');
            const confirm = await page.box('#c >>> #confirm');
            assert.ok(cancel.left < confirm.left,
                'ORACLE #reset-profile-cancel x=937 before #reset-profile-confirm x=1052');
            near(cancel.bottom, confirm.bottom, 'and they share a line at this width');
        }));

        test('the question is --ui-text-xl, not the literal 28px Slate wrote', () => mounted(async (page) => {
            await openByPress(page);
            assert.equal(
                await page.prop(QUESTION, 'font-size'),
                await page.resolveValue('var(--ui-text-xl)', 'font-size'),
                'ORACLE profile-selector .font-bold [i=192] font-size = 28px <- app.css `.text-\\[28px\\]` '
                + 'authored `28px` !important=no (FROZEN/hardcoded)',
            );
            await assertTokenDrill(page, {
                token: '--ui-text-xl',
                value: DRILL_LENGTH,
                selector: QUESTION,
                property: 'font-size',
            });
        }));

        test('the question\'s ink is --ui-text, which is the one answer Slate already had right', () => mounted(async (page) => {
            await openByPress(page);
            assert.equal(
                await page.prop(QUESTION, 'color'),
                await page.resolveValue('var(--ui-text)', 'color'),
                'ORACLE profile-selector .font-bold [i=192] color = rgb(244, 247, 248) <- slate-shell.css '
                + '`#subpage-host .modal-box :is(h2, h3)` authored `var(--slate-text)` (token-driven)',
            );
            await assertTokenDrill(page, {
                token: '--ui-text',
                value: DRILL_COLOUR,
                selector: QUESTION,
                property: 'color',
            });
        }));

        test('the body stack gap is --ui-space-4, read from the token', () => mounted(async (page) => {
            await openByPress(page);
            await assertTokenDrill(page, {
                token: '--ui-space-4',
                value: DRILL_LENGTH,
                selector: BODY,
                property: 'row-gap',
            });
        }));

        test('the detail line caps at --ui-measure, so a widened card does not give a 900px line', () => mounted(async (page) => {
            await openByPress(page);
            await page.setStyle('#c', { '--_ui-confirm-inline': '900px' });
            await page.settle(2);
            await assertTokenDrill(page, {
                token: '--ui-measure',
                value: '120px',
                selector: DETAIL,
                property: 'max-inline-size',
            });
            await page.setStyle('#c', { '--_ui-confirm-inline': null });
        }));

        test('the destructive action reads --ui-status-danger, never a raw red', () => mounted(async (page) => {
            await openByPress(page);
            assert.equal(
                await page.prop(CONFIRM, 'color'),
                await page.resolveValue('var(--ui-status-danger)', 'color'),
                'ORACLE profile-selector #reset-profile-confirm [i=194] background-color = rgb(248, 113, 113) '
                + '<- app.css `.bg-red-400` authored `rgb(248 113 113/var(--tw-bg-opacity,1))` '
                + '(FROZEN/hardcoded) — a raw Tailwind literal in a skin that already had --slate-danger',
            );
            await assertTokenDrill(page, {
                token: '--ui-status-danger',
                value: DRILL_COLOUR,
                selector: CONFIRM,
                property: 'color',
            });
        }));

        test('the destructive fill moves with the same token, through the mix', () => mounted(async (page) => {
            await openByPress(page);
            await assertTokenDrill(page, {
                token: '--ui-status-danger',
                value: DRILL_COLOUR,
                selector: CONFIRM,
                property: 'background-color',
                expectLanding: false,   // the fill is color-mix(… 14%, transparent)
            });
        }));

        test('P8\'s mirror: the affirmative action is PRIMARY, never transparent beside its Cancel', () => mounted(async (page) => {
            await openByPress(page);
            const fill = await page.prop(CONFIRM, 'background-color');
            assert.equal(fill, await page.resolveValue('var(--ui-primary)', 'background-color'),
                'P8: "#confirm-profile-btn — the one affirmative action on the screen — has no primary '
                + 'treatment; measured transparent, identical to Cancel beside it"');
            assert.notEqual(fill, await page.prop(CANCEL, 'background-color'),
                'the pair must not photograph as two identical buttons');
            await assertTokenDrill(page, {
                token: '--ui-primary',
                value: DRILL_COLOUR,
                selector: CONFIRM,
                property: 'background-color',
            });
        }, AFFIRMATIVE));

        test('tone is one property: an unknown value falls back to affirmative rather than guessing', () => mounted(async (page) => {
            const settled = await page.evalFn(() => {
                const host = document.getElementById('c');
                host.tone = 'catastrophic';
                return host.updateComplete.then(() => ({
                    tone: host.tone,
                    variant: host.confirmButton.getAttribute('variant'),
                }));
            });
            assert.deepEqual(settled, { tone: 'affirmative', variant: 'primary' },
                'a destructive treatment must be ASKED for, never inherited from a typo');
        }));

        test('the selection dials move nothing: this component grows no fifth selection idiom', () => mounted(async (page) => {
            await openByPress(page);
            const props = ['background-color', 'color', 'box-shadow', 'text-shadow'];
            const targets = [QUESTION, DETAIL, CANCEL, CONFIRM];
            const read = async () => {
                const out = [];
                for (const t of targets) out.push(await page.computed(t, props));
                return out;
            };

            const before = await read();
            await page.setToken('--ui-selected-face', DRILL_COLOUR);
            await page.setToken('--ui-selected-ink', DRILL_COLOUR);
            await page.setToken('--ui-selected-led', DRILL_LENGTH);
            await page.setToken('--ui-selected-glow', '80%');
            await page.settle(2);
            const after = await read();
            for (const token of ['--ui-selected-face', '--ui-selected-ink', '--ui-selected-led', '--ui-selected-glow']) {
                await page.setToken(token, null);
            }

            assert.deepEqual(after, before,
                'DECISIONS.md:244 / spec §3.9: the four dials are the ONLY selection treatment, and a '
                + 'confirm has no selection — so all four must be inert here, not "probably unused"');
        }));

        test('the way out draws an unclipped ring', () => mounted(async (page) => {
            await openByPress(page);
            await assertFocusUnclipped(page, CANCEL);
        }));

        test('the affirmative action draws an unclipped ring', () => mounted(async (page) => {
            await openByPress(page);
            await assertFocusUnclipped(page, CONFIRM);
        }));

        test('opening puts the caret on the way out, never on the destructive action', () => mounted(async (page) => {
            await openByPress(page);
            const at = await activePath(page);
            assert.match(at, /cancel/, `the caret opened on ${at}`);
            assert.doesNotMatch(at, /#confirm/,
                'ui-dialog.js:928 hands the caret to the first tabbable, and the pair is authored '
                + 'cancel-first precisely so that a stray Enter means KEEP');
        }));

        test('pressing the affirmative action reports confirm exactly once, and closes', () => mounted(async (page) => {
            await openByPress(page);
            await page.click(CONFIRM);
            await page.settle(3);
            assert.deepEqual(await outcomes(page), ['confirm:press']);
            assert.equal(await isOpen(page), false);
            assert.equal(await page.evalFn(() => document.getElementById('c').hasAttribute('open')), false,
                'the reflected attribute must follow the shell, or a screen styling around [open] lies');
        }));

        test('pressing the way out reports cancel, not confirm', () => mounted(async (page) => {
            await openByPress(page);
            await page.click(CANCEL);
            await page.settle(3);
            assert.deepEqual(await outcomes(page), ['cancel:press']);
            assert.equal(await isOpen(page), false);
        }));

        test('Escape means KEEP — a dismissal is a cancel however it arrives', () => mounted(async (page) => {
            await openByPress(page);
            await page.press('Escape');
            await page.settle(3);
            assert.deepEqual(await outcomes(page), ['cancel:escape'],
                'one outcome path, so a confirm cannot close ambiguously');
            assert.equal(await isOpen(page), false);
        }));

        test('Escape gives the caret back to the invoker', () => mounted(async (page) => {
            await openByPress(page);
            await page.press('Escape');
            await page.settle(3);
            assert.match(await activePath(page), /invoker/,
                '§4.6: "no focus trap, no focus restore" is what every overlay in the old app does');
        }));

        test('preventDefault on confirm keeps the dialog open — the async-action idiom', () => mounted(async (page) => {
            await openByPress(page);
            await page.eval(REFUSE_CONFIRM);
            await page.click(CONFIRM);
            await page.settle(3);
            assert.equal(await isOpen(page), true, 'the consumer refused the close');
            assert.deepEqual(await outcomes(page), ['confirm:press'],
                'and a refused confirm must NOT also report a cancel');
            assert.equal(await page.prop(NATIVE, 'display'), 'grid', 'still on screen');
        }));

        test('the compound establishes no container: everything in it reads the DIALOG\'s box', () => mounted(async (page) => {
            await openByPress(page);
            assert.equal(await page.prop('#c', 'container-type'), 'normal',
                'CONVENTIONS §2\'s one-line opt-out — a display: contents box cannot be a container, and '
                + '§4.6 names the container it must be: "a container query on the dialog\'s own box"');
            const card = await page.box(NATIVE);
            near(card.width, 500,
                'ORACLE profile-selector .modal-box [i=191] class max-w-[500px] — the AUTHORED cap; the '
                + '450x205 rect beside it is frozen 1920x1200 geometry the tool forbids as a target');
        }));

        test('the card reads its own width, and the shell\'s one breakpoint proves it', () => mounted(async (page) => {
            await openByPress(page);
            const narrowPad = await page.prop(CELL_BODY, 'padding-top');
            assert.equal(narrowPad, await page.resolveValue('var(--ui-space-4)', 'padding-top'),
                'a 500px card is under the 720px container query, so the cell inset is --ui-space-4 '
                + '(SOURCE numpad-modal.css:416) — the shell\'s rule applying, deliberately not fought');

            await page.setStyle('#c', { '--_ui-confirm-inline': '760px' });
            await page.settle(2);
            near((await page.box(NATIVE)).width, 760, 'the knob is open to a screen');
            assert.equal(await page.prop(CELL_BODY, 'padding-top'),
                await page.resolveValue('var(--ui-space-5)', 'padding-top'),
                'above 720 the query stops firing — and the VIEWPORT never moved, which is §2.1 Rule 1');

            await page.setStyle('#c', { '--_ui-confirm-inline': null });
            await page.settle(2);
            assert.equal(await page.prop(CELL_BODY, 'padding-top'), narrowPad, 'and back');
        }));

        test('the order of surrender is the body: the pair keeps its height while the body scrolls', () => mounted(async (page) => {
            await openByPress(page);
            const actionsBefore = await page.box(CELL_ACTIONS);

            await assertScrollFloor(page, {
                selector: CELL_BODY,
                squeezeSelector: NATIVE,
                squeeze: { 'max-block-size': '300px' },
            });

            await page.setStyle(NATIVE, { 'max-block-size': '300px' });
            await page.settle(2);
            const actionsAfter = await page.box(CELL_ACTIONS);
            await page.setStyle(NATIVE, { 'max-block-size': null });

            near(actionsAfter.height, actionsBefore.height,
                'the last thing to go is the way out of the dialog');
        }, TALL));

        test('a narrow card wraps the pair inside itself rather than overflowing it', () => mounted(async (page) => {
            await openByPress(page);
            await page.setStyle('#c', { '--_ui-confirm-inline': '300px' });
            await page.settle(2);

            const card = await page.box(NATIVE);
            const hit = parseFloat(await page.resolveValue('var(--ui-hit-min)', 'block-size'));
            for (const sel of ['#c >>> #cancel', '#c >>> #confirm']) {
                const b = await page.box(sel);
                assert.ok(b.left >= card.left - 0.5 && b.right <= card.right + 0.5,
                    `${sel} escapes the card: ${b.left}..${b.right} against ${card.left}..${card.right}`);
                assert.ok(b.height >= hit - 0.5,
                    `${sel} is ${b.height}px tall against the ${hit}px floor — ergonomics is physical`);
            }
            const m = await page.metrics(CELL_BODY);
            assert.ok(m.scrollWidth <= m.clientWidth + 0.5,
                'the question wraps; a confirm never scrolls sideways');

            await page.setStyle('#c', { '--_ui-confirm-inline': null });
        }));

        test('the modal announces by its question', () => mounted(async (page) => {
            await openByPress(page);
            const aria = await page.evalFn((s) => {
                const el = window.__h.need(s);
                return { modal: el.getAttribute('aria-modal'), label: el.getAttribute('aria-label') };
            }, NATIVE);
            assert.deepEqual(aria, { modal: 'true', label: 'Reset profile?' },
                'an IDREF cannot cross a shadow boundary, so the name is the same STRING that is on '
                + 'screen rather than a pointer at it (ui-dialog.js:670-672)');
        }));

        test('the heading level is the consumer\'s, and an impossible one falls back rather than un-headings', () => mounted(async (page) => {
            await openByPress(page);
            const tags = await page.evalFn(async () => {
                const host = document.getElementById('c');
                const read = () => host.renderRoot.querySelector('#question').tagName;
                const out = { default: read() };
                host.level = 3; await host.updateComplete; out.three = read();
                host.level = 9; await host.updateComplete; out.nine = read();
                out.level = host.level;
                return out;
            });
            assert.deepEqual(tags, { default: 'H2', three: 'H3', nine: 'H2', level: 2 },
                '#16 owns SHEET_HEADING_LEVELS and this imports it — two copies would be free to drift');
        }));

        test('each action carries its own name, so "Reset" is never announced as "Confirm"', () => mounted(async (page) => {
            await openByPress(page);
            const names = await page.evalFn(() => {
                const host = document.getElementById('c');
                const text = (id) => host.renderRoot.querySelector('#' + id).textContent.trim();
                return { cancel: text('cancel'), confirm: text('confirm') };
            });
            assert.deepEqual(names, { cancel: 'KEEP', confirm: 'Reset' },
                'ORACLE profile-selector #reset-profile-cancel "KEEP" / #reset-profile-confirm "Reset"');
        }));

        test('with no labels the two defaults come from the i18n store, not from a private table', () => mounted(async (page) => {
            const names = await page.evalFn(async () => {
                const host = document.getElementById('c');
                host.cancelLabel = '';
                host.confirmLabel = '';
                await host.updateComplete;
                const text = (id) => host.renderRoot.querySelector('#' + id).textContent.trim();
                return { cancel: text('cancel'), confirm: text('confirm') };
            });
            assert.deepEqual(names, { cancel: 'Cancel', confirm: 'Confirm' },
                'D2: the key IS its English text, so an unloaded store still answers with a usable word');
        }));

        test('every gallery state mounts, opens and has something to photograph', () => browser.withPage({ geometry }, async (page) => {
            for (const state of galleryEntry.states) {
                await page.mount(state.html, MODULE);
                await page.settle(3);
                assert.deepEqual(page.pageErrors, [], `state ${state.id} threw on mount`);
                if (state.hostStyle) await page.setStyle('#c', state.hostStyle);
                await page.settle(2);
                const box = await page.box(NATIVE);
                assert.ok(box.width > 100 && box.height > 60,
                    `state ${state.id} photographs as ${box.width}×${box.height}`);
                assert.equal(await page.prop(NATIVE, 'display'), 'grid',
                    `state ${state.id} is not open — the battery would photograph an empty stage`);
            }
        }));
    });
}
