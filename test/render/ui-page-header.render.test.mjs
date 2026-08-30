/**
 * ui-page-header.render.test.mjs — Gate A for component #31 (wave 2, item #31).
 *
 * Runs the whole rig at BOTH standard geometries — 1281×801 @ dsf 1.5 (the bench
 * truth) and the 1000×600 floor — asserting only on computed style, box geometry and
 * behaviour, never on source text (Part 8 §2).
 *
 * ONE THING TO KNOW BEFORE READING THE NUMBERS. The two Gate A geometries land on
 * OPPOSITE SIDES of the compact height band: `@media (height < 700px) { :root {
 * --ui-density: 0.875 } }` (styles/tokens.css:929-940), so --ui-band-h is 118px at
 * BENCH (801px tall) and 103.25px at FLOOR (600px tall). That is not a wrinkle to work
 * around — it is the density band doing its job, and this suite is the first place in
 * the tree where it is exercised at both ends. Every band-height assertion below is
 * therefore written against `bandH`, derived from the page's own --ui-density, and the
 * oracle's flat 118px is pinned separately with density forced to 1.
 *
 * THE STANDING CLASSES, and where each lives below:
 *   1. token drill — nine tokens, every one retargeted on :root with the rendered
 *      value asserted to move AND to land on the token. --ui-space-6 gets the loudest
 *      one, because the defect this component retires is a band whose inset was a
 *      literal;
 *   2. THE DERIVATION DRILL — --ui-control-lg, --ui-band-inset and --ui-density each
 *      moved separately, with the band height following. Appendix 12's "a size
 *      expressed as control + 2 × space, not a measured constant" as three numbers;
 *   3. focus geometry from --ui-focus-*, unclipped — on both commit buttons and on
 *      slotted controls in all three regions. A band of controls is bug L24's shape;
 *   4. container behaviour — the band reads its own container and never the viewport
 *      (a 640px container renders identically at 1281 and at 1000), keeps its floor
 *      when squeezed, and gives the title before it gives the actions;
 *   5. the bug, asserted dead: P17 (the 30px inset, off scale and disagreeing with
 *      itself by 2px) — one inset, on the scale, with no per-screen surface at all;
 *   6. the decision, asserted owned: D11 ("Save (3)"), including the half that makes
 *      it a decision — that no screen can express any other wording;
 *   7. WAVE LAW — this component paints no selection, and cannot. The four dials are
 *      retargeted on :root and nothing in this shadow tree moves.
 *
 * ORACLE VALUES ARE ASSERTED LITERALLY where the serialisation is stable. Every
 * literal below carries its CITE line.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';
import {
    assertTokenDrill,
    assertFocusUnclipped,
    DRILL_COLOUR,
} from '../harness/assertions.js';

/* ui-button (#1) is a real dependency, not a stand-in: #31's dependsOn is "#1, #2,
 * band tokens" and the commit cluster COMPOSES the primitive rather than
 * re-implementing it. Wave 1 is closed (waves/1/DONE.json, result OK), so this is a
 * frozen dependency rather than a sibling builder's moving target. */
const MODULE = ['/src/components/ui-page-header.js'];

/* Slotted focusables with the base's own ring re-created in the LIGHT tree, so the L24
 * assertions have something to focus that this component did not build. Written here
 * rather than by slotting a second ui-* component, for the reason wave 1 gave: a suite
 * that leans on another entry goes red when that entry moves. */
const FIXTURE_CSS = `
<style>
    .child:focus-visible {
        outline: var(--ui-focus-w) solid var(--ui-steel);
        outline-offset: var(--_ui-focus-offset, var(--ui-focus-offset));
    }
    button.child { margin: 0; padding: 0 18px; border: 0; background: none; font: inherit;
                   block-size: 82px; color: inherit; }

    /* THE SCREEN GRID, from LAYOUT_SPEC_DRAFT.md:519-525 — the band is row 1 and the
     * gap below it IS the header underline (departure 2). Written by hand rather than
     * with the seam utility so this suite depends on nothing but the component. */
    .screen {
        display: grid;
        grid-template-rows: var(--ui-band-h) minmax(0, 1fr);
        gap: var(--ui-seam);
        background: var(--ui-line-strong);
        block-size: 320px;
    }
    .screen > .body { background: var(--ui-fascia); }

    /* THE P17 ATTACK SHEET — the SELECTOR half. Every selector Slate's own three sheets
     * use to reach a page header, plus three ways a screen might try to reach a Lit
     * component. All of them are legal CSS and none can cross a shadow boundary — which
     * is the point. The TOKEN half of the attack is not here, because it works: it is
     * applied per test in "the one reachable path is the token channel", and asserting
     * it live for the whole file would move the inset under every other test. */
    #subpage-header, .slate-editor-header, .slate-live-header { padding: 0 30px; }
    ui-page-header .band { padding-inline: 30px; }
    ui-page-header * { padding-inline: 30px; }
    ui-page-header::part(band) { padding-inline: 30px; }

    /* #2's WIDENING HOOK, both halves, live throughout (review finding c3-4 — nothing
     * exercised this before). The first two name the commit cluster inside the shadow
     * root and can never land; the third names a SLOTTED control in the consumer's own
     * light tree and must land. Which is which is the whole content of the hook. */
    ui-page-header ui-button.header-action { inline-size: 96px; }
    ui-page-header::part(header-action) { inline-size: 96px; }
    #editor-wide.header-action { inline-size: 96px; }

    /* A second reader of --ui-space-6 on the same screen, for the blast-radius half of
     * the token-channel test: a per-screen retarget is not a per-band knob. */
    .inset-probe { padding-inline: var(--ui-space-6); }
</style>`;

const MARKUP = `${FIXTURE_CSS}
<div id="screen-a" class="screen" style="inline-size: 900px">
    <ui-page-header id="settings" heading="Settings" commit change-count="3"></ui-page-header>
    <div class="body"><div id="probe-a" class="inset-probe"></div></div>
</div>

<div id="screen-b" class="screen" style="inline-size: 900px">
    <ui-page-header id="clean" heading="Settings" commit change-count="0"></ui-page-header>
    <div class="body"></div>
</div>

<div id="screen-c" class="screen" style="inline-size: 900px">
    <ui-page-header id="editor" heading="Profile editor">
        <div slot="centre" id="tabs" style="display:flex; gap:8px">
            <button class="child is-selected" id="tab-1" aria-selected="true">Steps</button>
            <button class="child" id="tab-2" aria-selected="false">Review</button>
        </div>
        <div slot="trail" id="editor-actions" style="display:flex; gap:24px">
            <button class="child" id="editor-exit">Exit</button>
        </div>
        <button class="child header-action" slot="trail" id="editor-wide">Wide</button>
    </ui-page-header>
    <div class="body"><div id="probe-c" class="inset-probe"></div></div>
</div>

<div id="screen-d" class="screen" style="inline-size: 900px">
    <ui-page-header id="live" layout="centre" banner>
        <button class="child" slot="lead" id="library">Profiles</button>
        <div slot="centre" id="bank" style="display:flex; gap:8px; min-inline-size:0">
            <button class="child" id="fav-1" aria-pressed="true">One</button>
            <button class="child" id="fav-2" aria-pressed="false">Two</button>
        </div>
        <button class="child" slot="trail" id="sleep">Sleep</button>
    </ui-page-header>
    <div class="body"></div>
</div>

<div id="screen-e" class="screen" style="inline-size: 900px">
    <ui-page-header id="fallback" heading="Fallback" layout="Nope"></ui-page-header>
    <div class="body"></div>
</div>

<div id="squeeze-holder" style="inline-size: 900px">
    <ui-page-header id="squeeze" heading="A profile name long enough that the band has to decide what gives first" commit change-count="12"></ui-page-header>
</div>

<div id="fixed-holder" style="inline-size: 640px">
    <ui-page-header id="fixed" heading="Settings" commit change-count="3"></ui-page-header>
</div>

<div id="dialog-holder" role="dialog" aria-label="Settings" style="inline-size: 900px">
    <ui-page-header id="in-dialog" heading="Settings" commit change-count="0"></ui-page-header>
</div>
`;

