/**
 * editor.js — the profile editor's rendering-test helper. Wave 5.5, row
 * `a8-rendering-tests`.
 *
 * ===========================================================================
 * WHAT IT IS FOR
 * ===========================================================================
 * A8, and Part 5 §5's sentence about this screen in particular: "the old editor is
 * pinned by tests that regex-match the stylesheet's source text for the 1920x1200 lock
 * and the 64px literals — TESTS THAT MADE THE DEFECTS UNREMOVABLE. The rewrite's editor
 * lands with rendering tests asserting COMPUTED STYLES, and no test anywhere may match
 * source text."
 *
 * Every export here takes a live `Page` and returns a measurement or asserts about one.
 * NOTHING IN THIS FILE OPENS A FILE, and that is the point of putting the wave's shared
 * assertions in one module: the matrix and editing rows assert THROUGH this, so "no test
 * in this wave reads source text" is a property of one file rather than a promise
 * repeated in five. The guard that keeps it true tree-wide is
 * `scripts/a8-source-text.js`, with its canary in `test/a8-source-text.test.mjs`.
 *
 * ===========================================================================
 * THE ONE ASSERTION THIS WAVE OWES ITSELF: assertTokenMovesBox
 * ===========================================================================
 * §7.4 E8: "`--pe-scale` is declared, documented, exported AND TESTED — and wired to
 * nothing. The tests pass against a layout engine the app does not use." A layout engine
 * that is not consulted does not exist in the rewrite, and the only proof that a value is
 * consulted is that MOVING IT MOVES A RENDERED BOX. `assertTokenMovesBox` is that proof,
 * written once: it reads the box, moves the token, reads the box again, and puts the
 * token back whether it passed or not.
 *
 * It is deliberately not `assertTokenDrill` (`test/harness/assertions.js`), which proves
 * a token reaches a COMPUTED PROPERTY. Reaching a property and moving a box are different
 * claims, and E8 is about the second: `--pe-scale` would have passed a drill on any
 * element that read it.
 *
 * ===========================================================================
 * THE STAGE IS SHARED FOR THE SAME REASON THE ASSERTIONS ARE
 * ===========================================================================
 * `editorStage()` builds the markup every editor suite mounts, so a capture, a
 * measurement and a battery frame are all of the same arrangement. The two mount points
 * are LIGHT-DOM children of `<editor-screen>` — `slot="steps"` for the matrix and
 * `slot="settings"` for the field rows — which is the contract `editor-screen.js` states
 * in its header and the one `test/fixtures/editor-shell-fixture.js` drives.
 *
 * B2: nothing here states a range. A fixture that restates a maximum is a second ranges
 * table and a block; the review lines below carry the bounds they were handed on the
 * segment, exactly as `reviewStepSpec` emits them.
 */

import assert from 'node:assert/strict';

/** The screen's module, for `page.mount(markup, EDITOR_MODULE)`. */
export const EDITOR_MODULE = Object.freeze(['/src/screens/editor-screen.js']);

/** Every box this wave measures, by its deep selector. One spelling, tree-wide. */
export const EDITOR = Object.freeze({
    screen: 'editor-screen',
    band: 'editor-screen >>> #band',
    bandGrid: 'editor-screen >>> #band >>> #band',
    bandLead: 'editor-screen >>> #band >>> #lead',
    bandCentre: 'editor-screen >>> #band >>> #centre',
    bandTitle: 'editor-screen >>> #band >>> #title',
    save: 'editor-screen >>> #band >>> #save',
    cancel: 'editor-screen >>> #band >>> #cancel',
    body: 'editor-screen >>> #body',
    stack: 'editor-screen >>> #body >>> #stack',
    steps: 'editor-screen >>> #steps',
    tabs: 'editor-screen >>> #tabs',
    tablist: 'editor-screen >>> #tabs >>> #tablist',
    settings: 'editor-screen >>> #settings-panel',
    settingsGrid: 'editor-screen >>> #settings-panel >>> #panel',
    review: 'editor-screen >>> #review-panel',
    reviewGrid: 'editor-screen >>> #review-panel >>> #panel',
    reviewColumns: 'editor-screen >>> #review-panel >>> .column',

    /* THE MATRIX. A LIGHT-DOM child of <editor-screen>, so it is reached from the
     * document and not through the screen's shadow root — that is the mount contract
     * editor-screen.js states and the reason this spelling has no `>>>` in it. */
    matrix: 'step-matrix',

    /* THE EDITING SURFACES (rows chart-preview, editor-dialogs, numpad-flows). All three
     * are LIGHT-DOM children of <editor-screen> for the same reason the matrix is: the
     * screen forwards `preview` into the review panel's chart row and `overlays` into a
     * region that takes no track. */
    preview: 'editor-preview',
    previewCard: 'editor-preview >>> #card',
    previewPlot: 'editor-preview >>> #card >>> .plot',
    overlays: 'editor-overlays',
    numpad: 'editor-overlays >>> #numpad',
    /* THE SHELL is the <ui-dialog> element; THE CARD is the native <dialog> inside it,
     * which is the box `dialog-body-integration.render.test.mjs` measures as the card. */
    numpadShell: 'editor-overlays >>> #numpad >>> #dialog',
    numpadCard: 'editor-overlays >>> #numpad >>> #dialog >>> #dialog',
    numpadHead: 'editor-overlays >>> #numpad >>> #dialog >>> #head',
    numpadTitle: 'editor-overlays >>> #numpad >>> #dialog >>> ui-sheet-header >>> #title',
    numpadHint: 'editor-overlays >>> #numpad >>> #hint',
    exitDialog: 'editor-overlays >>> #exit',
    exitShell: 'editor-overlays >>> #exit >>> #dialog',
    exitCard: 'editor-overlays >>> #exit >>> #dialog >>> #dialog',
    exitBody: 'editor-overlays >>> #exit >>> #body',
    leverDialog: 'editor-overlays >>> #lever',
    leverShell: 'editor-overlays >>> #lever >>> #dialog',
    leverCard: 'editor-overlays >>> #lever >>> #dialog >>> #dialog',
    leverBody: 'editor-overlays >>> #lever >>> #body',
    leverP0: 'editor-overlays >>> #lever >>> #p0',
    leverPresetBank: 'editor-overlays >>> #lever >>> #preset',
    settingsField: '[data-editor-field]',

    /* THE HEADER'S IDENTITY BLOCK (cmp-seh-3). All five live in the SCREEN's own shadow
     * root and are slotted into #31's lead flank, so they are reached through the screen
     * and never through the band. */
    identity: 'editor-screen >>> #identity',
    eyebrow: 'editor-screen >>> #eyebrow',
    profileTitle: 'editor-screen >>> #editor-title',
    pencil: 'editor-screen >>> #title-pencil',
    totals: 'editor-screen >>> #totals',

    /* The rename, and the surface a save reports on. */
    renameDialog: 'editor-screen >>> #rename-dialog',
    renameField: 'editor-screen >>> #rename-field',
    renameSave: 'editor-screen >>> #rename-save',
    notice: 'editor-screen >>> #notice',
});

