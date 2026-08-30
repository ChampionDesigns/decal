/**
 * ui-icon-button.render.test.mjs — Gate A for Wave 1 item #2, "Icon button (+ lg)".
 *
 * Runs at BOTH standard geometries (1281×801 @ dsf 1.5 and the 1000×600 floor) and
 * asserts only on computed style, box geometry and behaviour — never on source text
 * (SCOPE Part 8 §2). The required classes, each present below:
 *
 *   TOKEN DRILL       --ui-control-h, --ui-control-lg, --ui-icon, --ui-icon-lg,
 *                     --ui-line, --ui-text-2, --ui-radius, --ui-steel,
 *                     --ui-opacity-disabled: retarget on :root, the rendered value
 *                     moves, and moves back.
 *   FOCUS GEOMETRY    one ring from --ui-focus-*, unclipped, in both offsets.
 *   CONTAINER         the square is the same at both geometries, holds inside a slot
 *                     narrower than itself, and the host reads no viewport.
 *   BUGS ASSERTED DEAD  L24 (clipped rings), L22 (a hit box smaller than the floor),
 *                     L12 (a private palette shadowing the public one), and Slate's
 *                     own [hidden] defect from slate-components.css:236-240. P4 is
 *                     NOT one of them and the test below says so: §7.3 P4 is
 *                     "measured 64x64, so --slate-hit-min is silently not applied
 *                     where the comment says it is, and the favourites row is 113px
 *                     rather than ~96" — the box EXCEEDS the floor, so a test that
 *                     asserts 64x64 asserts P4's own measurement. What clears P4's
 *                     CLASS here is the --ui-control-h drill: a hard-coded box cannot
 *                     move when the token moves.
 *   ARIA              the accessible name is never the glyph, it is moved onto the
 *                     control rather than duplicated on the host, and an opener's
 *                     state attributes reach the control at all.
 *   HIT FLOOR         both squares clear --ui-hit-min with paint alone.
 *
 * ORACLE VALUES UNDER TEST (prov_query.py, quoted in ui-icon-button.js's header):
 *   64px  <- slate-components.css `.slate-icon-btn` authored `var(--slate-control-height)`
 *   82px  <- slate-components.css `.slate-icon-btn-lg` authored `var(--slate-control-lg)`
 *   rgba(0, 0, 0, 0) background, rgb(186, 196, 202) ink, rgb(58, 72, 82) border,
 *   1px border, 6px radius, 0px padding.
 * The tests assert against the TOKENS those values identify, not against the numbers:
 * a test that pins 64px passes just as well when the component hard-codes it, which
 * is the failure the drill exists for.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES, BENCH, FLOOR } from '../harness/index.js';
import {
    assertTokenDrill,
    assertFocusUnclipped,
    assertHitFloor,
    DRILL_COLOUR,
    DRILL_LENGTH,
} from '../harness/assertions.js';

import { entry as galleryEntry } from '../../tools/gallery/entries/ui-icon-button.entry.js';

const MODULE = ['/src/components/ui-icon-button.js'];

/** Artwork paints itself; the component only sizes it (spec §2.3 case 3). */
const GLYPH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" '
    + 'stroke-width="1.6" aria-hidden="true"><path d="M4 12h16"></path></svg>';

const MARKUP = `
    <ui-icon-button id="md" label="Choose a profile">${GLYPH}</ui-icon-button>
    <ui-icon-button id="lg" size="lg" label="Version history">${GLYPH}</ui-icon-button>
    <ui-icon-button id="off" label="Add New Profile" disabled>${GLYPH}</ui-icon-button>
    <ui-icon-button id="text" label="Close">✕</ui-icon-button>
    <div id="band" style="overflow:hidden;display:flex">
        <ui-icon-button id="clipped" focus-ring="inset" label="Back to main screen">${GLYPH}</ui-icon-button>
    </div>
    <div id="slot" style="display:flex;inline-size:40px">
        <ui-icon-button id="squeezed" label="Toggle Fullscreen">${GLYPH}</ui-icon-button>
    </div>
`;

