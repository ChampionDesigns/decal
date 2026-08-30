/**
 * overlay-surfaces.render.test.mjs — wave 5.2 (wf-w5p2-overlays), the SURFACES cluster.
 *
 * Part 10 §12's row for this wave says the phase "integrates and proves"; it builds no
 * overlay machinery. #21 (menu), #22 (toast) and #57 (screensaver) each already have a
 * rendering suite that passes. This file is the suite for the space BETWEEN them, which
 * is the only place the defects this wave owns can live:
 *
 *   O11 (spec §7.7:1228) "A context menu taller than the viewport loses its LAST items."
 *        ui-menu.render.test.mjs drives ONE anchor position. Slate's own clamp
 *        (`context-menu.js:44`) is a top-only clamp, so the edge a bug hides behind is
 *        whichever edge nobody drove. Here the anchor is driven to ALL FOUR, eight
 *        positions, five rows and forty, at both standard geometries.
 *   O2  (spec §7.7:1219) "slate-shell.css:935-954 re-declares the context menu UNSCOPED
 *        and later, and box-shadow: none kills its elevation." ITEMS row x-menu says
 *        "structurally impossible under Shadow DOM but CONFIRM ON SCREEN" — so the
 *        override Slate wrote is written into the page here, `!important` and all, and
 *        the elevation is measured through it.
 *   D10 (SCOPE:218) "Screensaver: fully black, one owner — the skin." ITEMS row
 *        screensaver-d10's acceptance is "fully black (no residual paint)", and the only
 *        instrument that reads that claim is the frame buffer. Every pixel of a real
 *        screenshot is compared to black, with the other four surfaces on screen under it.
 *
 * WHAT THIS SUITE FOUND, and why it exists (recorded here because the fix is invisible
 * without it): the token file puts --ui-z-blackout (400) above --ui-z-toast (300) exactly
 * so a notice cannot paint on a blanked screen — Slate's numbers are the other way round
 * (toast 10001 `index.html:657` over screensaver 10000 `ui.js:1412`) and that is the
 * defect the scale was written to kill. Both components promote themselves into the TOP
 * LAYER, which is ordered by ENTRY and not by z-index, so on the first measurement a
 * `danger` notice raised after the blank put 24,031 non-black pixels on a screen D10 says
 * is black. Neither component's own suite could see it. `ui-screensaver`'s `#watchLayer()`
 * is the repair; §5 below is the gate that keeps it.
 *
 * AND WHAT §4 NOW GATES (DQ-565, Ben's policy, 21 August 2026). The other pair — a notice
 * on screen, then a modal opened over it — was measured, pinned and NOT fixed by wave 5.2,
 * because the answer was a policy call. Ben adopted it: a `danger`-tone notice re-takes the
 * top layer above a modal. `ui-toast.js`'s `#syncDangerWatch()` / `#onForeignOpen()` is that
 * repair, and §4's second test is now the positive assertion plus the tone gate. It listens
 * to `open-change` alone, which is why §5's D10 gate below is untouched: #57 announces no
 * `open-change`, so the blank still re-takes last and the settled order is
 * blank > danger notice > dialog.
 *
 * THE INSTRUMENT. Gate A is computed styles and box geometry, never source text — but
 * "fully black" and "the notice paints above the scrim" are claims about PAINT, and a
 * rect proves neither (the notice under the scrim had a perfectly good rect; that is
 * finding cross-1). So this file adds one instrument: `Page.captureScreenshot` over CDP,
 * decoded here. It is used for exactly the three claims that are about pixels and for
 * nothing else.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';

const MODULES = [
    '/src/components/ui-menu.js',
    '/src/components/ui-toast.js',
    '/src/components/ui-screensaver.js',
    '/src/components/ui-dialog.js',
    '/src/components/ui-section-header.js',
    '/src/components/ui-button.js',
];

/* ---------------------------------------------------------------------------
 * The one new instrument: a real frame, decoded.
 * ------------------------------------------------------------------------- */

/**
 * The 8-bit, non-interlaced subset of PNG that `Page.captureScreenshot` emits.
 *
 * Written here rather than in `test/harness/` deliberately: three assertions in one file
 * need it, and a shared helper is a thing other suites start reaching for by habit — the
 * rig's rule is computed styles and geometry, and pixels are the exception that has to
 * keep justifying itself.
 */