/* The oracle's own numbers, named once.
 *   CITE settings-display-skin #subpage-header [i=2] height = 118px  <- slate-shell.css
 *        `#subpage-host #subpage-header` authored `var(--slate-header-height)`
 *        !important=no (token-driven)
 *   CITE settings-display-skin #subpage-header [i=2] background-color = rgb(17, 22, 26)
 *        <- the same rule, authored `(NOT CAPTURED — set via a CSS shorthand)`
 *        (token-driven)   [prov-light rgb(250, 250, 250)]
 *   CITE settings-display-skin #subpage-header [i=2] padding-left = 30px <- the same
 *        rule, authored `30px` !important=no (FROZEN/hardcoded)      ← BUG P17
 *   CITE editor-steps .slate-editor-header [i=2] padding-left = 30px <-
 *        profile-editor-v3.css `.slate-editor-header` authored `30px` (FROZEN)   ← P17
 *   CITE editor-steps .slate-editor-header [i=2] gap = normal 18px <- (no declaration)
 *   CITE settings-display-skin #page_title [i=3] font-size = 28px / font-weight = 500 /
 *        color = rgb(244, 247, 248)  <- slate-shell.css `#subpage-host #subpage-header
 *        #page_title` authored `var(--slate-text-xl)` / `500` / `var(--slate-text)`
 *   CITE settings-display-skin #save-settings-btn [i=4] height = 82px <- slate-shell.css
 *        `#subpage-host #subpage-header button:not(#fullscreen-toggle-btn), …`
 *        authored `var(--slate-control-lg)` !important=no (token-driven)
 *   CITE settings-display-skin #save-settings-btn [i=4] rect x=1722 y=18 w=168 h=82
 *        in a 1920×118 band → 18 + 82 + 18 = 118, Appendix 12's derivation.
 */
const ORACLE = {
    bandH: 118,        // at --ui-density 1; the compact band is 103.25 (tokens.css:182)
    controlLg: 82,
    bandInset: 18,     // the derived block inset — never declared, always measured
    slateInset: 30,    // P17, the defect
    inset: 28,         // --ui-space-6, the fix (spec §3.3 "30 → 28")
    regionGap: 18,     // --ui-space-4, the editor header's own column-gap
    clusterGap: 24,    // --ui-space-5, §3.3's snap of Slate's compiled 22.5px
    titleSize: 28,
    titleWeight: '500',
    dark: { bar: 'rgb(17, 22, 26)', text: 'rgb(244, 247, 248)' },
    light: { bar: 'rgb(250, 250, 250)', text: 'rgb(23, 26, 28)' },
};

/** At dsf 1.5 lengths snap to device pixels, so compare whole CSS px (CONVENTIONS §10). */
const near = (got, want, what, tol = 0.6) => assert.ok(
    Math.abs(parseFloat(got) - want) <= tol,
    `${what}: expected ~${want}px, rendered ${got}`,
);

/**
 * THE COMPUTED ARIA ROLE of a host's #band, from Chrome's own accessibility tree.
 *
 * Review finding c3-2: the attribute is not the property departure 3 claims. A bare
 * <header> has the IMPLICIT role `banner` unless it descends from article/aside/main/
 * nav/section or role=article/complementary/main/navigation/region — role="dialog" is
 * on none of those lists — so `getAttribute('role') === null` cannot fail for the thing
 * being asserted. This reads what a screen reader would be told instead. Still computed
 * state and not source text (Part 8 §2); it is simply a different computed surface.
 */
const axRoleOf = async (page, hostId) => {
    await page.send('Accessibility.enable');
    const handle = await page.send('Runtime.evaluate', {
        expression: `document.getElementById(${JSON.stringify(hostId)})`
            + '.shadowRoot.getElementById("band")',
        returnByValue: false,
    });
    const tree = await page.send('Accessibility.queryAXTree', {
        objectId: handle.result.objectId,
    });
    const node = tree.nodes[0];
    return { role: node?.role?.value ?? null, ignored: node?.ignored ?? null };
};

/** The rendered text of a deep-selected element, trimmed. */
const textOf = (page, selector) => page.evalFn((sel) => {
    const el = window.__h.q(sel);
    return el ? el.textContent.trim() : null;
}, selector);

/** The page's own --ui-density, so a band-height expectation is derived here the same
 *  way the token derives it there rather than restated per geometry. */
const densityOf = async (page) => parseFloat(await page.tokenValue('--ui-density'));

/** Every element inside a host's shadow tree, with everything selection could paint.
 *  Used by the wave-law assertion: "no private selected look anywhere in this wave". */
