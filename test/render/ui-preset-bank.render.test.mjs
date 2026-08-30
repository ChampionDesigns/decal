/**
 * ui-preset-bank.render.test.mjs — Wave 4 item #37's rendering suite.
 *
 * Gate A: headless Chrome over CDP, computed styles, box geometry and BEHAVIOUR,
 * never source text, at BOTH standard geometries — 1281x801 @ dsf 1.5 and the
 * 1000x600 floor (CONVENTIONS §10, Part 8 §2).
 *
 * WHAT THIS SUITE IS REALLY FOR. Row #37 is a deletion: "the fourth selection idiom
 * collapses into a #3 use" (SCOPE Part 4, Wave 4 Live-screen compounds). A suite that
 * only checked the row looks right would pass just as happily against a component that
 * had quietly kept the idiom — which is exactly how Slate came to paint "selected" four
 * different ways on one screen. So the load-bearing tests are the ones that cannot pass
 * for a private implementation, plus the one behaviour a bank cannot carry:
 *
 *   §3  assertOneSelectionTreatment on the active preset, then all four dials turned
 *       neutral — the state in which a fifth treatment stops hiding behind the shipped
 *       dial values. Slate's four idiom properties are all in the compared list, and
 *       the ::after underline is checked as a pseudo rather than a property.
 *   §3  a document sheet with !important aimed at every class either implementation
 *       uses, appended AFTER the components: it reaches nothing.
 *   §4  the highlight is DERIVED and READ-ONLY (steam-mode.js:57-75) — a press moves
 *       the machine, not the paint. Proved with real CDP clicks: the pressed cell does
 *       not light, exactly one `preset-select` leaves carrying a NUMBER, and the
 *       highlight moves only when `value` comes back changed.
 *   §5  nothing-active is a first-class state, which is what Slate's own live-ready
 *       capture shows on the steam-flow row.
 *
 * ORACLE, re-read mechanically through prov_query and quoted where it is used:
 *   CITE live-ready #drink-out-preset-1..4 [i=37..40] four cells at x=134 / 201 / 268 /
 *        335, each 67 x 34, texts "30" "36" "40" "50"; only [i=39] carries
 *        .preset-active — `find --cls preset-active` returns 7 elements in 7 states,
 *        all of them that one button at [268,395,67,34]
 *   CITE live-ready #drink-out-preset-3 [i=39] color = rgb(244, 247, 248) (light
 *        rgb(23, 26, 28)) <- slate-live.css `#main-page #shot-settings .preset-active`
 *        authored `var(--slate-text)` !important=yes; font-weight = 400 authored `400`
 *        !important=yes (FROZEN/hardcoded); font-size = 18px authored
 *        `var(--slate-text-md)`; background-color = rgba(0, 0, 0, 0); min-height = 34px
 *   CITE live-ready #drink-out-preset-1 [i=37] font-weight = 300, color =
 *        color(srgb 0.618039 0.665098 0.693726) authored
 *        `color-mix(in srgb, var(--slate-muted) 90%, var(--slate-text))` !important=yes
 *   CITE live-ready .slate-stepper — 268 x 64 for all 85 elements in 16 states; the
 *        preset row's 4 x 67 = 268 is exactly the control it sets
 * Slate's rects are frozen 1920x1200 captures, quoted as what Slate does and never as a
 * responsive target (LAYOUT_SPEC_DRAFT governs responsive behaviour). Colours are
 * asserted against resolved tokens, never hexes, so the suite is true in both themes.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES, BENCH } from '../harness/index.js';
import { entry as galleryEntry } from '../../tools/gallery/entries/ui-preset-bank.entry.js';
import {
    assertTokenDrill,
    assertOneSelectionTreatment,
    assertFocusUnclipped,
    assertHitFloor,
    shadowSegments,
    DRILL_COLOUR,
    DRILL_LENGTH,
} from '../harness/assertions.js';

const MODULE = ['/src/components/ui-preset-bank.js'];

/* Slate's drink-out row, exactly as the corpus measures it: 30 / 36 / 40 / 50 with 40
 * active. The one preset row in the whole corpus that HAS an active preset. */
const DOSE = `<ui-preset-bank id="dose" label="Drink weight presets" value="40"
    presets='[30,36,40,50]'></ui-preset-bank>`;

/* Slate's steam-flow row, also exactly as measured — four presets, none of them
 * matching, because the flow was hand-dialled. "No highlight, the honest state."
 * 0.9 is off every preset; 1.0 is the one that would print as "1" without a step. */
const FLOW = `<ui-preset-bank id="flow" label="Steam flow presets" value="0.9"
    presets='[0.6,0.8,1.0,1.2]'></ui-preset-bank>`;

/* The steam TEMPERATURE row, on the corrected table: floor 135, ceiling 165 Bengle /
 * 160 DE1 (CARRY_FORWARD.md §3c on machine-limits.js; ReaPrime de1_controller.dart:545).
 * The retired 130/170 table's 130 is the heater-off dead band and appears nowhere. */
const STEAM = `<ui-preset-bank id="steam" label="Steam temperature presets" value="145"
    presets='[135,145,155,165]'></ui-preset-bank>`;

/* A row with no value at all — the absence case. No fallback, no computed default (A7):
 * an absent reading highlights nothing. */
const ABSENT = `<ui-preset-bank id="absent" label="Flush volume presets"
    presets='[20,30,40,60]'></ui-preset-bank>`;

/* A stated stage width, so every measured box is the CONTAINER's answer and not the
 * viewport's — the two geometries must produce identical numbers (spec §2.1 Rule 1).
 * 400px is inside --ui-rail-w's clamp(320px, 26%, 460px), which is where this row
 * lives. */
const MARKUP = `
    <style>
      #stage { display: grid; gap: 24px; inline-size: 400px; }
    </style>
    <div id="stage">${DOSE}${FLOW}${STEAM}${ABSENT}</div>`;

/** The bank a preset row renders, and its cells — two boundaries deep. */
const bank = (row) => `#${row} >>> #presets`;
const cell = (row, i) => `#${row} >>> #presets >>> #item-${i}`;

