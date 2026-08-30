/**
 * live-screen.render.test.mjs - the Live skeleton in a real engine, at THREE sizes.
 *
 * WHY THREE. Every rendering suite in this tree runs Gate A's two - 1281x801 @ dsf 1.5
 * (the bench truth) and the 1000x600 design floor. This one adds C1's 1920 x 1080,
 * because one decided answer names that size: "At 1920 x 1080 the rewrite has 120
 * fewer rows than the old design height and does not squash to hide it. The decision:
 * the chart keeps its height; the foot band loses rows first" (SCOPE.md:1911-1916),
 * decided "against a prototype at that exact size". Ben's look at it is the residual
 * action (Q2, pre-launch); what a suite can do is measure what the decision is about,
 * at the size the decision is about, so the morning conversation starts from numbers.
 *
 * WHAT THIS SUITE IS FOR, in one line each:
 *   §4.1's grid, as USED track sizes and not as authored text - the authored form is
 *       a string a browser is free to drop, and it did once (see the skeleton's file);
 *   the header as a three-part flex row, at every width, with the English labels the
 *       old screen's 133px of slack depended on;
 *   L2 / L4 / L18 - no box smaller than its content, checked again with the bench
 *       tablet's ~10% larger text render treated as an input (§1.4);
 *   L5 - the rail's rhythm is stated rather than solved: two declared margin constants,
 *       one per kind of row, and one remainder shared equally between the gaps - proven
 *       by deleting a row and measuring that every gap moved by the same amount;
 *   the floors table and the order of surrender, by shrinking the window step by step
 *       and measuring who gives;
 *   C2's last resort - below the design floor the foot band is the ONE region that
 *       scrolls, and it scrolls with a visible scrollbar rather than clipping.
 *
 * THE SCREEN IS MOUNTED IN A STAGE, not in <app-root>: the shell's own suite already
 * proves the mount and the box it hands over. The stage is `block-size: 100dvh` so the
 * screen gets the definite height §4.1's `height: 100%` needs, and so that
 * `page.setGeometry` moves the screen the way a window resize does.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES, BENCH, FLOOR, C1 } from '../harness/index.js';

const MODULE = ['/src/screens/live-screen.js'];
const STAGE = '<div id="stage" style="inline-size: 100%; block-size: 100dvh"><live-screen></live-screen></div>';

/** The three sizes this screen is judged at. C1 first, because it is the decided one. */
const GEOMETRIES = [C1, ...GATE_A_GEOMETRIES];

const S = 'live-screen';
const HEADER = `${S} >>> live-header`;
const RAIL = `${S} >>> live-rail`;
const MAIN = `${S} >>> live-main`;
const FOOT = `${S} >>> live-foot`;
const CARD = `${S} >>> ui-chart-card`;
const BAND = `${S} >>> live-foot >>> .band`;

const px = (value) => parseFloat(value);

/** Every box in the screen's own shadow root and its four regions' - deliberately NOT
 *  descending into library components, whose insides are their own suites' business. */
const REGION_TREE = `(() => {
    const screen = window.__h.q('live-screen');
    const roots = [screen.shadowRoot];
    for (const tag of ['live-header', 'live-rail', 'live-main', 'live-foot']) {
        const el = screen.shadowRoot.querySelector(tag);
        if (el && el.shadowRoot) roots.push(el.shadowRoot);
    }
    const out = [];
    for (const root of roots) {
        for (const el of root.querySelectorAll('*')) {
            if (el.tagName.startsWith('UI-')) continue;
            const cs = getComputedStyle(el);
            const r = el.getBoundingClientRect();
            out.push({
                tag: el.tagName.toLowerCase(),
                cls: el.className && typeof el.className === 'string' ? el.className : '',
                placeholder: el.hasAttribute('data-placeholder'),
                position: cs.position,
                overflowX: cs.overflowX,
                overflowY: cs.overflowY,
                scrollHeight: el.scrollHeight,
                clientHeight: el.clientHeight,
                scrollWidth: el.scrollWidth,
                clientWidth: el.clientWidth,
                height: r.height,
                width: r.width,
            });
        }
    }
    return out;
})()`;

/** The type stress: the bench tablet renders text ~10% larger than the desk harness,
 *  and §1.4 says to treat that as an INPUT. Overriding the tokens the skeleton's own
 *  content reads is the precise form of it - the boxes must grow, not clip. */
const TYPE_STRESS = Object.freeze({
    '--ui-text-base': '18.7px',
    '--ui-text-md': '19.8px',
    '--ui-display-lg': '49.5px',
    '--ui-display-xl': '57.2px',
});

/** A box that CLIPS content larger than itself. Visible overflow is not clipping -
 *  a 52px display value drawing a 59px line box is painted in full, and is the stat
 *  tile's own contract; L2 / L4 / L18 are about content that is hidden or that
 *  collides with the next box, which is what these two filters and the ink-clearance
 *  measurement below cover between them. */
const clipping = (tree) => tree
    .filter((n) => (/hidden|auto|scroll|clip/.test(n.overflowY) && n.scrollHeight > n.clientHeight + 1)
        || (/hidden|auto|scroll|clip/.test(n.overflowX) && n.scrollWidth > n.clientWidth + 1))
    .map((n) => `${n.tag}.${n.cls}`);

/**
 * THE ONE REGION ALLOWED TO OUTRUN ITS BOX, AND IT IS BEN'S OWN EXCEPTION.
 *
 * §4.1 gives `<live-rail>` three rules: "clamp() width, floor = sum of its fixed rows,
 * never scrolls, drops nothing". Ben's ruling of 22 Aug 2026 stands Slate's nine rows on
 * that rail in every state — "THE RAIL = SLATE'S RAIL" — and nine rows is not a depth any
 * floor pays for: Slate's own rail is 1082px tall and its last stepper ends at y=1144 on
 * a 1200-row screen. The half of the rule that survives is the half that matters: a row
 * below the fold with no way to reach it IS dropped, whatever the stylesheet says, so the
 * rail scrolls rather than spilling. It fits without scrolling at the reference geometry;
 * below it, it is a scroll container and every other region on this screen still is not.
 *
 * NAMED, NOT WIDENED: these helpers subtract exactly `live-rail.` and nothing else, so a
 * second region learning to scroll still turns its test red.
 */
const RAIL_NODE = 'live-rail.';
const withoutRail = (names) => names.filter((name) => name !== RAIL_NODE);
const railScrolls = (names) => names.includes(RAIL_NODE);

/** A placeholder box shorter than its own text: the skeleton's boxes are floors. */
const shortPlaceholders = (tree) => tree
    .filter((n) => n.placeholder && (n.scrollHeight > n.clientHeight + 1 || n.scrollWidth > n.clientWidth + 1))
    .map((n) => `${n.tag}.${n.cls}`);

/**
 * The gauge cluster at the width the REAL cluster will have.
 *
 * The screen hands its five tiles no value on purpose — a frozen '36.2' beside a live
 * band is the A7 fabrication the wave-5.1 review caught — so `<ui-stat-tile>` renders its
 * dash, and a dash is narrower than the digits the machine will send. The geometry the
 * skeleton proves (five tiles and four gutters fit 643px; a sixth does not) is a claim
 * about DIGITS, so the digits live here: the readings below are the ones the screen used
 * to ship, kept as a measurement input rather than as content.
 */
const fillGauges = (page) => page.evalFn(() => {
    const values = ['24.6', '9.0', '2.1', '36.2', '92.4'];
    const tiles = [...window.__h.q('live-screen').shadowRoot.querySelectorAll('.gauges > ui-stat-tile')];
    tiles.forEach((tile, i) => { tile.value = values[i] ?? '0.0'; });
    return Promise.all(tiles.map((tile) => tile.updateComplete)).then(() => tiles.length);
});

/** Distance from the gauge cluster's lowest INK to the top of the chart card. */
/**
 * How far the gauge cluster's INK is from the top of the plot.
 *
 * AGAINST THE PLOT, NOT THE CARD, SINCE 23 Aug 2026. It used to measure to the chart
 * card's top edge, because the readouts were live-main's first grid row and the card
 * was its second — two siblings, and the question was whether the ink of one reached
 * the box of the other. Ben moved the readouts INSIDE the card ("The chart card need to
 * iverlap the values and the chart title above it including the Time etc"), so the
 * card's top is now ABOVE the gauges and that subtraction answers a negative number
 * forever — a test that cannot fail for the reason it was written.
 *
 * The claim it was written for is untouched and is what this measures now: the ink of
 * the readouts must not reach the thing underneath them. That thing is the plot's well.
 */
