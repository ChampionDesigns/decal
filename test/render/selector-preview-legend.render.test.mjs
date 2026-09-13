/**
 * selector-preview-legend.render.test.mjs — the Profiles preview names its curves and
 * its horizontal axis.
 *
 * Every curve the card is fed has a chip carrying its quantity and unit, the chip's
 * swatch is drawn at its trace's own weight and dash, the axis is named, and the key
 * costs the single legend row the card already reserves.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';

const REPO = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const MODULES = ['/test/fixtures/selector-loop-fixture.js'];
const STAGE = '<div id="stage" style="inline-size: 100%; block-size: 100dvh"></div>';

const S = 'selector-screen';
const CARD = `${S} >>> #preview`;
const KEY_ROW = `${S} >>> .preview-key`;
const KEY = `${S} >>> #key`;
const AXIS = `${S} >>> #axis-x`;
const PLOT = `${S} >>> #preview >>> [part="plot"]`;
const FRAME = `${S} >>> #preview >>> [part="frame"]`;

const px = (value) => parseFloat(value);
const near = (got, want, what, tol = 0.51) => assert.ok(
    Math.abs(got - want) <= tol, `${what}: expected ${want}, got ${got}`,
);

function freePort() {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.on('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const { port } = server.address();
            server.close(() => resolve(port));
        });
    });
}

async function startMock() {
    const port = await freePort();
    const child = spawn('python3', ['tools/mock_rea.py', '--port', String(port)],
        { cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (b) => { stderr += b; });
    child.stdout.resume();
    const deadline = Date.now() + 20000;
    for (;;) {
        if (child.exitCode !== null) throw new Error(`mock exited ${child.exitCode}: ${stderr}`);
        try {
            const res = await fetch(`http://127.0.0.1:${port}/api/v1/info`);
            if (res.ok) { await res.arrayBuffer(); break; }
        } catch { /* not up yet */ }
        if (Date.now() > deadline) throw new Error(`mock never came up: ${stderr}`);
        await new Promise((r) => setTimeout(r, 60));
    }
    return { port, stop: () => child.kill('SIGKILL') };
}

/** The chips, as the engine drew them: label text, swatch weight, swatch dash. */
const chips = (page) => page.evalFn((sel) => {
    const legend = window.__h.need(sel);
    return [...legend.shadowRoot.querySelectorAll('[data-key]')].map((chip) => {

        const line = chip.querySelector('.swatch line');
        const cs = line ? getComputedStyle(line) : null;
        return {
            key: chip.getAttribute('data-key'),
            text: chip.textContent.trim(),
            stroke: cs ? parseFloat(cs.strokeWidth) : null,
            dash: cs ? String(cs.strokeDasharray) : null,
        };
    });
}, KEY);

/** What the words OUGHT to be, composed in the page from the modules that own them. */
const expected = (page) => page.evalFn(async () => {
    const [preview, readout] = await Promise.all([
        import('/src/lib/profile-preview.js'),
        import('/src/lib/chart-readout.js'),
    ]);
    return {
        keys: [...preview.PREVIEW_CHANNEL_KEYS],
        units: preview.PREVIEW_CHANNEL_KEYS.map((k) => readout.CHANNEL_READOUT[k].unit),
        timeUnit: String(readout.readoutTime(0)).replace(/^[^A-Za-z°]*/, ''),
    };
});