/** Rendered lengths at dsf 1.5 are not string-comparable; whole CSS px are. */
const near = (got, want, what, tol = 0.51) => assert.ok(
    Math.abs(got - want) <= tol,
    `${what}: expected ${want}, got ${got}`,
);

/** The dial's own shadow segment is always the LAST one (assertions.js, shadowSegments). */
const lastSegment = (value) => shadowSegments(value).at(-1) ?? '';

/**
 * Everything worth comparing between an active preset and a resting one that the four
 * dials do NOT own. Carried unchanged from ui-tab-bar.render.test.mjs:102 (itself
 * carried from ui-bank, itself from ui-list-row) on purpose: one library, one list, so
 * four selection surfaces cannot be held to four standards that drift apart.
 *
 * `font-weight` is the entry that matters here — it is Slate's fourth idiom's own
 * discriminator, 300 resting against 400 active, and no dial can reach it.
 */
const NON_DIAL_PROPERTIES = [
    /* `font-weight` left this list at parity surface 2, when the selected weight became
     * the fifth dial (base.js, --ui-selected-weight). It is neutralised with the other
     * four in the dials-off test and asserted against the dial beside it. */
    'font-size', 'font-family', 'letter-spacing', 'text-transform',
    'border-top-width', 'border-top-color', 'border-top-left-radius',
    'border-bottom-width', 'border-left-width', 'padding-left', 'padding-right',
    'min-height', 'opacity', 'background-image', 'outline-style', 'transform',
    'display', 'align-items', 'gap', 'cursor', 'user-select',
];

/** Every cell's aria state and label, read from inside the bank. */
const CELLS = (rowId) => `(${((id) => {
    const row = document.getElementById(id);
    const b = row.shadowRoot.querySelector('#presets');
    return [...b.shadowRoot.querySelectorAll('.item')].map((el) => ({
        text: el.textContent.trim(),
        role: el.getAttribute('role'),
        pressed: el.getAttribute('aria-pressed'),
        selected: el.getAttribute('aria-selected'),
        checked: el.getAttribute('aria-checked'),
        tabindex: el.getAttribute('tabindex'),
        disabled: el.hasAttribute('disabled'),
    }));
}).toString()})(${JSON.stringify(rowId)})`;

let browser;

