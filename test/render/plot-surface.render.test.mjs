/**
 * GATE 5's executing test.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';
import { assertTokenDrill, DRILL_COLOUR } from '../harness/assertions.js';

const MODULE = ['/tools/fixtures/plot-surface-fixture.js'];

/** A stage with a real size: uPlot sizes from clientWidth/clientHeight. */
const stage = (tag = 'plot-fixture', id = 'p') => `
<div id="stage" style="inline-size: 760px; block-size: 300px; margin: 30px">
  <${tag} id="${id}" style="display: block; block-size: 300px"></${tag}>
</div>`;

const near = (got, want, what, tol = 1.01) => assert.ok(
    Math.abs(got - want) <= tol,
    `${what}: expected ${want}, got ${got}`,
);

/** The whole mount, in one round trip. */
const report = (page, id = 'p') => page.evalFn((s) => window.__h.need(s).report(), `#${id}`);

/** Load channels + records the way a chart card does, and draw synchronously. */
const load = (page, id = 'p') => page.evalFn((s) => window.__h.need(s).load(), `#${id}`);

/**
 * Deep hit test: `document.elementFromPoint` stops at a shadow host, so it is walked
 * down. Returned as `tag.class` because that is what an assertion can read.
 */
const HIT_FN = `(x, y) => {
    let el = document.elementFromPoint(x, y);
    while (el && el.shadowRoot) {
        const inner = el.shadowRoot.elementFromPoint(x, y);
        if (!inner || inner === el) break;
        el = inner;
    }
    if (!el) return 'nothing';
    const cls = typeof el.className === 'string' ? el.className.trim() : '';
    return el.tagName.toLowerCase() + (cls ? '.' + cls.split(/\\s+/).join('.') : '');
}`;

