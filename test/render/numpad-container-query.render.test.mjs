/**
 * numpad-container-query.render.test.mjs — wave 5.2, items `numpad-container-query`
 * and `numpad-port-checklist`.
 *
 * TWO ROWS, ONE SUITE, because the second is only interesting inside the first. The
 * port checklist (O9/O10) is proven at rest by #53's own wave-4 suite; what no suite
 * asked before is whether it SURVIVES the compaction — a narrow-branch layout that
 * quietly drops the backspace's name or re-sizes the title is exactly how a checklist
 * item comes back one wave later.
 *
 * ------------------------------------------------------------------------------
 * ROW 1 — `numpad-container-query`
 * ------------------------------------------------------------------------------
 * "The old app's one real breakpoint, re-expressed as a container query on the
 * dialog's own box." LAYOUT_SPEC_DRAFT.md §4.6, quoted:
 *
 *   "One real breakpoint survives here, and it is correct. `numpad-modal.css:411`
 *    (`max-width: 720px`) and `:428` (`max-height: 650px and min-width: 721px`) query
 *    the *real window*, which for a top-layer dialog is the only query that means
 *    anything (`layout/shell.md` W-5). Carry that as a container query on the dialog's
 *    own box. Note that **neither fires on the bench tablet**, so the narrow/short
 *    numpad layout is currently untested on the target hardware
 *    (`layout/overlays.md` §6.8)."
 *
 * The row's own note is the reason this file runs the query rather than photographing
 * it: "Neither branch of that query fires on the bench tablet, so the narrow/short
 * numpad layout is UNTESTED on target hardware until this phase tests it — test it
 * here at the harness geometries rather than assuming the tablet will exercise it."
 * MEASURED here, and it is true at both: the card is 820 × 478 at 1281×801 and at
 * 1000×600 alike, so nothing on this machine ever reaches the threshold by itself.
 * The harness is therefore the only place either branch runs, and section 3 runs both.
 *
 * THAT 478 IS THE ARMED CARD, and the distinction is load-bearing — finding
 * c-modality-3. #53 reads its range from a `limits` PROPERTY and renders an
 * `unavailable` panel until a screen hands it one (`ui-numeric-keypad.js:836-843`), so
 * an un-armed keypad is an empty box: 820 × 374 at both geometries, with no well and
 * no pad. `mounted()` below primes the R2 table exactly as `#53`'s own suite does
 * (:155-160), so every number in this file is the armed keypad. An earlier draft of
 * this header carried 374 — the unarmed figure, off a probe that set `open` and never
 * set `limits` — which measured the contract on the box the suite deliberately does
 * not use.
 *
 * WHY SLATE'S SECOND MEDIA RULE HAS NO CONTAINER-QUERY TWIN, measured, not assumed —
 * section 4. `max-height: 650px` is a BLOCK-axis question, and a block-axis container
 * query needs `container-type: size` on the container. #18's card is
 * `block-size: fit-content` bounded by `max-block-size` (`ui-dialog.js:396-397`), and
 * size containment on a fit-content box means the box is sized as if it had no
 * contents. Applying it to this component's `.body` collapses THAT BOX to 0 — the
 * well, the pad and the previous-values row all gone — and takes the card down with
 * it, 478 → 266, which is the header, the footer and the body cell's own padding and
 * nothing else. Measured at both geometries, armed and unarmed alike (the unarmed card
 * lands on the same 266). Adding `block-size: 100%` gives the collapsed `.body` 16px
 * back and leaves the card at 266, which is the same collapse wearing a hat. The query
 * would also be cyclic — the contents decide the height that would decide the query.
 * So the block-axis branch is not expressible without changing the shell's own sizing
 * contract, and this phase does not touch the shell. It also has nothing left to do:
 * Slate's short branch shrank the pad rows 88 → 62px and the well 104 → 88px to fit a
 * 650px window, and this card is already 478px against Slate's captured 545 — 67px
 * under it — because the key face is #15's `--ui-hit-min` 48px (departure 1). Against
 * the block cap it is 478 of 753 at bench and of 552 at the floor, a 74px margin at
 * the tighter of the two. Section 4 pins both halves as numbers, and §2.4's order of
 * surrender — the body scrolls — is what a genuinely short box gets instead. Recorded
 * as a deferred question with its reversal.
 *
 * ------------------------------------------------------------------------------
 * ROW 2 — `numpad-port-checklist`, inside both branches
 * ------------------------------------------------------------------------------
 *   O9   "The numpad's backspace key has no accessible name (an unlabelled <svg>, not
 *         even aria-hidden), and the display is updated by innerHTML with no
 *         aria-live."   (§7.7, `numpad-modal.js:220-222, 291-292`)
 *   O10  "The numpad title writes an inline 28px unconditionally on every open and
 *         shrinks to a 16px floor — the one piece of type in the skin whose size is
 *         not a token."   (§7.7, `numpad-modal.js:508-522`)
 *
 * Both landed in wave 4 and are asserted at rest in
 * `test/render/ui-numeric-keypad.render.test.mjs` sections 2 and 3 (the name on the
 * pressable, `aria-hidden` on the glyph, `role="status"`/`aria-live="polite"`/
 * `aria-atomic="true"` on the readout, the `--ui-text-xl` drill on the heading, no
 * inline style anywhere, no fit loop). Section 5 here re-asks all three in the
 * compacted branch, which is the state neither the tablet nor that suite reaches.
 *
 * ENGINE TRUTH ONLY. The one structural claim — that no viewport media query exists
 * anywhere in this component's styles — is read from the parsed CSSOM of the live
 * shadow root, not from source text.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';
import { limitsFor } from '../../src/lib/machine-limits.js';
import {
    assertTokenDrill, assertFocusUnclipped, assertHitFloor, assertScrollFloor,
    DRILL_LENGTH,
} from '../harness/assertions.js';

const BENGLE = limitsFor('bengle');

const MODULE = [
    '/src/components/ui-numeric-keypad.js',
    '/src/components/ui-button.js',
    '/src/components/ui-dialog.js',
];

const MARKUP = `
<div id="page" style="padding: 40px">
  <ui-button id="invoker">18 g</ui-button>
  <ui-numeric-keypad id="np" heading="Dose in" limit-key="dose" unit="g" value="18"></ui-numeric-keypad>
</div>`;

const SHELL = '#np >>> #dialog';
const NATIVE = '#np >>> #dialog >>> #dialog';
const CELL_BODY = '#np >>> #dialog >>> #body';
const HEAD = '#np >>> #dialog >>> #head';
const ACTIONS = '#np >>> #dialog >>> #actions';
const TITLE = '#np >>> #dialog >>> ui-sheet-header >>> #title';
const BODY = '#np >>> #body';
const LAYOUT = '#np >>> #layout';
const ENTRY = '#np >>> #entry';
const PAD_COL = '#np >>> #pad-col';
const KEY_1 = '#np >>> #key-1';
/* The face lives in #15's shadow root, and #15 is a CHILD of the button — so the
 * middle hop is a light-DOM descendant selector, not a second `>>>`. */
