/**
 * live-bands.render.test.mjs — the Live bands in a real engine, at both Gate A sizes.
 *
 * The bands are the header (library button, favourites, actions), the rail of target
 * steppers with L25's two restored toggles, the STOP overlay, the numpad, and the foot
 * band's phase table and controls. Everything here is a LIBRARY component composed by
 * `live-screen`, so this suite asserts TAG NAMES and shadow-root facts rather than
 * looks: a lookalike passes a screenshot and fails `assert.equal(tag, 'ui-bank')`.
 *
 * WHAT IT COVERS, one line each:
 *   composition — every band is the real component, and the favourites bank IS the
 *       segmented bank underneath (L8's founding defect made un-photographable);
 *   L8 / L7 — one selection treatment across the two banks on this screen, proved by
 *       moving a dial and measuring both;
 *   the ranges are the DATA's — swap the limits table for the other machine class and
 *       the steppers move with it, with no reload and no second table;
 *   B3 — 135 / 165 hold at the control, and 130 / 170 are refused through the numpad;
 *   mode recomposition — a mode change does not move a row that stays;
 *   the numpad round trip — value cell to dialog to confirmed, clamped value;
 *   L25 — the toggles are visible, hit-floor sized, real controls;
 *   L21 / L22 / L23 / L24 — the accessibility cluster, one test each.
 *
 * The stage is the skeleton's own: `block-size: 100dvh`, so the screen gets the
 * definite height §4.1's `height: 100%` needs.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES, DESKTOP } from '../harness/index.js';
import { assertOneSelectionTreatment, assertHitFloor, assertFocusUnclipped } from '../harness/assertions.js';
import { CLOCK_FORMAT, DEFAULT_CLOCK_FORMAT } from '../../src/lib/wall-clock.js';

const MODULE = ['/src/screens/live-screen.js'];
const STAGE = '<div id="stage" style="inline-size: 100%; block-size: 100dvh"><live-screen></live-screen></div>';

const S = 'live-screen';
const RAIL = `${S} >>> live-rail`;

/** The favourites the oracle measured on `live-ready`: three occupied, two empty. */
const FAVOURITES = [
    { value: 'p1', name: 'Extractamundo Dos!' },
    { value: 'p2', name: 'Temp test' },
    { value: 'p3', name: 'Extract Blooming Espresso' },
    null,
    null,
];

/**
 * HOW A CLOCK IS SPELT WHEN NOBODY HAS CHOSEN — DERIVED, NEVER RESTATED.
 *
 * These two tests mount a screen with no `clockFormat` written, so what they read is
 * whatever the SHIPPED DEFAULT is. They used to say that in words — a 24-hour HH:MM
 * regex with the note "Slate's form is 24-hour HH:MM" — and it went stale the moment
 * the settings pass gave `settings-defaults.js` Ben's own answer for the key
 * (`clockFormat: '12h'`, 26 August 2026) and `wall-clock.js` started importing it
 * instead of declaring a second one. The clock then drew "3:04 AM" and this suite
 * failed six ways at both geometries, reporting a correct screen as a broken one.
 *
 * SLATE IS NOT THE AUTHORITY ON THIS ONE. The charter is that Decal follows Slate
 * except where Slate is wrong, and Ben outranks Slate-as-photographed; he was asked
 * for a default and he gave one. What this suite is entitled to assert is that the
 * Live header OBEYS the skin's default, not which default the skin ships — that
 * decision has an owner one module away, and it is not this file.
 *
 * SO THE EXPECTATION IS COMPUTED FROM THE OWNER. Change the table and this follows;
 * break the header's reader and this fails, which is the half that matters here.
 */
const CLOCK_SPELLING = DEFAULT_CLOCK_FORMAT === CLOCK_FORMAT.H12
    ? /^(1[0-2]|[1-9]):[0-5]\d\s[AP]M$/i
    : /^([01]\d|2[0-3]):[0-5]\d$/;

/** Targets for the screen to show. Values, not ranges — the ranges are the table's. */
const TARGETS = {
    dose: 17, drinkWeight: 40, brewTemp: 92,
    steamTemp: 155, steamFlow: 2.1, steamDuration: 45, milkStopTemp: 62,
    hotWaterTemp: 98, hotWaterVolume: 240,
    flushTemp: 90, flushFlow: 4, flushDuration: 5,
};

/**
 * Hand the screen its data the way the wiring row will: the limits table comes from
 * `r2MachineLimits` — the one door to the one table — computed IN THE PAGE from a
 * served capability answer, so this suite proves the whole route and not a fixture of
 * it. `entries` non-empty is ReaPrime's own "this is a Bengle"; `[]` is a DE1.
 */
const configure = (page, { entries = ['cupWarmer'], ...patch } = {}) => page.evalFn(async (served, props) => {
    const { r2MachineLimits } = await import('/src/data/adapters-r.js');
    const screen = window.__h.q('live-screen');
    screen.limits = served === null ? r2MachineLimits(null).value : r2MachineLimits(served).value;
    Object.assign(screen, props);
    await screen.updateComplete;
    return screen.limits ? Object.keys(screen.limits).length : 0;
}, entries, patch);

/** Every element in the rail, as tag + the state a test cares about. */
const RAIL_TREE = `(() => {
    const rail = window.__h.q('live-screen').shadowRoot.querySelector('live-rail');
    return [...rail.children].map((el) => {
        const r = el.getBoundingClientRect();
        const inner = el.tagName === 'DIV' ? [...el.children].map((c) => c.tagName.toLowerCase()) : [];
        const label = el.shadowRoot && el.shadowRoot.getElementById('label');
        return {
            tag: el.tagName.toLowerCase(),
            inner,
            key: el.dataset.key ?? null,
            row: el.dataset.row ?? null,
            sectionStart: el.hasAttribute('data-section-start'),
            /* The PAINTED name, so a claim about which rows grow can be written in the
               words a reader sees rather than in a data-key nobody reads. */
            label: label ? label.textContent.trim() : null,
            top: +r.top.toFixed(2),
            height: +r.height.toFixed(2),
            bottom: +r.bottom.toFixed(2),
        };
    });
})()`;

const railTree = (page) => page.eval(`JSON.stringify(${RAIL_TREE})`).then(JSON.parse);

/**
 * EVERY RAIL STEPPER, READ THROUGH ITS OWN SHADOW ROOT (finding cmp-lo-3).
 *
 * The row descriptor's `label` used to reach the control as an accessible name and
 * nothing else, so three espresso wells reading an em dash apiece were indistinguishable
 * by sight. What this reads back is the pair that must not drift: the string PAINTED and
 * the string the group is CALLED. `aria-labelledby` is followed to its element, because
 * the point of Ben's ruling is that they are one string and not two.
 */
const RAIL_LABELS = `(() => {
    const rail = window.__h.q('live-screen').shadowRoot.querySelector('live-rail');
    const out = [];
    /* ONE LEVEL IN WHERE A ROW IS WRAPPED. The first track is the abort target's
       one-cell grid (live-targets.js, abortSlot), so its stepper is a grandchild of the
       rail; a children-only walk quietly measured eight of the nine. */
    const rows = [...rail.children].map((el) => (el.tagName === 'UI-STEPPER' ? el : el.querySelector('ui-stepper')));
    for (const el of rows) {
        if (!el || el.tagName !== 'UI-STEPPER') continue;
        const root = el.shadowRoot;
        const label = root.getElementById('label');
        const band = root.querySelector('.band');
        const cap = root.getElementById('decrement');
        const value = root.getElementById('value');
        const named = band.getAttribute('aria-labelledby');
        const box = (node) => {
            const r = node.getBoundingClientRect();
            return { x: +r.x.toFixed(2), width: +r.width.toFixed(2), height: +r.height.toFixed(2),
                right: +r.right.toFixed(2) };
        };
        const range = document.createRange();
        if (label) range.selectNodeContents(label);
        out.push({
            key: el.dataset.key ?? null,
            property: el.label,
            visible: label ? label.textContent.trim() : null,
            spoken: named ? (root.getElementById(named)?.textContent ?? '').trim() : band.getAttribute('aria-label'),
            namedBy: named ? 'aria-labelledby' : 'aria-label',
            hidden: label ? getComputedStyle(label).display === 'none' : null,
            row: box(el),
            label: label ? box(label) : null,
            band: box(band),
            cap: box(cap).width,
            value: box(value).width,
            valueClipped: value.scrollWidth > value.clientWidth + 1,
            labelClipped: label ? label.scrollWidth > label.clientWidth + 1 : null,
        });
    }
    return out;
})()`;

const railLabels = (page) => page.eval(`JSON.stringify(${RAIL_LABELS})`).then(JSON.parse);