/** What is really under a viewport coordinate, through every shadow root. */
const hitAt = (page, x, y) => page.eval(`(${HIT_FN})(${x}, ${y})`);

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`plot-surface @ ${geometry.name} (${geometry.width}×${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

        const mounted = (fn, markup = stage()) => browser.withPage({ geometry }, async (page) => {
            await page.mount(markup, MODULE);
            assert.deepEqual(page.pageErrors, [], 'the fixture must mount without throwing');
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

        test('the vendor sheet is adopted into this shadow root before the plot exists', () => mounted(async (page) => {
            const ready = await page.evalFn(async (s) => window.__h.need(s).ready, '#p');
            assert.equal(ready, true, 'the mount must complete');

            const got = await report(page);
            assert.equal(got.sheetAdopted, true,
                'Part 8 §3 Rule 1: uPlot.min.css must be in this root\'s adoptedStyleSheets, '
                + 'never a document <link> — a shadow root does not see one');

            await load(page);
            const after = await report(page);
            assert.equal(after.hasPlot, true, 'and a plot must exist once there are channels');
            assert.equal(after.buildCount, 1, 'built exactly once for one set of channels');
        }));

        test('the canvas lays out at its CSS size, not at round(css × pxRatio)', () => mounted(async (page) => {
            await page.evalFn(async (s) => window.__h.need(s).ready, '#p');
            await load(page);

            const host = await page.box('#p >>> .plot');
            const canvas = await page.box('#p >>> canvas');
            const attrs = await page.evalFn((s) => {
                const c = window.__h.q(s);
                return { w: c.width, h: c.height };
            }, '#p >>> canvas');

            near(canvas.width, host.width, 'the canvas must not overflow its host', 1.5);
            assert.ok(canvas.right <= host.right + 1.5,
                `the canvas overflows the plot host by ${canvas.right - host.right}px — `
                + 'that is the mount-C signature (450px at the bench dpr), and it is invisible '
                + 'to a screenshot because the pixels are identical');
            near(attrs.w, host.width * geometry.deviceScaleFactor,
                'the ATTRIBUTE size is the backing store, and it is css × this plot\'s ratio', 2);
        }));

        const cssOverAsked = async (page, id) => {
            const host = await page.box(`#${id} >>> .plot`);
            const canvas = await page.box(`#${id} >>> canvas`);
            return {
                asked: host.width,
                got: canvas.width,
                ratio: canvas.width / host.width,
                overflowRight: canvas.right - host.right,
            };
        };

        test('MOUNT SIGNATURE: cssOverAsked is 1.0 with the sheet, the pixel ratio without it', () => {
            return browser.withPage({ geometry }, async (page) => {
                await page.mount(`${stage('plot-fixture', 'p')}${stage('plot-fixture-canary', 'c')}`, MODULE);
                await page.evalFn(async (s) => window.__h.need(s).ready, '#p');
                await page.evalFn(async (s) => window.__h.need(s).ready, '#c');
                await load(page, 'p');
                await load(page, 'c');

                const dsf = geometry.deviceScaleFactor;
                const healthy = await cssOverAsked(page, 'p');
                near(healthy.ratio, 1, 'healthy cssOverAsked', 0.01);
                near(healthy.overflowRight, 0, 'a healthy canvas overflows its host by 0 px', 1.5);

                const canary = await cssOverAsked(page, 'c');
                near(canary.ratio, dsf,
                    `the unsheeted canvas lays out at round(css × pxRatio), so its cssOverAsked `
                    + `is this page's device pixel ratio (${dsf})`, 0.01);
                if (dsf > 1) {
                    near(canary.overflowRight, healthy.asked * (dsf - 1),
                        'and it overflows the card by exactly (ratio − 1) × the asked width', 2);
                } else {
                    near(canary.ratio, healthy.ratio,
                        'AT dsf 1 cssOverAsked DOES NOT DISCRIMINATE — both are 1.0, and '
                        + '.u-cursor-x is the discriminator that works at both ratios', 0.01);
                }
            });
        });

        test('THE CANARY FIRES: an unsheeted root reproduces the mount-C signature', () => {
            return browser.withPage({ geometry }, async (page) => {
                await page.mount(stage('plot-fixture-canary', 'c'), MODULE);
                const ready = await page.evalFn(async (s) => window.__h.need(s).ready, '#c');
                assert.equal(ready, true, 'the canary still mounts — that is what makes it dangerous');

                const got = await report(page, 'c');
                assert.equal(got.sheetAdopted, false, 'the canary declines the sheet on purpose');
                await load(page, 'c');

                const host = await page.box('#c >>> .plot');
                const canvas = await page.box('#c >>> canvas');
                if (geometry.deviceScaleFactor > 1) {
                    assert.ok(canvas.width > host.width + 10,
                        'without the sheet the canvas lays out at its attribute size and overflows: '
                        + `expected > ${host.width}, got ${canvas.width}. If this fails the geometry `
                        + 'assertion above has stopped discriminating and Rule 1 is unguarded.');
                    near(canvas.width, host.width * geometry.deviceScaleFactor,
                        'and it overflows by exactly the pixel ratio', 2);
                } else {
                    near(canvas.width, host.width,
                        'at dsf 1 the geometry cannot discriminate — .u-cursor-x is what does', 2);
                }
            });
        });

        test('.u-cursor-x is positioned when the sheet is there and dead when it is not', () => {
            return browser.withPage({ geometry }, async (page) => {
                await page.mount(
                    `${stage('plot-fixture-cursor', 'ok')}${stage('plot-fixture-cursor-canary', 'bad')}`,
                    MODULE,
                );
                await page.evalFn(async (s) => window.__h.need(s).ready, '#ok');
                await page.evalFn(async (s) => window.__h.need(s).ready, '#bad');
                await load(page, 'ok');
                await load(page, 'bad');
                await page.settle(2);

                const healthy = await page.computed('#ok >>> .u-cursor-x', ['position', 'height']);
                assert.equal(healthy.position, 'absolute',
                    'the vendor sheet positions the cursor line; static is the mount-C reading');
                assert.ok(Number.parseFloat(healthy.height) > 0,
                    `the cursor line must have height, got ${healthy.height}`);

                const dead = await page.computed('#bad >>> .u-cursor-x', ['position', 'height']);
                assert.equal(dead.position, 'static',
                    'THE CANARY: without the sheet the cursor line is static — this is the '
                    + 'discriminator that works at BOTH device pixel ratios');
                assert.equal(Number.parseFloat(dead.height), 0, 'and has no height');
            });
        });

        test('a pointer sweep across the plot is live — on the healthy chart AND the canary', () => {
            return browser.withPage({ geometry }, async (page) => {
                await page.mount(`${stage('plot-fixture', 'p')}${stage('plot-fixture-canary', 'c')}`, MODULE);
                await page.evalFn(async (s) => window.__h.need(s).ready, '#p');
                await page.evalFn(async (s) => window.__h.need(s).ready, '#c');
                await load(page, 'p');
                await load(page, 'c');

                for (const id of ['p', 'c']) {
                    const host = await page.box(`#${id} >>> .plot`);
                    const hits = [];
                    for (let i = 1; i <= 7; i += 1) {
                        const x = host.left + (host.width * i) / 8;
                        const y = host.top + host.height / 2;
                        await page.mouse('mouseMoved', x, y);
                        hits.push(await hitAt(page, x, y));
                    }
                    await page.settle(1);
                    const seen = await report(page, id);
                    assert.ok(hits.every((h) => h.includes('canvas') || h.includes('u-')),
                        `${id}: every swept point must land inside the plot, got ${JSON.stringify(hits)}`);
                    assert.ok(seen.pointerHits >= 7,
                        `${id}: the plot host saw ${seen.pointerHits} pointer events for 7 real CDP moves — `
                        + 'the wave-0a "dead to input" reading was RETRACTED as a hit-test artifact and '
                        + 'this assertion is what keeps it retracted');
                }
            });
        });

        test('COORDINATE RE-VERIFY: uPlot\'s cursor maps pointer x to value and index, identically at both ratios', () => {
            return browser.withPage({ geometry }, async (page) => {
                await page.mount(stage('plot-fixture-cursor', 'ok'), MODULE);
                await page.evalFn(async (s) => window.__h.need(s).ready, '#ok');
                await load(page, 'ok');
                await page.settle(2);

                const host = await page.box('#ok >>> .plot');
                const rows = [];
                for (let i = 1; i <= 5; i += 1) {
                    const x = host.left + (host.width * i) / 6;
                    const y = host.top + host.height / 2;
                    await page.mouse('mouseMoved', x, y);
                    await page.settle(1);
                    rows.push({ x, ...await page.evalFn((s) => window.__h.need(s).cursorReport(), '#ok') });
                }

                /* The x scale is [0, 30] over 60 samples — makeRecords()'s own shape. */
                const SPAN = 30;
                const STEP = SPAN / 59;
                for (const row of rows) {
                    near(row.left, row.x - row.overLeft,
                        `cursor.left must be the pointer's x inside .u-over, not a rect/clientWidth `
                        + `hybrid: pointer ${row.x}, over.left ${row.overLeft}, cursor.left ${row.left}`, 1.5);
                    near(row.val, (row.left / row.overWidth) * SPAN,
                        `posToVal must be linear in cursor.left over a ${SPAN}s axis: ${JSON.stringify(row)}`, 0.05);
                    near(row.idx, row.val / STEP,
                        `cursor.idx must be the nearest sample to that value: ${JSON.stringify(row)}`, 0.75);
                }

                const lefts = rows.map((r) => r.left);
                assert.deepEqual([...lefts].sort((a, b) => a - b), lefts, 'and it is monotonic across the sweep');
                const gaps = lefts.slice(1).map((v, i) => v - lefts[i]);
                near(Math.max(...gaps) - Math.min(...gaps), 0,
                    `evenly spaced pointer moves must give evenly spaced cursor positions, got ${JSON.stringify(gaps)}`,
                    1.5);

                assert.deepEqual(rows.map((r) => Math.round(r.left)), [56, 183, 310, 436, 563],
                    'the CSS-space cursor positions do not move with the device pixel ratio');
                assert.deepEqual(rows.map((r) => r.idx), [5, 17, 29, 41, 53],
                    'and neither does the sample the cursor lands on');
                assert.deepEqual(page.pageErrors, []);
            });
        });

        test('the axis family is registered, measured against a family nothing can resolve', () => mounted(async (page) => {
            await page.evalFn(async (s) => window.__h.need(s).ready, '#p');
            const probe = await page.evalFn((s) => window.__h.need(s).axisFontProbe(), '#p');

            assert.ok(probe.faceCount > 0, 'the document must have registered at least one face');
            assert.notEqual(probe.width, probe.fallbackWidth,
                'the measured width equals the bogus family\'s — the face did not register. '
                + 'That is what an @font-face declared inside a shadow root does, silently: '
                + 'canvas resolves ctx.font against the DOCUMENT registry (Part 8 §3 Rule 2)');
            assert.equal(probe.registered, true);
            assert.match(probe.font, /^\d+px /, 'the shorthand is CSS px; the caller multiplies by its own ratio');
        }));

        test('RULE 2 GATE: the face is LOADED before the first paint, so check() is true and the chain paints in it', () => mounted(async (page) => {
            await page.evalFn(async (s) => window.__h.need(s).ready, '#p');
            const probe = await page.evalFn((s) => window.__h.need(s).axisFontProbe(), '#p');

            assert.equal(probe.check, true,
                'document.fonts.check() on the chain — #9\'s row names it, and it is only an '
                + 'assertion at all because fontsReady() loads the face rather than waiting for '
                + `something to load it. Got ${JSON.stringify(probe)}`);
            assert.equal(probe.checkPrimary, true, 'and on the primary family alone');
            assert.equal(probe.painted, true,
                'the family the token names must be the family uPlot paints with: width === chainWidth');
            assert.equal(probe.width, probe.chainWidth);
            assert.ok(probe.width > probe.fallbackWidth,
                `the loaded face is wider than the unresolvable fallback: ${probe.width} vs ${probe.fallbackWidth}`);
        }));

        test('THE RULE 2 CANARY: an absent family is caught by the primary measurement and MISSED by the chain', () => mounted(async (page) => {
            await page.evalFn(async (s) => window.__h.need(s).ready, '#p');
            await page.setToken('--ui-font-family', '"Decal No Such Face", system-ui, sans-serif');
            await page.settle(2);
            const absent = await page.evalFn((s) => window.__h.need(s).axisFontProbe(), '#p');
            await page.setToken('--ui-font-family', null);

            assert.equal(absent.registered, false,
                `a family that does not exist must not read as registered: ${JSON.stringify(absent)}`);
            assert.equal(absent.check, true,
                'MEASURED, and this is why check() can never be the only Rule 2 assertion: it '
                + 'returns TRUE for a family the platform has never heard of, because an unknown '
                + 'family is not in the FontFaceSet and is treated as a system font. It answers '
                + '"is the DECLARED face loaded", not "does this family exist"');
            assert.equal(absent.width, absent.fallbackWidth,
                'the primary family measures exactly what an unresolvable family measures');
            assert.equal(absent.painted, false,
                'painted:false is the honest reading — the chart is drawing in a fallback');
            assert.notEqual(absent.chainWidth, absent.fallbackWidth,
                'AND THE CHAIN CANNOT SEE IT: even with the family absent the chain still measures '
                + 'differently from the bogus family, because it lands on system-ui. That is why '
                + 'chain-vs-bogus reported "registered" either way, and why the probe measures one family');
        }));

        test('THE GATE\'S CANARY: check() is FALSE for a declared face nobody loaded — the defect it closes', () => mounted(async (page) => {
            const out = await page.eval(`(async () => {
                const face = new FontFace('Decal Probe Face', 'url(/fonts/Geist-Variable.ttf)');
                document.fonts.add(face);
                const c = document.createElement('canvas').getContext('2d');
                const w = (f) => { c.font = f; return c.measureText('0123456789.').width; };
                const font = '20px "Decal Probe Face"';
                await document.fonts.ready;                     // resolves — nothing is pending
                const restingStatus = face.status;              // read BEFORE anything measures
                const before = { status: restingStatus, check: document.fonts.check(font), width: w(font) };
                const statusAfterMeasuring = face.status;
                await face.load();
                const after = { check: document.fonts.check(font), width: w(font), status: face.status };
                return { before, statusAfterMeasuring, after, bogus: w('20px "Decal No Such Face"') };
            })()`);

            assert.equal(out.before.status, 'unloaded',
                'awaiting document.fonts.ready does not load a face nobody has rendered with');
            assert.equal(out.before.check, false, 'and check() says so — this is the signal the gate buys');
            assert.equal(out.before.width, out.bogus,
                'meanwhile canvas paints the fallback, at exactly an unresolvable family\'s width');
            assert.equal(out.statusAfterMeasuring, 'loading',
                'and MEASURING it starts the load asynchronously — which is the trap, not the '
                + 'rescue: this frame is already painted in the fallback and some later redraw '
                + 'silently changes metrics mid-shot. The gate loads it BEFORE the first build');
            assert.equal(out.after.check, true, 'after an explicit load, both readings flip');
            assert.notEqual(out.after.width, out.bogus);
        }));

        test('a channel token drill reaches painted pixels', () => mounted(async (page) => {
            await page.evalFn(async (s) => window.__h.need(s).ready, '#p');
            await load(page);

            /* Counting matching pixels, not sampling one: the trace moves with the
             * damped ceiling, and a count is stable while a coordinate is not. */
            const countDrill = (p) => p.evalFn((s) => {
                const canvas = window.__h.need(s);
                const ctx = canvas.getContext('2d');
                const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
                let n = 0;
                for (let i = 0; i < data.length; i += 4) {
                    if (data[i] === 255 && data[i + 1] === 0 && data[i + 2] === 170 && data[i + 3] > 200) n += 1;
                }
                return n;
            }, '#p >>> canvas');

            assert.equal(await countDrill(page), 0, 'the drill colour must not already be on the canvas');

            await assertTokenDrill(page, {
                token: '--ui-channel-pressure',
                value: DRILL_COLOUR,
                read: async (p) => {
                    await p.evalFn((s) => { window.__h.need(s).drawNow(); return true; }, '#p');
                    return String(await countDrill(p) > 0);
                },
                expected: 'true',
            });

            const got = await report(page);
            assert.ok(got.buildCount >= 2,
                'uPlot bakes its colours in at construction, so a token move is a REBUILD, '
                + 'not a restyle — that is why the range has to be carried across one');
        }));

        test('every channel styles/chart-channels.css declares reaches the plot through this host', () => mounted(async (page) => {
            await page.evalFn(async (s) => window.__h.need(s).ready, '#p');
            const got = await page.eval(`(async () => {
                const { CHANNELS: base, COMPARISON_CHANNELS, SURFACE_PARTS } = await import('/src/lib/chart-tokens.js');
                const CHANNELS = [...base, ...COMPARISON_CHANNELS];
                const t = document.getElementById('p').chartTokens;
                const values = CHANNELS.map((name) => t.channels[name]);
                return {
                    declared: CHANNELS.length,
                    read: Object.keys(t.channels).length,
                    empty: CHANNELS.filter((name) => !t.channels[name]),
                    distinct: new Set(values).size,
                    missing: [...t.missing],
                    surface: SURFACE_PARTS.map((part) => t.surface[part]),
                    pressure: t.channels.pressure,
                };
            })()`);

            assert.deepEqual(got.missing, [], 'nothing may resolve to nothing');
            assert.deepEqual(got.empty, []);
            assert.equal(got.read, got.declared, 'the reader reads exactly the declared channel list');
            assert.equal(got.distinct, got.declared,
                'and every channel has its OWN colour — two traces sharing one is an unreadable chart');
            assert.ok(got.surface.every(Boolean), 'the four chart surface parts resolve too');
            assert.match(got.pressure, /^#[0-9a-f]{6}$/i,
                'a custom property computes to its authored token text, which is what uPlot paints with');
        }));

        test('a data-theme flip rebuilds from the new surface tokens and keeps the shot (A6 + salvage 3)', () => mounted(async (page) => {
            await page.evalFn(async (s) => window.__h.need(s).ready, '#p');
            await load(page);
            const before = await report(page);
            const beforeSurface = await page.evalFn((s) => window.__h.need(s).chartTokens.surface, '#p');
            const start = await page.evalFn(() => document.documentElement.getAttribute('data-theme'));

            await page.setTheme(start === 'dark' ? 'light' : 'dark');
            const after = await report(page);
            const afterSurface = await page.evalFn((s) => window.__h.need(s).chartTokens.surface, '#p');

            assert.notDeepEqual(afterSurface, beforeSurface,
                `the well, grid, axis and label tokens must move with the theme (from ${start})`);
            assert.equal(after.buildCount, before.buildCount + 1,
                'uPlot bakes its axis and grid colours in at construction, so a retheme is a '
                + 'REBUILD — exactly one, not one per watched attribute');
            assert.equal(after.yMax, before.yMax, 'the damped ceiling belongs to the shot, not the theme');
            assert.deepEqual(after.xRange, before.xRange, 'and so does the x range');
            assert.equal(after.hasPlot, true);
            assert.deepEqual(page.pageErrors, []);
        }));

        test('a rebuild carries the range, the ceiling and the data (salvage 3)', () => mounted(async (page) => {
            await page.evalFn(async (s) => window.__h.need(s).ready, '#p');
            await load(page);
            const before = await report(page);
            assert.ok(before.yMax >= 10, `the resting floor is 10, got ${before.yMax}`);
            assert.deepEqual(before.xRange, [0, 30], 'the x range follows the data');

            await page.setToken('--ui-chart-grid', DRILL_COLOUR);
            await page.settle(2);
            const after = await report(page);

            assert.equal(after.buildCount, before.buildCount + 1, 'a retheme rebuilds exactly once');
            assert.equal(after.yMax, before.yMax, 'the damped ceiling belongs to the shot, not the theme');
            assert.deepEqual(after.xRange, before.xRange, 'and so does the x range');
            assert.equal(after.hasPlot, true);
        }));

        test('ORDER: awaiting ready BEFORE the first update waits for the real mount', () => {
            return browser.withPage({ geometry }, async (page) => {
                await page.mount('<div id="stage" style="inline-size: 700px; block-size: 280px"></div>', MODULE);
                const got = await page.eval(`(async () => {
                    const el = document.createElement('plot-fixture');
                    el.style.display = 'block';
                    el.style.blockSize = '280px';
                    const stage = document.getElementById('stage');
                    stage.appendChild(el);
                    const readyValue = await el.ready;          // asked before ANY update
                    return { readyValue, ...el.report() };
                })()`);

                assert.equal(got.readyValue, true, 'ready must resolve for the mount it named, not before it');
                assert.equal(got.sheetAdopted, true, 'and the sheet must be adopted by the time it does');
                assert.equal(got.mountError, null);
                assert.deepEqual(page.pageErrors, [], 'and nothing may be thrown on the way');
            });
        });

        test('ORDER: channels set AFTER the element is connected — the store-fed order', () => {
            return browser.withPage({ geometry }, async (page) => {
                await page.mount(stage('plot-fixture-late', 'late'), MODULE);
                const mid = await page.eval(`(async () => {
                    const el = document.getElementById('late');
                    await el.updateComplete;
                    const readyValue = await el.ready;
                    return { readyValue, seen: el.seenDuringMount, ...el.report() };
                })()`);

                assert.deepEqual(page.pageErrors, [],
                    `the mount must not throw at nobody: ${JSON.stringify(page.pageErrors)}`);
                assert.equal(mid.readyValue, true, 'a surface with no channels yet is mounted, not failed');
                assert.equal(mid.mountError, null, 'and no channels yet is an ORDER, not an error');
                assert.equal(mid.sheetAdopted, true, 'Rule 1 is satisfied before any channel arrives');
                assert.equal(mid.hasPlot, false, 'a plot of no series is not built — uPlot refuses one');
                assert.equal(mid.buildCount, 0);
                assert.deepEqual(mid.seen, { channels: 0, hasPlot: false },
                    'and the mount itself saw the empty state rather than racing it');

                await load(page, 'late');
                const after = await report(page, 'late');
                assert.equal(after.hasPlot, true, 'setChannels builds the first plot when it arrives late');
                assert.equal(after.buildCount, 1);
                assert.deepEqual(after.channels, ['pressure', 'flow']);
                assert.deepEqual(page.pageErrors, []);
            });
        });

        test('ORDER: channels set BEFORE the first update build at the mount', () => {
            return browser.withPage({ geometry }, async (page) => {
                await page.mount('<div id="stage" style="inline-size: 700px; block-size: 280px"></div>', MODULE);
                const got = await page.eval(`(async () => {
                    const { CHANNELS, makeRecords } = await import('/tools/fixtures/plot-surface-fixture.js');
                    const el = document.createElement('plot-fixture');
                    el.style.display = 'block';
                    el.style.blockSize = '280px';
                    el.setChannels(CHANNELS);
                    el.setRecords(makeRecords());
                    document.getElementById('stage').appendChild(el);
                    const readyValue = await el.ready;
                    return { readyValue, ...el.report() };
                })()`);

                assert.equal(got.readyValue, true);
                assert.equal(got.hasPlot, true, 'the mount builds what it was given before it ran');
                assert.equal(got.buildCount, 1, 'and builds it ONCE — not once per order');
                assert.deepEqual(page.pageErrors, []);
            });
        });

        test('an empty channel list destroys the plot rather than leaving the last shot on screen', () => mounted(async (page) => {
            await page.evalFn(async (s) => window.__h.need(s).ready, '#p');
            await load(page);
            assert.equal((await report(page)).hasPlot, true);

            await page.evalFn((s) => { window.__h.need(s).setChannels([]); return true; }, '#p');
            const got = await report(page);
            assert.equal(got.hasPlot, false, 'no series is no plot');
            assert.deepEqual(got.channels, []);
            assert.deepEqual(page.pageErrors, [], 'and clearing must not throw either');
        }));

        test('createPlot refuses an empty series list, which is why the build waits', () => mounted(async (page) => {
            await page.evalFn(async (s) => window.__h.need(s).ready, '#p');
            const message = await page.eval(`(async () => {
                const { createPlot } = await import('/src/components/uplot-plot.js');
                const el = document.getElementById('p');
                const t = el.chartTokens;
                const host = document.createElement('div');
                host.style.cssText = 'inline-size: 300px; block-size: 200px';
                document.getElementById('stage').appendChild(host);
                try {
                    createPlot(host, {
                        series: [],
                        yScale: { auto: true },
                        colors: { grid: t.surface.grid, axis: t.surface.axis, label: t.surface.label },
                        padding: { top: 1, right: 1, bottom: 1, left: 1 },
                        fontFamily: t.fontFamily,
                        tickFontPx: t.geometry.tickFontPx,
                        minTickGapPx: t.geometry.minTickGapPx,
                        pixelRatio: 1,
                        allowMissingStyles: true,
                    });
                    return 'no throw';
                } catch (e) { return e.message; }
            })()`);
            assert.match(message, /spec\.series is empty/,
                'the refusal is right — a plot of nothing is a bug when it is meant to be data — '
                + 'and it is exactly why the surface DEFERS its build instead of mounting into it');
        }));

        test('Rule 1\'s guard throws in an unsheeted shadow root', () => mounted(async (page) => {
            await page.evalFn(async (s) => window.__h.need(s).ready, '#p');
            const out = await page.eval(`(async () => {
                const { assertPlotStyles } = await import('/src/components/uplot-plot.js');
                const host = document.createElement('div');
                document.getElementById('stage').appendChild(host);
                const root = host.attachShadow({ mode: 'open' });
                const results = {};
                try { assertPlotStyles(root); results.bare = 'no throw'; }
                catch (e) { results.bare = e.message; }
                const sheet = new CSSStyleSheet();
                sheet.replaceSync('.uplot { position: relative }');
                root.adoptedStyleSheets = [sheet];
                try { results.sheeted = assertPlotStyles(root); }
                catch (e) { results.sheeted = e.message; }
                results.document = assertPlotStyles(document);
                return results;
            })()`);

            assert.match(out.bare, /not in this shadow root/,
                'an unsheeted shadow root must be refused — that is the whole guard');
            assert.equal(out.sheeted, true, 'a root carrying a .uplot rule passes');
            assert.equal(out.document, true,
                'a light-DOM host is allowed: the document\'s own <link> covers it, and only a '
                + 'shadow root can silently lose the sheet');
        }));

        test('a failed adoption that does NOT declare the waiver fails the mount instead of building', () => {
            return browser.withPage({ geometry }, async (page) => {
                await page.mount(stage('plot-fixture-unsheeted', 'u'), MODULE);
                const ready = await page.evalFn(async (s) => window.__h.need(s).ready, '#u');
                assert.equal(ready, false, 'a chart with no vendor sheet must not report a finished mount');

                const got = await report(page, 'u');
                assert.equal(got.sheetAdopted, false);
                assert.equal(got.hasPlot, false, 'and nothing may paint — the canvas would be pixel-identical');
                assert.equal(got.buildCount, 0);
                assert.match(got.mountError, /did not reach this shadow root/,
                    `the reason must be readable rather than inferred from sheetAdopted: ${got.mountError}`);
                assert.equal(await page.count('#u >>> canvas'), 0, 'no canvas at all');
                assert.deepEqual(page.pageErrors, [],
                    'and it is held in mountError, never thrown at a caller that does not exist');
            });
        });

        test('THE WAIVER\'S CANARY: declaring plotStyleSheetOptional is what still lets one through', () => {
            return browser.withPage({ geometry }, async (page) => {
                await page.mount(
                    `${stage('plot-fixture-canary', 'c')}${stage('plot-fixture-unsheeted', 'u')}`,
                    MODULE,
                );
                const waived = await page.evalFn(async (s) => window.__h.need(s).ready, '#c');
                const bare = await page.evalFn(async (s) => window.__h.need(s).ready, '#u');
                assert.equal(waived, true,
                    'the Rule 1 canary must still mount — an assertion with no subject proves nothing');
                assert.equal(bare, false,
                    'and the SAME failed adoption without the declaration must not. If these two are '
                    + 'equal the waiver has stopped being a deliberate act and Rule 1 is unguarded again.');
            });
        });

        test('the channel palette guard is STRICT even when Rule 1 is waived', () => {
            return browser.withPage({ geometry }, async (page) => {
                await page.mount(stage('plot-fixture-canary', 'c'), MODULE);
                await page.evalFn(async (s) => window.__h.need(s).ready, '#c');
                const out = await page.eval(`(() => {
                    const el = document.getElementById('c');
                    try {
                        el.setChannels([{ key: 'weightFlow', label: 'Weight flow' }, { key: 'no-such-channel' }]);
                        return 'no throw';
                    } catch (e) { return e.message; }
                })()`);

                assert.match(out, /no colour/,
                    'a channel with no token must throw on the unsheeted canary exactly as it does on a '
                    + `healthy chart — got ${JSON.stringify(out)}`);
                assert.match(out, /no-such-channel/, 'and name the one that missed');
                assert.doesNotMatch(out, /weightFlow \(/,
                    'while a derivation key that DOES translate resolves: SERIES_KEY_CHANNELS is the seam');
            });
        });

        test('a function-valued range and the array it returns give uPlot the SAME scale', () => mounted(async (page) => {
            await page.evalFn(async (s) => window.__h.need(s).ready, '#p');
            const got = await page.eval(`(async () => {
                const { createPlot } = await import('/src/components/uplot-plot.js');
                const t = document.getElementById('p').chartTokens;
                const base = {
                    series: [{ label: 'a', color: t.channels.pressure }],
                    colors: { grid: t.surface.grid, axis: t.surface.axis, label: t.surface.label },
                    padding: { top: 4, right: 4, bottom: 20, left: 40 },
                    fontFamily: t.fontFamily,
                    tickFontPx: t.geometry.tickFontPx,
                    minTickGapPx: t.geometry.minTickGapPx,
                    pixelRatio: 1,
                    allowMissingStyles: true,
                };
                const build = (spec) => {
                    const host = document.createElement('div');
                    host.style.cssText = 'inline-size: 300px; block-size: 200px';
                    document.getElementById('stage').appendChild(host);
                    const series = spec.series ?? base.series;
                    const plot = createPlot(host, { ...base, ...spec });
                    /* uPlot does not range anything until there IS data — a plot of no
                     * samples reads null/null whatever the range says — so this is the
                     * state a chart is actually in when it paints. */
                    plot.setData([[0, 1, 2, 3], ...series.map(() => [1, 2, 3, 4])], [0, 3]);
                    plot.flush();
                    const read = (k) => (plot.raw.scales[k]
                        ? { min: plot.raw.scales[k].min ?? null, max: plot.raw.scales[k].max ?? null }
                        : null);
                    return { y: read('y'), y2: read('y2') };
                };
                const twoSeries = [{ label: 'a', color: t.channels.pressure },
                                   { label: 'b', color: t.channels.flow, scale: 'y2' }];
                return {
                    array: build({ yScale: { range: [0, 7] } }),
                    fn: build({ yScale: { range: () => [0, 7] } }),
                    auto: build({ yScale: { auto: true } }),
                    twoScale: build({
                        series: twoSeries,
                        yScale: { range: () => [0, 7] },
                        y2Scale: { range: () => [0, 5] },
                    }),
                };
            })()`);

            assert.deepEqual(got.array.y, { min: 0, max: 7 }, 'an array range ranges the scale');
            assert.deepEqual(got.fn.y, got.array.y,
                'and a function returning that array must give the identical scale. null/null here is '
                + 'the double-wrap: uPlot reads minMax[0] off whatever range() returns, and a function '
                + 'has no [0] — silently, with no page error');
            assert.deepEqual(got.twoScale.y, { min: 0, max: 7 });
            assert.deepEqual(got.twoScale.y2, { min: 0, max: 5 },
                'y2 is the case with NO rescue: nothing follows setData with a setScale(\'y2\')');
            assert.ok(got.auto.y.min !== null && got.auto.y.max > got.auto.y.min,
                `and the { auto: true } branch still auto-ranges from the data: ${JSON.stringify(got.auto.y)}`);
            assert.deepEqual(page.pageErrors, [], 'none of this raises anything, which is the danger');
        }));

        test('THE DOUBLE-WRAP CANARY: one extra arrow ranges the scale to null/null, silently', () => mounted(async (page) => {
            await page.evalFn(async (s) => window.__h.need(s).ready, '#p');
            const got = await page.eval(`(async () => {
                const { createPlot } = await import('/src/components/uplot-plot.js');
                const t = document.getElementById('p').chartTokens;
                const inner = () => [0, 7];
                const build = (range) => {
                    const host = document.createElement('div');
                    host.style.cssText = 'inline-size: 300px; block-size: 200px';
                    document.getElementById('stage').appendChild(host);
                    const plot = createPlot(host, {
                        series: [{ label: 'a', color: t.channels.pressure }],
                        yScale: { range },
                        colors: { grid: t.surface.grid, axis: t.surface.axis, label: t.surface.label },
                        padding: { top: 4, right: 4, bottom: 20, left: 40 },
                        fontFamily: t.fontFamily,
                        tickFontPx: t.geometry.tickFontPx,
                        minTickGapPx: t.geometry.minTickGapPx,
                        pixelRatio: 1,
                        allowMissingStyles: true,
                    });
                    plot.setData([[0, 1, 2, 3], [1, 2, 3, 4]], [0, 3]);
                    plot.flush();
                    return { min: plot.raw.scales.y.min ?? null, max: plot.raw.scales.y.max ?? null };
                };
                return { wrapped: build(() => inner), direct: build(inner) };
            })()`);

            assert.deepEqual(got.wrapped, { min: null, max: null },
                'a range() that returns a FUNCTION must still range to null/null — uPlot reads minMax[0] '
                + 'positionally and a function has no [0]. If this ever passes, the vendor build has '
                + 'changed how it reads range() and the assertion above has stopped guarding anything');
            assert.deepEqual(got.direct, { min: 0, max: 7 },
                'while the same function passed straight through is the shape createPlot now sends');
            assert.deepEqual(page.pageErrors, [],
                'NEITHER raises: an unranged axis is a silent failure, which is why it needs a test at all');
        }));

        test('a two-scale surface comes up with a RANGED right-hand axis', () => {
            return browser.withPage({ geometry }, async (page) => {
                await page.mount(stage('plot-fixture-two', 't'), MODULE);
                await page.evalFn(async (s) => window.__h.need(s).ready, '#t');
                await load(page, 't');
                const scales = await page.evalFn((s) => window.__h.need(s).scaleReport(), '#t');

                assert.deepEqual(scales.y2, { min: 0, max: 5 },
                    `the right-hand axis must carry the range y2ScaleSpec() declared, got ${JSON.stringify(scales)}`);
                assert.equal(scales.y.min, 0, 'and the left one still follows the damped ceiling');
                assert.ok(scales.y.max >= 10);
                assert.ok(await page.count('#t >>> .u-axis') >= 3,
                    'x, y and y2 — three axes, which is what a ranged second scale draws');
                assert.deepEqual(page.pageErrors, []);
            });
        });

        test('THE FIXED-RANGE ESCAPE: a subclass\'s own band survives the frame, and no damped ceiling is computed', () => {
            return browser.withPage({ geometry }, async (page) => {
                await page.mount(stage('plot-fixture-temp', 'tc'), MODULE);
                await page.evalFn(async (s) => window.__h.need(s).ready, '#tc');
                await load(page, 'tc');

                const got = await report(page, 'tc');
                const scales = await page.evalFn((s) => window.__h.need(s).scaleReport(), '#tc');
                const band = await page.evalFn((s) => window.__h.need(s).band, '#tc');

                assert.deepEqual(band, [82, 97],
                    'computeTempRange anchors on the group TARGET: 92 − 10 .. 92 + 5, widened by nothing '
                    + 'because the group actual (88..95) already sits inside it');
                assert.deepEqual(scales.y, { min: band[0], max: band[1] },
                    `the axis must BE that band, not [0, dampedMax]: got ${JSON.stringify(scales.y)}. `
                    + 'A 0-based axis puts the whole 15 °C band in the top sixth of the plot');
                assert.equal(got.yMax, null,
                    'and the damped ceiling is never computed for a plot that does not use it');
                assert.deepEqual(page.pageErrors, []);
            });
        });

        test('the plot host carries no padding of its own (§6.1 rule 1)', () => mounted(async (page) => {
            await page.evalFn(async (s) => window.__h.need(s).ready, '#p');
            await load(page);
            const pad = await page.computed('#p >>> .plot', [
                'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
            ]);
            assert.deepEqual(pad, {
                'padding-top': '0px', 'padding-right': '0px', 'padding-bottom': '0px', 'padding-left': '0px',
            }, 'uPlot sizes from clientWidth/clientHeight — the padding box — so a padded host '
             + 'overflows by exactly its padding (measured at 32px on the profile preview)');
        }));

        test('the damped ceiling grows instantly and eases down one step at a time', () => mounted(async (page) => {
            await page.evalFn(async (s) => window.__h.need(s).ready, '#p');
            const walk = await page.eval(`(async () => {
                const { makeRecords } = await import('/tools/fixtures/plot-surface-fixture.js');
                const el = document.getElementById('p');
                const out = [];
                el.setChannels([{ key: 'pressure', label: 'Pressure' }]);
                el.setRecords({ pressure: makeRecords({ peak: 9 }).pressure });
                el.drawNow(); out.push(el.yMax);
                el.setRecords({ pressure: makeRecords({ peak: 30 }).pressure });
                el.drawNow(); out.push(el.yMax);
                el.setRecords({ pressure: makeRecords({ peak: 9 }).pressure });
                el.drawNow(); out.push(el.yMax);
                el.drawNow(); out.push(el.yMax);
                return out;
            })()`);

            const [rest, spike, eased1, eased2] = walk;
            assert.equal(rest, 10, 'the resting top is the floor: pressure lives inside it');
            assert.ok(spike >= 30, `a spike must be kept, not clipped — got ${spike}`);
            assert.equal(eased1, spike - 2, 'it eases down by EASE_STEP, never in one jump');
            assert.equal(eased2, spike - 4, 'and again on the next draw');
        }));

        test('THE SCHEDULER: ten records in one turn cost ONE paint, on a frame', () => mounted(async (page) => {
            await page.evalFn(async (s) => window.__h.need(s).ready, '#p');
            const got = await page.eval(`(async () => {
                const { CHANNELS, makeRecords } = await import('/tools/fixtures/plot-surface-fixture.js');
                const frame = () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
                const el = document.getElementById('p');
                const records = makeRecords();
                el.setChannels(CHANNELS);
                el.setRecords(records);
                await frame();                                  // let the mount come to rest
                const start = el.paintCount;
                const resting = { ...el.schedulerState };
                for (let i = 0; i < 10; i += 1) el.setRecords(records);
                const queued = { ...el.schedulerState, painted: el.paintCount - start };
                await frame();
                const settled = { ...el.schedulerState, painted: el.paintCount - start };
                return { resting, queued, settled };
            })()`);

            assert.deepEqual(got.resting, { framePending: false, inFlight: false, dirty: false },
                'the mount must come to rest before this measures anything');
            assert.equal(got.queued.painted, 0, 'nothing paints inside the turn that asked');
            assert.equal(got.queued.framePending, true, 'one frame is queued for all ten requests');
            assert.equal(got.queued.dirty, true, 'and the latest snapshot is what it will paint');
            assert.equal(got.settled.painted, 1,
                `ten requests, one paint — got ${got.settled.painted}. More than one is a draw queue`);
            assert.deepEqual(
                { framePending: got.settled.framePending, inFlight: got.settled.inFlight, dirty: got.settled.dirty },
                { framePending: false, inFlight: false, dirty: false },
                'and it comes back to rest with nothing in flight',
            );
        }));

        test('THE SCHEDULER: leaving the document cancels the queued frame (CONVENTIONS §12)', () => mounted(async (page) => {
            await page.evalFn(async (s) => window.__h.need(s).ready, '#p');
            const got = await page.eval(`(async () => {
                const { CHANNELS, makeRecords } = await import('/tools/fixtures/plot-surface-fixture.js');
                const frame = () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
                const el = document.getElementById('p');
                el.setChannels(CHANNELS);
                el.setRecords(makeRecords());
                await frame();
                const start = el.paintCount;
                el.setRecords(makeRecords({ peak: 12 }));
                const queued = { ...el.schedulerState };
                el.remove();
                const afterRemove = { ...el.schedulerState };
                await frame();
                return { queued, afterRemove, painted: el.paintCount - start, hasPlot: Boolean(el.plotHandle) };
            })()`);

            assert.equal(got.queued.dirty, true, 'a frame really was queued');
            assert.equal(got.afterRemove.dirty, false, 'and disconnecting cancels it rather than letting it land');
            assert.equal(got.painted, 0, 'a detached surface paints nothing');
            assert.equal(got.hasPlot, false, 'and its uPlot instance is destroyed with it');
            assert.deepEqual(page.pageErrors, []);
        }));
    });
}