const shadowPaint = (page, hostId) => page.evalFn((id) => {
    const root = document.getElementById(id).shadowRoot;
    return [...root.querySelectorAll('*')].map((el) => {
        const cs = getComputedStyle(el);
        return {
            tag: el.localName,
            id: el.id,
            background: cs.backgroundColor,
            colour: cs.color,
            boxShadow: cs.boxShadow,
            textShadow: cs.textShadow,
        };
    });
}, hostId);

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`ui-page-header @ ${geometry.name} (${geometry.width}×${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

        const mounted = (fn) => browser.withPage({ geometry }, async (page) => {
            await page.mount(MARKUP, MODULE);
            assert.deepEqual(page.pageErrors, [], 'ui-page-header must mount without throwing');
            return fn(page);
        });

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

        test('the density band is the one this geometry sits in', () => mounted(async (page) => {
            // styles/tokens.css:929-940 — "@media (height < 700px) { :root {
            // --ui-density: 0.875 } }". BENCH is 801 tall and FLOOR is 600, so the two
            // Gate A geometries are on opposite sides of the band. Stated here once so
            // every band-height number below reads as derived rather than fudged.
            assert.equal(await densityOf(page), geometry.height < 700 ? 0.875 : 1);
        }));

        /* ================================================================
         * 0. THE BAND ITSELF — the one number three sheets already agree on
         * ============================================================== */

        test('the band is --ui-band-h, and the host cannot be squashed below it', () => mounted(async (page) => {
            // CITE settings-display-skin #subpage-header [i=2] height = 118px
            // `find --cls slate-live-header` → 7 elements in 7 states, all 1920×118;
            // `find --id subpage-header` → 39 in 39, all 1920×118;
            // `find --cls slate-editor-header` → 3 in 3, all 1920×118.
            // One height, three sheets — the agreement worth keeping.
            const bandH = ORACLE.bandH * await densityOf(page);
            for (const id of ['settings', 'clean', 'editor', 'live', 'fallback']) {
                near((await page.box(`#${id}`)).height, bandH, `#${id} host`);
                near((await page.box(`#${id} >>> #band`)).height, bandH, `#${id} band`);
            }
        }));

        test('the ground is --ui-bar, and nothing else paints it', () => mounted(async (page) => {
            // CITE settings-display-skin #subpage-header [i=2] background-color =
            //      rgb(17, 22, 26)  [prov-light rgb(250, 250, 250)]  = --ui-bar
            await assertTokenDrill(page, {
                token: '--ui-bar',
                value: DRILL_COLOUR,
                selector: '#settings >>> #band',
                property: 'background-color',
            });
        }));

        /* ================================================================
         * 1. P17 — THE 30px INSET, AND WHY IT CANNOT COME BACK
         * ============================================================== */

        test('P17: the inline inset is 28px, on the scale, and identical on both edges', () => mounted(async (page) => {
            // THE DEFECT, quoted (LAYOUT_SPEC_DRAFT.md:1146): "The page header's
            // `padding: 0 30px` is off the spacing scale and disagrees with the 28px
            // used by the History Viewer header and `#right-panel > *` on the same
            // screens."
            //   CITE settings-display-skin #subpage-header [i=2] padding-left = 30px <-
            //        slate-shell.css `#subpage-host #subpage-header` authored `30px`
            //        !important=no (FROZEN/hardcoded)
            //   CITE editor-steps .slate-editor-header [i=2] padding-left = 30px <-
            //        profile-editor-v3.css `.slate-editor-header` authored `30px`
            //        !important=no (FROZEN/hardcoded)
            // and the 28px it disagrees with, read read-only because the HV overlay is
            // not a corpus state: slate-live.css:2210 `padding: 0 var(--slate-space-6)`.
            // spec §3.3: "off-scale values snap to the nearest step. 30 → 28".
            for (const id of ['settings', 'clean', 'editor', 'live', 'fallback']) {
                const pad = await page.computed(`#${id} >>> #band`,
                    ['padding-left', 'padding-right']);
                near(pad['padding-left'], ORACLE.inset, `#${id} padding-left`);
                near(pad['padding-right'], ORACLE.inset, `#${id} padding-right`);
                assert.equal(pad['padding-left'], pad['padding-right'],
                    `#${id}: the two edges of one band must be one value — P17 is 2px of drift`);
                assert.notEqual(parseFloat(pad['padding-left']), ORACLE.slateInset,
                    `#${id}: the off-scale 30px is back`);
            }
        }));

        test('P17: the inset is --ui-space-6, so it moves with the whole scale', () => mounted(async (page) => {
            const drill = await assertTokenDrill(page, {
                token: '--ui-space-6',
                value: '37px',
                selector: '#settings >>> #band',
                property: 'padding-left',
            });
            near(drill.before, ORACLE.inset, 'the resting inset is the scale step, not 30px');
            // …and the far edge reads the same token, not a second declaration.
            const far = await assertTokenDrill(page, {
                token: '--ui-space-6',
                value: '37px',
                selector: '#settings >>> #band',
                property: 'padding-right',
            });
            near(far.before, ORACLE.inset, 'the far edge reads the same token');
        }));

        test('P17: the one reachable path is the token channel, and it is not a per-band knob',
            () => mounted(async (page) => {
                // REVIEW FINDING c3-1. The six-selector attack sheet below is real but it
                // is not the whole attack surface: custom properties INHERIT through a
                // shadow boundary — that is A6, the library's only theming channel — so a
                // screen sheet CAN reach this inset by retargeting --ui-space-6 on an
                // ancestor. The component cannot defend either: re-declaring --ui-space-6
                // on :host is what scripts/guards.js `private-palette` forbids.
                //
                // So the honest claim is not "unreachable", it is "not private and not
                // per-band", and both halves are asserted here.
                const insetOf = async (id) =>
                    (await page.computed(`#${id} >>> #band`, ['padding-left']))['padding-left'];

                near(await insetOf('settings'), ORACLE.inset, 'the resting inset');
                near((await page.computed('#probe-a', ['padding-left']))['padding-left'],
                    ORACLE.inset, 'and the probe on the same screen reads the same token');

                // THE PATH IS REAL. This is P17's exact 2px, bought per screen.
                await page.setStyle('#screen-a', { '--ui-space-6': '30px' });
                try {
                    near(await insetOf('settings'), ORACLE.slateInset,
                        'the token channel must really reach the band — if this passes at 28 '
                        + 'the test is asserting the wrong mechanism');

                    // THE BLAST RADIUS IS THE PRICE. The same declaration moved every
                    // --ui-space-6 in that subtree, not just the band: a 2px header drift
                    // cannot be bought without visibly paying for it everywhere on the
                    // screen. That is what "on the scale" means.
                    near((await page.computed('#probe-a', ['padding-left']))['padding-left'],
                        ORACLE.slateInset,
                        'the retarget must move every reader of the token in that subtree');

                    // AND IT IS SCOPED, so it is a screen author's deliberate act rather
                    // than a leak: the editor band on another screen has not moved.
                    near(await insetOf('editor'), ORACLE.inset,
                        'a retarget on one screen must not reach another');
                    near((await page.computed('#probe-c', ['padding-left']))['padding-left'],
                        ORACLE.inset, 'nor that screen\'s other readers');
                } finally {
                    await page.setStyle('#screen-a', { '--ui-space-6': null });
                }
                near(await insetOf('settings'), ORACLE.inset, 'and it comes back');
            }));

        test('P17 cannot express: no SELECTOR from outside reaches the inset', () => mounted(async (page) => {
            // FIXTURE_CSS carries every selector Slate's three sheets use for a page
            // header, plus `ui-page-header .band`, `ui-page-header *` and a ::part()
            // attempt — six live rules, all authoring the defect's own `30px`. None can
            // cross the boundary; the component exposes no ::part and puts no --_ui-*
            // hook in front of the inset, so there is nothing to inherit into either.
            // The TOKEN channel is the one path that does land, and it has its own test
            // directly above — this one is about selectors.
            for (const id of ['settings', 'editor', 'live']) {
                near((await page.computed(`#${id} >>> #band`, ['padding-left']))['padding-left'],
                    ORACLE.inset, `#${id}: a screen sheet moved the inset`);
            }
            // The HOST's own padding is the consumer's box and stays theirs — but it
            // does not become the band's inset, which is the distinction P17 lost.
            await page.setStyle('#settings', { 'padding-inline': '30px' });
            near((await page.computed('#settings >>> #band', ['padding-left']))['padding-left'],
                ORACLE.inset, 'host padding must not leak into the band inset');
            await page.setStyle('#settings', { 'padding-inline': null });
        }));

        test('P17 cannot express: three configurations are one implementation', () => mounted(async (page) => {
            // "Three implementations across four screens today, disagreeing by 2px on
            // inset within a single screen" (SCOPE.md:1551). Here the settings band, the
            // editor band and the Live band are three USES of one element, so the
            // measurement that differed is now one declaration read three times.
            const insets = [];
            for (const id of ['settings', 'editor', 'live']) {
                const pad = await page.computed(`#${id} >>> #band`, ['padding-left', 'padding-right']);
                insets.push(pad['padding-left'], pad['padding-right']);
            }
            assert.equal(new Set(insets).size, 1,
                `six edges across three bands must be one value, measured ${insets.join(' / ')}`);
        }));

        /* ================================================================
         * 2. THE DERIVATION — Appendix 12, as four numbers
         * ============================================================== */

        test('the 18px block inset is DERIVED, never declared', () => mounted(async (page) => {
            // CITE settings-display-skin #save-settings-btn [i=4] rect x=1722 y=18
            //      w=168 h=82, inside a 1920×118 band → 18 + 82 + 18 = 118.
            // Appendix 12: "the derived header band — a size expressed as control +
            // 2 × space, not a measured constant".
            // Density is forced to 1 so the oracle's own arithmetic is checked at BOTH
            // geometries rather than only at the one that happens to sit above 700px.
            await page.setToken('--ui-density', '1');
            const band = await page.box('#settings >>> #band');
            const save = await page.box('#settings >>> #save');
            await page.setToken('--ui-density', null);

            near(band.height, ORACLE.bandH, 'the band is the oracle 118px at density 1');
            near(save.height, ORACLE.controlLg, 'the save button is --ui-control-lg');
            near(save.top - band.top, ORACLE.bandInset, 'the top inset falls out of centring');
            near(band.bottom - save.bottom, ORACLE.bandInset, 'and so does the bottom one');

            // The band declares no block padding at all, which is what makes the above a
            // consequence rather than a coincidence.
            const pad = await page.computed('#settings >>> #band', ['padding-top', 'padding-bottom']);
            assert.equal(parseFloat(pad['padding-top']), 0, 'no declared block padding');
            assert.equal(parseFloat(pad['padding-bottom']), 0, 'no declared block padding');
        }));

        test('derivation drill: --ui-control-lg moves the band height', () => mounted(async (page) => {
            const density = await densityOf(page);
            const drill = await assertTokenDrill(page, {
                token: '--ui-control-lg',
                value: '100px',
                selector: '#settings >>> #band',
                property: 'height',
                expectLanding: false,
            });
            near(drill.before, ORACLE.bandH * density, 'the resting band');
            near(drill.after, (100 + 2 * ORACLE.bandInset) * density,
                'band-h = (control-lg + 2 × band-inset) × density');
        }));

        test('derivation drill: --ui-band-inset moves the band height', () => mounted(async (page) => {
            const density = await densityOf(page);
            const drill = await assertTokenDrill(page, {
                token: '--ui-band-inset',
                value: '30px',
                selector: '#settings >>> #band',
                property: 'height',
                expectLanding: false,
            });
            near(drill.after, (ORACLE.controlLg + 60) * density,
                'band-h = (control-lg + 2 × band-inset) × density');
        }));

        test('derivation drill: --ui-density shrinks the BAND and not the CONTROL', () => mounted(async (page) => {
            // tokens.css:180-189 — density multiplies vertical rhythm only; "NOT
            // multiplied, deliberately: --ui-control-h and --ui-hit-min (Rule 2 names
            // both — ergonomics is physical)". That asymmetry is also why the band
            // CENTRES rather than padding: a declared padding-block of --ui-band-inset
            // would leave 67.25px of content box for an 82px control in the compact band.
            await page.setToken('--ui-density', '1');
            const regular = {
                band: (await page.box('#settings >>> #band')).height,
                save: (await page.box('#settings >>> #save')).height,
            };
            await page.setToken('--ui-density', '0.75');
            const compact = {
                band: (await page.box('#settings >>> #band')).height,
                save: (await page.box('#settings >>> #save')).height,
                top: (await page.box('#settings >>> #save')).top
                    - (await page.box('#settings >>> #band')).top,
            };
            await page.setToken('--ui-density', null);

            near(regular.band, ORACLE.bandH, 'regular band');
            near(compact.band, ORACLE.bandH * 0.75, 'the band lost height with the density');
            near(compact.save, ORACLE.controlLg, 'the control is physical and did not');
            near(regular.save, compact.save, 'the control did not move with the density band');
            assert.ok(compact.band >= compact.save,
                `the compact band (${compact.band}) must still hold an ${compact.save}px control`);
            assert.ok(compact.top >= 0,
                'the control centres inside the shorter band rather than overflowing it');
        }));

        /* ================================================================
         * 3. THE REST OF THE TOKEN DRILLS — consumed, not copied
         * ============================================================== */

        test('drill: --ui-space-4 is the gap BETWEEN regions', () => mounted(async (page) => {
            // CITE editor-steps .slate-editor-header [i=2] gap = normal 18px  <-  (no
            //      declaration — inherited or initial value)  (FROZEN/hardcoded);
            //      authored `column-gap: 18px` at profile-editor-v3.css:99.
            const drill = await assertTokenDrill(page, {
                token: '--ui-space-4',
                value: '37px',
                selector: '#settings >>> #band',
                property: 'column-gap',
            });
            near(drill.before, ORACLE.regionGap, 'the resting region gap is the oracle 18px');
        }));

        test('drill: --ui-space-5 is the gap WITHIN a region', () => mounted(async (page) => {
            // Slate's cluster gap is `gap-[22.5px]` (settings.html:9), and it DOES
            // compile — `app.css .gap-\[22\.5px\]{gap:22.5px}`, verified read-only; it
            // is the 22.5px TYPE literal that never compiles, not this one. Off scale,
            // so §3.3 snaps it to the nearest step: 22.5 → 24.
            const drill = await assertTokenDrill(page, {
                token: '--ui-space-5',
                value: '37px',
                selector: '#settings >>> #trail',
                property: 'column-gap',
            });
            near(drill.before, ORACLE.clusterGap, 'the resting cluster gap is the snapped 24px');
            // A cluster reads as a cluster: within > between, so the eye groups the two
            // commit buttons before it groups them with the centre track.
            assert.ok(ORACLE.clusterGap > ORACLE.regionGap,
                'the within-region gap must exceed the between-region gap');
        }));

        test('drill: the title is .ui-title, and all three of its values are tokens', () => mounted(async (page) => {
            // CITE settings-display-skin #page_title [i=3] font-size = 28px <-
            //      slate-shell.css `#subpage-host #subpage-header #page_title` authored
            //      `var(--slate-text-xl)` !important=no (token-driven)
            // CITE …[i=3] font-weight = 500  <- the same rule, authored `500`
            //      !important=no (FROZEN/hardcoded)
            // CITE …[i=3] color = rgb(244, 247, 248)  <- the same rule, authored
            //      `var(--slate-text)`   [prov-light rgb(23, 26, 28)]
            // All three are exactly `.ui-title` from type-roles.js, so the component
            // writes the class and restates nothing (TYPE_ROLES.md rule 1).
            const cs = await page.computed('#settings >>> #title', ['font-size', 'font-weight']);
            near(cs['font-size'], ORACLE.titleSize, 'title font-size');
            assert.equal(cs['font-weight'], ORACLE.titleWeight, 'title font-weight');

            await assertTokenDrill(page, {
                token: '--ui-text-xl',
                value: '37px',
                selector: '#settings >>> #title',
                property: 'font-size',
            });
            await assertTokenDrill(page, {
                token: '--ui-text',
                value: DRILL_COLOUR,
                selector: '#settings >>> #title',
                property: 'color',
            });
        }));

        test('the title carries the oracle\'s tracking, and it tracks the type size', () => mounted(async (page) => {
            // REVIEW FINDING cross-5: this row was dropped in the first cut and the title
            // rendered `normal`. The disqualification check runs first and does not fire —
            // tracking is inside the corpus's 18-property surface, no decision touches
            // title tracking, and #page_title is on neither §7's 140 nor the 31 contract
            // bugs — so the oracle is QUALIFIED and this is carried, not departed from.
            //   CITE settings-display-skin #page_title [i=3] letter-spacing = 0.28px  ←
            //        slate-shell.css `#subpage-host #subpage-header #page_title` authored
            //        `0.01em` !important=no (token-driven)
            near((await page.computed('#settings >>> #title', ['letter-spacing']))['letter-spacing'],
                0.28, 'the oracle\'s 0.28px at 28px type', 0.02);

            // Authored as the em, not the measured px: it has to follow the type size, or
            // a retarget of --ui-text-xl leaves the tracking behind at a wrong ratio.
            await page.setToken('--ui-text-xl', '56px');
            try {
                near((await page.computed('#settings >>> #title', ['letter-spacing']))['letter-spacing'],
                    0.56, 'tracking must be relative type, not a frozen 0.28px', 0.03);
            } finally {
                await page.setToken('--ui-text-xl', null);
            }

            // And the sibling really is the other value, so the pair is a deliberate
            // difference rather than a drift: #16's sheet title is --ui-tracking-cap.
            assert.notEqual(
                await page.resolveValue('var(--ui-tracking-cap)', 'letter-spacing'),
                (await page.computed('#settings >>> #title', ['letter-spacing']))['letter-spacing'],
                'the page title must not silently become the sheet title\'s .04em',
            );
        }));

        test('#2\'s widening hook: the cluster is unreachable, the slotted action is not', () => mounted(async (page) => {
            // REVIEW FINDING c3-4. The first cut documented
            // `ui-page-header ui-button.header-action { inline-size: 96px }` as a
            // consumer hook; #cancel/#save are rendered INSIDE this shadow root, so that
            // rule can never match them, and nothing exercised it either way.
            // Both of those rules are live in FIXTURE_CSS throughout.
            const save = await page.box('#settings >>> #save');
            assert.notEqual(Math.round(save.width), 96,
                'a document rule reached inside the shadow root — that is not the hook');
            assert.ok(save.width > 96,
                `the cluster is content-sized, measured ${save.width}px for "Save (3)"`);

            // The half that IS the hook: a slotted control is the consumer's own light-DOM
            // element, and the consumer's own sheet sizes it normally
            // (ui-icon-button.js:104-117 documents exactly this rule).
            near((await page.box('#editor-wide')).width, 96,
                'the consumer could not widen its own slotted action');

            // …and ::slotted(.header-action) keeps the width it was given: the band must
            // not shrink it away when the title needs room.
            await page.setStyle('#screen-c', { 'inline-size': '460px' });
            try {
                near((await page.box('#editor-wide')).width, 96,
                    'a squeezed band shrank the slotted action instead of the title');
            } finally {
                await page.setStyle('#screen-c', { 'inline-size': null });
            }
        }));

        test('drill: --ui-band-h is the host floor', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-band-h',
                value: '150px',
                selector: '#settings',
                property: 'min-block-size',
            });
        }));

        /* ================================================================
         * 4. D11 — "Save (3)", decided here and nowhere else
         * ============================================================== */

        test('D11: a dirty header reads "Save (N)" and offers Cancel', () => mounted(async (page) => {
            // D11 (accepted, SCOPE.md:2220): "the save button reads 'Save (3)', and the
            // shared component decides the wording — never per screen."
            assert.equal(await textOf(page, '#settings >>> #save'), 'Save (3)');
            assert.ok(await page.exists('#settings >>> #cancel'),
                'a dirty header offers a way back');
            // CITE settings-display-skin #save-settings-btn [i=4] height = 82px  <-
            //      slate-shell.css `#subpage-host #subpage-header button:not(
            //      #fullscreen-toggle-btn), …` authored `var(--slate-control-lg)`
            near((await page.box('#settings >>> #save')).height, ORACLE.controlLg,
                'the commit control is --ui-control-lg (ui-button `tall`)');

            // The count is a NUMBER in and a SENTENCE out — set it and read it back.
            await page.evalFn(() => {
                document.getElementById('settings').changeCount = 1; return true;
            });
            await page.settle(2);
            assert.equal(await textOf(page, '#settings >>> #save'), 'Save (1)');
            await page.evalFn(() => {
                document.getElementById('settings').changeCount = 12; return true;
            });
            await page.settle(2);
            assert.equal(await textOf(page, '#settings >>> #save'), 'Save (12)');
        }));

        /* A CLEAN HEADER READS "SAVE" AND KEEPS CANCEL (Ben, 25 August 2026).
         *
         * The old expectation was D11's, and its evidence was real: Slate's SETTINGS
         * capture shows one neutral "Close" and no Cancel in all 38 states. What it missed
         * is that Slate's other committing screen — the profile editor — shows Cancel and
         * a filled Save whether or not anything has changed, and Ben chose that pair for
         * both screens when the editor's header was built.
         *
         * SO ONE THING SURVIVES UNCHANGED AND IT IS THE ONE D11 IS ABOUT: the PRIMARY FILL
         * is still spent only when there is something to affirm. Slate's own S10 note is
         * the reason ("Save was full-primary on untouched pages, so the affirmative
         * treatment said nothing about whether there was anything to affirm"), and it is
         * asserted below exactly as before. */
        test('D11: a clean header spends no primary fill, and the count is what changes', () => mounted(async (page) => {
            assert.equal(await textOf(page, '#clean >>> #save'), 'Save',
                'the word is Save at zero, with no count beside it');
            assert.equal(await page.exists('#clean >>> #cancel'), true,
                'and Cancel stays — Slate\'s editor pair, on Ben\'s ruling');
            const variants = await page.evalFn(() => ({
                clean: window.__h.q('#clean >>> #save').getAttribute('variant'),
                dirty: window.__h.q('#settings >>> #save').getAttribute('variant'),
            }));
            assert.deepEqual(variants, { clean: 'default', dirty: 'primary' },
                'the affirmative treatment is still spent only when there are edits');
        }));

        test('D11: "cannot tell" is clean — a bad count never shows a false-dirty Save', () => mounted(async (page) => {
            // SCOPE.md:2682 carries the rule forward: "treat 'cannot tell' as clean,
            // because a false-dirty Save is worse than no dirty state".
            /* "CANNOT TELL" IS STILL CLEAN, and clean is now "Save" with no count —
             * the claim is unchanged, the word at zero is not. */
            for (const [value, expected] of [[-3, 'Save'], [0, 'Save'], ['x', 'Save'], [2.7, 'Save (2)']]) {
                await page.evalFn((v) => {
                    document.getElementById('settings').changeCount = v; return true;
                }, value);
                await page.settle(2);
                assert.equal(await textOf(page, '#settings >>> #save'), expected,
                    `changeCount=${JSON.stringify(value)}`);
            }
        }));

        test('D11 cannot express: no screen can supply the wording', () => mounted(async (page) => {
            // The decision is only a decision if the alternative is unreachable. There
            // is no label property, no label attribute and no slot in the commit
            // region — a screen supplies a NUMBER and gets a SENTENCE.
            await page.evalFn(() => {
                const el = document.getElementById('settings');
                for (const name of ['save-label', 'label', 'primary-label', 'commit-label',
                    'primarylabel', 'save-text']) {
                    el.setAttribute(name, 'Commit everything');
                }
                el.textContent = 'Commit everything';   // unassigned: renders nowhere
                return true;
            });
            await page.settle(3);
            assert.equal(await textOf(page, '#settings >>> #save'), 'Save (3)',
                'six label attributes and a textContent write must all do nothing');
            assert.equal(await textOf(page, '#settings >>> #cancel'), 'Cancel');
        }));

        test('D11: the wording is one translatable SENTENCE, not a word plus punctuation',
            () => mounted(async (page) => {
                // REVIEW FINDING c3-5. The first cut built the label as
                // `${t('Save')} (${n})`, which freezes the parentheses, the space and the
                // word order in English — the same defect D11 names one level up, one
                // level down. D2 (accepted, SCOPE.md:1771-1775) exists precisely so the
                // whole sentence is the unit: src/lib/i18n.js:31-38 interpolates {count}
                // on the catalogue string AND on the key-as-fallback path.
                //
                // The catalogue below moves the count to the FRONT and drops the
                // parentheses, which is unreachable by concatenation and is the point.
                const setLang = (lang, strings) => page.evalFn(async (l, s) => {
                    const m = await import('/src/lib/i18n.js');
                    m.translations.set(l, s);
                    return m.translations.language;
                }, lang, strings);

                assert.equal(await textOf(page, '#settings >>> #save'), 'Save (3)',
                    'an empty store renders exactly what Slate renders');

                assert.equal(await setLang('xx', {
                    'Save ({count})': '{count} unsaved — commit',
                    /* THE CLEAN KEY IS `Save` SINCE 25 AUGUST 2026, not `Close` — the word
                     * at zero changed and the mechanism did not: it is still a whole
                     * sentence looked up in the catalogue. */
                    Save: 'Done',
                    Cancel: 'Back',
                }), 'xx');
                await page.settle(3);
                assert.equal(await textOf(page, '#settings >>> #save'), '3 unsaved — commit',
                    'the count must land where the CATALOGUE put it, not where English does');
                assert.equal(await textOf(page, '#settings >>> #cancel'), 'Back');
                assert.equal(await textOf(page, '#clean >>> #save'), 'Done',
                    'the clean label moves with the language too');

                // The count is still the component's, so it re-renders through the
                // catalogue rather than being baked at set() time.
                await page.evalFn(() => {
                    document.getElementById('settings').changeCount = 7; return true;
                });
                await page.settle(2);
                assert.equal(await textOf(page, '#settings >>> #save'), '7 unsaved — commit');

                // And back: key-as-fallback means an untranslated store is English.
                await setLang('en', {});
                await page.settle(3);
                assert.equal(await textOf(page, '#settings >>> #save'), 'Save (7)');
                assert.equal(await textOf(page, '#clean >>> #save'), 'Save');
            }));

        test('D11 cannot express: a screen cannot reach the wording through the store either',
            () => mounted(async (page) => {
                // The i18n store is a per-DOCUMENT module, so a catalogue is an
                // application-wide decision — not a per-screen one. Two headers on one
                // page therefore cannot say different things, which is the same property
                // the label-attribute test asserts through the other door.
                await page.evalFn(async () => {
                    const m = await import('/src/lib/i18n.js');
                    m.translations.set('xx', { 'Save ({count})': 'One wording' });
                    return true;
                });
                await page.settle(3);
                const both = [
                    await textOf(page, '#settings >>> #save'),
                    await textOf(page, '#squeeze >>> #save'),
                ];
                assert.deepEqual(both, ['One wording', 'One wording'],
                    'two headers on one screen must speak with one voice');
                await page.evalFn(async () => {
                    const m = await import('/src/lib/i18n.js');
                    m.translations.set('en', {});
                    return true;
                });
            }));

        test('D11: the commit cluster reports, and reports the state it painted', () => mounted(async (page) => {
            await page.recordEvents('#settings', ['commit', 'cancel']);
            await page.click('#settings >>> #save >>> button');
            await page.click('#settings >>> #cancel >>> button');
            const events = await page.recordedEvents();
            assert.equal(events.length, 2, 'one event per press');
            assert.equal(events[0].type, 'commit');
            assert.equal(events[1].type, 'cancel');
            // `dirty` in the detail is the same boolean that chose the label, so the two
            // cannot drift — Appendix 15's argument, applied to wording.
            assert.deepEqual(events[0].detail, { changeCount: 3, dirty: true });

            // One handler for both states, as Slate has one (settings.js:6773).
            await page.recordEvents('#clean', ['commit']);
            await page.click('#clean >>> #save >>> button');
            const clean = await page.recordedEvents();
            assert.equal(clean.at(-1).type, 'commit');
            assert.deepEqual(clean.at(-1).detail, { changeCount: 0, dirty: false });
        }));

        /* ================================================================
         * 5. WAVE LAW — this band paints no selection, and cannot
         * ============================================================== */

        test('wave law: the four dials move nothing in this shadow tree', () => mounted(async (page) => {
            // "NO private 'selected' look anywhere in this wave — a component expresses
            // selection ONLY via the dial tokens" (wave brief; CONVENTIONS §4). This
            // band HOSTS the things that select — the editor tablist, Live's favourites
            // bank, the History Viewer's tab bank — through a SLOT, and they are
            // #3/#32/#36. So the correct reading here is that all four dials are inert.
            const before = await shadowPaint(page, 'live');
            await page.setToken('--ui-selected-face', DRILL_COLOUR);
            await page.setToken('--ui-selected-ink', DRILL_COLOUR);
            await page.setToken('--ui-selected-led', '9px');
            await page.setToken('--ui-selected-glow', '90%');
            const after = await shadowPaint(page, 'live');
            for (const dial of ['--ui-selected-face', '--ui-selected-ink',
                '--ui-selected-led', '--ui-selected-glow']) {
                await page.setToken(dial, null);
            }
            assert.deepEqual(after, before,
                'a page header that answers the selection dials is the seventh treatment');
        }));

        test('wave law: a slotted [aria-selected] takes nothing from this component', () => mounted(async (page) => {
            // The band must not paint its slotted tabs. Slate's Live header does exactly
            // that — bug L8, "the favourites bank and #dye-strip are two hand-built
            // copies of .slate-bank … bypassing all four --slate-selected-* dials" — and
            // the fix is not a better copy in the band, it is NO copy in the band.
            for (const sel of ['#tab-1', '#fav-1']) {
                const cs = await page.computed(sel, ['background-color', 'box-shadow', 'text-shadow']);
                assert.equal(cs['background-color'], 'rgba(0, 0, 0, 0)',
                    `${sel}: the header painted a selected slot`);
                assert.equal(cs['box-shadow'], 'none', `${sel}: the header drew a LED`);
                assert.equal(cs['text-shadow'], 'none', `${sel}: the header drew a glow`);
            }
        }));

        /* ================================================================
         * 6. FOCUS — L24's class, in a band made entirely of controls
         * ============================================================== */

        test('the commit buttons take the one ring, unclipped', () => mounted(async (page) => {
            await assertFocusUnclipped(page, '#settings >>> #save >>> button');
            await assertFocusUnclipped(page, '#settings >>> #cancel >>> button');
        }));

        test('a slotted control in any region takes the one ring, unclipped', () => mounted(async (page) => {
            // The band declares overflow on .title alone, and an <h1> cannot be focused.
            // Every other box here is unclipped by construction, which is what keeps
            // L24 — "focus rings clipped on all four sides by the components they sit
            // inside" — off all three regions.
            for (const sel of ['#library', '#fav-1', '#sleep', '#editor-exit']) {
                await assertFocusUnclipped(page, sel);
            }
        }));

        test('no second focus treatment: the ring is the base ring', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-focus-w',
                value: '7px',
                selector: '#settings >>> #save >>> button',
                property: 'outline-width',
                prepare: (p) => p.focusVisible('#settings >>> #save >>> button'),
            });
        }));

        /* ================================================================
         * 7. CONTAINER BEHAVIOUR — its own box, never the viewport
         * ============================================================== */

        test('the band fills its container and reads no viewport', () => mounted(async (page) => {
            // #fixed-holder is 640px at BOTH geometries, so an inline measurement that
            // differed between 1281×801 and 1000×600 came from the viewport.
            const host = await page.box('#fixed');
            const band = await page.box('#fixed >>> #band');
            near(host.width, 640, 'the host fills its container');
            near(band.width, 640, 'and the band fills the host');
            assert.equal(await page.prop('#fixed', 'container-type'), 'inline-size',
                'the component declares its container (CONVENTIONS §2)');
        }));

        test('the title gives before the actions do', () => mounted(async (page) => {
            // Appendix 7's idea, kept: "A three-column header with a fixed centre track,
            // so tabs stay optically centred and the flanks overflow rather than shove."
            // Departure 4 makes the flank that overflows do it as an ellipsis.
            const bandH = ORACLE.bandH * await densityOf(page);
            const wide = await page.box('#squeeze >>> #save');
            await page.setStyle('#squeeze-holder', { 'inline-size': '460px' });
            const tight = {
                save: await page.box('#squeeze >>> #save'),
                band: await page.box('#squeeze >>> #band'),
                title: await page.metrics('#squeeze >>> #title'),
            };
            await page.setStyle('#squeeze-holder', { 'inline-size': null });

            near(tight.band.height, bandH, 'the band keeps its floor when squeezed');
            near(tight.save.height, ORACLE.controlLg, 'the action keeps its physical height');
            near(tight.save.width, wide.width, 'the action keeps its width — the title gave');
            assert.ok(tight.title.scrollWidth > tight.title.clientWidth + 0.5,
                'the title is the box that overflowed');
            assert.equal(
                (await page.computed('#squeeze >>> #title', ['text-overflow']))['text-overflow'],
                'ellipsis',
                'and it says so, rather than cutting mid-glyph',
            );
            // The affirmative action stays inside the band's own inset: overflow, never
            // shove, and never off the edge of the band.
            assert.ok(tight.save.right <= tight.band.right - ORACLE.inset + 0.6,
                `the trail was pushed out of the band (${tight.save.right} vs ${tight.band.right})`);
        }));

        test('the two layouts are the spec\'s two, and the fallback is flanks', () => mounted(async (page) => {
            // flanks: LAYOUT_SPEC_DRAFT.md:632-633 "<editor-header>
            //   grid-template-columns: minmax(0,1fr) auto minmax(0,1fr) / centre track =
            //   the tablist's own width; flanks overflow, never shove"  — departure 5,
            //   not Slate's `minmax(0,1fr) 430px minmax(0,1fr)`.
            // centre: :540 "Contents are a 3-part flex row: library button, favourites
            //   bank (1fr, min-width: 0), action cluster."
            const tracks = async (sel) => (await page.prop(sel, 'grid-template-columns'))
                .split(/\s+/).map(parseFloat);
            const editor = await tracks('#editor >>> #band');
            const live = await tracks('#live >>> #band');
            assert.equal(editor.length, 3, `flanks: three tracks, got ${editor.join(' / ')}`);
            assert.equal(live.length, 3, `centre: three tracks, got ${live.join(' / ')}`);
            assert.ok(editor[0] > editor[1] && editor[2] > editor[1],
                `flanks: the two flanks take the room, measured ${editor.join(' / ')}`);
            assert.ok(live[1] > live[0] && live[1] > live[2],
                `centre: the centre takes the room, measured ${live.join(' / ')}`);
            near(editor[0], editor[2], 'the flanks are equal, so the centre is optically centred');

            // layout="Nope" falls back rather than collapsing the band.
            assert.equal(await page.prop('#fallback', 'display'), 'grid');
            assert.equal(
                await page.evalFn(() => document.getElementById('fallback').getAttribute('layout')),
                'flanks',
                'an unrecognised layout is normalised, not honoured',
            );
        }));

        /* ================================================================
         * 8. DEPARTURE 2 — the seam draws the underline, and only once
         * ============================================================== */

        test('the band draws no bottom edge of its own', () => mounted(async (page) => {
            // CITE editor-steps .slate-editor-header [i=2] box-shadow = rgb(82, 97, 107)
            //      0px -1px 0px 0px inset  <-  profile-editor-v3.css
            //      `.slate-editor-header` authored `inset 0 -1px var(--slate-line-strong)`
            //      !important=no (token-driven)   [prov-light rgb(170, 178, 183)]
            // CONVENTIONS §13 names this line as the seam utility's: ".seam-strong — the
            // emphasised divider: rail edge, HEADER UNDERLINE, band top." A band that
            // drew its own as well would be L9's shape — "every rail stepper draws its
            // seam twice (component inset shadow + Live border)".
            const cs = await page.computed('#settings >>> #band',
                ['box-shadow', 'border-bottom-width', 'border-bottom-style']);
            assert.equal(cs['box-shadow'], 'none', 'the band draws no shadow');
            assert.equal(parseFloat(cs['border-bottom-width']), 0, 'and no border');
            assert.equal(cs['border-bottom-style'], 'none');
        }));

        test('the screen grid draws it, once, as a gap', () => mounted(async (page) => {
            // LAYOUT_SPEC_DRAFT.md:521-525 — `gap: var(--ui-seam)` over `background:
            // var(--ui-line-strong)`, "the seam IS the divider". The gap between the
            // band and the body is the only thing between them.
            const band = await page.box('#settings >>> #band');
            const body = await page.box('#screen-a > .body');
            const seam = parseFloat(await page.prop('#screen-a', 'row-gap'));
            assert.ok(seam > 0, 'the seam is a real gap');
            near(body.top - band.bottom, seam, 'exactly one seam between band and body');
        }));

        /* ================================================================
         * 9. ARIA — the state a screen reader reads is the state on screen
         * ============================================================== */

        test('the band is a <header>, and the landmark is opt-in', () => mounted(async (page) => {
            // ORACLE, both sides:
            //   CITE live-ready .slate-live-header [i=1] <header class="slate-live-header
            //        bg-[var(--box-color)] border-b border-base-400 w-full h-[168px]
            //        relative" role="banner">                              (7 states)
            //   CITE settings-display-skin #subpage-header [i=2] <div id="subpage-header"
            //        class="flex justify-between items-center p-6 border-b border-base-300
            //        bg-[var(--box-color)] h-[150px]">                     (39 states, no
            //        role; its parent is role="dialog" — settings.html:6)
            // 39 without against 7 with, and the 39 are right: a banner landmark inside a
            // dialog is a landmark in the wrong place. Default off; Live writes `banner`.
            const shape = await page.evalFn(() => {
                const read = (id) => {
                    const el = document.getElementById(id).shadowRoot.getElementById('band');
                    return { tag: el.localName, role: el.getAttribute('role') };
                };
                return {
                    live: read('live'),
                    settings: read('settings'),
                    inDialog: read('in-dialog'),
                };
            });
            assert.equal(shape.live.tag, 'header');
            assert.equal(shape.settings.tag, 'header');
            assert.equal(shape.inDialog.tag, 'header', 'it stays a real <header> either way');
            assert.equal(shape.live.role, 'banner', 'Live opts in');

            // REVIEW FINDING c3-2. `role === null` is not what this departure claims, and
            // cannot fail for it: a bare <header> outside article/aside/main/nav/section
            // has the IMPLICIT role banner, and role="dialog" does not suppress it. So the
            // attribute is now explicit AND the COMPUTED role is what is asserted.
            assert.equal(shape.settings.role, 'none', 'the non-banner case says so out loud');
            assert.equal(shape.inDialog.role, 'none');

            const ax = {
                live: await axRoleOf(page, 'live'),
                settings: await axRoleOf(page, 'settings'),
                inDialog: await axRoleOf(page, 'in-dialog'),
            };
            assert.equal(ax.live.role, 'banner', 'Live really is a banner landmark');
            assert.notEqual(ax.settings.role, 'banner',
                'a default band computed a banner landmark — departure 3 is not achieved');
            // #dialog-holder is role="dialog", which is the exact arrangement Slate ships
            // (settings.html:6) and the one the departure was written about.
            assert.notEqual(ax.inDialog.role, 'banner',
                'a banner landmark inside a dialog is a landmark in the wrong place');
            assert.equal(ax.inDialog.role, 'none');
        }));

        test('the heading is a real <h1>, and only when there is one', () => mounted(async (page) => {
            const headings = await page.evalFn(() => {
                const read = (id) => {
                    const t = document.getElementById(id).shadowRoot.getElementById('title');
                    return t ? { tag: t.localName, text: t.textContent } : null;
                };
                return { settings: read('settings'), live: read('live') };
            });
            assert.deepEqual(headings.settings, { tag: 'h1', text: 'Settings' });
            assert.equal(headings.live, null,
                'a band with no heading renders no empty heading box');
        }));

        test('the commit buttons carry their own accessible name', () => mounted(async (page) => {
            // The name IS the label, so the wording rule and the accessible name are one
            // string and cannot drift — Appendix 15's argument, applied to text.
            const names = await page.evalFn(() => {
                const btn = (host, id) => document.getElementById(host).shadowRoot
                    .getElementById(id).shadowRoot.querySelector('button');
                /* #1 paints its label through a <slot> (ui-button.js render(): the inner
                 * button's only child is <slot></slot>), so the accessible name is
                 * computed from the FLATTENED tree — the shadow button's own
                 * textContent is empty by construction. Read what the slot is handed,
                 * which is exactly what a screen reader announces. */
                const nameOf = (host, id) => {
                    const b = btn(host, id);
                    const slot = b.querySelector('slot');
                    const text = slot
                        ? slot.assignedNodes({ flatten: true })
                            .map((n) => n.textContent).join('')
                        : b.textContent;
                    return text.trim();
                };
                return {
                    save: nameOf('settings', 'save'),
                    cancel: nameOf('settings', 'cancel'),
                    close: nameOf('clean', 'save'),
                    saveAria: btn('settings', 'save').getAttribute('aria-label'),
                };
            });
            assert.equal(names.save, 'Save (3)');
            assert.equal(names.cancel, 'Cancel');
            assert.equal(names.close, 'Save', 'clean is Save with no count — Ben, 25 Aug 2026');
            assert.equal(names.saveAria, null,
                'the visible text IS the name — an aria-label here could disagree with it');
        }));

        /* ================================================================
         * 10. ZERO !IMPORTANT, and the shadow boundary that makes it possible
         * ============================================================== */

        test('every paint in this component landed from a plain class rule', () => mounted(async (page) => {
            // Slate's three header sheets need `!important` because other sheets can
            // reach the same elements — slate-live.css:98-101 carries three on one rule.
            // Nothing can reach into a shadow root, so the reason is gone (CONVENTIONS
            // §6), and the proof is that the plain rules landed at all with the
            // FIXTURE_CSS attack sheet live on the page throughout.
            const cs = await page.computed('#settings >>> #band',
                ['background-color', 'display', 'align-items', 'column-gap']);
            assert.equal(cs.display, 'grid');
            assert.equal(cs['align-items'], 'center');
            near(cs['column-gap'], ORACLE.regionGap, 'column-gap');
            assert.notEqual(cs['background-color'], 'rgba(0, 0, 0, 0)', 'the ground painted');
        }));
    });
}