before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`ui-preset-bank @ ${geometry.name} (${geometry.width}x${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

        const mounted = (fn, markup = MARKUP) => browser.withPage({ geometry }, async (page) => {
            await page.mount(markup, MODULE);
            assert.deepEqual(page.pageErrors, [], 'the component must mount without throwing');
            return fn(page);
        });

        test('the emulated geometry is the one the suite asked for', () => mounted(async (page) => {
            const env = JSON.parse(await page.eval(
                'JSON.stringify({dpr: devicePixelRatio, w: innerWidth, h: innerHeight})',
            ));
            assert.equal(env.dpr, geometry.deviceScaleFactor);
            assert.equal(env.w, geometry.width);
        }));

        /* ===================================================================
         * 1. IT IS A #3 USE — the row's own sentence, made measurable
         * =================================================================== */

        test('a preset row renders exactly one ui-bank and no control of its own',
            () => mounted(async (page) => {
                const shape = await page.evalFn(() => {
                    const root = document.getElementById('dose').shadowRoot;
                    const banks = [...root.querySelectorAll('ui-bank')];
                    return {
                        banks: banks.length,
                        mode: banks[0]?.getAttribute('mode'),
                        role: banks[0]?.getAttribute('role'),
                        /* Anything else that could take a click or a key. A second
                         * control here would be a fourth idiom starting again. */
                        strays: [...root.querySelectorAll('button, input, a[href], [role]')]
                            .filter((el) => el.tagName !== 'UI-BANK').length,
                    };
                });
                assert.equal(shape.banks, 1, 'one bank, not a hand-built copy of one (spec §5.2 #37)');
                assert.equal(shape.mode, 'toolbar');
                assert.equal(shape.role, 'group',
                    'the element carrying the group role is the bank, so the accessible group and '
                    + 'the painted box are one element');
                assert.equal(shape.strays, 0, 'no control of this component\'s own — the presets are the bank\'s buttons');
            }));

        test('APPENDIX 15: the cells speak ONE aria spelling, aria-pressed, and exactly one is true',
            () => mounted(async (page) => {
                /* Slate's preset buttons carry no role at all, which ui-bank.js:204-207
                 * maps to the aria-pressed spelling; toolbar mode is also the one where
                 * arrows move the tab stop instead of pressing a button the user only
                 * arrowed past (ui-bank.js:700-706) — and every press here asks a machine
                 * to change a setting. */
                const cells = await page.eval(CELLS('dose'));
                assert.equal(cells.length, 4, 'four presets, four cells');
                assert.deepEqual(cells.map((c) => c.pressed), ['false', 'false', 'true', 'false'],
                    'the active cell is the one the VALUE matches (40 is preset index 2)');
                for (const c of cells) {
                    assert.equal(c.role, null, 'no role on the cell: a toolbar button is a button');
                    assert.equal(c.selected, null, 'one spelling, not three');
                    assert.equal(c.checked, null);
                }
                assert.deepEqual(cells.map((c) => c.tabindex), ['-1', '-1', '0', '-1'],
                    'one tab stop for the row, on the active cell — the roving contract');
            }));

        test('the group takes the row\'s name, and the role-less host gives its own up (bug L23 symptom 1)',
            () => mounted(async (page) => {
                /* L23: "aria-label on role-less <div>s (x3)". A screen that writes the
                 * ordinary spelling still gets a named group, and the copy on the generic
                 * host is MOVED rather than duplicated — Chrome exposes an aria-label on a
                 * role-less element anyway, so leaving it would announce the row twice. */
                await page.mount(
                    `<ui-preset-bank id="named" aria-label="Steam flow presets" value="0.8"
                        presets='[0.6,0.8,1.0,1.2]'></ui-preset-bank>`,
                    MODULE,
                );
                await page.settle(3);
                const got = await page.evalFn(() => {
                    const row = document.getElementById('named');
                    return {
                        host: row.getAttribute('aria-label'),
                        hostRole: row.getAttribute('role'),
                        bank: row.shadowRoot.querySelector('#presets').getAttribute('aria-label'),
                        name: row.accessibleName,
                    };
                });
                assert.equal(got.bank, 'Steam flow presets', 'the name lands on the element carrying the group role');
                assert.equal(got.host, null, 'and does not stay on the role-less host as a second announcement');
                assert.equal(got.hostRole, null, 'the host takes no role of its own');
                assert.equal(got.name, 'Steam flow presets', 'and the component can still say what its name is');
            }));

        test('`label` is the API and it reaches the group', () => mounted(async (page) => {
            const got = await page.prop(bank('dose'), 'display');
            assert.equal(got, 'grid', 'the bank is there to be named');
            const name = await page.evalFn(() =>
                document.getElementById('dose').shadowRoot.querySelector('#presets').getAttribute('aria-label'));
            assert.equal(name, 'Drink weight presets');
        }));

        /* ===================================================================
         * 2. GEOMETRY — four equal cells, the touch floor, the container
         * =================================================================== */

        test('four equal cells across the container — the stepper\'s shape without the stepper\'s numbers',
            () => mounted(async (page) => {
                /* CITE live-ready #drink-out-preset-1..4 [i=37..40] at x=134 / 201 / 268 /
                 * 335, 67 wide each: 4 x 67 = 268 = the width of .slate-stepper (268 x 64
                 * in all 85 elements the corpus finds). Slate reaches it with
                 * width: 374px !important and padding-left: 106px — frozen alignment
                 * arithmetic in bug L5's family, disqualified. ui-bank's flex: 1 1 0 gives
                 * the same shape from the container, at any container. */
                const stage = await page.box('#stage');
                const host = await page.box('#dose');
                const cells = await Promise.all([0, 1, 2, 3].map((i) => page.box(cell('dose', i))));
                near(host.width, stage.width, 'the row fills the column it is given');
                near(cells[0].width, cells[1].width, 'equal cells');
                near(cells[1].width, cells[2].width, 'equal cells');
                near(cells[2].width, cells[3].width, 'equal cells');
                const border = parseFloat(await page.resolveValue('var(--ui-border-w)', 'width'));
                near(cells.reduce((sum, c) => sum + c.width, 0), stage.width - 2 * border,
                    'four cells and the bank\'s two hairlines are the whole row');
            }));

        test('THE DEPARTURE, measured: the cell IS the hit box, and it clears --ui-hit-min',
            () => mounted(async (page) => {
                /* Slate paints a 34px box and lifts the hit area back to the floor with an
                 * invisible ::before — spec Appendix 5 carries the pattern forward:
                 * "Hit area is separate from ink — ::before at max(100%,
                 * var(--slate-hit-min)) on presets (slate-live.css:781-790)".
                 * CITE live-ready #drink-out-preset-3 [i=39] min-height = 34px, rect 67x34.
                 *
                 * A #3 use cannot express it: the pressable element is ui-bank's button
                 * inside ui-bank's shadow root, under a host with overflow: hidden, so an
                 * overlay from outside is clipped back to the box on the one axis Slate
                 * grows. The ink box becomes the hit box instead, at #3's own floor. This
                 * is the assertion that would fail if a later compact variant shrank the
                 * row without solving the hit area — bug L22's exact shape (32 x 35
                 * against a 48px floor, on a wall panel operated with a wet hand). */
                /* THE CELL IS --ui-hit-min SINCE 23 Aug, and that is this assertion
                 * getting CLOSER to Slate rather than further from it. Ben's ruling made
                 * the row text rather than a control — "just numbers with line
                 * underneath" — so the bank wears its `plain` form: a 48px cell in a
                 * 50px row, against the 62-in-64 it used to be. Slate's 34 is still not
                 * reachable for the reason above (the ink box IS the hit box here), so
                 * the floor is what the cell measures, exactly.
                 *
                 * THE WARNING IN THE NOTE ABOVE IS THE POINT AND IT STILL BINDS: a
                 * variant that shrank the row without solving the hit area is bug L22.
                 * This one did not — 48 is the floor itself, asserted below as well. */
                const hitMin = parseFloat(await page.resolveValue('var(--ui-hit-min)', 'height'));
                const box = await page.box(cell('dose', 0));
                near(box.height, hitMin, 'the cell is --ui-hit-min tall, from #3\'s plain form');
                await assertHitFloor(page, cell('dose', 0), { mode: 'box' });
                const generated = await page.computed(cell('dose', 0), ['content'], { pseudo: '::before' });
                assert.equal(generated.content, 'none',
                    'and there is no hit overlay pretending otherwise — the box is the whole answer');
            }));

        test('CONTAINER FLOOR: squeezed to 240px the row shrinks its cells, clips nothing and keeps the touch floor',
            () => mounted(async (page) => {
                /* The component reads its own container, never the viewport (spec §2.1
                 * Rule 1) — so this measures identically at both geometries. Below the
                 * label width the bank ellipsises, which is content that is still THERE:
                 * spec §2.4's ban is on content silently removed. */
                await page.setStyle('#stage', { 'inline-size': '240px' });
                await page.settle(2);
                const host = await page.metrics('#dose');
                const b = await page.metrics(bank('dose'));
                near(host.rect.width, 240, 'the row is the container');
                assert.ok(host.scrollWidth <= host.clientWidth + 0.5,
                    `nothing is silently removed from the host: scrollWidth ${host.scrollWidth} vs clientWidth ${host.clientWidth}`);
                assert.ok(b.scrollWidth <= b.clientWidth + 0.5,
                    `nor from the bank: scrollWidth ${b.scrollWidth} vs clientWidth ${b.clientWidth}`);
                await assertHitFloor(page, cell('dose', 0), { mode: 'box', axes: ['block'] });
                const cells = await Promise.all([0, 3].map((i) => page.box(cell('dose', i))));
                near(cells[0].width, cells[1].width, 'still equal cells at the floor');
            }));

        test('TOKEN DRILL: the resting ink and the bank ground are read through two shadow boundaries',
            () => mounted(async (page) => {
                /* Tokens are consumed, not copied (Part 8 §2 assertion 1) — and here the
                 * consumer is two components down. CITE live-ready #drink-out-preset-1
                 * [i=37] color authored color-mix(in srgb, var(--slate-muted) 90%,
                 * var(--slate-text)): Slate lifts the resting ink off --slate-muted, a
                 * fifth resting ink in a library with one. Not carried; the resting cell
                 * is #3's --ui-muted and moves with it. */
                await assertTokenDrill(page, {
                    token: '--ui-muted', selector: cell('dose', 0), property: 'color',
                });
                /* THE BANK'S GROUND IS NO LONGER --ui-key, AND THAT IS BEN'S RULING.
                 * 23 Aug 2026: "the presets ... shouldn't be the normal toggle, but
                 * insted the same look slate had with just numbers with line underneath".
                 * "Just numbers" is text on the rail's own ground, so ui-preset-bank
                 * switches the composed bank's key fill and frame off (an outer-tree
                 * rule on the element, the same mechanism its disabled rule uses). A
                 * token drill on a surface that no longer paints would be asserting a
                 * rule nothing applies. What replaces it is the claim that matters —
                 * the row shows the rail through. */
                const ground = await page.computed(bank('dose'), ['background-color', 'border-top-color']);
                assert.equal(ground['background-color'], 'rgba(0, 0, 0, 0)',
                    'the preset row still paints a container: "just numbers" means the rail shows through');
                assert.equal(ground['border-top-color'], 'rgba(0, 0, 0, 0)',
                    'the preset row still draws a frame');
            }));

        /* ===================================================================
         * 3. NO PRIVATE SELECTED LOOK — the fourth idiom, deleted
         * =================================================================== */

        test('DIAL DRILL: the active preset is painted by the four dials and nothing else',
            () => mounted(async (page) => {
                /* SCOPED TO THE HOST, because the three dials this row reads are aimed
                 * at `ui-preset-bank` in styles/tokens.css rather than at :root (Ben's
                 * 23 Aug ruling — the underlined-number idiom). The claim is unchanged:
                 * whatever the dials say, THEY are what paints the selected cell. */
                await assertOneSelectionTreatment(page, {
                    selected: cell('dose', 2),
                    unselected: cell('dose', 1),
                    scope: '#dose',
                    /* THE LED IS THE DIFFERENTIATOR HERE, not the face: this row's
                     * selected cell is an underlined number on a transparent ground. */
                    contrast: 'led',
                });
            }));

        test('the active preset is an UNDERLINED number, not a filled cell — Slate\'s own idiom',
            () => mounted(async (page) => {
                /* IT USED TO BE --ui-steel ON --ui-on-steel, which is what the dials
                 * ship and what every other selection in the skin wears. Ben, 23 Aug
                 * 2026: "the presets for Drink weight, Steam flow shouldn't be the
                 * normal toggle, but insted the same look slate had with just numbers
                 * with line underneath highlighting what value is selected."
                 *
                 * That is Slate's own paint for this row — measured in the component's
                 * header, where it is also called a BUG, because Slate reaches none of
                 * it through a dial. Here it IS the dials, re-aimed for this element in
                 * styles/tokens.css (a component may not re-declare a public token —
                 * Gate C's private-palette guard, bug L12). So the assertion is not
                 * "no dials any more", it is "the same three dials, different values". */
                const got = await page.computed(cell('dose', 2),
                    ['background-color', 'color', 'box-shadow']);
                assert.equal(got['background-color'], 'rgba(0, 0, 0, 0)',
                    'the selected preset is still a filled cell');
                assert.equal(got.color, await page.resolveToken('--ui-text', 'color'));
                /* The underline IS --ui-selected-led, drawn by selectionSurface as an
                 * inset bottom bar in currentColor — the mechanism Slate's Settings nav
                 * uses, so there is no ::after and no fifth property here. */
                /* `padding-top` and not `border-top-width`: a border width computes to
                 * 0 without a border-style, which reads as "the token is empty" when it
                 * is not. A padding resolves a bare length. */
                const led = parseFloat(await page.resolveToken('--ui-toggle-led', 'padding-top'));
                assert.ok(led > 0, `--ui-toggle-led did not resolve to a length: ${led}`);
                const inset = /0px -([\d.]+)px 0px 0px inset/.exec(got['box-shadow']);
                assert.ok(inset, `no underline on the selected preset: ${got['box-shadow']}`);
                assert.equal(parseFloat(inset[1]), led,
                    'the underline is not --ui-toggle-led deep — a second number entered the row');
            }));

        test('the active preset gains a weight step, as Slate\'s own idiom does — but through the dial',
            () => mounted(async (page) => {
                /* CITE live-ready #drink-out-preset-3 [i=39] font-weight = 400 against
                 *      #drink-out-preset-1/2/4 [i=37/38/40] font-weight = 300: Slate's
                 *      fourth idiom lifts the active cell ONE step. It does it with a
                 *      private rule on .preset-active, on a 300 base of its own, on a
                 *      bank that also bypasses the selection dials entirely.
                 * This bank is #3 ui-bank, so its base is the bank's 400 and the step is
                 * the fifth dial's 500 — the same relationship, expressed once for every
                 * selection surface instead of a fourth time by hand. */
                const active = await page.prop(cell('dose', 2), 'font-weight');
                const resting = await page.prop(cell('dose', 3), 'font-weight');
                assert.equal(active, await page.resolveToken('--ui-selected-weight', 'font-weight'),
                    'the active cell reads --ui-selected-weight');
                assert.equal(resting, await page.resolveValue('var(--ui-weight-regular)', 'font-weight'),
                    'a resting cell keeps the bank\'s --ui-weight-regular');
                assert.notEqual(active, resting, 'the active cell is one step up, as Slate\'s is');
            }));

        test('WITH ALL FIVE DIALS NEUTRAL, an active preset and a resting one are indistinguishable',
            () => mounted(async (page) => {
                /* THE TEST THIS ROW EXISTS TO PASS. Slate's idiom is four painted
                 * properties keyed on .preset-active, and three of them survive every dial:
                 * CITE live-ready #drink-out-preset-3 [i=39] font-weight = 400 against
                 * [i=37] 300; font-size 18px; plus the steel text-shadow and the 42px
                 * ::after underline read from source. Turn the dials off and any such rule
                 * becomes the only thing left painting.
                 * ONE OF THOSE FOUR — the weight — stopped surviving at parity surface 2,
                 * because it became the fifth dial rather than staying a rule. It is
                 * neutralised here with the rest, which is the whole difference between a
                 * treatment a fork can retarget and one it cannot.
                 *
                 * Cells 2 and 3 rather than 0 and 1, so both sides carry #3's inset seam
                 * and the seam is not mistaken for a treatment. */
                /* NEUTRALISED AT BOTH SCOPES SINCE 23 Aug. Two of the five now come
                 * from the `ui-preset-bank` block in styles/tokens.css rather than from
                 * :root, and a :root override cannot reach past a more specific one. So
                 * the row's own host is neutralised too — inline, which beats both — and
                 * the claim this test exists for is untouched: turn every dial off and
                 * an active preset is indistinguishable from a resting one, because
                 * there is nothing else in this component that can paint it. */
                await page.setToken('--ui-selected-face', 'transparent');
                await page.setToken('--ui-selected-ink', 'currentColor');
                await page.setToken('--ui-selected-led', '0px');
                await page.setToken('--ui-selected-glow', '0%');
                await page.setToken('--ui-selected-weight', 'var(--ui-weight-regular)');
                await page.setStyle('#dose', {
                    '--ui-selected-face': 'transparent',
                    '--ui-selected-ink': 'currentColor',
                    '--ui-selected-led': '0px',
                });
                try {
                    const active = await page.computed(cell('dose', 2), NON_DIAL_PROPERTIES);
                    const resting = await page.computed(cell('dose', 3), NON_DIAL_PROPERTIES);
                    const differing = Object.keys(active).filter((k) => active[k] !== resting[k]);
                    /* border-top-color is the one allowed residual: its initial value IS
                     * currentColor, so it follows the ink dial by definition. The same
                     * carve-out, for the same reason, as ui-bank and ui-tab-bar. */
                    assert.deepEqual(differing.filter((k) => k !== 'border-top-color'), [],
                        'an active preset differs from a resting one with every dial turned off — that is '
                        + 'the fourth idiom, alive. Differing: '
                        + JSON.stringify(Object.fromEntries(differing.map((k) => [k, [active[k], resting[k]]]))));

                    const shadows = await page.computed(cell('dose', 2), ['box-shadow', 'text-shadow']);
                    assert.match(lastSegment(shadows['box-shadow']), /(^|\s)0px 0px 0px 0px(\s|$)/,
                        `the LED dial at 0px must leave a zero-extent segment: ${shadows['box-shadow']}`);
                } finally {
                    for (const dial of ['--ui-selected-face', '--ui-selected-ink',
                        '--ui-selected-led', '--ui-selected-glow', '--ui-selected-weight']) {
                        await page.setToken(dial, null);
                    }
                    await page.setStyle('#dose', {
                        '--ui-selected-face': null,
                        '--ui-selected-ink': null,
                        '--ui-selected-led': null,
                    });
                }
            }));

        test('the 42px underline is inexpressible: neither cell generates a pseudo-element',
            () => mounted(async (page) => {
                /* SOURCE slate-live.css:791-800 (read-only; the corpus never probed
                 * text-shadow or ::after — prov_query answered "not no rule, but never
                 * measured"): `#main-page #shot-settings .preset-active::after` draws a
                 * 42px, 1px strip in 72% steel under the active number, and the glow above
                 * it is a text-shadow in --slate-steel at --slate-glow. Both are painted
                 * decoration keyed on the selected state, and both are gone: there is no
                 * rule in this component or in #3 that can generate one. */
                for (const [row, index] of [['dose', 2], ['dose', 1]]) {
                    const after = await page.computed(cell(row, index), ['content'], { pseudo: '::after' });
                    assert.equal(after.content, 'none',
                        `cell ${index} generates an ::after — the fourth idiom's underline is back`);
                }
            }));

        test('one turn of the row\'s own dial moves every preset row in the page together',
            () => mounted(async (page) => {
                /* The founding defect in one sentence: "re-skinning selection changes the
                 * tabs and leaves the favourites alone". Three rows, one implementation.
                 *
                 * THE TURN IS AIMED AT THE ELEMENT, NOT AT :root, AND THAT IS THE COST OF
                 * BEN'S 23 Aug RULING. He asked for Slate's preset idiom back — numbers
                 * with a line underneath — so styles/tokens.css aims three selection
                 * dials at `ui-preset-bank`, and a :root turn no longer reaches this row.
                 * That is a real consequence and it is stated here rather than hidden:
                 * a fork retargeting the whole skin must turn the element block too.
                 *
                 * What the founding defect was actually about survives intact, and is
                 * what this test still proves: ONE turn moves EVERY preset row, because
                 * there is one implementation behind the boundary and no per-instance
                 * rule anywhere. The dial drilled is the one that carries this row's
                 * selection — the LED — for the same reason. */
                const sheet = await page.evalFn((value) => {
                    const el = document.createElement('style');
                    el.id = 'fork-retarget';
                    el.textContent = `ui-preset-bank { --ui-selected-led: ${value}; }`;
                    document.head.append(el);
                    return true;
                }, DRILL_LENGTH);
                assert.ok(sheet);
                await page.settle(2);
                const dose = await page.prop(cell('dose', 2), 'box-shadow');
                const steam = await page.prop(cell('steam', 1), 'box-shadow');
                await page.evalFn(() => (document.getElementById('fork-retarget').remove(), true));
                const want = new RegExp(`-${parseFloat(DRILL_LENGTH)}px`);
                assert.match(dose, want, 'the drink row followed the dial');
                assert.match(steam, want, 'and so did the steam row, with no per-instance rule');
            }));

        test('E10\'s mechanism: a document sheet aimed at every Slate class reaches nothing',
            () => mounted(async (page) => {
                const before = await page.computed(cell('dose', 2),
                    ['background-color', 'color', 'font-weight', 'box-shadow']);
                await page.evalFn(() => {
                    const s = document.createElement('style');
                    s.textContent = `
                        .item, .presets, .preset-active, .slate-preset-bank,
                        .slate-bank-item, .is-selected, [aria-pressed="true"],
                        ui-preset-bank *, ui-preset-bank > *, ui-bank * {
                            background-color: rgb(1, 2, 3) !important;
                            color: rgb(4, 5, 6) !important;
                            font-weight: 900 !important;
                            box-shadow: none !important;
                        }`;
                    document.head.append(s);
                    return true;
                });
                await page.settle(2);
                const after = await page.computed(cell('dose', 2),
                    ['background-color', 'color', 'font-weight', 'box-shadow']);
                assert.deepEqual(after, before,
                    'load order stops being a mechanism once there is one implementation behind a boundary');
            }));

        test('the component paints with no !important anywhere in its own sheets', () => mounted(async (page) => {
            const bad = await page.evalFn(() => {
                const sheets = document.getElementById('dose').shadowRoot.adoptedStyleSheets || [];
                const hits = [];
                const walk = (rules) => {
                    for (const rule of rules) {
                        if (rule.cssRules) { walk(rule.cssRules); continue; }
                        const s = rule.style;
                        if (!s) continue;
                        for (let i = 0; i < s.length; i++) {
                            if (s.getPropertyPriority(s[i]) === 'important') hits.push(`${rule.selectorText} { ${s[i]} }`);
                        }
                    }
                };
                for (const sheet of sheets) walk(sheet.cssRules);
                return hits;
            });
            assert.deepEqual(bad, [], 'zero !important, base rules included (spec §2.1 Rule 3)');
        }));

        test('this component\'s own sheet declares no colour and no selection state at all',
            () => mounted(async (page) => {
                /* The subtraction, read off the live CSSOM rather than the source text. If
                 * ui-preset-bank could express "active" it would need a colour property or
                 * a state selector, and it has neither — the structural twin of the
                 * neutral-dial test above. */
                const found = await page.evalFn(() => {
                    const sheets = document.getElementById('dose').shadowRoot.adoptedStyleSheets || [];
                    const own = sheets[sheets.length - 1];
                    const colourish = /(^|-)(color|background|box-shadow|text-shadow|fill|stroke|opacity)$/;
                    const out = { colour: [], selection: [], rules: 0 };
                    for (const rule of own.cssRules) {
                        if (!rule.style) continue;
                        out.rules++;
                        if (/aria-pressed|aria-selected|aria-checked|aria-current|\.item|\bselected\b|preset-active/
                            .test(rule.selectorText || '')) {
                            out.selection.push(rule.selectorText);
                        }
                        for (let i = 0; i < rule.style.length; i++) {
                            const prop = rule.style[i];
                            if (!colourish.test(prop)) continue;
                            /* `opacity: 1` is the ABSENCE of paint: it is how a component
                             * opts out of a dial someone else applied, which is ui-bank's
                             * own answer to the same compounding and the only shape allowed
                             * through here. */
                            if (prop === 'opacity' && rule.style.getPropertyValue(prop).trim() === '1') continue;
                            /* `transparent` is the ABSENCE of paint too, and it is here
                             * for the same reason: Ben's 23 Aug ruling made this row
                             * "just numbers" on the rail's own ground, so the component
                             * switches the composed bank's key fill and frame OFF from
                             * out here. Turning a colour off is not declaring one — what
                             * shows through is the rail, which keeps its one owner. A
                             * real colour in either property still fails, which is the
                             * fourth idiom this test exists to keep dead. */
                            if (rule.style.getPropertyValue(prop).trim() === 'transparent') continue;
                            out.colour.push(`${rule.selectorText} { ${prop}: ${rule.style.getPropertyValue(prop)} }`);
                        }
                    }
                    return out;
                });
                assert.deepEqual(found.colour, [],
                    'a preset bank that declares a colour has restarted the fourth idiom');
                assert.deepEqual(found.selection, [],
                    'and one that can select is one that can select DIFFERENTLY');
                assert.ok(found.rules > 0, 'the sheet under test is this component\'s, not an empty one');
            }));

        /* ===================================================================
         * 4. THE HIGHLIGHT IS DERIVED, AND READ-ONLY IN BOTH DIRECTIONS
         * =================================================================== */

        test('a press does NOT light the pressed cell — it publishes an intent and waits for the value',
            () => mounted(async (page) => {
                /* steam-mode.js:57-75: "The highlight is DERIVED from the current flow
                 * value, read-only in both directions: this function never yields a flow
                 * value and callers must never write one when applying it (the old boot
                 * path did the reverse, pushing the persisted tap-index's VALUE into the
                 * workflow, silently resetting a hand-dialed flow on every app load)."
                 *
                 * ui-bank is uncontrolled and lights the cell it was pressed on
                 * (ui-bank.js:652-657). Held controlled, the row shows what the machine
                 * has, not what it was asked for — so a refused or slow write cannot leave
                 * the rail lying about the machine. A REAL CDP click, because the whole
                 * claim is about what happens on a press. */
                await page.recordEvents('#dose', ['preset-select', 'change']);
                await page.click(cell('dose', 3));
                await page.settle(2);

                const cells = await page.eval(CELLS('dose'));
                assert.deepEqual(cells.map((c) => c.pressed), ['false', 'false', 'true', 'false'],
                    'the pressed cell did not light and the active one did not move — value is still 40');

                const events = await page.recordedEvents();
                assert.equal(events.length, 1, `exactly one event leaves the host: ${JSON.stringify(events)}`);
                assert.equal(events[0].type, 'preset-select', 'the bank\'s own change is stopped, not re-fired');
                assert.equal(events[0].detail.value, 50, 'the intent carries the preset NUMBER');
                assert.equal(typeof events[0].detail.value, 'number',
                    'a number, never the rendered label — reading numbers back out of printed strings is '
                    + 'the worst coupling the audit found (chart.js:1664-1678)');
                assert.equal(events[0].detail.index, 3);
                assert.equal(events[0].detail.label, '50');
            }));

        test('the highlight moves when, and only when, the value comes back changed',
            () => mounted(async (page) => {
                await page.evalFn(() => { document.getElementById('dose').value = 50; return true; });
                await page.settle(2);
                const cells = await page.eval(CELLS('dose'));
                assert.deepEqual(cells.map((c) => c.pressed), ['false', 'false', 'false', 'true'],
                    'the machine took 50, so now 50 is lit');
            }));

        test('pressing the already-active preset asks for nothing', () => mounted(async (page) => {
            await page.recordEvents('#dose', ['preset-select', 'change']);
            await page.click(cell('dose', 2));
            await page.settle(2);
            assert.deepEqual(await page.recordedEvents(), [],
                'the value is already what that press would ask for; a second write would be noise');
        }));

        test('a keyboard walk moves the tab stop without pressing anything (toolbar, not radio)',
            () => mounted(async (page) => {
                /* ui-bank.js:700-706, the one departure from selection-follows-focus:
                 * "toolbar mode spells its state aria-pressed, where selection following
                 * focus would press a button the user only arrowed past. There, arrows move
                 * the tab stop and Space/Enter chooses." On a wall panel that is the
                 * difference between arrowing across a preset row and asking the machine
                 * for three settings on the way past. */
                await page.recordEvents('#dose', ['preset-select']);
                await page.focusVisible(cell('dose', 2));
                await page.press('ArrowRight');
                await page.settle(2);

                const after = await page.eval(CELLS('dose'));
                assert.deepEqual(after.map((c) => c.tabindex), ['-1', '-1', '-1', '0'],
                    'the tab stop moved to the next cell');
                assert.deepEqual(after.map((c) => c.pressed), ['false', 'false', 'true', 'false'],
                    'and nothing was pressed on the way');
                assert.deepEqual(await page.recordedEvents(), [], 'so the machine was not asked for anything');

                await page.press(' ');
                await page.settle(2);
                const events = await page.recordedEvents();
                assert.equal(events.length, 1, 'Space is what chooses');
                assert.equal(events[0].detail.value, 50);
            }));

        /* ===================================================================
         * 5. NOTHING ACTIVE, AND ABSENCE
         * =================================================================== */

        test('a hand-dialled value lights nothing — Slate\'s own live-ready state',
            () => mounted(async (page) => {
                /* CITE live-ready: `find --cls has-context-menu` returns 8 preset buttons in
                 * this state — drink-out 30/36/40/50 at y=395 and steam-flow 0.6/0.8/1.0/1.2
                 * at y=764 — while `find --cls preset-active` returns exactly one. The steam
                 * row ships with no active preset because the flow was hand-dialled. */
                const cells = await page.eval(CELLS('flow'));
                assert.deepEqual(cells.map((c) => c.pressed), ['false', 'false', 'false', 'false'],
                    '0.9 matches no preset, so nothing is lit');
                const index = await page.evalFn(() => document.getElementById('flow').activeIndex);
                assert.equal(index, -1, 'and the component says so: -1, the honest state');
                assert.deepEqual(cells.map((c) => c.tabindex), ['0', '-1', '-1', '-1'],
                    'the row is still reachable by keyboard — the tab stop falls to the first cell');
            }));

        test('an absent value highlights nothing and invents nothing (A7)', () => mounted(async (page) => {
            const cells = await page.eval(CELLS('absent'));
            assert.deepEqual(cells.map((c) => c.pressed), ['false', 'false', 'false', 'false']);
            const index = await page.evalFn(() => document.getElementById('absent').activeIndex);
            assert.equal(index, -1, 'absence is a state, not a prompt to compute a default');
        }));

        test('an absence object from the address layer is an absence, not a zero', () => mounted(async (page) => {
            await page.evalFn(() => {
                document.getElementById('flow').value = { noReading: true, reason: 'absent' };
                return true;
            });
            await page.settle(2);
            const cells = await page.eval(CELLS('flow'));
            assert.deepEqual(cells.map((c) => c.pressed), ['false', 'false', 'false', 'false'],
                'hasReading() is the whole policy: an absence never coerces to a number');
        }));

        test('labels are printed at the row\'s step, so 1.0 is not 1', () => mounted(async (page) => {
            /* CITE live-ready texts: the drink row prints "30" "36" "40" "50" and the
             * steam-flow row "0.6" "0.8" "1.0" "1.2". The second is the reason the step
             * exists: String(1.0) is "1", which would print wrong AND stop matching a
             * machine value of 1.0. One formatter (units.js formatToStep) reads both the
             * label and the match, so they cannot drift apart. */
            const dose = await page.eval(CELLS('dose'));
            const flow = await page.eval(CELLS('flow'));
            assert.deepEqual(dose.map((c) => c.text), ['30', '36', '40', '50']);
            assert.deepEqual(flow.map((c) => c.text), ['0.6', '0.8', '1.0', '1.2']);
        }));

        test('the match is at display precision, not at float equality', () => mounted(async (page) => {
            await page.evalFn(() => { document.getElementById('flow').value = 0.7999999999; return true; });
            await page.settle(2);
            const cells = await page.eval(CELLS('flow'));
            assert.deepEqual(cells.map((c) => c.pressed), ['false', 'true', 'false', 'false'],
                'a value that PRINTS as 0.8 is 0.8 — steam-mode.js:60, "matching is at the tile\'s '
                + '0.1 ml/s display precision"');
        }));

        test('THE STEAM TABLE: this row carries no limits, and the values it shows clear the 135 floor',
            () => mounted(async (page) => {
                /* B2/R2: exactly one limits/ranges table in the skin, behind r2MachineLimits.
                 * A preset row is choices, not bounds — it neither clamps nor validates, so
                 * there is no second table here to disagree with the first. What the suite
                 * CAN prove is that the row renders whatever it is handed, and that the
                 * steam values in this repo's own fixtures are the corrected ones: floor
                 * 135, ceiling 165 Bengle / 160 DE1 (CARRY_FORWARD.md §3c). 130 is the
                 * retired table's dead band with the heater off. */
                const cells = await page.eval(CELLS('steam'));
                assert.deepEqual(cells.map((c) => c.text), ['135', '145', '155', '165']);
                const numbers = cells.map((c) => Number(c.text));
                assert.ok(numbers.every((n) => n >= 135 && n <= 165),
                    'every steam preset in this suite sits inside the corrected range');
                assert.ok(!numbers.includes(130) && !numbers.includes(170),
                    'the 130/170 table is B3\'s retired defect and does not appear here');
            }));

        /* ===================================================================
         * 6. FOCUS, AND DISABLED
         * =================================================================== */

        test('FOCUS UNCLIPPED: the ring is the token ring and the bank\'s overflow does not cut it',
            () => mounted(async (page) => {
                /* Bug L24, "focus rings clipped on all four sides by the components they sit
                 * inside" — and a bank clips by construction, because overflow: hidden is
                 * what lets the radius cut a selected face at the end corners. #3 declares
                 * the inset offset for the whole component rather than asking a consumer to
                 * remember it (ui-bank.js:321-330); this asserts the consequence through the
                 * composition, on the corner cell, which is where a clip shows first. */
                await assertFocusUnclipped(page, cell('dose', 0));
                await assertFocusUnclipped(page, cell('dose', 3));
            }));

        test('DISABLED: one fade, not two multiplied', () => mounted(async (page) => {
            /* ui-bank.js:496-505's arithmetic, one level up: without the opt-out the base
             * dims the host AND the bank and they compound to .38 x .38 = .14. */
            await page.evalFn(() => { document.getElementById('dose').disabled = true; return true; });
            await page.settle(2);
            const dial = await page.resolveValue('var(--ui-opacity-disabled)', 'opacity');
            const host = await page.prop('#dose', 'opacity');
            const inner = await page.prop(bank('dose'), 'opacity');
            assert.equal(host, dial, 'the host a screen disabled keeps the dial');
            assert.equal(inner, '1', 'the bank inside it opts out, so the two do not multiply');

            await page.recordEvents('#dose', ['preset-select']);
            await page.click(cell('dose', 0));
            await page.settle(2);
            assert.deepEqual(await page.recordedEvents(), [],
                'and the press is refused by the native disabled attribute, not only dimmed');
        }));

        test('a disabled PRESET is still matched — the highlight reports what the value is',
            () => mounted(async (page) => {
                await page.mount(
                    `<ui-preset-bank id="mixed" label="Hot water volume presets" value="400"
                        presets='[{"value":50},{"value":150},{"value":400,"disabled":true}]'></ui-preset-bank>`,
                    MODULE,
                );
                await page.settle(3);
                const cells = await page.eval(CELLS('mixed'));
                assert.deepEqual(cells.map((c) => c.pressed), ['false', 'false', 'true'],
                    'the machine is at 400, so 400 is lit even though the row will not take the press');
                assert.deepEqual(cells.map((c) => c.disabled), [false, false, true]);
            }));
    });
}