/** The stepper that carries one limit key, as a deep selector. */
const stepper = (key) => `${S} >>> ui-stepper[data-key="${key}"]`;

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`live bands @ ${geometry.name} (${geometry.width}x${geometry.height})`, () => {

        const mounted = (fn) => browser.withPage({ geometry }, async (page) => {
            await page.mount(STAGE, MODULE);
            await page.settle(6);
            assert.deepEqual(page.pageErrors, [], 'the bands must mount without throwing');
            await fn(page);
            assert.deepEqual(page.pageErrors, [], 'the bands must run without throwing');
        });

        /* -- 1. COMPOSITION: THE REAL COMPONENTS, BY TAG -------------------- */

        test('every band is a library component, named', () => mounted(async (page) => {
            await configure(page, { targets: TARGETS, favourites: FAVOURITES, favourite: 'p1', profileName: 'Londinium' });

            // The header's three clusters.
            const header = await page.evalFn(() => {
                const root = window.__h.q('live-screen').shadowRoot;
                const slotted = (name) => [...root.querySelectorAll(`[slot="${name}"]`)]
                    .map((el) => el.tagName.toLowerCase());
                return {
                    lead: slotted('lead'),
                    favourites: slotted('favourites'),
                    actions: [...root.querySelectorAll('[slot="actions"] > *')].map((el) => el.tagName.toLowerCase()),
                };
            });
            /* ONE control in the lead cluster since parity surface 1: the status chip moved
             * to the stat cluster's heading, where Slate draws the same one word
             * (ORACLE live-ready #machine-status [i=94] rect=[1607,177,161,22], the far
             * end of the profile-name line). Asserted where it now lives, below. */
            /* AN ICON BUTTON SINCE BEN'S LIVE-COMPOSITION RULING (22 Aug 2026), which is
             * Slate's own control: ORACLE live-ready #profile-open-selector [i=8]
             * `.slate-icon-btn` rect [30,18,82,82], no text. It was a labelled
             * ui-button here, and once the loaded profile's name was wired that button
             * rendered the same string the first favourite slot and the chart card's
             * heading already carried. Still a real, focusable, NAMED control — L21 is
             * asserted over every route out of this screen below. */
            assert.deepEqual(header.lead, ['ui-icon-button'], 'the library button is a real button (L21)');
            assert.deepEqual(header.favourites, ['ui-favourites-bank'], 'the favourites are the REAL bank (L8)');
            /* STILL TWO BUTTONS AND ONE ICON BUTTON, and wave 5.6 is why that is worth
             * saying: History became a route — a destination — and a fourth control
             * here was measured and REFUSED. This header gives from the favourites
             * bank, which declares no hit-floor-aware minimum, and in the espresso
             * state at the 1000x600 floor the bank is ALREADY at 54.7px per slot, only
             * 6.7px above --ui-hit-min. Any 64px control takes it to 39.5px and a
             * 146.7px text one to 38.9px — L22, caught by this file's own sweep below.
             * That is an H3-shaped defect in THIS header (the give coming from the
             * wrong item) and it is wave 5.1's to fix; History's way in went to the
             * foot band, where §4.5 puts it. */
            /* FIVE CONTROLS SINCE it14, AND THEY ARE SLATE'S FIVE. The paragraph above
             * is about a FOURTH control taking width from the favourites bank, and it
             * still holds — what changed is that the cluster was missing three of the
             * reference's own and carrying one that was not there:
             *   ORACLE live-ready #cupwarmer-toggle-btn [i=9] "Warmer ON" rect
             *          [1293,18,104,82]; #edit-profile-btn [i=12] [1408,18,152,82];
             *          #settings-btn [i=13] [1570,18,108,82]; #sleep-button [i=14]
             *          [1688,18,96,82] — a WORD, not a glyph; #fullscreen-toggle-btn
             *          [i=15] `.slate-icon-btn` [1794,18,96,82] — the cluster's icon.
             * So: Warmer, Edit profile, Settings, Sleep as three tall text buttons plus
             * the primary one, and ONE icon button at the end. Decal's moon glyph was
             * Slate's Sleep wearing the fullscreen control's slot while the fullscreen
             * control was missing.
             *
             * THE WIDTH ARGUMENT IS NOT WAIVED, IT IS PAID: the favourites cells lost
             * their occupancy discs in the same iteration (<ui-favourites-bank plain>,
             * which is the oracle's own name-only cell), and that is ~190px of band
             * handed back — more than the two restored words take. The floor sweep in
             * this file is what actually holds the line, and it is green. */
            /* THREE CONTROLS SINCE 23 Aug, AND THAT IS BEN OVER THE ORACLE. The
             * paragraph above restored Slate's five; Ben removed two of them on the
             * glass — "We dont need the sleep button OR the full sreen button, those
             * that are on the far right" — in the same message that asked for a bigger
             * gap between the favourites and the Warmer toggle. The precedence chain
             * puts his decisions above Slate-as-photographed, and the two removals PAY
             * for the gap: ~192px of band handed back to the bank on top of the ~190px
             * the occupancy discs already returned. So: Warmer, Edit profile, Settings,
             * and no icon button at the end. The width argument above stands unchanged
             * and its floor sweep still holds the line. */
            /* FOUR CONTROLS SINCE 25 AUGUST, BECAUSE SLEEP CAME BACK AND BEN SAID SO.
             * The paragraph above records his 23 August removal of Sleep and of the
             * fullscreen icon; two days later, on the same glass, he reversed half of it:
             * "I think I have changed my mind." Only half — the fullscreen icon button is
             * still gone, so the cluster is four TEXT buttons and no icon at the end.
             *
             * THE WIDTH ARGUMENT IS STILL NOT WAIVED AND IS STILL PAID, and this time the
             * payment is named in the same commit that made the change: the favourites
             * bank gives 64 % -> 59 % of the band to make room, which is Ben's own 5 %
             * and the same shape as the 23 August change that set the 64. The floor sweep
             * further down this file is what actually holds L22's line, and it is green.
             *
             * SLEEP IS NOT A ROUTE, WHICH IS WHY IT IS ASSERTED ONLY AS A COUNT HERE.
             * `app-intents.js` sorts it into HEADER_ACTION_MACHINE rather than
             * HEADER_ACTION_ROUTES, and its suite pins the two tables disjoint; what this
             * one is about is the cluster's composition, and the composition is four
             * library buttons: Warmer, Edit profile, Settings, Sleep. */
            assert.deepEqual(header.actions,
                ['ui-button', 'ui-button', 'ui-button', 'ui-button']);

            // THE POINT OF L8: the favourites bank is not merely a component, it is a
            // USE of the segmented bank, so re-skinning selection cannot reach one and
            // miss the other. Read through two shadow roots rather than asserted.
            const inside = await page.evalFn(() => window.__h.q('live-screen >>> ui-favourites-bank')
                .shadowRoot.querySelector('ui-bank').tagName.toLowerCase());
            assert.equal(inside, 'ui-bank');

            // The rail, and the foot band.
            /* THE RAIL STANDS AND ITS FIRST TRACK IS A CONTROL, not a picker. Ben's
             * ruling put Slate's nine rows on the rail in every state, so there is
             * nothing left to pick between and the mode bank is gone; the track it
             * shared with `<ui-stop-button>` renders NOTHING at rest, which is why the
             * rail opens on GRIND exactly as the oracle's does ([i=18] #grind-label is
             * the first thing inside #shot-settings). */
            const tree = await railTree(page);
            /* THE FIRST TRACK IS THE ABORT TARGET'S ONE-CELL GRID and its occupant at
             * rest is the GRIND stepper — the row the oracle's rail opens on ([i=18]
             * #grind-label is the first thing inside #shot-settings). */
            assert.deepEqual(tree[0].inner, ['ui-stepper'], 'the rail does not open on GRIND');
            /* NO <ui-bank> IN THE RAIL SINCE it16. The two that were there were the
             * stop-mode toggles, and the stop condition is a caption inside the
             * stepper's own name cell now — Slate's composition, and the reason the
             * rail is nine rows rather than eleven. */
            assert.ok(tree.slice(1).every((row) => ['ui-stepper', 'ui-preset-bank'].includes(row.tag)),
                `a rail row is not a library control: ${tree.map((r) => r.tag).join(', ')}`);
            assert.equal(await page.exists(`${S} >>> ui-data-grid`), true, 'the phase table is #34');
            assert.equal(await page.exists(`${S} >>> ui-numeric-keypad`), true, 'the numpad is #53');
        }));

        test('the foot band shows the derivation\'s phases, and no derived channel (D1)',
            () => mounted(async (page) => {
                await configure(page, {
                    /* THE SCALARS RIDE WITH THE PHASES because gate 6's derivation always
                     * carries both, and since Ben's ruling the band reads them: the four
                     * derived readings (ratio, first drop, the two avg/peak pairs) are
                     * Slate's own third block. A stub with phases and no scalars is a
                     * shape no derivation produces. */
                    storedDerivation: {
                        ok: true,
                        scalars: {
                            durationSeconds: 45, dose: 18, yield: 39, ratio: 2.2,
                            timeToFirstDrop: 8, averageFlow: 2.1, peakFlowAfterFirstDrop: 2.8,
                            averagePressure: 6.1, peakPressure: 9,
                        },
                        phases: {
                            preinfusion: { seconds: 15, weight: 10, volume: 17 },
                            extraction: { seconds: 30, weight: 29, volume: 30 },
                            total: { seconds: 45, weight: 39, volume: 47 },
                        },
                    },
                    storedShot: {
                        id: 'shot-1',
                        timestamp: '2026-08-13T10:15:57.783240',
                        workflow: { profile: { title: 'Extractamundo Dos! (2)' } },
                    },
                    shotId: 'shot-1',
                    rating: 73,
                    historyCount: 12,
                });

                const grid = await page.evalFn(() => {
                    const el = window.__h.q('live-screen >>> ui-data-grid');
                    return {
                        columns: el.columns.map((c) => c.key),
                        rows: el.rows.map((r) => r.key),
                        text: el.shadowRoot.textContent.replace(/\s+/g, ' ').trim(),
                    };
                });
                assert.deepEqual(grid.columns, ['time', 'weight', 'volume'],
                    'the derived list is absent in v1 — D1 removes it and its plumbing');
                assert.deepEqual(grid.rows, ['preinfusion', 'extraction', 'total']);
                assert.match(grid.text, /45/, 'the total row carries the derivation\'s own number');

                /* AND THE BAND'S OTHER TWO BLOCKS, both Ben's 22 Aug restores. Which
                 * shot this is (ORACLE #history-date [i=121], #history-profile-name
                 * [i=122], #history-dose-in [i=123]) and the four derived scalars
                 * (.slate-derived-list [i=145], four dt/dd pairs). The scalars are gate
                 * 6's per-shot numbers and NOT D1's derived CHANNELS — the names
                 * collide and the things do not. */
                const blocks = await page.evalFn(() => {
                    const root = window.__h.q('live-screen').shadowRoot;
                    const text = (sel) => [...root.querySelectorAll(sel)]
                        .map((el) => el.textContent.replace(/\s+/g, ' ').trim());
                    const one = (sel) => root.querySelector(sel)?.textContent
                        .replace(/\s+/g, ' ').trim();
                    return { shot: text('.foot-shot p'),
                             when: one('.shot-when'),
                             profile: one('.shot-profile'),
                             charge: one('.shot-charge'),
                             terms: text('.foot-derived dt'), values: text('.foot-derived dd') };
                });
                /* THE READING ORDER CHANGED WITH THE SHORT BAND (Ben, 30 August 2026).
                   The column was date / name / charge over the controls; the charge now
                   shares the date's line and the name follows, which is what takes a line
                   out of the tallest block in the band and lets the band come down to 172.
                   Selected by class rather than by index, so the next arrangement does not
                   fail this test for moving a line. */
                assert.equal(blocks.shot.length, 3, 'the band does not say which shot it is about');
                assert.match(blocks.when, /10:15/, 'the date line is the shot\'s own clock');
                assert.equal(blocks.profile, 'Extractamundo Dos! (2)');
                assert.match(blocks.charge, /18\.0 g/, 'the dose rides on the date line now');
                /* "PRESS", NOT "PRESSURE" — Ben, 30 August 2026: "I thought we were going
                   to make it PRESS AVG/PEAK so we can reduce that column as well?" The four
                   pairs measure 294 px spelled out and 257 clipped, and the 37 goes to the
                   phase table beside them, which was ellipsising every header. */
                assert.deepEqual(blocks.terms, ['Ratio', 'First drop', 'Flow avg/peak', 'Press avg/peak']);
                assert.deepEqual(blocks.values, ['1:2.2', '8.0', '2.1 / 2.8', '6.1 / 9.0']);

                // The band's controls are the library's too.
                assert.equal(await page.exists(`${S} >>> ui-rating-control`), true);
                const controls = await page.evalFn(() => [...window.__h.q('live-screen')
                    .shadowRoot.querySelectorAll('.foot-controls > *')].map((el) => el.tagName.toLowerCase()));
                /* ONE CONTROL IN THIS CORNER SINCE it16, and it is the rate strip.
                 *   ORACLE live-ready .slate-shot-rate [i=154] rect [1720,980,172,165]:
                 *          the label [i=155], the score [i=156], the slider [i=157] and
                 *          #shot-dye-btn [i=158] "Full notes" — nothing else.
                 * WHAT LEFT, and neither was a spacing decision reversed:
                 *   * the history ICON became the WORD Slate uses and moved to the
                 *     identity block, which is where Slate's own is
                 *     (#history-open-viewer [i=118] "All shots", under the date and the
                 *     profile line). It is UNCONDITIONAL there while the three identity
                 *     lines are not — a destination that came and went with the
                 *     machine's state would be one nobody can learn (band 4.5), and
                 *     history-route.render caught exactly that, 16 of 16, when it was
                 *     briefly rendered inside the conditional half.
                 *   * a "Stored shot" <ui-stepper> was DELETED. It was pinned at 0 with
                 *     no change handler, so it was a control that could not move — not
                 *     an invention but a dead affordance, which is worse. Slate has no
                 *     such control here and Ben's enumeration of the foot has none. */
                assert.deepEqual(controls, ['ui-rating-control']);
                assert.equal(await page.exists(`${S} >>> ui-stepper[label="Stored shot"]`), false,
                    'the dead stored-shot stepper is back');
                const entry = await page.evalFn(() => {
                    const el = window.__h.q('live-screen').shadowRoot.getElementById('history-entry');
                    return el ? { tag: el.tagName.toLowerCase(), text: el.textContent.trim(),
                        parent: el.parentElement.className } : null;
                });
                /* ITS PARENT IS THE NAV ROW SINCE 23 Aug, and the row is why. Ben asked
                 * the band to page: "The history pannel part on the left needs left and
                 * right arrows to allow navigating between old shots in the history."
                 * The two arrows and the way out are one idea — which shot this band is
                 * about — so they share a line inside the identity column rather than
                 * stacking, which would make an auto-sized column as wide as its widest
                 * control instead of as wide as the dates above it. The claim is
                 * unchanged: the way out is a button, it says "All shots", and it is in
                 * the identity block and not in the rate strip's corner. */
                assert.deepEqual(entry, { tag: 'ui-button', text: 'All shots', parent: 'shot-nav' },
                    'the way in to History is Slate\'s word, in Slate\'s own block '
                    + '(#history-open-viewer [i=118], under the date and the profile line)');
            }));

        /* -- 2. L8 / L7: ONE SELECTION TREATMENT ---------------------------- */

        test('L8: the two banks on this screen wear the same selected treatment, from the dials',
            () => mounted(async (page) => {
                await configure(page, { targets: TARGETS, favourites: FAVOURITES, favourite: 'p2' });

                /* THE RAIL'S OWN BANK IS NOW THE PRESET BANK (#37), and that is the
                 * third control to hold this role in this test. The mode picker went
                 * with Ben's standing-rail ruling; L25's stop-mode toggles went with
                 * it16, where the stop condition became a caption inside the stepper's
                 * name cell (Slate's own composition, and what makes the rail nine rows
                 * rather than eleven). #37 is a USE of <ui-bank> exactly as #36 is, it
                 * spells `toolbar` for the same reason, and it is the rail's one
                 * remaining bank — so the claim under test is unchanged and is about
                 * the TREATMENT rather than about which row carries it.
                 *   ORACLE live-ready #drink-out-preset-3 [i=39] carries the armed
                 *          treatment (`preset-active`, weight 400 and the plain ink
                 *          against its neighbours' 300 and muted). */
                const modeItem = `${S} >>> ui-preset-bank >>> ui-bank >>> [aria-pressed="true"]`;
                /* #36 spells its bank `toolbar`, so the state word is aria-pressed
                 * rather than aria-checked. The aria spelling is the accessibility
                 * answer, not a paint switch - which is exactly the claim being
                 * tested here: two spellings, one treatment. */
                const favItem = `${S} >>> ui-favourites-bank >>> ui-bank >>> [aria-pressed="true"]`;

                /* TWO IDIOMS SINCE 23 Aug, AND STILL ONE IMPLEMENTATION. Ben ruled the
                 * preset row back to Slate's own look — "just numbers with line
                 * underneath highlighting what value is selected" — so the two banks no
                 * longer wear the same FACE: the rail's presets are underlined numbers
                 * on the rail's ground, and the favourites keep the filled face every
                 * other selection in the skin wears.
                 *
                 * THAT IS NOT L8 COMING BACK, and the difference is the whole point of
                 * the rewrite. L8 was two hand-built copies of `.slate-bank`, so
                 * re-skinning selection "changes the tabs and leaves the favourites
                 * alone" — a look nothing could retarget. Here there is one <ui-bank>
                 * under both rows, both express selection through the same four dials,
                 * and the theme aims those dials differently for one element. A fork
                 * still turns one set of names in styles/tokens.css and both rows move;
                 * it just turns two names instead of one, and both are in the token
                 * file. So the assertion is not "the same paint" any more, it is "the
                 * same mechanism, and each row's own dials are what paint it". */
                await assertOneSelectionTreatment(page, {
                    selected: modeItem,
                    unselected: `${S} >>> ui-preset-bank >>> ui-bank >>> [aria-pressed="false"]`,
                    scope: `${S} >>> ui-preset-bank`,
                    contrast: 'led',
                });
                await assertOneSelectionTreatment(page, {
                    selected: favItem,
                    unselected: `${S} >>> ui-favourites-bank >>> ui-bank >>> [aria-pressed="false"]`,
                });

                // AND THE DEFECT ITSELF: one turn, both rows. The favourites follow the
                // face dial; the presets follow the three the theme aimed at them. Each
                // row moves on ITS dial and neither can be reached by a private rule,
                // which is what L8's two hand-built copies made impossible.
                const favBefore = await page.computed(favItem, ['background-color']);
                await page.setToken('--ui-selected-face', 'rgb(255, 0, 170)');
                await page.settle(3);
                const fav = await page.computed(favItem, ['background-color']);
                await page.setToken('--ui-selected-face', null);
                assert.equal(fav['background-color'], 'rgb(255, 0, 170)');
                assert.notEqual(fav['background-color'], favBefore['background-color']);

                const presetBefore = await page.computed(modeItem, ['box-shadow']);
                await page.setToken('--ui-preset-selected-led', '11px');
                await page.settle(3);
                const preset = await page.computed(modeItem, ['box-shadow']);
                await page.setToken('--ui-preset-selected-led', null);
                assert.match(preset['box-shadow'], /-11px/,
                    'the preset row did not follow its own dial');
                assert.notEqual(preset['box-shadow'], presetBefore['box-shadow']);
            }));

        test('the band\'s three history controls are one row, one height, one top',
            () => mounted(async (page) => {
                /* Ben, 23 Aug 2026: "Make the history left and right botton the same
                 * height as the all shots button."
                 *
                 * They were not. The arrows asked <ui-icon-button> for `lg`
                 * (--ui-control-lg, 82) beside a <ui-button> at --ui-control-h (64), and
                 * a rule left over from when the button was stacked under the identity
                 * lines added 8px of top margin and pinned it to the row's start — so
                 * two 82px squares sat either side of a 64px word, 4px higher than it,
                 * in a row that was 72 tall for a 64px control.
                 *
                 * ONE HEIGHT, AND IT IS A TOKEN'S. The match comes from the component's
                 * own size scale — `md` IS --ui-control-h — so there is no number here
                 * to keep in step with the button's. That is what this asserts: not "64",
                 * but "the same as each other, and the same as the token". */
                await configure(page, { targets: TARGETS, shotId: 'shot-1',
                    canStepOlder: true, canStepNewer: true });

                const controlH = parseFloat(await page.resolveValue('var(--ui-control-h)', 'block-size'));
                const ids = ['shot-older', 'shot-newer', 'history-entry'];
                const boxes = await Promise.all(ids.map((id) => page.box(`${S} >>> #${id}`)));

                for (const [i, id] of ids.entries()) {
                    assert.ok(Math.abs(boxes[i].height - controlH) < 0.51,
                        `#${id} is ${boxes[i].height} tall against --ui-control-h ${controlH}`);
                    assert.ok(Math.abs(boxes[i].top - boxes[0].top) < 0.51,
                        `#${id} sits at ${boxes[i].top} against the row's ${boxes[0].top}`);
                }

                /* AND THE ROW IS THE CONTROLS' OWN HEIGHT — a row taller than what it
                 * holds is the leftover margin coming back. */
                const row = await page.box(`${S} >>> .shot-nav`);
                assert.ok(Math.abs(row.height - controlH) < 0.51,
                    `the nav row is ${row.height} tall for a ${controlH} control`);
            }));

        test('the WEIGHT tile is the tare, by pointer and by keyboard', () => mounted(async (page) => {
            /* Ben, 23 Aug 2026: "with slate, if you tough the weight value it sends the
             * tare command to the machine resetting the weigh to 0.0g."
             *
             * THE SCREEN ASKS, IT DOES NOT ACT. The press leaves as `scale-tare` and the
             * wiring row calls the store — this screen reads no store and calls no
             * endpoint. Whether the tare actually HAPPENED is the store's question and
             * has its own suite: a 200 does not say, because the firmware refuses a
             * mid-shot tare silently while the write still succeeds.
             *
             * AND A KEYBOARD CAN REACH IT. A tile that only answers a click is a control
             * no keyboard has, which is why the role, the tab stop and the key handler
             * are asserted here rather than assumed. */
            await configure(page, { targets: TARGETS });

            const tile = `${S} >>> .gauges ui-stat-tile[data-press="tare"]`;
            const seen = await page.evalFn((selector) => {
                const el = window.__h.q(selector);
                const screen = window.__h.q('live-screen');
                const events = [];
                screen.addEventListener('scale-tare', () => events.push('tare'));
                el.click();
                el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
                el.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
                el.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
                return {
                    fired: events.length,
                    role: el.getAttribute('role'),
                    tabindex: el.getAttribute('tabindex'),
                    named: el.getAttribute('aria-label'),
                };
            }, tile);

            assert.equal(seen.fired, 3, 'a click, Enter and Space each ask once — and "a" does not');
            assert.equal(seen.role, 'button', 'the tile does not announce itself as a control');
            assert.equal(seen.tabindex, '0', 'and a keyboard cannot reach it');
            assert.ok(seen.named && seen.named.length > 0, 'an icon-less control with no name');

            /* AND NO OTHER TILE IS PRESSABLE. The gesture is declared on the weight ROW,
             * so a second one would be a field rather than a special case — and until
             * something declares it, six tiles stay exactly what they were. */
            const pressable = await page.evalFn(() => [...window.__h.q('live-screen').shadowRoot
                .querySelectorAll('.gauges ui-stat-tile')]
                .filter((el) => el.hasAttribute('data-press')).length);
            assert.equal(pressable, 1, 'more than one gauge became a control');
        }));

        /* -- 3. THE RANGES ARE THE DATA'S ----------------------------------- */

        test('the steppers take their range from the table, and no other place',
            () => mounted(async (page) => {
                /* WHAT THIS USED TO PROVE AND WHY IT MOVED. It swapped the machine class
                 * and watched the steam-temperature stepper's ceiling follow (Bengle 165,
                 * DE1 160, unknown = unavailable). Ben's standing-rail ruling takes that
                 * row off the Live rail — Slate's rail has no steam temperature either;
                 * Settings > machine-steam carries it (`settings-leaves.js:692`, naming
                 * this same limit key). So the rendered claim is made where it can still
                 * be made: every stepper the rail DOES carry reads its four numbers off
                 * the one table, compared against `r2MachineLimits`'s own answer computed
                 * in the page. B3's envelope itself is asserted on the table below and as
                 * arithmetic in `test/live-targets.test.mjs`. */
                await configure(page, { targets: TARGETS, offers: { milkProbe: true } });
                const rows = await page.evalFn(async (served) => {
                    const { r2MachineLimits } = await import('/src/data/adapters-r.js');
                    const table = r2MachineLimits(served).value;
                    const root = window.__h.q('live-screen').shadowRoot;
                    return [...root.querySelectorAll('live-rail ui-stepper')].map((el) => ({
                        key: el.dataset.key,
                        min: el.min, max: el.max, step: el.step, unit: el.unit,
                        disabled: el.disabled,
                        want: table[el.dataset.key] ?? null,
                    }));
                }, ['cupWarmer']);

                for (const row of rows) {
                    if (row.key === 'grind') {
                        /* GRIND READS THE TABLE LIKE EVERY OTHER ROW NOW, and it is the
                         * one row whose value is the USER'S rather than the machine's: a
                         * machine that has never been told a grind serves no
                         * `grinderSetting`, and under the served rule the rail's first
                         * control was permanently dead. It is enabled with the value
                         * absent — the dash stays, and the control works. */
                        assert.ok(row.want, 'grind lost its row in the R2 table');
                        assert.equal(row.disabled, false, 'GRIND is dead again');
                    }
                    assert.ok(row.want, `${row.key} has no row in the table it claims to read`);
                    assert.equal(row.min, row.want.min, `${row.key}: min is not the table's`);
                    assert.equal(row.max, row.want.max, `${row.key}: max is not the table's`);
                    assert.equal(row.step, row.want.step, `${row.key}: step is not the table's`);
                    assert.equal(row.unit, row.want.unit ?? '', `${row.key}: unit is not the table's`);
                }
            }));

        test('B3: the steam envelope is on the table this screen holds, and it is the port\'s',
            () => mounted(async (page) => {
                /* B3's DEFECT WAS NEVER ABOUT WHICH SCREEN DREW THE CONTROL: Slate's
                 * table was 130..170 and 130 °C is inside the dead band where the heater
                 * is off, so its clamp snapped users into a temperature the machine does
                 * not hold. The Live rail no longer carries the row (above), but it still
                 * holds the TABLE, computed in the page from a served capability answer —
                 * so the envelope is asserted here, on this screen's own data path, and
                 * the leaf that renders it gets the same answer. */
                const envelope = await page.evalFn(async () => {
                    const { r2MachineLimits } = await import('/src/data/adapters-r.js');
                    const { clamp } = await import('/src/lib/machine-limits.js');
                    const bengle = r2MachineLimits(['cupWarmer']).value;
                    const de1 = r2MachineLimits([]).value;
                    const unknown = r2MachineLimits(null).value;
                    window.__h.q('live-screen').limits = bengle;
                    return {
                        held: window.__h.q('live-screen').limits.steamTemp,
                        de1: de1.steamTemp,
                        unknown: unknown.steamTemp ?? null,
                        low: clamp(bengle, 'steamTemp', 130),
                        high: clamp(bengle, 'steamTemp', 170),
                        highDe1: clamp(de1, 'steamTemp', 170),
                    };
                });
                /* THE BENGLE'S CEILING IS 170 SINCE 26 AUGUST 2026 (Ben), AND THE DE1'S IS
                 * STILL 160. The bench serves a Bengle holding exactly 170, so 165 was a
                 * skin refusing the machine's own value — the plus greyed at a number
                 * ABOVE the one printed beside the label.
                 *
                 * THAT READING WAS TAKEN ON A BENGLE AND IT IS EVIDENCE ABOUT A BENGLE.
                 * This file asserted 170 on BOTH classes for one day, which offered a DE1
                 * owner ten degrees above `doc/Skins.md:573`'s stated envelope on the
                 * strength of a measurement taken on another machine — and made
                 * `machineClass` a parameter that changed nothing. `machine-limits.js`
                 * carries the whole argument beside STEAM_CEILING_BY_MACHINE_CLASS and
                 * `test/machine-limits.test.mjs` pins the two numbers as a pair; what this
                 * test adds is that the SCREEN's own data path answers the same for both.
                 *
                 * THE FLOOR AND THE HOLE ARE UNCHANGED, and they are what B3 is actually
                 * about: 130 is inside the dead band where the heater is off. */
                assert.equal(envelope.held.floor, 135, 'the working band starts at 135');
                assert.equal(envelope.held.max, 170, 'the steam ceiling is the machine\'s own 170');
                assert.equal(envelope.de1.max, 160, 'and the DE1 keeps the documented 160');
                assert.notEqual(envelope.held.max, envelope.de1.max,
                    'the class is what decides the ceiling — one number for both would make it decide nothing');
                assert.equal(envelope.unknown, null,
                    'with the machine class unresolved there is no steam row — A7, not a stand-in ceiling');
                assert.equal(envelope.low, 135, '130 must not be settable');
                assert.equal(envelope.high, 170, 'and 170 is a value the machine holds');
                assert.equal(envelope.highDe1, 160,
                    'while the same 170 comes back DOWN to the DE1\'s own ceiling');
            }));

        /* -- 4. THE NUMPAD ROUND TRIP --------------------------------------- */

        test('the numpad opens on the value cell and hands back a CLAMPED number',
            () => mounted(async (page) => {
                /* ON hotWaterVolume SINCE THE RAIL STOOD UP. The claim is the ROUND TRIP
                 * — value cell to dialog to a clamped number back on the rail — and it
                 * needs a key the rail carries and a bound the machine really has.
                 * `hotWaterVolume` is packed into one byte upstream (machine-limits.js:
                 * max 255, and the store's own note that it "truncates rather than
                 * clamps"), so 300 is exactly the sort of number a person types and the
                 * machine cannot hold. */
                await configure(page, { targets: TARGETS });

                // The value cell is a real button (L22: Slate's were tabindex=-1 spans).
                await page.evalFn(() => {
                    const el = window.__h.q('live-screen >>> ui-stepper[data-key="hotWaterVolume"]');
                    el.shadowRoot.querySelectorAll('button')[1].click();
                    return true;
                });
                await page.settle(4);

                const open = await page.evalFn(() => {
                    const pad = window.__h.q('live-screen >>> ui-numeric-keypad');
                    return { open: pad.open, key: pad.limitKey, dialog: !!pad.shadowRoot.querySelector('ui-dialog') };
                });
                assert.equal(open.open, true, 'the numpad is the typed path and it opened');
                assert.equal(open.key, 'hotWaterVolume');
                assert.equal(open.dialog, true, 'the body rides in the ONE dialog shell (#18)');

                const confirmed = await page.evalFn(async () => {
                    const pad = window.__h.q('live-screen >>> ui-numeric-keypad');
                    pad.press('3'); pad.press('0'); pad.press('0');
                    await pad.updateComplete;
                    const typed = pad.clamped;
                    pad.confirm();
                    const screen = window.__h.q('live-screen');
                    await screen.updateComplete;
                    return { typed, held: screen.targets.hotWaterVolume, open: pad.open };
                });
                assert.equal(confirmed.typed, 255, '300 is clamped to the one byte the machine holds');
                assert.equal(confirmed.held, 255, 'and that is what the rail now holds');
                assert.equal(confirmed.open, false, 'confirming closes the dialog');
            }));

        /* -- 4b. THE NUMPAD'S BAND IS THE RAIL'S OWN, NOT THE MACHINE'S -----
         *
         * `unitForRow`'s comment in `live-screen.js` named two defects and said they
         * wanted one fix: the numpad's hint "reads the RAW R2 row and says '0–255 mL'
         * under a weight stop while the well beside it says g … the louder instance is
         * temperature: in Fahrenheit the same hint reads '70–110 °C' beside a well
         * reading °F, on every temperature row, today." Both were the numpad DERIVING a
         * band from the machine's own table while the stepper beside it drew the
         * display's. These are the two, asserted (27 August 2026).
         *
         * NO BOUND IS WRITTEN HERE. Every expectation is read off the STEPPER on the
         * same row, which is the control the numpad has to agree with; a number typed
         * into this file would be the second copy B2 exists to prevent.
         * ------------------------------------------------------------------- */

        /** Open the numpad on one rail row from its value cell, the way a finger does. */
        const openPad = async (page, key) => {
            await page.evalFn((k) => {
                const el = window.__h.q(`live-screen >>> ui-stepper[data-key="${k}"]`);
                el.shadowRoot.querySelectorAll('button')[1].click();
                return true;
            }, key);
            await page.settle(4);
        };

        /** The pad's own sentence and unit, and the stepper's, side by side. */
        const padVersusStepper = (page, key) => page.evalFn((k) => {
            const pad = window.__h.q('live-screen >>> ui-numeric-keypad');
            const stepper = window.__h.q(`live-screen >>> ui-stepper[data-key="${k}"]`);
            return {
                open: pad.open === true,
                padHint: pad.shadowRoot.getElementById('hint').textContent.trim(),
                padUnit: pad.getAttribute('unit'),
                stepperHint: stepper.shadowRoot.getElementById('hint')?.textContent.trim() ?? null,
                stepperUnit: stepper.unit ?? '',
                min: stepper.min,
                max: stepper.max,
            };
        }, key);

        test('the numpad over a temperature target is drawn in the unit the rail is drawn in',
            () => mounted(async (page) => {
                await configure(page, { targets: TARGETS, tempUnit: 'F' });
                await openPad(page, 'hotWaterTemp');
                const seen = await padVersusStepper(page, 'hotWaterTemp');

                assert.equal(seen.open, true, 'the value cell is the typed path and it opened');
                assert.equal(seen.padUnit, '°F', 'the well is captioned in the display unit');
                assert.equal(seen.stepperUnit, '°F');
                /* THE CEILING THE PAD NAMES IS THE ONE THE STEPPER STOPS AT. Read off the
                 * stepper rather than written out, so the claim is that the two controls
                 * over one target agree — not that either matches a number in this file. */
                assert.match(seen.padHint, new RegExp(String(seen.max)),
                    'the pad prints the same ceiling the + button stops at');
                assert.match(seen.padHint, /°F/);
                assert.doesNotMatch(seen.padHint, /°C/,
                    'the machine\'s own unit has no business on a Fahrenheit rail');
            }));

        test('and a number typed into it is clamped against THAT band, not the machine\'s',
            () => mounted(async (page) => {
                await configure(page, { targets: TARGETS, tempUnit: 'F' });
                await openPad(page, 'hotWaterTemp');

                const round = await page.evalFn(async () => {
                    const pad = window.__h.q('live-screen >>> ui-numeric-keypad');
                    const stepper = window.__h.q('live-screen >>> ui-stepper[data-key="hotWaterTemp"]');
                    /* 150 °F IS INSIDE THE BAND — 65.6 °C, well under the machine's 99.
                     * Against the CELSIUS band it is far above the ceiling and clamps to
                     * it, which is what shipped; `#commit` then read that number as
                     * Fahrenheit on the way to the machine, so it was wrong twice. */
                    pad.press('1'); pad.press('5'); pad.press('0');
                    await pad.updateComplete;
                    const typed = pad.clamped;
                    pad.confirm();
                    const screen = window.__h.q('live-screen');
                    await screen.updateComplete;
                    return { typed, ceiling: stepper.max, held: screen.targets.hotWaterTemp };
                });

                assert.equal(round.typed, 150,
                    '150 °F is inside the rail\'s own band, so the clamp returns it');
                assert.ok(round.typed < round.ceiling,
                    'and it is below the ceiling the rail draws — nothing to clamp to');
                /* WHAT THE RAIL HANDS ON IS CELSIUS. `#commit` converts once, at the one
                 * place a target leaves this screen, so the machine gets its own number
                 * and not the one that was on the well. Computed here rather than spelled,
                 * because spelling it would be a second conversion to get wrong. */
                assert.equal(round.held, (150 - 32) * 5 / 9);
            }));

        test('the numpad follows the WORD as well as the unit — one field, two stops',
            () => mounted(async (page) => {
                /* THE SECOND INSTANCE, AND IT IS NOT A TEMPERATURE. `hotWaterVolume` is
                 * ONE machine field behind two stop modes: a volume cap in millilitres or
                 * a weight cap in grams. The rail's row restates the word (`STOP_TARGET`'s
                 * weight entry carries `unit: 'g'`) and the stepper follows it; the numpad
                 * read the limits row instead and printed mL under a weight stop. */
                await configure(page, {
                    targets: TARGETS,
                    waterStop: 'weight',
                    offers: { stopAtWeight: true },
                });
                await openPad(page, 'hotWaterVolume');
                const weight = await padVersusStepper(page, 'hotWaterVolume');
                assert.equal(weight.stepperUnit, 'g', 'the rail is drawing a weight cap');
                assert.equal(weight.padUnit, 'g');
                assert.match(weight.padHint, /\bg\b/, 'so the pad says grams');
                assert.doesNotMatch(weight.padHint, /mL/,
                    'and nothing on the row says millilitre while it is a weight stop');

                /* THE NUMBERS DO NOT MOVE BETWEEN THE MODES — a millilitre of water
                 * weighs a gram, which is why the machine can hold one field. Only the
                 * word does, and that is exactly what this asserts. */
                await page.evalFn(() => {
                    window.__h.q('live-screen >>> ui-numeric-keypad').cancel();
                    return true;
                });
                await configure(page, {
                    targets: TARGETS,
                    waterStop: 'volume',
                    offers: { stopAtWeight: true },
                });
                await openPad(page, 'hotWaterVolume');
                const volume = await padVersusStepper(page, 'hotWaterVolume');
                assert.equal(volume.padUnit, 'mL');
                assert.match(volume.padHint, /mL/);
                assert.equal(volume.max, weight.max, 'one field, one ceiling, two words');
                assert.equal(
                    volume.padHint.replace('mL', ''), weight.padHint.replace('g', ''),
                    'the two sentences differ by the word alone',
                );
            }));

        /* -- 5. THE RAIL STANDS --------------------------------------------- */

        /* WHAT THESE THREE REPLACE. Until Ben's ruling of 22 Aug 2026 this section
         * proved recomposition: a mode change moved no row that stayed, the deepest
         * mode fitted a six-track budget, and the machine's state beat the picker.
         * `railRows` returns ONE list now -- Slate's nine rows, standing in every state
         * -- so recomposition has nothing left to prove and the picker does not exist.
         * The claims that survive are the ones that were never about recomposition: the
         * rail's tracks do not move, its content is measured against its interior at
         * every geometry, and NOTHING IS DROPPED where it does not fit. */

        test('the rail is the same tracks in every machine state \u2014 nothing recomposes',
            () => mounted(async (page) => {
                await configure(page, { machineState: '', targets: TARGETS });
                const idle = await railTree(page);

                await configure(page, { machineState: 'steam', targets: TARGETS });
                const steaming = await railTree(page);

                /* NOT ONE TRACK MOVES, and that is the whole claim: the abort target
                 * rides the FIRST row's own one-cell grid rather than taking a track of
                 * its own, so a shot starting changes what is painted and nothing about
                 * where anything is. Appendix item 3, "state changes weight, never
                 * position", which is why the screen is readable during a pull. */
                assert.equal(steaming.length, idle.length, 'a state change added or removed a track');
                for (let i = 0; i < idle.length; i += 1) {
                    assert.equal(steaming[i].key, idle[i].key, `track ${i} is a different control`);
                    assert.equal(steaming[i].height, idle[i].height, `track ${i} changed height with the state`);
                    assert.equal(steaming[i].top, idle[i].top,
                        `track ${i} slid ${(steaming[i].top - idle[i].top).toFixed(2)} on a state change`);
                }
            }));

        test('the standing rail measured against its interior, and it drops nothing',
            (t) => mounted(async (page) => {
                /* Section 4.1 gave this region three rules and Ben's ruling costs it half
                 * of one: "floor = sum of its fixed rows, NEVER SCROLLS, drops nothing".
                 * Slate's nine rows are not a depth any floor pays for -- Slate's own rail
                 * is 1082px tall and its last stepper ends at y=1144 on a 1200-row screen
                 * -- so <live-rail> scrolls where they outrun it. "Drops nothing" is the
                 * half that survives, and it is the half that matters: a row below the
                 * fold with no way to reach it IS dropped, whatever the stylesheet says.
                 *
                 * Pinned per geometry, to the measured pixel, so the cost of the ruling
                 * cannot drift by a row unnoticed. */
                await configure(page, { targets: TARGETS });
                const tree = await railTree(page);
                const rail = await page.evalFn(() => {
                    const el = window.__h.q('live-screen').shadowRoot.querySelector('live-rail');
                    const cs = getComputedStyle(el);
                    const box = el.getBoundingClientRect();
                    const kids = [...el.children];
                    const last = kids[kids.length - 1].getBoundingClientRect();
                    return {
                        overflowY: cs.overflowY,
                        scrolls: el.scrollHeight > el.clientHeight + 1,
                        outer: +box.height.toFixed(2),
                        interior: +(el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)).toFixed(2),
                        content: +(last.bottom - kids[0].getBoundingClientRect().top).toFixed(2),
                        reachable: el.scrollHeight >= last.bottom - box.top - 1,
                    };
                });

                t.diagnostic(`${geometry.name}: ${tree.length} tracks, ${rail.content}px of content in `
                    + `${rail.interior}px of rail interior (${rail.outer} outer), scrolls=${rail.scrolls}`);

                /* ELEVEN SINCE it16, and the two that went are the reason: the
                 * stop-mode toggles had a full track each and the stop condition is a
                 * caption inside the stepper's name cell now. Nine standing rows, as
                 * Ben's enumeration names them, plus the two preset banks. */
                assert.equal(tree.length, 11, `the standing rail is 11 tracks: ${tree.map((r) => r.tag).join(', ')}`);
                assert.equal(tree[0].inner[0] ?? tree[0].tag, 'ui-stepper',
                    'the first track is the abort target\'s one-cell grid over GRIND');
                assert.equal(rail.overflowY, 'auto', 'the rail must be able to reach a row it cannot show');
                /* THE PIN: at Ben's own 1920x1200 the rail fits with room over, and at
                 * the two smaller geometries it scrolls. A change that makes the
                 * reference geometry scroll is a change that made the rail too deep. */
                const FITS = { desktop: true, bench: false, floor: false }[geometry.name];
                assert.ok(FITS !== undefined, `no pinned rail fit for ${geometry.name}`);
                assert.equal(rail.scrolls, !FITS,
                    `the rail ${rail.scrolls ? 'scrolls' : 'fits'} at ${geometry.name} with `
                    + `${rail.content}px of content in ${rail.interior}px of interior`);
                assert.equal(rail.reachable, true, 'a track was below the scroll extent \u2014 that IS a drop');
            }));

        test('there is no mode picker, and the machine still decides what is running',
            () => mounted(async (page) => {
                /* The picker existed for one stated reason -- live-targets.js: "at idle
                 * every target must still be reachable: Slate solved that by putting nine
                 * rows in a 1082px rail, which the rewrite's 1000x600 design floor cannot
                 * hold". The rail IS those nine rows now, so the reason is spent and the
                 * control is gone; Slate has none on Live either. What the machine's state
                 * still decides is whether a shot is running, which is the abort target. */
                await configure(page, { machineState: 'steam', targets: TARGETS });
                const rail = await page.evalFn(() => {
                    const root = window.__h.q('live-screen').shadowRoot;
                    return {
                        banks: [...root.querySelectorAll('live-rail ui-bank')].map((el) => el.dataset.row ?? null),
                        keys: [...root.querySelectorAll('live-rail ui-stepper')].map((el) => el.dataset.key),
                        stop: !!root.querySelector('ui-stop-button'),
                    };
                });
                /* AND NO BANK AT ALL SINCE it16: the two that survived the picker were
                 * L25's stop-mode toggles, and the stop condition is a caption inside
                 * the stepper's own name cell now (see the L25 tests below for where
                 * each stop mode's control went). The rail is nine steppers and two
                 * preset banks — <ui-preset-bank> is its own tag and is not matched
                 * here, which is why this list is empty rather than two. */
                assert.deepEqual(rail.banks, [],
                    'a stop-mode bank is back on a track of its own');
                assert.deepEqual(rail.keys, [
                    'grind', 'dose', 'drinkWeight', 'brewTemp',
                    'steamDuration', 'steamFlow', 'flushDuration', 'hotWaterVolume', 'hotWaterTemp',
                ], "the rail is Slate's nine rows whatever the machine is doing");
                assert.equal(rail.stop, true, 'the machine is steaming, so the abort target is there');
            }));


        test('#47: the STOP target appears over the rail\'s first track and moves nothing',
            () => mounted(async (page) => {
                await configure(page, { targets: TARGETS });
                const before = await railTree(page);
                assert.equal(await page.exists(`${S} >>> ui-stop-button`), false,
                    'absent, not hidden, when nothing is running');

                await configure(page, { machineState: 'espresso', targets: TARGETS });
                const after = await railTree(page);
                assert.equal(await page.exists(`${S} >>> ui-stop-button`), true);
                assert.deepEqual(after.map((r) => r.top), before.map((r) => r.top),
                    'the abort target pushed the rail around — it is an overlay, in a grid cell');

                /* THE TRACK IT COVERS IS THE FIRST ROW'S — GRIND's — since the mode
                 * picker went with Ben's standing-rail ruling. Slate overlays its own
                 * abort target on the top of the rail by positioning it absolutely
                 * (top: 25px, z-index 6); this screen refuses positioning, so the row
                 * is a one-cell grid and both controls sit in the cell. */
                const stack = await page.evalFn(() => {
                    const stop = window.__h.q('live-screen >>> ui-stop-button');
                    const first = window.__h.q('live-screen').shadowRoot
                        .querySelector('live-rail').firstElementChild;
                    const s = stop.getBoundingClientRect();
                    const b = first.getBoundingClientRect();
                    return {
                        position: getComputedStyle(stop).position,
                        covers: first.tagName.toLowerCase(),
                        over: Math.abs(s.top - b.top) < 1 && Math.abs(s.left - b.left) < 1,
                    };
                });
                assert.equal(stack.position, 'static', 'nothing on this screen positions itself (L1\'s mechanism)');
                assert.equal(stack.covers, 'div', 'the abort target\'s cell is the first row\'s own grid');
                assert.equal(stack.over, true, 'the overlay sits in the track it covers');
            }));

        /**
         * #47, THE OTHER HALF — and the half the assertions above cannot see. They
         * prove the abort target EXISTS and that its box COINCIDES with the bank's;
         * coincidence is the geometry the overlay wants and says nothing about which
         * of the two boxes a finger reaches. It reached the wrong one: the bank is
         * `disabled` mid-shot, its disabled look computes `opacity: 0.38`, that gives
         * it a stacking context, and a stacking context paints above a plain sibling
         * — so a 100%-occluded STOP passed this file green while a real press landed
         * on a disabled <button> and dispatched pointerdown and nothing else.
         *
         * So this test asks the engine the question a screenshot cannot: at seven
         * points across the STOP box, what does hit testing actually answer, and does
         * a real CDP press produce `stop-request`. SCOPE Part 8 §3 Rule 1.
         */
        test('#47: the STOP target is REACHABLE mid-shot — hit tests and a real press',
            () => mounted(async (page) => {
                await configure(page, { machineState: 'espresso', targets: TARGETS });

                const reach = await page.evalFn(() => {
                    /* Descend shadow roots: document.elementFromPoint stops at the host. */
                    const deep = (x, y) => {
                        let el = document.elementFromPoint(x, y);
                        for (let i = 0; el?.shadowRoot && i < 20; i += 1) {
                            const inner = el.shadowRoot.elementFromPoint(x, y);
                            if (!inner || inner === el) break;
                            el = inner;
                        }
                        return el;
                    };
                    /* ...then climb back out to the library component that owns the hit. */
                    const owner = (el) => {
                        for (let n = el; n; n = n.parentNode instanceof ShadowRoot ? n.parentNode.host : n.parentElement) {
                            if (n.tagName?.toLowerCase().startsWith('ui-')) return n.tagName.toLowerCase();
                        }
                        return el?.tagName?.toLowerCase() ?? null;
                    };
                    const r = window.__h.need('live-screen >>> ui-stop-button').getBoundingClientRect();
                    return [0.05, 0.2, 0.35, 0.5, 0.65, 0.8, 0.95]
                        .map((f) => owner(deep(r.left + r.width * f, r.top + r.height / 2)));
                });
                assert.deepEqual(reach, Array(7).fill('ui-stop-button'),
                    `a press is swallowed before it reaches the abort target: ${reach.join(', ')}`);

                await page.evalFn(() => {
                    window.__stopRequests = 0;
                    window.__h.need('live-screen').shadowRoot
                        .addEventListener('stop-request', () => { window.__stopRequests += 1; }, true);
                });
                await page.click(`${S} >>> ui-stop-button`);
                assert.equal(await page.evalFn(() => window.__stopRequests), 1,
                    'a real press at the centre of the STOP box did not request a stop');
            }));

        /* -- 6. L25 --------------------------------------------------------- */

        test('L25 WITHDRAWN: the rail paints no stop condition at all',
            () => mounted(async (page) => {
                /* ============================================================
                 * THIS TEST USED TO ASSERT THE OPPOSITE, AND THAT IS THE POINT.
                 * ============================================================
                 * It read "TIMED STOP" and "VOLUME STOP" out of the two stepper name
                 * cells and checked they were Slate's own words, in Slate's own place,
                 * as text rather than a bank on a track. That was L25's fix.
                 *
                 * Ben withdrew it on 30 August 2026, and his reason is the strongest
                 * argument against it: "these labels (Timed Stop and Weight Target) are
                 * actual toggles, even though it wasn't clear they were." A control that
                 * reads as a caption is a control nobody presses, and it cost the rail two
                 * labels at a second size no other row carries.
                 *
                 * WHAT REPLACES IT IS THE ABSENCE, ASSERTED. A caption drawn again would
                 * be a button with nothing behind it: the dispatch, the listener and both
                 * arming methods are gone, and gate-wire reports zero dead wires only
                 * while every one of them stays gone.
                 *
                 * L25 ITSELF IS NOT UNGUARDED. The settings-leaves test below is now its
                 * only pin, and it was written to survive exactly this: its own note
                 * already reads "The Live rail no longer carries a control for either
                 * stop mode". */
                await configure(page, { targets: TARGETS, steamStop: 'time', waterStop: 'volume' });
                for (const row of ['steam-stop-target', 'water-stop-target']) {
                    const sel = `${S} >>> ui-stepper[data-row="${row}"]`;
                    assert.equal(await page.exists(sel), true, `${row} is not on the rail`);
                    const found = await page.evalFn((s) => {
                        const stepper = window.__h.q(s);
                        return {
                            caption: stepper.querySelectorAll('.stop-caption').length,
                            slotted: stepper.querySelectorAll('[slot="caption"]').length,
                            name: stepper.getAttribute('label') || '',
                        };
                    }, sel);
                    assert.equal(found.caption, 0, `${row} draws a stop-condition caption again`);
                    assert.equal(found.slotted, 0, `${row} has something in its caption box`);
                    /* THE HEADING STAYED. The caption was a second line UNDER the block
                       name, so a removal that took the name with it would leave the row
                       unnamed — which is what the two continuation rows deliberately are,
                       and these two deliberately are not. */
                    assert.ok(found.name.trim().length > 0, `${row} lost its block name`);
                }

                /* AND NO BANK CAME BACK EITHER. The tracks went at it16 and they stay
                 * gone: the mode's home is Settings, not a rail row. */
                assert.equal(await page.exists(`${S} >>> live-rail ui-bank`), false,
                    'a stop-mode bank is back on a track of its own');
            }));

        test('L25: the stop mode still swaps the target under it, and the track does not move',
            () => mounted(async (page) => {
                /* THE MODEL HALF OF L25 IS UNCHANGED and this is what still proves it:
                 * the stop condition names a DIFFERENT limit key, the row it names is
                 * the one under the caption, and changing it moves no track. Only the
                 * control that raises the change moved (see the test above). */
                await configure(page, { targets: TARGETS, offers: { milkProbe: true } });
                const at = (tree) => tree.find((r) => r.row === 'steam-stop-target');
                const before = await railTree(page);
                assert.equal(at(before).key, 'steamDuration');

                await page.evalFn(() => {
                    const screen = window.__h.q('live-screen');
                    screen.steamStop = 'milk';
                    return screen.updateComplete;
                });
                await page.settle(4);

                const after = await railTree(page);
                assert.equal(at(after).key, 'milkStopTemp', 'the stop mode did not change the stop target');
                assert.deepEqual(after.map((r) => r.top), before.map((r) => r.top),
                    'the stop row moved — the change must recompose within its track');

                /* THE UNIT FOLLOWS IT, AND SINCE 30 AUGUST 2026 THAT IS ALL THAT DOES.
                 * A caption used to say the mode in words here — Slate's own 'Milk probe'
                 * — and Ben withdrew it because a caption that is really a toggle reads as
                 * neither. What the row still says is the quantity it now ends on, which
                 * is the whole of his argument for dropping the words: the well changes
                 * from seconds to degrees, and that is a different question with a
                 * different unit. */
                const unit = await page.evalFn(() => window.__h
                    .q('live-screen >>> ui-stepper[data-row="steam-stop-target"]')
                    .getAttribute('unit'));
                assert.notEqual(unit, 's', 'a milk-probe stop is still spelled in seconds');
            }));

        test('L25: BOTH halves of the fix are on their settings leaves, and they are still there',
            async () => {
                /* THE DECLARED HOMES, ASSERTED. The Live rail no longer carries a
                 * control for either stop mode; `machine-steam-stop` and
                 * `machine-water-stop` do, and this test is what stops those rows being
                 * deleted as unused one day and taking L25 with them silently. Read off
                 * the leaf table rather than rendered — the settings surface is not
                 * this suite's.
                 *
                 * THE WATER HALF WAS THIS PASS'S OWN REGRESSION for nine iterations
                 * (finding L25-hot-water: folding the rail's banks into Slate's caption
                 * left Volume/Weight with no control anywhere, while Slate has a
                 * working one on its hot-water settings leaf — settings.js:4540). The
                 * review built the declared fix; this pin holds both halves the same
                 * way so neither can regress alone.
                 *
                 * AND THE WATER HALF NOW REACHES THE MACHINE, which is what this pin
                 * asserts since 27 August 2026. It used to read `water.key ===
                 * 'hotWaterStopMode'` — a `SOURCE.ROUTE` row writing a key in the skin's
                 * own KV store, which is to say a control that moved a preference nobody
                 * downstream read. The settings pass adopted ReaPrime's own field
                 * (`stopHotWaterAtWeight`, served by GET /settings, accepted by POST
                 * /settings, read by `hot_water_sequencer.dart:106`) and mapped the two
                 * words onto the bool it holds, so the row now changes the machine.
                 * `settings-leaves.js` carries the whole argument.
                 *
                 * SO THIS ASSERTS THE FIELD AND THE MAPPING, not the retired key. Pinning
                 * the key would have been pinning the defect: the point of L25's water
                 * half is that a hot-water pour can be told what ends it, and a stored
                 * word that never left the tablet did not do that. The KV key still
                 * exists — `live-wiring.js` keeps the Live rail's own copy of the choice —
                 * so a test naming it would even have gone on passing while the row it
                 * describes had moved. */
                const { SETTINGS_ROWS } = await import('../../src/lib/settings-leaves.js');
                const steam = SETTINGS_ROWS.find((r) => r.id === 'machine-steam-stop');
                assert.ok(steam, 'the steam stop-mode control has left the settings leaf too — L25 is now unfixed');
                assert.equal(steam.leaf, 'machine-steam');
                assert.equal(steam.archetype, 'bank');
                assert.deepEqual(steam.items.map((i) => i.value), ['off', 'time', 'milk-temp']);

                const water = SETTINGS_ROWS.find((r) => r.id === 'machine-water-stop');
                assert.ok(water, 'the hot-water stop-mode control has no home again — L25\'s water half is re-unfixed');
                assert.equal(water.leaf, 'machine-hot-water');
                assert.equal(water.archetype, 'bank');
                assert.equal(water.field, 'stopHotWaterAtWeight',
                    'the hot-water stop mode is back to writing a key the machine never sees');
                assert.equal(water.key, undefined, 'and it writes ONE store, not two (B7)');
                assert.deepEqual(water.fieldValues, { volume: false, weight: true },
                    'the two words and the bool the machine holds, mapped in one place');
                assert.deepEqual(water.items.map((i) => i.value), ['volume', 'weight']);
                assert.ok(water.items[1].note, 'the weight option carries its scale note (Slate\'s own caption sentence)');
            });

        /* -- 7. L21-L24, THE ACCESSIBILITY CLUSTER -------------------------- */

        test('L21: every route out of this screen is a real, focusable control with a name',
            () => mounted(async (page) => {
                await configure(page, { targets: TARGETS, favourites: FAVOURITES, favourite: 'p1', profileName: 'Londinium' });

                const routes = await page.evalFn(() => {
                    const root = window.__h.q('live-screen').shadowRoot;
                    const out = [];
                    for (const host of root.querySelectorAll('ui-button, ui-icon-button')) {
                        const btn = host.shadowRoot.querySelector('button');
                        // The visible text is SLOTTED, so the name is the host's text
                        // when the button carries no aria-label of its own.
                        out.push({
                            tag: btn.tagName.toLowerCase(),
                            name: (btn.getAttribute('aria-label') || host.textContent).trim(),
                            tabbable: btn.tabIndex >= 0,
                        });
                    }
                    // Slate's route into the expanded charts was #live-chart, role="img"
                    // with a click handler, no tabindex and no key handler; and its
                    // profile name was an <h1> WITH PRESS-AND-HOLD NAVIGATION.
                    //
                    // THE CLAIM IS ABOUT THE INTERACTION, NOT THE TAG (parity surface 1).
                    // This read `headings === 0`, which was a true proxy while the screen
                    // had no heading at all; the stat cluster now carries the one §4.1
                    // always specified ("<stat-cluster>  auto  (heading + gauges)") and
                    // Slate draws as its card's first line. A heading that is only a
                    // heading is not L21's defect — L21 is a ROUTE dressed as text. So
                    // what is counted is a heading that behaves like a control.
                    const interactiveHeadings = [...root.querySelectorAll('h1, h2, h3')]
                        .filter((h) => h.tabIndex >= 0
                            || h.hasAttribute('role')
                            || h.hasAttribute('onclick')
                            || h.hasAttribute('aria-haspopup'));
                    return {
                        out,
                        headings: root.querySelectorAll('h1, h2, h3').length,
                        interactiveHeadings: interactiveHeadings.length,
                        clickableNonControls: [...root.querySelectorAll('[role="img"], div[onclick]')].length,
                    };
                });
                for (const route of routes.out) {
                    assert.equal(route.tag, 'button', 'a route is a real button');
                    assert.ok(route.name.length > 0, 'a route has an accessible name');
                    assert.equal(route.tabbable, true, 'a route is in the tab order');
                }
                assert.equal(routes.interactiveHeadings, 0,
                    'a heading on this screen answers a tap — which is L21 exactly: Slate\'s profile '
                    + 'name was an <h1> with press-and-hold navigation, and every route out of this '
                    + 'screen is a real button instead');
                assert.equal(routes.headings, 1,
                    'the stat cluster has exactly one heading — §4.1\'s "(heading + gauges)", the '
                    + 'profile identity line Slate draws at the top of its chart card');
                assert.equal(routes.clickableNonControls, 0);
            }));

        test('L22: every hit target on the bands clears the 48px floor', () => mounted(async (page) => {
            await configure(page, { targets: TARGETS, favourites: FAVOURITES, favourite: 'p1', machineState: 'espresso' });

            const floor = parseFloat(await page.resolveValue('var(--ui-hit-min)', 'width'));
            const small = await page.evalFn((min) => {
                const root = window.__h.q('live-screen').shadowRoot;
                const bad = [];
                const walk = (node, path) => {
                    for (const el of node.querySelectorAll('*')) {
                        if (el.shadowRoot) walk(el.shadowRoot, `${path} ${el.tagName.toLowerCase()}`);
                        if (!/^(BUTTON|INPUT|A)$/.test(el.tagName)) continue;
                        if (el.disabled) continue;
                        const r = el.getBoundingClientRect();
                        if (r.width === 0 && r.height === 0) continue;
                        if (r.height < min - 0.5 || r.width < min - 0.5) {
                            bad.push(`${path} ${el.tagName.toLowerCase()} ${r.width.toFixed(1)}x${r.height.toFixed(1)}`);
                        }
                    }
                };
                walk(root, 'live-screen');
                return bad;
            }, floor);
            assert.deepEqual(small, [],
                'a 32 x 35 target on a wall panel operated with a wet hand is L22 itself');
        }));

        test('L23: state travels as aria, and no name is hung on a role-less box',
            () => mounted(async (page) => {
                await configure(page, { mode: 'steam', targets: TARGETS, favourites: FAVOURITES, favourite: 'p1' });

                const aria = await page.evalFn(() => {
                    const root = window.__h.q('live-screen').shadowRoot;
                    /* THE RAIL'S BANK IS THE PRESET BANK SINCE it16 — the stop-mode
                     * toggles it used to be became captions in the steppers' own name
                     * cells, so the rail's one remaining <ui-bank> is the one inside
                     * #37. The claim is unchanged: a bank has a group role and every
                     * item carries its state. */
                    const bankHost = root.querySelector('ui-preset-bank').shadowRoot.querySelector('ui-bank');
                    const bank = bankHost.shadowRoot;
                    const group = bankHost.getAttribute('role');
                    const items = [...bank.querySelectorAll('button')];
                    const labelled = [...root.querySelectorAll('[aria-label]')]
                        .filter((el) => !el.tagName.startsWith('UI-') && !el.tagName.startsWith('LIVE-') && !el.hasAttribute('role'))
                        .map((el) => el.tagName.toLowerCase());
                    return {
                        group,
                        states: items.map((b) => b.getAttribute('aria-checked') ?? b.getAttribute('aria-selected')
                            ?? b.getAttribute('aria-pressed')),
                        namedRolelessDivs: labelled,
                        regions: [...root.querySelectorAll('[role="region"]')]
                            .map((el) => el.getAttribute('aria-label')).filter(Boolean).length,
                    };
                });
                assert.ok(['radiogroup', 'tablist', 'group'].includes(aria.group), `the bank's role is ${aria.group}`);
                assert.ok(aria.states.every((s) => s === 'true' || s === 'false'),
                    'every item carries the state — Slate\'s tablist never set aria-selected at all');
                assert.equal(aria.states.filter((s) => s === 'true').length, 1, 'exactly one is selected');
                assert.deepEqual(aria.namedRolelessDivs, [], 'aria-label on a role-less <div> is L23');
                assert.ok(aria.regions >= 2, 'the rail and the foot band are named regions');
            }));

        test('L24: a focus ring on the bands is not clipped by the box it sits in',
            () => mounted(async (page) => {
                await configure(page, { targets: TARGETS, favourites: FAVOURITES, favourite: 'p1' });
                // The two Slate clipped on all four sides: a bank item inside
                // `.slate-bank { overflow: hidden }` and a stepper's ± cap inside
                // `.slate-stepper { overflow: hidden }`.
                /* #37's bank, for the reason the L23 test above records. */
                await assertFocusUnclipped(page, `${S} >>> ui-preset-bank >>> ui-bank >>> button`);
                await assertFocusUnclipped(page, `${stepper('dose')} >>> button`);
                await assertFocusUnclipped(page, `${S} >>> ui-favourites-bank >>> ui-bank >>> button`);
            }));

        test('focus order follows the bands: header, then rail, then foot', () => mounted(async (page) => {
            await configure(page, {
                targets: TARGETS, favourites: FAVOURITES, favourite: 'p1', profileName: 'Londinium',
                shotId: 'shot-1', historyCount: 4,
            });

            const order = await page.evalFn(() => {
                const root = window.__h.q('live-screen').shadowRoot;
                const region = (el) => {
                    for (const name of ['live-header', 'live-rail', 'live-foot']) {
                        const host = root.querySelector(name);
                        if (host && host.getBoundingClientRect().height > 0) {
                            const r = host.getBoundingClientRect();
                            const b = el.getBoundingClientRect();
                            if (b.top >= r.top - 1 && b.bottom <= r.bottom + 1) return name;
                        }
                    }
                    return 'other';
                };
                const seen = [];
                const walk = (node) => {
                    for (const el of node.querySelectorAll('*')) {
                        if (el.shadowRoot) walk(el.shadowRoot);
                        if (el.tagName === 'BUTTON' && !el.disabled && el.tabIndex >= 0) seen.push(region(el));
                    }
                };
                walk(root);
                return seen;
            });
            const first = (name) => order.indexOf(name);
            assert.ok(first('live-header') >= 0 && first('live-rail') >= 0, `regions reached: ${[...new Set(order)]}`);
            assert.ok(first('live-header') < first('live-rail'),
                `the tab order leaves the header after the rail: ${order.join(' ')}`);
        }));

        /* -- 8. THE BANDS FIT ----------------------------------------------- */

        test('at this size the bands fit: nothing in them scrolls or clips', () => mounted(async (page) => {
            await configure(page, {
                targets: TARGETS, favourites: FAVOURITES, favourite: 'p1', profileName: 'Londinium',
                shotId: 'shot-1', historyCount: 4, mode: 'steam',
                /* THE SCALARS RIDE WITH THE PHASES — gate 6's derivation always carries
                 * both, and since Ben's ruling the band reads them. */
                storedDerivation: {
                    ok: true,
                    scalars: {
                        durationSeconds: 45, dose: 18, yield: 39, ratio: 2.2,
                        timeToFirstDrop: 8, averageFlow: 2.1, peakFlowAfterFirstDrop: 2.8,
                        averagePressure: 6.1, peakPressure: 9,
                    },
                    phases: {
                        preinfusion: { seconds: 15, weight: 10, volume: 17 },
                        extraction: { seconds: 30, weight: 29, volume: 30 },
                        total: { seconds: 45, weight: 39, volume: 47 },
                    },
                },
            });

            const overflowing = await page.evalFn(() => {
                const root = window.__h.q('live-screen').shadowRoot;
                const out = [];
                const check = (el, path) => {
                    const cs = getComputedStyle(el);
                    const scrolls = /auto|scroll|hidden|clip/;
                    if (scrolls.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 1) out.push(`${path} block`);
                    if (scrolls.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 1) out.push(`${path} inline`);
                };
                for (const name of ['live-header', 'live-rail', 'live-foot']) {
                    const host = root.querySelector(name);
                    check(host, name);
                    if (host.shadowRoot) {
                        for (const el of host.shadowRoot.querySelectorAll('*')) check(el, `${name} ${el.className}`);
                    }
                }
                for (const el of root.querySelectorAll('.foot-grid, .foot-controls, .actions, .stack')) {
                    check(el, el.className);
                }
                return out;
            });
            /* ONE DECLARED EXCEPTION, AND IT IS BEN'S (22 Aug 2026). Slate's own rail is
             * nine rows in 1082px and the ruling puts those nine rows here, which is not
             * a depth the bench tablet or the 1000x600 floor pays for. §4.1's "never
             * scrolls" loses to its own second half: a row below the fold with no way to
             * reach it IS dropped, and "drops nothing" is the promise that matters. So
             * <live-rail> scrolls below the reference geometry and NOTHING ELSE DOES —
             * the exception is named, not widened, and the reference geometry still
             * fits. The rail's own reachability is asserted in section 5. */
            const RAIL_MAY_SCROLL = geometry.name !== 'desktop';
            /* AND THE INLINE AXIS COMES WITH IT AT THE FLOOR ONLY, which is CSS and not
             * a second decision: `overflow-y: auto` makes the other axis compute to
             * `auto` too, so the stepper's own floor form — 208px well + 18px gutter +
             * the name column, which was ALREADY wider than the rail's interior at the
             * design floor and spilled visibly there (live-rail.js's §2.4 bargain,
             * DQ-0-A's number) — now reports as a scroll container instead of as spill.
             * Nothing new is hidden and nothing new overflows; the same pixels are
             * reachable rather than off the edge.
             *
             * MEASURED, 22 Aug, after the standing rail landed: the rail's content box
             * is 324px wide (268px track + 28px padding each side) against a 310px
             * interior at the floor — 14px, reported — and a 323px interior at the
             * bench, i.e. ONE pixel, which is the 267.05px stack rounding up inside a
             * 268px track and is what this walk's own ±1px tolerance is for. So the
             * inline axis is a FLOOR artefact, not a "below desktop" one; pinning it at
             * the bench would have hidden a real 14px regression there behind an
             * expectation that already allowed it. Named per geometry so a THIRD
             * region, the bench, or the reference geometry still turns this red. */
            const expected = RAIL_MAY_SCROLL
                ? ['live-rail block', ...(geometry.name === 'floor' ? ['live-rail inline'] : [])]
                : [];
            assert.deepEqual(overflowing, expected,
                'slate-live.css:1126-1131: "a scroll affordance on a wall tablet is worse than the crowding it fixes"');
        }));

        /**
         * THE TRUNCATION THE WALK ABOVE CANNOT SEE, PINNED.
         *
         * That walk visits the three region shadow roots plus `.foot-grid`,
         * `.foot-controls`, `.actions` and `.stack`, and never descends into a library
         * component — so a phase-table header reading "Volu…" inside `<ui-data-grid>` is
         * invisible to it. It is invisible to the skeleton suite too (`REGION_TREE` skips
         * every `UI-*`). This test asks the one question that finds it: which boxes in the
         * FOOT BAND declare `text-overflow: ellipsis` and are currently narrower than
         * their own text. The band rather than the screen, because ellipsis elsewhere is a
         * component doing its job in a slot it was given — the favourites bank shortens
         * "Extract Blooming Espresso" at every geometry by design, and a bank item's label
         * is #24's contract, not this screen's composition. The band is where truncation
         * is a composition outcome, because this file's `.foot-grid` decided the split.
         *
         * WHY THE FLOOR'S ANSWER IS PINNED RATHER THAN EMPTY. At 1000x600 the band is
         * 643px wide and the two things in it have their own floors: the phase table
         * needs ~445px to write its four column labels in full (measured by sweeping the
         * track: clean at 450, "Volume" clipped at 420) and the controls column is 240px
         * of `<ui-stepper>`'s own arithmetic, which `min-content` and `fit-content(30%)`
         * both fail to shrink. 445 + 240 + an 18px gap is 703 into 643. Every cure was
         * measured and each costs more than it saves: stacking the controls under the
         * table clears the labels and takes the band from 200 to 240, which pushes
         * `<ui-chart-card>` - already pinned on its 186px floor at this size - 26.25px
         * INSIDE the foot band, trading two ellipses for overlapping ink; at the bench it
         * costs 120px of band and 120px of chart to fix nothing. So the truncation stands
         * as the design floor's stated degradation, and it is named here so it cannot
         * spread to a third column, or to the bench, without turning this red.
         */
        test('the only truncation in the foot band is the design floor\'s recorded pair', () => mounted(async (page) => {
            await configure(page, {
                targets: TARGETS, favourites: FAVOURITES, favourite: 'p1', profileName: 'Londinium',
                shotId: 'shot-1', rating: 73, historyCount: 12,
                /* THE SCALARS RIDE WITH THE PHASES — gate 6's derivation always carries
                 * both, and since Ben's ruling the band reads them. */
                storedDerivation: {
                    ok: true,
                    scalars: {
                        durationSeconds: 45, dose: 18, yield: 39, ratio: 2.2,
                        timeToFirstDrop: 8, averageFlow: 2.1, peakFlowAfterFirstDrop: 2.8,
                        averagePressure: 6.1, peakPressure: 9,
                    },
                    phases: {
                        preinfusion: { seconds: 15, weight: 10, volume: 17 },
                        extraction: { seconds: 30, weight: 29, volume: 30 },
                        total: { seconds: 45, weight: 39, volume: 47 },
                    },
                },
            });

            const truncated = await page.evalFn(() => {
                const out = [];
                const walk = (root) => {
                    for (const el of root.querySelectorAll('*')) {
                        const cs = getComputedStyle(el);
                        if (cs.textOverflow === 'ellipsis' && el.clientWidth > 1
                            && el.scrollWidth > el.clientWidth + 1) {
                            out.push(`${el.textContent.trim()} ${el.clientWidth}/${el.scrollWidth}`);
                        }
                        if (el.shadowRoot) walk(el.shadowRoot);
                    }
                };
                walk(window.__h.q('live-screen').shadowRoot.querySelector('live-foot'));
                return out.sort();
            });

            /* PARITY SURFACES 0 AND 1 MOVED BOTH NUMBERS, and only these two columns.
             * Surface 0: --ui-tracking-cap went .04em -> Slate's own .12em, so an
             * uppercase column head needs more width (Volume 63 -> 69, Weight 58 -> 65)
             * and gets less of it (44 -> 39, 56 -> 51). Surface 1: the column unit is
             * PARENTHESISED, which is Slate's Live spelling ("(s)", "(g)", "(mL)" —
             * live-ready [i=128/130/132]) against the History page's bare one, and the
             * brackets take room in the header's flex, so the label half gets less again
             * (39 -> 32, 51 -> 44); "Weight" itself measures 64 rather than 65 because
             * the label and the unit are re-laid out around them.
             * SAME TWO COLUMNS, same geometry: the floor is still the only screen that
             * truncates, which is what this test is for. The recorded pair is
             * re-measured, not relaxed — a third column appearing here, or either of
             * these at the bench, still turns it red. */
            /* RE-MEASURED AFTER BEN'S FOOT RULING, and the list GREW — which is the
             * honest report, not a relaxation. The band had two blocks (the phase table
             * and the controls column) and now has four: Slate's own last-shot identity
             * and the four derived scalars joined them ("the foot = Slate's foot").
             * Four content-sized blocks in 1195px (bench) and 643px (floor) is more than
             * either has, so the 1fr track — the phase table — gives, and it gives from
             * its row headers and column heads. The reference geometry is CLEAN: nothing
             * in this band truncates at 1920, which is the size the ruling was made at
             * and the size the oracle was captured at.
             *
             * WHAT IT COSTS BELOW THAT IS A DEFERRED QUESTION, not a number to fix here:
             * C2 names "the foot band's order of surrender" and its first step (drop the
             * derived list) was spent by D1 and has just been un-spent by this ruling.
             * Which of the four blocks gives at the bench is Ben's call; the measurement
             * is what this pass owes him, and it is pinned exactly so it cannot spread
             * to the reference geometry unnoticed. */
            /* STILL THE SAME FIVE after it21's foot work, which is the point of
             * re-running it: the way out went back to Slate's own block, the rate
             * strip got the box its component never states (see .foot-controls in
             * live-screen.js) and the phase table now clips inside its own track
             * instead of pushing the band, so what degrades below the reference is
             * exactly what degraded before and nothing new joined it.
             * THE REFERENCE GEOMETRY IS CLEAN: nothing in this band truncates at 1920,
             * which is the size the ruling was made at and the oracle captured at, and
             * that is what the empty list asserts. */
            /* THREE OF THE FIVE WENT ON 30 AUGUST, AND THE LIST SHRANK HONESTLY.
             * Ben, on the shipped 0.7.0: "The phase section has lots of ..s with text
             * clipping etc." Measured on his tablet, the four headers with their
             * bracketed units need 495 px in a track that was giving them 365, so
             * Time, Volume and Weight were all ellipsised to stubs.
             *
             * The unit moved onto its own line (ui-data-grid's `stacked-units`), which
             * takes the same table to 409, and two neighbours gave the width back: the
             * weather block 320 -> 290 and the stats column PRESSURE -> PRESS AVG/PEAK.
             * All three column heads now draw whole at BOTH sub-reference geometries.
             *
             * THE TWO ROW HEADERS STILL GIVE, and that is the design floor doing what
             * C2 says it should: below the reference the 1fr track surrenders, and it
             * surrenders from the row headers first. The reference geometry stays
             * clean. */
            const expected = geometry.name === 'desktop' ? [] : [
                'Extraction 85/112', 'Preinfusion 85/121',
            ];
            assert.deepEqual(truncated, expected,
                `truncation on this screen changed: ${truncated.join(', ') || 'none'}`);
        }));

        /* -- 9. THE RAIL'S NAMES (cmp-lo-3 / cmp-lo-2, Ben's rulings 21 Aug 2026) -- */

        /**
         * ONE TEMPLATE, EVERY MODE, AND THE NAME IS DRAWN.
         *
         * cmp-lo-3: "The Live rail's three espresso target steppers render with no visible
         * label - Slate shows a microcap label per row (Dose/Drink/Brew); Decal's three
         * tracks are visually identical (all read an em dash at idle) and are named only by
         * aria-label, so Dose and Drink weight (both unit g when loaded) cannot be told
         * apart by sight." Ben: a visible label to the LEFT of every rail stepper, the well
         * filling the rest of the row.
         *
         * The claim is made in all four modes because one template renders them all -
         * espresso's three, steam's two plus its stop target, hot water's one plus its stop
         * target, flush's three - and a fix at that template that missed a mode would be
         * the same class of defect one mode over.
         */
        test('cmp-lo-3: every rail stepper in every mode draws its name, to the LEFT of its well',
            () => mounted(async (page) => {
                await configure(page, { targets: TARGETS, offers: { milkProbe: true, stopAtWeight: true } });
                const hitMin = parseFloat(await page.resolveValue('var(--ui-hit-min)', 'width'));
                /* --ui-space-4 since parity surface 1: Slate's rail gutter is 18, not 12 —
                 * 28 (inset) + 88 (name) + 18 + 268 (well) + 28 = 430, its whole rail. */
                const gap = parseFloat(await page.resolveValue('var(--ui-space-4)', 'width'));

                /* ONCE, NOT ONCE PER MODE. This loop used to switch `screen.mode` and
                 * re-read, because the rail recomposed and a fix at the one template
                 * could have missed a mode. Ben's standing-rail ruling makes every mode's
                 * targets present at the same time, so ONE walk covers what four used to
                 * — and the walk is over the rail's own children rather than over a list
                 * of modes, which is the stronger form of the same claim. */
                {
                    const mode = 'standing';
                    const steppers = await railLabels(page);
                    assert.equal(steppers.length, 9, `the rail has ${steppers.length} steppers, not Slate's nine`);

                    /* TWO ROWS SHOW NO NAME SINCE 30 AUGUST 2026, and they are the two the
                       rail drew at a second size. Ben: "lets remove all these little sub
                       headings ... we dont say this for any of the others and we have units
                       so its mostly clear what it does." FLOW sits over a well reading mL/s
                       and TEMPERATURE over one reading degrees.

                       THE NAME IS HIDDEN, NOT DELETED, and that is what the branch below
                       tests. The band is named by aria-labelledby pointing AT the label, so
                       display:none would leave the control with no accessible name at all;
                       the shared visually-hidden treatment keeps it rendered and announced.
                       Every claim in this test still holds for them EXCEPT the two about
                       drawn geometry, which is exactly the change and nothing more. */
                    const HIDDEN_NAMES = new Set(['steamFlow', 'hotWaterTemp']);

                    for (const row of steppers) {
                        assert.ok(row.label, `${mode}/${row.key}: no visible label element at all`);
                        assert.equal(row.hidden, false, `${mode}/${row.key}: the label is display:none`);

                        /* ONE STRING. The painted text, the property the screen set, and the
                         * name the group answers to are the same characters - which is what
                         * stops the microcap and the accessible name drifting apart. */
                        assert.equal(row.visible, row.property,
                            `${mode}/${row.key}: the label paints "${row.visible}" for a control called `
                            + `"${row.property}"`);
                        assert.equal(row.namedBy, 'aria-labelledby',
                            `${mode}/${row.key}: the group restates its name instead of taking it from the `
                            + 'element that shows it');
                        assert.equal(row.spoken, row.visible,
                            `${mode}/${row.key}: spoken "${row.spoken}" against painted "${row.visible}"`);

                        if (HIDDEN_NAMES.has(row.key)) {
                            /* CLIPPED TO A PIXEL, WHICH IS THE TREATMENT — not zero, because
                               a zero box is removed from the accessibility tree and the four
                               assertions above have just proved the name survives. */
                            assert.ok(row.label.width <= 1.5 && row.label.height <= 1.5,
                                `${mode}/${row.key}: the name is hidden, so its box should be `
                                + `clipped to a pixel, not ${row.label.width}x${row.label.height}`);
                            continue;
                        }

                        assert.ok(row.label.width > 0 && row.label.height > 0,
                            `${mode}/${row.key}: the label has no box`);

                        /* TO THE LEFT, and the well takes what is left of the row. */
                        assert.ok(row.label.right <= row.band.x + 0.51,
                            `${mode}/${row.key}: the label (ends ${row.label.right}) overlaps the well `
                            + `(starts ${row.band.x})`);
                        assert.ok(Math.abs(row.band.x - (row.label.right + gap)) < 0.51,
                            `${mode}/${row.key}: the gutter between name and well is `
                            + `${(row.band.x - row.label.right).toFixed(2)}, not --ui-space-4`);
                        assert.ok(Math.abs((row.band.x + row.band.width) - (row.row.x + row.row.width)) < 0.51,
                            `${mode}/${row.key}: the well does not reach the end of the row`);
                        assert.ok(Math.abs(row.label.width + gap + row.band.width - row.row.width) < 0.51,
                            `${mode}/${row.key}: name + gutter + well is not the row`);

                        /* L22 HOLDS, and it is the cap that pays for the name: the well gives
                         * its caps' slack down to --ui-hit-min and never past it. */
                        assert.ok(row.cap >= hitMin - 0.51,
                            `${mode}/${row.key}: a ${row.cap}px cap is under --ui-hit-min`);

                        /* AND THE NUMBER IS STILL THE NUMBER. The value cell keeps its own
                         * floor whatever the name took, so nothing is ellipsised to make
                         * room for a label.
                         *
                         * ONE NAMED EXCEPTION, and it is not the label's doing — DQ-0-A.
                         * Parity surface 0 made --ui-display-xs Slate's flat 27px (it was
                         * clamp(22px, 2.2cqi, 27px) and rendered 22 in a 268px well), and
                         * `drinkWeight` is the one reading that carries a RATIO beside its
                         * number: "40 (1:2.4)". At 27px that string is wider than the
                         * component's 110px value floor, so it ellipsises wherever the
                         * well is at its floor form — the bench and the design floor, not
                         * the reference geometry, where the well is 324 and it fits.
                         * Slate has the same 27px in the same 110px cell and does not hit
                         * this, because Slate paints only "40" and "g" in the cell (CITE
                         * live-ready .slate-stepper-value [i=33] text "40g (1:2.4)" with
                         * rendered spans [i=34] "40" and [i=35] "g"): the ratio is in its
                         * DOM, not in its cell. WHERE THE RATIO LIVES IS THE LIVE
                         * SURFACE'S ROW, recorded and left here.
                         * The exception is pinned to that one key so any other reading
                         * clipping, at any geometry, still turns this red. */
                        /* THE NAMED EXCEPTION IS GONE, and the reason is the fix Ben
                         * asked for by name ("the drink-weight ratio clip"). The cell
                         * used to carry "40 (1:2.4)" and ellipsise it wherever the well
                         * was at its floor form; Slate paints only "40" and "g" there
                         * (ORACLE .slate-stepper-value [i=33] textContent "40g (1:2.4)"
                         * with rendered spans [i=34] "40" and [i=35] "g" and NO third
                         * painted record anywhere in the rail), so the parenthetical left
                         * the well. No reading clips at any geometry now. */
                        assert.equal(row.valueClipped, false,
                            `${mode}/${row.key}: the value cell ellipsised its reading`);
                        /* TWO NAMES OVERFLOW THEIR COLUMN ON PURPOSE, and they are the
                         * two Slate draws as CONTINUATION rows: "Flow" and "Temperature"
                         * ([i=56], [i=82], 12px against the block headings' 17). At
                         * Decal's one --ui-tracking-cap (.12em, surface 0's ruling over
                         * Slate's own .09em on this one label) TEMPERATURE is about 4px
                         * wider than the 88px column, and 4px is not worth breaking a
                         * word over — so it takes the 18px gutter, which is exactly what
                         * Slate's own #hotwater-label [i=74] does with 20px of overhang.
                         * Named by key so any OTHER label clipping still turns this red. */
                        /* AND THE TWO STOP ROWS JOIN THEM BELOW THE REFERENCE GEOMETRY
                         * (it16), for the same trade at the other end of the type scale.
                         * "STEAM" and "HOT WATER" are BLOCK headings — 17px, not the
                         * continuation rows' 12 — and each carries a stop-condition
                         * caption under it, so both rows are given overflow-wrap: normal:
                         * a broken word on three lines plus a caption measures 88.56px
                         * against a 64px control, and the rail's uniform row height is
                         * its whole claim. With the word kept whole the name overflows
                         * the NARROWED column at the bench (77px) and the floor (64px)
                         * by a few pixels, into the same 18px gutter the two continuation
                         * labels already use. NEITHER overflows at the reference
                         * geometry, where the column is Slate's own 88 and Slate's own
                         * #hotwater-label [i=74] takes two lines exactly as this does. */
                        const stopRow = row.key === 'steamDuration' || row.key === 'milkStopTemp'
                            || row.key === 'hotWaterVolume';
                        const overflowsByDesign = row.key === 'hotWaterTemp'
                            || row.key === 'steamFlow'
                            || (stopRow && geometry.name !== 'desktop');
                        if (!overflowsByDesign) {
                            assert.equal(row.labelClipped, false,
                                `${mode}/${row.key}: the label is clipped rather than wrapped`);
                        }
                    }
                }
            }));

        /**
         * THE ROW IS STILL A ROW. Bug L5 is a rhythm that depends on its rows; the names
         * must not have bought themselves height, or the rail's track budget - six tracks
         * at the 1000x600 floor, `live-targets.js`'s own arithmetic - stops closing.
         */
        test('cmp-lo-3: the names cost the rail no height and no uniformity',
            (t) => mounted(async (page) => {
                await configure(page, { targets: TARGETS, offers: { milkProbe: true } });
                await page.evalFn(async () => {
                    const screen = window.__h.q('live-screen');
                    screen.mode = 'steam';
                    await screen.updateComplete;
                });
                await page.settle(3);

                const controlH = parseFloat(await page.resolveValue('var(--ui-control-h)', 'block-size'));
                const tree = await railTree(page);

                /* DQ-0-B, RE-MEASURED at parity surface 1 and STILL NOT RESOLVED HERE.
                 *
                 * WHAT MOVED, AND WHY. Surface 0 restored --ui-tracking-cap to Slate's own
                 * .12em, which widens every microcap by 8% of its type size per character
                 * and pushed the four "... temperature" names to a fourth wrapped line AT
                 * THE FLOOR ONLY (64 -> 72). Surface 1 then put the rail on Slate's own
                 * arithmetic — --ui-rail-w 430 with a 28px inset and an 18px gutter, so
                 * that 28 + 88 (name) + 18 + 268 (well) + 28 = 430 exactly, which is what
                 * the oracle measures and what closed twelve element-level rows. The rail
                 * is EXACT at the reference geometry and every row there is 64.
                 *
                 * BELOW THE REFERENCE THE NAME COLUMN PAYS FOR IT, because the rail's
                 * interior lost 26px (inset 2 x 10, gutter 6) at every width while the
                 * well keeps its hit-floor form: min(--ui-stepper-label-w, 100% - gutter -
                 * well-floor) resolves to 88 / 51.05 / 42 at desktop / bench / floor,
                 * where it was 88 / 77.05 / 64. A narrower column is more wrapped lines,
                 * and a label taller than --ui-control-h grows its row.
                 *
                 * MEASURED, all three geometries, every mode, after the change:
                 *   desktop 1920x1200  label 88.00  EVERY row 64  <- Ben's own tablet
                 *   bench   1281x801   label 51.05  "... temperature" 90, "Drink weight"
                 *                                   and "Water volume" and "Flush
                 *                                   duration" 72, the rest 64
                 *   floor   1000x600   label 42.00  "... temperature" 108, most two-word
                 *                                   names 72, the rest 64
                 * Nothing scrolls at any of the three (scrollHeight === clientHeight in
                 * all four modes, asserted below and in the deepest-rail test).
                 *
                 * IT IS NOT RESOLVED HERE because every answer is Ben's. Growing the row
                 * breaks the rail's rhythm (bug L5); pinning the row clips a label, which
                 * spec section 2.4 forbids; shortening the string is DQ-735's own option
                 * (4) and would answer his open question by a side door; and Slate's own
                 * third answer — a full-width label ROW above the well for the long names
                 * — is a structural change to this surface. The measurement is what this
                 * pass owes him, and it sharpens DQ-0-B and DQ-735 with it.
                 *
                 * PINNED EXACTLY, not relaxed: the height of every track in the steam
                 * rail, per geometry, by the name it paints. Any other row growing, or any
                 * of these changing, still turns this red. */
                /* RE-MEASURED FOR THE STANDING RAIL (Ben's ruling, 22 Aug 2026). The old
                 * pin named "Steam temperature" / "Steam flow" / "Steam time" — Decal's
                 * own invented labels, and two of those rows are not on the Live rail at
                 * all any more. Slate's short names are what wrap now, and only where the
                 * name column is narrower than the words: "HOT WATER" is two lines at
                 * every geometry (Slate's own #hotwater-label [i=74] is two lines too, at
                 * 41px), and the smaller geometries wrap more. Pinned exactly, per
                 * geometry, by the name the row PAINTS — a row that moved is still a
                 * finding for Ben and not a number to relax. */
                const grown = Object.fromEntries(tree
                    .filter((row) => Math.abs(row.height - controlH) >= 0.51)
                    .map((row) => [String(row.label ?? row.tag), row.height]));
                t.diagnostic(`${geometry.name} rail rows over --ui-control-h: ${JSON.stringify(grown)}`);
                /* EVERY ROW IS --ui-control-h, AND THE FOUR THAT OPEN A SECTION ARE THAT
                 * PLUS THEIR HAIRLINE AND ITS INSET. Slate rules the rail into five
                 * blocks with four lines (after the drink presets, after brew, after the
                 * steam-flow presets, after flush); the rule is one declaration on the
                 * row that opens a block, so the cost is the same constant on each of
                 * them and no row's height depends on how many rows are above it (L5).
                 * NOTHING ELSE GREW: the long names wrap INSIDE the 88px column and the
                 * rows stay 64 — including "Hot water", which is two lines here and two
                 * lines in the oracle (#hotwater-label [i=74] rect [28,991,108,41]). */
                const hairline = parseFloat(await page.resolveValue('var(--ui-hairline)', 'width'));
                /* --ui-space-4 SINCE 23 Aug, and the change is Ben's: "the line should be
                 * between two of the steppers or well spaced below the presets etc." The
                 * rail's gap puts --ui-space-6 above every divider; this inset is what is
                 * left below it, and at --ui-space-2 that was 28 above against 8 below —
                 * a line that read as the next row's lid rather than as a boundary. The
                 * token is read here rather than written down so the pin follows the
                 * sheet, which is why this line is the only one that had to move. */
                /* --ui-space-5 SINCE 23 Aug, and it is HALF of a centring rather than a
                 * number of its own. Ben: "the seperater line between Brew and Steam Is
                 * not centered between the two. Also Brew itself it not centered between
                 * the line above and below it." The rail's gap is trimmed to the same
                 * token by a margin on the opening row, so the line now has 24 above it
                 * and 24 below. Read off the sheet, so the pin follows a change to
                 * either half. */
                const inset = parseFloat(await page.resolveValue('var(--ui-space-5)', 'width'));
                const opens = tree.filter((row) => row.sectionStart);
                assert.equal(opens.length, 4, `${opens.length} rows open a section, not Slate's four`);
                /* THE PRESET ROWS ARE A TEXT ROW NOW, NOT A CONTROL ROW — Ben, 23 Aug
                 * 2026: "the presets ... shouldn't be the normal toggle, but insted the
                 * same look slate had with just numbers". A row of four numbers on the
                 * rail's ground does not reserve a control's box, and Slate's own does
                 * not either: ORACLE live-ready #drink-out-preset-1 [i=37] rect
                 * [134,395,67,34] — 34px, half of --ui-control-h. Decal's floor is the
                 * TOUCH one instead (ui-bank's `plain` form: a 48px cell in a 50px row),
                 * because the cells are still pressable and L22 is not negotiable.
                 * Pinned exactly, like every other row here: one number per kind of row,
                 * and a row that moves is still a finding. */
                const plainRow = parseFloat(await page.resolveValue('var(--ui-hit-min)', 'block-size'))
                    + 2 * hairline;
                const expectedFor = (row) => (row.tag === 'ui-preset-bank' ? plainRow : controlH);
                for (const row of tree) {
                    if (!row.sectionStart) {
                        const want = expectedFor(row);
                        assert.ok(Math.abs(row.height - want) < 0.51,
                            `a rail row ("${row.label ?? row.tag}") is ${row.height} against `
                            + `${want} — the rail's row heights are DQ-0-B's `
                            + 'measurement and are pinned exactly; a row that moved is a finding for Ben');
                        continue;
                    }
                    /* AN OPENING ROW IS THE SAME ROW PLUS ITS HAIRLINE AND THE HAIRLINE'S
                     * INSET — and whether the hairline itself shows up in the box depends
                     * on the control: `<ui-bank>` states `min-block-size: --ui-control-h`
                     * with `box-sizing: border-box`, so its border grows INTO the 64,
                     * while a stepper's height comes from its content and the border adds
                     * to it. One pixel, two box models, and both are the components' own
                     * — so the pin is the closed interval rather than a number that would
                     * have to know which control opened the block. */
                    const low = expectedFor(row) + inset;
                    assert.ok(row.height >= low - 0.51 && row.height <= low + hairline + 0.51,
                        `an opening row ("${row.label ?? row.tag}") is ${row.height}, outside `
                        + `${low}..${low + hairline} (the row + --ui-space-5 `
                        + `${inset} + at most one ${hairline}px hairline)`);
                }
            }));

        /**
         * cmp-lo-2 IS CLOSED BY REMOVAL, and this is what stands in its place.
         *
         * The finding was: the Live rail's MODE BANK draws four equal cells in a track
         * that cannot widen, so "Hot water" did not fit at any inset below the reference
         * geometry. Ben's answer (21 Aug) was to trim the cell inset until the widest
         * default label fits its equal cell, and to add a label-fits assertion. Ben's
         * NEXT ruling (22 Aug) removed the control: the rail stands Slate's nine rows in
         * every state, so there is nothing left to pick between and Slate has no such
         * bank on Live either.
         *
         * WHAT THIS ASSERTS NOW is that the pressure is gone rather than moved: no bank
         * left in the rail is given a definite width narrower than its own labels want.
         * The two survivors were L25's stop-mode toggles, two short words each, and they
         * were never under it — which is why they stayed `regular` when the mode bank
         * took the trim. Since it16 even those are gone: the stop condition is a caption
         * inside the stepper's own name cell, so the rail's only bank is the one inside
         * <ui-preset-bank>, whose cells hold "0.6" and "36". The empty list IS the
         * assertion — a bank appearing in the rail again is what turns this red.
         */
        test('cmp-lo-2: no bank in the rail is narrower than its own labels', () => mounted(async (page) => {
            await configure(page, { targets: TARGETS, offers: { milkProbe: true, stopAtWeight: true } });
            const banks = await page.evalFn(() => {
                const rail = window.__h.q('live-screen').shadowRoot.querySelector('live-rail');
                /* THE RAIL'S BANKS, WHEREVER THEY ARE. A bank inside <ui-preset-bank>
                 * is in that component's shadow root, so a light-DOM query alone would
                 * report "no banks in the rail" and pass this test by not looking. */
                const hosts = [
                    ...rail.querySelectorAll('ui-bank'),
                    ...[...rail.querySelectorAll('ui-preset-bank')]
                        .map((el) => el.shadowRoot.querySelector('ui-bank')).filter(Boolean),
                ];
                return hosts.map((bank) => ({
                    row: bank.dataset.row ?? null,
                    density: bank.getAttribute('density'),
                    rows: [...bank.shadowRoot.querySelectorAll('.item')].map((button) => {
                        const label = button.querySelector('.label') ?? button;
                        const range = document.createRange();
                        range.selectNodeContents(label);
                        return {
                            text: (label.textContent ?? '').trim(),
                            needs: +range.getBoundingClientRect().width.toFixed(2),
                            box: +label.getBoundingClientRect().width.toFixed(2),
                            cell: +button.getBoundingClientRect().width.toFixed(2),
                        };
                    }),
                }));
            });

            /* TWO, AND THEY ARE THE PRESET BANKS — the stop-mode toggles went with
             * it16's caption. `row` is null on these: the data-row attribute is on the
             * <ui-preset-bank> host, not on the bank inside it. What matters is the
             * count and the two assertions under it. */
            assert.equal(banks.length, 2, `the rail's banks are ${banks.length}, not the two preset banks`);
            for (const bank of banks) {
                /* AND THE PRESET BANKS ASK FOR THE TRIM, which is the finding's own
                 * cure applied where the pressure actually is. This used to assert the
                 * opposite — "no rail bank is under that pressure now" — and it was
                 * true of the banks it could see: it walked the rail's LIGHT dom, where
                 * a <ui-preset-bank>'s own bank is not. Looking inside found cmp-lo-2's
                 * shortfall intact at the design floor: four 52px cells, --ui-space-4
                 * each side, 15.5px of box for a "30" that needs 21.7. Ben's answer to
                 * the finding is the trim, so the trim is here. */
                assert.equal(bank.density, 'compact',
                    'a rail bank under a definite width is not taking the cmp-lo-2 trim');
                for (const row of bank.rows) {
                    assert.ok(Math.abs(row.cell - bank.rows[0].cell) < 0.51,
                        `"${row.text}" is ${row.cell} against ${bank.rows[0].cell} — the cells must stay EQUAL`);
                    assert.ok(row.needs <= row.box + 0.51,
                        `"${row.text}" needs ${row.needs} in a ${row.box} box — cmp-lo-2's shortfall, `
                        + 'in a bank that was never supposed to have one');
                }
            }
        }));

        /* -- 10. THE WALL CLOCK (audit-1, Ben: restore it) ------------------ */

        /**
         * The clock is back, it is HH:MM, it is right-aligned at the top of the readings
         * column where Slate draws it, and it costs the screen nothing — the block is still
         * exactly as tall as its readings, and the header band it was measured OUT of is
         * unchanged (the composition test above still finds three controls in the action
         * cluster). Why not the header: `live-screen.js`'s own placement note, with the
         * L22 numbers.
         */
        /**
         * L2's PROMOTION, WHICH ONLY A SECOND SLATE STATE COULD SEE (parity surface 1).
         *
         * Slate recomposes the gauge cluster while a shot runs, by WEIGHT and never by
         * position: the four numbers that change fifteen times a second grow to
         * --slate-display-xl, and the three that are context recede to
         * --slate-display-sm in --slate-muted ("this is a demotion, not a hide").
         *   ORACLE live-ready  #slate-live-pressure [i=100] font-size = 45px,
         *          #slate-live-flow [i=103] = 45px, #data-group-temp [i=108] = 45px
         *   ORACLE live-pulling #slate-live-pressure [i=103] = 52px,
         *          #slate-live-flow [i=106] = 52px, #data-group-temp [i=111] = 30px
         *   SOURCE slate-live.css:2083-2110, the two [data-live-state="pulling"] blocks
         *
         * <ui-stat-tile> was built for it — its own header calls the 45 -> 52 move "the
         * whole of what L2 breaks" — and every tile carries reserve="xl", so the value
         * TRACK is already the promoted size and nothing moves when the type does. What
         * was missing until this pass was the trigger; the sizes were static and the
         * cluster looked identical mid-shot. Nine element-level rows at live-pulling,
         * invisible at live-ready, which is why the surface diffed two states.
         *
         * THE BOX IS ASSERTED NOT TO MOVE, because that is L2's actual defect: a value
         * track sized smaller than its own digits.
         */
        test('L2: a running shot does not resize or recolour any tile in the cluster',
            () => mounted(async (page) => {
                await configure(page, { targets: TARGETS });
                const read = () => page.evalFn(() => {
                    const root = window.__h.q('live-screen').shadowRoot;
                    return [...root.querySelectorAll('.gauges > ui-stat-tile')].map((tile) => {
                        const value = tile.shadowRoot.getElementById('value');
                        const cs = getComputedStyle(value);
                        return {
                            label: tile.getAttribute('label'),
                            size: tile.getAttribute('size'),
                            fontSize: cs.fontSize,
                            ink: cs.color,
                            /* The TILE's box, not the value element's: the value element
                             * is its own type and grows with it (line-height 1), and what
                             * reserve="xl" buys is that the tile around it does not. */
                            boxH: +tile.getBoundingClientRect().height.toFixed(2),
                        };
                    });
                });

                const rest = await read();
                /* SEVEN SINCE it14, WHICH IS SLATE'S OWN NUMBER (ORACLE live-ready
                 * [i=96..114] Time / Pressure / Flow / Weight / Group / Steam / Tank).
                 * The rewrite shipped five and this pass restored two.
                 *
                 * Steam came back because the machine serves it — `steamTemperature` is
                 * one of the eleven keys the snapshot always writes.
                 *
                 * TANK CAME BACK AS AN ABSENCE. It was held out one iteration on the
                 * grounds that the water level is on /ws/v1/machine/waterLevels, which no
                 * feed in live-stores.js attaches, "so a Tank tile could only ever render
                 * the dash". Measured against the oracle, that is backwards — SLATE'S OWN
                 * TANK IS A DASH, at live-ready ([i=114] "—", 45px, muted) and again at
                 * live-pulling ([i=117] "—", 30px), with no unit element beside it in
                 * either state. So a present, dashed Tank is a restore of what the
                 * reference draws, and Ben's own rail rule ("present + dashed" for a key
                 * the machine does not serve) applied where it plainly belongs. Nothing
                 * invents a level: `readings.tank` is never written, so the tile answers
                 * with its own dash. The missing FEED is the deferred question. */
                assert.equal(rest.length, 7, 'the cluster is seven tiles');
                assert.deepEqual(rest.map((tile) => tile.label),
                    ['Time', 'Pressure', 'Flow', 'Weight', 'Group', 'Steam', 'Tank'],
                    'the cluster is not the oracle\'s seven, in the oracle\'s order');

                await configure(page, { machineState: 'espresso', targets: TARGETS });
                /* The promotion TRANSITIONS (font-size .25s ease, which is Slate's own
                 * and which <ui-stat-tile> carries as departure 6), so the read has to be
                 * after it lands or it measures a frame of the animation. */
                await page.evalFn(() => new Promise((done) => { setTimeout(done, 600); }));
                await page.settle(4);
                const running = await read();

                const xl = await page.resolveValue('var(--ui-display-xl)', 'font-size');
                const lg = await page.resolveValue('var(--ui-display-lg)', 'font-size');
                const muted = await page.resolveToken('--ui-muted', 'color');

                const by = (rows) => Object.fromEntries(rows.map((r) => [r.label, r]));
                const r = by(rest);
                const g = by(running);

                /* SLATE'S RECOMPOSITION IS GONE IN BOTH DIRECTIONS, AND THIS SAYS SO.
                 *
                 * Ben, 29 August 2026: "Lets not change the size or colour of them", and
                 * then, of the promotion an earlier pass kept: "don't have them grow."
                 *
                 * Slate grew Weight, Time, Pressure and Flow to --slate-display-xl and
                 * receded Group, Steam and Tank to --slate-muted at --slate-display-sm.
                 * Decal does NEITHER, so every tile must be byte-identical before and
                 * after. Comparing each row against ITS OWN resting row — rather than
                 * against a token — is what makes this test say "nothing changed" instead
                 * of restating which size each one happens to sit at, and it is why the
                 * test cannot pass by accident if a future pass reintroduces either half. */
                assert.equal(r.Time.fontSize, xl, 'Time rests at --ui-display-xl');
                for (const label of ['Pressure', 'Flow', 'Weight', 'Group', 'Steam', 'Tank']) {
                    assert.equal(r[label].fontSize, lg, `${label} rests at --ui-display-lg`);
                }
                for (const row of running) {
                    const label = row.label;
                    assert.equal(row.fontSize, r[label].fontSize,
                        `${label} changed size while the shot runs — the recomposition is back`);
                    assert.equal(row.ink, r[label].ink,
                        `${label} changed colour while the shot runs — the recomposition is back`);
                }
                for (const label of ['Group', 'Steam', 'Tank']) {
                    assert.notEqual(g[label].ink, muted,
                        `${label} went muted mid-shot, which Ben overrode on 29 Aug 2026`);
                }

                /* L2 ITSELF: the value track is reserved at the promoted size, so the
                 * cluster's boxes are the same before and after. A tile that grew its box
                 * here is the 44px-track-under-52px-digits defect coming back. */
                for (const row of running) {
                    assert.ok(Math.abs(row.boxH - by(rest)[row.label].boxH) < 0.51,
                        `${row.label}'s tile moved ${row.boxH - by(rest)[row.label].boxH}px on the `
                        + 'promotion — reserve="xl" exists so the cluster cannot resize (L2)');
                }
            }));

        test('audit-1: the wall clock is back, in the shipped format, right-aligned, and costs no height',
            () => mounted(async (page) => {
                await configure(page, { targets: TARGETS, favourites: FAVOURITES, favourite: 'p1' });
                const clock = await page.evalFn(() => {
                    const root = window.__h.q('live-screen').shadowRoot;
                    const el = root.querySelector('.clock');
                    if (!el) return null;
                    const block = root.querySelector('.stats-block');
                    const gauges = root.querySelector('.gauges');
                    const r = el.getBoundingClientRect();
                    const b = block.getBoundingClientRect();
                    return {
                        text: el.textContent.trim(),
                        position: getComputedStyle(el).position,
                        numeric: getComputedStyle(el).fontVariantNumeric,
                        rightOf: +(b.right - r.right).toFixed(2),
                        topOf: +(r.top - b.top).toFixed(2),
                        blockH: +b.height.toFixed(2),
                        gaugesH: +gauges.getBoundingClientRect().height.toFixed(2),
                        columnH: +[...block.children]
                            .filter((child) => child !== el)
                            .reduce((sum, child) => sum + child.getBoundingClientRect().height, 0)
                            .toFixed(2),
                        overlapArea: (() => {
                            const g = gauges.getBoundingClientRect();
                            const w = Math.min(r.right, g.right) - Math.max(r.left, g.left);
                            const h = Math.min(r.bottom, g.bottom) - Math.max(r.top, g.top);
                            return w > 0 && h > 0 ? +(w * h).toFixed(1) : 0;
                        })(),
                    };
                });
                assert.ok(clock, 'no clock on the Live screen — audit-1 is the drop this restores');
                assert.match(clock.text, CLOCK_SPELLING,
                    `the clock reads "${clock.text}" — the shipped default is `
                    + `${DEFAULT_CLOCK_FORMAT}, so that is the form the header must draw`);
                assert.equal(clock.position, 'static',
                    '§4.1: no absolutely-positioned structure — the clock is a grid column');
                assert.match(clock.numeric, /tabular-nums/, 'a readout that changes must not jitter');
                assert.ok(Math.abs(clock.rightOf) < 0.51,
                    `the clock is ${clock.rightOf}px from the end of its column — Slate's is right-aligned`);
                /* THE CLOCK COSTS NO HEIGHT — the claim, restated for a block that now
                 * has a heading. It read `blockH === gaugesH` while the readings were the
                 * whole of column 1; parity surface 1 gave the stat cluster the heading
                 * §4.1 always specified ("<stat-cluster> auto (heading + gauges)"), so the
                 * block is legitimately taller than its gauges. What must still be true,
                 * and is what the assertion was ever about, is that the CLOCK adds no row
                 * of its own: the block is exactly its first column's content. */
                /* MEASURED BY REMOVING IT, rather than by summing the block's children:
                 * the stat block gained a row GAP with parity 7-live-polish (Slate leaves
                 * 21px between the profile name and the first readout's microcap —
                 * ORACLE #profile-name [i=92] bottom 201 against the Time label [i=96]
                 * top 222), and a sum of children counts no gaps, so the old spelling
                 * charged the clock for space the grid spends on its own rows. The claim
                 * was always that the clock adds NO ROW of its own; hiding it and
                 * re-measuring says exactly that and nothing else. */
                const withoutClock = await page.evalFn(() => {
                    const root = window.__h.q('live-screen').shadowRoot;
                    const el = root.querySelector('.clock');
                    const block = root.querySelector('.stats-block');
                    el.style.display = 'none';
                    const h = +block.getBoundingClientRect().height.toFixed(2);
                    el.style.display = '';
                    return h;
                });
                assert.ok(Math.abs(clock.blockH - withoutClock) < 0.51,
                    `the clock spent ${(clock.blockH - withoutClock).toFixed(2)}px of the chart's column`);
                assert.ok(clock.blockH >= clock.gaugesH - 0.51,
                    'the readings are inside the block that holds them');
                /* NO OVERLAP means NO RECT INTERSECTION now, not horizontal clearance
                 * (review, 7-live-polish). While the clock spanned every row, "the
                 * cluster ends left of the clock" and "the two do not collide" were the
                 * same fact. The clock is confined to the identity's row so the gauges
                 * can run the full card width — Slate's own geometry: its Tank column
                 * ([i=113] ending 1863) passes UNDER its clock ([i=95] y 170..201, one
                 * row above the labels at y 222). Horizontal clearance would read that
                 * exact restore as a failure; what must actually hold is that the two
                 * boxes never intersect. */
                assert.ok(clock.overlapArea === 0,
                    `the clock's box intersects the gauge cluster's (${clock.overlapArea}px²)`);
            }));

        test('audit-1: one interval, owned by the screen, and it dies with the screen',
            () => mounted(async (page) => {
                /* The D7 law bans a timer on the LED PREVIEW WRITE PATH; a wall clock is a
                 * different mechanism answering a different question (`calibration-store.js`
                 * records the same distinction). What a clock DOES owe is a teardown, and
                 * this is it: the screen is removed and the interval stops. */
                const live = await page.evalFn(() => {
                    const seen = [];
                    const real = window.setInterval;
                    window.setInterval = (...args) => { const id = real(...args); seen.push(id); return id; };
                    const cleared = [];
                    const realClear = window.clearInterval;
                    window.clearInterval = (id) => { cleared.push(id); return realClear(id); };
                    window.__clockProbe = { seen, cleared };
                    return true;
                });
                assert.equal(live, true);

                const cycled = await page.evalFn(async () => {
                    const screen = window.__h.q('live-screen');
                    const parent = screen.parentElement;
                    parent.removeChild(screen);
                    await new Promise((r) => setTimeout(r, 20));
                    const afterRemove = { ...window.__clockProbe };
                    parent.appendChild(screen);
                    await screen.updateComplete;
                    return {
                        started: window.__clockProbe.seen.length,
                        cleared: afterRemove.cleared.length,
                        text: screen.shadowRoot.querySelector('.clock').textContent.trim(),
                    };
                });
                assert.ok(cycled.cleared >= 1, 'the screen left its interval running after it was removed');
                assert.ok(cycled.started >= 1, 'the screen did not re-arm the clock when it came back');
                assert.match(cycled.text, CLOCK_SPELLING, 'and the clock reads again on return');
            }));
    });
}