/* ===========================================================================
 * THEMES — one band, two palettes, no rule change (A6 / the Radian rule)
 * =========================================================================== */

describe('ui-page-header across themes', () => {
    const seen = {};

    for (const theme of ['dark', 'light']) {
        test(`the band and the title read the theme's tokens — ${theme}`, () => browser.withPage(
            { geometry: GATE_A_GEOMETRIES[0], theme },
            async (page) => {
                await page.mount(MARKUP, MODULE);
                assert.deepEqual(page.pageErrors, []);
                seen[theme] = await page.computed('#settings >>> #band', ['background-color']);
                const title = await page.computed('#settings >>> #title', ['color']);

                // CITE settings-display-skin #subpage-header [i=2] background-color =
                //      rgb(17, 22, 26) [prov-baseline] / rgb(250, 250, 250) [prov-light]
                //      <- slate-shell.css `#subpage-host #subpage-header` (token-driven)
                // CITE settings-display-skin #page_title [i=3] color =
                //      rgb(244, 247, 248) [prov-baseline] / rgb(23, 26, 28) [prov-light]
                assert.equal(seen[theme]['background-color'], ORACLE[theme].bar);
                assert.equal(title.color, ORACLE[theme].text);
            },
        ));
    }

    test('the two themes really are two values', () => {
        assert.notEqual(seen.dark['background-color'], seen.light['background-color']);
    });
});