const KEY_1_FACE = '#np >>> #key-1 ui-keycap >>> #cap';
const KEY_BACKSPACE = '#np >>> #key-backspace';
const DISPLAY = '#np >>> #display';

/**
 * THE THRESHOLD, and the arithmetic that turns it into a card width.
 *
 * The container is this component's `.body` (`ui-numeric-keypad.js:359-363`), which
 * fills #18's body cell, so its inline size is the card minus the cell's two
 * `--_ui-dialog-pad` insets. The pad is not one number, and that is the point:
 * SLATE'S 720px RULE IS SPLIT ACROSS THE TWO COMPONENTS, each carrying its own half as
 * a container query on the same box —
 *
 *   the SHELL's half   `@container (max-width: 720px) { .cell { --_ui-dialog-pad:
 *                      var(--ui-space-4) } }` (`ui-dialog.js:612-616`), which is
 *                      "numpad-modal.css:416 padding 24px -> 18px" and nothing else;
 *   the BODY's half    `@container (max-width: 584px)` (`ui-numeric-keypad.js:405`),
 *                      which stacks the two columns — "everything else inside those
 *                      two media blocks is the numpad's BODY ... and belongs to #53".
 *
 * So a card at or below 720px insets by 18, not 24, and every narrow card this file
 * asks for is below 720 by construction. Measured: 820 → 772, 620 → 584.
 * `@container (max-width: 584px)` is inclusive, so 584 fires and 588 does not.
 */
