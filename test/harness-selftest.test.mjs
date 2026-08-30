/**
 * harness-selftest.test.mjs — the Gate A harness testing itself.
 *
 * THE ONE THAT MATTERS is "two harness instances, concurrently". SCOPE Part 10 §1
 * makes parallel safety a rig requirement of wf-w0a rather than a builder
 * discipline: "the rendering-test harness allocates an ephemeral debug port and a
 * fresh user-data-dir per invocation, so ten or sixteen builders' Chrome sessions
 * never collide ... a fixed-port harness under concurrent builders manufactures
 * exactly the flaky overnight failures §10's re-run rule exists to absorb."
 *
 * A claim like that is worthless untested, because the failure mode is intermittent
 * by nature: a fixed-port harness works perfectly until the night two builders
 * happen to overlap. So this suite runs two full instances at once and asserts they
 * agree on nothing except the answer.
 *
 * The rest are the transport's own unit tests. ws.js is hand-rolled (no node_modules
 * in this tree, and Node 20's WebSocket needs a flag every future `node --test`
 * would have to remember) and the frame reader is exactly the kind of code that
 * works on small messages and breaks on a 200 KB screenshot.
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { launch, BENCH, FLOOR } from './harness/index.js';
import { frame, readFrame } from './harness/ws.js';
import { readDocumentShell, mountDocument, REPO_ROOT } from './harness/server.js';
import { assertFocusUnclipped, shadowSegments } from './harness/assertions.js';

/* ---------------------------------------------------------------------------
 * Splitting a computed shadow, without a browser
 * ------------------------------------------------------------------------- */

test('shadowSegments splits on TOP-LEVEL commas only', () => {
    // The whole point: a naive split(',') cuts `rgba(0, 0, 0, 0)` into four pieces and
    // `color(srgb 0 0 0 / 0)` into one, so the two colour serialisations Chrome uses
    // would behave differently in the same assertion. selectionSurface composes
    // (`var(--_ui-rest-shadow, 0 0 transparent), <the dial's own>`), so the segment
    // boundary is what tells a component's resting seam from the dial's LED.
    assert.deepEqual(
        shadowSegments('rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgb(18, 24, 28) 0px -4px 0px 0px inset'),
        ['rgba(0, 0, 0, 0) 0px 0px 0px 0px', 'rgb(18, 24, 28) 0px -4px 0px 0px inset'],
    );
    assert.deepEqual(
        shadowSegments('rgba(0, 0, 0, 0) 0px 0px 0px, color(srgb 0.07 0.09 0.11 / 0.6) 0px 0px 6px'),
        ['rgba(0, 0, 0, 0) 0px 0px 0px', 'color(srgb 0.07 0.09 0.11 / 0.6) 0px 0px 6px'],
    );
    assert.deepEqual(shadowSegments('none'), ['none']);
    assert.deepEqual(shadowSegments(''), []);
    assert.equal(shadowSegments('rgba(30, 42, 50, 0.11) 1px 0px 0px 0px inset').length, 1);
});

/* ---------------------------------------------------------------------------
 * The transport, without a browser
 * ------------------------------------------------------------------------- */

test('ws: a frame survives the round trip at every length encoding', () => {
    // 125 is the last 7-bit length, 126 the first 16-bit one, 65536 the first 64-bit.
    for (const len of [0, 1, 125, 126, 127, 65535, 65536, 200000]) {
        const payload = Buffer.alloc(len, 0x61);
        const wire = frame(0x1, payload);
        // Unmask by hand: the reader refuses masked inbound frames, as the RFC says
        // a server must never mask, so the test re-frames it the way Chrome would.
        const parsed = readFrame(unmask(wire));
        assert.ok(parsed, `no frame parsed at length ${len}`);
        assert.equal(parsed.opcode, 0x1);
        assert.equal(parsed.payload.length, len);
        assert.equal(parsed.rest.length, 0);
    }
});

test('ws: a partial frame yields null rather than a wrong read', () => {
    const wire = unmask(frame(0x1, Buffer.from('x'.repeat(300))));
    for (const cut of [0, 1, 2, 3, 4, 100, wire.length - 1]) {
        assert.equal(readFrame(wire.subarray(0, cut)), null, `cut at ${cut} should be incomplete`);
    }
    assert.ok(readFrame(wire), 'the whole frame should parse');
});

