/**
 *.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES, BENCH, FLOOR } from '../harness/index.js';
import { entry as galleryEntry } from '../../tools/gallery/entries/ui-status-chip.entry.js';
import {
    assertTokenDrill,
    assertFocusUnclipped,
    DRILL_COLOUR,
    DRILL_LENGTH,
} from '../harness/assertions.js';

const MODULE = ['/src/components/ui-status-chip.js'];

const READY = '<ui-status-chip id="ready">Ready</ui-status-chip>';
const DISCONNECTED = '<ui-status-chip id="off">Disconnected</ui-status-chip>';
const LIVE = '<ui-status-chip id="live" live>Live</ui-status-chip>';
const MARKUP = `${READY} ${DISCONNECTED} ${LIVE}`;

/** Rendered lengths at dsf 1.5 are not string-comparable; whole CSS px are. */
const near = (got, want, what, tol = 0.51) => assert.ok(
    Math.abs(got - want) <= tol,
    `${what}: expected ${want}, got ${got}`,
);

async function reduceMotion(page) {
    await page.send('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
    });
    await page.settle(1);
}

const CLASS_AUDIT = `(() => {
    const hosts = Array.from(document.querySelectorAll('ui-status-chip'));
    const root = hosts[0].shadowRoot;
    const sheets = Array.from(root.adoptedStyleSheets);
    const own = sheets.filter((s) => Array.from(s.cssRules)
        .some((r) => (r.cssText || '').indexOf('ui-status-chip-pulse') !== -1));
    const selectorTexts = [];
    const declares = {};
    const walk = (rules) => {
        for (const r of rules) {
            if (typeof r.selectorText === 'string' && r.style) {
                selectorTexts.push(r.selectorText);
                for (const prop of r.style) {
                    declares[prop] = (declares[prop] || 0) + 1;
                }
            }
            if (r.cssRules && !(r.name)) walk(r.cssRules);
        }
    };
    for (const s of own) walk(s.cssRules);

    const classes = new Set();
    for (const sel of selectorTexts) {
        const m = sel.match(/\\.[A-Za-z_-][A-Za-z0-9_-]*/g) || [];
        for (const c of m) classes.add(c.slice(1));
    }
    const carried = [];
    const orphaned = [];
    for (const c of classes) {
        const hit = hosts.some((h) => h.shadowRoot.querySelector('.' + c) !== null);
        (hit ? carried : orphaned).push(c);
    }
    return JSON.stringify({
        sheets: sheets.length,
        ownSheets: own.length,
        selectors: selectorTexts.length,
        classes: Array.from(classes).sort(),
        carried: carried.sort(),
        orphaned: orphaned.sort(),
        declares,
    });
})()`;

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`ui-status-chip @ ${geometry.name} (${geometry.width}×${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

        const mounted = (fn, markup = MARKUP) => browser.withPage({ geometry }, async (page) => {
            await reduceMotion(page);
            await page.mount(markup, MODULE);
            assert.deepEqual(page.pageErrors, [], 'the component must mount without throwing');
            return fn(page);
        });

        /** Real animation, no emulation — only the two motion tests want this. */
        const animated = (fn, markup = MARKUP) => browser.withPage({ geometry }, async (page) => {
            await page.mount(markup, MODULE);
            assert.deepEqual(page.pageErrors, []);
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

        test('L13 cannot express: every class this component styles is carried by a node',
            () => mounted(async (page) => {
                const a = JSON.parse(await page.eval(CLASS_AUDIT));

                assert.equal(a.ownSheets, 1,
                    'the audit must find exactly one sheet of this component\'s own; ' +
                    `saw ${a.ownSheets} of ${a.sheets} adopted`);
                assert.ok(a.classes.length >= 3,
                    `expected the chip, label and dot classes at least; saw ${JSON.stringify(a.classes)}`);
                assert.deepEqual(a.orphaned, [],
                    'L13 (spec §7.2, slate-live.css:1738-1745): ' +
                    `${JSON.stringify(a.orphaned)} is styled here and carried by no element. ` +
                    'That is the defect verbatim — prov_query.py find --cls slate-chart-state ' +
                    'returned "0 elements matched anywhere in this corpus" across all 49 states.');
                assert.deepEqual(a.carried.slice().sort(), a.classes.slice().sort());
            }));

        test('L13 cannot express: the chip\'s type is declared once, not twice',
            () => mounted(async (page) => {
                const a = JSON.parse(await page.eval(CLASS_AUDIT));
                for (const prop of ['font-size', 'font-weight', 'letter-spacing',
                    'line-height', 'text-transform']) {
                    assert.equal(a.declares[prop], 1,
                        `${prop} is declared ${a.declares[prop]} times in this component; ` +
                        'one job, one rule (L13).');
                }
            }));

        test('L13 cannot express: the dot is absent, not merely unpainted, when not live',
            () => mounted(async (page) => {
                assert.equal(await page.count('#ready >>> .dot'), 0,
                    'a resting chip must render no dot node at all');
                assert.equal(await page.count('#live >>> .dot'), 1,
                    'a live chip renders exactly one dot');
                assert.equal(await page.prop('#live >>> .dot', 'content', { pseudo: '::before' }), 'none',
                    'the dot is a real element; nothing here leans on a generated box');
            }));

        test('the resting chip is the oracle\'s: muted ink, 18px, uppercase',
            () => mounted(async (page) => {
                const got = await page.computed('#ready >>> .chip',
                    ['color', 'font-size', 'text-transform', 'letter-spacing', 'font-weight']);

                assert.equal(got.color, await page.resolveToken('--ui-muted', 'color'),
                    'the ink is --ui-muted, so it is right in both themes by construction');

                assert.equal(got['font-size'], await page.resolveToken('--ui-text-md', 'font-size'));
                near(parseFloat(got['font-size']), 18, 'font-size is the oracle\'s 18px');

                assert.equal(got['text-transform'], 'uppercase');

                near(parseFloat(got['letter-spacing']),
                    0.12 * parseFloat(got['font-size']),
                    'tracking is --ui-tracking-cap (.12em) against the rendered 18px');
                near(parseFloat(got['letter-spacing']), 2.16, 'which is 2.16px');

                assert.equal(got['font-weight'], '600');
                assert.equal(got['font-weight'], await page.resolveToken('--ui-weight-semibold', 'font-weight'));
            }));

        test('the chip\'s line box is the oracle\'s 21.5938px, in both themes',
            () => mounted(async (page) => {
                const ORACLE_HEIGHT = 21.5938;
                for (const theme of ['dark', 'light']) {
                    await page.setTheme(theme);
                    near((await page.box('#ready >>> .chip')).height, ORACLE_HEIGHT,
                        `${theme}: the chip's line box`, 0.05);
                    near((await page.box('#ready')).height, ORACLE_HEIGHT,
                        `${theme}: the host is exactly its chip`, 0.05);
                }
                await page.setTheme('dark');

                const cs = await page.computed('#ready >>> .chip', ['line-height', 'font-size']);
                assert.notEqual(cs['line-height'], 'normal',
                    'the leading is declared here, or Slate\'s frozen height is not reproduced');
                near(parseFloat(cs['line-height']), 1.2 * parseFloat(cs['font-size']),
                    'slate-live.css:912 line-height: 1.2 on the oracle\'s 18px', 0.05);

                /* The live chip is the same box: the 10px dot is shorter than the line
                   box and flex-centred, so the pulse must not move the header band. */
                near((await page.box('#live')).height, ORACLE_HEIGHT,
                    'the pulse does not change the chip\'s height', 0.05);
            }));

        test('the chip is not a pill: every decoration the oracle measures is zero',
            () => mounted(async (page) => {
                const got = await page.computed('#ready >>> .chip', [
                    'background-color', 'box-shadow',
                    'border-top-width', 'border-top-left-radius',
                    'padding-left', 'padding-top',
                ]);
                assert.deepEqual(got, {
                    'background-color': 'rgba(0, 0, 0, 0)',
                    'box-shadow': 'none',
                    'border-top-width': '0px',
                    'border-top-left-radius': '0px',
                    'padding-left': '0px',
                    'padding-top': '0px',
                });
            }));

        test('the dot is Slate\'s: 10px, pill, --ui-status-danger, --ui-space-2 away',
            () => mounted(async (page) => {
                const dot = await page.box('#live >>> .dot');
                near(dot.width, 10, 'dot inline size');
                near(dot.height, 10, 'dot block size');
                assert.equal(dot.width, dot.height, 'the dot is square, so the pill radius is a circle');

                const style = await page.computed('#live >>> .dot', ['background-color', 'border-top-left-radius']);
                assert.equal(style['background-color'],
                    await page.resolveToken('--ui-status-danger', 'background-color'),
                    'slate-live.css:1839 background: var(--slate-danger) -> --ui-status-danger');
                assert.ok(parseFloat(style['border-top-left-radius']) >= dot.width / 2 - 0.51,
                    'spec §3.4: any radius >= half the height is the same circle; ' +
                    `got ${style['border-top-left-radius']} on a ${dot.width}px box`);

                const gap = await page.prop('#live >>> .chip', 'column-gap');
                assert.equal(gap, await page.resolveToken('--ui-space-2', 'column-gap'));
                near(parseFloat(gap), 8, 'slate-live.css:1837 margin-right: var(--slate-space-2) = 8px');

                const label = await page.box('#live >>> .label');
                assert.ok(dot.left < label.left, 'the dot leads the words');
            }));

        test('token drill: --ui-muted moves the ink', () => mounted((page) => assertTokenDrill(page, {
            token: '--ui-muted', value: DRILL_COLOUR,
            selector: '#ready >>> .chip', property: 'color',
        })));

        test('token drill: --ui-text-md moves the type size', () => mounted((page) => assertTokenDrill(page, {
            token: '--ui-text-md', value: DRILL_LENGTH,
            selector: '#ready >>> .chip', property: 'font-size',
        })));

        test('token drill: --ui-tracking-cap moves the tracking', () => mounted((page) => assertTokenDrill(page, {
            token: '--ui-tracking-cap', value: DRILL_LENGTH,
            selector: '#ready >>> .chip', property: 'letter-spacing',
        })));

        test('token drill: --ui-weight-semibold moves the weight', () => mounted((page) => assertTokenDrill(page, {
            token: '--ui-weight-semibold', value: '250',
            selector: '#ready >>> .chip', property: 'font-weight',
        })));

        test('token drill: --ui-space-2 moves the dot-to-word gap', () => mounted((page) => assertTokenDrill(page, {
            token: '--ui-space-2', value: DRILL_LENGTH,
            selector: '#live >>> .chip', property: 'column-gap',
        })));

        test('token drill: --ui-status-danger moves the pulse ink', () => mounted((page) => assertTokenDrill(page, {
            token: '--ui-status-danger', value: DRILL_COLOUR,
            selector: '#live >>> .dot', property: 'background-color',
        })));

        test('token drill: --ui-radius-pill moves the dot\'s corner', () => mounted((page) => assertTokenDrill(page, {
            token: '--ui-radius-pill', value: '2px',
            selector: '#live >>> .dot', property: 'border-top-left-radius',
        })));

        test('the private geometry is a --_ui- knob, not a token and not a literal',
            () => mounted(async (page) => {
                await page.setStyle('#live', { '--_ui-dot-size': '18px' });
                const grown = await page.box('#live >>> .dot');
                near(grown.width, 18, 'an outside rule retunes --_ui-dot-size');
                await page.setStyle('#live', { '--_ui-dot-size': '' });
                near((await page.box('#live >>> .dot')).width, 10, 'and it goes back to 10px');
            }));

        test('the ring is --ui-focus-* and nothing here clips it', () => mounted(async (page) => {
            await assertFocusUnclipped(page, '#focusable');
        }, `<ui-status-chip id="focusable" tabindex="0" live>Live</ui-status-chip>`));

        test('the ring is the outset offset: nothing here is an overflow: hidden band',
            () => mounted(async (page) => {
                await page.focusVisible('#focusable');
                const g = await page.focusGeometry('#focusable');
                assert.ok(g.focusVisible, 'the host takes focus when a screen gives it a tabindex');
                assert.equal(g.outlineOffset, await page.resolveValue('var(--ui-focus-offset)', 'outline-offset'),
                    'no reason for the inset variant: this component clips nothing');
            }, `<ui-status-chip id="focusable" tabindex="0">Ready</ui-status-chip>`));

        test('the host shrinks to its words rather than filling its slot',
            () => mounted(async (page) => {
                await page.setStyle('#mount', { 'inline-size': '600px' });
                const mount = await page.box('#mount');
                const host = await page.box('#ready');
                assert.ok(host.width < mount.width - 100,
                    'CONVENTIONS §2: container-type: normal, because a chip that must ' +
                    `shrink to fit its glyph cannot be size-contained. host ${host.width} ` +
                    `in ${mount.width}`);
                const chip = await page.box('#ready >>> .chip');
                near(chip.width, host.width, 'the host is exactly its chip');
            }));

        test('at a narrow container the words wrap and nothing overflows',
            () => mounted(async (page) => {
                await page.setStyle('#mount', { 'inline-size': '120px' });
                const wide = await page.box('#off');

                const host = await page.box('#off');
                const m = await page.metrics('#mount');
                assert.ok(host.width <= m.clientWidth + 0.51,
                    'DEPARTURE 3: max-inline-size: 100% — the chip may become taller, ' +
                    `never wider than what holds it. host ${host.width} in ${m.clientWidth}`);
                assert.ok(m.scrollWidth <= m.clientWidth + 0.51,
                    `nothing spills sideways: scrollWidth ${m.scrollWidth} vs clientWidth ${m.clientWidth}`);
                assert.ok(host.height > 24,
                    'the word wrapped rather than being clipped — §2.4 removes the ' +
                    `inherited hidden default. height ${host.height}`);
                assert.ok(wide, 'read taken');
            }));

        test('the dot never shrinks and never wraps away from the words',
            () => mounted(async (page) => {
                await page.setStyle('#mount', { 'inline-size': '90px' });
                const dot = await page.box('#live >>> .dot');
                near(dot.width, 10, 'flex: none — the dot is not words');
                near(dot.height, 10, 'flex: none, both axes');
                const label = await page.box('#live >>> .label');
                assert.ok(dot.top < label.bottom && dot.bottom > label.top,
                    'the dot stays on the first line beside the first word');
            }));

        test('no width media query anywhere: the chip is identical at both geometries',
            () => mounted(async (page) => {
                await page.setStyle('#mount', { 'inline-size': '400px' });
                const host = await page.box('#ready');
                assert.ok(host.width > 0 && host.width < 400);
                const cs = await page.prop('#ready', 'container-type');
                assert.equal(cs, 'normal', 'the documented one-line opt-out, CONVENTIONS §2');
            }));

        test('the host is a polite live region, and the dot is not announced',
            () => mounted(async (page) => {
                assert.equal(await page.prop('#ready', 'display'), 'inline-flex');
                const roles = JSON.parse(await page.eval(`JSON.stringify({
                    ready: document.getElementById('ready').getAttribute('role'),
                    live: document.getElementById('live').getAttribute('role'),
                    dot: document.getElementById('live').shadowRoot.querySelector('.dot').getAttribute('aria-hidden'),
                })`));
                assert.equal(roles.ready, 'status');
                assert.equal(roles.live, 'status');
                assert.equal(roles.dot, 'true', 'the pulse is decoration; the words carry the meaning');
            }));

        test('an author-chosen role is left alone', () => mounted(async (page) => {
            const role = await page.eval(
                'document.getElementById("quiet").getAttribute("role")',
            );
            assert.equal(role, 'presentation',
                'a chip beside a heading that already announces should stay silent');
        }, '<ui-status-chip id="quiet" role="presentation">Ready</ui-status-chip>'));

        test('the live flag reflects, so a screen can lay it out from outside',
            () => mounted(async (page) => {
                const state = JSON.parse(await page.eval(`(() => {
                    const el = document.getElementById('ready');
                    const before = el.hasAttribute('live');
                    el.live = true;
                    return el.updateComplete.then(() => JSON.stringify({
                        before,
                        after: el.hasAttribute('live'),
                        dots: el.shadowRoot.querySelectorAll('.dot').length,
                    }));
                })()`));
                assert.deepEqual(state, { before: false, after: true, dots: 1 });
            }));

        test('the pulse is Slate\'s 1.6s ease-in-out breathe', () => animated(async (page) => {
            const got = await page.computed('#live >>> .dot',
                ['animation-name', 'animation-duration', 'animation-timing-function', 'animation-iteration-count']);
            assert.equal(got['animation-name'], 'ui-status-chip-pulse');
            assert.equal(got['animation-duration'], '1.6s');
            assert.equal(got['animation-timing-function'], 'ease-in-out');
            assert.equal(got['animation-iteration-count'], 'infinite');
        }));

        test('reduced motion stops the pulse and keeps the dot', () => browser.withPage({ geometry }, async (page) => {
            await reduceMotion(page);
            await page.mount(MARKUP, MODULE);
            assert.equal(await page.prop('#live >>> .dot', 'animation-name'), 'none');
            const dot = await page.box('#live >>> .dot');
            near(dot.width, 10, 'the dot stays: it is the only mark that says a shot is happening');
            assert.equal(await page.prop('#live >>> .dot', 'opacity'), '1');
        }));

        test('every gallery state mounts and renders a chip', () => browser.withPage({ geometry }, async (page) => {
            await reduceMotion(page);
            for (const state of galleryEntry.states) {
                await page.mount(state.html, MODULE);
                assert.deepEqual(page.pageErrors, [], `gallery state ui-status-chip--${state.id} threw`);
                assert.ok(await page.count('ui-status-chip') >= 1,
                    `gallery state ui-status-chip--${state.id} mounted nothing`);
                assert.ok(await page.exists('ui-status-chip >>> .chip'),
                    `gallery state ui-status-chip--${state.id} rendered no chip`);
            }
        }));
    });
}