/** The trimmed text of one element, by deep selector. */
export const textOf = (page, selector) => page.evalFn(
    (s) => (window.__h.q(s)?.textContent ?? '').trim(), selector,
);

/** The panel values, in §4.3's order — the same order the tab bar renders. */
export const EDITOR_PANELS = Object.freeze(['steps', 'settings', 'review']);

/** One tab button inside the bank, by index. */
export const editorTab = (index) => `${EDITOR.tablist} >>> #item-${index}`;

/* ===========================================================================
 * Reading numbers off the engine
 * =========================================================================== */

/** Rendered lengths at dsf 1.5 are not string-comparable; whole CSS px are. */
export const near = (got, want, what, tol = 0.51) => assert.ok(
    Math.abs(got - want) <= tol,
    `${what}: expected ${want}, got ${got}`,
);

/** A used track list, as an array of strings. */
export const tracks = (value) => String(value).trim().split(/\s+/);

/** A computed length as a number. */
export const px = (value) => parseFloat(value);

/* ===========================================================================
 * The stage
 * =========================================================================== */

/**
 * The markup every editor suite mounts.
 *
 * @param opts.matrix        inline style for the `slot="steps"` stand-in, or `null` to
 *                           leave the mount region empty (the skeleton's own state).
 * @param opts.fields        how many settings field rows to mount.
 * @param opts.fieldMinBlock each row's floor, so a suite can force the panel to scroll.
 * @param opts.stage         inline style for `#stage`.
 */
export function editorStage({
    matrix = 'min-block-size: 2400px; min-inline-size: 2400px',
    fields = 9,
    fieldMinBlock = '96px',
    stage = 'inline-size: 100%; block-size: 100dvh',
} = {}) {
    const rows = Array.from({ length: fields }, (_, i) => '<div class="row" slot="settings" '
        + `data-row="${i}" style="min-block-size: ${fieldMinBlock}">row ${i}</div>`).join('');
    const cell = matrix
        ? `<div id="matrix" slot="steps" style="${matrix}">m</div>`
        : '';
    return `<div id="stage" style="${stage}">`
        + `<editor-screen>${cell}${rows}</editor-screen>`
        + '</div>';
}

/**
 * Mount the screen and settle it, refusing to continue on a page error — a suite that
 * measures a screen which threw during its first render is measuring a fragment.
 */
export async function mountEditor(page, options = {}) {
    await page.mount(editorStage(options), EDITOR_MODULE);
    await page.settle(6);
    assert.deepEqual(page.pageErrors, [], 'the editor must mount without throwing');
    return page;
}

/**
 * SEAT A PROFILE, THE WAY THE SHELL DOES  (fix run 4 — `dec-A-B-1`, `cmp-seh-3`).
 *
 * The editor takes its record from `boot.profileEditor`, the store `app-boot.js` builds
 * and the selector's Edit seats. A suite that wants the loaded-profile states — the
 * header's identity block, a dirty count, a save — drives the SAME path rather than
 * writing a private field: a real `createProfileEditorStore` over a transport this
 * function controls, handed to the screen on a `boot` object with the two doors the
 * screen actually reads (`profileEditor` and `capabilities.machineLimits()`).
 *
 * THE TRANSPORT IS THE TEST'S. `request` is answered from `answers` — `{ok, status, data}`
 * per route id, or a function — and every call made is recorded, so a suite asserts WHICH
 * route a gesture took rather than inferring it from what changed on screen. The default
 * answers a `postProfiles` with a record whose `parentId` is the seated record's id, which
 * is what ReaPrime does on B11's path.
 *
 * Returns the seated record's id.
 */
export async function seatProfile(page, {
    profile = null,
    record = null,
    capabilities = [{ id: 'machine' }],
    answers = null,
} = {}) {
    const seated = record ?? {
        id: 'profile:seated',
        profile: profile ?? editingProfile(),
        metadataHash: 'meta-0',
        compoundHash: 'compound-0',
        parentId: null,
        visibility: 'visible',
        isDefault: false,
        createdAt: '2026-08-21T00:00:00.000Z',
        updatedAt: '2026-08-21T00:00:00.000Z',
        metadata: null,
    };
    await page.evalFn(async (payload) => {
        const [store, adapters] = await Promise.all([
            import('/src/stores/profile-editor-store.js'),
            import('/src/data/adapters-r.js'),
        ]);
        const calls = [];
        /* `callRoute` calls `transport.request(path, {method, query, body})` — two
         * arguments, the path already built from the route table — so this fake takes the
         * same two and records the PATH, which is the evidence a suite wants: a gesture
         * that took the wrong route wrote the wrong path. */
        const transport = {
            async request(path, options = {}) {
                /* The path is the ROUTE TABLE's, not the URL: `callRoute` builds it from
                 * the row and the transport owns the /api/v1 base, so a suite asserting
                 * `/profiles` is asserting what the client spelled. */
                const call = { path, method: options.method ?? 'GET', body: options.body ?? null };
                calls.push(call);
                const canned = payload.answers
                    ? (payload.answers[`${call.method} ${call.path}`] ?? payload.answers[call.method] ?? null)
                    : null;
                if (canned) return canned;
                /* THE DEFAULT: a create that answers the way ReaPrime's does — 201 with a
                 * record carrying the parent link, so B11's "the old version is kept" is
                 * a fact on the wire and not a claim in a test. */
                const body = call.body ?? {};
                return {
                    ok: true,
                    status: call.method === 'POST' ? 201 : 200,
                    data: {
                        ...payload.seated,
                        id: call.method === 'POST' ? 'profile:saved' : payload.seated.id,
                        parentId: body.parentId ?? null,
                        profile: body.profile ?? payload.seated.profile,
                        metadataHash: 'meta-1',
                    },
                };
            },
        };
        const editor = store.createProfileEditorStore({ transport });
        const screen = window.__h.need('editor-screen');
        window.__editorCalls = calls;
        window.__editorStore = editor;
        screen.boot = {
            profileEditor: editor,
            capabilities: { machineLimits: () => adapters.r2MachineLimits(payload.capabilities) },
            logger: null,
        };
        editor.open(payload.seated);
        await screen.updateComplete;
    }, { seated, capabilities, answers });
    await page.settle(6);
    return seated.id;
}