const attr = (page, selector, name) => page.evalFn(
    (s, n) => window.__h.need(s).getAttribute(n),
    selector,
    name,
);

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`ui-icon-button @ ${geometry.name} (${geometry.width}×${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

        const mounted = (fn) => browser.withPage({ geometry }, async (page) => {
            await page.mount(MARKUP, MODULE);
            assert.deepEqual(page.pageErrors, [], 'the component must mount without throwing');
            return fn(page);
        });

        /* -- geometry: the two squares ------------------------------------- */

        test('the default square is --ui-control-h on both axes', () => mounted(async (page) => {
            // ORACLE profile-selector #add-profile-modal-close [i=200] width = 64px <-
            // slate-components.css `.slate-icon-btn` authored `var(--slate-control-height)`
            // !important=no (token-driven); height = 64px from the same rule.
            const box = await page.box('#md >>> #control');
            assert.deepEqual([box.width, box.height], [64, 64]);

            // The HOST is the square too — no invisible slab around the control.
            const host = await page.box('#md');
            assert.deepEqual([host.width, host.height], [64, 64]);
        }));

        test('the lg square is --ui-control-lg on both axes', () => mounted(async (page) => {
            // ORACLE editor-review #editor-history-btn [i=11] width = 82px <-
            // slate-components.css `.slate-icon-btn-lg` authored `var(--slate-control-lg)`
            // !important=no (token-driven); height = 82px from the same rule.
            const box = await page.box('#lg >>> #control');
            assert.deepEqual([box.width, box.height], [82, 82]);
        }));

        test('drill: --ui-control-h moves the default square and leaves lg alone', () => mounted(async (page) => {
            const drill = await assertTokenDrill(page, {
                token: '--ui-control-h',
                value: '91px',
                selector: '#md >>> #control',
                property: 'inline-size',
            });
            assert.equal(drill.after, '91px');

            // Two sizes, two tokens: retargeting one must not drag the other. This is
            // what "one size token apart" has to mean to be worth a variant at all.
            await page.setToken('--ui-control-h', '91px');
            assert.equal(await page.prop('#lg >>> #control', 'inline-size'), '82px');
            await page.setToken('--ui-control-h', null);
        }));

        test('drill: --ui-control-lg moves the lg square and leaves the default alone', () => mounted(async (page) => {
            const drill = await assertTokenDrill(page, {
                token: '--ui-control-lg',
                value: '103px',
                selector: '#lg >>> #control',
                property: 'block-size',
            });
            assert.equal(drill.after, '103px');

            await page.setToken('--ui-control-lg', '103px');
            assert.equal(await page.prop('#md >>> #control', 'block-size'), '64px');
            await page.setToken('--ui-control-lg', null);
        }));

        /* -- the glyph ------------------------------------------------------ */

        test('the glyph is --ui-icon on the default and --ui-icon-lg on the lg', () => mounted(async (page) => {
            // The wave row names both tokens verbatim: "Square press control holding a
            // glyph at --ui-icon/--ui-icon-lg" (spec §3.1: 24px, slate-live.css:356-357;
            // 28px, slate-live.css:1117).
            const md = await page.computed('#md svg', ['width', 'height']);
            assert.deepEqual([md.width, md.height], ['24px', '24px']);

            const lg = await page.computed('#lg svg', ['width', 'height']);
            assert.deepEqual([lg.width, lg.height], ['28px', '28px']);
        }));

        test('drill: --ui-icon moves the slotted artwork across the shadow boundary', () => mounted(async (page) => {
            // ::slotted() sizing plus a private property that inherits down the FLAT
            // tree — the only styling channel that crosses the boundary (Part 2 §4, A6).
            await assertTokenDrill(page, {
                token: '--ui-icon',
                value: DRILL_LENGTH,
                selector: '#md svg',
                property: 'width',
            });
        }));

        test('a TEXT glyph is drawn at --ui-icon, not at the browser default', () => mounted(async (page) => {
            // DEPARTURE, declared in the wave-1 ledger (EXPECTED_CHANGES.jsonl,
            // region ui-icon-button). Slate's ✕ closes render at
            // ORACLE profile-selector #add-profile-modal-close [i=200] font-size = 16px
            // <- app.css `button, input, optgroup, select, textarea` authored `100%`
            // !important=no (FROZEN/hardcoded) — a preflight leak, not a design value.
            await assertTokenDrill(page, {
                token: '--ui-icon',
                value: DRILL_LENGTH,
                selector: '#text >>> #control',
                property: 'font-size',
            });
            assert.equal(await page.prop('#text >>> #control', 'font-size'), '24px');
        }));

        test('the control does not inherit the UA form-control font', () => mounted(async (page) => {
            // A button gets its own font from the UA sheet, and no preflight reaches
            // inside a shadow root — so `font-family: inherit` is load-bearing here.
            // ORACLE editor-review #editor-history-btn [i=11] font-family =
            // Geist, system-ui, sans-serif; font-weight = 400.
            const type = await page.computed('#md >>> #control', ['font-family', 'font-weight']);
            assert.equal(type['font-family'], await page.resolveToken('--ui-font-family', 'font-family'));
            assert.equal(type['font-weight'], '400');
        }));

        /* -- the paint, every value from a token (bug L12's class) ---------- */

        test('the resting paint is transparent with a token border and token ink', () => mounted(async (page) => {
            const paint = await page.computed('#md >>> #control', [
                'background-color', 'border-top-color', 'border-top-width',
                'border-top-left-radius', 'padding-left', 'box-shadow',
            ]);
            // ORACLE editor-review #editor-history-btn [i=11] background-color =
            // rgba(0, 0, 0, 0) <- slate-components.css `.slate-icon-btn` authored
            // `transparent` !important=no (FROZEN/hardcoded)
            assert.equal(paint['background-color'], 'rgba(0, 0, 0, 0)');
            assert.equal(paint['border-top-color'], await page.resolveToken('--ui-line', 'border-top-color'));
            assert.equal(paint['border-top-width'], '1px', '--ui-border-w');
            assert.equal(paint['border-top-left-radius'], '6px', '--ui-radius');
            // ORACLE live-ready #profile-open-selector [i=8] padding-left = 0px <-
            // slate-components.css `.slate-icon-btn` authored `0px`
            assert.equal(paint['padding-left'], '0px');
            // ORACLE editor-review #editor-history-btn [i=11] box-shadow = none
            assert.equal(paint['box-shadow'], 'none');
        }));

        test('drill: --ui-line, --ui-text-2 and --ui-radius all move (bug L12 dead)', () => mounted(async (page) => {
            // L12 is "a private palette duplicating the public tokens value-for-value,
            // declared three times". A component that copied a value would paint the
            // same pixels today and ignore the retarget — which is the whole test.
            await assertTokenDrill(page, {
                token: '--ui-line',
                value: DRILL_COLOUR,
                selector: '#md >>> #control',
                property: 'border-top-color',
            });
            await assertTokenDrill(page, {
                token: '--ui-text-2',
                value: DRILL_COLOUR,
                selector: '#md >>> #control',
                property: 'color',
            });
            await assertTokenDrill(page, {
                token: '--ui-radius',
                value: DRILL_LENGTH,
                selector: '#md >>> #control',
                property: 'border-top-left-radius',
            });
        }));

        /* -- focus: one ring, two offsets, unclipped (bug L24) -------------- */

        test('the focus ring is the token ring, outset and unclipped', () => mounted(async (page) => {
            const g = await assertFocusUnclipped(page, '#md >>> #control');
            assert.equal(
                g.outlineOffset,
                await page.resolveValue('var(--ui-focus-offset)', 'outline-offset'),
                '--ui-focus-offset',
            );
            assert.deepEqual(g.clippers, [], 'nothing clips a control in an open row');
        }));

        test('drill: --ui-steel moves the ring, so no second treatment is authored', () => mounted(async (page) => {
            const sel = '#md >>> #control';
            await assertTokenDrill(page, {
                token: '--ui-steel',
                value: DRILL_COLOUR,
                selector: sel,
                property: 'outline-color',
                prepare: (p) => p.focusVisible(sel),
            });
        }));

        test('BUG L24: inside a clipping band the same ring goes inset and survives', () => mounted(async (page) => {
            // L24 (§7.2): "focus rings clipped on all four sides by the components they
            // sit inside" — slate-components.css:549 (.slate-stepper) and :352
            // (.slate-bank), both overflow: hidden. An icon button in a header band is
            // that shape, so focus-ring="inset" is the whole fix, on the host.
            const g = await assertFocusUnclipped(page, '#clipped >>> #control');
            assert.equal(
                g.outlineOffset,
                await page.resolveValue('var(--ui-focus-offset-inset)', 'outline-offset'),
                '--ui-focus-offset-inset',
            );
            assert.ok(
                g.clippers.length >= 1,
                'the band must actually clip, or this assertion proves nothing',
            );
            assert.equal(g.clippers[0].overflowY, 'hidden');
        }));

        /* -- the hit floor (bug L22), and what P4 actually says -------------- */

        test('BUG L22: both squares clear --ui-hit-min with paint alone', () => mounted(async (page) => {
            // L22 (§7.2): "five of the nine numpad targets are inline spans whose hit box
            // is the glyphs — measured 32 × 35 against a 48px floor, on a wall panel
            // operated with a wet hand". Here the INK is the floor and more, on both
            // axes, so no hit-area overlay is needed to reach it.
            const floor = parseFloat(await page.resolveValue('var(--ui-hit-min)', 'width'));
            assert.equal(floor, 48, '--ui-hit-min: a wet fingertip is about 9mm (spec §2.3)');

            const md = await assertHitFloor(page, '#md >>> #control', { mode: 'box' });
            assert.ok(md.inline >= floor && md.block >= floor,
                `the small square renders ${md.inline}×${md.block} against a ${floor}px floor`);

            const lg = await assertHitFloor(page, '#lg >>> #control', { mode: 'box' });
            assert.ok(lg.inline >= floor && lg.block >= floor,
                `the lg square renders ${lg.inline}×${lg.block} against a ${floor}px floor`);
        }));

        test('P4\'s CLASS: the square is a token, not a number that happens to be 64', () => mounted(async (page) => {
            // P4 IS NOT A HIT-FLOOR BUG and this component does not retire it. §7.3 P4:
            // "The favourite slots take their GEOMETRY from one rule and their PAINT from
            // another 1300 lines away; measured 64×64, so --slate-hit-min is silently not
            // applied where the comment says it is, and the favourites row is 113px rather
            // than ~96." 64 EXCEEDS the 48px floor — the defect is a hard-coded 64
            // (slate-shell.css:351-355) standing in for the token the neighbouring rule
            // reads (:1666-1677, `width: var(--slate-hit-min)`), in a second file. So
            // asserting "the box measures 64×64" asserts P4's own defect measurement.
            //
            // The assertion that clears P4's class is the DRILL: a hard-coded box cannot
            // move when the token moves. (The favourite slot itself is a later row's
            // component; what this file can claim is the class, not the bug.)
            const restingMd = await page.box('#md >>> #control');
            const restingLg = await page.box('#lg >>> #control');
            assert.deepEqual([restingMd.width, restingMd.height], [64, 64]);
            assert.deepEqual([restingLg.width, restingLg.height], [82, 82]);

            await page.setToken('--ui-control-h', '71px');
            const moved = await page.box('#md >>> #control');
            assert.deepEqual([moved.width, moved.height], [71, 71],
                'the rendered square follows --ui-control-h — a literal 64 could not');
            assert.deepEqual(
                [(await page.box('#lg >>> #control')).width, (await page.box('#lg >>> #control')).height],
                [82, 82],
                'and only the token it reads: the lg square is --ui-control-lg and does not move',
            );
            await page.setToken('--ui-control-h', null);
            assert.deepEqual(
                [(await page.box('#md >>> #control')).width, (await page.box('#md >>> #control')).height],
                [64, 64],
                'and it comes back, so the drill measured the live value and not a cache',
            );
        }));

        /* -- disabled: one dial, applied once ------------------------------- */

        test('disabled dims the host by --ui-opacity-disabled and dims the control again by nothing', () => mounted(async (page) => {
            const dial = parseFloat(await page.resolveToken('--ui-opacity-disabled', 'opacity'));
            assert.ok(dial > 0 && dial < 1, `--ui-opacity-disabled should dim, got ${dial}`);

            assert.equal(parseFloat(await page.prop('#off', 'opacity')), dial, 'the host carries the dim');
            assert.equal(
                parseFloat(await page.prop('#off >>> #control', 'opacity')), 1,
                'the inner control must NOT dim again — .38 x .38 = .1444 is a third dial by accident',
            );
            assert.equal(parseFloat(await page.prop('#md', 'opacity')), 1, 'and an enabled one is undimmed');
        }));

        test('drill: --ui-opacity-disabled moves the dim', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-opacity-disabled',
                value: '0.17',
                selector: '#off',
                property: 'opacity',
            });
        }));

        test('disabled refuses input, not just paint', () => mounted(async (page) => {
            await page.recordEvents('#off', ['click']);
            await page.click('#off >>> #control');
            assert.deepEqual(await page.recordedEvents(), [], 'a disabled control fires nothing');

            assert.equal(await attr(page, '#off >>> #control', 'disabled'), '',
                'the native attribute is what refuses input; the host attribute only dims');
        }));

        /* -- behaviour: the press ------------------------------------------- */

        test('a press emits the native composed click, by pointer and by keyboard', () => mounted(async (page) => {
            await page.recordEvents('#md', ['click']);
            await page.click('#md >>> #control');
            assert.equal((await page.recordedEvents()).length, 1, 'a pointer press crosses the shadow boundary');

            await page.focusVisible('#md >>> #control');
            await page.press('Enter');
            assert.equal((await page.recordedEvents()).length, 2, 'Enter presses a button natively');
        }));

        test('focus() forwards to the control rather than stopping at the host', () => mounted(async (page) => {
            const where = await page.evalFn(() => {
                document.getElementById('md').focus();
                const deep = window.__h.deepActiveElement();
                return deep ? deep.id || deep.tagName.toLowerCase() : null;
            });
            assert.equal(where, 'control');
        }));

        /* -- aria: the name is never the glyph ------------------------------ */

        test('the accessible name comes from label', () => mounted(async (page) => {
            // Six of the nine icon buttons in the corpus name themselves; the three
            // modal closes carry aria="" and text "✕", so their name IS the glyph.
            assert.equal(await attr(page, '#md >>> #control', 'aria-label'), 'Choose a profile');
            assert.equal(await attr(page, '#text >>> #control', 'aria-label'), 'Close');
            assert.equal(await attr(page, '#md >>> #control', 'type'), 'button',
                'never a submit button by accident');
        }));

        test('a host-level aria-label and a title are both honoured, and label wins', () => {
            return browser.withPage({ geometry }, async (page) => {
                await page.mount(
                    `<ui-icon-button id="fromAria" aria-label="Toggle Fullscreen">${GLYPH}</ui-icon-button>`
                    + `<ui-icon-button id="fromTitle" title="Version history">${GLYPH}</ui-icon-button>`
                    + `<ui-icon-button id="both" label="Back to main screen" aria-label="stale">${GLYPH}</ui-icon-button>`
                    + `<ui-icon-button id="none">${GLYPH}</ui-icon-button>`,
                    MODULE,
                );
                assert.deepEqual(page.pageErrors, []);
                assert.equal(await attr(page, '#fromAria >>> #control', 'aria-label'), 'Toggle Fullscreen');
                assert.equal(await attr(page, '#fromTitle >>> #control', 'aria-label'), 'Version history');
                assert.equal(await attr(page, '#both >>> #control', 'aria-label'), 'Back to main screen');
                assert.equal(
                    await attr(page, '#none >>> #control', 'aria-label'), null,
                    'no name invented from nothing: the attribute is absent, not empty',
                );
            });
        });

        test('the name is reactive: setting .label re-renders it', () => mounted(async (page) => {
            await page.evalFn(() => { document.getElementById('md').label = 'Choose another profile'; });
            await page.settle(2);
            assert.equal(await attr(page, '#md >>> #control', 'aria-label'), 'Choose another profile');
        }));

        test('a host-written name is MOVED onto the control, not duplicated on the host', () => {
            // The host of a custom element with no role is a generic, and ARIA does not
            // allow a name there — Chrome computes one anyway, so a copy on both is the
            // same name announced twice, the second time on a container that does
            // nothing. One name, on the thing that is actually a button.
            return browser.withPage({ geometry }, async (page) => {
                await page.mount(
                    `<ui-icon-button id="named" aria-label="Add New Profile">${GLYPH}</ui-icon-button>`,
                    MODULE,
                );
                assert.deepEqual(page.pageErrors, []);
                await page.settle(3);

                assert.deepEqual(
                    await page.evalFn(() => {
                        const el = document.getElementById('named');
                        return {
                            host: el.getAttribute('aria-label'),
                            control: el.shadowRoot.querySelector('button').getAttribute('aria-label'),
                            readback: el.accessibleName,
                        };
                    }),
                    { host: null, control: 'Add New Profile', readback: 'Add New Profile' },
                    'the name lives on the control; the host keeps a readable copy in JS only',
                );

                // Renaming still works, and does not leave the attribute behind.
                await page.evalFn(() => {
                    document.getElementById('named').setAttribute('aria-label', 'Choose a profile');
                });
                await page.settle(4);
                assert.equal(await attr(page, '#named >>> #control', 'aria-label'), 'Choose a profile');
                assert.equal(
                    await page.evalFn(() => document.getElementById('named').getAttribute('aria-label')),
                    null,
                    'the host must not accumulate a second, stale copy of the name',
                );

                // And it is clearable: the adopted value is not a one-way trapdoor.
                await page.evalFn(() => { document.getElementById('named').hostLabel = ''; });
                await page.settle(3);
                assert.equal(await attr(page, '#named >>> #control', 'aria-label'), null,
                    'clearing .hostLabel clears the name rather than restoring the adopted one');
            });
        });

        test('an opener\'s state attributes reach the real control', () => {
            // A shadow root forwards no aria-*: without this, aria-expanded /
            // aria-haspopup / aria-controls written by a screen sit on a role-less
            // generic and no assistive technology sees them — and two of the corpus's
            // nine icon buttons are openers (#profile-open-selector, #add_profile).
            // Spec Appendix 15: the aria-* state contract is "the right contract for a
            // Lit component's reflected properties".
            return browser.withPage({ geometry }, async (page) => {
                await page.mount(
                    '<ui-icon-button id="opener" label="Choose a profile" aria-haspopup="dialog"'
                    + ` aria-expanded="false" aria-controls="profile-sheet">${GLYPH}</ui-icon-button>`
                    + `<ui-icon-button id="plain" label="Version history">${GLYPH}</ui-icon-button>`,
                    MODULE,
                );
                assert.deepEqual(page.pageErrors, []);
                await page.settle(2);

                const read = () => page.evalFn(() => {
                    const b = document.getElementById('opener').shadowRoot.querySelector('button');
                    return {
                        expanded: b.getAttribute('aria-expanded'),
                        haspopup: b.getAttribute('aria-haspopup'),
                        controls: b.getAttribute('aria-controls'),
                        pressed: b.getAttribute('aria-pressed'),
                    };
                });

                assert.deepEqual(await read(), {
                    expanded: 'false', haspopup: 'dialog', controls: 'profile-sheet', pressed: null,
                }, 'and nothing is invented: an absent state stays absent');

                // Live, because opening the sheet is exactly when the state changes.
                await page.evalFn(() => {
                    document.getElementById('opener').setAttribute('aria-expanded', 'true');
                });
                await page.settle(2);
                assert.equal((await read()).expanded, 'true');

                await page.evalFn(() => {
                    document.getElementById('opener').removeAttribute('aria-expanded');
                });
                await page.settle(2);
                assert.equal((await read()).expanded, null, 'no stale state left on the control');

                // aria-pressed is RELAYED AND NOT PAINTED. CONVENTIONS §4 gives selection
                // treatment to item #3, the segmented bank; a look invented here would be
                // the fourteenth selection idiom, "the decay the rewrite exists to stop".
                await page.evalFn(() => {
                    document.getElementById('opener').setAttribute('aria-pressed', 'true');
                });
                await page.settle(2);
                assert.equal((await read()).pressed, 'true');
                const properties = ['background-color', 'color', 'border-top-color', 'box-shadow'];
                assert.deepEqual(
                    await page.computed('#opener >>> #control', properties),
                    await page.computed('#plain >>> #control', properties),
                    'aria-pressed must not paint here — selection belongs to component #3',
                );
            });
        });

        /* -- container behaviour, and the viewport is never read ------------ */

        test('the host opts out of inline-size containment in one line', () => mounted(async (page) => {
            // CONVENTIONS §2: a control that must shrink to fit its glyph turns
            // containment off, or its intrinsic contribution is 0 and the failure looks
            // like "my component vanished".
            const host = await page.computed('#md', ['container-type', 'display']);
            assert.equal(host['container-type'], 'normal');
            assert.equal(host.display, 'inline-grid');
        }));

        test('a slot narrower than the control does not shrink it (bug T9\'s class)', () => mounted(async (page) => {
            // T9: "it is a flex item with default shrink. Measured 214 in one leaf and
            // 250 two rows below, inside a single screen." A touch floor a parent can
            // shrink is not a floor (spec §2.3 case 2 — ergonomics is physical).
            const slot = await page.box('#slot');
            assert.equal(slot.width, 40, 'the slot really is narrower than the control');

            const squeezed = await page.box('#squeezed >>> #control');
            assert.deepEqual([squeezed.width, squeezed.height], [64, 64]);
        }));

        test('item #31\'s lever: sizing the HOST widens the pressable control', () => mounted(async (page) => {
            // ITEMS.json notes (7): "#1, #2 -> Wave 2 #16 sheet header and #31 page
            // header bar", "recorded because they constrain the API". This file's own
            // comment defers the 96×82 header slab to item #31 "from outside" — so the
            // mechanism has to exist from outside, or the deferral is empty. Slate gets
            // that geometry with a screen rule (`#main-page .slate-live-header
            // .slate-icon-action { min-width: var(--slate-control-lg) }`,
            // slate-live.css:350-352); here the equivalent is a rule on the HOST, which
            // beats :host with no !important, and the CONTROL must follow — a wider host
            // around a 82px button is a dead, unpressable strip.
            const before = await page.box('#lg >>> #control');
            assert.deepEqual([before.width, before.height], [82, 82]);

            await page.evalFn(() => {
                const s = document.createElement('style');
                s.id = 'item-31-header';
                s.textContent = '#lg { inline-size: 96px }';
                document.head.appendChild(s);
                return true;
            });
            await page.settle(2);

            const host = await page.box('#lg');
            const control = await page.box('#lg >>> #control');
            assert.equal(host.width, 96, 'an outside rule reaches the host with no !important');
            assert.deepEqual([control.width, control.height], [96, 82],
                'Slate\'s own header geometry: #fullscreen-toggle-btn renders 96×82');
            assert.ok(
                Math.abs(control.left - host.left) < 0.5 && Math.abs(control.right - host.right) < 0.5,
                `dead strip: control [${control.left}, ${control.right}] inside host [${host.left}, ${host.right}]`,
            );

            // AND THE SQUARE IS STILL A FLOOR: a host too small for the control does not
            // shrink it (spec §2.3 case 2 — ergonomics is physical).
            await page.evalFn(() => {
                document.getElementById('item-31-header').textContent = '#lg { inline-size: 20px }';
                return true;
            });
            await page.settle(2);
            assert.equal((await page.box('#lg >>> #control')).width, 82,
                'min-inline-size is the floor; a narrow host must not shrink the control');
        }));

        test('shrinking the container moves nothing at all', () => mounted(async (page) => {
            const before = await page.box('#md >>> #control');
            await page.setStyle('#mount', { 'inline-size': '260px' });
            const after = await page.box('#md >>> #control');
            await page.setStyle('#mount', { 'inline-size': null });
            assert.deepEqual(
                [after.width, after.height], [before.width, before.height],
                'a fixed control is fixed: no container query, no viewport query',
            );
        }));

        /* -- Slate's own [hidden] defect ------------------------------------ */

        test('[hidden] hides it, with no !important anywhere', () => {
            // slate-components.css:236-240 records the defect in its own comment: "A
            // component sets `display`, which outranks the [hidden] attribute — so
            // hiding one by script silently did nothing." Slate's fix is
            // `display: none !important`. Here :host([hidden]) is (0,2,0) against this
            // component's :host (0,1,0), so the base rule wins on specificity.
            return browser.withPage({ geometry }, async (page) => {
                await page.mount(
                    `<ui-icon-button id="shown" label="Choose a profile">${GLYPH}</ui-icon-button>`
                    + `<ui-icon-button id="gone" label="Choose a profile" hidden>${GLYPH}</ui-icon-button>`,
                    MODULE,
                );
                assert.deepEqual(page.pageErrors, []);
                assert.equal(await page.prop('#shown', 'display'), 'inline-grid');
                assert.equal(await page.prop('#gone', 'display'), 'none');
            });
        });

        /* -- the size attribute is forgiving -------------------------------- */

        test('an unrecognised size falls back to the default square', () => {
            return browser.withPage({ geometry }, async (page) => {
                await page.mount(
                    `<ui-icon-button id="odd" size="enormous" label="Choose a profile">${GLYPH}</ui-icon-button>`,
                    MODULE,
                );
                assert.deepEqual(page.pageErrors, []);
                const box = await page.box('#odd >>> #control');
                assert.deepEqual([box.width, box.height], [64, 64],
                    'a wrong value must not blank the control — the same forgiveness focus-ring uses');
            });
        });

        test('setting .size in JS reaches the CSS, because the property reflects', () => mounted(async (page) => {
            await page.evalFn(() => { document.getElementById('md').size = 'lg'; });
            await page.settle(2);
            const box = await page.box('#md >>> #control');
            assert.deepEqual([box.width, box.height], [82, 82]);
        }));

        /* -- the gallery entry this builder owns ---------------------------- */

        test('every gallery state mounts and settles', () => {
            // The entry file is registered into tools/gallery/entries.js by the wave's
            // GATE agent (one shared array, sixteen parallel builders). This proves the
            // states themselves are sound before they are wired, so a malformed one is
            // a red test here rather than a blank frame in the capture battery.
            return browser.withPage({ geometry }, async (page) => {
                for (const state of galleryEntry.states) {
                    await page.mount(state.html, MODULE);
                    assert.deepEqual(page.pageErrors, [], `${galleryEntry.id}--${state.id} threw`);
                    assert.ok(
                        await page.exists('ui-icon-button >>> #control'),
                        `${galleryEntry.id}--${state.id} rendered no control`,
                    );
                }
            });
        });
    });
}