test('the gallery entry is the documented shape', () => {
    assert.equal(galleryEntry.id, 'ui-status-chip', 'the entry id is the tag name and the capture prefix');
    assert.equal(galleryEntry.module, '../../src/components/ui-status-chip.js',
        'module is relative to tools/gallery/');
    assert.ok(galleryEntry.title && galleryEntry.notes);
    assert.ok(galleryEntry.states.length >= 1);
    const ids = galleryEntry.states.map((s) => s.id);
    assert.equal(new Set(ids).size, ids.length, 'state ids are capture filenames, so they must be unique');
    for (const s of galleryEntry.states) {
        assert.match(s.id, /^[a-z0-9-]+$/, `state id ${s.id} must be a kebab-case identifier, not a label`);
        assert.ok(s.title && s.html, `state ${s.id} needs a title and markup`);
    }
});

test('the chip renders identically at the bench and at the floor', async () => {
    const read = (geometry) => browser.withPage({ geometry }, async (page) => {
        await reduceMotion(page);
        await page.mount(MARKUP, MODULE);
        await page.setStyle('#mount', { 'inline-size': '400px' });
        const host = await page.box('#ready');
        const dot = await page.box('#live >>> .dot');
        const type = await page.computed('#ready >>> .chip', ['font-size', 'letter-spacing', 'font-weight']);
        return {
            dpr: await page.eval('devicePixelRatio'),
            width: Math.round(host.width * 100) / 100,
            height: Math.round(host.height * 100) / 100,
            dot: [dot.width, dot.height],
            type,
        };
    });

    const bench = await read(BENCH);
    const floor = await read(FLOOR);

    assert.equal(bench.dpr, 1.5);
    assert.equal(floor.dpr, 1);
    assert.deepEqual(
        [bench.width, bench.height, bench.dot, bench.type],
        [floor.width, floor.height, floor.dot, floor.type],
        'no viewport reading anywhere: 1281×801 @ 1.5 and 1000×600 @ 1 give the same chip',
    );
    assert.deepEqual(bench.dot, [10, 10]);
    assert.equal(bench.type['font-size'], '18px', 'the oracle\'s 18px at both geometries');
});
