/**
 * Gate A for.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, BENCH, GATE_A_GEOMETRIES } from '../harness/index.js';
import { assertTokenDrill, DRILL_COLOUR, DRILL_LENGTH } from '../harness/assertions.js';
import { entry as galleryEntry } from '../../tools/gallery/entries/seams.entry.js';

const MARKUP = `
<div id="stage" style="padding: 24px; display: grid; gap: 40px; justify-items: start">

    <!-- 1. A zone split. 260 + seam + 1fr inside 600 — bug T19's arithmetic. -->
    <div id="zone" class="seam-grid"
         style="inline-size: 600px; block-size: 200px;
                grid-template-columns: 260px minmax(0, 1fr)">
        <div class="seam-cell" id="zone-nav"></div>
        <div class="seam-cell" id="zone-pane"></div>
    </div>

    <!-- 2. Rows only, --ui-line: the 55 settings <hr class="border-t slate-hairline">
         elements, replaced by two gaps and no elements. -->
    <div id="rows" class="seam-grid seam-rows seam-line"
         style="inline-size: 600px; grid-template-rows: repeat(3, 63px)">
        <div class="seam-cell" id="row-1"></div>
        <div class="seam-cell" id="row-2"></div>
        <div class="seam-cell" id="row-3"></div>
    </div>

    <!-- 3. Columns only, --ui-line-strong: the editor matrix (gap 0px 1px) drawn in
         the rail's own grade. -->
    <div id="cols" class="seam-grid seam-cols seam-strong"
         style="inline-size: 601px; grid-template-columns: repeat(3, 199px);
                grid-template-rows: 60px 60px">
        <div class="seam-cell" id="col-a1"></div>
        <div class="seam-cell" id="col-b1"></div>
        <div class="seam-cell" id="col-c1"></div>
        <div class="seam-cell" id="col-a2"></div>
        <div class="seam-cell" id="col-b2"></div>
        <div class="seam-cell" id="col-c2"></div>
    </div>

    <!-- 4. Trap 1, asserted rather than only documented: cells that paint nothing
         make the whole box a slab of ground. -->
    <div id="hole" class="seam-grid"
         style="inline-size: 300px; block-size: 100px; grid-template-columns: 1fr 1fr">
        <div id="hole-a"></div>
        <div id="hole-b"></div>
    </div>

    <!-- 5. Trap 3: a nested seam grid is a cell, and names its own weight. -->
    <div id="outer" class="seam-grid seam-strong"
         style="inline-size: 600px; block-size: 120px; grid-template-columns: 1fr 1fr">
        <div class="seam-cell" id="outer-a"></div>
        <div id="inner" class="seam-grid seam-line seam-cell"
             style="grid-template-rows: 1fr 1fr">
            <div class="seam-cell" id="inner-a"></div>
            <div class="seam-cell" id="inner-b"></div>
        </div>
    </div>

    <!-- 6. The shadow-root half. Filled in by adoptSeams(root). -->
    <div id="host"></div>
</div>
`;

/* The component half — mounted separately, because these are custom elements and the
 * markup above deliberately contains none. Upgraded once `defineProbes` runs. */
const COMPONENT_MARKUP = `
<div id="stage" style="padding: 24px; display: grid; gap: 40px; justify-items: start">
    <seams-probe id="inside"></seams-probe>
    <seams-host-probe id="on-host"
         style="inline-size: 400px; block-size: 90px"></seams-host-probe>
    <seams-flex-probe id="flex-host"
         style="inline-size: 400px; block-size: 90px"></seams-flex-probe>
</div>
`;

const ORACLE = {
    dark: {
        zoneSeam: 'rgb(58, 72, 82)',
        line: 'rgb(58, 72, 82)',
        lineStrong: 'rgb(82, 97, 107)',
    },
    light: {
        zoneSeam: 'rgb(203, 208, 211)',
        line: 'rgb(203, 208, 211)',
        lineStrong: 'rgb(170, 178, 183)',
    },
};

const SEAM_PX = 1;

/** The gap between two boxes laid out side by side, in CSS px. */
const inlineGap = (a, b) => b.left - (a.left + a.width);
/** The gap between two boxes laid out one above the other, in CSS px. */
const blockGap = (a, b) => b.top - (a.top + a.height);

