/**
 * Gate A for.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';
import {
    assertTokenDrill,
    assertFocusUnclipped,
    DRILL_COLOUR,
} from '../harness/assertions.js';

const MODULE = ['/src/components/ui-page-header.js'];

const FIXTURE_CSS = `
<style>
    .child:focus-visible {
        outline: var(--ui-focus-w) solid var(--ui-steel);
        outline-offset: var(--_ui-focus-offset, var(--ui-focus-offset));
    }
    button.child { margin: 0; padding: 0 18px; border: 0; background: none; font: inherit;
                   block-size: 82px; color: inherit; }

    /* THE SCREEN GRID, from LAYOUT_SPEC_DRAFT.md:519-525 — the band is row 1 and the
     * gap below it IS the header underline (departure 2). Written by hand rather than
     * with the seam utility so this suite depends on nothing but the component. */
    .screen {
        display: grid;
        grid-template-rows: var(--ui-band-h) minmax(0, 1fr);
        gap: var(--ui-seam);
        background: var(--ui-line-strong);
        block-size: 320px;
    }
    .screen > .body { background: var(--ui-fascia); }

    /* THE P17 ATTACK SHEET — the SELECTOR half. Every selector Slate's own three sheets
     * use to reach a page header, plus three ways a screen might try to reach a Lit
     * component. All of them are legal CSS and none can cross a shadow boundary — which
     * is the point. The TOKEN half of the attack is not here, because it works: it is
     * applied per test in "the one reachable path is the token channel", and asserting
     * it live for the whole file would move the inset under every other test. */
    #subpage-header, .slate-editor-header, .slate-live-header { padding: 0 30px; }
    ui-page-header .band { padding-inline: 30px; }
    ui-page-header * { padding-inline: 30px; }
    ui-page-header::part(band) { padding-inline: 30px; }

    /* #2's WIDENING HOOK, both halves, live throughout (review finding c3-4 — nothing
     * exercised this before). The first two name the commit cluster inside the shadow
     * root and can never land; the third names a SLOTTED control in the consumer's own
     * light tree and must land. Which is which is the whole content of the hook. */
    ui-page-header ui-button.header-action { inline-size: 96px; }
    ui-page-header::part(header-action) { inline-size: 96px; }
    #editor-wide.header-action { inline-size: 96px; }

    /* A second reader of --ui-space-6 on the same screen, for the blast-radius half of
     * the token-channel test: a per-screen retarget is not a per-band knob. */
    .inset-probe { padding-inline: var(--ui-space-6); }
</style>`;

const MARKUP = `${FIXTURE_CSS}
<div id="screen-a" class="screen" style="inline-size: 900px">
    <ui-page-header id="settings" heading="Settings" commit change-count="3"></ui-page-header>
    <div class="body"><div id="probe-a" class="inset-probe"></div></div>
</div>

<div id="screen-b" class="screen" style="inline-size: 900px">
    <ui-page-header id="clean" heading="Settings" commit change-count="0"></ui-page-header>
    <div class="body"></div>
</div>

<div id="screen-c" class="screen" style="inline-size: 900px">
    <ui-page-header id="editor" heading="Profile editor">
        <div slot="centre" id="tabs" style="display:flex; gap:8px">
            <button class="child is-selected" id="tab-1" aria-selected="true">Steps</button>
            <button class="child" id="tab-2" aria-selected="false">Review</button>
        </div>
        <div slot="trail" id="editor-actions" style="display:flex; gap:24px">
            <button class="child" id="editor-exit">Exit</button>
        </div>
        <button class="child header-action" slot="trail" id="editor-wide">Wide</button>
    </ui-page-header>
    <div class="body"><div id="probe-c" class="inset-probe"></div></div>
</div>

<div id="screen-d" class="screen" style="inline-size: 900px">
    <ui-page-header id="live" layout="centre" banner>
        <button class="child" slot="lead" id="library">Profiles</button>
        <div slot="centre" id="bank" style="display:flex; gap:8px; min-inline-size:0">
            <button class="child" id="fav-1" aria-pressed="true">One</button>
            <button class="child" id="fav-2" aria-pressed="false">Two</button>
        </div>
        <button class="child" slot="trail" id="sleep">Sleep</button>
    </ui-page-header>
    <div class="body"></div>
</div>

<div id="screen-e" class="screen" style="inline-size: 900px">
    <ui-page-header id="fallback" heading="Fallback" layout="Nope"></ui-page-header>
    <div class="body"></div>
</div>

<div id="squeeze-holder" style="inline-size: 900px">
    <ui-page-header id="squeeze" heading="A profile name long enough that the band has to decide what gives first" commit change-count="12"></ui-page-header>
</div>