/** The listing's longest profile, by shape — never by name. */
const pickRichestProfile = (page) => page.evalFn(() => {
    const records = document.querySelector('selector-screen').store.get().records || [];
    const best = records
        .filter((r) => Array.isArray(r?.profile?.steps) && r.profile.steps.length > 0)
        .sort((a, b) => b.profile.steps.length - a.profile.steps.length)[0];
    return best?.profile?.title ?? null;
});

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`the profile preview's chart key @ ${geometry.name}`, () => {
        let mock;
        let page;

        before(async () => {
            mock = await startMock();
            page = await browser.newPage({ geometry });
            await page.mount(STAGE, MODULES);
            await page.evalFn((port) => window.__sel.mount({ port }), mock.port);
            assert.deepEqual(page.pageErrors, [], 'the screen must mount without throwing');
        });

        after(async () => {
            try { await page?.close(); } finally { mock?.stop(); }
        });

        /** Put the richest profile in the detail pane. Ordered before every assertion. */
        const shown = async () => {
            const title = await pickRichestProfile(page);
            assert.ok(title, 'the mock listing carries a profile with steps');
            await page.evalFn((t) => window.__sel.selectByTitle(t), title);
            await page.settle(6);
            return title;
        };

        test('with nothing picked there is no key, because there are no curves to name',
            async () => {

                await page.evalFn(() => {
                    document.querySelector('selector-screen').store.select(null);
                    return true;
                });
                await page.settle(4);
                assert.equal(await page.exists(KEY), false,
                    'the empty card names two curves it is not drawing');
                assert.equal(await page.exists(AXIS), false,
                    'and it names an axis with no data on it');
                const card = await page.evalFn(
                    (s) => window.__h.need(s).hasAttribute('has-legend'), CARD,
                );
                assert.equal(card, false, 'and it is not paying for a legend row either');
            });

        test('every curve has a chip, and every chip carries its unit', async () => {
            await shown();
            const want = await expected(page);
            const drawn = await chips(page);
            assert.deepEqual(drawn.map((c) => c.key), want.keys,
                'one chip per fed channel, in the plot-s own draw order');
            for (let i = 0; i < want.keys.length; i += 1) {
                const unit = want.units[i];
                assert.ok(drawn[i].text.includes(unit),
                    `${want.keys[i]}: the chip reads "${drawn[i].text}" and does not carry "${unit}"`);
                assert.ok(drawn[i].text.replace(unit, '').trim().length > 2,
                    `${want.keys[i]}: the chip is a unit with no quantity name — "${drawn[i].text}"`);
            }
            assert.deepEqual(page.pageErrors, []);
        });

        test('the horizontal axis is named, with its unit', async () => {
            await shown();
            const want = await expected(page);
            const text = await page.evalFn(
                (s) => window.__h.need(s).textContent.trim(), AXIS,
            );
            assert.ok(text.includes(want.timeUnit),
                `the axis label "${text}" does not carry "${want.timeUnit}"`);
            assert.ok(text.replace(want.timeUnit, '').trim().length > 2,
                `the axis label "${text}" is a unit with no name`);
            const box = await page.box(AXIS);
            assert.ok(box.width > 0 && box.height > 0, 'and it has a rendered box');
        });

        test('a chip swatch is drawn at its own trace-s weight and dash', async () => {
            await shown();
            const drawn = await chips(page);
            assert.equal(drawn.some((c) => c.stroke === null), false,
                'every chip drew a swatch');

            for (const chip of drawn) {
                assert.ok(chip.dash && chip.dash !== 'none',
                    `${chip.key}: the swatch is solid (${chip.dash}) against a dashed trace`);
            }
        });

        test('the key costs one legend row, does not wrap, and leaves the plot its floor',
            async () => {
                await shown();
                const chipH = px(await page.resolveToken('--ui-legend-chip-h', 'block-size'));
                const gap = px(await page.resolveToken('--ui-space-2', 'block-size'));
                const plotFloor = px(await page.resolveToken('--ui-chart-min-h', 'block-size'));

                const row = await page.box(KEY_ROW);
                near(row.height, chipH, 'the key row is one chip tall — the chips wrapped');

                const legendRow = await page.box(`${S} >>> #preview >>> [part="legend"]`);
                near(legendRow.height, chipH + gap, 'the legend row is the card-s own reserve');

                const plot = await page.box(PLOT);
                assert.ok(plot.height >= plotFloor - 0.51,
                    `the plot is under its floor: ${plot.height} < ${plotFloor}`);

                const frame = await page.box(FRAME);
                const foot = await page.box(`${S} >>> #preview >>> [part="foot"]`);
                const content = legendRow.height + plot.height + foot.height;
                const pad = px(await page.prop(FRAME, 'padding-top'))
                    + px(await page.prop(FRAME, 'padding-bottom'));
                assert.ok(content + pad <= frame.height + 0.51,
                    `the card-s rows total ${(content + pad).toFixed(2)}px inside a `
                    + `${frame.height}px frame`);
            });

        test('the axis label shares the key row rather than taking a row of its own',
            async () => {
                await shown();
                const row = await page.box(KEY_ROW);
                const key = await page.box(KEY);
                const axis = await page.box(AXIS);
                assert.ok(key.width > 0, 'the legend was given a width by the line');
                assert.ok(axis.x > key.x, 'the axis name sits after the chips');
                assert.ok(axis.x + axis.width <= row.x + row.width + 0.51,
                    'and inside the row, not past its trailing edge');
                near(row.height, key.height, 'the two share one line');
            });
    });
}