/** Every route the seated store's transport was asked for, in order. */
export const editorCalls = (page) => page.evalFn(() => window.__editorCalls.map((c) => ({ ...c })));

/** The seated store's published state, as JSON — for asserting a save's own report. */
export const editorStoreState = (page) => page.evalFn(() => {
    const state = window.__editorStore.get();
    return JSON.parse(JSON.stringify({
        load: state.load,
        save: state.save,
        recordId: state.record ? state.record.id : null,
        title: state.record && state.record.profile ? state.record.profile.title : null,
        parentId: state.record ? state.record.parentId : null,
        report: state.report,
        refusal: state.refusal,
        version: state.version,
    }));
});

/** Re-point the stage — the only input the panels' container queries have. */
export async function setEditorWidth(page, value) {
    await page.setStyle('#stage', { 'inline-size': value });
    await page.settle(3);
}

/**
 * Show a panel THROUGH THE TAB BAR, which is the one owner of which panel shows.
 * Writing the screen's `tab` attribute instead measures a frame in which the bar has not
 * yet synced and the panels are still the previous tab's.
 */
export async function selectPanel(page, value) {
    const index = EDITOR_PANELS.indexOf(value);
    assert.ok(index >= 0, `selectPanel: '${value}' is not one of ${EDITOR_PANELS.join(', ')}`);
    await page.click(editorTab(index));
    await page.settle(4);
    return page.evalFn((s) => window.__h.need(s).getAttribute('tab'), EDITOR.screen);
}

/* ===========================================================================
 * The assertions
 * =========================================================================== */

/**
 * E8's proof: move a custom property and watch a rendered box move.
 *
 * @param opts.token     the property, e.g. '--ui-editor-field-min-h'
 * @param opts.selector  the box that must move
 * @param opts.by        how much to add to the token's current value, in px
 * @param opts.axis      'block' (default) or 'inline'
 *
 * The token is restored whether the assertion passes or throws, so one failure does not
 * poison every test after it in the same page.
 */
export async function assertTokenMovesBox(page, {
    token, selector, by = 120, axis = 'block',
}) {
    const property = axis === 'inline' ? 'inline-size' : 'block-size';
    const dimension = axis === 'inline' ? 'width' : 'height';

    const start = px(await page.resolveToken(token, property));
    assert.ok(Number.isFinite(start),
        `token-moves-box: ${token} does not resolve to a length (got ${start})`);

    const before = (await page.box(selector))[dimension];
    try {
        await page.setToken(token, `${start + by}px`);
        await page.settle(3);
        const after = (await page.box(selector))[dimension];
        assert.ok(
            Math.abs((after - before) - by) <= 0.51,
            `token-moves-box: ${token} moved by ${by}px and ${selector} moved by `
            + `${(after - before).toFixed(1)}px (${before.toFixed(1)} -> ${after.toFixed(1)}).\n`
            + '  E8: "--pe-scale is declared, documented, exported and TESTED - and wired to '
            + 'nothing." A layout value that does not move a box does not exist.',
        );
        return { token, before, after, by };
    } finally {
        await page.setToken(token, null);
        await page.settle(2);
    }
}

/**
 * §2.4: nothing clips silently. A box that is not a declared scroll region must not carry
 * an `overflow` that hides its own overflow — Slate clips at `slate-components.css:51`,
 * and that is what made chart-C3's 32px overflow invisible.
 */
export async function assertNoSilentClip(page, selector) {
    const m = await page.metrics(selector);
    for (const [axis, value] of [['x', m.overflowX], ['y', m.overflowY]]) {
        assert.notEqual(value, 'hidden',
            `no-silent-clip: ${selector} has overflow-${axis}: hidden.\n`
            + '  A region that clips without scrolling is the defect §2.4 exists to remove.');
        assert.notEqual(value, 'clip',
            `no-silent-clip: ${selector} has overflow-${axis}: clip.`);
    }
    return m;
}

/**
 * Which of the three panels currently has a box. Exactly one, always: the other two are
 * `hidden` + `inert`, written by #32 and by nobody else.
 */
export async function visiblePanels(page) {
    const boxes = await Promise.all(
        [EDITOR.steps, EDITOR.settings, EDITOR.review].map((s) => page.box(s)),
    );
    return boxes
        .map((b, i) => (b.width > 0 && b.height > 0 ? EDITOR_PANELS[i] : null))
        .filter(Boolean);
}

/**
 * Sweep a container query and report where the used track count flips. The threshold is
 * SWEPT rather than asserted at two convenient widths, because a query written on the
 * wrong box still gives the right answer at two points and the wrong one in between.
 */