/* ---------------------------------------------------------------------------
 * Cross-geometry: the bench and the floor render the same control
 * ------------------------------------------------------------------------- */

test('the square is a token at both geometries, not a fraction of the viewport', async () => {
    const read = (geometry) => browser.withPage({ geometry }, async (page) => {
        await page.mount(MARKUP, MODULE);
        return {
            dpr: await page.eval('devicePixelRatio'),
            md: await page.box('#md >>> #control'),
            lg: await page.box('#lg >>> #control'),
            glyph: await page.prop('#md svg', 'width'),
        };
    });

    const bench = await read(BENCH);
    const floor = await read(FLOOR);

    assert.equal(bench.dpr, 1.5);
    assert.equal(floor.dpr, 1);
    assert.deepEqual(
        [bench.md.width, bench.md.height, bench.lg.width, bench.lg.height, bench.glyph],
        [floor.md.width, floor.md.height, floor.lg.width, floor.lg.height, floor.glyph],
        'a 281px narrower viewport must not move one pixel of a fixed control',
    );
    assert.deepEqual([bench.md.width, bench.lg.width], [64, 82]);
});

/* ---------------------------------------------------------------------------
 * Both themes: exactly the two properties the oracle says differ
 * ------------------------------------------------------------------------- */

test('the ink and the border invert with the theme; nothing else moves', async () => {
    // ORACLE `themes --state editor-review --id editor-history-btn`: "16 of 18
    // properties identical across themes; 2 differ" — border-top-color
    // rgb(58, 72, 82) dark / rgb(203, 208, 211) light, and color rgb(186, 196, 202)
    // dark / rgb(63, 71, 76) light. Both are token retargets, so the assertion is
    // token equality plus inequality across themes: pinning the literals here would
    // put a copy of the palette in a test and break every fork (A6, bug L12's shape).
    const read = (theme) => browser.withPage({ geometry: BENCH, theme }, async (page) => {
        await page.mount(MARKUP, MODULE);
        const paint = await page.computed('#md >>> #control', [
            'color', 'border-top-color', 'background-color', 'border-top-width',
            'border-top-left-radius', 'width', 'height',
        ]);
        return {
            paint,
            line: await page.resolveToken('--ui-line', 'border-top-color'),
            ink: await page.resolveToken('--ui-text-2', 'color'),
        };
    });

    const dark = await read('dark');
    const light = await read('light');

    assert.equal(dark.paint['border-top-color'], dark.line);
    assert.equal(light.paint['border-top-color'], light.line);
    assert.equal(dark.paint.color, dark.ink);
    assert.equal(light.paint.color, light.ink);

    assert.notEqual(dark.paint.color, light.paint.color, 'the ink must invert');
    assert.notEqual(dark.paint['border-top-color'], light.paint['border-top-color'], 'the border must invert');

    for (const property of ['background-color', 'border-top-width', 'border-top-left-radius', 'width', 'height']) {
        assert.equal(
            dark.paint[property], light.paint[property],
            `${property} is not a theme-bearing value and must not move`,
        );
    }
});

/* ---------------------------------------------------------------------------
 * The gallery entry's shape — node only, no browser
 * ------------------------------------------------------------------------- */

describe('the gallery entry', () => {
    test('is the documented shape, with stable ids', () => {
        assert.equal(galleryEntry.id, 'ui-icon-button', 'the entry id is the tag name');
        assert.equal(galleryEntry.module, '../../src/components/ui-icon-button.js',
            'module paths are relative to tools/gallery/');
        assert.equal(typeof galleryEntry.title, 'string');
        assert.ok(galleryEntry.states.length >= 3);

        const ids = galleryEntry.states.map((s) => s.id);
        assert.deepEqual([...new Set(ids)], ids, 'state ids are capture filenames, so they are unique');
        for (const state of galleryEntry.states) {
            assert.match(state.id, /^[a-z0-9-]+$/, `state id ${state.id} must be a kebab-case identifier`);
            assert.ok(state.title && state.html, `state ${state.id} needs a title and markup`);
            assert.ok(state.html.includes('<ui-icon-button'), `state ${state.id} must mount the component`);
        }
    });
});