test('ws: two frames in one buffer parse in order, leaving no residue', () => {
    const a = unmask(frame(0x1, Buffer.from('first')));
    const b = unmask(frame(0x1, Buffer.from('second')));
    const one = readFrame(Buffer.concat([a, b]));
    assert.equal(one.payload.toString(), 'first');
    const two = readFrame(one.rest);
    assert.equal(two.payload.toString(), 'second');
    assert.equal(two.rest.length, 0);
});

test('ws: a masked inbound frame is a protocol error, not a silent mis-read', () => {
    assert.throws(() => readFrame(frame(0x1, Buffer.from('hi'))), /masked/);
});

/** Turn a client frame into the server-shaped (unmasked) frame the reader expects. */
function unmask(wire) {
    const lenByte = wire[1] & 0x7f;
    let headerLen = 2;
    if (lenByte === 126) headerLen = 4;
    else if (lenByte === 127) headerLen = 10;
    const mask = wire.subarray(headerLen, headerLen + 4);
    const payload = wire.subarray(headerLen + 4);
    const out = Buffer.allocUnsafe(payload.length);
    for (let i = 0; i < payload.length; i++) out[i] = payload[i] ^ mask[i & 3];
    const header = Buffer.from(wire.subarray(0, headerLen));
    header[1] &= 0x7f; // clear the mask bit
    return Buffer.concat([header, out]);
}

/* ---------------------------------------------------------------------------
 * The mount document is derived from index.html, not copied
 * ------------------------------------------------------------------------- */

test('server: the mount document carries index.html\'s own importmap and sheets', async () => {
    const shell = await readDocumentShell(REPO_ROOT);
    const map = JSON.parse(shell.importmap);
    assert.ok(map.imports.lit, 'the importmap must resolve `lit` — every component imports it');
    assert.ok(shell.links.length >= 3, `expected the three global sheets, got ${shell.links.length}`);

    const doc = mountDocument(shell, { theme: 'dark' });
    assert.match(doc, /data-theme="dark"/);
    assert.match(doc, /id="mount"/);
    for (const link of shell.links) assert.ok(doc.includes(link), `mount document dropped ${link}`);
    // Derived, not copied: if index.html loses its importmap this throws instead of
    // silently testing a document the app does not serve.
    assert.ok(doc.includes(shell.importmap));

    /* AND THE VIEWPORT META, for the same reason and with a sharper edge. It was a
     * literal in mountDocument until 27 August 2026, when index.html declared
     * `user-scalable=no` to close the zoom trap Ben hit and the harness's copy did not
     * follow. Browser scaling is an ENGINE-LEVEL difference between two documents, so a
     * stale copy makes every mounted component lay out under rules the app does not
     * ship. Asserting the two strings are the one string is the whole guard. */
    assert.ok(shell.viewport.startsWith('<meta name="viewport"'),
        `readDocumentShell did not find index.html's viewport meta, got ${shell.viewport}`);
    assert.ok(doc.includes(shell.viewport),
        'the mount document does not carry index.html\'s own viewport meta');
});

/* ---------------------------------------------------------------------------
 * Parallel safety — the rig requirement
 * ------------------------------------------------------------------------- */