export async function sweepCollapse(page, {
    selector, from, to, step = 4,
}) {
    const seen = [];
    for (let w = from; w >= to; w -= step) {
        await setEditorWidth(page, `${w}px`);
        seen.push({ w, n: tracks(await page.prop(selector, 'grid-template-columns')).length });
    }
    const flips = seen.filter((row, i) => i > 0 && row.n !== seen[i - 1].n);
    return { seen, flips };
}

/* ===========================================================================
 * §7.4 E4 — THE DEAD-RULE WALK  (and P9, which is the same scan)
 *
 * E4: "Eight CSS rules whose selectors cannot match, eight emitted-but-unstyled
 * classes, and a dead `data-pe-mode` attribute hook." A rule that cannot match is a
 * claim about the screen that the screen does not make, and it is the residue every
 * other §7.4 defect leaves behind — E8's unconsulted engine in miniature.
 *
 * A8: THIS READS NO FILE. It walks `adoptedStyleSheets` on the LIVE document and asks
 * the engine, through `querySelectorAll`, whether each selector has anything to select.
 * The authored string never enters it; a rule renamed in the source is followed here for
 * free, which is the whole difference between this and the 29 text-scan suites.
 *
 * THREE THINGS MAKE IT NON-VACUOUS, because a walk that silently finds no rules passes
 * every assertion about them:
 *
 *   1. A STYLE RULE IS RECORDED BEFORE ITS CHILDREN, NOT INSTEAD OF THEM. Under CSS
 *      nesting every `CSSStyleRule` carries a (usually empty) `cssRules`, so the
 *      familiar `if (rule.cssRules) { recurse; continue; }` shape walks past every
 *      top-level rule in the sheet and reports an empty census. Selectors are collected
 *      first and nesting is recursed into afterwards.
 *   2. THE CALLER ASSERTS A RULE COUNT. `ruleCensus().sheets()` reports `rules` per
 *      sheet so a suite can refuse a scan that found nothing.
 *   3. THE CANARY. `assertScanIsLive()` inserts a selector that cannot match, re-scans,
 *      and requires the scan to report it dead — the E8 proof, applied to the test.
 *
 * DEPTH-AWARE, AND STATE-AWARE. `hosts` are `>>>` paths, so each component is asked
 * about ITS OWN root. Only the last adopted sheet is walked: the earlier ones are the
 * shared fragments (base, type roles, seams) whose unmatched rules belong to whichever
 * component does use them. Where that last sheet is ITSELF shared — the two editor
 * dialogs both end on `dialogRows` — the sheets are keyed BY IDENTITY, so a selector
 * live in either root counts as live for the sheet. And a rule is only dead if it
 * matches in NO state the caller drives: `#steps[hidden]` matches once another tab is
 * selected, `.cell > ui-locked-value` once a step holds, `.seg-lev` once a lever
 * segment is fed. Union first, judge afterwards.
 * =========================================================================== */

/** The in-page walk. One call, many hosts, so sheet identity is comparable across them. */
export const EDITOR_RULE_SCAN = `(function (hostSels, canary) {
    var seen = [], out = [];
    /* State and pseudo-element tails are stripped before matching: a rule keyed on
     * :hover or ::before is about an element that must exist, not about the state. */
    var strip = function (sel) {
        return sel
            .replace(/::(before|after|marker|placeholder|backdrop|selection|first-line|first-letter)\\b/g, '')
            .replace(/::-webkit-[a-z-]+/g, '')
            .replace(/::part\\([^)]*\\)/g, '')
            .replace(/:(hover|focus-visible|focus-within|focus|active|target|visited|link)\\b/g, '');
    };
    var matchIn = function (root, host, slotted, sel) {
        var s = strip(sel).trim();
        if (!s) return true;
        if (s === ':host') return true;
        if (s.indexOf(':host(') === 0) {
            var close = s.indexOf(')');
            var inner = s.slice(6, close), rest = s.slice(close + 1).trim();
            if (!host || !host.matches(inner)) return false;
            if (!rest) return true;
            try { return root.querySelectorAll(rest).length > 0; } catch (e) { return 'throw'; }
        }
        var m = s.match(/::slotted\\(([^)]*)\\)/);
        if (m) {
            for (var i = 0; i < slotted.length; i++) {
                try { if (slotted[i].matches(m[1])) return true; } catch (e) { return 'throw'; }
            }
            return false;
        }
        try { return root.querySelectorAll(s).length > 0; } catch (e) { return 'throw'; }
    };
    for (var h = 0; h < hostSels.length; h++) {
        var parts = hostSels[h].split('>>>').map(function (s) { return s.trim(); });
        var root = document, el = null, bad = false;
        for (var i = 0; i < parts.length; i++) {
            el = root.querySelector(parts[i]);
            if (!el) { out.push({ host: hostSels[h], error: 'no element for ' + parts[i] }); bad = true; break; }
            root = el.shadowRoot || el;
        }
        if (bad) continue;
        var sheets = root.adoptedStyleSheets || [];
        if (!sheets.length) { out.push({ host: hostSels[h], error: 'no adopted sheets' }); continue; }
        var own = sheets[sheets.length - 1];
        if (canary) { try { own.insertRule(canary + ' { color: red }', own.cssRules.length); } catch (e) {} }
        var idx = seen.indexOf(own);
        if (idx < 0) { idx = seen.length; seen.push(own); }
        var host = root.host || null, slotted = [];
        if (host) { for (var c = 0; c < host.children.length; c++) slotted.push(host.children[c]); }
        var rec = { host: hostSels[h], sheet: idx, rules: 0, parts: [] };
        var walk = function (rules, cond) {
            for (var r = 0; r < rules.length; r++) {
                var rule = rules[r];
                /* SELECTORS FIRST — see note 1 above. */
                if (rule.selectorText) {
                    rec.rules++;
                    var pieces = rule.selectorText.split(',').map(function (s) { return s.trim(); });
                    for (var p = 0; p < pieces.length; p++) {
                        rec.parts.push({
                            selector: pieces[p],
                            cond: cond || null,
                            matched: matchIn(root, host, slotted, pieces[p]),
                        });
                    }
                }
                if (rule.cssRules && rule.cssRules.length) {
                    var c2 = cond;
                    if (rule.containerQuery !== undefined) c2 = '@container ' + rule.containerQuery;
                    else if (rule.media) c2 = '@media ' + (rule.conditionText || rule.media.mediaText);
                    walk(rule.cssRules, c2);
                }
            }
        };
        walk(own.cssRules, null);
        if (canary) {
            for (var k = own.cssRules.length - 1; k >= 0; k--) {
                if (own.cssRules[k].selectorText === canary) { own.deleteRule(k); break; }
            }
        }
        out.push(rec);
    }
    return JSON.stringify(out);
})`;