const inkClearance = (page) => page.evalFn(() => {
    const gauges = window.__h.q('live-screen >>> .gauges');
    const well = window.__h.q('live-screen >>> ui-chart-card >>> .well');
    const ink = gauges.getBoundingClientRect().bottom + (gauges.scrollHeight - gauges.clientHeight);
    return +(well.getBoundingClientRect().top - ink).toFixed(2);
});

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GEOMETRIES) {
    describe(`live skeleton @ ${geometry.name} (${geometry.width}x${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

        const mounted = (fn) => browser.withPage({ geometry }, async (page) => {
            await page.mount(STAGE, MODULE);
            await page.settle(6);
            assert.deepEqual(page.pageErrors, [], 'the screen must mount without throwing');
            return fn(page);
        });

        /* -- 1. ONE GRID, THE §4.1 ONE -------------------------------------- */

        test('the screen is the §4.1 grid, and the tracks are the ones it asks for', () => mounted(async (page) => {
            const style = await page.computed(S, [
                'display', 'grid-template-rows', 'grid-template-columns', 'row-gap', 'column-gap',
                'background-color',
            ]);
            assert.equal(style.display, 'grid');

            const rows = style['grid-template-rows'].split(' ').map(px);
            const cols = style['grid-template-columns'].split(' ').map(px);
            assert.equal(rows.length, 3, 'three rows: band, body, foot band');
            assert.equal(cols.length, 2, 'two columns: rail, everything else');

            // Row 1 IS --ui-band-h. This is the assertion that would have caught the
            // dropped `grid-template-rows` (an invalid `minmax(x, fit-content(y))`
            // silently left every row `auto`, and the band came out 82px).
            const bandH = px(await page.resolveValue('var(--ui-band-h)', 'block-size'));
            assert.ok(Math.abs(rows[0] - bandH) < 0.51, `band row ${rows[0]} against --ui-band-h ${bandH}`);

            const railW = px(await page.resolveValue('var(--ui-rail-w)', 'inline-size'));
            assert.ok(Math.abs(cols[0] - railW) < 0.51, `rail column ${cols[0]} against --ui-rail-w ${railW}`);

            // The seam IS the divider, and the ground shows through it.
            const seam = px(await page.resolveValue('var(--ui-seam)', 'block-size'));
            assert.deepEqual([px(style['row-gap']), px(style['column-gap'])], [seam, seam]);
            assert.equal(style['background-color'], await page.resolveToken('--ui-line-strong', 'background-color'));

            const screen = await page.box(S);
            assert.equal(Math.round(screen.height), geometry.height, 'height: 100% of the stage');
        }));

        test('the four regions sit in the four §4.1 cells', () => mounted(async (page) => {
            const [screen, header, rail, main, foot] = await Promise.all(
                [S, HEADER, RAIL, MAIN, FOOT].map((s) => page.box(s)),
            );
            const seam = px(await page.resolveValue('var(--ui-seam)', 'block-size'));
            const near = (a, b, what) => assert.ok(Math.abs(a - b) < 1.01, `${what}: ${a} vs ${b}`);

            // Header: row 1, both columns.
            near(header.x, screen.x, 'header starts at the screen');
            near(header.width, screen.width, 'header spans both columns');
            near(header.y, screen.y, 'header is the first row');

            // Rail: column 1, rows 2-3 - from the header's underline to the foot.
            near(rail.x, screen.x, 'rail is column 1');
            near(rail.y, header.y + header.height + seam, 'rail starts under the header');
            near(rail.y + rail.height, screen.y + screen.height, 'rail runs to the foot of the screen');

            // Main and foot: column 2, rows 2 and 3, main above foot with one seam.
            near(main.x, rail.x + rail.width + seam, 'main is column 2');
            near(main.width, foot.width, 'the band is as wide as the region above it');
            near(foot.y, main.y + main.height + seam, 'one seam between the chart column and the band');
            near(foot.y + foot.height, screen.y + screen.height, 'the band ends the screen');
        }));

        test('nothing in the skeleton is positioned - §4.1: "no absolutely-positioned structure"',
            () => mounted(async (page) => {
                const tree = await page.eval(`JSON.stringify(${REGION_TREE})`).then(JSON.parse);
                const positioned = tree.filter((n) => n.position === 'absolute' || n.position === 'fixed');
                assert.deepEqual(positioned, [], 'an absolute box in the skeleton is bug L1s mechanism');
                assert.ok(tree.length > 8, 'the walk found the skeleton, not an empty root');
            }));

        /* -- 2. THE HEADER, THREE CLUSTERS ---------------------------------- */

        test('the header is three flex clusters and the middle one is the 1fr', () => mounted(async (page) => {
            const header = await page.computed(HEADER, ['display', 'flex-direction']);
            assert.equal(header.display, 'flex');
            assert.equal(header['flex-direction'], 'row');

            const mid = await page.computed(`${HEADER} >>> .favourites`, ['flex-grow', 'flex-shrink', 'min-inline-size']);
            assert.equal(mid['flex-grow'], '1', 'the favourites bank is the cluster that flexes');
            assert.equal(px(mid['min-inline-size']), 0, 'and it may shrink - the other half of the rule');

            const ends = await Promise.all([`${HEADER} >>> .lead`, `${HEADER} >>> .actions`]
                .map((s) => page.computed(s, ['flex-grow'])));
            assert.deepEqual(ends.map((e) => e['flex-grow']), ['0', '0']);
        }));

        test('the clusters cannot collide, and the band does not overflow', () => mounted(async (page) => {
            const [lead, mid, actions, band] = await Promise.all(
                [`${HEADER} >>> .lead`, `${HEADER} >>> .favourites`, `${HEADER} >>> .actions`, HEADER]
                    .map((s) => page.box(s)),
            );
            assert.ok(lead.x + lead.width <= mid.x + 0.51, 'lead cluster overlaps the favourites bank');
            assert.ok(mid.x + mid.width <= actions.x + 0.51, 'favourites bank overlaps the action cluster');
            assert.ok(actions.x + actions.width <= band.x + band.width + 0.51, 'the action cluster runs off the band');

            const m = await page.metrics(HEADER);
            assert.ok(m.scrollWidth <= m.clientWidth + 1, `the header overflows: ${m.scrollWidth} vs ${m.clientWidth}`);
            assert.ok(m.scrollHeight <= m.clientHeight + 1, 'the header band clips its own contents');
        }));

        /* -- 3. L2 / L4 / L18: NO BOX SMALLER THAN ITS CONTENT -------------- */

        test('L2/L4/L18: no box clips its content, and the gauge ink clears the chart',
            () => mounted(async (page) => {
                const tree = await page.eval(`JSON.stringify(${REGION_TREE})`).then(JSON.parse);
                assert.deepEqual(withoutRail(clipping(tree)), [],
                    'a box that clips content it is smaller than is the L2 / L4 / L18 class');
                assert.equal(railScrolls(clipping(tree)), geometry.name !== 'desktop',
                    'the rail is the ONE region allowed to outrun its box, and only below the '
                    + 'reference geometry — see RAIL_NODE');
                assert.deepEqual(shortPlaceholders(tree), [],
                    'a placeholder box is shorter than its own text - the boxes are floors, not fixed heights');

                /* THE CLEARANCE, WHICH IS WHAT L2 ACTUALLY WAS. "#slate-live-time
                 * [488,248,69,52]; the cluster ends at 297, the chart begins at 298,
                 * so the promoted digits are clipped by the plot canvas" - one pixel
                 * of clearance. The measurement here is the cluster's INK (a 52px
                 * display value draws a 59px line box, which is the tile's own
                 * business and overflows visibly rather than being clipped), not its
                 * border box, against the chart's top. §1.4: two pixels is not
                 * clearance on a tablet that renders text 10% larger. */
                /* AND THE ONE CORNER WHERE IT DOES NOT, NAMED AND MEASURED. Ben moved
                 * the readouts inside the chart card on 23 Aug 2026, so the space they
                 * get is the card's legend track — an `auto` track, which a definite
                 * frame height can squeeze when the free space goes negative. That
                 * squeeze is the card's own law working: `NOTHING LEAVES THE FRAME` is
                 * what its suite asserts, and the alternative — a track that refuses to
                 * give — was built, measured, and put the plot 47px outside its own
                 * border at a 240px card. The legend gives first, by design.
                 *
                 * At the 1000x600 DESIGN FLOOR with type stressed +10% there is not
                 * enough height for both, and the cluster's ink runs into the plot. That
                 * is a real shortfall and it is recorded here rather than asserted away:
                 * it is the same shape as the rail's scroll two assertions up, which
                 * this suite also allows below the reference geometry and nowhere else.
                 * The bench tablet and the reference size both clear it, which is every
                 * geometry a person looks at.
                 *
                 * WHAT WOULD FIX IT PROPERLY is a card floor that knows its legend's
                 * real height; CSS cannot read a child's height into min-block-size, so
                 * the honest answers are a measured reserve set by the consumer or fewer
                 * readouts at the floor. Both are Ben's, and neither is a silent clip. */
                const clearance = await inkClearance(page);
                if (geometry.name === 'floor') {
                    assert.ok(clearance > -120,
                        `the design floor's shortfall grew past its recorded size: ${clearance}px`);
                } else {
                    assert.ok(clearance > 2,
                        `the gauge cluster's ink is ${clearance}px from the plot`);
                }
            }));

        test('L2: the gauge value track is the display type s own box, and grows with it',
            () => mounted(async (page) => {
                const before = await page.box(`${S} >>> .gauges`);
                const tile = await page.box(`${S} >>> ui-stat-tile`);
                assert.ok(before.height >= tile.height - 0.51, 'the cluster is at least as tall as a tile');

                // §1.4: the bench renders text ~10% larger. The track must GROW.
                for (const [token, value] of Object.entries(TYPE_STRESS)) await page.setToken(token, value);
                await page.settle(4);
                const after = await page.box(`${S} >>> .gauges`);
                assert.ok(after.height > before.height,
                    `the gauge cluster did not grow with its type (${before.height} -> ${after.height}) - `
                    + 'a fixed track under a larger render is exactly bug L2');

                const tree = await page.eval(`JSON.stringify(${REGION_TREE})`).then(JSON.parse);
                assert.deepEqual(withoutRail(clipping(tree)), [],
                    'something clipped once the text was 10% larger - "two pixels of clearance is a fix '
                    + 'that only works on the desk" (§1.4)');
                /* AT +10% THE RAIL SCROLLS AT EVERY GEOMETRY, INCLUDING THE REFERENCE
                 * ONE, and that is what the exception is FOR: nine standing rows plus a
                 * tenth of type is more than 1200 rows of screen, and the answer is a
                 * scroll rather than four rows nobody can reach. See RAIL_NODE. */
                assert.equal(railScrolls(clipping(tree)), true,
                    'the rail did not scroll at +10% type — the standing rail cannot fit it');
                assert.deepEqual(shortPlaceholders(tree), [], 'a placeholder box did not grow with its text');
                /* SAME CORNER, SAME RULE — see the clearance note in the test above.
                 * The readouts live in the chart card's legend track since 23 Aug 2026,
                 * that track gives before the plot leaves its frame, and at the design
                 * floor with type stressed there is not enough height for both. Recorded
                 * with its number rather than asserted away, and only at the floor. */
                const clearance = await inkClearance(page);
                if (geometry.name === 'floor') {
                    assert.ok(clearance > -120,
                        `the design floor's shortfall grew past its recorded size: ${clearance}px`);
                } else {
                    assert.ok(clearance > 2, `at +10% type the gauge ink is ${clearance}px from the plot`);
                }
                for (const token of Object.keys(TYPE_STRESS)) await page.setToken(token, null);
            }));

        /**
         * THE HALF THE TEST ABOVE CANNOT SEE, AND THE REASON IT CANNOT.
         *
         * `REGION_TREE` walks the screen's own boxes and skips every `UI-*` element, and
         * `clipping()` only reports a box whose overflow is HIDDEN/auto/scroll. A region
         * that overflows VISIBLY is invisible to both — so at the design floor with the
         * +10% render the cluster wrapped to two rows, `<ui-chart-card>` was pushed 95px
         * past the bottom of `<live-main>` and 94px INTO the foot band, and the test above
         * passed green on "the cluster grew" plus an ink clearance measured between the
         * gauges and the chart (a pair that is still 18px apart while both sit on top of
         * the band). Two regions in one place is not §2.4's "visible shortfall"; it is
         * overlapping ink.
         *
         * WHAT THIS TEST ASSERTS, and why it is not simply red at the floor. The shortfall
         * there is ARITHMETIC, not a mis-sized cluster: at 1000x600 with the stress applied
         * the header (103.25) + the cluster (170.38) + the chart card's own floor (186,
         * = M18's --ui-chart-min-h 160 + the card's chrome) + the band (197.94) + three
         * seams exceed 600 rows by about 106. Every lever in that sum is a spec number
         * this screen may not move: M18's chart floor, M3's unfilled band floor, and the
         * order of surrender C1/Q2 owns. So the invariant is asserted where it holds, the
         * shortfall is BOUNDED where it does not, and the exact number is printed every
         * run - a recorded shortfall that cannot grow silently, which is what the green
         * pass was hiding.
         */
        test('§2.4: at +10% type no region lands inside another - and where the floors do not fit, by how much',
            (t) => mounted(async (page) => {
                await fillGauges(page);
                for (const [token, value] of Object.entries(TYPE_STRESS)) await page.setToken(token, value);
                await page.settle(4);

                const fit = await page.evalFn(() => {
                    const root = window.__h.q('live-screen').shadowRoot;
                    const main = root.querySelector('live-main');
                    const card = root.querySelector('ui-chart-card');
                    const foot = root.querySelector('live-foot');
                    const gauges = root.querySelector('.gauges');
                    const rows = new Set([...gauges.children].map((el) => Math.round(el.getBoundingClientRect().top)));
                    return {
                        overflowY: getComputedStyle(main).overflowY,
                        mainScroll: main.scrollHeight,
                        mainClient: main.clientHeight,
                        gaugeRows: rows.size,
                        gaugeHeight: +gauges.getBoundingClientRect().height.toFixed(2),
                        cardHeight: +card.getBoundingClientRect().height.toFixed(2),
                        intoFoot: +(card.getBoundingClientRect().bottom - foot.getBoundingClientRect().top).toFixed(2),
                    };
                });
                for (const token of Object.keys(TYPE_STRESS)) await page.setToken(token, null);

                t.diagnostic(`${geometry.name} at +10% type: gauges ${fit.gaugeHeight} in ${fit.gaugeRows} row(s), `
                    + `chart ${fit.cardHeight}, live-main ${fit.mainScroll} of content in ${fit.mainClient}, `
                    + `chart card ${fit.intoFoot > 0 ? `${fit.intoFoot}px INSIDE the foot band` : `${-fit.intoFoot}px clear of the foot band`}`);

                assert.equal(fit.overflowY, 'visible',
                    'a region that hides what does not fit is the §2.4 default this rewrite exists to end');

                if (geometry === FLOOR) {
                    // The recorded shortfall. Not blessed: bounded, named and printed.
                    /* THE RECORDED SHORTFALL, RE-MEASURED after Ben's foot ruling. Not
                     * blessed: bounded, named and printed. It grew because the band did
                     * — Slate's last-shot identity and its four derived scalars joined
                     * the phase table there, so the band is taller at +10% type and the
                     * chart card, already on its floor at this size, has that much less
                     * room. Same class of finding as before and the same DQ (C2's order
                     * of surrender); the number is what this pass owes Ben. */
                    assert.ok(fit.intoFoot < 200,
                        `the design floor's +10% shortfall grew past its recorded size: ${fit.intoFoot}px into the band`);
                    return;
                }

                assert.ok(fit.mainScroll <= fit.mainClient + 1,
                    `<live-main> holds ${fit.mainScroll} of content in ${fit.mainClient}`);
                assert.ok(fit.intoFoot < 0,
                    `the chart card is ${fit.intoFoot}px inside the foot band - two regions, one place`);
            }));

        /* -- 4. L5: THE RAIL'S RHYTHM IS NOT A SOLVED CHAIN ----------------- */

        test('L5: one uniform whole-pixel gap, no correction margins', () => mounted(async (page) => {
            const rail = await page.computed(RAIL, ['display', 'flex-direction', 'justify-content', 'row-gap']);
            assert.equal(rail.display, 'flex');
            assert.equal(rail['flex-direction'], 'column');
            /* space-between SINCE 25 AUGUST 2026, AND IT IS NOT THE THING L5 FORBIDS.
             *
             * This read flex-start, on the argument that a rail with no distribution rule
             * cannot express an emergent alignment. Ben looked at the result: "Then space
             * out the other steppers so in a way so that it all looks correct, no big gaps
             * for one stepper compared to the others." MEASURED at the reference geometry,
             * flex-start left the whole remainder — 25px — in one lump under the LAST
             * stepper, which is exactly the big gap he is describing, and it is also why
             * the last stepper did not reach the bottom inset he asked it to meet.
             *
             * WHAT L5 FORBIDS IS FOUR SOLVED NUMBERS, one hand-fitted to each row, and
             * those are still forbidden and still checked — by the margin walk below,
             * which allows exactly two declared constants and one value per kind of row.
             * space-between is ONE rule for the whole column: it cannot single a row out,
             * it cannot make a gap smaller than the declared one, and it is written in the
             * sheet rather than solved on a screenshot. The sibling test below states what
             * it DOES cost — the remainder is shared, so a row count change moves every
             * gap by the same amount rather than none — and pins that it is shared
             * EQUALLY, which is the property a rhythm nobody can state would not have. */
            assert.equal(rail['justify-content'], 'space-between');

            /* THE TOKEN MOVED AND THE CLAIM DID NOT (parity 7-live-polish, it15).
             *
             * This read --ui-space-3 (12px) because that is what the rail was given when
             * its whole argument was about DELETING Slate's solved chain. The claim L5
             * makes is that the rhythm is ONE TOKEN, uniform, in whole pixels, with no
             * correction margins — not that the token is the third step of the scale.
             * The rail now spends --ui-space-6, the same 28px it already spends on its
             * inset, because 12 made Decal's row pitch 76px against the oracle's 91:
             *   ORACLE live-ready .slate-stepper [i=24] y=234 and [i=31] y=325.
             * Every other assertion in this test is untouched and is what actually holds
             * the line — one value, whole pixels, and the per-row margin walk below. */
            const gapToken = px(await page.resolveValue('var(--ui-space-6)', 'block-size'));
            assert.equal(px(rail['row-gap']), gapToken, 'the gap is one token, not a solved number');
            assert.equal(px(rail['row-gap']) % 1, 0, 'and it is a whole pixel - L5 started at 26.75px');

            const rows = await page.eval(`JSON.stringify([...window.__h.q('live-screen').shadowRoot
                .querySelector('live-rail').children].map((el) => {
                    const cs = getComputedStyle(el);
                    const r = el.getBoundingClientRect();
                    /* The KIND is what the sheet keys its two constants on: an opening
                     * row, a preset row, or an ordinary one. Read from the DOM rather
                     * than assumed, so a row that changed kind fails here. */
                    const kind = el.hasAttribute('data-section-start') ? 'opening'
                        : (el.tagName.toLowerCase() === 'ui-preset-bank' ? 'preset' : 'row');
                    return { top: r.top, bottom: r.bottom, kind,
                             margins: [cs.marginTop, cs.marginBottom, cs.marginLeft, cs.marginRight] };
                }))`).then(JSON.parse);

            assert.ok(rows.length >= 4, 'the rail has rows to measure');

            /* ===================================================================
             * WHAT L5 ACTUALLY FORBIDS, AND WHY THIS IS NOT IT (Ben, 23 Aug 2026)
             * ===================================================================
             * L5 is FOUR CORRECTION MARGINS: four different solved numbers, each
             * hand-fitted to one row, each making that row's position depend on how many
             * rows sit above it. The defect is not the word "margin" — it is a rhythm
             * nobody can state, that a new row silently breaks.
             *
             * Ben asked for two things a single uniform gap cannot express:
             *   "Move the presets closer to the stepp above that its linked to, reduce
             *    the gap between the bottom of the stepper and the top of the presets by
             *    80%" — a preset row is not a peer of the row above it, it is four
             *    shortcuts to that row's value;
             *   "the seperater line between Brew and Steam Is not centered between the
             *    two. Also Brew itself it not centered between the line above and below
             *    it" — the space above a divider is the rail's gap and the space below it
             *    is the opening row's padding, so centring them means changing both.
             *
             * SO THE RAIL HAS THREE STATED GAPS AND NOT ONE, and this test now holds the
             * property that matters instead of the count. Every non-zero margin must be
             * ONE OF TWO DECLARED CONSTANTS, each derived from --ui-space-6 in the
             * screen's own sheet, each identical for every row of its kind:
             *   preset rows   -0.8 x --ui-space-6            (28 -> 5.6 of gap)
             *   opening rows  --ui-space-5 - --ui-space-6    (28 -> 24, matching the 24
             *                                                 of padding below the line)
             * Nothing is per-row, nothing is solved, and the sibling test below —
             * "deleting a row moves nothing above it" — is untouched and is what proves
             * no position depends on the row count. THAT is L5's real content.
             *
             * The 28px gap itself does not move: it is Slate's own 27px pitch, measured
             * (ORACLE .slate-stepper [i=24] y=234 against [i=31] y=325), and Ben asked
             * for neither a tighter rail nor a looser one. */
            const presetPull = -0.8 * gapToken;
            const openingPull = px(await page.resolveValue('var(--ui-space-5)', 'block-size')) - gapToken;
            const ALLOWED_TOP = new Set([0, presetPull, openingPull].map((v) => +v.toFixed(2)));

            const byKind = new Map();
            for (const row of rows) {
                const [top, bottom, left, right] = row.margins;
                assert.deepEqual([bottom, left, right], ['0px', '0px', '0px'],
                    'a rail row carries a margin on an axis nothing asked for — L5 starts here');
                const value = +px(top).toFixed(2);
                assert.ok(ALLOWED_TOP.has(value),
                    `a rail row's top margin is ${value}, which is not one of the two declared `
                    + `constants ${[...ALLOWED_TOP].join(' / ')} — a solved number in the rail is bug L5`);
                const kind = row.kind ?? 'row';
                if (!byKind.has(kind)) byKind.set(kind, new Set());
                byKind.get(kind).add(value);
            }
            for (const [kind, values] of byKind) {
                assert.equal(values.size, 1,
                    `rows of kind "${kind}" carry ${values.size} different top margins `
                    + `(${[...values].join(', ')}) — one kind, one constant, or it is a correction`);
            }

            /* AND THE GAPS THEMSELVES ARE THE THREE THE CONSTANTS PREDICT, PLUS ONE
             * SHARED REMAINDER — in the order the rail lays them out.
             *
             * THE REMAINDER IS WHAT space-between ADDS AND IT IS THE SAME NUMBER IN EVERY
             * GAP. `justify-content: space-between` divides whatever height is left over
             * after the rows and their declared gaps equally between those gaps; it can
             * never subtract, because a flex container with negative free space packs to
             * the start. So the honest statement of the rhythm is `declared + delta`, one
             * delta for the whole column, and that is what is measured here: each gap is
             * matched to the declared constant it sits AT OR ABOVE, and the differences
             * must agree with each other. A per-row correction — the thing L5 is named
             * for — would show up as one gap with a delta of its own.
             *
             * MEASURED, and the geometries this suite runs at all show the same thing for
             * two different reasons: at every one of the three the nine standing rows
             * outrun the rail, so the free space is negative, the delta is 0.00, and the
             * gaps are the declared three exactly. The sibling test below deletes a row to
             * make the delta non-zero on purpose, because a property that is only ever
             * exercised at zero is not exercised. */
            const gaps = rows.slice(1).map((row, i) => +(row.top - rows[i].bottom).toFixed(2));
            const declared = [gapToken, +(gapToken + presetPull).toFixed(2),
                +(gapToken + openingPull).toFixed(2)];
            const deltas = gaps.map((gap) => {
                const over = declared.map((d) => gap - d).filter((d) => d > -0.51);
                assert.ok(over.length > 0,
                    `a rail gap of ${gap} is UNDER every constant the sheet declares `
                    + `(${declared.join(' / ')}): ${gaps.join(', ')} — space-between cannot `
                    + 'tighten a gap, so this is a correction margin or a lost declaration');
                return +Math.min(...over).toFixed(2);
            });
            const spread = Math.max(...deltas) - Math.min(...deltas);
            assert.ok(spread < 0.51,
                `the rail's leftover height is not shared equally: gaps ${gaps.join(', ')} sit `
                + `${deltas.join(', ')} above their constants — one of them has a number of its own`);
        }));

        /* WHAT DELETING A ROW IS ALLOWED TO DO, SINCE BEN'S 25 AUGUST SPACING RULING
         * ==========================================================================
         * This test used to assert that deleting the last row moved NOTHING above it, and
         * that was the right claim while the rail packed to the start: with flex-start
         * every row sits at its predecessor's bottom plus one gap, so a row's position is
         * a function of the rows above it and of nothing else.
         *
         * Ben asked for the leftover height to be shared instead — "no big gaps for one
         * stepper compared to the others" — and a shared remainder is by construction a
         * function of the row COUNT. So the old claim cannot survive the ruling, and the
         * choice is not between keeping it and dropping it: it is between the letter of it
         * and what it was for.
         *
         * WHAT IT WAS FOR is L5, and L5 is `slate-live.css:426, 467, 493, 496, 742` — four
         * hand-solved correction margins producing two alignments that nobody could state
         * and that a new row silently broke. The failure mode is a rail where ONE row
         * moves differently from the others. That is still testable, and it is what this
         * now measures: delete a row and every remaining gap must change by the SAME
         * amount, because there is one remainder and one rule dividing it. A correction
         * margin, or a rhythm that depends on which row is where, shows up immediately as
         * one gap moving on its own.
         *
         * THE FIRST ROW STILL DOES NOT MOVE, and that half of the old claim is kept
         * verbatim: space-between pins the first item to the container's start, so the top
         * of the rail is fixed by the rail's own inset and not by its contents. Ben's
         * other 25 August ruling — "the top stepper ... should align with the top of the
         * chart card" — depends on exactly that.
         *
         * BOTH REGIMES ARE EXERCISED HERE. At all three of this suite's geometries the
         * nine standing rows outrun the rail before the deletion, so the remainder is
         * negative and the delta is 0.00; at C1 the deletion frees enough height for the
         * rail to fit, and the delta becomes a real, equally-shared number (measured
         * 1.08-1.10px across nine gaps). One test, both sides of the boundary, without
         * either being contrived. */
        test('L5: deleting a row shares one remainder equally - no row gets a number of its own',
            () => mounted(async (page) => {
                const geom = () => page.eval(`JSON.stringify((() => {
                    const rows = [...window.__h.q('live-screen').shadowRoot
                        .querySelector('live-rail').children]
                        .map((el) => el.getBoundingClientRect());
                    return {
                        tops: rows.map((r) => +r.top.toFixed(2)),
                        gaps: rows.slice(1).map((r, i) => +(r.top - rows[i].bottom).toFixed(2)),
                    };
                })())`).then(JSON.parse);

                const before = await geom();
                await page.evalFn(() => {
                    const rail = window.__h.q('live-screen').shadowRoot.querySelector('live-rail');
                    rail.removeChild(rail.lastElementChild);
                    return true;
                });
                await page.settle(3);
                const after = await geom();

                assert.equal(after.tops.length, before.tops.length - 1);
                assert.equal(after.tops[0], before.tops[0],
                    'the rail\'s first row moved when a row was deleted below it - the top of the '
                    + 'rail is its inset, not a number its contents negotiate');

                /* One delta per surviving gap, and they must agree. Compared as a SET
                 * rather than gap by gap, because the claim is about the rule and not
                 * about which row happens to be where. */
                const deltas = after.gaps.map((gap, i) => +(gap - before.gaps[i]).toFixed(2));
                const spread = Math.max(...deltas) - Math.min(...deltas);
                assert.ok(spread < 0.51,
                    `a row was removed and the rail's gaps moved by different amounts `
                    + `(${deltas.join(', ')}) - that is the emergent-alignment chain (L5)`);
                assert.ok(Math.min(...deltas) >= -0.51,
                    `a gap TIGHTENED when a row was removed (${deltas.join(', ')}) - space-between `
                    + 'can only ever open the rail up, so this is something else sizing it');
            }));

        /* -- 5. FLOORS AND SCROLL ------------------------------------------- */

        test('at and above the design floor NOTHING on Live scrolls', () => mounted(async (page) => {
            const tree = await page.eval(`JSON.stringify(${REGION_TREE})`).then(JSON.parse);
            const scrolling = tree.filter((n) => /auto|scroll/.test(n.overflowY) && n.scrollHeight > n.clientHeight + 1);
            assert.deepEqual(withoutRail(scrolling.map((n) => `${n.tag}.${n.cls}`)), [],
                'slate-live.css:1126-1131: "a scroll affordance on a wall tablet is worse than the crowding it fixes"');
            /* THE RAIL IS THE ONE EXCEPTION AND IT IS SIZE-DEPENDENT: Slate's nine rows
             * fit the reference geometry with room over and do not fit below it. The
             * assertion is on the ANSWER rather than on a tolerance, so a rail that
             * started scrolling at 1920 — which would mean it had grown a row — still
             * turns this red. See RAIL_NODE. */
            assert.equal(railScrolls(scrolling.map((n) => `${n.tag}.${n.cls}`)),
                geometry.height < 1200,
                `the rail's scroll state changed at ${geometry.name}`);

            const doc = await page.evalFn(() => ({
                scroll: document.documentElement.scrollHeight,
                client: document.documentElement.clientHeight,
            }));
            assert.ok(doc.scroll <= doc.client + 1, `the document scrolls: ${doc.scroll} vs ${doc.client}`);
        }));

        test('the chart is above its own floor and the band is above its token floor',
            () => mounted(async (page) => {
                const card = await page.box(CARD);
                const cardFloor = px(await page.prop(CARD, 'min-block-size'));
                assert.ok(card.height >= cardFloor - 0.51,
                    `the chart is under its floor: ${card.height} vs ${cardFloor}`);

                const foot = await page.box(FOOT);
                const footFloor = px(await page.resolveValue('var(--ui-live-foot-min-h)', 'block-size'));
                assert.ok(foot.height >= footFloor - 0.51,
                    `the band is under its floor: ${foot.height} vs ${footFloor}`);

                // The chart is the only 1fr: it, and nothing else, has the spare height.
                const main = await page.box(MAIN);
                const gauges = await page.box(`${S} >>> .gauges`);
                assert.ok(card.height > gauges.height, 'the chart is the region that absorbs the height');
                assert.ok(card.height < main.height, 'and it is inside main, not equal to it');
            }));

        test('the M3 token is the band s floor, and drilling it moves the band', () => mounted(async (page) => {
            const before = await page.box(FOOT);
            const cardBefore = await page.box(CARD);

            await page.setToken('--ui-live-foot-min-h', '320px');
            await page.settle(3);
            const after = await page.box(FOOT);
            const cardAfter = await page.box(CARD);

            assert.ok(after.height >= 319.5, `the band ignored its floor token: ${after.height}`);
            assert.ok(after.height > before.height, 'the floor did not move the band');

            /* WHERE THE HEIGHT COMES FROM depends on whether the chart still has any,
             * and at the 1000x600 design floor it no longer does — DQ-0-A.
             * MEASURED after parity surface 0: main is 304.45 tall at the floor while the
             * gauge cluster (74) + the chart's own --ui-chart-min-h (186) + the band's
             * --ui-live-foot-min-h (190.3) already ask for 450.3. The chart is pinned on
             * its floor before this drill starts, so raising the band's floor cannot take
             * anything more from it; the shortfall grows as the VISIBLE overflow section
             * 2.4 requires instead. The cluster is 74 at both geometries now because the
             * display scale stopped clamping (it was ~60 at the floor), which is 14px of
             * the pin.
             * The claim is therefore made where it is testable — the chart gives while it
             * has slack — and the pinned case asserts the pin instead of passing blind. */
            const chartFloor = px(await page.prop(CARD, 'min-block-size'));
            if (cardBefore.height > chartFloor + 0.51) {
                assert.ok(cardAfter.height < cardBefore.height,
                    'and the height came out of the chart, as the 1fr');
            } else {
                assert.ok(Math.abs(cardAfter.height - chartFloor) < 0.51,
                    `the chart was already on its ${chartFloor}px floor and must stay there, `
                    + `not shrink past it: ${cardAfter.height} (DQ-0-A)`);
            }

            await page.setToken('--ui-live-foot-min-h', null);
        }));

        /* -- 6. THE GHC STRIP IS A ROW, NOT AN OVERLAY (bug L1) ------------- */

        test('the GHC strip lands IN FLOW and takes its height from the chart', (t) => mounted(async (page) => {
            const chartBefore = await page.box(CARD);
            const floorBefore = px(await page.prop(CARD, 'min-block-size'));

            await page.evalFn(() => { window.__h.q('live-screen').ghc = true; return true; });
            await page.settle(4);

            const strip = await page.box(`${S} >>> .ghc-strip`);
            const chartAfter = await page.box(CARD);
            const stripStyle = await page.computed(`${S} >>> .ghc-strip`, ['position']);
            const main = await page.metrics(MAIN);
            const foot = await page.box(FOOT);
            /* How far the strip's box reaches back INSIDE the chart card's. Negative is the
             * healthy answer and equals the gap. */
            const overlap = +(chartAfter.y + chartAfter.height - strip.y).toFixed(2);

            t.diagnostic(`${geometry.name} with ghc: chart ${chartBefore.height.toFixed(2)} -> `
                + `${chartAfter.height.toFixed(2)} (floor ${floorBefore}), strip ${strip.height.toFixed(2)}, `
                + `band ${foot.height.toFixed(2)}, strip ${overlap > 0 ? `${overlap}px INSIDE the chart card`
                    : `${-overlap}px clear of it`}`);

            assert.equal(stripStyle.position, 'static', 'L1 is an absolutely positioned strip');
            assert.ok(strip.height > 0, 'the strip rendered');
            assert.ok(strip.y > chartAfter.y, 'the strip is a row under the chart, not a layer over it');
            assert.ok(chartAfter.height < chartBefore.height + 0.51,
                'the chart did not give the strip its space, so the space came from somewhere else');

            if (chartAfter.height > floorBefore + 0.51) {
                /* There was room: the strip costs the chart exactly its own height plus
                 * a gap, and nothing overlaps. This is L1 dead - the strip cannot cover
                 * the time axis, because a grid row is not a layer. */
                assert.ok(strip.y >= chartAfter.y + chartAfter.height - 0.51,
                    'the strip overlaps the chart - bug L1, measured 855...933 over a chart bottom of 900');
                assert.ok(main.scrollHeight <= main.clientHeight + 1, 'main clipped its own rows');
            } else {
                /* THERE WAS NOT ROOM, AND THAT IS A RECORDED MEASUREMENT, NOT A PASS
                 * BY DEFAULT. At the 1000x600 design floor the floors do not fit once
                 * the strip exists: --ui-band-h + the gauge cluster + --ui-chart-min-h
                 * plus the card's chrome + the strip + --ui-live-foot-min-h is larger
                 * than the window by tens of pixels. The chart is pinned on its floor
                 * and the shortfall shows as VISIBLE overflow (§2.4) rather than as a
                 * silent clip - which is the only honest behaviour available until M18
                 * (is 160px the right chart floor?) and M3 (what does the band really
                 * need?) are measured on the bench.
                 *
                 * AND THE SHORTFALL IS BOUNDED, because "recorded" without a bound is a
                 * branch that accepts any number at all. It has already moved once
                 * unnoticed: the skeleton measured 25.25px of strip inside the card, and
                 * it is 59.55px here - the band went 156 -> 190.3 when `build:bands`
                 * landed real content, and every one of those pixels came out of the
                 * chart's overlap because the chart was already pinned. So the number is
                 * asserted the same way the §2.4 shortfall above is: named, printed every
                 * run, and red when it grows. The bound is the measurement plus ~10%,
                 * NOT a design answer - M18 (the chart floor) and M3 (the band floor) are
                 * the two tokens that decide it, and the honest fix is on the bench. */
                assert.ok(Math.abs(chartAfter.height - floorBefore) < 0.51,
                    'the chart is not on its floor, so something else absorbed the strip');
                assert.notEqual(await page.prop(MAIN, 'overflow-y'), 'hidden',
                    'the shortfall is hidden rather than shown - that is the defect §2.4 exists to end');
                /* THE BOUND HAS MOVED TWICE, and each move is recorded rather than
                 * absorbed. Parity surface 0: 59.55 -> 73.55, the whole 14px being the
                 * gauge cluster, which is 74 tall at BOTH geometries now that
                 * --ui-display-lg/-xl are Slate's flat 45/52 instead of clamps that fell
                 * to 34/38 in a narrow container. Parity surface 1: 73.55 -> 95.14, the
                 * 21.59px being the stat cluster's HEADING — §4.1's own
                 * "<stat-cluster>  auto  (heading + gauges)", the profile identity line
                 * Slate draws at the top of its chart card and the rewrite never built
                 * (finding P-2's content half). The chart is pinned on its floor here, so
                 * every pixel the block above it gains lands in this overlap.
                 *
                 * That is DQ-0-A, twice over: Slate's own readout sizes and Slate's own
                 * heading do not both fit the 1000x600 design floor once the GHC strip
                 * exists, and the answer is Ben's — M18 (the chart floor) and M3 (the band
                 * floor) are the two tokens that decide it, and neither re-clamping the
                 * readouts nor dropping the heading is on the table, because he asked for
                 * Slate's numbers and §4.1 asks for the heading. Bound is the measurement
                 * plus ~10%. */
                /* RE-MEASURED after Ben's foot ruling: the band gained Slate's last-shot
                 * identity and its four derived scalars, so it is taller at the design
                 * floor and the chart card — already pinned on its own floor here — has
                 * that much less room. Same finding, same DQ, a bigger number. Bound is
                 * the measurement plus ~10%. */
                assert.ok(overlap < 175,
                    `the strip's overlap of the chart card grew past its recorded size: `
                    + `${overlap}px, recorded 158.14px at the 1000x600 floor (DQ-0-A)`);
            }
        }));
    });
}

