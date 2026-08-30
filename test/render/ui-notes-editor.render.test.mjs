/**
 *.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';
import { entry as galleryEntry } from '../../tools/gallery/entries/ui-notes-editor.entry.js';
import {
    assertTokenDrill,
    assertOneSelectionTreatment,
    assertFocusUnclipped,
    assertScrollFloor,
    assertHitFloor,
    DRILL_COLOUR,
} from '../harness/assertions.js';

const MODULES = [
    '/src/components/ui-dialog.js',
    '/src/components/ui-notes-editor.js',
    '/src/components/ui-button.js',
    '/src/components/ui-text-field.js',
];

const SEED = 'Ethiopia Guji, 17.5 g in.\n\nFirst drop at 9 s.\n\n- WDT\n- 18 g VST\n- 60 ppm\n';

const MARKUP = `
<button id="behind">behind the scrim</button>
<ui-dialog id="dialog" heading="Notes" open>
  <ui-notes-editor id="notes" slot="body" label="Notes" value="${SEED.replace(/\n/g, '&#10;')}"></ui-notes-editor>
  <ui-button id="cancel" slot="actions">Cancel</ui-button>
  <ui-button id="confirm" slot="actions" variant="primary">Confirm</ui-button>
</ui-dialog>`;

const KEY = 'ui-notes-editor >>> .ui-mde-key.bold';
const KEY_2 = 'ui-notes-editor >>> .ui-mde-key.italic';
const BANK = 'ui-notes-editor >>> .editor-toolbar';
const SURFACE = 'ui-notes-editor >>> .CodeMirror';
const SCROLLPORT = 'ui-notes-editor >>> .CodeMirror-scroll';

/** Mount the standard page and wait for EasyMDE to exist. */
async function open(page, { markup = MARKUP } = {}) {
    await page.mount(markup, MODULES);
    await page.evalFn(() => document.getElementById('notes').ready.then(() => true));
    await page.settle();
}