/**
 * Scan one set of `>>>` hosts in the state the page is in right now.
 *
 * @param opts.canary a selector to insert into each sheet before walking and remove
 *                    after, so the caller can prove the scan reports a dead rule.
 */
export async function scanRules(page, hosts, { canary = null } = {}) {
    return JSON.parse(await page.eval(
        `${EDITOR_RULE_SCAN}(${JSON.stringify(hosts)}, ${JSON.stringify(canary)})`,
    ));
}

/**
 * Accumulate scans across states and judge afterwards. `add()` ORs each selector's
 * match over every state it has been seen in; `sheets()` reports one row per sheet
 * identity with the selectors that never matched anywhere.
 */
export function ruleCensus() {
    const sheets = new Map();
    return {
        add(rows, state) {
            for (const row of rows) {
                assert.equal(row.error, undefined, `rule scan: ${row.host} — ${row.error}`);
                const bag = sheets.get(row.sheet) ?? { hosts: new Set(), rules: 0, sels: new Map(), dupes: new Map() };
                bag.hosts.add(row.host);
                bag.rules = Math.max(bag.rules, row.rules);
                const here = new Map();
                for (const part of row.parts) {
                    const key = `${part.cond ?? ''}||${part.selector}`;
                    here.set(key, (here.get(key) ?? 0) + 1);
                    const prev = bag.sels.get(key) ?? { ...part, matched: false, states: [] };
                    if (part.matched === true) { prev.matched = true; prev.states.push(state); }
                    bag.sels.set(key, prev);
                }
                for (const [key, n] of here) bag.dupes.set(key, Math.max(bag.dupes.get(key) ?? 0, n));
                sheets.set(row.sheet, bag);
            }
        },
        sheets() {
            return [...sheets.values()].map((bag) => {
                const parts = [...bag.sels.values()];
                return {
                    hosts: [...bag.hosts],
                    rules: bag.rules,
                    selectors: parts.length,
                    dead: parts.filter((p) => p.matched !== true).map((p) => (p.cond ? `${p.cond} { ${p.selector} }` : p.selector)),
                    duplicated: [...bag.dupes.entries()].filter(([, n]) => n > 1).map(([k]) => k),
                };
            });
        },
    };
}

/**
 * THE CANARY. E8's lesson turned on the test itself: a scan that reports nothing wrong
 * because it is looking at nothing is the same failure as a layout engine wired to
 * nothing. This inserts a selector that cannot match and requires the scan to say so.
 */
export async function assertScanIsLive(page, hosts, canary = '.rea-e4-canary') {
    const rows = await scanRules(page, hosts, { canary });
    for (const row of rows) {
        assert.equal(row.error, undefined, `canary: ${row.host} — ${row.error}`);
        const found = row.parts.filter((p) => p.selector === canary);
        assert.equal(found.length, 1,
            `canary: the scan did not see an inserted rule in ${row.host} — it is walking nothing`);
        assert.equal(found[0].matched, false,
            `canary: the scan called an unmatchable selector live in ${row.host}`);
    }
    /* And the sheet is handed back exactly as it was found. */
    const after = await scanRules(page, hosts);
    for (const row of after) {
        assert.equal(row.parts.filter((p) => p.selector === canary).length, 0,
            `canary: ${row.host} kept the inserted rule`);
    }
    return after;
}

/* ===========================================================================
 * THE STEP MATRIX — the same stage, with the real element in the steps region
 *
 * Wave 5.5's matrix cluster asserts THROUGH here for the reason the file's header
 * gives: "no test in this wave reads source text" is a property of one module rather
 * than a promise repeated in five. Nothing below opens a file either.
 *
 * B2 AGAIN, AND IT BINDS HARDEST HERE. `matrixStep()` builds a step out of VALUES —
 * a temperature, a flow, a duration — carried from the shape the 147-record fixture
 * holds on all 890 of its steps. It states no minimum, no maximum and no increment:
 * "a test fixture that restates maxima is a second ranges table and a BLOCK". Every
 * bound in a mounted matrix arrives through `createEditorRanges`, which is imported
 * IN THE PAGE so the suite measures the door the screen uses.
 * =========================================================================== */

/** The matrix's row rail cell, by row key. */
export const matrixRail = (row) => `${EDITOR.matrix} >>> [data-rail="${row}"]`;

/** One data cell, by row key and 0-based step index. */
export const matrixCell = (row, index) => `${EDITOR.matrix} >>> [data-cell="${row}-${index}"]`;

/** The control inside one data cell. */
export const matrixControl = (row, index, tag) => `${matrixCell(row, index)} > ${tag}`;

/**
 * The step-name field, which is NOT a direct child of its cell and only exists while
 * that step is being edited.
 *
 * Since 0.1.18 the head cell draws `.head-line` — the spoken sentence, the name (a
 * button at rest, a ui-text-field while editing) and the pen — so `matrixControl` finds
 * nothing there: its `>` is a direct-child combinator and the field is one level down.
 * Pair it with `openStepName` rather than reaching for the field that is not on screen.
 */
export const matrixNameField = (index) => `${matrixCell('head', index)} ui-text-field`;

/** Press a step's name to bring its field on screen, the way a person does. */
export async function openStepName(page, index) {
    await page.click(`${matrixCell('head', index)} .name-display`);
    await page.settle(3);
}

/**
 * One profile step, in the shape ReaPrime serves. VALUES ONLY — see the section note.
 * `over` replaces any key: `matrixStep({transition: 'hold'})` is the locked-target case.
 */
