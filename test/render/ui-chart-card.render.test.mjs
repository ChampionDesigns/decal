/**
 *.5, FLOOR 1000×600 @ dsf 1).
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';
import { assertTokenDrill, DRILL_COLOUR } from '../harness/assertions.js';

const MODULE = ['/src/components/ui-chart-card.js'];

const SHOT_URL = '/tools/rea-fixtures/api__v1__shots__cd020a51-f353-4ffb-8389-72c931640181.json';

/** A stage with a real size: uPlot sizes from clientWidth/clientHeight. */
const stage = (inner = '', id = 'c') => `
<div id="stage" style="inline-size: 760px; block-size: 340px; margin: 24px">
  <ui-chart-card id="${id}" label="Shot chart" style="display: block; block-size: 340px">${inner}</ui-chart-card>
</div>`;

const near = (got, want, what, tol = 1.01) => assert.ok(
    Math.abs(got - want) <= tol,
    `${what}: expected ${want}, got ${got}`,
);

/** Feed the card the way a screen does: one derivation, nothing else. */
const FEED = (id = 'c') => `(async () => {
    const { deriveFromRecord } = await import('/src/lib/shot-derivation.js');
    const record = await (await fetch('${SHOT_URL}')).json();
    const el = document.getElementById('${id}');
    const ready = await el.ready;
    el.derivation = deriveFromRecord(record);
    await el.updateComplete;
    el.drawNow();
    return {
        ready,
        ok: el.derivation.ok,
        inShot: el.derivation.counts.inShot,
        steps: el.derivation.stepMarks.length,
        duration: el.derivation.scalars.durationSeconds,
        channels: el.channels.map((c) => c.key),
        empty: el.hasAttribute('empty'),
        sheetAdopted: el.sheetAdopted,
        buildCount: el.buildCount,
        hasPlot: Boolean(el.plotHandle),
        mountError: el.mountError ? String(el.mountError.message ?? el.mountError) : null,
    };
})()`;

const feed = (page, id = 'c') => page.eval(FEED(id));

/** Deep hit test through every shadow root — `elementFromPoint` stops at a host. */
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

const hitAt = (page, x, y) => page.eval(`(${HIT_FN})(${x}, ${y})`);