test('two harness instances run concurrently without colliding', async () => {
    const [a, b] = await Promise.all([launch(), launch()]);
    const profiles = [a.connection.browser.profileDir, b.connection.browser.profileDir];
    const pids = [a.connection.browser.pid, b.connection.browser.pid];

    try {
        // Ephemeral by construction, on all three of the resources that can collide.
        assert.notEqual(a.connection.browser.port, b.connection.browser.port, 'CDP ports collided');
        assert.notEqual(a.server.port, b.server.port, 'static server ports collided');
        assert.notEqual(profiles[0], profiles[1], 'user-data-dirs collided');
        assert.notEqual(a.connection.browser.pid, b.connection.browser.pid);

        // And they actually work at the same time, which is the claim under test —
        // two browsers, two servers, two different geometries, interleaved.
        const [ga, gb] = await Promise.all([
            a.withPage({ geometry: BENCH }, async (page) => {
                await page.mount('<base-fixture></base-fixture>', ['/test/fixtures/base-fixture.js']);
                return page.eval('JSON.stringify({dpr: devicePixelRatio, w: innerWidth, h: innerHeight})');
            }),
            b.withPage({ geometry: FLOOR }, async (page) => {
                await page.mount('<base-fixture></base-fixture>', ['/test/fixtures/base-fixture.js']);
                return page.eval('JSON.stringify({dpr: devicePixelRatio, w: innerWidth, h: innerHeight})');
            }),
        ]);

        assert.deepEqual(JSON.parse(ga), { dpr: 1.5, w: BENCH.width, h: BENCH.height });
        assert.deepEqual(JSON.parse(gb), { dpr: 1, w: FLOOR.width, h: FLOOR.height });
    } finally {
        await Promise.all([a.close(), b.close()]);
    }

    // Cleaned up after: ten builders a night, thirteen waves, is a lot of profiles —
    // and "usually cleans up" is a pile. Both halves are asserted because both leaked
    // in the first version of cdp.js: the profile directory, and the process GROUP
    // (killing only the parent leaves the zygotes and renderers alive, holding the
    // directory open, which is what made the rm lose its race).
    for (const dir of profiles) {
        assert.equal(fs.existsSync(dir), false, `profile directory left behind: ${dir}`);
    }
    for (const pid of pids) {
        assert.throws(
            () => process.kill(pid, 0),
            /ESRCH/,
            `Chrome process ${pid} survived close()`,
        );
    }
});

/* ---------------------------------------------------------------------------
 * The harness's own API, once, so a component suite can trust it
 * ------------------------------------------------------------------------- */

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

