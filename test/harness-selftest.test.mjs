/**
 * the render harness harness testing itself.
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { launch, BENCH, FLOOR } from './harness/index.js';
import { frame, readFrame } from './harness/ws.js';
import { readDocumentShell, mountDocument, REPO_ROOT } from './harness/server.js';
import { assertFocusUnclipped, shadowSegments } from './harness/assertions.js';

test('shadowSegments splits on TOP-LEVEL commas only', () => {
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

test('ws: a frame survives the round trip at every length encoding', () => {
    // 125 is the last 7-bit length, 126 the first 16-bit one, 65536 the first 64-bit.
    for (const len of [0, 1, 125, 126, 127, 65535, 65536, 200000]) {
        const payload = Buffer.alloc(len, 0x61);
        const wire = frame(0x1, payload);
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

test('server: the mount document carries index.html\'s own importmap and sheets', async () => {
    const shell = await readDocumentShell(REPO_ROOT);
    const map = JSON.parse(shell.importmap);
    assert.ok(map.imports.lit, 'the importmap must resolve `lit` — every component imports it');
    assert.ok(shell.links.length >= 3, `expected the three global sheets, got ${shell.links.length}`);

    const doc = mountDocument(shell, { theme: 'dark' });
    assert.match(doc, /data-theme="dark"/);
    assert.match(doc, /id="mount"/);
    for (const link of shell.links) assert.ok(doc.includes(link), `mount document dropped ${link}`);
    assert.ok(doc.includes(shell.importmap));

    assert.ok(shell.viewport.startsWith('<meta name="viewport"'),
        `readDocumentShell did not find index.html's viewport meta, got ${shell.viewport}`);
    assert.ok(doc.includes(shell.viewport),
        'the mount document does not carry index.html\'s own viewport meta');
});

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

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

test('the harness reads computed style, box geometry and the shadow tree', async () => {
    await browser.withPage({ geometry: BENCH }, async (page) => {
        const tags = await page.mount('<base-fixture></base-fixture>', ['/test/fixtures/base-fixture.js']);
        assert.deepEqual(tags, ['base-fixture']);
        assert.deepEqual(page.pageErrors, []);

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
    await browser.withPage({ geometry: BENCH }, async (page) => {
        await page.mount('<base-fixture></base-fixture>', ['/test/fixtures/base-fixture.js']);

        await page.focusVisible('base-fixture >>> #clipped');
        const plain = (await page.focusGeometry('base-fixture >>> #clipped')).clippers[0];
        assert.deepEqual(
            [plain.top, plain.left, plain.bottom, plain.right],
            [plain.borderBox.top, plain.borderBox.left, plain.borderBox.bottom, plain.borderBox.right],
            'with no border the clip edge and the border box coincide',
        );

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