function decodePng(buf) {
    assert.equal(buf.readUInt32BE(0), 0x89504e47, 'not a PNG');
    let off = 8;
    let width = 0; let height = 0; let depth = 0; let colour = 0; let interlace = 0;
    const idat = [];
    while (off < buf.length) {
        const len = buf.readUInt32BE(off);
        const tag = buf.toString('ascii', off + 4, off + 8);
        const data = buf.subarray(off + 8, off + 8 + len);
        if (tag === 'IHDR') {
            width = data.readUInt32BE(0);
            height = data.readUInt32BE(4);
            depth = data[8]; colour = data[9]; interlace = data[12];
        } else if (tag === 'IDAT') idat.push(data);
        else if (tag === 'IEND') break;
        off += 12 + len;
    }
    assert.equal(depth, 8, `unsupported bit depth ${depth}`);
    assert.equal(interlace, 0, 'unsupported interlaced PNG');
    const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colour];
    assert.ok(channels, `unsupported colour type ${colour}`);

    const raw = zlib.inflateSync(Buffer.concat(idat));
    const stride = width * channels;
    const out = Buffer.alloc(height * stride);
    let p = 0;
    for (let y = 0; y < height; y++) {
        const filter = raw[p++];
        const line = raw.subarray(p, p + stride);
        p += stride;
        const cur = out.subarray(y * stride, (y + 1) * stride);
        const prev = y ? out.subarray((y - 1) * stride, y * stride) : null;
        for (let x = 0; x < stride; x++) {
            const a = x >= channels ? cur[x - channels] : 0;
            const b = prev ? prev[x] : 0;
            const c = prev && x >= channels ? prev[x - channels] : 0;
            let v = line[x];
            if (filter === 1) v += a;
            else if (filter === 2) v += b;
            else if (filter === 3) v += (a + b) >> 1;
            else if (filter === 4) {
                const guess = a + b - c;
                const pa = Math.abs(guess - a); const pb = Math.abs(guess - b); const pc = Math.abs(guess - c);
                v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
            }
            cur[x] = v & 0xff;
        }
    }
    return { width, height, channels, data: out };
}

const pixelAt = (img, x, y) => {
    const i = (y * img.width + x) * img.channels;
    return [img.data[i], img.data[i + 1], img.data[i + 2]];
};

/** Every pixel that is not pure black, with the first one named for the failure message. */
function nonBlack(img) {
    let count = 0;
    let first = null;
    for (let y = 0; y < img.height; y++) {
        for (let x = 0; x < img.width; x++) {
            const [r, g, b] = pixelAt(img, x, y);
            if (r || g || b) {
                count += 1;
                if (!first) first = { x, y, rgb: [r, g, b] };
            }
        }
    }
    return { count, first, total: img.width * img.height };
}

/** A whole emulated frame, decoded. */
const frame = async (page) => decodePng(await page.screenshot());

const rgb = ([r, g, b]) => `rgb(${r}, ${g}, ${b})`;

/**
 * The share of a CSS-pixel rect that is painted EXACTLY one colour, in the real frame.
 *
 * A share rather than a single sample because a notice has text in it, and a lone centre
 * pixel lands on a glyph as often as on the ground. The inner 70 % is walked so the
 * border, the radius and the tone edge are out of the count.
 */
function groundShare(img, rect, scale, colour) {
    const inset = (v, size) => v + size * 0.15;
    const x0 = Math.round(inset(rect.left, rect.width) * scale);
    const y0 = Math.round(inset(rect.top, rect.height) * scale);
    const x1 = Math.round((rect.left + rect.width * 0.85) * scale);
    const y1 = Math.round((rect.top + rect.height * 0.85) * scale);
    let hit = 0;
    let seen = 0;
    for (let y = Math.max(0, y0); y < Math.min(img.height, y1); y++) {
        for (let x = Math.max(0, x0); x < Math.min(img.width, x1); x++) {
            seen += 1;
            if (rgb(pixelAt(img, x, y)) === colour) hit += 1;
        }
    }
    return { share: seen ? hit / seen : 0, seen };
}

/* ---------------------------------------------------------------------------
 * Fixtures
 * ------------------------------------------------------------------------- */

const attr = (items) => JSON.stringify(items).replaceAll('"', '&quot;');
const FEW = [
    { id: 'rename', label: 'Rename' },
    { id: 'duplicate', label: 'Duplicate' },
    { id: 'delete', label: 'Delete', danger: true },
];
/** Forty rows: taller than either standard geometry, which is O11's whole point. */
const MANY = Array.from({ length: 40 }, (_, i) => ({ id: `row-${i}`, label: `Row ${i + 1}` }));

/**
 * A dock the test moves around the window, with the menu anchored inside it. `position:
 * fixed` so the anchor really is at the window edge and not at the end of a scroll.
 */
const MENU_PAGE = `
<div id="page" style="padding: 40px">
  <h1 id="title">Overlay surfaces</h1>
  <div id="dock" style="position: fixed; inset-block-start: 0; inset-inline-start: 0">
    <ui-menu id="m" label="Profile actions" items="${attr(FEW)}">
      <button id="trig" slot="trigger">Actions</button>
    </ui-menu>
  </div>
</div>`;

/** All five surfaces on one page — the shape a screen actually has. */
const FULL_PAGE = `
<div id="page" style="padding: 24px">
  <ui-section-header id="hdr">Profiles</ui-section-header>
  <h1 id="title" style="font-size: 40px">Overlay surfaces</h1>
  <p id="para">Body copy under the overlays, so a residual paint has something to be.</p>
  <div id="dock" style="position: fixed; inset-block-start: 80px; inset-inline-start: 80px">
    <ui-menu id="m" label="Profile actions" items="${attr(FEW)}">
      <button id="trig" slot="trigger">Actions</button>
    </ui-menu>
  </div>
  <ui-dialog id="d" heading="Save profile">
    <div slot="body" style="block-size: 220px">Dialog body</div>
    <ui-button slot="actions" id="ok">OK</ui-button>
  </ui-dialog>
  <ui-toast id="t"></ui-toast>
  <ui-screensaver id="s" machine-state="idle"></ui-screensaver>
</div>`;