/* ===========================================================================
 * THE GALLERY ENTRY — its own file, per the parallel-builder rule
 * =========================================================================== */

test('the gallery entry has the shape entries.js documents', () => {
    assert.equal(galleryEntry.id, 'ui-preset-bank', 'the entry id is the tag name and the capture prefix');
    assert.equal(galleryEntry.module, '../../src/components/ui-preset-bank.js', 'module is relative to tools/gallery/');
    assert.ok(galleryEntry.title && galleryEntry.notes);
    assert.ok(galleryEntry.states.length >= 1);
    const ids = galleryEntry.states.map((s) => s.id);
    assert.equal(new Set(ids).size, ids.length, 'state ids are capture filenames, so they must be unique');
    for (const s of galleryEntry.states) {
        assert.match(s.id, /^[a-z0-9-]+$/, `state id ${s.id} must be a kebab-case identifier, not a label`);
        assert.ok(s.title && s.html, `state ${s.id} needs a title and markup`);
    }
});

test('no gallery state ships the retired steam table', () => {
    /* Wave 4's stated block, checked where a builder is most likely to reproduce it —
     * example data. The corrected table is floor 135, ceiling 165 Bengle / 160 DE1. */
    for (const s of galleryEntry.states) {
        assert.ok(!/\b130\b|\b170\b/.test(s.html),
            `gallery state ui-preset-bank--${s.id} carries a 130/170 steam value`);
    }
});