test('the harness reads computed style, box geometry and the shadow tree', async () => {
    await browser.withPage({ geometry: BENCH }, async (page) => {
        const tags = await page.mount('<base-fixture></base-fixture>', ['/test/fixtures/base-fixture.js']);
        assert.deepEqual(tags, ['base-fixture']);
        assert.deepEqual(page.pageErrors, []);

        // Deep selector: the element is inside a shadow root, so document.querySelector
        // cannot see it and a source-text scan would not know it exists.
        assert.equal(await page.exists('#plain'), false, 'a light-DOM query must not find shadow content');
        assert.equal(await page.exists('base-fixture >>> #plain'), true);

        const box = await page.box('base-fixture >>> #plain');
        assert.ok(box.width > 0 && box.height > 0, 'a laid-out element has a box');

        const anchor = await page.anchorPath('base-fixture >>> #plain');
        assert.match(anchor, /base-fixture ▸ div ▸ button#plain$/);
    });
});

test('the harness dispatches real input through the browser\'s hit test', async () => {
    await browser.withPage({ geometry: BENCH }, async (page) => {
        await page.mount('<base-fixture></base-fixture>', ['/test/fixtures/base-fixture.js']);
        await page.recordEvents('base-fixture', ['click']);

        // CDP coordinates, not element.click(): Chrome decides what is under the
        // point. This is the half a screenshot gate cannot see (Part 8 §3 Rule 1).
        await page.click('base-fixture >>> #plain');
        const events = await page.recordedEvents();
        assert.equal(events.length, 1, 'a real click at the element centre should land on it');
        assert.equal(events[0].type, 'click');
    });
});

test('the harness reaches :focus-visible after a pointer interaction', async () => {
    await browser.withPage({ geometry: BENCH }, async (page) => {
        await page.mount('<base-fixture></base-fixture>', ['/test/fixtures/base-fixture.js']);

        const scriptFocus = (sel) => page.evalFn(
            (s) => (window.__h.need(s).focus(), window.__h.need(s).matches(':focus-visible')),
            sel,
        );

        // MEASURED, and the reason focusVisible() exists. On a page with no
        // interaction yet, Chrome does match :focus-visible on a programmatic focus —
        // so a naive suite passes. One real mouse click puts the page into pointer
        // modality and the same call stops matching, which is how a focus-ring
        // assertion silently becomes vacuous halfway through a suite that also
        // clicks things.
        assert.equal(await scriptFocus('base-fixture >>> #plain'), true, 'fresh page: script focus does match');
        await page.click('base-fixture >>> #tab');
        assert.equal(await scriptFocus('base-fixture >>> #plain'), false, 'after a pointer interaction it does not');

        // focusVisible() sends a real Tab first, restoring keyboard modality.
        await page.focusVisible('base-fixture >>> #plain');
        const geom = await page.focusGeometry('base-fixture >>> #plain');
        assert.equal(geom.focusVisible, true);
    });
});

test('a page that is not the front tab still reaches :focus-visible', async () => {
    // THE OTHER HALF OF THE MODALITY PROBLEM, and wave 0a review finding rig-1:
    // keyboard modality is not enough if the DOCUMENT does not have focus. An
    // unfocused document is :focus but never :focus-visible, Chrome computes
    // `outline-style: none`, and every ring assertion fails with no clue why —
    // MEASURED as 8 failures in 10 isolated runs of base-fixture.render.test.mjs,
    // always in the second geometry block, and invisible under `node --test test/`
    // where concurrent load happened to hide it.
    //
    // A suite opens one page per test, so pages come and go under one browser and
    // nothing guarantees the one being measured is the front tab. This asserts the
    // property newPage() now installs (Emulation.setFocusEmulationEnabled) by
    // measuring a page that is DEMONSTRABLY not the front one.
    const first = await browser.newPage({ geometry: BENCH });
    const second = await browser.newPage({ geometry: BENCH });   // takes the front
    try {
        await first.mount('<base-fixture></base-fixture>', ['/test/fixtures/base-fixture.js']);
        assert.equal(
            await first.eval('document.hasFocus()'), true,
            'a background page must still report focus, or :focus-visible cannot match',
        );
        await first.focusVisible('base-fixture >>> #clipped');
        const geom = await first.focusGeometry('base-fixture >>> #clipped');
        assert.equal(geom.focusVisible, true);
        assert.notEqual(geom.outlineStyle, 'none', 'an unfocused document paints no ring at all');
    } finally {
        await second.close();
        await first.close();
    }
});

test('the clipping walk measures the scrollport, not the border box', async () => {
    // Wave 0a review finding rig-4. CSS clips overflow at the PADDING edge, so a ring
    // that sits inside a clipping ancestor's own border is invisible on screen — and
    // the walk, which recorded getBoundingClientRect(), called it unclipped. The base
    // fixture's .band has no border, which is exactly why nothing caught it.
    await browser.withPage({ geometry: BENCH }, async (page) => {
        await page.mount('<base-fixture></base-fixture>', ['/test/fixtures/base-fixture.js']);

        // As shipped: a borderless clipper clips at its border box, and the fixture's
        // inset ring is clean. This half is the no-regression half.
        await page.focusVisible('base-fixture >>> #clipped');
        const plain = (await page.focusGeometry('base-fixture >>> #clipped')).clippers[0];
        assert.deepEqual(
            [plain.top, plain.left, plain.bottom, plain.right],
            [plain.borderBox.top, plain.borderBox.left, plain.borderBox.bottom, plain.borderBox.right],
            'with no border the clip edge and the border box coincide',
        );

        // Give the clipper a 6px border and push the ring out into it: 3px of ring at
        // a 2px offset lands inside the border band — inside the border box, outside
        // the padding box, and invisible.
        await page.setStyle('base-fixture >>> .band', { border: '6px solid transparent' });
        await page.setStyle('base-fixture >>> #clipped', { '--_ui-focus-offset': '2px' });
        await page.focusVisible('base-fixture >>> #clipped');
        const g = await page.focusGeometry('base-fixture >>> #clipped');
        const c = g.clippers[0];

        assert.ok(
            Math.abs((c.top - c.borderBox.top) - 6) < 0.5 && Math.abs((c.borderBox.right - c.right) - 6) < 0.5,
            `the clip edge should be 6px inside the border box: clip ${c.top}/${c.right} ` +
            `vs border box ${c.borderBox.top}/${c.borderBox.right}`,
        );
        assert.ok(
            g.ringRect.top < c.top && g.ringRect.top > c.borderBox.top,
            'the ring must land in the border band, or this canary proves nothing',
        );
        await assert.rejects(
            () => assertFocusUnclipped(page, 'base-fixture >>> #clipped'),
            /ring is clipped/,
            'a ring hidden inside the clipper\'s border must be reported as bug L24\'s class',
        );
    });
});