const SURFACE = '#m >>> #surface';
const LIST = '#m >>> #list';

/**
 * The eight anchor positions. Four edges and four corners, expressed the way a screen
 * would — logical insets, so the same fixture is true in either writing mode.
 */
const DOCK_POSITIONS = [
    ['top-start', { 'inset-block-start': '0px', 'inset-inline-start': '0px' }],
    ['top-centre', { 'inset-block-start': '0px', 'inset-inline-start': '50%' }],
    ['top-end', { 'inset-block-start': '0px', 'inset-inline-end': '0px', 'inset-inline-start': 'auto' }],
    ['end-middle', { 'inset-block-start': '50%', 'inset-inline-end': '0px', 'inset-inline-start': 'auto' }],
    ['bottom-end', { 'inset-block-end': '0px', 'inset-block-start': 'auto', 'inset-inline-end': '0px', 'inset-inline-start': 'auto' }],
    ['bottom-centre', { 'inset-block-end': '0px', 'inset-block-start': 'auto', 'inset-inline-start': '50%' }],
    ['bottom-start', { 'inset-block-end': '0px', 'inset-block-start': 'auto', 'inset-inline-start': '0px' }],
    ['start-middle', { 'inset-block-start': '50%', 'inset-inline-start': '0px' }],
];

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`overlay surfaces @ ${geometry.name} (${geometry.width}×${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

        const scale = geometry.deviceScaleFactor;

        const mounted = (fn, markup = MENU_PAGE) => browser.withPage({ geometry }, async (page) => {
            await page.mount(markup, MODULES);
            assert.deepEqual(page.pageErrors, [], 'the surfaces must mount without throwing');
            return fn(page);
        });

        /** Move the dock, then open the menu fresh so the position pass runs against it. */
        const dockAt = async (page, style) => {
            await page.evalFn((s) => { window.__h.need(s).open = false; return true; }, '#m');
            await page.setStyle('#dock', {
                'inset-block-start': 'auto',
                'inset-block-end': 'auto',
                'inset-inline-start': 'auto',
                'inset-inline-end': 'auto',
                ...style,
            });
            await page.evalFn((s) => { window.__h.need(s).show({ focus: 'first', reason: 'test' }); return true; }, '#m');
            await page.settle(3);
        };

        /* ================================================================
         * 1. x-menu — CLAMPED AT EVERY ANCHOR POSITION (O11)
         * ============================================================== */

        test('the surface stays inside the window at all eight anchor positions', () => mounted(async (page) => {
            const edge = parseFloat(await page.resolveValue('var(--ui-space-3)', 'width'));
            const seen = [];
            for (const [name, style] of DOCK_POSITIONS) {
                await dockAt(page, style);
                assert.equal(await page.exists(SURFACE), true, `${name}: the menu did not open`);
                const box = await page.box(SURFACE);
                seen.push([name, box]);
                assert.ok(box.left >= edge - 0.51,
                    `${name}: the surface starts at ${box.left}, inside the ${edge}px edge padding`);
                assert.ok(box.right <= geometry.width - edge + 0.51,
                    `${name}: the surface ends at ${box.right} in a ${geometry.width}px window`);
                assert.ok(box.top >= edge - 0.51,
                    `${name}: the surface top is ${box.top}, above the edge padding`);
                assert.ok(box.bottom <= geometry.height - edge + 0.51,
                    `${name}: the surface bottom is ${box.bottom} in a ${geometry.height}px window — `
                    + 'Slate clamps `top` only (context-menu.js:44) and lets the other three edges run off');
                assert.ok(box.width > 0 && box.height > 0, `${name}: the surface has no box`);
            }
            /* A clamp that pinned every position to the same place would pass all four
             * inequalities and be useless, so the anchor must actually have moved. */
            const lefts = new Set(seen.map(([, b]) => Math.round(b.left)));
            const tops = new Set(seen.map(([, b]) => Math.round(b.top)));
            assert.ok(lefts.size >= 3, `the surface never moved inline: ${[...lefts]}`);
            assert.ok(tops.size >= 2, `the surface never moved block-wise: ${[...tops]}`);
        }));

        test('O11: forty rows stay inside the window at all eight positions, and the LAST row is reachable',
            () => mounted(async (page) => {
                await page.evalFn((s, items) => { window.__h.need(s).items = items; return true; }, '#m', MANY);
                await page.settle(2);
                const edge = parseFloat(await page.resolveValue('var(--ui-space-3)', 'width'));

                for (const [name, style] of DOCK_POSITIONS) {
                    await dockAt(page, style);
                    const box = await page.box(SURFACE);
                    assert.ok(box.top >= edge - 0.51 && box.bottom <= geometry.height - edge + 0.51,
                        `${name}: a forty-row menu spans [${box.top}, ${box.bottom}] in a ${geometry.height}px window`);

                    const metrics = await page.metrics(LIST);
                    assert.ok(metrics.scrollHeight > metrics.clientHeight + 0.5,
                        `${name}: forty rows did not overflow — the assertion below would be vacuous`);
                    assert.equal(metrics.overflowY, 'auto', `${name}: a stated overflow, never a silent clip`);

                    /* THE BUG, DRIVEN. Not "is the menu tall enough" but "can the user
                     * get to row forty" — which is the half a screenshot cannot see. */
                    await page.press('End');
                    await page.settle(1);
                    const last = await page.evalFn(() => {
                        const el = window.__h.deepActiveElement();
                        const r = el.getBoundingClientRect();
                        const label = (el.querySelector('.label') || el).textContent.trim();
                        return { label, top: r.top, bottom: r.bottom };
                    });
                    assert.equal(last.label, `Row ${MANY.length}`,
                        `${name}: End reached "${last.label}", not the fortieth row`);
                    const port = await page.metrics(LIST);
                    assert.ok(last.top >= port.rect.top - 0.51 && last.bottom <= port.rect.bottom + 0.51,
                        `${name}: row forty [${last.top}, ${last.bottom}] is outside the scrollport `
                        + `[${port.rect.top}, ${port.rect.bottom}] — this is O11`);
                }
            }));

        /* ================================================================
         * 2. O2 — THE UNSCOPED SHELL OVERRIDE, WRITTEN INTO THE PAGE
         * ============================================================== */

        test('O2: Slate\'s own unscoped override cannot reach the surface\'s elevation', () => mounted(async (page) => {
            await dockAt(page, { 'inset-block-start': '200px', 'inset-inline-start': '200px' });
            const before = await page.prop(SURFACE, 'box-shadow');
            const elevation = await page.resolveValue('var(--ui-elev-2)', 'box-shadow');
            assert.equal(before, elevation, 'the surface must take its elevation from --ui-elev-2 to begin with');
            assert.notEqual(before, 'none');

            /* slate-shell.css:935-954 as written, plus the escalation A8 predicts a shell
             * reaches for when the first override does not win. In the light DOM, where a
             * shell's stylesheet lives. */
            await page.evalFn(() => {
                const style = document.createElement('style');
                style.textContent = `
                    #surface, .surface, .context-menu, .menu, ui-menu, ui-menu * {
                        box-shadow: none !important;
                        background: #ff00ff !important;
                        border-radius: 0 !important;
                    }`;
                document.head.appendChild(style);
                return true;
            });
            await page.settle(2);

            const after = await page.computed(SURFACE, ['box-shadow', 'background-color', 'border-top-left-radius']);
            assert.equal(after['box-shadow'], elevation,
                'O2: an unscoped, later, !important override killed the floating menu\'s elevation in Slate; '
                + 'under Shadow DOM it must not reach the surface at all');
            assert.notEqual(after['background-color'], 'rgb(255, 0, 255)',
                'nor its ground — A8\'s "the platform enforces it", measured');
            assert.ok(parseFloat(after['border-top-left-radius']) > 0, 'nor its radius');
        }));

        /* ================================================================
         * 3. THE Z SCALE — ONE ORDER, READ FROM THE TOKENS
         * ============================================================== */

        test('the five layers are one ascending scale and every consumer reads its own token',
            () => mounted(async (page) => {
                const layer = async (name) => Number(await page.resolveToken(name, 'z-index'));
                const sticky = await layer('--ui-z-sticky');
                const overlay = await layer('--ui-z-overlay');
                const menu = await layer('--ui-z-menu');
                const toast = await layer('--ui-z-toast');
                const blackout = await layer('--ui-z-blackout');
                assert.ok(sticky < overlay && overlay < menu && menu < toast && toast < blackout,
                    `the scale is not ascending: ${[sticky, overlay, menu, toast, blackout]}`);

                await page.evalFn(() => {
                    document.getElementById('s').setAttribute('machine-state', 'sleeping');
                    document.getElementById('t').show('Saved', { tone: 'ok', duration: 0 });
                    window.__h.need('#m').show({ reason: 'test' });
                    return true;
                });
                await page.settle(3);

                assert.equal(await page.prop(SURFACE, 'z-index'), String(menu), 'ui-menu reads --ui-z-menu');
                assert.equal(await page.prop('#t', 'z-index'), String(toast), 'ui-toast reads --ui-z-toast');
                assert.equal(await page.prop('#s', 'z-index'), String(blackout), 'ui-screensaver reads --ui-z-blackout');
                assert.equal(await page.prop('#hdr', 'z-index'), String(sticky),
                    'ui-section-header reads --ui-z-sticky');

                /* #18 declares none, and that is the design: the top layer is not on the z
                 * scale, so a number there would read as load-bearing and be a lie
                 * (ui-dialog.js:112-123, tokens.css:458-459). */
                assert.equal(await page.prop('#d >>> #dialog', 'z-index'), 'auto',
                    'the dialog must not declare a z-index — the top layer is not on the scale');
            }, FULL_PAGE));

        /* ================================================================
         * 4. x-toast ABOVE THE DIALOG — the layer, and the paint (cross-1)
         * ============================================================== */

        test('a notice raised over a modal dialog paints ABOVE the scrim, not under it',
            () => mounted(async (page) => {
                const toastLayer = await page.resolveToken('--ui-z-toast', 'z-index');
                assert.equal(await page.prop('#t', 'z-index'), toastLayer,
                    'the region sits on --ui-z-toast, as a number nobody wrote by hand');

                /* THE ORDER IS THE CASE, and this test proves ONE order: the modal is open
                 * and settled, then something is saved. #18 reaches `showModal()` inside
                 * Lit's `updated()`, a microtask after `show()` returns, so raising the
                 * notice in the same turn would put the REGION in the top layer first and
                 * the dialog in after it, and measure the opposite.
                 *
                 * THAT OPPOSITE IS NOT HYPOTHETICAL and it is not only a same-turn artefact
                 * — finding cross-2. A notice fully settled first and a dialog opened after
                 * it was buried, at both geometries, and the test directly below used to pin
                 * exactly that. SINCE DQ-565 (Ben, 21 August 2026) it no longer holds for
                 * ONE tone: a `danger` notice re-takes the layer over a dialog opened after
                 * it, and the test below is now the positive assertion. This test's own
                 * notice is `ok`, so the claim here is still the narrow one — this order,
                 * any tone — and the wide claim ("a notice always paints above a dialog")
                 * is still not made, because `info`/`ok`/`warn` in the other order are still
                 * buried and are meant to be. */
                await page.evalFn(() => { document.getElementById('d').show({ reason: 'test' }); return true; });
                await page.settle(4);
                assert.equal(await page.evalFn(() => document.getElementById('d').open), true,
                    'the dialog must be open and settled before the notice is raised');

                const raised = await page.evalFn(
                    () => !!document.getElementById('t').show('Saved', { tone: 'ok', duration: 0 }),
                );
                assert.equal(raised, true);
                await page.settle(4);
                /* The entrance transition is real motion; read the settled frame. */
                await page.evalFn(() => new Promise((r) => setTimeout(r, 350)));
                await page.settle(2);

                const notice = await page.evalFn(() => {
                    const t = document.getElementById('t');
                    const n = t.children[t.children.length - 1];
                    const r = n.getBoundingClientRect();
                    return {
                        promoted: t.matches(':popover-open'),
                        background: getComputedStyle(n).backgroundColor,
                        rect: { left: r.left, top: r.top, width: r.width, height: r.height },
                    };
                });
                assert.equal(notice.promoted, true,
                    'a modal <dialog> and its ::backdrop are in the TOP LAYER, which --ui-z-toast cannot reach');
                assert.ok(notice.rect.width > 0 && notice.rect.height > 0, 'the notice has no box');

                /* THE PIXELS. A rect proves nothing here — the notice under the scrim had a
                 * perfectly good rect, which is exactly what made cross-1 expensive. */
                const above = groundShare(await frame(page), notice.rect, scale, notice.background);
                assert.ok(above.seen > 100, `only ${above.seen} pixels sampled — the notice is too small to read`);
                assert.ok(above.share > 0.5,
                    `only ${(above.share * 100).toFixed(1)} % of the notice's inner box paints its own ground `
                    + `(${notice.background}) — the scrim is over the one notice a modal save flow most needs to deliver`);

                /* A/B: the same notice with the promotion taken away reads the SCRIM. Without
                 * this the assertion above passes on a page that has no scrim at all. */
                const under = await page.evalFn(() => {
                    const t = document.getElementById('t');
                    t.hidePopover();
                    t.removeAttribute('popover');
                    return true;
                });
                assert.equal(under, true);
                await page.settle(2);
                const below = groundShare(await frame(page), notice.rect, scale, notice.background);
                /* A DROP, not a floor. MEASURED at the 1000×600 floor: the dialog's own
                 * footer takes the same surface token as the notice and the card reaches
                 * down to y=535 while the notice starts at y=511, so a quarter of the
                 * sampled box paints that exact colour whether the notice is there or not.
                 * The signal is the change, and it is unmissable: 86 % -> 27 %. */
                assert.ok(above.share - below.share > 0.4,
                    `demoting the region moved the notice's ground from ${(above.share * 100).toFixed(1)} % to `
                    + `${(below.share * 100).toFixed(1)} % of the sampled box — too small a change to prove the `
                    + 'scrim is over it, so the measurement above is vacuous');
            }, FULL_PAGE));

        /**
         * THE OTHER ORDER — REPAIRED, AND THIS IS THE GATE (finding cross-2, DQ-565).
         *
         * The test above raises the notice over a dialog that is ALREADY open, which is
         * the save flow's order and the only one wave 5.2 proved. The ordinary opposite —
         * a notice on screen, then a dialog opened inside its 2400 ms default life
         * (DEFAULT_TOAST_DURATION, `ui-toast.js:253`, carried from `ui.js:3283`) — measured
         * the reverse: the notice was BURIED, because the top layer is ordered by ENTRY and
         * `--ui-z-toast` cannot reach into it. A `danger` notice is the assertive
         * announcement (`applyAssertiveRole`) and is precisely the one that must not be
         * hidden, so wave 5.2 pinned the burial rather than fixing it and handed the
         * decision on: `DEFERRED_QUESTIONS_surfaces.md` #5.
         *
         * BEN ADOPTED THE POLICY on 21 August 2026 (DQ-565): "a danger-tone notice re-takes
         * the top layer above a modal (the costed #22 repair)". So this test is now the
         * POSITIVE assertion — the danger notice keeps its own ground with a modal dialog
         * open over it, at both Gate A geometries — and the burial it used to pin is what
         * would make it red.
         *
         * WHAT IT DOES NOT CLAIM. Only `danger` re-takes; the tone gate is asserted at the
         * end of this test with an `info` notice, which is still buried and is meant to be.
         * And the blank still outranks both: §5 below is D10's gate and it is unchanged,
         * because the repair listens to `open-change` alone — #57's re-entry does not emit
         * one, so the settled order is blank > danger notice > dialog.
         */
        test('DQ-565: a danger notice on screen KEEPS the layer when a dialog opens after it',
            () => mounted(async (page) => {
                const raised = await page.evalFn(
                    () => !!document.getElementById('t').show('Scale lost', { tone: 'danger', duration: 0 }),
                );
                assert.equal(raised, true);
                await page.settle(4);
                /* The entrance transition is real motion; read the settled frame. */
                await page.evalFn(() => new Promise((r) => setTimeout(r, 350)));
                await page.settle(2);

                const notice = await page.evalFn(() => {
                    const t = document.getElementById('t');
                    const n = t.children[t.children.length - 1];
                    const r = n.getBoundingClientRect();
                    return {
                        promoted: t.matches(':popover-open'),
                        background: getComputedStyle(n).backgroundColor,
                        rect: { left: r.left, top: r.top, width: r.width, height: r.height },
                    };
                });
                assert.equal(notice.promoted, true, 'the region must be in the top layer before the dialog opens');

                const alone = groundShare(await frame(page), notice.rect, scale, notice.background);
                assert.ok(alone.seen > 100, `only ${alone.seen} pixels sampled — the notice is too small to read`);
                assert.ok(alone.share > 0.5,
                    `the notice paints only ${(alone.share * 100).toFixed(1)} % of its own inner box before the `
                    + 'dialog opens — the comparison below would be vacuous');

                await page.evalFn(() => { document.getElementById('d').show({ reason: 'test' }); return true; });
                await page.settle(4);
                const state = await page.evalFn(() => ({
                    open: document.getElementById('d').open,
                    promoted: document.getElementById('t').matches(':popover-open'),
                }));
                assert.equal(state.open, true, 'the dialog must be open');
                assert.equal(state.promoted, true,
                    'the region is STILL promoted — what follows is the top layer\'s entry order, not a lost '
                    + 'promotion, and reading it as a promotion bug would send the repair to the wrong file');

                const after = groundShare(await frame(page), notice.rect, scale, notice.background);
                assert.ok(alone.share - after.share < 0.1,
                    `the danger notice kept only ${(after.share * 100).toFixed(1)} % of its ground (from `
                    + `${(alone.share * 100).toFixed(1)} %) once the dialog opened — DQ-565's repair is the `
                    + 'microtask re-entry in ui-toast.js #onForeignOpen, armed by #syncDangerWatch while a '
                    + 'danger notice is being paced');
                assert.ok(after.share > 0.5,
                    `the danger notice paints ${(after.share * 100).toFixed(1)} % of its own inner box under an `
                    + 'open dialog — it must be READ, not merely present');

                /* THE TONE GATE, in the same page and the same frame budget: an `info`
                 * notice raised while the same dialog is open is NOT special, and is meant
                 * to lose. Raising it also re-enters the layer for the whole region (that
                 * is what #syncLayer does on every adoption), so the dialog is re-opened
                 * afterwards to put the entry order back the way the claim needs it. */
                await page.evalFn(() => {
                    const t = document.getElementById('t');
                    t.clear('test');
                    document.getElementById('d').open = false;
                    return true;
                });
                await page.settle(4);
                const quiet = await page.evalFn(() => {
                    const t = document.getElementById('t');
                    const n = t.show('Saved', { tone: 'info', duration: 0 });
                    const r = n.getBoundingClientRect();
                    return { background: getComputedStyle(n).backgroundColor,
                        rect: { left: r.left, top: r.top, width: r.width, height: r.height } };
                });
                await page.evalFn(() => new Promise((r) => setTimeout(r, 350)));
                await page.settle(2);
                const quietAlone = groundShare(await frame(page), quiet.rect, scale, quiet.background);
                await page.evalFn(() => { document.getElementById('d').show({ reason: 'test' }); return true; });
                await page.settle(4);
                const quietBuried = groundShare(await frame(page), quiet.rect, scale, quiet.background);
                assert.ok(quietAlone.share - quietBuried.share > 0.4,
                    `an info notice kept ${(quietBuried.share * 100).toFixed(1)} % of its ground (from `
                    + `${(quietAlone.share * 100).toFixed(1)} %) under the dialog — DQ-565 is gated on TONE, and `
                    + 'a region that raised every tone over a modal would be the opposite defect');
            }, FULL_PAGE));

        /* ================================================================
         * 5. D10 — FULLY BLACK, AND IT STAYS BLACK
         * ============================================================== */

        test('D10: with all four other surfaces on screen, the blank is black in every pixel',
            () => mounted(async (page) => {
                /* Everything up first, so "black" is a claim about a busy screen. */
                await page.evalFn(() => {
                    document.getElementById('d').show({ reason: 'test' });
                    document.getElementById('t').show('Saved', { tone: 'ok', duration: 0 });
                    window.__h.need('#m').show({ reason: 'test' });
                    return true;
                });
                await page.settle(4);
                const busy = nonBlack(await frame(page));
                assert.ok(busy.count > busy.total / 4,
                    `only ${busy.count} of ${busy.total} pixels are painted before the blank — `
                    + 'the assertion below would pass on an empty page');

                await page.evalFn(() => {
                    document.getElementById('s').setAttribute('machine-state', 'sleeping');
                    return true;
                });
                await page.settle(4);
                assert.equal(await page.evalFn(() => document.getElementById('s').hasAttribute('active')), true,
                    'the machine confirmed sleep and the blank did not go up');

                const blanked = nonBlack(await frame(page));
                assert.equal(blanked.count, 0,
                    `${blanked.count} of ${blanked.total} pixels are not black — first at `
                    + `${JSON.stringify(blanked.first)}. D10: "fully black", and the frame is the only instrument `
                    + 'that reads it');
            }, FULL_PAGE));

        test('D10: a notice, a menu and a dialog raised AFTER the blank do not paint on it',
            () => mounted(async (page) => {
                await page.evalFn(() => {
                    document.getElementById('s').setAttribute('machine-state', 'sleeping');
                    return true;
                });
                await page.settle(4);
                assert.equal(nonBlack(await frame(page)).count, 0, 'the blank must start black');

                /* THE MEASUREMENT THIS SUITE EXISTS FOR. The top layer is ordered by ENTRY,
                 * so each of these three enters ABOVE a blank promoted before them, and the
                 * --ui-z-blackout > --ui-z-toast order the tokens declare is not what the
                 * compositor uses. First measured at 24,031 non-black pixels for the notice
                 * alone; ui-screensaver's #watchLayer() is what makes this zero. */
                const surfaces = [
                    ['a danger notice', 'document.getElementById("t").show("After blank", { tone: "danger", duration: 0 })'],
                    ['an open menu', 'window.__h.need("#m").show({ reason: "after-blank" })'],
                    ['a modal dialog', 'document.getElementById("d").show({ reason: "after-blank" })'],
                ];
                for (const [what, expr] of surfaces) {
                    await page.eval(`(() => { ${expr}; return true; })()`);
                    await page.settle(4);
                    await page.evalFn(() => new Promise((r) => setTimeout(r, 350)));
                    await page.settle(2);
                    const after = nonBlack(await frame(page));
                    assert.equal(after.count, 0,
                        `${what} put ${after.count} non-black pixels on a blanked screen (first at `
                        + `${JSON.stringify(after.first)}). Slate's numbers paint the toast (10001) over the `
                        + 'screensaver (10000); --ui-z-blackout 400 > --ui-z-toast 300 says the opposite, and '
                        + 'the top layer is ordered by entry, so the order has to be re-taken');

                    /* The two overlays that do NOT block the document leave the wake press
                     * where it was. The modal dialog does block it, by definition, and that
                     * is measured on its own below rather than smoothed over here. */
                    if (what !== 'a modal dialog') {
                        const hit = await page.eval(
                            '(() => { const el = document.elementFromPoint(8, 8); return el ? (el.id || el.tagName.toLowerCase()) : null; })()',
                        );
                        assert.equal(hit, 's', `${what}: a press on the blanked screen must still land on the blank`);
                    }
                }
            }, FULL_PAGE));

        /**
         * THE SAME CLAIM, FROM A THIRD SHADOW TREE — finding c-surfaces-1.
         *
         * Every fixture above is flat document markup, and both of the blank's listening
         * roots (`document` and its own `getRootNode()`) are then the same node — so the
         * `beforetoggle` half alone is enough for the notice and the gate cannot see what
         * happens when it is not. A screen that renders `<ui-toast>` inside its OWN shadow
         * template while the app-level blank owns the D10 slot is the ordinary composition
         * for 5.3, and `beforetoggle` is `composed: false`: it stops at the root of the
         * tree it fired in and no document listener ever hears it.
         *
         * Measured before the repair: 24,031 non-black pixels — byte-identical to the
         * flat-tree number this wave first measured, because it is the same defect arriving
         * by a route the flat fixtures cannot express. #22 now announces its own layer entry
         * with `open-change` (`ui-toast.js` `#syncLayer`), which is `composed: true` and is
         * the contract `LAYER_ENTRY_EVENTS` already consumes from #18 and #21.
         */
        test('D10: a notice raised from ANOTHER shadow tree does not paint on the blank',
            () => mounted(async (page) => {
                const moved = await page.evalFn(() => {
                    const host = document.createElement('div');
                    const root = host.attachShadow({ mode: 'open' });
                    document.getElementById('page').appendChild(host);
                    const t = document.getElementById('t');
                    root.appendChild(t);
                    window.__toast = t;
                    return { connected: t.isConnected, ownRoot: t.getRootNode() === root, sameAsBlank: t.getRootNode() === document.getElementById('s').getRootNode() };
                });
                assert.deepEqual(moved, { connected: true, ownRoot: true, sameAsBlank: false },
                    'the fixture must really put the region in a shadow tree the blank does not share');

                await page.evalFn(() => {
                    document.getElementById('s').setAttribute('machine-state', 'sleeping');
                    return true;
                });
                await page.settle(4);
                assert.equal(nonBlack(await frame(page)).count, 0, 'the blank must start black');

                await page.evalFn(() => !!window.__toast.show('After blank', { tone: 'danger', duration: 0 }));
                await page.settle(4);
                await page.evalFn(() => new Promise((r) => setTimeout(r, 350)));
                await page.settle(2);

                const after = nonBlack(await frame(page));
                assert.equal(after.count, 0,
                    `a notice raised from a sibling shadow tree put ${after.count} non-black pixels on a blanked `
                    + `screen (first at ${JSON.stringify(after.first)}). beforetoggle is composed: false and never `
                    + 'leaves that tree, so the blank only learns of the entry if #22 announces it');

                /* ANTI-VACUITY. Zero non-black pixels is also what an unmounted region, a
                 * region that never painted, or one the move broke would give. Take the
                 * blank down and the notice must be there, painting its own ground. */
                await page.evalFn(() => {
                    document.getElementById('s').setAttribute('machine-state', 'idle');
                    return true;
                });
                await page.settle(4);
                const notice = await page.evalFn(() => {
                    const t = window.__toast;
                    const n = t.children[t.children.length - 1];
                    const r = n.getBoundingClientRect();
                    return {
                        promoted: t.matches(':popover-open'),
                        background: getComputedStyle(n).backgroundColor,
                        rect: { left: r.left, top: r.top, width: r.width, height: r.height },
                    };
                });
                assert.equal(notice.promoted, true, 'the moved region must still be in the top layer');
                const awake = groundShare(await frame(page), notice.rect, scale, notice.background);
                assert.ok(awake.seen > 100, `only ${awake.seen} pixels sampled — the notice is too small to read`);
                assert.ok(awake.share > 0.5,
                    `with the blank down the notice paints only ${(awake.share * 100).toFixed(1)} % of its own `
                    + 'inner box — the zero above proved nothing, because there was nothing to cover');
            }, FULL_PAGE));

        /**
         * PINNED, NOT FIXED. A modal dialog blocks interaction with the whole document
         * outside itself — that is what modal MEANS, and no layer beats it (ui-toast.js
         * :328-331 measured the same thing for a notice). So a dialog opened while the
         * machine is asleep leaves the screen black and takes the wake press with it, and
         * #18's `#applyInert()` marks the blank inert on the way past. The repair is not
         * available on this side: making the blank a modal of its own would be a second
         * copy of #18's machinery, which this wave forbids. What a screen should do with an
         * open dialog when the machine sleeps is the screen's decision, and this is the
         * measurement it gets to decide with.
         */
        test('measured: a modal dialog over the blank keeps it black but takes the press', () => mounted(async (page) => {
            await page.evalFn(() => {
                document.getElementById('s').setAttribute('machine-state', 'sleeping');
                return true;
            });
            await page.settle(4);
            await page.evalFn(() => { document.getElementById('d').show({ reason: 'after-blank' }); return true; });
            await page.settle(4);

            assert.equal(nonBlack(await frame(page)).count, 0, 'the blank must still be black');
            const state = await page.evalFn(() => {
                const s = document.getElementById('s');
                const el = document.elementFromPoint(8, 8);
                return {
                    inert: s.inert === true || s.hasAttribute('inert'),
                    hit: el ? (el.id || el.tagName.toLowerCase()) : null,
                    active: s.hasAttribute('active'),
                };
            });
            assert.equal(state.active, true, 'the blank is still up');
            assert.equal(state.inert, true,
                'a modal dialog marks every sibling inert, and the blank is a sibling — pinned so the day '
                + 'someone exempts it is a visible change, not a silent one');
            assert.equal(state.hit, 'd',
                'and the press lands on the dialog, not the wake target: a screen must not open a dialog '
                + 'while the machine is asleep');
        }, FULL_PAGE));

        test('D10: the blank comes down and the screen it covered is still there', () => mounted(async (page) => {
            await page.evalFn(() => {
                document.getElementById('t').show('Saved', { tone: 'ok', duration: 0 });
                document.getElementById('s').setAttribute('machine-state', 'sleeping');
                return true;
            });
            await page.settle(4);
            assert.equal(nonBlack(await frame(page)).count, 0);

            await page.evalFn(() => {
                document.getElementById('s').setAttribute('machine-state', 'idle');
                return true;
            });
            await page.settle(4);
            const awake = nonBlack(await frame(page));
            assert.ok(awake.count > awake.total / 4,
                `the screen did not come back: ${awake.count} of ${awake.total} pixels painted`);
            assert.equal(await page.evalFn(() => document.getElementById('s').hasAttribute('active')), false,
                'the blank must be down once the machine is awake');
            assert.equal(await page.evalFn(() => document.getElementById('s').matches(':popover-open')), false,
                'and it must leave the top layer with it, or the next dialog opens under a box nobody can see');
        }, FULL_PAGE));
    });
}