/** Put the caret in the document and toggle bold, which is what makes a key active. */
async function selectBoldKey(page) {
    await page.evalFn(() => {
        const notes = document.getElementById('notes');
        const cm = notes.editor.codemirror;
        cm.focus();
        cm.setSelection({ line: 0, ch: 0 }, { line: 0, ch: 8 });
        window.EasyMDE.toggleBold(notes.editor);
        return true;
    });
    await page.settle();
}

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`ui-notes-editor @ ${geometry.name}`, () => {
        let browser;
        before(async () => { browser = await launch(); });
        after(async () => { await browser.close(); });

        const withPage = (fn) => browser.withPage({ geometry }, fn);

        test('easymde.min.css is adopted into THIS root, and the editor exists', () => withPage(async (page) => {
            await open(page);

            const adopted = await page.evalFn(() => document.getElementById('notes').sheetAdopted);
            assert.equal(adopted, true, 'the vendor sheet is not in the shadow root');

            const scrollOverflow = await page.prop(SCROLLPORT, 'overflow-y');
            assert.notEqual(scrollOverflow, 'visible', '.CodeMirror-scroll is unstyled');

            const caret = await page.computed('ui-notes-editor >>> .CodeMirror-cursor', ['position']);
            assert.equal(caret.position, 'absolute', 'the caret is not positioned — the sheet is missing');
        }));

        test('the layer, not the important flag, is what makes this component win', () => withPage(async (page) => {
            await open(page);

            const key = await page.computed(KEY, ['background-color', 'height']);
            const face = await page.resolveToken('--ui-key', 'background-color');
            assert.equal(key['background-color'], face, 'the vendor sheet is out-ranking the component');
            assert.notEqual(key.height, '30px', 'the key is at EasyMDE\'s own height');
        }));

        test('O7a: the editing surface is 28:18 under the dialog heading, not 1.04', () => withPage(async (page) => {
            await open(page);

            const heading = parseFloat(await page.prop('ui-dialog >>> ui-sheet-header >>> .title', 'font-size'));
            const body = parseFloat(await page.prop(SURFACE, 'font-size'));

            assert.equal(heading, 28, 'the dialog heading is not --ui-text-xl');
            assert.equal(body, 18, 'the editing surface is not --ui-text-md (notes-modal.css:249 asked for it)');

            const ratio = heading / body;
            assert.ok(
                ratio > 1.5,
                'O7 is back: "designed ratio 28:18 = 1.56, delivered 1.04". '
                + `heading ${heading}px / body ${body}px = ${ratio.toFixed(2)}.`,
            );
        }));

        test('O7b: a toolbar key is the same box as a control elsewhere, not 1.5x it', () => withPage(async (page) => {
            await open(page);

            const key = await page.box(KEY);
            const control = await page.box('ui-button#confirm');

            const ratio = key.height / control.height;
            assert.ok(
                Math.abs(ratio - 1) < 0.02,
                'O7 is back: the key and a control elsewhere are in different coordinate spaces. '
                + `key ${key.height}px vs ui-button ${control.height}px = ${ratio.toFixed(2)}x.`,
            );

            const controlH = parseFloat(await page.resolveValue('var(--ui-control-h)', 'width'));
            assert.equal(Math.round(key.height), controlH, 'the key is not --ui-control-h tall');
            assert.equal(Math.round(key.width), controlH, 'the key is not --ui-control-h wide');
        }));

        test('O7c: nothing in this component computes a transform', () => withPage(async (page) => {
            await open(page);

            const transformed = await page.evalFn(() => {
                const root = document.getElementById('notes').renderRoot;
                const out = [];
                for (const el of root.querySelectorAll('*')) {
                    const t = getComputedStyle(el).transform;
                    if (t && t !== 'none') out.push(`${el.tagName}.${el.className} -> ${t}`);
                }
                return out;
            });
            assert.deepEqual(transformed, [], 'a transform is back inside the notes editor');
        }));

        test('O7d: a key reaches the --ui-hit-min floor', () => withPage(async (page) => {
            await open(page);
            await assertHitFloor(page, KEY, { mode: 'box' });
        }));

        test('O8a: this component claims no modality at all', () => withPage(async (page) => {
            await open(page);

            const claims = await page.evalFn(() => {
                const el = document.getElementById('notes');
                const inTree = Array.from(el.renderRoot.querySelectorAll('*'));
                const isIcon = (n) => n.tagName.toLowerCase() === 'svg' || n.ownerSVGElement != null;
                const isVendorScenery = (n) => n.matches(
                    '#editor > textarea, .CodeMirror-vscrollbar, .CodeMirror-hscrollbar,'
                    + ' .CodeMirror-scrollbar-filler, .CodeMirror-gutter-filler',
                );
                const flagged = [el, ...inTree]
                    .filter((n) => !isIcon(n) && !isVendorScenery(n))
                    .filter((n) => n.hasAttribute('aria-modal')
                        || n.getAttribute('role') === 'dialog'
                        || n.hasAttribute('aria-hidden'));
                return {
                    hostRole: el.getAttribute('role'),
                    hostTabindex: el.getAttribute('tabindex'),
                    hostHidden: el.hasAttribute('aria-hidden'),
                    frameHidden: el.renderRoot.getElementById('frame').hasAttribute('aria-hidden'),
                    editorHidden: el.renderRoot.getElementById('editor').hasAttribute('aria-hidden'),
                    flagged: flagged.map((n) => n.tagName + (n.id ? '#' + n.id : '')),
                };
            });

            assert.deepEqual(claims.flagged, [], 'the notes body is claiming modality it does not own');
            assert.equal(claims.hostRole, null, 'the host took a role');
            assert.equal(claims.hostTabindex, null, 'the host took a tabindex');
            /* The three elements this component authors, named rather than left to the
             * exclusion list above: aria-hidden on any of them IS the O8 mechanism. */
            assert.equal(claims.hostHidden, false, 'the host used aria-hidden to hide itself');
            assert.equal(claims.frameHidden, false, 'the frame used aria-hidden to hide itself');
            assert.equal(claims.editorHidden, false, 'the editor host used aria-hidden to hide itself');
        }));

        test('O8b: Escape from inside the document closes the dialog — #18 owns the key', () => withPage(async (page) => {
            await open(page);

            await page.evalFn(() => { document.getElementById('notes').editor.codemirror.focus(); return true; });
            await page.press('Escape');
            await page.settle();

            const open1 = await page.evalFn(() => document.getElementById('dialog').open);
            assert.equal(open1, false, 'Escape did nothing — "no Escape" is O8\'s first clause');
        }));

        test('O8c: the page behind is really isolated while the editor is up', () => withPage(async (page) => {
            await open(page);

            const reached = await page.evalFn(() => {
                const behind = document.getElementById('behind');
                behind.focus();
                return document.activeElement === behind;
            });
            assert.equal(reached, false, 'a control behind the scrim still takes focus');

            await page.evalFn(() => { document.getElementById('dialog').hide('test'); return true; });
            await page.settle();
            const reachedAfter = await page.evalFn(() => {
                const behind = document.getElementById('behind');
                behind.focus();
                return document.activeElement === behind;
            });
            assert.equal(reachedAfter, true, 'the page was left permanently inert');
        }));

        test('O8d: guard-unsaved refuses a dismissal through #18\'s own cancellable door', () => withPage(async (page) => {
            await open(page);

            await page.evalFn(() => {
                const notes = document.getElementById('notes');
                notes.guardUnsaved = true;
                notes.editor.codemirror.focus();
                notes.editor.codemirror.replaceSelection('unsaved');
                return true;
            });
            await page.settle();

            await page.evalFn(() => {
                document.getElementById('dialog').requestClose('backdrop');
                return true;
            });
            await page.settle(2);
            assert.equal(await page.evalFn(() => document.getElementById('dialog').open), true,
                'unsaved work was thrown away');
            const refusal = await page.evalFn(() => {
                const p = document.getElementById('notes').shadowRoot.getElementById('refusal');
                return {
                    text: (p.textContent || '').trim(),
                    role: p.getAttribute('role'),
                    visible: p.getBoundingClientRect().height > 0,
                };
            });
            assert.ok(refusal.text.length > 0,
                'the refusal must be SAID — a dialog that silently declines to close is '
                + 'indistinguishable from one that is broken (F-007)');
            assert.equal(refusal.role, 'status', 'and announced, through the house idiom');
            assert.equal(refusal.visible, true, 'and drawn, not merely present');

            /* And off again with one property, which is the whole reversal. */
            await page.evalFn(() => { document.getElementById('notes').guardUnsaved = false; return true; });
            await page.settle();
            await page.evalFn(() => { document.getElementById('dialog').requestClose('backdrop'); return true; });
            await page.settle();
            assert.equal(await page.evalFn(() => document.getElementById('dialog').open), false,
                'the guard is still refusing with guard-unsaved off');
        }));

        test('F-007: the refusal line is absent until a dismissal is refused, and goes when the note is touched',
            () => withPage(async (page) => {
                await open(page);

                const read = () => page.evalFn(() => {
                    const p = document.getElementById('notes').shadowRoot.getElementById('refusal');
                    return {
                        text: (p.textContent || '').trim(),
                        h: Math.round(p.getBoundingClientRect().height),
                    };
                });

                /* NOTHING AT REST. A refusal line that is always there is furniture. */
                assert.deepEqual(await read(), { text: '', h: 0 },
                    'a note nobody has refused to close says nothing');

                await page.evalFn(() => {
                    const notes = document.getElementById('notes');
                    notes.guardUnsaved = true;
                    notes.editor.codemirror.focus();
                    notes.editor.codemirror.replaceSelection('unsaved');
                    return true;
                });
                await page.settle(2);

                /* STILL NOTHING — dirty is not refused. The line is about the GESTURE. */
                assert.equal((await read()).text, '', 'unsaved work alone is not a refusal');

                await page.evalFn(() => {
                    document.getElementById('dialog').requestClose('escape');
                    return true;
                });
                await page.settle(2);
                const refused = await read();
                assert.ok(refused.text.length > 0 && refused.h > 0,
                    `the refusal must appear, drawn — saw ${JSON.stringify(refused)}`);

                /* AND IT GOES WHEN THE PERSON ANSWERS IT. Typing is the answer: the
                 * situation the sentence described has moved on. */
                await page.evalFn(() => {
                    const cm = document.getElementById('notes').editor.codemirror;
                    cm.focus();
                    cm.replaceSelection(' more');
                    return true;
                });
                await page.settle(2);
                assert.deepEqual(await read(), { text: '', h: 0 },
                    'a refusal that outstays the situation it described becomes furniture');
            }));

        test('F-007: a clean note closes with no refusal at all', () => withPage(async (page) => {
            await open(page);
            await page.evalFn(() => { document.getElementById('notes').guardUnsaved = true; return true; });
            await page.settle(2);
            /* The guard is armed and the note is NOT dirty, so the door opens and
             * nothing is said. The guard must not become a wall. */
            await page.evalFn(() => { document.getElementById('dialog').requestClose('escape'); return true; });
            await page.settle(2);
            const state = await page.evalFn(() => ({
                open: document.getElementById('dialog').open,
                text: (document.getElementById('notes').shadowRoot
                    .getElementById('refusal').textContent || '').trim(),
            }));
            assert.deepEqual(state, { open: false, text: '' },
                'an unmodified note closes, silently');
        }));

        test('token drill: every value on the surface reads a token', () => withPage(async (page) => {
            await open(page);

            await assertTokenDrill(page, {
                token: '--ui-text-md',
                value: '37px',
                selector: SURFACE,
                property: 'font-size',
            });
            await assertTokenDrill(page, {
                token: '--ui-control-h',
                value: '37px',
                selector: KEY,
                property: 'height',
            });
            await assertTokenDrill(page, {
                token: '--ui-key',
                value: DRILL_COLOUR,
                selector: KEY,
                property: 'background-color',
            });
            await assertTokenDrill(page, {
                token: '--ui-line',
                value: DRILL_COLOUR,
                selector: BANK,
                property: 'border-top-color',
            });
            await assertTokenDrill(page, {
                token: '--ui-surface',
                value: DRILL_COLOUR,
                selector: SURFACE,
                property: 'background-color',
            });
            await assertTokenDrill(page, {
                token: '--ui-line-strong',
                value: DRILL_COLOUR,
                selector: 'ui-notes-editor >>> .editor-toolbar i.separator',
                property: 'background-color',
            });
        }));

        test('dial drill: the active key is the four dials, and only the active key', () => withPage(async (page) => {
            await open(page);
            await selectBoldKey(page);

            const pressed = await page.evalFn(() => document.getElementById('notes')
                .renderRoot.querySelector('.ui-mde-key.bold').getAttribute('aria-pressed'));
            assert.equal(pressed, 'true', 'EasyMDE\'s .active is not mirrored onto aria-pressed');

            await assertOneSelectionTreatment(page, { selected: KEY, unselected: KEY_2 });
        }));

        test('dial drill: the bank seam survives selection', () => withPage(async (page) => {
            await open(page);
            await selectBoldKey(page);

            const seam = await page.prop(KEY_2, 'box-shadow');
            const ink = await page.resolveToken('--ui-seam-ink', 'color');
            assert.ok(seam.includes('inset'), `an unselected key past the first has no seam: ${seam}`);
            assert.ok(seam.includes(ink), `the seam is not --ui-seam-ink (${ink}): ${seam}`);

            const firstKey = await page.prop(KEY, 'box-shadow');
            assert.ok(firstKey.includes('inset'), `the selected key lost its LED slot: ${firstKey}`);
        }));

        test('focus-unclipped: a key rings inside the scrolling bank (L24\'s class)', () => withPage(async (page) => {
            await open(page);
            await assertFocusUnclipped(page, KEY);
        }));

        test('focus-unclipped: the editing surface takes the one ring, not its 3px input', () => withPage(async (page) => {
            await open(page);
            await page.evalFn(() => { document.getElementById('notes').editor.codemirror.focus(); return true; });
            await page.settle();

            const ring = await page.computed(SURFACE, ['outline-style', 'outline-width', 'outline-color', 'outline-offset']);
            assert.notEqual(ring['outline-style'], 'none', 'the editing surface shows no ring while focused');
            assert.equal(ring['outline-width'], await page.resolveValue('var(--ui-focus-w)', 'outline-width'));
            assert.equal(ring['outline-color'], await page.resolveValue('var(--ui-steel)', 'outline-color'));
            assert.equal(ring['outline-offset'], await page.resolveValue('var(--ui-focus-offset-inset)', 'outline-offset'));

            const inputRing = await page.prop('ui-notes-editor >>> .CodeMirror textarea', 'outline-style');
            assert.equal(inputRing, 'none', 'the hidden input is drawing a second ring');
        }));

        test('container floor: the editing surface holds its floor and the body scrolls', () => withPage(async (page) => {
            await open(page);

            const floor = await page.evalFn(() => {
                const notes = document.getElementById('notes');
                return getComputedStyle(notes).getPropertyValue('--_ui-notes-min-h').trim();
            });
            assert.ok(floor.length > 0, 'the floor is not declared');

            await assertScrollFloor(page, {
                selector: 'ui-dialog >>> #body',
                squeezeSelector: 'ui-dialog >>> #dialog',
                squeeze: { 'max-block-size': '240px' },
            });

            await page.setStyle('ui-dialog >>> #dialog', { 'max-block-size': '240px' });
            const squeezed = await page.box(SURFACE);
            await page.setStyle('ui-dialog >>> #dialog', { 'max-block-size': null });
            const min = parseFloat(await page.resolveValue(
                'calc(2 * var(--ui-control-h) + 2 * var(--ui-space-4))', 'width',
            ));
            assert.ok(
                squeezed.height >= min - 0.5,
                `the editing surface shrank past its floor: ${squeezed.height}px against ${min}px.`,
            );
        }));

        test('container floor: the bank scrolls rather than losing its last keys (O11\'s class)', () => withPage(async (page) => {
            await open(page);

            await page.setStyle('ui-dialog', { '--_ui-dialog-inline': '320px' });
            await page.settle();
            const m = await page.metrics(BANK);
            const keys = await page.count('ui-notes-editor >>> .ui-mde-key');
            await page.setStyle('ui-dialog', { '--_ui-dialog-inline': null });

            assert.equal(keys, 9, 'a key went missing from the bank');
            assert.ok(m.scrollWidth > m.clientWidth + 0.5, 'the squeeze did not actually overflow the bank');
            assert.notEqual(m.overflowX, 'hidden',
                'the bank clips instead of scrolling — O11 one component over: '
                + '"a context menu taller than the viewport loses its LAST items"');
        }));

        test('aria: the editing surface has an accessible name', () => withPage(async (page) => {
            await open(page);
            const name = await page.evalFn(() => document.getElementById('notes')
                .editor.codemirror.getInputField().getAttribute('aria-label'));
            /* CodeMirror's input is an unlabelled textarea — the same hole as O9's
             * unlabelled backspace, one component over. */
            assert.equal(name, 'Notes');
        }));

        test('F-037: Preview takes aria-pressed with its class, and gives it back',
            () => withPage(async (page) => {
                await open(page);
                const read = () => page.evalFn(() => {
                    const btn = document.getElementById('notes').renderRoot
                        .querySelector('.ui-mde-key.preview');
                    return {
                        active: btn.classList.contains('active'),
                        pressed: btn.getAttribute('aria-pressed'),
                    };
                });
                const press = async () => {
                    await page.evalFn(() => {
                        document.getElementById('notes').renderRoot
                            .querySelector('.ui-mde-key.preview').click();
                        return true;
                    });
                    await page.settle(3);
                };

                assert.deepEqual(await read(), { active: false, pressed: 'false' },
                    'at rest the key is un-pressed and says so');

                await press();
                assert.deepEqual(await read(), { active: true, pressed: 'true' },
                    'the visible mode and the announced mode are one fact (F-037)');

                await press();
                assert.deepEqual(await read(), { active: false, pressed: 'false' },
                    'and back — a state that only ever goes one way is not a toggle');
            }));

        test('F-037: the other toggles still track the caret, which is a different route',
            () => withPage(async (page) => {
                await open(page);
                await selectBoldKey(page);
                const bold = await page.evalFn(() => {
                    const btn = document.getElementById('notes').renderRoot
                        .querySelector('.ui-mde-key.bold');
                    return {
                        active: btn.classList.contains('active'),
                        pressed: btn.getAttribute('aria-pressed'),
                    };
                });
                assert.deepEqual(bold, { active: true, pressed: 'true' });
            }));

        test('F-016: the picked-over textarea and the fake scrollbars are out of the tree',
            () => withPage(async (page) => {
                await open(page);
                const shape = await page.evalFn(() => {
                    const root = document.getElementById('notes').renderRoot;
                    const live = document.getElementById('notes').editor.codemirror.getInputField();
                    const backing = root.querySelector('#editor > textarea');
                    const bars = [...root.querySelectorAll(
                        '.CodeMirror-vscrollbar, .CodeMirror-hscrollbar,'
                        + ' .CodeMirror-scrollbar-filler, .CodeMirror-gutter-filler',
                    )];
                    return {
                        backingIsNotLive: backing !== null && backing !== live,
                        backingHidden: backing?.getAttribute('aria-hidden'),
                        backingTabindex: backing?.getAttribute('tabindex'),
                        liveHidden: live.getAttribute('aria-hidden'),
                        liveName: live.getAttribute('aria-label'),
                        barCount: bars.length,
                        barsHidden: bars.every((b) => b.getAttribute('aria-hidden') === 'true'),
                    };
                });

                assert.equal(shape.backingIsNotLive, true,
                    'the backing textarea is not the live input — if this ever flips, the '
                    + 'next two assertions would be hiding the editing surface itself');
                assert.equal(shape.backingHidden, 'true');
                assert.equal(shape.backingTabindex, '-1');

                assert.equal(shape.liveHidden, null, 'the editing surface stays in the tree');
                assert.equal(shape.liveName, 'Notes');

                /* CodeMirror's fake scrollbars carry tabindex="-1" and are 0×0 until
                 * content overflows; the two fillers are the same kind of thing. */
                assert.ok(shape.barCount >= 2, `the scaffolding must be found — saw ${shape.barCount}`);
                assert.equal(shape.barsHidden, true,
                    'vendor scrollbars are scenery, not controls with missing names');
            }));

        test('aria: the bank is a named toolbar and every key is named', () => withPage(async (page) => {
            await open(page);
            const bank = await page.evalFn(() => {
                const root = document.getElementById('notes').renderRoot;
                const tb = root.querySelector('.editor-toolbar');
                return {
                    role: tb.getAttribute('role'),
                    label: tb.getAttribute('aria-label'),
                    orientation: tb.getAttribute('aria-orientation'),
                    unnamed: Array.from(root.querySelectorAll('.ui-mde-key'))
                        .filter((k) => !k.getAttribute('aria-label'))
                        .map((k) => k.className),
                };
            });
            assert.equal(bank.role, 'toolbar');
            assert.equal(bank.label, 'Formatting');
            assert.equal(bank.orientation, 'horizontal');
            assert.deepEqual(bank.unnamed, [], 'a key has no accessible name');
        }));

        test('aria: only the toggles carry aria-pressed', () => withPage(async (page) => {
            await open(page);
            const state = await page.evalFn(() => {
                const root = document.getElementById('notes').renderRoot;
                const has = (n) => root.querySelector(`.ui-mde-key.${n}`)?.hasAttribute('aria-pressed');
                return {
                    bold: has('bold'), quote: has('quote'), preview: has('preview'),
                    link: has('link'), rule: has('horizontal-rule'),
                };
            });
            /* A one-shot action carrying aria-pressed="false" announces itself as an
             * un-pressed toggle, which is a worse lie than no state at all. */
            assert.deepEqual(state, { bold: true, quote: true, preview: true, link: false, rule: false });
        }));

        test('aria: the bank is reachable from the keyboard — roving tabindex', () => withPage(async (page) => {
            await open(page);

            const before = await page.evalFn(() => Array.from(document.getElementById('notes')
                .renderRoot.querySelectorAll('.ui-mde-key')).map((k) => k.tabIndex));
            assert.equal(before.filter((t) => t === 0).length, 1, 'the bank has no single tab stop');
            assert.equal(before[0], 0, 'the tab stop is not the first key');

            await page.evalFn(() => {
                document.getElementById('notes').renderRoot.querySelector('.ui-mde-key.bold').focus();
                return true;
            });
            await page.press('ArrowRight');
            await page.settle();

            const after = await page.evalFn(() => {
                const root = document.getElementById('notes').renderRoot;
                const active = root.activeElement;
                return {
                    focused: active ? active.className : null,
                    tabs: Array.from(root.querySelectorAll('.ui-mde-key')).map((k) => k.tabIndex),
                };
            });
            assert.match(after.focused ?? '', /italic/, 'ArrowRight did not move along the bank');
            assert.equal(after.tabs.filter((t) => t === 0).length, 1, 'the roving tab stop split in two');
        }));

        test('the seed arrives, edits report, and dirty tracks the baseline', () => withPage(async (page) => {
            await open(page);

            const seeded = await page.evalFn(() => {
                const notes = document.getElementById('notes');
                return { text: notes.text.slice(0, 24), dirty: notes.dirty };
            });
            assert.match(seeded.text, /Ethiopia Guji/);
            assert.equal(seeded.dirty, false, 'a freshly seeded editor reports dirty');

            const reported = await page.evalFn(() => new Promise((resolve) => {
                const notes = document.getElementById('notes');
                notes.addEventListener('notes-input', (e) => resolve(e.detail), { once: true });
                notes.editor.codemirror.focus();
                notes.editor.codemirror.replaceSelection('X');
                setTimeout(() => resolve(null), 50);
            }));
            assert.ok(reported, 'no notes-input event');
            assert.equal(reported.dirty, true);

            const saved = await page.evalFn(() => {
                const notes = document.getElementById('notes');
                notes.markSaved();
                return notes.dirty;
            });
            assert.equal(saved, false, 'markSaved did not move the baseline');
        }));

        test('the subject row is a slot, and absent means absent', () => withPage(async (page) => {
            await open(page);
            const empty = await page.evalFn(() => {
                const row = document.getElementById('notes').renderRoot.querySelector('#subject-row');
                return getComputedStyle(row).display;
            });
            assert.equal(empty, 'none', 'an empty subject row still occupies a grid track (T13\'s family)');

            await open(page, {
                markup: MARKUP.replace(
                    '></ui-notes-editor>',
                    '><ui-text-field slot="subject" label="Subject"></ui-text-field></ui-notes-editor>',
                ),
            });
            const filled = await page.evalFn(() => {
                const row = document.getElementById('notes').renderRoot.querySelector('#subject-row');
                return getComputedStyle(row).display;
            });
            assert.notEqual(filled, 'none', 'a slotted subject does not show');
        }));

        test('disabled dims and stops the document accepting input', () => withPage(async (page) => {
            await open(page);
            await page.evalFn(() => { document.getElementById('notes').disabled = true; return true; });
            await page.settle();

            const state = await page.evalFn(() => {
                const notes = document.getElementById('notes');
                return {
                    opacity: getComputedStyle(notes).opacity,
                    readOnly: notes.editor.codemirror.getOption('readOnly'),
                    keysDisabled: Array.from(notes.renderRoot.querySelectorAll('.ui-mde-key'))
                        .every((k) => k.disabled),
                    keyOpacity: getComputedStyle(notes.renderRoot.querySelector('.ui-mde-key')).opacity,
                };
            });
            const dial = parseFloat(await page.tokenValue('--ui-opacity-disabled'));
            assert.equal(parseFloat(state.opacity), dial, 'disabled is not the one dial');
            assert.equal(state.readOnly, 'nocursor');
            assert.equal(state.keysDisabled, true);
            /* And exactly ONE dim: the base paints the host and every [disabled] in
             * the shadow tree, which would compose to .38 x .38 on every key. */
            assert.equal(parseFloat(state.keyOpacity), 1, 'the keys are dimmed twice');
        }));

        test('every gallery state mounts and renders a bank', () => withPage(async (page) => {
            for (const state of galleryEntry.states) {
                await page.mount(state.html, MODULES);
                await page.evalFn(() => document.getElementById('notes').ready.then(() => true));
                await page.settle();
                const keys = await page.count('ui-notes-editor >>> .ui-mde-key');
                assert.equal(keys, 9, `gallery state ${state.id} rendered ${keys} keys`);
            }
        }));
    });
}