const cursor = (page, id = 'c') => page.evalFn((s) => {
    const el = window.__h.need(s);
    return { ...el.cursor, values: { ...el.cursor.values } };
}, `#${id}`);

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    const dsf = geometry.deviceScaleFactor;

    describe(`ui-chart-card @ ${geometry.name} (${geometry.width}×${geometry.height} @ dsf ${dsf})`, () => {

        const mounted = (fn, markup = stage()) => browser.withPage({ geometry }, async (page) => {
            await page.mount(markup, MODULE);
            assert.deepEqual(page.pageErrors, [], 'the card must mount without throwing');
            return fn(page);
        });

        test('the emulated geometry is the one the suite asked for', () => mounted(async (page) => {
            const env = JSON.parse(await page.eval(
                'JSON.stringify({dpr: devicePixelRatio, w: innerWidth, h: innerHeight})',
            ));
            assert.deepEqual(env, { dpr: dsf, w: geometry.width, h: geometry.height });
        }));

        test('a real recorded shot draws through the derivation, and the sheet is in THIS root', () => mounted(async (page) => {
            const got = await feed(page);
            assert.equal(got.ready, true, 'the mount must complete');
            assert.equal(got.mountError, null);
            assert.equal(got.sheetAdopted, true,
                'Part 8 §3 Rule 1: uPlot.min.css must be in this root\'s adoptedStyleSheets — '
                + 'a shadow root does not see a document <link>');
            assert.equal(got.ok, true, 'the recorded shot derives');
            assert.equal(got.inShot, 336, 'the fixture\'s in-shot sample count is a fixed number');
            assert.equal(got.steps, 2, 'and it carries two profile steps');
            assert.equal(got.hasPlot, true);
            assert.equal(got.buildCount, 1,
                'built ONCE: the channel widths are read from the tokens before the first '
                + 'build, so the mount does not have to rebuild itself to correct them');
            assert.equal(got.empty, false, 'a shot that derives is not the empty state');
            const defaults = await page.eval(`(async () => {
                const { DEFAULT_CHANNELS } = await import('${MODULE[0]}');
                return DEFAULT_CHANNELS.map((c) => ({ key: c.key, factor: c.factor ?? null }));
            })()`);
            assert.deepEqual(got.channels, defaults.map((c) => c.key),
                'the default Live channel set, in draw order, is the card\'s own list');
            assert.ok(!defaults.some((c) => c.key === 'power'),
                'and it carries no power trace: the Live card is the main page\'s');

            const applied = await page.evalFn((s) => Object.fromEntries(
                window.__h.need(s).channelSpecs.map((c) => [c.key, c.factor ?? null]),
            ), '#c');
            assert.deepEqual(applied, Object.fromEntries(defaults.map((c) => [c.key, c.factor])),
                'every factor DECLARED on a default channel survives #specs() to the plot — '
                + 'a spec field the list forgets is a declared property nothing reads');
        }));

        test('A NAMED CHANNEL SET KEEPS THE WEIGHT AND DASH THE SAME SERIES GETS BY DEFAULT', () => {
            const named = `
<div id="stage" style="inline-size: 760px; block-size: 340px; margin: 24px">
  <ui-chart-card id="c" label="Shot chart" channels="pressure targetPressure flow"
                 style="display: block; block-size: 340px"></ui-chart-card>
</div>`;
            return browser.withPage({ geometry }, async (page) => {
                await page.mount(named, MODULE);
                const got = await feed(page);
                const drawn = await page.evalFn((s) => {
                    const el = window.__h.need(s);
                    return {
                        specs: el.channelSpecs.map((c) => ({ key: c.key, width: c.width, dash: c.dash ?? null })),
                        series: el.plotHandle.raw.series.slice(1)
                            .map((s2) => ({ width: s2.width, dashed: Array.isArray(s2.dash) })),
                        minor: el.chartTokens.geometry.strokeMinor,
                        major: el.chartTokens.geometry.strokeMajor,
                    };
                }, '#c');

                assert.equal(got.ready, true, 'a named set still mounts');
                assert.deepEqual(got.channels, ['pressure', 'targetPressure', 'flow'],
                    'the card draws what it was told to draw, in that order');
                assert.deepEqual(drawn.specs.map((c) => c.width),
                    [drawn.major, drawn.minor, drawn.major],
                    'and the TARGET is minor, exactly as the default set draws it — from '
                    + 'the §3.8 stroke tokens, not from a number in this file');
                assert.equal(drawn.specs[1].dash, 'dash', 'a target is dashed however it was named');
                assert.deepEqual(drawn.series.map((s) => s.width),
                    [drawn.major, drawn.minor, drawn.major], 'and uPlot drew those widths');
                assert.deepEqual(drawn.series.map((s) => s.dashed), [false, true, false]);
                assert.deepEqual(page.pageErrors, []);
            });
        });

        test('and a channel list of OBJECTS is a shape the property accepts, not one it dies on', () => mounted(async (page) => {
            const got = await page.eval(`(async () => {
                const el = document.getElementById('c');
                const ready = await el.ready;
                el.channelKeys = [{ key: 'pressure' }, { key: 'flow', minor: true, dash: 'dash' }];
                await el.updateComplete;
                el.drawNow();
                return {
                    ready,
                    hasPlot: Boolean(el.plotHandle),
                    mountError: el.mountError ? String(el.mountError.message ?? el.mountError) : null,
                    specs: el.channelSpecs.map((c) => ({ key: c.key, width: c.width, dash: c.dash ?? null })),
                    minor: el.chartTokens.geometry.strokeMinor,
                    major: el.chartTokens.geometry.strokeMajor,
                };
            })()`);

            assert.equal(got.hasPlot, true,
                'an object entry used to reach the token resolver as its own key and take '
                + 'the whole mount down with it');
            assert.equal(got.mountError, null);
            assert.deepEqual(got.specs, [
                { key: 'pressure', width: got.major, dash: null },
                { key: 'flow', width: got.minor, dash: 'dash' },
            ], 'and the caller\'s own word wins over the key\'s default treatment');
            assert.deepEqual(page.pageErrors, []);
        }));

        test('MOUNT SIGNATURE: cssOverAsked is 1.0 and the canvas does not overflow the card', () => mounted(async (page) => {
            await feed(page);
            const host = await page.box('#c >>> .plot');
            const canvas = await page.box('#c >>> canvas');
            const attrs = await page.evalFn((s) => {
                const c = window.__h.q(s);
                return { w: c.width, h: c.height };
            }, '#c >>> canvas');

            const cssOverAsked = canvas.width / host.width;
            near(cssOverAsked, 1, 'cssOverAsked — the spike\'s strongest single number', 0.01);
            near(canvas.right - host.right, 0,
                'a healthy canvas overflows its host by 0px; the mount-C reading is '
                + `${(host.width * (dsf - 1)).toFixed(0)}px at this dpr`, 1.5);
            near(attrs.w, host.width * dsf,
                'the ATTRIBUTE size is the backing store: css × THIS plot\'s ratio', 2);
        }));

        test('MOUNT SIGNATURE at BOTH ratios: the vendor sheet reaches the canvas element', () => mounted(async (page) => {
            await feed(page);
            const canvas = await page.computed('#c >>> canvas', ['display', 'position']);
            assert.deepEqual(canvas, { display: 'block', position: 'relative' },
                'without the adopted sheet these are inline/static — the mount-C signature '
                + 'that discriminates at dsf 1 as well as 1.5');
        }));

        test('the plot host carries no padding, and the card\'s inset is on the frame (§6.1 rule 1)', () => mounted(async (page) => {
            await feed(page);
            const pad = await page.computed('#c >>> .plot', [
                'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
            ]);
            assert.deepEqual(pad, {
                'padding-top': '0px', 'padding-right': '0px', 'padding-bottom': '0px', 'padding-left': '0px',
            }, 'uPlot sizes from the PADDING box, so a padded plot host overflows by exactly '
             + 'its padding — measured 32px on the profile preview (bug chart-C3)');

            const frame = await page.computed('#c >>> .frame', ['padding-left', 'overflow-x', 'overflow-y']);
            assert.notEqual(frame['padding-left'], '0px', 'the card owns its own inset');
            assert.equal(frame['overflow-x'], 'visible',
                'and it does NOT clip: Slate\'s overflow:hidden is what hid chart-C3\'s 32px '
                + 'overflow, and it would hide Rule 1\'s 450px overflow at the bench dpr too');
            assert.equal(frame['overflow-y'], 'visible');
        }));

        test('POINTER SWEEP: real CDP mouse moves drive the cursor across the shot', () => mounted(async (page) => {
            await feed(page);
            const host = await page.box('#c >>> .plot');
            const hits = [];
            const readings = [];
            for (let i = 1; i <= 7; i += 1) {
                const x = host.left + (host.width * i) / 8;
                const y = host.top + host.height / 2;
                await page.mouse('mouseMoved', x, y);
                hits.push(await hitAt(page, x, y));
                readings.push(await cursor(page));
            }

            assert.ok(hits.every((h) => h.includes('canvas') || h.includes('u-')),
                `every swept point must land inside the plot, got ${JSON.stringify(hits)}`);
            assert.ok(readings.every((r) => r.active && Number.isInteger(r.idx)),
                `the cursor must be live at every swept point: ${JSON.stringify(readings.map((r) => r.idx))}`);

            const idxs = readings.map((r) => r.idx);
            for (let i = 1; i < idxs.length; i += 1) {
                assert.ok(idxs[i] > idxs[i - 1],
                    `the index must TRACK the pointer, not merely be non-null: ${JSON.stringify(idxs)}`);
            }
            assert.ok(idxs[0] >= 0 && idxs[idxs.length - 1] <= 335,
                `and stay inside the shot's 336 samples: ${JSON.stringify(idxs)}`);

            const last = readings[readings.length - 1];
            assert.ok(Number.isFinite(last.values.pressure),
                `the readout carries the sample's own numbers: ${JSON.stringify(last.values)}`);
            assert.ok(Number.isFinite(last.t) && last.t > 0, 'and its time on the shot clock');
        }));

        test('TOUCH: the bench is a touch device, and the same maths serves a finger', () => mounted(async (page) => {
            await feed(page);
            await page.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
            const host = await page.box('#c >>> .plot');
            const y = host.top + host.height / 2;
            const at = (i) => host.left + (host.width * i) / 6;

            await page.send('Input.dispatchTouchEvent', {
                type: 'touchStart', touchPoints: [{ x: at(1), y }],
            });
            const first = await cursor(page);
            await page.send('Input.dispatchTouchEvent', {
                type: 'touchMove', touchPoints: [{ x: at(4), y }],
            });
            const moved = await cursor(page);
            await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
            await page.send('Emulation.setTouchEmulationEnabled', { enabled: false });

            assert.equal(first.active, true, `a touch must place the cursor: ${JSON.stringify(first)}`);
            assert.ok(Number.isInteger(first.idx) && first.idx >= 0);
            assert.ok(moved.idx > first.idx,
                `and dragging must move it: ${first.idx} -> ${moved.idx}`);
            assert.deepEqual(page.pageErrors, []);
        }));

        test('THE CROSSHAIR is a positioned element with the plot\'s height, and hides at rest', () => mounted(async (page) => {
            await feed(page);
            const restingHidden = await page.evalFn((s) => window.__h.need(s).hidden, '#c >>> .cursor');
            assert.equal(restingHidden, true, 'no pointer, no crosshair');

            const host = await page.box('#c >>> .plot');
            await page.mouse('mouseMoved', host.left + host.width / 2, host.top + host.height / 2);
            await page.settle(1);

            const line = await page.computed('#c >>> .cursor', ['position', 'display']);
            assert.equal(line.position, 'absolute',
                'the crosshair is positioned over the well — `static` is the shape a lost '
                + 'stylesheet leaves uPlot\'s own cursor in, and the reason this one is ours');
            assert.notEqual(line.display, 'none');

            const box = await page.box('#c >>> .cursor');
            const over = await page.box('#c >>> .u-over');
            assert.ok(box.height > 0, `the crosshair must have height, got ${box.height}`);
            near(box.height, over.height, 'and it spans the plotting area', 1.5);
            assert.ok(box.left >= over.left - 1.5 && box.left <= over.right + 1.5,
                `and sits inside it: ${box.left} against [${over.left}, ${over.right}]`);
        }));

        test('THE COORDINATE RE-VERIFY: the two spaces uPlot\'s cursor mixes agree here', () => mounted(async (page) => {
            await feed(page);
            const check = await page.evalFn((s) => window.__h.need(s).plotCoordinateCheck(), '#c');
            assert.ok(check, 'the check needs a built plot');
            near(check.scaleX, 1, `clientWidth ÷ rect.width at dsf ${dsf}`, 0.001);
            near(check.scaleY, 1, `clientHeight ÷ rect.height at dsf ${dsf}`, 0.001);
            assert.equal(check.pixelRatio, dsf,
                'and the component\'s ONE pixel ratio is this page\'s (bug chart-C12)');

            const uplotCursorOff = await page.evalFn(
                (s) => window.__h.need(s).plotHandle.raw.cursor.show === false, '#c',
            );
            assert.equal(uplotCursorOff, true,
                'uPlot\'s own cursor must still be OFF — enabling it is a MUST NOT until '
                + 'the vendor path is re-verified, and this card does not need it');
        }));

        test('the axis face is LOADED before first paint, measured not asked', () => mounted(async (page) => {
            await feed(page);
            const probe = await page.evalFn((s) => window.__h.need(s).axisFontProbe(), '#c');

            assert.equal(probe.check, true,
                `document.fonts.check() on the family the axis paints with: ${JSON.stringify(probe)}`);
            assert.equal(probe.checkPrimary, true, 'and on the primary family alone');
            assert.equal(probe.registered, true,
                'the measured width must differ from an unresolvable family\'s — that is what '
                + 'an @font-face declared inside a shadow root measures (Part 8 §3 Rule 2)');
            assert.equal(probe.painted, true,
                'and the family the token names is the family uPlot paints with');
            assert.ok(probe.faceCount > 0);
        }));

        test('no @font-face is declared in this component\'s own styles', () => mounted(async (page) => {
            /* guard bans it by build guard; this is the runtime half, read off the sheets
             * actually adopted into the card's root — including the vendor sheet. */
            const found = await page.evalFn((s) => {
                const root = window.__h.need(s).renderRoot;
                const out = [];
                for (const sheet of root.adoptedStyleSheets ?? []) {
                    for (const rule of sheet.cssRules) {
                        if (rule.constructor.name === 'CSSFontFaceRule') out.push(rule.cssText);
                    }
                }
                return out;
            }, '#c');
            assert.deepEqual(found, [],
                'canvas resolves ctx.font against the DOCUMENT registry, so a face declared '
                + 'in here would never register and the axis would silently paint a fallback');
        }));

        test('a channel token drill reaches painted pixels on the shot\'s own trace', () => mounted(async (page) => {
            await feed(page);

            const countDrill = (p) => p.evalFn((s) => {
                const canvas = window.__h.need(s);
                const ctx = canvas.getContext('2d');
                const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
                let n = 0;
                for (let i = 0; i < data.length; i += 4) {
                    if (data[i] === 255 && data[i + 1] === 0 && data[i + 2] === 170 && data[i + 3] > 200) n += 1;
                }
                return n;
            }, '#c >>> canvas');

            assert.equal(await countDrill(page), 0, 'the drill colour must not already be on the canvas');

            await assertTokenDrill(page, {
                token: '--ui-channel-pressure',
                value: DRILL_COLOUR,
                read: async (p) => {
                    await p.evalFn((s) => { window.__h.need(s).drawNow(); return true; }, '#c');
                    return String(await countDrill(p) > 0);
                },
                expected: 'true',
            });
        }));

        test('a theme flip rebuilds ONCE and keeps the shot on screen', () => mounted(async (page) => {
            await feed(page);
            const before = await page.evalFn((s) => {
                const el = window.__h.need(s);
                return { build: el.buildCount, yMax: el.yMax, xRange: el.xRange };
            }, '#c');
            const start = await page.evalFn(() => document.documentElement.getAttribute('data-theme'));

            await page.setTheme(start === 'dark' ? 'light' : 'dark');
            const after = await page.evalFn((s) => {
                const el = window.__h.need(s);
                return { build: el.buildCount, yMax: el.yMax, xRange: el.xRange, hasPlot: Boolean(el.plotHandle) };
            }, '#c');

            assert.equal(after.build, before.build + 1,
                'uPlot bakes its colours in at construction, so a retheme is a rebuild — '
                + 'exactly one, even though the card re-issues its step rules on top of it');
            assert.equal(after.yMax, before.yMax, 'the damped ceiling belongs to the shot');
            assert.deepEqual(after.xRange, before.xRange, 'and so does the x range');
            assert.equal(after.hasPlot, true);
            assert.deepEqual(page.pageErrors, []);
        }));

        test('the two profile steps become RULES on the canvas, in the tokens this build read', () => mounted(async (page) => {
            await feed(page);
            const got = await page.evalFn((s) => {
                const el = window.__h.need(s);
                return {
                    marks: el.derivation.stepMarks.map((m) => ({ t: m.t, name: m.name })),
                    vRules: el.plotHandle.state.vRules,
                    labels: el.plotHandle.state.labels,
                    tokens: {
                        boundary: el.chartTokens.channels['step-boundary'],
                        label: el.chartTokens.surface.label,
                        minor: el.chartTokens.geometry.strokeMinor,
                    },
                };
            }, '#c');

            assert.equal(got.vRules.length, 2, 'one rule per step boundary');
            assert.deepEqual(got.vRules.map((r) => r.x), got.marks.map((m) => m.t),
                'at the derivation\'s own times — the card invents no x');
            assert.deepEqual(got.labels.map((l) => l.text), got.marks.map((m) => m.name),
                'and the step names ride with them ("PI", "Lever")');
            for (const rule of got.vRules) {
                assert.equal(rule.color, got.tokens.boundary,
                    'the rule ink is the step-boundary CHANNEL token (A6), not a literal');
                assert.equal(rule.width, got.tokens.minor,
                    'and its weight is §3.8\'s minor stroke, the same one a target line takes');
            }
            for (const label of got.labels) {
                assert.equal(label.color, got.tokens.label,
                    'the name is drawn in the chart\'s own label ink');
            }
        }));

        test('BUG chart-C2: a retheme re-issues them, so the boundaries survive the rebuild', () => mounted(async (page) => {
            await feed(page);

            await assertTokenDrill(page, {
                token: '--ui-channel-step-boundary',
                value: DRILL_COLOUR,
                expected: DRILL_COLOUR,
                prepare: (p) => p.settle(2),
                read: (p) => p.evalFn((s) => {
                    const el = window.__h.need(s);
                    return el.plotHandle.state.vRules[0].color;
                }, '#c'),
            });

            /* And the rules are not just held, they are PAINTED: the boundary colour has
             * to appear on the canvas, or "the card re-issues its rules" is a claim about
             * a data structure nobody draws. */
            const countDrill = (p) => p.evalFn((s) => {
                const canvas = window.__h.need(s);
                const ctx = canvas.getContext('2d');
                const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
                let n = 0;
                for (let i = 0; i < data.length; i += 4) {
                    if (data[i] === 255 && data[i + 1] === 0 && data[i + 2] === 170 && data[i + 3] > 200) n += 1;
                }
                return n;
            }, '#c >>> canvas');

            assert.equal(await countDrill(page), 0, 'the drill colour is not already on the canvas');
            await page.setToken('--ui-channel-step-boundary', DRILL_COLOUR);
            await page.settle(2);
            await page.evalFn((s) => { window.__h.need(s).drawNow(); return true; }, '#c');
            const painted = await countDrill(page);
            await page.setToken('--ui-channel-step-boundary', null);
            await page.settle(2);

            assert.ok(painted > 0,
                `the re-issued boundaries must reach pixels, got ${painted} drill-coloured px`);
            assert.deepEqual(page.pageErrors, []);
        }));

        test('a derivation with no steps issues no rules, and a refusal clears the ones it had', () => mounted(async (page) => {
            await feed(page);
            const got = await page.eval(`(async () => {
                const { emptyShotDerivation } = await import('/src/lib/shot-derivation.js');
                const el = document.getElementById('c');
                const before = el.plotHandle.state.vRules.length;
                el.derivation = emptyShotDerivation('noPouringSample');
                el.performUpdate();
                el.drawNow();
                return {
                    before,
                    after: el.plotHandle.state.vRules.length,
                    labels: el.plotHandle.state.labels.length,
                };
            })()`);

            assert.equal(got.before, 2, 'the shot had two boundaries');
            assert.equal(got.after, 0,
                'and a refusal takes them away — a chart keeping the last shot\'s step marks '
                + 'over an empty state is drawing something that is not there');
            assert.equal(got.labels, 0);
        }));

        test('BUG O3: a broken --ui-chart-well chain leaves an opaque card, not a transparent one', () => mounted(async (page) => {
            await feed(page);
            const healthy = await page.prop('#c >>> .frame', 'background-color');
            const well = await page.resolveToken('--ui-chart-well', 'background-color');
            assert.equal(healthy, well, 'the card paints the chart well, so card and plot cannot disagree');

            await page.setToken('--ui-chart-well', 'initial');
            await page.settle(2);
            const degraded = await page.prop('#c >>> .frame', 'background-color');
            const key = await page.resolveToken('--ui-key', 'background-color');
            await page.setToken('--ui-chart-well', null);

            assert.doesNotMatch(degraded, /rgba\(0, 0, 0, 0\)|transparent/,
                'a broken chain must not make the card transparent (bug O3)');
            assert.equal(degraded, key, 'it falls back to the control-face TOKEN, never a literal');
        }));

        test('BUG chart-C10: a legend present at mount does not leave the plot sized to a box it lost', () => {
            const withLegend = stage('<div slot="legend" style="block-size: 44px">legend</div>');
            return browser.withPage({ geometry }, async (page) => {
                await page.mount(withLegend, MODULE);
                await feed(page);

                const host = await page.box('#c >>> .plot');
                const canvas = await page.box('#c >>> canvas');
                const legend = await page.box('#c >>> .legend');
                const sized = await page.evalFn((s) => {
                    const el = window.__h.need(s);
                    return { w: el.plotHandle.raw.width, h: el.plotHandle.raw.height };
                }, '#c');

                assert.ok(legend.height >= 44,
                    `the legend row is laid out before the plot is built, got ${legend.height}`);
                assert.ok(legend.bottom <= host.top + 1.5,
                    'and it is a ROW, not a sibling inserted over the plot: '
                    + `legend bottom ${legend.bottom} against plot top ${host.top}`);
                near(sized.w, host.width,
                    'the plot was BORN at its host\'s size — chart-C10 is createPlot measuring '
                    + 'before a 78px legend host is inserted as its preceding sibling, so every '
                    + 'plot is born sized to a box it no longer occupies', 1.5);
                near(canvas.width, host.width, 'and its canvas matches', 1.5);
                assert.deepEqual(page.pageErrors, []);
            });
        });

        test('BUG chart-C10, the second half: a legend that arrives LATE resizes the plot', () => mounted(async (page) => {
            await feed(page);
            const before = await page.box('#c >>> .plot');

            const after = await page.eval(`(async () => {
                const frame = () => new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(d)));
                const el = document.getElementById('c');
                const legend = document.createElement('div');
                legend.slot = 'legend';
                legend.style.blockSize = '60px';
                legend.textContent = 'late legend';
                el.appendChild(legend);
                await frame();
                await frame();
                const host = el.shadowRoot.querySelector('.plot');
                return {
                    hostHeight: host.getBoundingClientRect().height,
                    plotHeight: el.plotHandle.raw.height,
                    hasLegend: el.hasAttribute('has-legend'),
                };
            })()`);

            assert.equal(after.hasLegend, true, 'the slot reports itself filled');
            assert.ok(after.hostHeight < before.height - 40,
                `the plot's box really shrank: ${before.height} -> ${after.hostHeight}`);
            near(after.plotHeight, after.hostHeight,
                'and the ResizeObserver corrected the plot rather than leaving it oversized — '
                + 'the compensating resize Slate scheduled by hand, one frame later', 1.5);
        }));

        test('BUG chart-C11: shrinking the container resizes the plot, with no window listener', () => mounted(async (page) => {
            await feed(page);
            const before = await page.box('#c >>> canvas');

            await page.setStyle('#stage', { 'inline-size': '420px' });
            const after = await page.eval(`(async () => {
                const frame = () => new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(d)));
                await frame(); await frame();
                const el = document.getElementById('c');
                const host = el.shadowRoot.querySelector('.plot');
                const canvas = el.shadowRoot.querySelector('canvas');
                return {
                    host: host.getBoundingClientRect().width,
                    canvasCss: canvas.getBoundingClientRect().width,
                    canvasAttr: canvas.width,
                    plot: el.plotHandle.raw.width,
                    ratio: el.pixelRatio,
                };
            })()`);

            assert.ok(after.host < before.width - 100,
                `the container really shrank: ${before.width} -> ${after.host}`);
            near(after.plot, after.host, 'the plot followed its own host (§6.1 rule 2)', 1.5);
            near(after.canvasCss, after.host, 'and so did the canvas\'s CSS box', 1.5);
            near(after.canvasAttr, after.host * dsf,
                'with the backing store at css × the component\'s own ratio', 2);
        }));

        test('the floor holds: squeezed below --ui-chart-min-h the plot stops giving', () => mounted(async (page) => {
            await feed(page);
            await page.setStyle('#c', { 'block-size': '80px' });
            await page.settle(2);

            const floor = await page.tokenValue('--ui-chart-min-h');
            const host = await page.box('#c');
            const plot = await page.box('#c >>> .plot');
            assert.ok(host.height >= Number.parseFloat(floor) - 1,
                `§6.1 rule 7: the card does not shrink past ${floor}, got ${host.height}`);
            assert.ok(plot.height >= Number.parseFloat(floor) - 1,
                `and neither does the plot area, got ${plot.height}`);
        }));

        for (const [what, inner, tallest] of [
            ['no legend', '', 0],
            ['a chip-height legend', '<div slot="legend" style="block-size: 44px">legend</div>', 44],
            ['a legend taller than its reserve', '<div slot="legend" style="block-size: 96px">legend</div>', 96],
        ]) {
            test(`NOTHING LEAVES THE FRAME at any asked height — ${what}`, () => {
                return browser.withPage({ geometry }, async (page) => {
                    await page.mount(stage(inner), MODULE);
                    await feed(page);

                    const chartFloor = Number.parseFloat(await page.tokenValue('--ui-chart-min-h'));
                    const worst = [];
                    for (const asked of [340, 240, 200, 160, 80]) {
                        await page.setStyle('#c', { 'block-size': `${asked}px` });
                        await page.settle(2);
                        const host = await page.box('#c');
                        const frameBox = await page.box('#c >>> .frame');
                        const well = await page.box('#c >>> .well');
                        const canvas = await page.box('#c >>> canvas');
                        const plot = await page.box('#c >>> .plot');

                        assert.ok(canvas.bottom <= frameBox.bottom + 1,
                            `${what} @ ${asked}px: the canvas is ${(canvas.bottom - frameBox.bottom).toFixed(1)}px `
                            + 'below the frame that is supposed to be drawn around it');
                        assert.ok(well.bottom <= frameBox.bottom + 1,
                            `${what} @ ${asked}px: the plot well overruns the frame by `
                            + `${(well.bottom - frameBox.bottom).toFixed(1)}px`);
                        assert.ok(frameBox.bottom <= host.bottom + 1,
                            `${what} @ ${asked}px: the frame overruns the host it is inside`);
                        assert.ok(plot.height >= chartFloor - 1,
                            `${what} @ ${asked}px: the plot lost its floor (${plot.height})`);
                        worst.push(canvas.bottom - host.bottom);
                    }

                    const asked = await page.computed('#c', ['min-block-size']);
                    const advertised = Number.parseFloat(asked['min-block-size']);
                    const host = await page.box('#c');
                    assert.ok(advertised > chartFloor,
                        `the card's floor (${advertised}) must exceed the PLOT's floor (${chartFloor}) `
                        + 'by its own chrome — a host that advertises the plot\'s number promises '
                        + 'a size at which its own contents do not fit');
                    if (tallest) {
                        assert.ok(advertised >= chartFloor + 44,
                            `with a legend the reserve is part of the floor, got ${advertised}`);
                    }
                    assert.equal(host.height, advertised,
                        'and at 80px asked the card sits exactly on that floor');
                    assert.ok(Math.max(...worst) <= 0,
                        `nothing ended below the host at any height: ${JSON.stringify(worst)}`);
                    assert.deepEqual(page.pageErrors, []);
                });
            });
        }

        test('BUG chart-C12: a REAL dpr change moves the component and uPlot to the same number', () => mounted(async (page) => {
            await feed(page);
            const next = dsf === 1 ? 2 : 1;
            const before = await page.evalFn((s) => {
                const el = window.__h.need(s);
                return {
                    ratio: el.pixelRatio,
                    build: el.buildCount,
                    attr: el.renderRoot.querySelector('canvas').width,
                };
            }, '#c');
            assert.equal(before.ratio, dsf, 'the component starts at the page\'s ratio');

            await page.setGeometry({ ...geometry, deviceScaleFactor: next });
            const after = await page.eval(`(async () => {
                const frame = () => new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(d)));
                await frame(); await frame();
                const uPlot = (await import('/vendor/uPlot.esm.js')).default;
                const el = document.getElementById('c');
                const canvas = el.shadowRoot.querySelector('canvas');
                const host = el.shadowRoot.querySelector('.plot');
                return {
                    ratio: el.pixelRatio,
                    vendor: uPlot.pxRatio,
                    platform: window.devicePixelRatio,
                    build: el.buildCount,
                    attr: canvas.width,
                    css: canvas.getBoundingClientRect().width,
                    host: host.getBoundingClientRect().width,
                };
            })()`);
            await page.setGeometry(geometry);

            assert.equal(after.platform, next, 'the page really changed ratio');
            assert.equal(after.ratio, next,
                'the component adopted it from uPlot\'s own dppxchange event, so the two '
                + 'cannot be a frame apart (bug chart-C12)');
            assert.equal(after.vendor, next, 'and uPlot is on the same number');
            assert.equal(after.build, before.build + 1, 'exactly one rebuild for the change');
            near(after.attr, after.host * next, 'the backing store follows the new ratio', 3);
            near(after.css, after.host,
                'while the canvas\'s CSS box still fits its host — the vendor sheet is what '
                + 'holds that, at any ratio', 1.5);
        }));

        test('a reactive update does not disturb the plot\'s size (Lit × setSize)', () => mounted(async (page) => {
            await feed(page);
            const got = await page.eval(`(async () => {
                const el = document.getElementById('c');
                const host = el.shadowRoot.querySelector('.plot');
                const before = { w: el.plotHandle.raw.width, canvases: host.querySelectorAll('canvas').length };
                el.label = 'Renamed mid-shot';
                el.empty = false;
                await el.updateComplete;
                const after = {
                    w: el.plotHandle.raw.width,
                    canvases: host.querySelectorAll('canvas').length,
                    aria: host.getAttribute('aria-label'),
                    build: el.buildCount,
                };
                return { before, after };
            })()`);

            assert.equal(got.after.w, got.before.w, 'the plot keeps its size across a Lit update');
            assert.equal(got.after.canvases, 1, 'and its canvas is neither duplicated nor lost');
            assert.equal(got.after.aria, 'Renamed mid-shot', 'while the template really did update');
            assert.deepEqual(page.pageErrors, []);
        }));

        test('THE SCHEDULER: ten derivations in one turn cost ONE paint', () => mounted(async (page) => {
            await feed(page);
            const got = await page.eval(`(async () => {
                const { deriveFromRecord } = await import('/src/lib/shot-derivation.js');
                const record = await (await fetch('${SHOT_URL}')).json();
                const frame = () => new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(d)));
                const el = document.getElementById('c');
                await frame();
                const start = el.paintCount;
                const resting = { ...el.schedulerState };
                for (let i = 0; i < 10; i += 1) {
                    el.derivation = deriveFromRecord(record);
                    el.performUpdate();
                }
                const queued = { ...el.schedulerState, painted: el.paintCount - start };
                await frame();
                return { resting, queued, settled: { ...el.schedulerState, painted: el.paintCount - start } };
            })()`);

            assert.deepEqual(got.resting, { framePending: false, inFlight: false, dirty: false },
                'the mount must come to rest before this measures anything');
            assert.equal(got.queued.painted, 0, 'nothing paints inside the turn that asked');
            assert.equal(got.settled.painted, 1,
                `ten derivations, one paint — got ${got.settled.painted}. More is a draw queue`);
        }));

        test('REDRAW BUDGET: a full redraw of the recorded shot fits the 66 ms frame', () => mounted(async (page) => {
            await feed(page);
            const timing = await page.eval(`(async () => {
                const frame = () => new Promise((d) => requestAnimationFrame(d));
                const el = document.getElementById('c');
                const samples = [];
                for (let i = 0; i < 108; i += 1) {
                    await frame();
                    const t0 = performance.now();
                    el.drawNow();
                    const t1 = performance.now();
                    if (i >= 8) samples.push(t1 - t0);
                }
                samples.sort((a, b) => a - b);
                const at = (p) => samples[Math.min(samples.length - 1, Math.floor(samples.length * p))];
                return {
                    n: samples.length,
                    mean: samples.reduce((a, b) => a + b, 0) / samples.length,
                    p50: at(0.5), p95: at(0.95), max: samples[samples.length - 1],
                };
            })()`);

            // eslint-disable-next-line no-console
            console.log(`      redraw @ ${geometry.name} dsf ${dsf}: mean ${timing.mean.toFixed(3)} ms · `
                + `p50 ${timing.p50.toFixed(3)} · p95 ${timing.p95.toFixed(3)} · max ${timing.max.toFixed(3)} `
                + `(${timing.n} frames, 336 samples × 5 channels)`);
            assert.equal(timing.n, 100, 'eight warm-up frames, then a hundred measured');
            assert.ok(timing.p95 < 66,
                `p95 ${timing.p95.toFixed(2)} ms must fit the 15 Hz frame budget of 66 ms`);
        }));

        test('a refused derivation keeps its axes and shows the slotted refusal', () => {
            const withEmpty = stage('<span slot="empty" id="msg">No shot yet</span>');
            return browser.withPage({ geometry }, async (page) => {
                await page.mount(withEmpty, MODULE);
                const got = await page.eval(`(async () => {
                    const { emptyShotDerivation } = await import('/src/lib/shot-derivation.js');
                    const el = document.getElementById('c');
                    await el.ready;
                    el.derivation = emptyShotDerivation('noPouringSample');
                    await el.updateComplete;
                    el.drawNow();
                    return {
                        empty: el.hasAttribute('empty'),
                        hasPlot: Boolean(el.plotHandle),
                        reason: el.derivation.reason,
                        cursor: el.cursor.active,
                    };
                })()`);

                assert.equal(got.empty, true, 'the refusal reflects to an attribute a screen can style');
                assert.equal(got.hasPlot, true,
                    'and the chart KEEPS its axes — a chart that vanishes reads as broken, which '
                    + 'is the failure gate 6\'s `reason` exists to avoid');
                assert.equal(got.cursor, false, 'with nothing to point at, there is no cursor');
                const message = await page.box('#msg');
                assert.ok(message.width > 0 && message.height > 0, 'the slotted message is on screen');
                assert.deepEqual(page.pageErrors, []);
            });
        });

        test('THE LIVE ROAD: the same card draws a shot arriving through the wave-0b buffer', () => mounted(async (page) => {
            const got = await page.eval(`(async () => {
                const { createShotBuffer } = await import('/src/stores/shot-buffer.js');
                const { deriveFromBuffer } = await import('/src/lib/shot-derivation.js');
                const record = await (await fetch('${SHOT_URL}')).json();
                const el = document.getElementById('c');
                await el.ready;

                const buffer = createShotBuffer({});
                buffer.open(record.id, {});
                const half = Math.floor(record.measurements.length / 2);
                for (let i = 0; i < half; i += 1) buffer.addSample(record.measurements[i]);
                el.derivation = deriveFromBuffer(buffer);
                el.performUpdate();
                el.drawNow();
                const mid = { inShot: el.derivation.counts.inShot, xRange: el.xRange, open: el.derivation.open };

                for (let i = half; i < record.measurements.length; i += 1) buffer.addSample(record.measurements[i]);
                el.derivation = deriveFromBuffer(buffer);
                el.performUpdate();
                el.drawNow();
                const full = {
                    inShot: el.derivation.counts.inShot,
                    xRange: el.xRange,
                    sourcesHeldBy: el.derivation.sourcesHeldBy,
                    hasPlot: Boolean(el.plotHandle),
                    build: el.buildCount,
                };
                buffer.destroy();
                return { mid, full };
            })()`);

            assert.ok(got.mid.inShot > 0, 'the half-fed buffer derives a partial shot');
            assert.equal(got.full.inShot, 336,
                'and the full one lands on the same in-shot count the recorded road gives');
            assert.ok(got.full.xRange[1] > got.mid.xRange[1],
                `the x range grows with the shot: ${got.mid.xRange[1]} -> ${got.full.xRange[1]}`);
            assert.equal(got.full.hasPlot, true);
            assert.equal(got.full.build, 1,
                'a growing shot is DATA, not a rebuild — the plot is constructed once and fed');
            assert.deepEqual(page.pageErrors, []);
        }));

        test('every gallery state mounts a card with a BUILT PLOT', () => {
            return browser.withPage({ geometry }, async (page) => {
                const states = await page.eval(`(async () => {
                    const { entry } = await import('/tools/gallery/entries/ui-chart-card.entry.js');
                    await import('/tools/gallery/entries/ui-chart-card.demo.js');
                    const host = document.getElementById('mount');
                    const out = [];
                    for (const state of entry.states) {
                        host.innerHTML = '<div id="stage" style="inline-size: 700px">' + state.html + '</div>';
                        const el = host.querySelector('#chart');
                        await customElements.whenDefined(el.tagName.toLowerCase());
                        await el.updateComplete;
                        await el.ready;
                        await el.updateComplete;
                        out.push({
                            id: state.id,
                            tag: el.tagName.toLowerCase(),
                            hasPlot: Boolean(el.plotHandle),
                            sheetAdopted: el.sheetAdopted,
                            empty: el.hasAttribute('empty'),
                            samples: el.derivation && el.derivation.ok ? el.derivation.counts.inShot : 0,
                            width: el.shadowRoot.querySelector('.plot').getBoundingClientRect().width,
                        });
                    }
                    return out;
                })()`);

                assert.equal(states.length, 4, 'four states, and every one of them a picture');
                for (const state of states) {
                    assert.equal(state.hasPlot, true, `${state.id}: no plot was built`);
                    assert.equal(state.sheetAdopted, true, `${state.id}: Rule 1`);
                    assert.ok(state.width > 100, `${state.id}: the plot has no width (${state.width})`);
                    if (state.id === 'no-shot') {
                        assert.equal(state.empty, true, 'the refusal state is the empty one');
                        assert.equal(state.tag, 'ui-chart-card', 'and it mounts the shipping tag');
                    } else {
                        assert.equal(state.empty, false, `${state.id}: a shot state must carry a shot`);
                        assert.equal(state.samples, 336, `${state.id}: the recorded shot's own count`);
                    }
                }
                assert.deepEqual(page.pageErrors, []);
            });
        });

        test('leaving the document destroys the plot and disconnects every observer', () => mounted(async (page) => {
            await feed(page);
            const got = await page.eval(`(async () => {
                const frame = () => new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(d)));
                const el = document.getElementById('c');
                el.setRecords(el.derivation.series);
                const queued = { ...el.schedulerState };
                el.remove();
                const afterRemove = { ...el.schedulerState, hasPlot: Boolean(el.plotHandle) };
                // A dppxchange after removal must reach nothing: no rebuild, no throw.
                window.dispatchEvent(new CustomEvent('dppxchange'));
                await frame();
                return { queued, afterRemove, hasPlot: Boolean(el.plotHandle), build: el.buildCount };
            })()`);

            assert.equal(got.queued.dirty, true, 'a frame really was queued');
            assert.equal(got.afterRemove.dirty, false, 'and disconnecting cancels it');
            assert.equal(got.hasPlot, false, 'the uPlot instance is destroyed (CONVENTIONS §12)');
            assert.deepEqual(page.pageErrors, [],
                'and a dppxchange arriving after removal reaches a detached listener that is gone');
        }));

        test('the plot reports a press ONLY when the consumer asked for one', () => mounted(async (page) => {
            /* OPT-IN, because most cards ARE the destination: the History pages' own
             * plots would otherwise offer a way out of the screen they are on. */
            const seen = await page.evalFn(async (s) => {
                const el = window.__h.need(s);
                const heard = [];
                el.addEventListener('plot-activate', (e) => heard.push(e.detail.how));
                const well = el.renderRoot.querySelector('.well');

                const off = { role: well.getAttribute('role'), tab: well.getAttribute('tabindex') };
                well.click();
                el.activate = true;
                el.activateLabel = 'Open the shot charts';
                await el.updateComplete;
                const on = {
                    role: well.getAttribute('role'),
                    tab: well.getAttribute('tabindex'),
                    name: well.getAttribute('aria-label'),
                };
                well.click();
                well.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
                well.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
                well.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
                return { heard, off, on };
            }, '#c');

            assert.equal(seen.off.role, 'group', 'a plain card is a named region, not a control');
            assert.equal(seen.off.tab, null, 'and is not in the tab order');
            assert.deepEqual(seen.heard, ['pointer', 'keyboard', 'keyboard'],
                'the press is reported once per gesture, and an unrelated key is not one');
            assert.equal(seen.on.role, 'button');
            assert.equal(seen.on.tab, '0', 'a tablet gesture no keyboard has is half a control');
            assert.equal(seen.on.name, 'Open the shot charts');
        }));
    });
}