export function matrixStep(over = {}) {
    return {
        name: 'Preinfusion',
        pump: 'flow',
        transition: 'fast',
        exit: null,
        volume: 0,
        seconds: 30,
        weight: 0,
        temperature: 92,
        sensor: 'coffee',
        flow: 4,
        limiter: { value: 9, range: 0.6 },
        ...over,
    };
}

/**
 * Mount the editor with a REAL <step-matrix> in the steps region, seeded with steps
 * and with the one ranges door.
 *
 * The door is built in the page from `r2MachineLimits()` — the R2 adapter, which is
 * how every surface reaches `machine-limits.js` — so the matrix under test resolves
 * its bounds exactly the way the screen will.
 */
export async function mountStepMatrix(page, {
    steps = [matrixStep(), matrixStep(), matrixStep()],
    stage = 'inline-size: 100%; block-size: 100dvh',
    density = null,
    editable = false,
    capabilities = [{ id: 'machine' }],
} = {}) {
    await page.mount(
        `<div id="stage" style="${stage}">`
        + '<editor-screen><step-matrix slot="steps"></step-matrix></editor-screen>'
        + '</div>',
        [...EDITOR_MODULE, '/src/screens/step-matrix.js'],
    );
    await page.settle(6);
    assert.deepEqual(page.pageErrors, [], 'the matrix must mount without throwing');
    await seedMatrix(page, { steps, density, editable, capabilities });
    return page;
}

/** Re-seed a mounted matrix — the same door, a different step list. */
export async function seedMatrix(page, {
    steps, density = null, editable = false, capabilities = [{ id: 'machine' }],
} = {}) {
    await page.evalFn(async (sel, payload) => {
        const ranges = await import('/src/lib/editor-ranges.js');
        const adapters = await import('/src/data/adapters-r.js');
        const el = window.__h.need(sel);
        /* THE CLASS RIDES WITH THE TABLE (27 Aug 2026) — the authoring half has two
         * machine-dependent flow ceilings now, and both are derived from this one served
         * capability array so the mounted matrix cannot show one machine's bounds while
         * claiming another's. */
        el.ranges = ranges.createEditorRanges({
            machineLimits: adapters.r2MachineLimits(payload.capabilities).value,
            machineClass: adapters.machineClassFromServedSet(payload.capabilities),
        });
        if (payload.density) el.density = payload.density;
        el.editable = payload.editable;
        el.steps = payload.steps;
        await el.updateComplete;
    }, EDITOR.matrix, { steps, density, editable, capabilities });
    await page.settle(5);
}

/** The matrix's authored constants, read out of the page rather than retyped here. */
export const matrixAuthored = async (page) => JSON.parse(await page.eval(
    "Promise.all([import('/src/lib/step-matrix-rows.js'),import('/src/screens/step-matrix.js')])"
    + '.then(function (m) { return JSON.stringify({'
    + ' rows: m[0].STEP_MATRIX_ROW_KEYS,'
    + ' labels: m[0].STEP_MATRIX_ROWS.map(function (r) { return r.label; }),'
    + ' change: m[1].STEP_CHANGE, edit: m[1].STEP_EDIT,'
    + ' densities: m[1].MATRIX_DENSITIES'
    + '}); })',
));

/** Scroll the matrix itself — it is its own scrollport, both axes. */
export async function scrollMatrix(page, { left = null, top = null } = {}) {
    await page.evalFn((sel, l, t) => {
        const el = window.__h.need(sel);
        if (l !== null) el.scrollLeft = l === 'max' ? el.scrollWidth : l;
        if (t !== null) el.scrollTop = t === 'max' ? el.scrollHeight : t;
    }, EDITOR.matrix, left, top);
    await page.settle(2);
    return page.metrics(EDITOR.matrix);
}

/**
 * SWEEP THE FILL/SCROLL FLIP. The threshold is not declared anywhere — it is what
 * happens when N columns of the step minimum stop fitting — so it is found by walking
 * the container's width and watching for horizontal overflow, exactly once.
 *
 * Returns every width sampled with its overflow state, and the flips between them.
 */
export async function sweepFill(page, { from, to, step = 4 }) {
    const seen = [];
    for (let w = from; w >= to; w -= step) {
        await setEditorWidth(page, `${w}px`);
        const m = await page.metrics(EDITOR.matrix);
        seen.push({ w, scrolls: m.scrollWidth > m.clientWidth + 0.5, client: m.clientWidth });
    }
    const flips = seen.filter((row, i) => i > 0 && row.scrolls !== seen[i - 1].scrolls);
    return { seen, flips };
}

/**
 * EVERY ACCESSIBLE NAME CHROME COMPUTES, from its own accessibility tree (E14).
 *
 * Not a scan of aria-* attributes: the name of a cell is computed from its contents,
 * a group's name reaches the controls inside it, and only the engine knows either.
 * `Accessibility.getFullAXTree` walks the flattened tree, so shadow roots are included
 * — which is the only way to see what a screen reader would be told about a matrix
 * made of six different components.
 */
export async function accessibleNames(page, roles = null) {
    await page.send('Accessibility.enable');
    const tree = await page.send('Accessibility.getFullAXTree');
    const out = tree.nodes
        .filter((node) => !node.ignored)
        .map((node) => ({ role: node.role?.value ?? '', name: node.name?.value ?? '' }))
        .filter((node) => node.role && !['none', 'generic', 'InlineTextBox', 'StaticText', 'RootWebArea']
            .includes(node.role));
    return roles ? out.filter((node) => roles.includes(node.role)) : out;
}

/** The names for one role, in tree order. */
export const namesFor = (nodes, role) => nodes.filter((n) => n.role === role).map((n) => n.name);

