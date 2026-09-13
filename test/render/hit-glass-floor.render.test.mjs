/**
 * The smallest a touch target may be on glass: `--ui-hit-min`'s 48 DESIGN units are not
 * 48 rendered pixels once the fit scales the page, so the floor holds the rendered size.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES, FLOOR, BENCH, DESKTOP } from '../harness/index.js';
import { MIN_GLASS_HIT, HIT_FLOOR_PROPERTY } from '../../src/lib/app-fit.js';

const MODULE = ['/src/components/ui-keycap.js'];

const MARKUP = '<div id="stage" style="inline-size: 640px"><ui-keycap id="key">K</ui-keycap></div>';

/** The overlay's own box, in DESIGN units, and the ink it sits on. */
const boxes = (page) => page.evalFn(() => {
    const face = window.__h.need('#key >>> #cap');
    const pseudo = getComputedStyle(face, '::before');
    const ink = face.getBoundingClientRect();
    return {
        hitW: parseFloat(pseudo.width),
        hitH: parseFloat(pseudo.height),
        inkW: ink.width,
        inkH: ink.height,
    };
});

/** A mounted component is not under the fit, so both halves it publishes are set here. */
const atScale = async (page, scale) => {
    await page.setToken('--ui-app-scale', String(scale));
    await page.setToken(HIT_FLOOR_PROPERTY, `${MIN_GLASS_HIT / scale}px`);
    await page.settle(2);
};

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`the hit floor on glass @ ${geometry.name}`, () => {
        const mounted = (fn) => browser.withPage({ geometry }, async (page) => {
            await page.mount(MARKUP, MODULE);
            assert.deepEqual(page.pageErrors, []);
            return fn(page);
        });

        test('with no fit at all the box is the design floor', () => mounted(async (page) => {
            const seen = await boxes(page);
            const floor = parseFloat(await page.resolveToken('--ui-hit-min', 'inline-size'));
            assert.ok(floor > 0, `the token resolves (${floor})`);
            assert.equal(Math.max(seen.hitW, floor), seen.hitW,
                `an unfitted mounting lost the design floor (${seen.hitW} against ${floor})`);
            assert.equal(seen.hitH, Math.max(seen.inkH, floor),
                'an unfitted mounting is not max(ink, --ui-hit-min) any more');
        }));

        test('at scale 1 nothing about the box moves', () => mounted(async (page) => {
            const unfitted = await boxes(page);
            await atScale(page, 1);
            const seen = await boxes(page);
            assert.deepEqual(seen, unfitted, 'scale 1 is unfitted, and nothing about it may move');
        }));

        test('under the fit the hit box is never smaller than the floor on glass',
            () => mounted(async (page) => {
                for (const scale of [0.6675, 0.5]) {
                    await atScale(page, scale);
                    const seen = await boxes(page);
                    assert.ok(seen.hitW * scale >= MIN_GLASS_HIT - 0.02,
                        `inline at scale ${scale}: ${(seen.hitW * scale).toFixed(2)} rendered px, floor ${MIN_GLASS_HIT}`);
                    assert.ok(seen.hitH * scale >= MIN_GLASS_HIT - 0.02,
                        `block at scale ${scale}: ${(seen.hitH * scale).toFixed(2)} rendered px, floor ${MIN_GLASS_HIT}`);
                }
            }));

        test('and the paint does not move one pixel', () => mounted(async (page) => {
            const unfitted = await boxes(page);
            await atScale(page, 0.5);
            const seen = await boxes(page);
            assert.equal(seen.inkW, unfitted.inkW,
                `the ink widened from ${unfitted.inkW} to ${seen.inkW} — the floor is not paint-free`);
            assert.equal(seen.inkH, unfitted.inkH,
                `the ink grew taller from ${unfitted.inkH} to ${seen.inkH} — the floor is not paint-free`);
            assert.ok(seen.hitH > unfitted.hitH, 'the hit box did not grow at all');
        }));

        test('the floor is a dial, not a literal', () => mounted(async (page) => {
            await atScale(page, 0.5);
            const before_ = (await boxes(page)).hitH;
            await page.setToken(HIT_FLOOR_PROPERTY, '200px');
            await page.settle(2);
            const after_ = (await boxes(page)).hitH;
            assert.ok(after_ > before_, `moving the floor moves the box (${before_} then ${after_})`);
        }));
    });
}

describe('the shipped page, measured', () => {
    for (const geometry of [FLOOR, BENCH, DESKTOP]) {
        test(`the favourite discs clear the floor on glass @ ${geometry.name}`, async () => {
            const page = await browser.newPage({ geometry });
            try {
                await page.goto('/index.html#/selector');
                /* The screen's module loads after the document, not with it. */
                const ready = await page.evalFn(async () => {
                    const deadline = performance.now() + 5000;
                    while (performance.now() < deadline) {
                        const app = document.querySelector('app-root');
                        const selector = app?.shadowRoot?.querySelector('selector-screen');
                        const slots = [...(selector?.shadowRoot?.querySelector('#favourites')
                            ?.querySelectorAll('ui-favourite-slot') ?? [])];
                        if (app?.phase === 'ready' && slots.length > 0 && slots.every((slot) => {
                            const box = slot.shadowRoot?.querySelector('.hit-overlay')
                                ?.getBoundingClientRect();
                            return box && box.width > 0 && box.height > 0;
                        })) return true;
                        await new Promise(requestAnimationFrame);
                    }
                    return false;
                });
                assert.ok(ready, 'the selector favourite controls did not render within 5 seconds');
                await page.settle(4);
                const seen = await page.evalFn((prop) => {
                    const found = [];
                    const walk = (root) => {
                        for (const el of root.querySelectorAll('*')) {
                            if (el.classList.contains('hit-overlay')) found.push(el);
                            if (el.shadowRoot) walk(el.shadowRoot);
                        }
                    };
                    walk(document);
                    const scale = parseFloat(getComputedStyle(document.documentElement)
                        .getPropertyValue('--ui-app-scale')) || 1;
                    return {
                        scale,
                        published: getComputedStyle(document.documentElement)
                            .getPropertyValue(prop).trim(),
                        boxes: found.map((el) => {
                            const pseudo = getComputedStyle(el, '::before');
                            return {
                                w: parseFloat(pseudo.width) * scale,
                                h: parseFloat(pseudo.height) * scale,
                            };
                        }).filter((b) => b.w > 0),
                    };
                }, HIT_FLOOR_PROPERTY);

                /* An unwritten custom property reads back as '' and parses to NaN, and
                 * every comparison against NaN passes — so prove it is a number first. */
                const published = parseFloat(seen.published);
                assert.ok(Number.isFinite(published) && published > 0,
                    `the fit published no hit floor (${JSON.stringify(seen.published)})`);
                assert.ok(Math.abs(published * seen.scale - MIN_GLASS_HIT) < 0.02,
                    `the published floor renders as ${(published * seen.scale).toFixed(2)}, not ${MIN_GLASS_HIT}`);

                assert.ok(seen.boxes.length > 0, 'the screen drew no hit-overlay control');
                for (const box of seen.boxes) {
                    assert.ok(box.w >= MIN_GLASS_HIT - 0.02,
                        `a hit box is ${box.w.toFixed(2)} rendered px wide against a floor of ${MIN_GLASS_HIT}`);
                    assert.ok(box.h >= MIN_GLASS_HIT - 0.02,
                        `a hit box is ${box.h.toFixed(2)} rendered px tall against a floor of ${MIN_GLASS_HIT}`);
                }
            } finally {
                await page.close();
            }
        });
    }
});