/* ===========================================================================
 * THE REFERENCE GEOMETRY — 1920x1200, where the two comparison findings were filed.
 *
 * Gate A's two geometries are the bench truth and the design floor, and this file runs
 * every other claim at both. These two claims need a third, and the reason is in the
 * findings themselves: cmp-lo-2 and cmp-lo-3 are element-level diffs against a Slate
 * corpus captured at 1920x1200, so the size the finding is ABOUT is that one. Both fixes
 * are asserted at the Gate A sizes above as mechanisms; here they are asserted as the
 * OUTCOME the findings asked for, at the size the findings measured.
 * =========================================================================== */

describe(`the rail at the reference geometry (${DESKTOP.width}x${DESKTOP.height})`, () => {
    const mounted = (fn) => browser.withPage({ geometry: DESKTOP }, async (page) => {
        await page.mount(STAGE, MODULE);
        await page.settle(6);
        assert.deepEqual(page.pageErrors, [], 'the bands must mount without throwing');
        await fn(page);
    });

    test('cmp-lo-2: at 1920 the control the finding was about is gone', () => mounted(async (page) => {
        /* The finding measured the MODE BANK's four equal cells against the labels they
         * had to hold, at the geometry the Slate corpus was captured at. Ben's ruling of
         * 22 Aug removes that bank — the rail stands Slate's nine rows in every state and
         * Slate draws no picker on Live — so the finding is closed by removal, and what
         * this size has to say about it is that the removal really happened here too.
         *
         * SINCE it16 THERE IS NO BANK ON A TRACK AT ALL: L25's two stop-mode toggles
         * became captions inside the steppers' own name cells, which is where Slate
         * paints the stop condition (#steam-capability [i=49], #hot-water-capability
         * [i=75]). The rail's remaining banks are the two inside <ui-preset-bank>, and
         * their labels-fit assertion is the Gate A test above — at this geometry their
         * cells are Slate's own 67px and were never under the pressure. */
        await configure(page, { targets: TARGETS });
        const rows = await page.evalFn(() => {
            const rail = window.__h.q('live-screen').shadowRoot.querySelector('live-rail');
            return [...rail.querySelectorAll('ui-bank')].map((el) => el.dataset.row ?? null);
        });
        assert.deepEqual(rows, [], 'a bank is back on a track of the rail');
    }));

    test('cmp-lo-3: at 1920 the name is Slate\'s own 88, and the well has the rest',
        () => mounted(async (page) => {
            await configure(page, { targets: TARGETS });
            const steppers = await railLabels(page);
            const cap = parseFloat(await page.resolveValue('var(--ui-stepper-cap)', 'width'));
            const labelW = parseFloat(await page.resolveValue('var(--ui-stepper-label-w)', 'width'));
            const gap = parseFloat(await page.resolveValue('var(--ui-space-4)', 'width'));
            const border = parseFloat(await page.resolveValue('var(--ui-border-w)', 'width'));

            /* WHICH HALF OF THE ROW IS SLATE'S EXACT NUMBER FLIPPED AT PARITY SURFACE 0,
             * and Ben chose which half.
             *
             * Slate's rail row at 1920, whole: aside#shot-settings 430 wide; label
             * [i=23] x=28 w=88; well [i=19] x=134 w=268; caps 78/78; value [i=21] w=110.
             * 28 + 88 + 18 + 268 + 28 = 430 exactly — Slate gets BOTH numbers because its
             * rail is 430 with 28px insets and an 18px gutter.
             *
             * Decal's rail WAS --ui-rail-w = clamp(320px, 26%, 460px) = 460 at 1920, with
             * 18px insets and a --ui-space-3 (12px) gutter, so its interior was 424 and it
             * could have 88 + 12 + 324 or 144 + 12 + 268, but not Slate's pair. Before
             * parity surface 0 the token was reverse-engineered to buy the WELL (144 = 424
             * - 12 - 268) and the name column was 56px too wide — the regression Ben filed
             * as cmp-lo-3, in his own words: "visible label to the LEFT of each stepper,
             * the stepper filling the remaining full width of the rail row (Slate's shape:
             * 88px label + control)". BEN_DECISIONS_2026-08-21.md is the top of the
             * precedence order, so surface 0 gave the name Slate's 88 and RECORDED the
             * 324px well as a live-surface row (finding F-RAIL).
             *
             * PARITY SURFACE 1 CLOSES IT with the three tokens F-RAIL named: --ui-rail-w's
             * ceiling 460 -> 430, the rail inset --ui-space-4 -> --ui-space-6 (18 -> 28),
             * and the gutter --ui-space-3 -> --ui-space-4 (12 -> 18). The row is now
             * 28 + 88 + 18 + 268 + 28 = 430 and the value cell 268 - 2*78 - 2*1 = 110 —
             * Slate's own numbers, both halves, at the reference width.
             *
             * So this asserts the COMPOSITION RULE rather than any one remainder: name is
             * the token, cap is the token, and the well is exactly what the row has left.
             * It held through the rail-width fix, and it fails the moment the name stops
             * being 88 or the well stops filling the row. */
            /* The two rows whose name is hidden since 30 August. Their COLUMN is unchanged —
               it is a declared track, not a content width — so the composition rule is
               asserted through the well's offset instead of through a 1px label. */
            const HIDDEN_NAMES = new Set(['steamFlow', 'hotWaterTemp']);

            for (const row of steppers) {
                if (HIDDEN_NAMES.has(row.key)) {
                    assert.ok(Math.abs((row.band.x - row.row.x) - (labelW + gap)) < 0.51,
                        `${row.key}: the well starts ${(row.band.x - row.row.x).toFixed(2)} into the row, `
                        + `not --ui-stepper-label-w + gutter (${labelW + gap}) — hiding the name must not `
                        + 'collapse the column');
                    assert.ok(Math.abs(row.value - (row.band.width - 2 * cap - 2 * border)) < 0.51,
                        `${row.key}: the value cell is ${row.value}, not the well minus its two caps`);
                    continue;
                }
                assert.ok(Math.abs(row.label.width - labelW) < 0.51,
                    `${row.key}: the name column is ${row.label.width}, not --ui-stepper-label-w ${labelW}`);
                assert.ok(Math.abs(labelW - 88) < 0.51,
                    `--ui-stepper-label-w is ${labelW}; Slate's label column is 88 (CITE live-ready `
                    + '#grind-label [i=18], #dose-label [i=23], #drink-label [i=30], #brew-label [i=41], '
                    + '#flush-label [i=67], both .slate-continuation-label spans — all 88px)');
                assert.ok(Math.abs(row.cap - cap) < 0.51,
                    `${row.key}: the cap is ${row.cap}, not --ui-stepper-cap ${cap}`);
                assert.ok(Math.abs(cap - 78) < 0.51,
                    `--ui-stepper-cap is ${cap}; Slate's cap is 78 on all 144 caps in the corpus`);
                assert.ok(Math.abs(row.label.width + gap + row.band.width - row.row.width) < 0.51,
                    `${row.key}: name + gutter + well is not the row`);
                assert.ok(Math.abs(row.value - (row.band.width - 2 * cap - 2 * border)) < 0.51,
                    `${row.key}: the value cell is ${row.value}, not the well minus its two caps`);
                /* NO ROW LEFT CLIPS ITS NAME, and the exemption that used to sit here is
                 * gone with the two rows it named. FLOW and TEMPERATURE overflowed their
                 * 88px column into the gutter — Slate's own move for a name wider than its
                 * column (#hotwater-label [i=74] is 108 in an 88, 20px into the well) — and
                 * since 30 August they draw no name at all, so they leave this loop above.
                 * Every row that still paints one fits it. */
                assert.equal(row.labelClipped, false,
                    `${row.key}: the name is clipped at the reference width`);
            }
        }));

        /* -- RUNNING THE MACHINE (wave 5.8) --------------------------------
         *
         * WHAT WAS HERE BEFORE: a <div data-placeholder> reading "Group head", and a
         * <ui-stop-button> whose `stop-request` nothing listened for. So on the only
         * machine that gets this strip — one with no group-head controller — the app
         * could not pull a shot, run water, steam, flush, or stop a run in progress.
         * These four tests are the claim that it can.
         * ----------------------------------------------------------------- */

        test('the machine strip is four real keys at rest, and the abort alone while running',
            () => mounted(async (page) => {
                await configure(page, { targets: TARGETS, ghc: true, machineState: 'idle' });
                const rest = await page.evalFn(() => {
                    const strip = window.__h.q('live-screen').shadowRoot.querySelector('.ghc-strip');
                    return strip ? [...strip.children].map((el) => ({
                        tag: el.tagName.toLowerCase(),
                        state: el.dataset.state ?? null,
                        text: (el.textContent || '').trim(),
                        disabled: el.hasAttribute('disabled'),
                    })) : null;
                });
                assert.ok(rest, 'a machine with no GHC hardware gets the strip');
                assert.deepEqual(rest.map((el) => el.state),
                    ['espresso', 'hotWater', 'steam', 'flush'],
                    'Slate\'s own four, by the generated enum\'s names');
                assert.ok(rest.every((el) => el.tag === 'ui-button' && !el.disabled),
                    'at rest all four accept a press');

                await configure(page, { targets: TARGETS, ghc: true, machineState: 'espresso' });
                const running = await page.evalFn(() => {
                    const strip = window.__h.q('live-screen').shadowRoot.querySelector('.ghc-strip');
                    return [...strip.children].map((el) => el.tagName.toLowerCase());
                });
                /* ONE CONTROL AT A TIME. Slate disables its four and lights Stop; here
                 * the four are absent and the abort has the row — same rule, and no
                 * disabled key left under a finger that means to abort. */
                assert.deepEqual(running, ['ui-stop-button']);
            }));

        test('a machine key asks for its state, and nothing else', () => mounted(async (page) => {
            await configure(page, { targets: TARGETS, ghc: true, machineState: 'idle' });
            const asked = await page.evalFn(async () => {
                const screen = window.__h.q('live-screen');
                const seen = [];
                screen.addEventListener('machine-request', (e) => seen.push(e.detail.state));
                const key = screen.shadowRoot.querySelector('.ghc-strip ui-button[data-key="steam"]');
                key.shadowRoot.querySelector('button').click();
                await screen.updateComplete;
                return seen;
            });
            assert.deepEqual(asked, ['steam']);
        }));

        test('the abort asks for IDLE, from the rail\'s stack', () => mounted(async (page) => {
            await configure(page, { targets: TARGETS, machineState: 'espresso' });
            const asked = await page.evalFn(async () => {
                const screen = window.__h.q('live-screen');
                const seen = [];
                screen.addEventListener('machine-request', (e) => seen.push(e.detail.state));
                const stop = screen.shadowRoot.querySelector('live-rail ui-stop-button');
                if (!stop) return null;
                stop.shadowRoot.querySelector('button').click();
                await screen.updateComplete;
                return seen;
            });
            /* `stop-request` used to leave this host and reach nothing at all. */
            assert.deepEqual(asked, ['idle'], 'the rail STOP has to reach the machine');
        }));

        /* THE TWO STOP-CONDITION CONTROL TESTS WERE REMOVED ON 30 AUGUST 2026, with the
         * control they pressed. They asserted that the caption under STEAM and HOT WATER
         * was a real button, that it named the OTHER mode, and that an unavailable mode
         * left it present and refusing rather than absent — L25's fix, in full.
         *
         * Ben withdrew the control: "these labels (Timed Stop and Weight Target) are
         * actual toggles, even though it wasn't clear they were." Nothing here replaces
         * them, because the claim they made is now the opposite one and it is made once,
         * above: 'L25 WITHDRAWN: the rail paints no stop condition at all'. The mode's
         * only control is on its settings leaf, which the L25 pin below still guards. */

        /* -- PRESS AND HOLD: SLATE'S SECOND ACTION (wave 5.8) ---------------
         *
         * Slate holds a FAVOURITE to replace or clear it and a PRESET to re-cut it.
         * Decal shipped both banks, and shipped the two storage rows an edited bank
         * would live in, with no gesture between them — so a full favourites rail was
         * permanent (setFavourite takes null and had no caller anywhere in src/) and the
         * preset rows could never be written.
         * ----------------------------------------------------------------- */

        /** Hold one cell of a bank, in page script. */
        const holdCell = (page, selector, index) => page.evalFn(async (sel, i) => {
            const screen = window.__h.q('live-screen');
            const bank = screen.shadowRoot.querySelector(sel);
            const inner = bank.shadowRoot.querySelector('ui-bank');
            const cell = inner.shadowRoot.querySelectorAll('.item')[i];
            const box = cell.getBoundingClientRect();
            const at = (type) => new PointerEvent(type, {
                bubbles: true, composed: true, cancelable: true, pointerId: 1, button: 0,
                clientX: box.x + box.width / 2, clientY: box.y + box.height / 2,
            });
            cell.dispatchEvent(at('pointerdown'));
            await new Promise((done) => { setTimeout(done, 750); });
            cell.dispatchEvent(at('pointerup'));
            await screen.updateComplete;
            const menu = screen.shadowRoot.getElementById('hold-menu');
            return {
                open: menu.open,
                items: (menu.items || []).map((item) => (item.separator ? '---' : item.id)),
                labels: (menu.items || []).map((item) => (item.separator ? '---' : item.label)),
            };
        }, selector, index);

        test('holding a preset offers Slate\'s four actions', () => mounted(async (page) => {
            await configure(page, { targets: TARGETS });
            const menu = await holdCell(page, 'ui-preset-bank[data-key="drinkWeight"]', 0);
            assert.equal(menu.open, true, 'the hold opens the actions menu');
            /* Slate's own four (ui.js:1630-1666): Apply, Enter value, Save current here,
             * Revert. TWO OF THEM ARE CONDITIONAL, and both conditions are A7's rule for
             * a value nobody has supplied applied to a menu row: Save needs a number on
             * the rail, and Revert needs a factory value THAT DIFFERS from the cell. This
             * bank is unedited, so cell 0 already IS its factory value and Revert is not
             * offered — Slate shows it disabled; here it is absent, and a row that could
             * only ever refuse is a row worth leaving out. */
            assert.deepEqual(menu.items.filter((id) => id !== '---'), ['apply', 'enter', 'save']);
            assert.match(menu.labels[0], /^Apply 30$/);
            assert.match(menu.labels[2], /^Save current \(\d/);
        }));

        test('a preset re-cut leaves as an intent, with the bank\'s key and index',
            () => mounted(async (page) => {
                await configure(page, { targets: TARGETS });
                await holdCell(page, 'ui-preset-bank[data-key="steamFlow"]', 3);
                const edit = await page.evalFn(async () => {
                    const screen = window.__h.q('live-screen');
                    const seen = [];
                    screen.addEventListener('preset-edit', (e) => seen.push(e.detail));
                    const menu = screen.shadowRoot.getElementById('hold-menu');
                    const revert = (menu.items || []).findIndex((item) => item.id === 'revert');
                    if (revert < 0) return { seen, revert };
                    menu.shadowRoot.querySelectorAll('.item')[revert].click();
                    await screen.updateComplete;
                    return { seen, revert };
                });
                /* The shipped bank is [0.6, 0.8, 1.0, 1.2] and the value equals the
                 * factory one, so Revert is not offered — which is the rule, not a gap. */
                assert.equal(edit.revert, -1, 'nothing to revert to on an unedited bank');
            }));

        test('holding a FILLED favourite offers edit, replace and clear',
            () => mounted(async (page) => {
                await configure(page, { targets: TARGETS, favourites: FAVOURITES, favourite: 'p1' });
                const menu = await holdCell(page, 'ui-favourites-bank', 0);
                assert.equal(menu.open, true);
                assert.deepEqual(menu.items, ['edit', 'replace', '---', 'clear']);
            }));

        test('holding an EMPTY favourite offers the one thing that fills it',
            () => mounted(async (page) => {
                await configure(page, { targets: TARGETS, favourites: FAVOURITES, favourite: 'p1' });
                const empty = await page.evalFn(() => (window.__h.q('live-screen').favourites || [])
                    .findIndex((slot) => slot === null));
                assert.ok(empty >= 0, 'the fixture rail has an empty slot');
                const menu = await holdCell(page, 'ui-favourites-bank', empty);
                assert.deepEqual(menu.items, ['browse']);
            }));

        test('clearing a favourite leaves as an intent naming the SLOT', () => mounted(async (page) => {
            await configure(page, { targets: TARGETS, favourites: FAVOURITES, favourite: 'p1' });
            await holdCell(page, 'ui-favourites-bank', 1);
            const asked = await page.evalFn(async () => {
                const screen = window.__h.q('live-screen');
                const seen = [];
                screen.addEventListener('favourite-action', (e) => seen.push(e.detail));
                const menu = screen.shadowRoot.getElementById('hold-menu');
                /* BY LABEL, NOT BY INDEX: a separator is an item in `items` and is NOT a
                 * `.item` element, so the two lists do not align. */
                const label = (menu.items || []).find((item) => item.id === 'clear').label;
                const row = [...menu.shadowRoot.querySelectorAll('.item')]
                    .find((el) => el.textContent.trim() === label);
                row.click();
                await screen.updateComplete;
                return seen;
            });
            /* THE SLOT, not the profile: an empty slot has no profile to name, and the
             * slot is what `setFavourite(slot, null)` takes. */
            assert.deepEqual(asked.map((a) => a.action), ['clear'], JSON.stringify(asked));
            assert.equal(asked[0].slot, 2, 'the disc a person reads is 1-based; cell 1 is slot 2');
        }));

        /* -- THE STEAM CHART (Ben, 24 Aug 2026) -----------------------------
         *
         * "There is a steam chart that is shown in the live view when steaming."
         * The old skin swaps the Live chart to a steam graph for the session and holds it
         * for a settle window; Decal drew the espresso chart through every steam and
         * then went back to the LAST SHOT — a picture of something that happened ten
         * minutes ago, on the one screen you are looking at while steaming.
         * ----------------------------------------------------------------- */

        test('a steam session takes the chart: its channels, both its axes, and its name',
            () => mounted(async (page) => {
                const seen = await page.evalFn(async () => {
                    const { STEAM_CHANNELS, STEAM_Y_RANGE, STEAM_Y2_RANGE, steamChannelSpecs } =
                        await import('/src/lib/steam-chart.js');
                    const { DEFAULT_CHANNELS } = await import('/src/components/ui-chart-card.js');
                    const { createSteamBuffer } = await import('/src/stores/steam-buffer.js');
                    const screen = window.__h.q('live-screen');
                    const card = screen.shadowRoot.querySelector('#live-chart');

                    const before = {
                        label: card.getAttribute('label'),
                        channels: (card.channels ?? []).map((c) => c.key),
                        hadPlot: Boolean(card.plotHandle),
                    };

                    /* A REAL SESSION THROUGH THE REAL BUFFER, so what the card is handed
                     * is the shape the store publishes rather than one this test made up. */
                    const buffer = createSteamBuffer({});
                    const t0 = 1000;
                    for (let i = 0; i < 40; i += 1) {
                        buffer.take({
                            mode: 'steam', pouring: true, at: t0 + i * 125,
                            machine: { ok: true, pressure: 1.2, flow: 1.1, targetFlow: 1.2,
                                steamTemperature: 150 + i },
                            milk: 20 + i,
                        });
                    }
                    screen.chartMode = 'steam';
                    screen.steamDerivation = buffer.get();
                    await screen.updateComplete;
                    /* TWO FRAMES. Setting a scale REBUILDS the plot (`willUpdate`), and a
                     * rebuild is deferred until the card has a box; one microtask is not
                     * enough to see the far side of it. */
                    await new Promise((done) => { requestAnimationFrame(() => setTimeout(done, 250)); });

                    return {
                        before,
                        beforeHadPlot: before.hadPlot,
                        espresso: DEFAULT_CHANNELS.map((c) => c.key),
                        milkPresent: screen.milkPresent,
                        allSteam: [...STEAM_CHANNELS],
                        wanted: {
                            channels: steamChannelSpecs({ milk: screen.milkPresent }).map((s) => s.key),
                            y: [...STEAM_Y_RANGE],
                            y2: [...STEAM_Y2_RANGE],
                        },
                        label: card.getAttribute('label'),
                        channels: (card.channels ?? []).map((c) => c.key),
                        yRange: card.yRange ? [...card.yRange] : null,
                        y2: card.y2 ? [...card.y2.range] : null,
                        empty: card.empty,
                        hasPlot: Boolean(card.plotHandle),
                        samples: screen.steamDerivation.counts.samples,
                    };
                });

                /* AT REST IT IS THE ESPRESSO CHART, AND THE ESPRESSO CHART IS THE CARD'S
                 * OWN `DEFAULT_CHANNELS` — read out of the page, not retyped here.
                 *
                 * THIS LINE USED TO SPELL THE LIST, and it spelt it twice wrong inside two
                 * days. It said five keys, then six when Ben asked for power on the same
                 * axis (24 Aug), and then it was wrong again on 25 August when he said
                 * BOTH "Live chart is on the main page and shouldnt show power" and "Group
                 * temperature on the Live chart, copy slates" — power out of the default
                 * list, the two temperatures in at a tenth of themselves. A restated list
                 * cannot be right about a set that its owner keeps ruling on; it can only
                 * be a second copy that goes stale. `ui-chart-card.js` argues each member
                 * beside the declaration and its own suite pins the membership.
                 *
                 * WHAT THIS TEST IS FOR SURVIVES THE CHANGE, and it is the thing the
                 * spelling was in the way of: the Live card names NO channels, so at rest
                 * it draws the card's default set, and a steam session replaces that set
                 * with `steam-chart.js`'s. Both sides are now read from their one source,
                 * which is how the steam half was always written. */
                assert.deepEqual(seen.before.channels, seen.espresso,
                    'at rest it is the espresso chart — the screen names no channel, so the '
                    + 'card\'s own DEFAULT_CHANNELS is what it draws');
                assert.notDeepEqual(seen.espresso, seen.wanted.channels,
                    'the two sets must differ, or "the steam channels replace the espresso ones" is vacuous');
                assert.equal(seen.before.label, 'Shot chart');

                assert.equal(seen.samples, 40, 'the buffer took the session');
                assert.equal(seen.empty, false, 'and the card is not showing its empty state');
                /* THE PLOT EXISTS AFTERWARDS IF IT EXISTED BEFORE. Setting a scale
                 * rebuilds it, and a rebuild that lost the plot would be a chart drawing
                 * nothing — which is the failure this line is for. Whether the bare
                 * skeleton had one to begin with is the card's own timing, not this
                 * feature's. */
                if (seen.beforeHadPlot) assert.equal(seen.hasPlot, true, 'the rebuild kept the plot');
                /* FOUR CHANNELS ON THIS MOUNT, NOT FIVE, AND THAT IS THE MILK RULE.
                 *
                 * `STEAM_CHANNELS` is the full set of names; `steamChannelSpecs({ milk })`
                 * is what a SESSION draws, and it drops `milkTemperature` when no probe is
                 * attached — Ben, 25 August 2026: the steam chart "works well in slate,
                 * but is poorly done in Decal. I need it to look & behave the same", and
                 * Slate's `steamChartTraceSpecs` filters exactly this key. This mount
                 * offers no milk probe (`configure` is not called with one here, and the
                 * screen's own `milkPresent` defaults to false), so four is the right
                 * answer and a fifth trace would be a line of nulls.
                 *
                 * READ THROUGH THE SCREEN'S OWN `milkPresent`, so this assertion follows
                 * whichever mount it is run on rather than pinning one of the two shapes.
                 * The line below keeps the point that the FULL set is bigger, which is
                 * what makes the filter observable at all. */
                assert.equal(seen.milkPresent, false, 'this mount has no milk probe');
                assert.equal(seen.wanted.channels.length, seen.allSteam.length - 1,
                    'without a probe the session drops exactly the milk trace');
                assert.deepEqual(seen.channels, seen.wanted.channels,
                    'the steam channels replace the espresso ones — target under its actual');
                /* BOTH AXES ARE FIXED. A steam session has no meaningful autoscale, and a
                 * moving axis makes two sessions impossible to compare by eye. */
                assert.deepEqual(seen.yRange, seen.wanted.y, 'the left axis is fixed at 0..6.5');
                assert.deepEqual(seen.y2, seen.wanted.y2, 'and the right one at 0..195 °C');
                assert.equal(seen.label, 'Steam chart', 'and it says what it is');
            }));

        test('and the chart goes back to the shot when the mode does', () => mounted(async (page) => {
            const seen = await page.evalFn(async () => {
                const { DEFAULT_CHANNELS } = await import('/src/components/ui-chart-card.js');
                const screen = window.__h.q('live-screen');
                const card = screen.shadowRoot.querySelector('#live-chart');
                screen.chartMode = 'steam';
                screen.steamDerivation = { ok: true, axis: { t: [0, 1] }, series: {}, counts: { samples: 2 } };
                await screen.updateComplete;
                const steaming = card.getAttribute('label');
                screen.chartMode = 'espresso';
                await screen.updateComplete;
                await new Promise((done) => { setTimeout(done, 120); });
                return {
                    steaming,
                    after: card.getAttribute('label'),
                    channels: (card.channels ?? []).map((c) => c.key),
                    espresso: DEFAULT_CHANNELS.map((c) => c.key),
                    yRange: card.yRange,
                };
            });
            assert.equal(seen.steaming, 'Steam chart');
            assert.equal(seen.after, 'Shot chart');
            /* THE ESPRESSO SET COMES BACK WHOLE, and it is read from the card's own
             * `DEFAULT_CHANNELS` for the reason the test above states at length: the
             * membership of that list is Ben's to rule on and has moved twice, and a
             * second spelling of it here would only ever record which day it was written.
             * The claim is that the steam swap is REVERSIBLE — the card ends where it
             * started — and reading the start from its owner is what says that exactly. */
            assert.deepEqual(seen.channels, seen.espresso);
            /* THE SHOT'S OWN FIXED AXIS COMES BACK — not `null`, which is what this
             * asserted while the shot chart still grew its ceiling. Ben fixed that axis on
             * 29 August 2026 (`SHOT_Y_RANGE`, `chart-autoscale.js`) so a knocked scale
             * cannot take the plot with it, so "reversible" now means the card returns to
             * [0, 12] rather than to autoscaling. The claim the test makes is unchanged:
             * the steam swap leaves nothing behind. */
            assert.deepEqual(seen.yRange, [0, 12],
                'and the left axis is the shot chart\'s own fixed range again');
        }));
});