/* ===========================================================================
 * THE EDITING SURFACES — the preview chart, the two dialogs, the numpad
 *
 * Wave 5.5 rows chart-preview, editor-dialogs and numpad-flows. One stage for all
 * three, because they are one arrangement: a matrix whose value cells open a keypad, an
 * exit band whose condition slot opens a dialog, a settings field row that opens the same
 * keypad, and a preview chart on the Review tab that must not rebuild while any of it
 * happens.
 *
 * B2 BINDS HERE TOO, AND HARDEST. Nothing in this section states a minimum, a maximum or
 * an increment. The stage builds its door in the page from `r2MachineLimits()` and every
 * control it arms — the matrix, the settings field, the dialogs, the keypad — takes its
 * bounds from that one door, so a suite measuring a hint is measuring the table.
 *
 * THE STAGE CARRIES A COMPOSITION ROOT, and it is deliberately tiny: `window.__editor`
 * holds the draft and writes it when an editing event arrives, which is the job the
 * editor ROUTE will have when it is built (`app-routes.js` still lists `editor` as a
 * planned id). Without it a press would move nothing and every "the data changed" claim
 * below would be a claim about a fixture rather than about the screen.
 * =========================================================================== */

/** Every module the editing stage needs, in mount order. */
export const EDITING_MODULES = Object.freeze([
    ...EDITOR_MODULE,
    '/src/screens/step-matrix.js',
    '/src/screens/editor-preview.js',
    '/src/screens/editor-overlays.js',
    '/src/components/ui-stepper.js',
]);

/**
 * The markup. The four editing surfaces are LIGHT-DOM children of <editor-screen>, in
 * the four regions it declares: `steps`, `preview`, `overlays` and `settings`.
 *
 * The settings field row is a COMPOSITION and not a component (Part 10 §9) — a caption
 * and a #4 stepper — and it names its door field with `data-editor-field`, which is the
 * whole contract between a field row and <editor-overlays>. It states no bound; the
 * stage arms it from the door below.
 */
export function editingStage({
    stage = 'inline-size: 100%; block-size: 100dvh',
    field = 'targetWeight',
} = {}) {
    return `<div id="stage" style="${stage}">`
        + '<editor-screen>'
        + '<step-matrix slot="steps"></step-matrix>'
        + '<editor-preview slot="preview"></editor-preview>'
        + '<editor-overlays slot="overlays"></editor-overlays>'
        + '<div class="field" slot="settings">'
        + `<ui-stepper editable data-editor-field="${field}" label="Drink weight"></ui-stepper>`
        + '</div>'
        + '</editor-screen>'
        + '</div>';
}

/** One profile draft, in the shape ReaPrime serves. VALUES ONLY — no bound is stated. */
export function editingProfile(steps = [matrixStep(), matrixStep({ pump: 'pressure', pressure: 9 })]) {
    return {
        version: 2,
        title: 'Morning ristretto',
        notes: '',
        author: 'bench',
        beverage_type: 'espresso',
        steps,
        target_volume: 0,
        target_weight: 36,
        target_volume_count_start: 0,
        tank_temperature: 0,
    };
}

/**
 * Mount the whole editing stage and wire it: one ranges door, one draft, and the
 * composition root that writes the draft when an editing event arrives.
 *
 * Returns the page. `window.__editor` is available in the page for a suite that needs to
 * read the draft back or apply an edit without a press.
 */
export async function mountEditing(page, {
    steps = null,
    profile = null,
    capabilities = [{ id: 'machine' }],
    density = 'compact',
    field = 'targetWeight',
    stage = 'inline-size: 100%; block-size: 100dvh',
} = {}) {
    const draft = profile ?? editingProfile(steps ?? undefined);
    await page.mount(editingStage({ stage, field }), EDITING_MODULES);
    await page.settle(6);
    assert.deepEqual(page.pageErrors, [], 'the editing stage must mount without throwing');

    await page.evalFn(async (payload) => {
        const rangesMod = await import('/src/lib/editor-ranges.js');
        const adapters = await import('/src/data/adapters-r.js');
        /* Same one served array feeds both halves of the door — see `seedMatrix` above. */
        const ranges = rangesMod.createEditorRanges({
            machineLimits: adapters.r2MachineLimits(payload.capabilities).value,
            machineClass: adapters.machineClassFromServedSet(payload.capabilities),
        });

        const screen = window.__h.need('editor-screen');
        const matrix = window.__h.need('step-matrix');
        const preview = window.__h.need('editor-preview');
        const overlays = window.__h.need('editor-overlays');
        const fieldRow = document.querySelector('[data-editor-field]');

        /* THE COMPOSITION ROOT. It owns the draft; every surface is handed a fresh one
         * and none of them writes. Same contract the matrix, the band and the dialogs
         * each state in their own headers. */
        const root = {
            draft: payload.draft,
            events: [],
            apply(index, key, value) {
                const steps = root.draft.steps.map((step, i) => (
                    i === index ? { ...step, [key]: value } : step
                ));
                root.draft = { ...root.draft, steps };
                root.push();
                return root.draft;
            },
            push() {
                matrix.steps = root.draft.steps;
                overlays.steps = root.draft.steps;
                preview.profile = root.draft;
            },
            /**
             * RECORD ONE EVENT. The discriminator is `event`, and it is written LAST —
             * after the payload is spread. Both halves are the fix.
             *
             * This was `{type: '<name>', ...event.detail}`, and EXIT_CONDITION_CHANGE's
             * detail carries its own `type`: the exit CHANNEL (pressure, flow, weight).
             * It won the spread, so every row that event produced read `type: 'pressure'`
             * and a filter on `type === 'exit-condition-change'` matched NOTHING — and
             * matched nothing SILENTLY, which is why the one outcome the exit dialog
             * reports went unasserted for a whole wave while the suite filtered on `slot`
             * to work around it. The payload was never wrong; the frame field was.
             *
             * A reserved key on its own would only move the collision, so the ORDER
             * carries the guarantee: the payload goes down first and the recorder's own
             * field is written over the top, where no detail can reach it. That inverts
             * the risk onto a detail that genuinely carries `event`, which would now lose
             * payload silently — so that case THROWS. Every stage here asserts
             * `page.pageErrors` is empty, so such a payload fails loudly on first press
             * rather than quietly dropping a field.
             */
            record(name, detail) {
                if (detail && Object.prototype.hasOwnProperty.call(detail, 'event')) {
                    throw new Error(`editor harness: the '${name}' detail carries an 'event' key, `
                        + 'which is the recorder\'s own discriminator — rename that payload field '
                        + 'or nest the detail, because one of the two would be lost silently');
                }
                root.events.push({ ...detail, event: name });
            },
        };
        window.__editor = root;

        screen.addEventListener('step-change', (event) => {
            const { index, field: key, value } = event.detail ?? {};
            root.record('step-change', { index, field: key, value });
            if (typeof key === 'string') root.apply(index, key, value);
        });
        screen.addEventListener('value-commit', (event) => root.record('value-commit', event.detail));
        screen.addEventListener('exit-condition-change',
            (event) => root.record('exit-condition-change', event.detail));
        screen.addEventListener('lever-change', (event) => root.record('lever-change', event.detail));
        screen.addEventListener('numpad-refused', (event) => root.record('numpad-refused', event.detail));

        matrix.ranges = ranges;
        matrix.editable = true;
        if (payload.density) matrix.density = payload.density;
        overlays.ranges = ranges;
        overlays.source = screen;

        /* The field row is armed FROM THE DOOR, by the field id its own attribute names.
         * No number crosses from this file. */
        if (fieldRow) {
            const entry = ranges.rangeFor(payload.field);
            fieldRow.min = entry.min;
            fieldRow.max = entry.max;
            fieldRow.step = entry.step;
            fieldRow.unit = entry.unit ?? '';
            fieldRow.value = payload.draft.target_weight;
        }

        root.push();
        await Promise.all([
            matrix.updateComplete, preview.updateComplete, overlays.updateComplete,
        ]);
    }, { draft, capabilities, density, field });

    await page.settle(6);
    return page;
}