const QUERY_MAX = 584;
const PAD_WIDE = 24;      /* --ui-space-5, above the shell's own 720px query */
const PAD_NARROW = 18;    /* --ui-space-4, below it */
const cardFor = (container) => `${container + 2 * PAD_NARROW}px`;

const tracks = (value) => value.trim().split(/\s+/).length;

/** Rendered lengths at dsf 1.5 are not string-comparable; whole CSS px are. */
const near = (got, want, what, tol = 0.51) => assert.ok(
    Math.abs(got - want) <= tol,
    `${what}: expected ${want}, got ${got}`,
);

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`numpad container query @ ${geometry.name} (${geometry.width}×${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

        const mounted = (fn) => browser.withPage({ geometry }, async (page) => {
            await page.mount(MARKUP, MODULE);
            await page.evalFn((table) => {
                const np = document.getElementById('np');
                np.limits = table;
                np.open = true;
                return true;
            }, BENGLE);
            await page.settle(4);
            assert.deepEqual(page.pageErrors, [], 'the keypad must mount without throwing');

            /* ARMED, ASSERTED — finding c-modality-3. Priming `limits` is the only
             * route to a bound (`ui-numeric-keypad.js:219`); without it the body is the
             * `unavailable` panel and the card is 374px of empty box rather than the
             * 478 every number in this file is written in. The panel's absence is the
             * cheap, direct check that the state under test is the real one. */
            assert.equal(
                await page.eval("(() => !!document.getElementById('np').shadowRoot.getElementById('unavailable'))()"),
                false,
                'the keypad must be ARMED — an unavailable panel means the contract is being measured on an empty box',
            );
            return fn(page);
        });

        /** Re-point the CARD, which is the only input the query has. */
        const setCard = async (page, value) => {
            await page.setStyle('#np', { '--_ui-numpad-inline': value });
            await page.settle(3);
        };

        const stacked = async (page) => {
            const entry = await page.box(ENTRY);
            const pad = await page.box(PAD_COL);
            return pad.y > entry.y + entry.height - 1;
        };

        /**
         * Bring a key into view before touching it. In the narrow branch the stacked
         * card is taller than the 1000×600 floor's block cap, so #18's body scrolls —
         * §4.6's mandatory scroll region doing exactly its job — and a hit-tested CDP
         * click on a key below the fold lands on the card instead. A finger scrolls
         * first; so does this.
         */
        const reveal = async (page, selector) => {
            await page.evalFn((s) => {
                window.__h.need(s).scrollIntoView({ block: 'center', behavior: 'instant' });
                return true;
            }, selector);
            await page.settle(3);
        };

        /* =================================================================
         * 1. THE QUERY IS ON THE DIALOG'S OWN BOX
         * ================================================================= */

        test('the container is the dialog\'s own box: its inline size IS the card\'s inner width',
            () => mounted(async (page) => {
                assert.equal(await page.prop(BODY, 'container-type'), 'inline-size',
                    '§4.6: "Carry that as a container query on the dialog\'s own box"');
                assert.equal(await page.prop('#np', 'container-type'), 'normal',
                    'the host has no box, so it cannot be the container (ui-numeric-keypad.js:328-335)');

                const card = await page.box(NATIVE);
                const cell = await page.box(CELL_BODY);
                const container = await page.box(BODY);

                near(cell.width, card.width, 'the body cell spans the card');
                near(container.width, card.width - 2 * PAD_WIDE,
                    'the container is the card minus the cell\'s two --_ui-dialog-pad insets');

                /* THE SHELL'S HALF OF THE SAME BREAKPOINT, on the same box. Slate's
                 * `max-width: 720px` block is split: `numpad-modal.css:416`'s
                 * 24px → 18px inset is #18's (`ui-dialog.js:612-616`), the stacking is
                 * #53's. Both are container queries; neither is a window query. */
                assert.equal(await page.prop(CELL_BODY, 'padding-left'), `${PAD_WIDE}px`,
                    'above the shell\'s 720px query the inset is --ui-space-5');
                await page.setStyle('#np', { '--_ui-numpad-inline': '700px' });
                await page.settle(3);
                assert.equal(await page.prop(CELL_BODY, 'padding-left'), `${PAD_NARROW}px`,
                    'ui-dialog.js:612-616 — "numpad-modal.css:416 padding 24px -> 18px", as a container query');
                near((await page.box(BODY)).width, 700 - 2 * PAD_NARROW,
                    'and the container narrows by the same 12px');
                await page.setStyle('#np', { '--_ui-numpad-inline': null });
            }));

        test('the threshold is the CONTAINER\'s width, swept across it, and it flips exactly once',
            () => mounted(async (page) => {
                /* SWEPT, NOT ASSERTED AT TWO CARD WIDTHS, because the card width is not
                 * the container width. MEASURED at the 1000×600 floor: in the narrow
                 * branch the stacked card is taller than the block cap, so #18's body
                 * scrolls and the classic scrollbar takes 15px of inline space — a
                 * 620px card gives a 569px container there and a 584px one at bench.
                 * That is the scroll region behaving, not a defect, and it is exactly
                 * why the invariant worth asserting is about the box the query reads:
                 * stacked ⟺ container ≤ 584, whatever the card had to be to get there. */
                const seen = [];
                for (let card = 700; card >= 556; card -= 8) {
                    await setCard(page, `${card}px`);
                    seen.push({
                        card,
                        container: (await page.box(BODY)).width,
                        one: tracks(await page.prop(LAYOUT, 'grid-template-columns')) === 1,
                        stacked: await stacked(page),
                    });
                }
                await setCard(page, null);

                for (const s of seen) {
                    assert.equal(s.one, s.container <= QUERY_MAX + 0.5,
                        `@container (max-width: ${QUERY_MAX}px) is the whole rule: at a ${s.card}px card the `
                        + `container was ${s.container} and the layout was ${s.one ? 'one track' : 'two tracks'}`);
                    assert.equal(s.stacked, s.one, 'one track means the columns are stacked, not overlapping');
                }

                assert.ok(seen.some((s) => s.one), 'the sweep must reach the narrow branch');
                assert.ok(seen.some((s) => !s.one), 'and must start above it');
                const flips = seen.filter((s, i) => i > 0 && s.one !== seen[i - 1].one).length;
                assert.equal(flips, 1, 'one breakpoint, crossed once — §4.6\'s "one real breakpoint"');
            }));

        test('the SHELL\'s own knob moves it too — the box asked is #18\'s, not a private of #53',
            () => mounted(async (page) => {
                /* --_ui-dialog-inline is #18's documented escape hatch
                 * (ui-dialog.js:351-365). If the query read anything other than the
                 * dialog's box, re-pointing the shell would leave the layout alone. */
                assert.equal(await stacked(page), false, 'two columns at the default 820px card');
                await page.setStyle(SHELL, { '--_ui-dialog-inline': cardFor(QUERY_MAX - 40) });
                await page.settle(3);
                assert.equal(await stacked(page), true,
                    'narrowing the DIALOG stacks the body — the container is the dialog\'s box');
                await page.setStyle(SHELL, { '--_ui-dialog-inline': null });
            }));

        /* =================================================================
         * 2. THE OLD APP'S VIEWPORT BREAKPOINT IS DEAD
         * ================================================================= */

        test('not one media rule in this component asks about width or height',
            () => mounted(async (page) => {
                /* The parsed CSSOM of the live shadow root, walked recursively — this
                 * is what the engine actually holds, not what a file says. Slate asked
                 * the window twice (numpad-modal.css:411, :428); the replacement asks
                 * a container, so a width or height media feature anywhere in this
                 * component's styles would be the old breakpoint growing back. */
                const found = JSON.parse(await page.eval(`(() => {
                    const media = [];
                    const containers = [];
                    const walk = (rules) => {
                        for (const rule of rules) {
                            if (rule.media) media.push(rule.conditionText ?? rule.media.mediaText);
                            if (rule.containerQuery !== undefined) containers.push(rule.containerQuery);
                            if (rule.cssRules) walk(rule.cssRules);
                        }
                    };
                    for (const sheet of document.getElementById('np').shadowRoot.adoptedStyleSheets) {
                        walk(sheet.cssRules);
                    }
                    return JSON.stringify({ media, containers });
                })()`));

                const sized = found.media.filter((c) => /width|height/i.test(c));
                assert.deepEqual(sized, [],
                    'ui-numeric-keypad.js:239 — "No @media (width…); the one carried breakpoint is a '
                    + 'container query on this component\'s own body box"');
                assert.ok(found.containers.length >= 1,
                    'and the breakpoint that DID survive is a container query');
                for (const q of found.containers) {
                    assert.match(q, /width/i, `a container query on the block axis is not expressible here: ${q}`);
                    assert.doesNotMatch(q, /height/i,
                        'section 4: the block-axis branch needs container-type: size, which collapses the card');
                }
            }));

        test('a window inside Slate\'s ≤720px branch does NOT stack the card by itself',
            () => mounted(async (page) => {
                /* An adversarial probe at Slate's own number, not a new standard
                 * geometry: `numpad-modal.css:411` stacked the whole overlay at any
                 * window ≤ 720px. Here the window reaches the query only through #18's
                 * inline-size clamp, and at 700px the clamp still leaves a card wider
                 * than the threshold — so the layout does not move. Restored before
                 * the test returns. */
                const probe = { name: 'slate-720-probe', width: 700, height: geometry.height, deviceScaleFactor: 1, mobile: false };
                try {
                    await page.setGeometry(probe);
                    await page.settle(4);
                    const space6 = parseFloat(await page.resolveValue('var(--ui-space-6)', 'width'));
                    const card = await page.box(NATIVE);
                    near(card.width, probe.width - 2 * space6,
                        'the card is clamped by the shell, which is the window\'s only route in');
                    const container = await page.box(BODY);
                    assert.ok(container.width > QUERY_MAX,
                        `the container is ${container.width}, still above ${QUERY_MAX}`);
                    assert.equal(await stacked(page), false,
                        'Slate stacked here on the window alone; the container query does not');
                } finally {
                    await page.setGeometry(geometry);
                    await page.settle(3);
                }
            }));

        /* =================================================================
         * 3. BOTH BRANCHES, RUN — the ones the bench tablet never reaches
         * ================================================================= */

        test('WIDE branch: two tracks, the seam is a column gap and there is no row gap',
            () => mounted(async (page) => {
                const seam = await page.resolveValue('var(--ui-seam)', 'column-gap');
                assert.equal(tracks(await page.prop(LAYOUT, 'grid-template-columns')), 2);
                assert.equal(await page.prop(LAYOUT, 'column-gap'), seam, 'the rule between the columns');
                assert.equal(await page.prop(LAYOUT, 'row-gap'), '0px', 'a column rule only');

                const entry = await page.box(ENTRY);
                const pad = await page.box(PAD_COL);
                assert.ok(pad.x > entry.x + entry.width - 1, 'side by side');
                near(pad.x, entry.right + parseFloat(seam), 'and the gap between them is one seam');
            }));

        test('NARROW branch: one track, the seam becomes a row gap and the insets swap axis',
            () => mounted(async (page) => {
                await setCard(page, cardFor(QUERY_MAX - 100));
                const seam = await page.resolveValue('var(--ui-seam)', 'row-gap');
                const space5 = await page.resolveValue('var(--ui-space-5)', 'padding-top');

                assert.equal(tracks(await page.prop(LAYOUT, 'grid-template-columns')), 1);
                assert.equal(await page.prop(LAYOUT, 'row-gap'), seam,
                    'ui-numeric-keypad.js:410-412 — .layout.seam-cols is (0,2,0), so the row gap is re-stated');
                assert.equal(await page.prop(ENTRY, 'padding-inline-end'), '0px',
                    'the entry column gives up its inline inset');
                assert.equal(await page.prop(ENTRY, 'padding-block-end'), space5, 'and takes a block one');
                assert.equal(await page.prop(PAD_COL, 'padding-inline-start'), '0px');
                assert.equal(await page.prop(PAD_COL, 'padding-block-start'), space5);

                const entry = await page.box(ENTRY);
                const pad = await page.box(PAD_COL);
                near(pad.y, entry.bottom + parseFloat(seam), 'stacked, one seam apart');
                await setCard(page, null);
            }));

        test('NARROW branch loses nothing: twelve keys, 3 × 4, the hit floor and an unclipped ring',
            () => mounted(async (page) => {
                await setCard(page, cardFor(QUERY_MAX - 100));

                const boxes = await page.evalFn(() => [...document.getElementById('np')
                    .shadowRoot.querySelectorAll('.key')]
                    .map((el) => {
                        const r = el.getBoundingClientRect();
                        return { id: el.id, x: Math.round(r.x), y: Math.round(r.y) };
                    }));
                assert.equal(boxes.length, 12, 'every key survives the compaction');
                assert.equal(new Set(boxes.map((b) => b.x)).size, 3, 'three columns');
                assert.equal(new Set(boxes.map((b) => b.y)).size, 4, 'four rows');

                /* Slate's narrow branch shrank its 88px rows to 62px. This build's key
                 * is #15's face at --ui-hit-min and does not shrink at all — "a wet
                 * fingertip is about 9 mm" (slate-tokens.css:99-102). The floor is read
                 * off the FACE, which is where #15 draws its ::before overlay. */
                await reveal(page, KEY_1);
                await assertHitFloor(page, KEY_1_FACE);
                await assertFocusUnclipped(page, KEY_1);
                await setCard(page, null);
            }));

        /* =================================================================
         * 4. SLATE'S SHORT BRANCH — the numbers behind the deferred question
         * ================================================================= */

        test('the card never reaches its block cap at either Gate A geometry — the short branch has nothing to do',
            () => mounted(async (page) => {
                const space5 = parseFloat(await page.resolveValue('var(--ui-space-5)', 'width'));
                const card = await page.box(NATIVE);
                const cap = geometry.height - 2 * space5;

                assert.ok(card.height < cap - 1,
                    `the card is ${card.height} against a cap of ${cap} — it is not the short case`);
                /* CITE modal-numpad .numpad-modal-container [i=166] rect w=820 h=545.
                 * Slate needed the 650px branch because its card was 545 tall; this one
                 * is smaller because the key face is #15's 48px, not Slate's 88px. */
                assert.ok(card.height < 545,
                    `the compaction Slate's short branch bought is already spent: ${card.height} < 545`);

                const m = await page.metrics(CELL_BODY);
                assert.ok(m.scrollHeight <= m.clientHeight + 0.5,
                    'and nothing is scrolling, so nothing is hidden by the card fitting');
            }));

        test('a genuinely short box is answered by the body scrolling, not by a second query',
            () => mounted(async (page) => {
                const head = await page.box(HEAD);
                const acts = await page.box(ACTIONS);
                const seam = parseFloat(await page.resolveValue('var(--ui-seam)', 'width'));
                const cap = `${Math.round(head.height + acts.height + 2 * seam + 96)}px`;

                await assertScrollFloor(page, {
                    selector: CELL_BODY,
                    squeezeSelector: NATIVE,
                    squeeze: { 'max-block-size': cap },
                });

                await page.setStyle(NATIVE, { 'max-block-size': cap });
                await page.settle(3);
                assert.equal(tracks(await page.prop(LAYOUT, 'grid-template-columns')), 2,
                    'the inline branch is not fired by a short box — the two questions stay separate');
                near((await page.box(HEAD)).height, head.height, 'the header does not surrender');
                near((await page.box(ACTIONS)).height, acts.height, 'nor does the footer');
                await page.setStyle(NATIVE, { 'max-block-size': null });
            }));

        /* =================================================================
         * 5. THE PORT CHECKLIST, INSIDE THE BRANCH NOTHING ELSE REACHES
         * ================================================================= */

        test('O9: the backspace keeps its accessible name in both branches',
            () => mounted(async (page) => {
                const nameOf = () => page.evalFn(
                    (s) => window.__h.need(s).getAttribute('aria-label'), KEY_BACKSPACE,
                );
                const glyphHidden = () => page.evalFn(
                    (s) => window.__h.need(s).getAttribute('aria-hidden'),
                    '#np >>> #key-backspace ui-keycap >>> #glyph',
                );

                const wide = await nameOf();
                assert.ok(wide && wide.trim().length > 0,
                    'O9: "an unlabelled <svg>, not even aria-hidden" — the pressable must have a name');
                assert.equal(await glyphHidden(), 'true');

                await setCard(page, cardFor(QUERY_MAX - 100));
                assert.equal(await stacked(page), true, 'the fixture must actually be in the narrow branch');
                assert.equal(await nameOf(), wide, 'and the name is the same one after the compaction');
                assert.equal(await glyphHidden(), 'true');
                await setCard(page, null);
            }));

        test('O9: the readout stays a live region across the branch, and still announces',
            () => mounted(async (page) => {
                await setCard(page, cardFor(QUERY_MAX - 100));
                assert.equal(await stacked(page), true);

                const shape = await page.evalFn((s) => {
                    const el = window.__h.need(s);
                    return {
                        role: el.getAttribute('role'),
                        live: el.getAttribute('aria-live'),
                        atomic: el.getAttribute('aria-atomic'),
                        children: el.children.length,
                    };
                }, DISPLAY);
                assert.deepEqual(shape, { role: 'status', live: 'polite', atomic: 'true', children: 0 },
                    'O9: "the display is updated by innerHTML with no aria-live"');

                const before = await page.evalFn((s) => window.__h.need(s).textContent, DISPLAY);
                await reveal(page, KEY_BACKSPACE);
                await page.click(KEY_BACKSPACE);
                await page.settle(3);
                const after = await page.evalFn((s) => window.__h.need(s).textContent, DISPLAY);
                assert.notEqual(after, before, 'a press in the compacted layout still reaches the readout');
                await setCard(page, null);
            }));

        test('O10: the heading is token-sized in both branches, and the drill proves it',
            () => mounted(async (page) => {
                const wide = await page.prop(TITLE, 'font-size');

                await setCard(page, cardFor(QUERY_MAX - 100));
                assert.equal(await stacked(page), true);
                assert.equal(await page.prop(TITLE, 'font-size'), wide,
                    'O10: "writes an inline 28px unconditionally ... and shrinks to a 16px floor" — '
                    + 'the compaction must not re-open the fit loop');
                await assertTokenDrill(page, {
                    token: '--ui-text-xl',
                    value: DRILL_LENGTH,
                    selector: TITLE,
                    property: 'font-size',
                });
                assert.equal(
                    await page.evalFn((s) => window.__h.need(s).getAttribute('style'), TITLE),
                    null,
                    'O10: "writes an inline 28px" — the heading carries no inline style in either branch',
                );
                await setCard(page, null);
            }));
    });
}