test('every gallery state mounts and renders a bank with cells', async () => {
    await browser.withPage({ geometry: BENCH }, async (page) => {
        for (const state of galleryEntry.states) {
            await page.mount(state.html, MODULE);
            assert.deepEqual(page.pageErrors, [], `gallery state ui-preset-bank--${state.id} threw`);
            const shape = await page.evalFn(() => [...document.querySelectorAll('ui-preset-bank')].map((row) => {
                const b = row.shadowRoot.querySelector('#presets');
                return {
                    bank: Boolean(b),
                    role: b?.getAttribute('role'),
                    cells: b ? b.shadowRoot.querySelectorAll('.item').length : 0,
                    pressed: b ? [...b.shadowRoot.querySelectorAll('.item')]
                        .filter((el) => el.getAttribute('aria-pressed') === 'true').length : 0,
                };
            }));
            assert.ok(shape.length >= 1, `state ${state.id} rendered no preset bank`);
            for (const row of shape) {
                assert.ok(row.bank, `state ${state.id} rendered a row with no bank`);
                assert.equal(row.role, 'group');
                assert.ok(row.cells >= 3, `state ${state.id} rendered ${row.cells} cells`);
                assert.ok(row.pressed <= 1, `state ${state.id} lit ${row.pressed} cells — a row has at most one`);
            }
        }
    });
});