<div id="fixed-holder" style="inline-size: 640px">
    <ui-page-header id="fixed" heading="Settings" commit change-count="3"></ui-page-header>
</div>

<div id="dialog-holder" role="dialog" aria-label="Settings" style="inline-size: 900px">
    <ui-page-header id="in-dialog" heading="Settings" commit change-count="0"></ui-page-header>
</div>
`;

const ORACLE = {
    bandH: 118,        // at --ui-density 1; the compact band is 103.25 (tokens.css:182)
    controlLg: 82,
    bandInset: 18,     // the derived block inset — never declared, always measured
    slateInset: 30,    // P17, the defect
    inset: 28,
    regionGap: 18,     // --ui-space-4, the editor header's own column-gap
    clusterGap: 24,
    titleSize: 28,
    titleWeight: '500',
    dark: { bar: 'rgb(17, 22, 26)', text: 'rgb(244, 247, 248)' },
    light: { bar: 'rgb(250, 250, 250)', text: 'rgb(23, 26, 28)' },
};

const near = (got, want, what, tol = 0.6) => assert.ok(
    Math.abs(parseFloat(got) - want) <= tol,
    `${what}: expected ~${want}px, rendered ${got}`,
);

const axRoleOf = async (page, hostId) => {
    await page.send('Accessibility.enable');
    const handle = await page.send('Runtime.evaluate', {
        expression: `document.getElementById(${JSON.stringify(hostId)})`
            + '.shadowRoot.getElementById("band")',
        returnByValue: false,
    });
    const tree = await page.send('Accessibility.queryAXTree', {
        objectId: handle.result.objectId,
    });
    const node = tree.nodes[0];
    return { role: node?.role?.value ?? null, ignored: node?.ignored ?? null };
};

/** The rendered text of a deep-selected element, trimmed. */
const textOf = (page, selector) => page.evalFn((sel) => {
    const el = window.__h.q(sel);
    return el ? el.textContent.trim() : null;
}, selector);

/** The page's own --ui-density, so a band-height expectation is derived here the same
 *  way the token derives it there rather than restated per geometry. */
const densityOf = async (page) => parseFloat(await page.tokenValue('--ui-density'));

/** Every element inside a host's shadow tree, with everything selection could paint.
 *  Used by the wave-law assertion: "no private selected look anywhere in this wave". */
const shadowPaint = (page, hostId) => page.evalFn((id) => {
    const root = document.getElementById(id).shadowRoot;
    return [...root.querySelectorAll('*')].map((el) => {
        const cs = getComputedStyle(el);
        return {
            tag: el.localName,
            id: el.id,
            background: cs.backgroundColor,
            colour: cs.color,
            boxShadow: cs.boxShadow,
            textShadow: cs.textShadow,
        };
    });
}, hostId);

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`ui-page-header @ ${geometry.name} (${geometry.width}×${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

        const mounted = (fn) => browser.withPage({ geometry }, async (page) => {
            await page.mount(MARKUP, MODULE);
            assert.deepEqual(page.pageErrors, [], 'ui-page-header must mount without throwing');
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

        test('the density band is the one this geometry sits in', () => mounted(async (page) => {
            assert.equal(await densityOf(page), geometry.height < 700 ? 0.875 : 1);
        }));

        test('the band is --ui-band-h, and the host cannot be squashed below it', () => mounted(async (page) => {
            const bandH = ORACLE.bandH * await densityOf(page);
            for (const id of ['settings', 'clean', 'editor', 'live', 'fallback']) {
                near((await page.box(`#${id}`)).height, bandH, `#${id} host`);
                near((await page.box(`#${id} >>> #band`)).height, bandH, `#${id} band`);
            }
        }));

        test('the ground is --ui-bar, and nothing else paints it', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-bar',
                value: DRILL_COLOUR,
                selector: '#settings >>> #band',
                property: 'background-color',
            });
        }));

        test('P17: the inline inset is 28px, on the scale, and identical on both edges', () => mounted(async (page) => {
            for (const id of ['settings', 'clean', 'editor', 'live', 'fallback']) {
                const pad = await page.computed(`#${id} >>> #band`,
                    ['padding-left', 'padding-right']);
                near(pad['padding-left'], ORACLE.inset, `#${id} padding-left`);
                near(pad['padding-right'], ORACLE.inset, `#${id} padding-right`);
                assert.equal(pad['padding-left'], pad['padding-right'],
                    `#${id}: the two edges of one band must be one value — P17 is 2px of drift`);
                assert.notEqual(parseFloat(pad['padding-left']), ORACLE.slateInset,
                    `#${id}: the off-scale 30px is back`);
            }
        }));

        test('P17: the inset is --ui-space-6, so it moves with the whole scale', () => mounted(async (page) => {
            const drill = await assertTokenDrill(page, {
                token: '--ui-space-6',
                value: '37px',
                selector: '#settings >>> #band',
                property: 'padding-left',
            });
            near(drill.before, ORACLE.inset, 'the resting inset is the scale step, not 30px');
            // …and the far edge reads the same token, not a second declaration.
            const far = await assertTokenDrill(page, {
                token: '--ui-space-6',
                value: '37px',
                selector: '#settings >>> #band',
                property: 'padding-right',
            });
            near(far.before, ORACLE.inset, 'the far edge reads the same token');
        }));

        test('P17: the one reachable path is the token channel, and it is not a per-band knob',
            () => mounted(async (page) => {
                const insetOf = async (id) =>
                    (await page.computed(`#${id} >>> #band`, ['padding-left']))['padding-left'];

                near(await insetOf('settings'), ORACLE.inset, 'the resting inset');
                near((await page.computed('#probe-a', ['padding-left']))['padding-left'],
                    ORACLE.inset, 'and the probe on the same screen reads the same token');

                // THE PATH IS REAL. This is P17's exact 2px, bought per screen.
                await page.setStyle('#screen-a', { '--ui-space-6': '30px' });
                try {
                    near(await insetOf('settings'), ORACLE.slateInset,
                        'the token channel must really reach the band — if this passes at 28 '
                        + 'the test is asserting the wrong mechanism');

                    near((await page.computed('#probe-a', ['padding-left']))['padding-left'],
                        ORACLE.slateInset,
                        'the retarget must move every reader of the token in that subtree');

                    near(await insetOf('editor'), ORACLE.inset,
                        'a retarget on one screen must not reach another');
                    near((await page.computed('#probe-c', ['padding-left']))['padding-left'],
                        ORACLE.inset, 'nor that screen\'s other readers');
                } finally {
                    await page.setStyle('#screen-a', { '--ui-space-6': null });
                }
                near(await insetOf('settings'), ORACLE.inset, 'and it comes back');
            }));

        test('P17 cannot express: no SELECTOR from outside reaches the inset', () => mounted(async (page) => {
            for (const id of ['settings', 'editor', 'live']) {
                near((await page.computed(`#${id} >>> #band`, ['padding-left']))['padding-left'],
                    ORACLE.inset, `#${id}: a screen sheet moved the inset`);
            }
            await page.setStyle('#settings', { 'padding-inline': '30px' });
            near((await page.computed('#settings >>> #band', ['padding-left']))['padding-left'],
                ORACLE.inset, 'host padding must not leak into the band inset');
            await page.setStyle('#settings', { 'padding-inline': null });
        }));

        test('P17 cannot express: three configurations are one implementation', () => mounted(async (page) => {
            const insets = [];
            for (const id of ['settings', 'editor', 'live']) {
                const pad = await page.computed(`#${id} >>> #band`, ['padding-left', 'padding-right']);
                insets.push(pad['padding-left'], pad['padding-right']);
            }
            assert.equal(new Set(insets).size, 1,
                `six edges across three bands must be one value, measured ${insets.join(' / ')}`);
        }));

        test('the 18px block inset is DERIVED, never declared', () => mounted(async (page) => {
            await page.setToken('--ui-density', '1');
            const band = await page.box('#settings >>> #band');
            const save = await page.box('#settings >>> #save');
            await page.setToken('--ui-density', null);

            near(band.height, ORACLE.bandH, 'the band is the oracle 118px at density 1');
            near(save.height, ORACLE.controlLg, 'the save button is --ui-control-lg');
            near(save.top - band.top, ORACLE.bandInset, 'the top inset falls out of centring');
            near(band.bottom - save.bottom, ORACLE.bandInset, 'and so does the bottom one');

            const pad = await page.computed('#settings >>> #band', ['padding-top', 'padding-bottom']);
            assert.equal(parseFloat(pad['padding-top']), 0, 'no declared block padding');
            assert.equal(parseFloat(pad['padding-bottom']), 0, 'no declared block padding');
        }));

        test('derivation drill: --ui-control-lg moves the band height', () => mounted(async (page) => {
            const density = await densityOf(page);
            const drill = await assertTokenDrill(page, {
                token: '--ui-control-lg',
                value: '100px',
                selector: '#settings >>> #band',
                property: 'height',
                expectLanding: false,
            });
            near(drill.before, ORACLE.bandH * density, 'the resting band');
            near(drill.after, (100 + 2 * ORACLE.bandInset) * density,
                'band-h = (control-lg + 2 × band-inset) × density');
        }));

        test('derivation drill: --ui-band-inset moves the band height', () => mounted(async (page) => {
            const density = await densityOf(page);
            const drill = await assertTokenDrill(page, {
                token: '--ui-band-inset',
                value: '30px',
                selector: '#settings >>> #band',
                property: 'height',
                expectLanding: false,
            });
            near(drill.after, (ORACLE.controlLg + 60) * density,
                'band-h = (control-lg + 2 × band-inset) × density');
        }));

        test('derivation drill: --ui-density shrinks the BAND and not the CONTROL', () => mounted(async (page) => {
            await page.setToken('--ui-density', '1');
            const regular = {
                band: (await page.box('#settings >>> #band')).height,
                save: (await page.box('#settings >>> #save')).height,
            };
            await page.setToken('--ui-density', '0.75');
            const compact = {
                band: (await page.box('#settings >>> #band')).height,
                save: (await page.box('#settings >>> #save')).height,
                top: (await page.box('#settings >>> #save')).top
                    - (await page.box('#settings >>> #band')).top,
            };
            await page.setToken('--ui-density', null);

            near(regular.band, ORACLE.bandH, 'regular band');
            near(compact.band, ORACLE.bandH * 0.75, 'the band lost height with the density');
            near(compact.save, ORACLE.controlLg, 'the control is physical and did not');
            near(regular.save, compact.save, 'the control did not move with the density band');
            assert.ok(compact.band >= compact.save,
                `the compact band (${compact.band}) must still hold an ${compact.save}px control`);
            assert.ok(compact.top >= 0,
                'the control centres inside the shorter band rather than overflowing it');
        }));

        test('drill: --ui-space-4 is the gap BETWEEN regions', () => mounted(async (page) => {
            const drill = await assertTokenDrill(page, {
                token: '--ui-space-4',
                value: '37px',
                selector: '#settings >>> #band',
                property: 'column-gap',
            });
            near(drill.before, ORACLE.regionGap, 'the resting region gap is the oracle 18px');
        }));

        test('drill: --ui-space-5 is the gap WITHIN a region', () => mounted(async (page) => {
            const drill = await assertTokenDrill(page, {
                token: '--ui-space-5',
                value: '37px',
                selector: '#settings >>> #trail',
                property: 'column-gap',
            });
            near(drill.before, ORACLE.clusterGap, 'the resting cluster gap is the snapped 24px');
            assert.ok(ORACLE.clusterGap > ORACLE.regionGap,
                'the within-region gap must exceed the between-region gap');
        }));

        test('drill: the title is .ui-title, and all three of its values are tokens', () => mounted(async (page) => {
            const cs = await page.computed('#settings >>> #title', ['font-size', 'font-weight']);
            near(cs['font-size'], ORACLE.titleSize, 'title font-size');
            assert.equal(cs['font-weight'], ORACLE.titleWeight, 'title font-weight');

            await assertTokenDrill(page, {
                token: '--ui-text-xl',
                value: '37px',
                selector: '#settings >>> #title',
                property: 'font-size',
            });
            await assertTokenDrill(page, {
                token: '--ui-text',
                value: DRILL_COLOUR,
                selector: '#settings >>> #title',
                property: 'color',
            });
        }));

        test('the title carries the oracle\'s tracking, and it tracks the type size', () => mounted(async (page) => {
            near((await page.computed('#settings >>> #title', ['letter-spacing']))['letter-spacing'],
                0.28, 'the oracle\'s 0.28px at 28px type', 0.02);

            await page.setToken('--ui-text-xl', '56px');
            try {
                near((await page.computed('#settings >>> #title', ['letter-spacing']))['letter-spacing'],
                    0.56, 'tracking must be relative type, not a frozen 0.28px', 0.03);
            } finally {
                await page.setToken('--ui-text-xl', null);
            }

            assert.notEqual(
                await page.resolveValue('var(--ui-tracking-cap)', 'letter-spacing'),
                (await page.computed('#settings >>> #title', ['letter-spacing']))['letter-spacing'],
                'the page title must not silently become the sheet title\'s .04em',
            );
        }));

        test('#2\'s widening hook: the cluster is unreachable, the slotted action is not', () => mounted(async (page) => {
            const save = await page.box('#settings >>> #save');
            assert.notEqual(Math.round(save.width), 96,
                'a document rule reached inside the shadow root — that is not the hook');
            assert.ok(save.width > 96,
                `the cluster is content-sized, measured ${save.width}px for "Save (3)"`);

            near((await page.box('#editor-wide')).width, 96,
                'the consumer could not widen its own slotted action');

            await page.setStyle('#screen-c', { 'inline-size': '460px' });
            try {
                near((await page.box('#editor-wide')).width, 96,
                    'a squeezed band shrank the slotted action instead of the title');
            } finally {
                await page.setStyle('#screen-c', { 'inline-size': null });
            }
        }));

        test('drill: --ui-band-h is the host floor', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-band-h',
                value: '150px',
                selector: '#settings',
                property: 'min-block-size',
            });
        }));

        test('D11: a dirty header reads "Save (N)" and offers Cancel', () => mounted(async (page) => {
            assert.equal(await textOf(page, '#settings >>> #save'), 'Save (3)');
            assert.ok(await page.exists('#settings >>> #cancel'),
                'a dirty header offers a way back');
            near((await page.box('#settings >>> #save')).height, ORACLE.controlLg,
                'the commit control is --ui-control-lg (ui-button `tall`)');

            // The count is a NUMBER in and a SENTENCE out — set it and read it back.
            await page.evalFn(() => {
                document.getElementById('settings').changeCount = 1; return true;
            });
            await page.settle(2);
            assert.equal(await textOf(page, '#settings >>> #save'), 'Save (1)');
            await page.evalFn(() => {
                document.getElementById('settings').changeCount = 12; return true;
            });
            await page.settle(2);
            assert.equal(await textOf(page, '#settings >>> #save'), 'Save (12)');
        }));

        test('D11: a clean header spends no primary fill, and the count is what changes', () => mounted(async (page) => {
            assert.equal(await textOf(page, '#clean >>> #save'), 'Save',
                'the word is Save at zero, with no count beside it');
            assert.equal(await page.exists('#clean >>> #cancel'), true,
                'and Cancel stays — Slate\'s editor pair, on Ben\'s ruling');
            const variants = await page.evalFn(() => ({
                clean: window.__h.q('#clean >>> #save').getAttribute('variant'),
                dirty: window.__h.q('#settings >>> #save').getAttribute('variant'),
            }));
            assert.deepEqual(variants, { clean: 'default', dirty: 'primary' },
                'the affirmative treatment is still spent only when there are edits');
        }));

        test('D11: "cannot tell" is clean — a bad count never shows a false-dirty Save', () => mounted(async (page) => {
            /* "CANNOT TELL" IS STILL CLEAN, and clean is now "Save" with no count —
             * the claim is unchanged, the word at zero is not. */
            for (const [value, expected] of [[-3, 'Save'], [0, 'Save'], ['x', 'Save'], [2.7, 'Save (2)']]) {
                await page.evalFn((v) => {
                    document.getElementById('settings').changeCount = v; return true;
                }, value);
                await page.settle(2);
                assert.equal(await textOf(page, '#settings >>> #save'), expected,
                    `changeCount=${JSON.stringify(value)}`);
            }
        }));

        test('D11 cannot express: no screen can supply the wording', () => mounted(async (page) => {
            await page.evalFn(() => {
                const el = document.getElementById('settings');
                for (const name of ['save-label', 'label', 'primary-label', 'commit-label',
                    'primarylabel', 'save-text']) {
                    el.setAttribute(name, 'Commit everything');
                }
                el.textContent = 'Commit everything';   // unassigned: renders nowhere
                return true;
            });
            await page.settle(3);
            assert.equal(await textOf(page, '#settings >>> #save'), 'Save (3)',
                'six label attributes and a textContent write must all do nothing');
            assert.equal(await textOf(page, '#settings >>> #cancel'), 'Cancel');
        }));

        test('D11: the wording is one translatable SENTENCE, not a word plus punctuation',
            () => mounted(async (page) => {
                const setLang = (lang, strings) => page.evalFn(async (l, s) => {
                    const m = await import('/src/lib/i18n.js');
                    m.translations.set(l, s);
                    return m.translations.language;
                }, lang, strings);

                assert.equal(await textOf(page, '#settings >>> #save'), 'Save (3)',
                    'an empty store renders exactly what Slate renders');

                assert.equal(await setLang('xx', {
                    'Save ({count})': '{count} unsaved — commit',
                    Save: 'Done',
                    Cancel: 'Back',
                }), 'xx');
                await page.settle(3);
                assert.equal(await textOf(page, '#settings >>> #save'), '3 unsaved — commit',
                    'the count must land where the CATALOGUE put it, not where English does');
                assert.equal(await textOf(page, '#settings >>> #cancel'), 'Back');
                assert.equal(await textOf(page, '#clean >>> #save'), 'Done',
                    'the clean label moves with the language too');

                await page.evalFn(() => {
                    document.getElementById('settings').changeCount = 7; return true;
                });
                await page.settle(2);
                assert.equal(await textOf(page, '#settings >>> #save'), '7 unsaved — commit');

                // And back: key-as-fallback means an untranslated store is English.
                await setLang('en', {});
                await page.settle(3);
                assert.equal(await textOf(page, '#settings >>> #save'), 'Save (7)');
                assert.equal(await textOf(page, '#clean >>> #save'), 'Save');
            }));

        test('D11 cannot express: a screen cannot reach the wording through the store either',
            () => mounted(async (page) => {
                await page.evalFn(async () => {
                    const m = await import('/src/lib/i18n.js');
                    m.translations.set('xx', { 'Save ({count})': 'One wording' });
                    return true;
                });
                await page.settle(3);
                const both = [
                    await textOf(page, '#settings >>> #save'),
                    await textOf(page, '#squeeze >>> #save'),
                ];
                assert.deepEqual(both, ['One wording', 'One wording'],
                    'two headers on one screen must speak with one voice');
                await page.evalFn(async () => {
                    const m = await import('/src/lib/i18n.js');
                    m.translations.set('en', {});
                    return true;
                });
            }));

        test('D11: the commit cluster reports, and reports the state it painted', () => mounted(async (page) => {
            await page.recordEvents('#settings', ['commit', 'cancel']);
            await page.click('#settings >>> #save >>> button');
            await page.click('#settings >>> #cancel >>> button');
            const events = await page.recordedEvents();
            assert.equal(events.length, 2, 'one event per press');
            assert.equal(events[0].type, 'commit');
            assert.equal(events[1].type, 'cancel');
            assert.deepEqual(events[0].detail, { changeCount: 3, dirty: true });

            await page.recordEvents('#clean', ['commit']);
            await page.click('#clean >>> #save >>> button');
            const clean = await page.recordedEvents();
            assert.equal(clean.at(-1).type, 'commit');
            assert.deepEqual(clean.at(-1).detail, { changeCount: 0, dirty: false });
        }));

        test('wave law: the four dials move nothing in this shadow tree', () => mounted(async (page) => {
            const before = await shadowPaint(page, 'live');
            await page.setToken('--ui-selected-face', DRILL_COLOUR);
            await page.setToken('--ui-selected-ink', DRILL_COLOUR);
            await page.setToken('--ui-selected-led', '9px');
            await page.setToken('--ui-selected-glow', '90%');
            const after = await shadowPaint(page, 'live');
            for (const dial of ['--ui-selected-face', '--ui-selected-ink',
                '--ui-selected-led', '--ui-selected-glow']) {
                await page.setToken(dial, null);
            }
            assert.deepEqual(after, before,
                'a page header that answers the selection dials is the seventh treatment');
        }));

        test('wave law: a slotted [aria-selected] takes nothing from this component', () => mounted(async (page) => {
            for (const sel of ['#tab-1', '#fav-1']) {
                const cs = await page.computed(sel, ['background-color', 'box-shadow', 'text-shadow']);
                assert.equal(cs['background-color'], 'rgba(0, 0, 0, 0)',
                    `${sel}: the header painted a selected slot`);
                assert.equal(cs['box-shadow'], 'none', `${sel}: the header drew a LED`);
                assert.equal(cs['text-shadow'], 'none', `${sel}: the header drew a glow`);
            }
        }));

        test('the commit buttons take the one ring, unclipped', () => mounted(async (page) => {
            await assertFocusUnclipped(page, '#settings >>> #save >>> button');
            await assertFocusUnclipped(page, '#settings >>> #cancel >>> button');
        }));

        test('a slotted control in any region takes the one ring, unclipped', () => mounted(async (page) => {
            for (const sel of ['#library', '#fav-1', '#sleep', '#editor-exit']) {
                await assertFocusUnclipped(page, sel);
            }
        }));

        test('no second focus treatment: the ring is the base ring', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-focus-w',
                value: '7px',
                selector: '#settings >>> #save >>> button',
                property: 'outline-width',
                prepare: (p) => p.focusVisible('#settings >>> #save >>> button'),
            });
        }));

        test('the band fills its container and reads no viewport', () => mounted(async (page) => {
            const host = await page.box('#fixed');
            const band = await page.box('#fixed >>> #band');
            near(host.width, 640, 'the host fills its container');
            near(band.width, 640, 'and the band fills the host');
            assert.equal(await page.prop('#fixed', 'container-type'), 'inline-size',
                'the component declares its container (CONVENTIONS §2)');
        }));

        test('the title gives before the actions do', () => mounted(async (page) => {
            const bandH = ORACLE.bandH * await densityOf(page);
            const wide = await page.box('#squeeze >>> #save');
            await page.setStyle('#squeeze-holder', { 'inline-size': '460px' });
            const tight = {
                save: await page.box('#squeeze >>> #save'),
                band: await page.box('#squeeze >>> #band'),
                title: await page.metrics('#squeeze >>> #title'),
            };
            await page.setStyle('#squeeze-holder', { 'inline-size': null });

            near(tight.band.height, bandH, 'the band keeps its floor when squeezed');
            near(tight.save.height, ORACLE.controlLg, 'the action keeps its physical height');
            near(tight.save.width, wide.width, 'the action keeps its width — the title gave');
            assert.ok(tight.title.scrollWidth > tight.title.clientWidth + 0.5,
                'the title is the box that overflowed');
            assert.equal(
                (await page.computed('#squeeze >>> #title', ['text-overflow']))['text-overflow'],
                'ellipsis',
                'and it says so, rather than cutting mid-glyph',
            );
            assert.ok(tight.save.right <= tight.band.right - ORACLE.inset + 0.6,
                `the trail was pushed out of the band (${tight.save.right} vs ${tight.band.right})`);
        }));

        test('the two layouts are the spec\'s two, and the fallback is flanks', () => mounted(async (page) => {
            const tracks = async (sel) => (await page.prop(sel, 'grid-template-columns'))
                .split(/\s+/).map(parseFloat);
            const editor = await tracks('#editor >>> #band');
            const live = await tracks('#live >>> #band');
            assert.equal(editor.length, 3, `flanks: three tracks, got ${editor.join(' / ')}`);
            assert.equal(live.length, 3, `centre: three tracks, got ${live.join(' / ')}`);
            assert.ok(editor[0] > editor[1] && editor[2] > editor[1],
                `flanks: the two flanks take the room, measured ${editor.join(' / ')}`);
            assert.ok(live[1] > live[0] && live[1] > live[2],
                `centre: the centre takes the room, measured ${live.join(' / ')}`);
            near(editor[0], editor[2], 'the flanks are equal, so the centre is optically centred');

            // layout="Nope" falls back rather than collapsing the band.
            assert.equal(await page.prop('#fallback', 'display'), 'grid');
            assert.equal(
                await page.evalFn(() => document.getElementById('fallback').getAttribute('layout')),
                'flanks',
                'an unrecognised layout is normalised, not honoured',
            );
        }));

        test('the band draws no bottom edge of its own', () => mounted(async (page) => {
            const cs = await page.computed('#settings >>> #band',
                ['box-shadow', 'border-bottom-width', 'border-bottom-style']);
            assert.equal(cs['box-shadow'], 'none', 'the band draws no shadow');
            assert.equal(parseFloat(cs['border-bottom-width']), 0, 'and no border');
            assert.equal(cs['border-bottom-style'], 'none');
        }));

        test('the screen grid draws it, once, as a gap', () => mounted(async (page) => {
            const band = await page.box('#settings >>> #band');
            const body = await page.box('#screen-a > .body');
            const seam = parseFloat(await page.prop('#screen-a', 'row-gap'));
            assert.ok(seam > 0, 'the seam is a real gap');
            near(body.top - band.bottom, seam, 'exactly one seam between band and body');
        }));

        test('the band is a <header>, and the landmark is opt-in', () => mounted(async (page) => {
            const shape = await page.evalFn(() => {
                const read = (id) => {
                    const el = document.getElementById(id).shadowRoot.getElementById('band');
                    return { tag: el.localName, role: el.getAttribute('role') };
                };
                return {
                    live: read('live'),
                    settings: read('settings'),
                    inDialog: read('in-dialog'),
                };
            });
            assert.equal(shape.live.tag, 'header');
            assert.equal(shape.settings.tag, 'header');
            assert.equal(shape.inDialog.tag, 'header', 'it stays a real <header> either way');
            assert.equal(shape.live.role, 'banner', 'Live opts in');

            assert.equal(shape.settings.role, 'none', 'the non-banner case says so out loud');
            assert.equal(shape.inDialog.role, 'none');

            const ax = {
                live: await axRoleOf(page, 'live'),
                settings: await axRoleOf(page, 'settings'),
                inDialog: await axRoleOf(page, 'in-dialog'),
            };
            assert.equal(ax.live.role, 'banner', 'Live really is a banner landmark');
            assert.notEqual(ax.settings.role, 'banner',
                'a default band computed a banner landmark — departure 3 is not achieved');
            assert.notEqual(ax.inDialog.role, 'banner',
                'a banner landmark inside a dialog is a landmark in the wrong place');
            assert.equal(ax.inDialog.role, 'none');
        }));

        test('the heading is a real <h1>, and only when there is one', () => mounted(async (page) => {
            const headings = await page.evalFn(() => {
                const read = (id) => {
                    const t = document.getElementById(id).shadowRoot.getElementById('title');
                    return t ? { tag: t.localName, text: t.textContent } : null;
                };
                return { settings: read('settings'), live: read('live') };
            });
            assert.deepEqual(headings.settings, { tag: 'h1', text: 'Settings' });
            assert.equal(headings.live, null,
                'a band with no heading renders no empty heading box');
        }));

        test('the commit buttons carry their own accessible name', () => mounted(async (page) => {
            const names = await page.evalFn(() => {
                const btn = (host, id) => document.getElementById(host).shadowRoot
                    .getElementById(id).shadowRoot.querySelector('button');
                const nameOf = (host, id) => {
                    const b = btn(host, id);
                    const slot = b.querySelector('slot');
                    const text = slot
                        ? slot.assignedNodes({ flatten: true })
                            .map((n) => n.textContent).join('')
                        : b.textContent;
                    return text.trim();
                };
                return {
                    save: nameOf('settings', 'save'),
                    cancel: nameOf('settings', 'cancel'),
                    close: nameOf('clean', 'save'),
                    saveAria: btn('settings', 'save').getAttribute('aria-label'),
                };
            });
            assert.equal(names.save, 'Save (3)');
            assert.equal(names.cancel, 'Cancel');
            assert.equal(names.close, 'Save', 'clean is Save with no count — Ben, 25 Aug 2026');
            assert.equal(names.saveAria, null,
                'the visible text IS the name — an aria-label here could disagree with it');
        }));

        test('every paint in this component landed from a plain class rule', () => mounted(async (page) => {
            const cs = await page.computed('#settings >>> #band',
                ['background-color', 'display', 'align-items', 'column-gap']);
            assert.equal(cs.display, 'grid');
            assert.equal(cs['align-items'], 'center');
            near(cs['column-gap'], ORACLE.regionGap, 'column-gap');
            assert.notEqual(cs['background-color'], 'rgba(0, 0, 0, 0)', 'the ground painted');
        }));
    });
}