/** Layout units are 1/64 px, so compare seams with a tolerance, not with ===. */
const near = (got, want, what) => assert.ok(
    Math.abs(got - want) < 0.05,
    `${what}: expected ${want} CSS px, measured ${got}`,
);

/** Filled in per geometry, compared once at the end. */
const acrossGeometries = {};

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

async function mountSeamed(page) {
    await page.mount(MARKUP, []);
    const adopted = await page.evalFn(async () => {
        const { adoptSeams } = await import('/src/components/seams.js');
        adoptSeams(document);

        const host = document.getElementById('host');
        const root = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
        adoptSeams(root);
        root.innerHTML =
            '<div id="s-zone" class="seam-grid seam-line"'
            + ' style="inline-size: 300px; block-size: 80px;'
            + ' grid-template-columns: 100px minmax(0, 1fr)">'
            + '<div class="seam-cell" id="s-a"></div>'
            + '<div class="seam-cell" id="s-b"></div>'
            + '</div>';
        return document.adoptedStyleSheets.length;
    });
    await page.settle(2);
    return adopted;
}

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`seam utility @ ${geometry.name} (${geometry.width}×${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

        const mounted = (fn) => browser.withPage({ geometry }, async (page) => {
            await mountSeamed(page);
            assert.deepEqual(page.pageErrors, [], 'the seam utility must adopt without throwing');
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

        test('the seam measures one CSS px between two cells, on both axes', () => mounted(async (page) => {
            const nav = await page.box('#zone-nav');
            const pane = await page.box('#zone-pane');
            near(inlineGap(nav, pane), SEAM_PX, 'the column seam');

            const r1 = await page.box('#row-1');
            const r2 = await page.box('#row-2');
            near(blockGap(r1, r2), SEAM_PX, 'the row seam');

            const got = await page.computed('#zone', ['column-gap', 'row-gap', 'display']);
            assert.deepEqual(got, { 'column-gap': '1px', 'row-gap': '1px', display: 'grid' });

            acrossGeometries[geometry.name] = {
                columnSeam: Number(inlineGap(nav, pane).toFixed(3)),
                rowSeam: Number(blockGap(r1, r2).toFixed(3)),
            };
        }));

        test('the seam survives dsf 1.5 — it neither vanishes nor doubles', () => mounted(async (page) => {
            const a = await page.box('#col-a1');
            const b = await page.box('#col-b1');
            near(inlineGap(a, b), SEAM_PX, `the seam at dsf ${geometry.deviceScaleFactor}`);
            assert.equal(Math.round(inlineGap(a, b)), SEAM_PX);
        }));

        test('the utility gives a cell nothing to draw a seam with — the container is the only drawer',
            () => mounted(async (page) => {
                for (const id of ['#zone-nav', '#zone-pane', '#row-1', '#row-2', '#row-3',
                    '#zone', '#rows', '#cols']) {
                    const got = await page.computed(id, [
                        'border-top-width', 'border-right-width', 'border-bottom-width',
                        'border-left-width', 'box-shadow',
                    ]);
                    assert.deepEqual(got, {
                        'border-top-width': '0px',
                        'border-right-width': '0px',
                        'border-bottom-width': '0px',
                        'border-left-width': '0px',
                        'box-shadow': 'none',
                    }, `${id} paints part of the seam itself`);
                }

                const bare = await page.evalFn(() => {
                    const el = document.createElement('div');
                    document.getElementById('stage').append(el);
                    const cs = getComputedStyle(el);
                    const out = `${cs.borderTopWidth}|${cs.boxShadow}`;
                    el.remove();
                    return out;
                });
                assert.equal(bare, '0px|none',
                    'the control is not a control — a bare div already differs');
            }));

        test('bug T2 dead: N cells give N-1 seams, with no sibling selector anywhere', () => mounted(async (page) => {
            const [r1, r2, r3] = await Promise.all([
                page.box('#row-1'), page.box('#row-2'), page.box('#row-3'),
            ]);
            near(blockGap(r1, r2), SEAM_PX, 'seam 1 of 2');
            near(blockGap(r2, r3), SEAM_PX, 'seam 2 of 2');

            const cell = await page.prop('#row-1', 'background-color');
            const ground = await page.prop('#rows', 'background-color');
            assert.notEqual(cell, ground, 'the cell and the ground are the same colour — no seam is visible');
        }));

        test('bug T19 dead: 260 + 1 + 339 = 600, one ink, one line', () => mounted(async (page) => {
            const zone = await page.box('#zone');
            const nav = await page.box('#zone-nav');
            const pane = await page.box('#zone-pane');

            near(zone.width, 600, 'the split');
            near(nav.width, 260, 'the nav pane');
            near(pane.width, 339, 'the detail pane');
            near(nav.width + SEAM_PX + pane.width, zone.width, 'panes + seam = container');
        }));

        test('gap: 1px and gap: 0px 1px — the rail and the editor matrix', () => mounted(async (page) => {
            const both = await page.computed('#zone', ['column-gap', 'row-gap']);
            assert.deepEqual(both, { 'column-gap': '1px', 'row-gap': '1px' });

            const cols = await page.computed('#cols', ['column-gap', 'row-gap']);
            assert.deepEqual(cols, { 'column-gap': '1px', 'row-gap': '0px' });

            const a1 = await page.box('#col-a1');
            const a2 = await page.box('#col-a2');
            near(blockGap(a1, a2), 0, 'the row seam in a column-ruled grid');

            // And the mirror image, the settings list.
            const rows = await page.computed('#rows', ['column-gap', 'row-gap']);
            assert.deepEqual(rows, { 'column-gap': '0px', 'row-gap': '1px' });
        }));

        test('drill: --ui-seam is the seam width', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-seam', value: DRILL_LENGTH,
                selector: '#zone', property: 'column-gap',
            });
            await assertTokenDrill(page, {
                token: '--ui-seam', value: DRILL_LENGTH,
                selector: '#rows', property: 'row-gap',
            });
        }));

        test('drill: --ui-hairline reaches the seam through --ui-seam', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-hairline', value: DRILL_LENGTH,
                selector: '#zone', property: 'column-gap',
            });
            const seam = await page.resolveToken('--ui-seam', 'column-gap');
            const hairline = await page.resolveToken('--ui-hairline', 'column-gap');
            assert.equal(seam, hairline, '--ui-seam must resolve to --ui-hairline, not to its own literal');
            assert.equal(seam, '1px');
        }));

        test('drill: the three weights are three tokens', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-zone-seam', value: DRILL_COLOUR,
                selector: '#zone', property: 'background-color',
            });
            await assertTokenDrill(page, {
                token: '--ui-line', value: DRILL_COLOUR,
                selector: '#rows', property: 'background-color',
            });
            await assertTokenDrill(page, {
                token: '--ui-line-strong', value: DRILL_COLOUR,
                selector: '#cols', property: 'background-color',
            });
        }));

        test('drill: --ui-fascia is the cell ground', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-fascia', value: DRILL_COLOUR,
                selector: '#zone-nav', property: 'background-color',
            });
        }));

        test('the weights land on the oracle values, in BOTH themes', () => mounted(async (page) => {
            for (const theme of ['dark', 'light']) {
                await page.setTheme(theme);
                const want = ORACLE[theme];
                assert.equal(await page.prop('#zone', 'background-color'), want.zoneSeam,
                    `--ui-zone-seam in ${theme}`);
                assert.equal(await page.prop('#rows', 'background-color'), want.line,
                    `--ui-line in ${theme}`);
                assert.equal(await page.prop('#cols', 'background-color'), want.lineStrong,
                    `--ui-line-strong in ${theme}`);
            }
        }));

        test('trap 1: unpainted cells make the box a slab, not a seam', () => mounted(async (page) => {
            const a = await page.prop('#hole-a', 'background-color');
            const b = await page.prop('#hole-b', 'background-color');
            assert.equal(a, 'rgba(0, 0, 0, 0)');
            assert.equal(b, 'rgba(0, 0, 0, 0)');
            near(inlineGap(await page.box('#hole-a'), await page.box('#hole-b')), SEAM_PX, 'the seam');
        }));

        test('trap 3: a nested seam grid keeps its own weight over the cell ground', () => mounted(async (page) => {
            const theme = await page.eval('document.documentElement.dataset.theme');
            assert.equal(await page.prop('#inner', 'background-color'), ORACLE[theme].line);
            assert.equal(await page.prop('#outer', 'background-color'), ORACLE[theme].lineStrong);
            near(blockGap(await page.box('#inner-a'), await page.box('#inner-b')), SEAM_PX,
                'the nested seam');
        }));

        test('adoptSeams works in a shadow root, and is idempotent', () => mounted(async (page) => {
            const sa = await page.box('#host >>> #s-a');
            const sb = await page.box('#host >>> #s-b');
            near(inlineGap(sa, sb), SEAM_PX, 'the seam inside a shadow root');

            const theme = await page.eval('document.documentElement.dataset.theme');
            assert.equal(await page.prop('#host >>> #s-zone', 'background-color'), ORACLE[theme].line);

            const state = JSON.parse(await page.evalFn(async () => {
                const m = await import('/src/components/seams.js');
                const b = await import('/src/components/base.js');
                const root = document.getElementById('host').shadowRoot;
                const before = root.adoptedStyleSheets.length;
                m.adoptSeams(root);
                m.adoptSeams(root);
                return JSON.stringify({
                    before,
                    after: root.adoptedStyleSheets.length,
                    adopted: b.hasAdoptedSheet(root, m.seamStyleSheet()),
                    sameObject: m.seamStyleSheet() === m.seamStyleSheet(),
                });
            }));
            assert.deepEqual(state, { before: 1, after: 1, adopted: true, sameObject: true });
        }));

        test('the utility defines no custom element — that is the row', () => mounted(async (page) => {
            const defined = await page.evalFn(async () => {
                await import('/src/components/seams.js');
                return ['ui-seam', 'ui-hairline', 'ui-separator', 'ui-divider']
                    .filter((tag) => customElements.get(tag) !== undefined);
            });
            assert.deepEqual(defined, []);
        }));
    });
}

/** Define the three probe elements in the page. Idempotent per page. */
const defineProbes = (page) => page.evalFn(async () => {
    if (customElements.get('seams-probe')) return 'already';
    const { css, html } = await import('lit');
    const { UiElement } = await import('/src/components/base.js');
    const { seams } = await import('/src/components/seams.js');

    const GRID = 'inline-size: 300px; block-size: 80px;'
        + ' grid-template-columns: 100px minmax(0, 1fr)';

    // (a) THE NORMAL PATH — the fragment first, own rules after.
    class SeamsProbe extends UiElement {
        static styles = [seams, css`.own { color: var(--ui-text); }`];
        render() {
            return html`<div id="grid" class="seam-grid seam-line" style="${GRID}">
                <div class="seam-cell" id="p-a"></div>
                <div class="seam-cell" id="p-b"></div>
            </div>`;
        }
    }
    customElements.define('seams-probe', SeamsProbe);

    class SeamsHostProbe extends UiElement {
        static styles = [seams, css`.own { color: var(--ui-text); }`];
        connectedCallback() {
            super.connectedCallback();
            this.classList.add('seam-grid', 'seam-strong');
        }
        render() {
            return html`<div class="seam-cell" id="h-a"></div>
                <div class="seam-cell" id="h-b"></div>`;
        }
    }
    customElements.define('seams-host-probe', SeamsHostProbe);

    class SeamsFlexProbe extends UiElement {
        static styles = [seams, css`:host { display: flex; }`];
        connectedCallback() {
            super.connectedCallback();
            this.classList.add('seam-grid', 'seam-line');
        }
        render() {
            return html`<div class="seam-cell" id="f-a"></div>
                <div class="seam-cell" id="f-b"></div>`;
        }
    }
    customElements.define('seams-flex-probe', SeamsFlexProbe);

    return 'defined';
});

describe('the fragment inside a real component', () => {
    const mountedComponents = (fn) => browser.withPage({ geometry: BENCH }, async (page) => {
        assert.equal(await defineProbes(page), 'defined');
        await page.mount(COMPONENT_MARKUP, []);
        await page.evalFn(() => Promise.all(
            ['#inside', '#on-host', '#flex-host']
                .map((s) => document.querySelector(s).updateComplete),
        ).then(() => true));
        await page.settle(2);
        assert.deepEqual(page.pageErrors, [], 'the probes must upgrade without throwing');
        return fn(page);
    });

    test('static styles = [seams, css`…`] seams the component\'s OWN descendants',
        () => mountedComponents(async (page) => {
            const got = await page.computed('#inside >>> #grid', ['display', 'column-gap', 'row-gap']);
            assert.deepEqual(got, { display: 'grid', 'column-gap': '1px', 'row-gap': '1px' });

            const theme = await page.eval('document.documentElement.dataset.theme');
            assert.equal(await page.prop('#inside >>> #grid', 'background-color'),
                ORACLE[theme].line);

            const a = await page.box('#inside >>> #p-a');
            const b = await page.box('#inside >>> #p-b');
            near(inlineGap(a, b), SEAM_PX, 'the seam inside a component');
        }));

    test('fragment ORDER: base first, seams second, own rules last', () => mountedComponents(async (page) => {
        const order = JSON.parse(await page.evalFn(async () => {
            const { UiElement } = await import('/src/components/base.js');
            const { seams } = await import('/src/components/seams.js');
            const styles = customElements.get('seams-probe').elementStyles;
            return JSON.stringify({
                count: styles.length,
                base: styles.indexOf(UiElement.baseStyles),
                seams: styles.indexOf(seams),
            });
        }));
        assert.deepEqual(order, { count: 3, base: 0, seams: 1 });
    }));

    test(':host(.seam-grid) — the component that IS the seamed grid', () => mountedComponents(async (page) => {
        const got = await page.computed('#on-host', ['display', 'column-gap', 'row-gap']);
        assert.deepEqual(got, { display: 'grid', 'column-gap': '1px', 'row-gap': '1px' });

        const theme = await page.eval('document.documentElement.dataset.theme');
        assert.equal(await page.prop('#on-host', 'background-color'), ORACLE[theme].lineStrong,
            ':host(.seam-grid.seam-strong) must carry the weight');

        // And the seam really is laid out between the two cells of that host grid.
        const a = await page.box('#on-host >>> #h-a');
        const b = await page.box('#on-host >>> #h-b');
        near(blockGap(a, b), SEAM_PX, 'the seam on a host grid');
    }));

    test(':host(.seam-grid) is (0,2,0), so a bare :host rule written later does not beat it',
        () => mountedComponents(async (page) => {
            const got = await page.computed('#flex-host', ['display', 'column-gap']);
            assert.deepEqual(got, { display: 'grid', 'column-gap': '1px' });
            const theme = await page.eval('document.documentElement.dataset.theme');
            assert.equal(await page.prop('#flex-host', 'background-color'), ORACLE[theme].line);
        }));
});

describe('the gallery entry renders what it claims', () => {
    test('every state mounts, and every seam grid in it paints a ground and a hairline gap',
        () => browser.withPage({ geometry: BENCH }, async (page) => {
            for (const state of galleryEntry.states) {
                await page.mount(state.html, ['/tools/gallery/entries/seams.demo.js']);
                assert.deepEqual(page.pageErrors, [], `state ${state.id} threw on mount`);

                const grids = await page.evalFn(() => [...document.querySelectorAll('.seam-grid')]
                    .map((el) => {
                        const cs = getComputedStyle(el);
                        return {
                            display: cs.display,
                            ground: cs.backgroundColor,
                            gap: `${cs.columnGap} ${cs.rowGap}`,
                        };
                    }));

                assert.ok(grids.length > 0, `state ${state.id} contains no seam grid`);
                for (const [i, g] of grids.entries()) {
                    assert.equal(g.display, 'grid', `${state.id}[${i}] is not a grid`);
                    assert.notEqual(g.ground, 'rgba(0, 0, 0, 0)',
                        `${state.id}[${i}] has no ground, so its gaps show whatever is behind`);
                    assert.match(g.gap, /(^|\s)1px(\s|$)/,
                        `${state.id}[${i}] gap is ${g.gap}, not a hairline on either axis`);
                }
            }
        }));
});

describe('seam utility across geometries', () => {
    test('the seam is one CSS px at dsf 1 and at dsf 1.5', () => {
        assert.deepEqual(Object.keys(acrossGeometries).sort(), ['bench', 'floor']);
        for (const [name, got] of Object.entries(acrossGeometries)) {
            near(got.columnSeam, SEAM_PX, `${name}: the column seam`);
            near(got.rowSeam, SEAM_PX, `${name}: the row seam`);
        }
    });
});