/** The chart card's own instruments: constructions and paints, straight off #9. */
export async function chartCounts(page) {
    return page.evalFn((sel) => {
        const card = window.__h.need(sel);
        return {
            build: card.buildCount,
            paint: card.paintCount,
            hasPlot: Boolean(card.plotHandle),
            empty: card.empty === true,
        };
    }, EDITOR.previewCard);
}

/** What the card is currently drawing, by value — for "the data changed each time". */
export async function chartData(page) {
    return page.evalFn((sel) => {
        const card = window.__h.need(sel);
        const raw = card.plotHandle?.raw ?? null;
        const data = raw?.data ?? null;
        const xs = data && data[0] ? data[0] : [];
        return {
            series: data ? data.length : 0,
            points: xs.length,
            /* The END OF THE X AXIS is what a duration edit moves, so it is the honest
             * "did the data change" probe for an edit to a step's own stop. */
            lastX: xs.length ? xs[xs.length - 1] : null,
            last: data && data[1] ? data[1][data[1].length - 1] : null,
            derivationOk: Boolean(card.derivation?.ok),
        };
    }, EDITOR.previewCard);
}

/** Apply N edits to one step field through the composition root, without a press. */
export async function driveEdits(page, { index = 0, key = 'seconds', from = 10, count = 8 } = {}) {
    const applied = await page.evalFn((i, k, start, n) => {
        const out = [];
        for (let step = 0; step < n; step += 1) {
            const value = start + step;
            window.__editor.apply(i, k, value);
            out.push(value);
        }
        return out;
    }, index, key, from, count);
    await page.settle(4);
    return applied;
}

/** The keypad's own reading of its bounds, and what the door says they are. */
export async function numpadRangeReport(page, { field = null, key = null } = {}) {
    return page.evalFn(async (sel, f, k) => {
        const pad = window.__h.need(sel);
        const limits = await import('/src/lib/machine-limits.js');
        const hint = pad.renderRoot.querySelector('#hint');
        const declared = pad.limits ? limits.numpadRange(pad.limits, pad.limitKey) : null;
        return {
            limitKey: pad.limitKey,
            ranged: pad.ranged,
            hint: hint ? hint.textContent.trim() : '',
            declaredLabel: declared ? declared.label : '',
            min: declared ? declared.min : null,
            max: declared ? declared.max : null,
            step: declared ? declared.step : null,
            askedField: f,
            askedKey: k,
        };
    }, EDITOR.numpad, field, key);
}

/** Type a value into the open keypad and press Confirm. Real hit-tested presses. */
export async function typeNumpad(page, digits) {
    for (const digit of String(digits)) {
        const id = digit === '.' ? 'decimal' : digit;
        await page.click(`${EDITOR.numpad} >>> #key-${id}`);
    }
    await page.click(`${EDITOR.numpad} >>> #confirm`);
    await page.settle(4);
}

/**
 * Everything the composition root recorded, in order.
 *
 * EACH ROW IS `{...detail, event: '<event name>'}`. Filter on `event`, never on `type`:
 * `type` belongs to the exit dialog's payload (the exit channel) and means nothing on the
 * other four rows. See `record()` in the stage above for why the discriminator moved.
 */
export const editorEvents = (page) => page.evalFn(() => window.__editor.events.map((e) => ({ ...e })));

/** Every row the composition root recorded for one event name, in order. */
export const eventsNamed = async (page, name) => (await editorEvents(page)).filter((e) => e.event === name);

/**
 * EVERY STRING CHROME WOULD ANNOUNCE, names and values alike, from its own tree.
 *
 * `accessibleNames` above answers "what is this control called" and drops the roles that
 * carry no name of their own — `generic` and `StaticText` among them. A visually-hidden
 * reading (#43's `label`, ui-badge's, ui-keycap's) is exactly that: static text inside a
 * generic box, carrying no role and needing none. It is announced, and it is invisible to
 * a role-filtered walk — so a reading can be missing from the tree entirely while every
 * named node still checks out. This is the probe for "is the value ANNOUNCED AT ALL".
 */
export async function accessibleText(page) {
    await page.send('Accessibility.enable');
    const tree = await page.send('Accessibility.getFullAXTree');
    return tree.nodes
        .filter((node) => !node.ignored)
        .flatMap((node) => [node.name?.value, node.value?.value])
        .filter((text) => typeof text === 'string' && text.trim().length > 0);
}