/* ===========================================================================
 * THE GALLERY ENTRY THIS COMPONENT SHIPS
 * The entry lives in its own file (tools/gallery/entries/ui-page-header.entry.js)
 * because twelve wave-2 builders cannot all append to one array under a whole-file
 * write rule; the wave's single cross-cutting writer wires it into
 * tools/gallery/entries.js. The ENTRY's own correctness is this builder's problem,
 * and an entry that throws photographs an empty stage rather than failing.
 * =========================================================================== */

describe('the gallery entry this component ships', () => {
    test('every declared state mounts, settles and paints a band', async () => {
        const { entry } = await import('../../tools/gallery/entries/ui-page-header.entry.js');

        assert.equal(entry.id, 'ui-page-header', 'the entry id is the tag name is the file name');
        assert.equal(entry.module, '../../src/components/ui-page-header.js',
            'module is relative to tools/gallery/, which is where gallery.js imports it from');
        assert.ok(entry.states.length >= 3);
        assert.equal(new Set(entry.states.map((s) => s.id)).size, entry.states.length,
            'state ids are capture filenames, so they must be unique');

        await browser.withPage({ geometry: GATE_A_GEOMETRIES[0] }, async (page) => {
            for (const state of entry.states) {
                const wrapper = state.hostStyle
                    ? `<div id="stage" style="${Object.entries(state.hostStyle)
                        .map(([k, v]) => `${k}:${v}`).join(';')}">${state.html}</div>`
                    : `<div id="stage">${state.html}</div>`;
                await page.mount(wrapper, MODULE);
                assert.deepEqual(page.pageErrors, [], `${entry.id}--${state.id} threw`);

                const painted = await page.evalFn(() => {
                    const hosts = [...document.querySelectorAll('ui-page-header')];
                    if (!hosts.length) return null;
                    return hosts.map((el) => {
                        const band = el.shadowRoot && el.shadowRoot.getElementById('band');
                        if (!band) return null;
                        const r = band.getBoundingClientRect();
                        const cs = getComputedStyle(band);
                        return {
                            w: r.width,
                            h: r.height,
                            bg: cs.backgroundColor,
                            padLeft: cs.paddingLeft,
                            padRight: cs.paddingRight,
                        };
                    });
                });
                assert.ok(painted && painted.length,
                    `${entry.id}--${state.id} rendered no ui-page-header at all`);

                for (const band of painted) {
                    assert.ok(band, `${entry.id}--${state.id} rendered a host with no band`);
                    assert.ok(band.w > 0, `${entry.id}--${state.id} rendered a zero-width band`);
                    near(band.h, ORACLE.bandH, `${entry.id}--${state.id} band height`);
                    // CONVENTIONS §13 trap 1: an unpainted cell in a seam grid is a hole,
                    // and the screen-grid state mounts this band inside exactly that.
                    assert.notEqual(band.bg, 'rgba(0, 0, 0, 0)',
                        `${entry.id}--${state.id} paints no ground`);
                    // P17 again, this time through the shipped states: every band in
                    // every state carries the one inset, on both edges.
                    near(band.padLeft, ORACLE.inset, `${entry.id}--${state.id} padding-left`);
                    near(band.padRight, ORACLE.inset, `${entry.id}--${state.id} padding-right`);
                }
            }
        });
    });
});