describe('ui-page-header across themes', () => {
    const seen = {};

    for (const theme of ['dark', 'light']) {
        test(`the band and the title read the theme's tokens — ${theme}`, () => browser.withPage(
            { geometry: GATE_A_GEOMETRIES[0], theme },
            async (page) => {
                await page.mount(MARKUP, MODULE);
                assert.deepEqual(page.pageErrors, []);
                seen[theme] = await page.computed('#settings >>> #band', ['background-color']);
                const title = await page.computed('#settings >>> #title', ['color']);

                assert.equal(seen[theme]['background-color'], ORACLE[theme].bar);
                assert.equal(title.color, ORACLE[theme].text);
            },
        ));
    }

    test('the two themes really are two values', () => {
        assert.notEqual(seen.dark['background-color'], seen.light['background-color']);
    });
});

describe('the gallery entry this component ships', () => {
    test('every declared state mounts, settles and paints a band', async () => {
        const { entry } = await import('../../tools/gallery/entries/ui-page-header.entry.js');

        assert.equal(entry.id, 'ui-page-header', 'the entry id is the tag name is the file name');
        assert.equal(entry.module, '../../src/components/ui-page-header.js',
            'module is relative to tools/gallery/, which is where gallery.js imports it from');
        assert.ok(entry.states.length >= 3);
        assert.equal(new Set(entry.states.map((s) => s.id)).size, entry.states.length,
            'state ids are capture filenames, so they must be unique');

        await browser.withPage({ geometry: GATE_A_GEOMETRIES[0] }, async (page) => {
            for (const state of entry.states) {
                const wrapper = state.hostStyle
                    ? `<div id="stage" style="${Object.entries(state.hostStyle)
                        .map(([k, v]) => `${k}:${v}`).join(';')}">${state.html}</div>`
                    : `<div id="stage">${state.html}</div>`;
                await page.mount(wrapper, MODULE);
                assert.deepEqual(page.pageErrors, [], `${entry.id}--${state.id} threw`);

                const painted = await page.evalFn(() => {
                    const hosts = [...document.querySelectorAll('ui-page-header')];
                    if (!hosts.length) return null;
                    return hosts.map((el) => {
                        const band = el.shadowRoot && el.shadowRoot.getElementById('band');
                        if (!band) return null;
                        const r = band.getBoundingClientRect();
                        const cs = getComputedStyle(band);
                        return {
                            w: r.width,
                            h: r.height,
                            bg: cs.backgroundColor,
                            padLeft: cs.paddingLeft,
                            padRight: cs.paddingRight,
                        };
                    });
                });
                assert.ok(painted && painted.length,
                    `${entry.id}--${state.id} rendered no ui-page-header at all`);

                for (const band of painted) {
                    assert.ok(band, `${entry.id}--${state.id} rendered a host with no band`);
                    assert.ok(band.w > 0, `${entry.id}--${state.id} rendered a zero-width band`);
                    near(band.h, ORACLE.bandH, `${entry.id}--${state.id} band height`);
                    assert.notEqual(band.bg, 'rgba(0, 0, 0, 0)',
                        `${entry.id}--${state.id} paints no ground`);
                    near(band.padLeft, ORACLE.inset, `${entry.id}--${state.id} padding-left`);
                    near(band.padRight, ORACLE.inset, `${entry.id}--${state.id} padding-right`);
                }
            }
        });
    });
});