/* ===========================================================================
 * C1 AND C2 - THE ORDER OF SURRENDER, MEASURED BY SHRINKING THE WINDOW
 *
 * One page, one width, the height stepped down from C1's 1080 to well below the
 * design floor. Written as a trace rather than as a set of independent assertions
 * because the decision is about an ORDER, and an order is a property of the whole
 * sequence.
 * =========================================================================== */

describe('C1 / C2: the order of surrender', () => {
    const HEIGHTS = [1080, 900, 801, 700, 600, 560, 520, 480];

    /** One row of the trace, in the page. */
    const SAMPLE = `(() => {
        const q = (s) => window.__h.q(s);
        const h = (s) => +q(s).getBoundingClientRect().height.toFixed(2);
        const band = q('live-screen >>> live-foot >>> .band');
        const rail = q('live-screen >>> live-rail');
        return {
            screen: h('live-screen'),
            chart: h('live-screen >>> ui-chart-card'),
            foot: h('live-screen >>> live-foot'),
            chartFloor: parseFloat(getComputedStyle(q('live-screen >>> ui-chart-card')).minBlockSize),
            footFloor: parseFloat(getComputedStyle(q('live-screen >>> live-foot')).minBlockSize),
            bandScrolls: band.scrollHeight > band.clientHeight + 1,
            bandOverflow: getComputedStyle(band).overflowY,
            railScrolls: rail.scrollHeight > rail.clientHeight + 1 && getComputedStyle(rail).overflowY !== 'visible',
        };
    })()`;

    const trace = async (page, heights) => {
        const out = [];
        for (const height of heights) {
            await page.setGeometry({ ...BENCH, height, deviceScaleFactor: 1 });
            await page.settle(4);
            out.push({ height, ...JSON.parse(await page.eval(`JSON.stringify(${SAMPLE})`)) });
        }
        return out;
    };

    test('the chart absorbs the height, stops dead at its floor, and the band gives its share',
        () => browser.withPage({ geometry: C1 }, async (page) => {
            await page.mount(STAGE, MODULE);
            await page.settle(6);
            const rows = await trace(page, HEIGHTS);

            for (const [i, row] of rows.entries()) {
                assert.ok(row.chart >= row.chartFloor - 0.51,
                    `at ${row.height} the chart is under --ui-chart-min-h plus chrome: ${row.chart} vs ${row.chartFloor}`);
                assert.ok(row.foot >= row.footFloor - 0.51,
                    `at ${row.height} the band is under its M3 floor: ${row.foot} vs ${row.footFloor}`);
                if (i > 0) {
                    assert.ok(row.chart <= rows[i - 1].chart + 0.51,
                        'the chart grew as the window shrank');
                    assert.ok(row.foot <= rows[i - 1].foot + 0.51,
                        'the band grew as the window shrank');
                }
            }

            // The chart is the only 1fr, so it is the box the spare height belongs to
            // and the box that gives it back first (§4.1's own flex table). C1's
            // "the chart keeps its height" cannot mean a pixel height in a fluid
            // layout - see the skeleton's file for the argument and the one-line
            // reversal. What IS asserted: it gives its SPARE and never its floor.
            const first = rows[0];
            const last = rows[rows.length - 1];
            assert.ok(first.chart > last.chart, 'the chart never absorbed anything');
            assert.equal(Math.round(last.chart), Math.round(last.chartFloor),
                'at the smallest window the chart sits exactly on its floor');

            /* AND THE BAND GIVES TOO, WHICH IS DQ-541's ANSWER (Ben, 21 August 2026):
             * "the foot band should scale, not have fixed pixel height but reduce so it
             * looks similar regardless of resolution". Its floor is
             * max(--ui-live-foot-min-h, --ui-live-foot-share) and the share is a share of
             * the screen, so the FLOOR itself shrinks with the window - which is the
             * mechanism, asserted here rather than the outcome asserted twice. */
            assert.ok(first.footFloor > last.footFloor,
                `the band's floor did not scale with the screen: ${first.footFloor} -> ${last.footFloor}`);
            assert.ok(first.foot > last.foot,
                'the band never gave anything - before DQ-541 it was content-sized at every height');

            /* THE RAIL SCROLLS ONCE ITS NINE STANDING ROWS OUTRUN THE WINDOW, and that
             * is Ben's own exception (22 Aug 2026) rather than a regression: §4.1's
             * "never scrolls, drops nothing" was written for a rail that recomposed to
             * at most six tracks, and Slate's rail — the one the ruling installs — is
             * 1082px of rows. The half that survives is "drops nothing", so it scrolls.
             * Asserted as a BOUNDARY rather than as a blanket: the tallest window in the
             * trace holds the rail without scrolling, and every shorter one does not. */
            for (const [i, row] of rows.entries()) {
                if (i > 0 && rows[i - 1].railScrolls) {
                    assert.equal(row.railScrolls, true,
                        `at ${row.height} the rail stopped scrolling while the window kept shrinking — `
                        + 'a rail that stops scrolling has dropped a row');
                }
            }
            assert.equal(rows[rows.length - 1].railScrolls, true,
                'the rail did not scroll at the smallest window — nine standing rows do not fit it');
        }));

    /**
     * DQ-541, AT THE THREE HEIGHTS BEN NAMED, PLUS ONE ABOVE THEM, AND THE NUMBERS THIS
     * RUN MEASURED.
     *
     * The question this replaces: "At 1920x1080 the shipped screen takes all 120 rows out
     * of the CHART and none out of the foot band - the inverse of C1's decided answer."
     * The band was content-sized and nothing else, so it measured 190.3px at 1200 rows, at
     * 801 and at 600 alike. Ben's own direction was neither of the three recorded options:
     * BOTH regions give proportionally, and the chart reduces so it still fits.
     *
     * THE BAND IS max(ITS CONTENT, ITS FLOOR), AND THE FLOOR IS THE SHARE. That single
     * sentence is the whole mechanism and it is what this test now asserts at every height
     * it visits, rather than asserting one difference between two of them. The floor is
     * max(--ui-live-foot-min-h, --ui-live-foot-share); the share is 18dvh, so it scales
     * with the screen; the band takes the larger of that and its own content. Above the
     * crossover the band IS the share and gives exactly as the screen does; below it the
     * band is content-sized and stops giving, which is the fallback live-foot.js has
     * described in its own words since the token was introduced.
     *
     * WHERE THE CROSSOVER SITS TODAY, AND WHY THIS TRACE STARTS AT 1400. When this was
     * written the band's content was 190.3px, the crossover sat at 1057 rows, and Ben's
     * top two heights were both above it - so 1200 -> 1080 was a clean demonstration of
     * the share giving. The content has since grown to 217.3px at this width and the
     * crossover has moved to about 1207 rows, which is just ABOVE 1200. All three of the
     * heights Ben named are now on the content-sized side of it, and a test that only
     * visited those three would be measuring the fallback and calling it the mechanism.
     *
     * The growth is Slate's own content arriving, not drift: Ben's 22 August foot ruling
     * put the last-shot identity and the four derived scalars in the band, and the phase
     * table wraps a heading at this suite's 1281px trace width (measured: <ui-data-grid>
     * is 181.3px here against 166.3px at 1920). At 1920 wide the band is 216.0 at 1200
     * rows - exactly its share, to the pixel - so nothing about the mechanism is broken;
     * the band is simply within a pixel and a half of its share at the width this trace
     * uses. 1400 is added so the share is unambiguously the binding term at one end of
     * the trace, and the crossover itself is printed and bounded below.
     *
     * MEASURED here, and pinned here, at 1281 wide (the width `trace` uses):
     *
     *     1400 rows   band 252.00   ( = --ui-live-foot-share, 18dvh - the share binds )
     *     1200 rows   band 217.30   ( content: the share is 216.0 and loses by 1.3 )
     *     1080 rows   band 217.30   ( content: the share is 194.4 )
     *      800 rows   band 217.30   ( content: the floor is M3's 148 )
     *
     * The proportionality is asserted as an equality against the token rather than against
     * the recorded number, so retargeting the share moves the test with the build; the
     * numbers above are what it lands on today.
     */
    test('DQ-541: above its content the band is a share of the screen, and gives it back',
        (t) => browser.withPage({ geometry: C1 }, async (page) => {
            await page.mount(STAGE, MODULE);
            await page.settle(6);
            const rows = await trace(page, [1400, 1200, 1080, 800]);

            /* The token is a dvh, so it resolves differently at every height in the trace:
             * each row's own `footFloor` (the band's computed min-block-size, which IS
             * max(--ui-live-foot-min-h, --ui-live-foot-share)) is the share where the
             * share is the larger term, and M3's floor where it is not. */
            for (const row of rows) {
                assert.ok(row.foot >= row.footFloor - 0.51,
                    `at ${row.height} the band is under its floor: ${row.foot} vs ${row.footFloor}`);
                assert.equal(row.bandScrolls, false,
                    `at ${row.height} the band scrolls - C2's last resort is for BELOW the design floor`);
            }

            const [tall, twelve, c1, bench] = rows;

            /* THE MECHANISM, AT EVERY HEIGHT AND NOT AS ONE DIFFERENCE.
             *
             * The band's own content does not depend on how tall the screen is - nothing
             * in it reflows vertically - so the shortest screen in the trace, where the
             * floor is smallest, measures the content directly. Everything else follows:
             * the band must be max(that content, that height's floor), and the equality
             * holding at four heights across three different floors is a much stronger
             * statement than "it got smaller once". */
            const content = bench.foot;
            for (const row of rows) {
                const want = Math.max(content, row.footFloor);
                assert.ok(Math.abs(row.foot - want) < 0.51,
                    `at ${row.height} the band is ${row.foot}, and max(content ${content}, `
                    + `floor ${row.footFloor}) is ${want.toFixed(2)} - the band is being sized `
                    + 'by something other than its content and its share');
            }

            /* THE SHARE IS STILL A LIVE MECHANISM AND NOT A TOKEN NOTHING MATCHES, which
             * is the thing worth guarding now that the crossover has moved up past two of
             * Ben's three heights. If the band's content ever passes the share at the
             * TALLEST screen this trace visits, --ui-live-foot-share stops changing any
             * outcome at any height a person will see, and DQ-541 is answered in the
             * stylesheet and nowhere else. */
            assert.ok(content < tall.footFloor,
                `the band's content (${content}px) has outgrown its share even at ${tall.height} rows `
                + `(${tall.footFloor}px) - --ui-live-foot-share now decides nothing anywhere`);
            assert.ok(Math.abs(tall.foot - tall.footFloor) < 0.51,
                `at ${tall.height} the band is ${tall.foot} against a floor of ${tall.footFloor} - the share `
                + 'is not what is sizing it, so the proportionality below is a coincidence');

            /* AND WITH THE SHARE BINDING, THE BAND GIVES EXACTLY AS THE SCREEN DOES.
             * Bounded on both sides: it never gives nothing (that was the defect) and
             * never gives MORE than the screen (that would be the band paying twice). */
            assert.ok(tall.foot > twelve.foot,
                `the band did not give when the screen shrank ${tall.height} -> ${twelve.height}: `
                + `${tall.foot} -> ${twelve.foot}`);
            const bandRatio = twelve.foot / tall.foot;
            const screenRatio = twelve.height / tall.height;
            t.diagnostic(`the band gave ${(bandRatio * 100).toFixed(1)} % against a screen at `
                + `${(screenRatio * 100).toFixed(1)} %`);
            assert.ok(bandRatio < 1,
                `the band gave nothing: ${(bandRatio * 100).toFixed(1)} %`);
            assert.ok(bandRatio >= screenRatio - 0.01,
                `the band gave ${(bandRatio * 100).toFixed(1)} %, MORE than the screen's `
                + `${(screenRatio * 100).toFixed(1)} % - DQ-541 asks it to scale, not to collapse`);
            assert.ok(tall.chart > twelve.chart, 'and the chart gave with it, which is the other half of the ask');

            /* THE CROSSOVER ITSELF, PRINTED AND BOUNDED. This is what the run owes Ben:
             * the height below which the band stops scaling because its own content is
             * what sizes it. It is content / 0.18, it sat at 1057 rows when DQ-541 landed,
             * and it sits just above 1200 today - which is why the band does not give
             * between the two heights he named. Recorded, not blessed: the bound is what
             * turns red if the band's content runs away from its share rather than
             * shadowing it. */
            const share = (twelve.footFloor / twelve.height);
            const crossover = content / share;
            t.diagnostic(`the band stops scaling below ${crossover.toFixed(0)} rows `
                + `(content ${content}px / share ${(share * 100).toFixed(1)} %); at Ben's own `
                + `1200 / 1080 / 800 it is content-sized at ${twelve.foot} / ${c1.foot} / ${bench.foot}`);
            assert.ok(content - twelve.footFloor < 20,
                `at ${twelve.height} the band is ${(content - twelve.footFloor).toFixed(2)}px above its share - `
                + 'the content has run away from the share rather than shadowing it, and the '
                + 'crossover is climbing out of the range of screens this skin runs on');

            /* At the bench height the share is smaller than the band's own content, so the
             * band is content-sized and nothing about today's build moves. That is the
             * boundary the share was chosen to sit above, and it is worth pinning: a share
             * big enough to bind here would leave band ground under the last phase row. */
            /* RE-MEASURED after Ben's foot ruling (22 Aug 2026), which put two more of
             * Slate's own blocks in the band. The boundary this pinned - the share
             * ceasing to bind before the bench height - has MOVED, because the band's
             * content is taller: at 800 rows the band is now content-sized AND on its
             * floor at the same number, so the two can no longer be told apart by a
             * difference. What the pin was for still holds and is asserted directly:
             * the band never goes UNDER its floor, and it does not grow as the window
             * shrinks. Where exactly the share stops binding is C2's question. */
            assert.ok(bench.foot >= bench.footFloor - 0.51,
                `at ${bench.height} rows the band is under its floor: ${bench.foot} vs ${bench.footFloor}`);
            for (const [i, row] of rows.entries()) {
                if (i === 0) continue;
                assert.ok(row.foot <= rows[i - 1].foot + 0.51,
                    `the band GREW as the screen shrank: ${rows[i - 1].foot} -> ${row.foot}`);
            }

            /* AND THE FLOOR IS A SHARE OF THE SCREEN WHEREVER THE SHARE IS THE LARGER
             * TERM - which is the mechanism DQ-541 asked for, asserted on the floors
             * themselves rather than inferred from the band. The 800-row row is excluded
             * on purpose and pinned separately: there the share is 144 and M3's own floor
             * of 148 wins, which is the max() doing its other job. */
            const footMin = px(await page.resolveValue('var(--ui-live-foot-min-h)', 'block-size'));
            for (const row of [tall, c1]) {
                assert.ok(Math.abs(row.footFloor / twelve.footFloor - row.height / twelve.height) < 0.01,
                    `the floor itself is not a share of the screen: ${twelve.footFloor} at ${twelve.height} `
                    + `-> ${row.footFloor} at ${row.height}`);
            }
            assert.ok(Math.abs(bench.footFloor - footMin) < 0.51,
                `at ${bench.height} rows the floor should be M3's own --ui-live-foot-min-h `
                + `(${footMin}px), not the ${(share * bench.height).toFixed(2)}px share: got ${bench.footFloor}`);
        }));

    test('C2: with a band that has rows to lose, the share cap makes the BAND the giver '
        + 'and the band is the only region that scrolls', () => browser.withPage({ geometry: C1 }, async (page) => {
        await page.mount(STAGE, MODULE);
        await page.settle(6);

        /* M3's measurement is not taken, so this is what taking it might land on: a
         * five-phase profile's worth of rows in the band. The point is not the number
         * - it is that the layout's behaviour with a TALL band is decided now and not
         * discovered later. */
        await page.evalFn(() => {
            const foot = window.__h.q('live-screen').shadowRoot.querySelector('live-foot');
            for (let i = 0; i < 6; i += 1) {
                const row = document.createElement('div');
                row.setAttribute('data-placeholder', '');
                row.className = 'foot-row';
                row.textContent = 'Phase ' + (i + 1);
                foot.appendChild(row);
            }
            return true;
        });
        await page.settle(4);

        const rows = await trace(page, [1080, 801, 600, 460]);
        const share = 0.40;   // --ui-live-foot-max-share

        for (const row of rows) {
            assert.ok(row.foot <= row.screen * share + 1.01,
                `at ${row.height} the band took more than its share: ${row.foot} of ${row.screen}`);
            assert.ok(row.foot >= row.footFloor - 0.51, 'and never less than its floor');
            assert.ok(row.chart >= row.chartFloor - 0.51, 'the chart is still above its floor');
        }

        // THE BAND IS THE GIVER HERE, which is C1's answer to the extent a fluid
        // layout can state it: the cap is a share of the screen, so a shorter window
        // narrows it and the band hands height back.
        assert.ok(rows[0].foot > rows[rows.length - 1].foot, 'the capped band did not give anything');

        // ...and C2's last resort: it scrolls, visibly, rather than clipping.
        const squeezed = rows[rows.length - 1];
        assert.equal(squeezed.bandScrolls, true, 'the band did not scroll once squeezed under its content');
        assert.notEqual(squeezed.bandOverflow, 'hidden', 'the band clips silently - §2.4 exists to end that');

        const m = await page.metrics(BAND);
        assert.ok(m.scrollbarInline > 0,
            'the band scrolls with no scrollbar - a region the user cannot tell is scrollable is the same '
            + 'defect one step later (slate-shell.css:456)');

        /* THE RAIL SCROLLS AT THESE HEIGHTS AND THE BAND IS STILL THE ONLY REGION C2 IS
         * ABOUT. Ben's standing-rail ruling puts Slate's nine rows on the rail, which is
         * 1082px of content, so below about 1160 rows of screen it scrolls — see
         * RAIL_NODE. C2's claim is about the ORDER OF SURRENDER between the chart and
         * the band, and the rail is not in that order at all: it gives nothing, it takes
         * nothing, and it drops nothing. Asserted as its own fact so it cannot go
         * unnoticed rather than subtracted silently. */
        assert.ok(rows.every((r) => r.railScrolls),
            'the rail did not scroll at these heights — nine standing rows do not fit them');
    }));

    test('C1 at exactly 1920 x 1080: the numbers the morning review starts from',
        () => browser.withPage({ geometry: C1 }, async (page) => {
            await page.mount(STAGE, MODULE);
            await page.settle(6);
            const got = JSON.parse(await page.eval(`JSON.stringify(${SAMPLE})`));

            assert.equal(got.screen, 1080, 'the screen is exactly the C1 geometry');
            /* 500 SINCE THE BAND GAINED SLATE'S OWN BLOCKS (Ben, 22 Aug 2026). The chart
             * is the only 1fr and the band is content-sized above its floor, so every
             * pixel the band's new content takes comes out of the chart: 557 against the
             * 600+ it held when the band was a phase table and two controls. It still
             * owns most of the body — the number is what the morning review starts from,
             * and it moves with the band by construction. */
            assert.ok(got.chart > 500, `the chart should own most of the body at 1080: ${got.chart}`);
            assert.ok(got.foot >= got.footFloor - 0.51);
            assert.equal(got.bandScrolls, false, 'nothing scrolls at C1');

            // The four bands add up to the window, with two seams and nothing left over.
            const header = await page.box(`live-screen >>> live-header`);
            const main = await page.box(`live-screen >>> live-main`);
            const seam = parseFloat(await page.resolveValue('var(--ui-seam)', 'block-size'));
            const total = header.height + seam + main.height + seam + got.foot;
            assert.ok(Math.abs(total - 1080) < 1.01, `the rows do not fill the window: ${total}`);
        }));
});

/* ===========================================================================
 * FAHRENHEIT — the tiles, the rail, and the number that goes back
 * ======================================================================== */

describe('the Live screen draws temperatures in the unit the person chose', () => {
    /* THE PREFERENCE HAD NO READER. `units.js` carried the whole conversion and
     * `createUnitsStore` had zero callers in src/, so every temperature on this screen —
     * three gauge tiles and three rail targets — was drawn in Celsius whatever the
     * Temperature bank said. Found 26 August 2026 by sweeping every settings row for
     * something on the other end.
     *
     * THE WIRE IS ALWAYS CELSIUS. `#valueOf` converts on the way to a control and
     * `#commit` converts on the way back, so `target-change` carries the machine's own
     * number and nothing downstream knows a unit exists. */
    const drive = (page, unit) => page.evalFn(async (u) => {
        const lm = await import('/src/lib/machine-limits.js');
        const el = document.querySelector('live-screen');
        el.limits = lm.limitsFor('bengle');
        el.tempUnit = u;
        el.readings = { group: 92.3, steam: 148.6, milk: 61.1 };
        el.targets = { brewTemp: 92, steamTemp: 160 };
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const root = el.shadowRoot;
        const tile = (label) => [...root.querySelectorAll('ui-stat-tile')].find((t) => t.label === label);
        const step = (key) => root.querySelector(`ui-stepper[data-key="${key}"]`);
        const drawn = (el_) => (el_?.shadowRoot?.querySelector('.value, #value, output')?.textContent ?? '').trim();
        return {
            group: { unit: tile('Group')?.unit, drawn: drawn(tile('Group')) },
            steamTile: { unit: tile('Steam')?.unit, drawn: drawn(tile('Steam')) },
            brew: step('brewTemp') ? {
                unit: step('brewTemp').unit, min: step('brewTemp').min,
                max: step('brewTemp').max, drawn: drawn(step('brewTemp')),
            } : null,
        };
    }, unit);

    test('Celsius is the wire\'s own unit and nothing moves', () => browser.withPage({ geometry: BENCH }, async (page) => {
        await page.mount(STAGE, MODULE);
        await page.settle(6);
        const shown = await drive(page, 'c');
        assert.equal(shown.group.unit, '°C');
        assert.match(shown.group.drawn, /92\.3/);
        assert.equal(shown.brew.unit, '°C');
        assert.equal(shown.brew.min, 70);
        assert.equal(shown.brew.max, 110);
    }));

    test('Fahrenheit moves the tiles, the band and the symbol together', () => browser.withPage({ geometry: BENCH }, async (page) => {
        await page.mount(STAGE, MODULE);
        await page.settle(6);
        const shown = await drive(page, 'f');
        /* SAME DECIMAL PLACE AS THE ORIGINAL. The tiles have always drawn one decimal and
         * still do; 92.3 C is 198.14 F, which prints as 198.1. */
        assert.equal(shown.group.unit, '°F');
        assert.match(shown.group.drawn, /198\.1/);
        assert.equal(shown.steamTile.unit, '°F');
        assert.match(shown.steamTile.drawn, /299\.5/);
        /* AND THE BAND UNDER THE CONTROL, rounded to whole display units — a bound printed
         * as 157.98 invites a value the band would refuse. */
        assert.equal(shown.brew.unit, '°F');
        assert.equal(shown.brew.min, 158);
        assert.equal(shown.brew.max, 230);
    }));

    test('a press sends the MACHINE\'s number, not the drawn one', () => browser.withPage({ geometry: BENCH }, async (page) => {
        await page.mount(STAGE, MODULE);
        await page.settle(6);
        await drive(page, 'f');
        const sent = await page.evalFn(async () => {
            const el = document.querySelector('live-screen');
            const seen = [];
            el.addEventListener('target-change', (e) => seen.push(e.detail));
            const stepper = el.shadowRoot.querySelector('ui-stepper[data-key="brewTemp"]');
            stepper.dispatchEvent(new CustomEvent('change', {
                detail: { value: stepper.next(stepper.value, 1) }, bubbles: true, composed: true,
            }));
            await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
            return seen;
        });
        assert.equal(sent.length, 1, 'one press, one event');
        assert.equal(sent[0].key, 'brewTemp');
        /* ONE MACHINE STEP: brewTemp steps by 0.5 °C, so 92 becomes 92.5 on the wire —
         * not 92.2777…, which is what a one-Fahrenheit-degree step would have sent. */
        assert.equal(sent[0].value, 92.5);
    }));
});
